// Automatizaciones contra el servidor local: bienvenida al llegar un lead, su web guardada, la baja
// y el aviso diario (con la clave de Vercel o desde el panel).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { SITE, supabase, env } from "../e2e/_util.mjs";

const E = env();
const db = supabase();
const stamp = Date.now().toString(36);
let before_ = [];

const post = (path, body, headers = {}) => fetch(`${SITE}${path}`, {
  method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body),
});
const login = async (email, password) => (await (await fetch(`${E.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST", headers: { apikey: E.SUPABASE_ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
})).json()).access_token;
const trial = (email, consent = true) => post("/api/lead", {
  type: "prueba", email, name: "Rita y Sol", nameA: "Rita", nameB: "Sol", weddingDate: "2027-07-03 19:00",
  venue: "Finca El Olivo, Ronda", city: "Ronda", style: "jardin", consent, consentText: consent ? "Acepto que me escribáis" : undefined,
});

before(async () => {
  before_ = await db.select("automations?select=code,enabled");
  await db.update("automations?code=eq.lead_bienvenida", { enabled: true });
  await db.remove("rate_limits?key=like.*");
});
after(async () => {
  for (const a of before_) await db.update(`automations?code=eq.${a.code}`, { enabled: a.enabled });
});

test("lead nuevo con permiso: bienvenida al momento; sin permiso, nada", async () => {
  const yes = `si.${stamp}@example.com`, no = `no.${stamp}@example.com`;
  assert.equal((await trial(yes)).status, 200);
  assert.equal((await trial(no, false)).status, 200);
  const logs = await db.select(`email_log?template=eq.lead_bienvenida&to_email=in.(${yes},${no})&select=to_email,subject`);
  assert.deepEqual(logs.map((l) => l.to_email), [yes]);
  assert.equal(logs[0].subject, "Vuestra web de boda, Rita y Sol");
  // Repetir la prueba no vuelve a mandar la bienvenida.
  await trial(yes);
  assert.equal((await db.select(`email_log?template=eq.lead_bienvenida&to_email=eq.${yes}&select=id`)).length, 1);
});

test("su web guardada se abre con la clave del email", async () => {
  const [l] = await db.select(`leads?email=eq.si.${stamp}@example.com&select=preview_token`);
  const r = await (await fetch(`${SITE}/api/lead?prueba=${l.preview_token}`)).json();
  assert.deepEqual(r.prueba.couple, ["Rita", "Sol"]);
  assert.equal(r.prueba.venue, "Finca El Olivo");
  assert.equal(r.prueba.style, "jardin");
  assert.equal((await fetch(`${SITE}/api/lead?prueba=${"x".repeat(30)}`)).status, 404);
});

test("baja: la página no da de baja; el botón (o el «darse de baja» del correo), sí", async () => {
  const email = `baja.${stamp}@example.com`;
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= E.SUPABASE_SERVICE_ROLE_KEY;
  const { unsubscribeUrl } = await import("../../api/_lib/automatizaciones.js");
  const url = unsubscribeUrl(SITE, email);
  const page = await fetch(url);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Sí, darme de baja/);
  assert.equal((await db.select(`email_optouts?email=eq.${email}&select=id`)).length, 0, "abrir el enlace no da de baja");
  const done = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "List-Unsubscribe=One-Click" });
  assert.match(await done.text(), /no os escribiremos más/);
  assert.equal((await db.select(`email_optouts?email=eq.${email}&select=id`)).length, 1);
  assert.equal((await fetch(url.replace(/t=[^&]+/, "t=falsa"))).status, 400);
});

test("aviso diario: con la clave de Vercel; desde el panel, solo administradores", async () => {
  if (E.CRON_SECRET) {
    const r = await fetch(`${SITE}/api/cron?tarea=automatizaciones`, { headers: { Authorization: `Bearer ${E.CRON_SECRET}` } });
    assert.equal(r.status, 200);
    const d = await r.json();
    assert.ok(d.automatizaciones.emails && "leads_anonimizados" in d.automatizaciones, JSON.stringify(d));
  }
  const editor = await login("ayudante@example.com", "demo-ayudante-1234");
  assert.equal((await post("/api/cron?tarea=automatizaciones", {}, { Authorization: `Bearer ${editor}` })).status, 401);
  const luis = await login("luis@example.com", "demo-luis-1234");
  assert.equal((await fetch(`${SITE}/api/cron?tarea=automatizaciones`, { headers: { Authorization: `Bearer ${luis}` } })).status, 401, "GET no");
  const ok = await post("/api/cron?tarea=automatizaciones", {}, { Authorization: `Bearer ${luis}` });
  assert.equal(ok.status, 200);
  assert.equal((await post("/api/cron?tarea=automatizaciones", {}, { Authorization: `Bearer ${luis}` })).status, 429, "una vez por minuto");
});
