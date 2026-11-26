// Emails y aviso diario con Supabase y Resend de mentira: no sale nada de verdad.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { refundEmail } from "../../api/_lib/emails.js";
import { sendEmail } from "../../api/_lib/avisos.js";
import cron from "../../api/cron.js";

const realFetch = globalThis.fetch;
const KEYS = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "EMAIL_FROM", "CRON_SECRET", "SITE_URL"];
const before = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
let calls, rpcs, mails;

const reply = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers });

beforeEach(() => {
  calls = [];
  rpcs = {};      // nombre de la función -> respuesta, o una función que la da
  mails = [];     // respuestas de Resend, por orden; si se acaban, envía
  Object.assign(process.env, { SUPABASE_URL: "http://supabase.prueba", SUPABASE_SERVICE_ROLE_KEY: "sb_secret_prueba",
    RESEND_API_KEY: "re_prueba", EMAIL_FROM: "Prueba <a@prueba.es>", CRON_SECRET: "secreto", SITE_URL: "https://prueba.es" });
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const body = init.body ? JSON.parse(init.body) : null;
    if (u === "https://api.resend.com/emails") { calls.push(["email", body.to[0]]); return mails.shift()?.() || reply({ id: "m1" }); }
    const name = /\/rpc\/(\w+)$/.exec(u)?.[1];
    if (name) {
      calls.push([name, body]);
      const r = typeof rpcs[name] === "function" ? rpcs[name](body) : rpcs[name];
      return r instanceof Response ? r : reply(r === undefined ? true : r);
    }
    if (u.endsWith("/email_log")) { calls.push(["email_log", body.status]); return reply([{}]); }
    throw new Error(`Llamada inesperada: ${u}`);
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
  for (const k of KEYS) if (before[k] === undefined) delete process.env[k]; else process.env[k] = before[k];
});

async function runCron() {
  const res = { statusCode: 0, setHeader() {}, end(t) { this.body = JSON.parse(t); } };
  await cron({ url: "/api/cron", method: "GET", headers: { authorization: "Bearer secreto", host: "prueba.es" } }, res);
  return res;
}
const names = () => calls.map(([n]) => n);

test("el email de devolución sin enlace no dice «null»", () => {
  const m = refundEmail({ names: "Ana y Leo", number: "P-1", amountCents: 7900, invoiceNumber: null, trackingUrl: null });
  assert.doesNotMatch(m.text, /null|undefined/);
  assert.match(m.text, /79,00\s€/);
  assert.match(refundEmail({ number: "P-1", amountCents: 100, trackingUrl: "https://x.es/s" }).text, /https:\/\/x\.es\/s/);
});

test("si Resend pide ir más despacio, se espera y se reintenta", async () => {
  mails = [() => reply({ message: "Too many requests" }, 429, { "retry-after": "0.01" })];
  const r = await sendEmail({ to: "a@a.es", subject: "s", text: "t", template: "x" });
  assert.equal(r.status, "enviado");
  assert.deepEqual(names(), ["email", "email", "email_log"]);
});

test("si sigue diciendo que no, se apunta como fallido y no insiste sin fin", async () => {
  mails = Array(5).fill(() => reply({ message: "Too many requests" }, 429, { "retry-after": "0.01" }));
  const r = await sendEmail({ to: "a@a.es", subject: "s", text: "t", template: "x" });
  assert.equal(r.status, "fallido");
  assert.equal(names().filter((n) => n === "email").length, 3);
});

test("un error que no es de ritmo no se reintenta (podría mandar dos veces)", async () => {
  mails = [() => reply({ message: "boom" }, 500)];
  assert.equal((await sendEmail({ to: "a@a.es", subject: "s", text: "t", template: "x" })).status, "fallido");
  assert.equal(names().filter((n) => n === "email").length, 1);
});

test("aviso diario: si falla el resumen, las automatizaciones y la retención se hacen igual", async () => {
  rpcs.api_digests_due = () => reply({ message: "caído" }, 500);
  rpcs.api_automation_due = [];
  rpcs.api_automation_sweep = { tareas: 2 };
  const res = await runCron();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.resumen.error, "caído");
  assert.equal(res.body.automatizaciones.tareas, 2);
});

test("aviso diario: cada resumen se marca en cuanto sale", async () => {
  const d = (id) => ({ couple_user_id: id, email: `${id}@a.es`, digest: "diario", couple: ["Ana", "Leo"], nuevas: [], stats: {}, wedding_id: "w" });
  rpcs.api_digests_due = [d("uno"), d("dos")];
  rpcs.api_automation_due = [];
  rpcs.api_automation_sweep = {};
  const res = await runCron();
  assert.deepEqual(calls.filter(([n]) => n === "email" || n === "api_digest_sent").map(([n, b]) => (n === "email" ? b : b.p_ids[0])), ["uno@a.es", "uno", "dos@a.es", "dos"]);
  assert.equal(res.body.resumen.enviados, 2);
});

test("aviso diario: si una automatización falla, las demás salen y la retención se hace", async () => {
  const item = (k) => ({ automation_id: "a", key: k, code: "resena", email: `${k}@a.es`, subject: "s", body: "b" });
  rpcs.api_digests_due = [];
  rpcs.api_automation_due = [item("x"), item("y")];
  rpcs.api_automation_claim = (b) => (b.p_key === "x" ? reply({ message: "bloqueada" }, 500) : true);
  rpcs.api_automation_sweep = { tareas: 1 };
  const res = await runCron();
  assert.deepEqual(res.body.automatizaciones.emails, { enviados: 1, simulados: 0, fallidos: 1, repetidos: 0, pendientes: 0 });
  assert.equal(res.body.automatizaciones.tareas, 1);
});

test("aviso diario: aunque falle la lista de emails, la retención de datos se hace", async () => {
  rpcs.api_digests_due = [];
  rpcs.api_automation_due = () => reply({ message: "caída" }, 500);
  rpcs.api_automation_sweep = {};
  const res = await runCron();
  assert.ok(names().includes("api_automation_sweep"));
  assert.equal(res.body.automatizaciones.error, "caída");
});
