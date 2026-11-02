// Cobros de punta a punta contra el servidor local y el Stripe de pruebas (tests/stripe-falso.mjs):
// pagar desde el escaparate, aviso firmado, factura, seguimiento con código y devoluciones.
//   Necesita en .env.local: STRIPE_SECRET_KEY=sk_test_local, STRIPE_WEBHOOK_SECRET=whsec_local,
//   STRIPE_API_BASE=http://127.0.0.1:12111 (y el servidor local reiniciado).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { SITE, supabase, env } from "../e2e/_util.mjs";
import { startFakeStripe } from "../stripe-falso.mjs";
import { signatureHeader } from "../../api/_lib/stripe.js";

const E = env();
const configured = E.STRIPE_API_BASE && /^sk_test_/.test(E.STRIPE_SECRET_KEY || "");
const db = supabase();
const STRIPE = (E.STRIPE_API_BASE || "").replace(/\/+$/, "");
let fake = null;
let sellerBefore = null;

const post = (body, headers = {}) => fetch(`${SITE}/api/pedido`, {
  method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8", ...headers }, body: JSON.stringify(body),
});
const tracking = async (code) => (await (await fetch(`${SITE}/api/pedido?c=${code}`)).json()).pedido;
const base = (extra = {}) => ({
  accion: "reservar", email: `pago-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`, name: "Irene y Teo",
  tier: "tal-cual", style: "verbena", weddingDate: "2027-09-18 13:00", startNow: true,
  startNowText: "Queremos que empecéis ya. Sabemos que, cuando nos entreguéis la web, ya no podremos desistir del contrato.", ...extra,
});

// Paga en el Stripe de pruebas (como si la pareja pulsara «Pagar») y devuelve adónde vuelve.
async function payAt(url) {
  const r = await fetch(url, { method: "POST", body: "accion=pagar", headers: { "Content-Type": "application/x-www-form-urlencoded" }, redirect: "manual" });
  return r.headers.get("location");
}

before(async () => {
  if (!configured) return;
  // Si ya hay un Stripe de pruebas escuchando (npm run dev + node tests/stripe-falso.mjs), se usa ese.
  const up = await fetch(`${STRIPE}/prueba/avisos`).then((r) => r.ok).catch(() => false);
  if (!up) fake = await startFakeStripe({ port: Number(new URL(STRIPE).port), webhookUrl: `${SITE}/api/stripe`, secret: E.STRIPE_WEBHOOK_SECRET });
  await db.remove("rate_limits?key=like.*");
  [{ value: sellerBefore }] = await db.select("settings?key=eq.vendedor&select=value");
  await db.update("settings?key=eq.vendedor", { value: { ...sellerBefore, nombre: "Luis Demo", nif: "12345678Z", direccion: "Calle Falsa 1", email: "hola@example.com" } });
});
after(async () => {
  if (sellerBefore) await db.update("settings?key=eq.vendedor", { value: sellerBefore });
  fake?.close();
});

test("tarifas: se dice qué se puede pagar al momento", { skip: !configured }, async () => {
  const r = await (await fetch(`${SITE}/api/productos`)).json();
  assert.equal(r.pagos, true);
  assert.equal(r.products.find((p) => p.code === "tal-cual").online_checkout, true);
  assert.equal(r.products.find((p) => p.code === "a-medida").online_checkout, false, "precio «desde»: no");
});

test("reservar: comprueba tarifa, consentimiento y NIF", { skip: !configured }, async () => {
  assert.equal((await (await post(base({ tier: "a-medida" }))).json()).error, "tarifa");
  assert.equal((await (await post(base({ startNow: false }))).json()).error, "empezar_ya");
  assert.equal((await (await post(base({ billing: { nombre: "X", nif: "12345678A", direccion: "Y" } }))).json()).error, "nif");
  assert.equal((await post(base({ website: "spam" }))).status, 400, "campo trampa");
});

test("pagar: Stripe → aviso firmado → pedido pagado, factura y seguimiento con código", { skip: !configured }, async () => {
  const r = await (await post(base({ tier: "con-cambios", billing: { nombre: "Irene Sol", nif: "00000001R", direccion: "Calle Luna 3", codigo_postal: "08001", ciudad: "Barcelona" } }))).json();
  assert.ok(r.ok && r.url.startsWith(STRIPE), JSON.stringify(r));
  assert.match(r.codigo, /^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
  const code = r.codigo;

  let t = await tracking(code);
  assert.equal(t.status, "pendiente_pago");
  assert.equal(t.payable, true);
  assert.equal(t.rounds.included, null, "Con cambios: rondas acordadas");

  const back = await payAt(r.url);
  assert.equal(back, `${SITE}/seguimiento/${code}?pago=ok`);
  t = await tracking(code);
  assert.equal(t.status, "pagado");
  assert.equal(t.paid_cents, 13900);
  assert.ok(t.promised_delivery_at, "fecha de entrega");
  assert.equal(t.invoices.length, 1);
  assert.equal(t.invoices[0].kind, "ordinaria", "con NIF: factura completa");

  // La factura se descarga con el código; con otro código, no.
  const pdf = await fetch(`${SITE}/api/factura?c=${code}&n=${t.invoices[0].number}`);
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
  assert.equal((await fetch(`${SITE}/api/factura?c=ZZZZ-ZZZZ&n=${t.invoices[0].number}`)).status, 404);

  // Ya pagado: el enlace de pago lleva de vuelta al seguimiento.
  const again = await fetch(`${SITE}/pagar/${code}`, { redirect: "manual" });
  assert.equal(again.status, 303);
  assert.equal(again.headers.get("location"), `${SITE}/seguimiento/${code}`);

  // El email de confirmación lleva la factura (sin Resend queda «simulado»).
  const [mail] = await db.select(`email_log?template=eq.pago_recibido&meta->>pedido=eq.${t.number}&select=status,meta`);
  assert.deepEqual(mail.meta.adjuntos, [`Factura ${t.invoices[0].number}.pdf`]);

  // Antes de la primera propuesta pueden contarnos cosas; aprobar no se puede.
  assert.equal((await post({ accion: "cambio", c: code, tipo: "cambio", mensaje: "Nos gustaría la portada en tonos verdes." })).status, 200);
  assert.equal((await (await post({ accion: "aprobar", c: code, propuesta: 1 })).json()).error, "propuesta");
  t = await tracking(code);
  assert.equal(t.requests.length, 1);
  assert.equal(t.rounds.used, 0, "antes de la primera propuesta no cuenta como ronda");
});

test("avisos de Stripe: firma obligatoria y sin repetir cobros", { skip: !configured }, async () => {
  const event = { id: `evt_test_${Date.now()}`, type: "checkout.session.completed", created: Math.floor(Date.now() / 1000),
    data: { object: { id: "cs_x", mode: "payment", payment_status: "paid", amount_total: 100, currency: "eur", metadata: {} } } };
  const raw = JSON.stringify(event);
  const send = (sig) => fetch(`${SITE}/api/stripe`, { method: "POST", headers: { "Content-Type": "application/json", "Stripe-Signature": sig }, body: raw });
  assert.equal((await send(signatureHeader(raw, "whsec_otro"))).status, 400, "firma falsa");
  const ok = await send(signatureHeader(raw, E.STRIPE_WEBHOOK_SECRET));
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { ok: true, sin_pedido: true });
  assert.deepEqual(await (await send(signatureHeader(raw, E.STRIPE_WEBHOOK_SECRET))).json(), { ok: true, repetido: true });
});

test("devolución en Stripe: rectificativa sola y pedido devuelto", { skip: !configured }, async () => {
  const r = await (await post(base())).json();
  await payAt(r.url);
  const sessions = await (await fetch(`${STRIPE}/prueba/sesiones`)).json();
  const pi = sessions.find((s) => s.url === r.url).payment_intent;
  let t = await tracking(r.codigo);
  assert.equal(t.invoices[0].kind, "simplificada", "sin NIF: simplificada");

  await fetch(`${STRIPE}/prueba/devolver`, { method: "POST", body: JSON.stringify({ payment_intent: pi, amount: 1900 }) });
  t = await tracking(r.codigo);
  assert.equal(t.paid_cents, 6000);
  assert.deepEqual(t.invoices.map((i) => i.total_cents), [7900, -1900]);
  await fetch(`${STRIPE}/prueba/devolver`, { method: "POST", body: JSON.stringify({ payment_intent: pi }) });
  t = await tracking(r.codigo);
  assert.equal(t.status, "reembolsado");
  assert.deepEqual(t.invoices.map((i) => i.total_cents), [7900, -1900, -6000]);
});

test("seguimiento: código mal escrito, minúsculas y propuestas", { skip: !configured }, async () => {
  assert.equal((await fetch(`${SITE}/api/pedido?c=ZZZZ-ZZZZ`)).status, 404);
  assert.equal((await fetch(`${SITE}/api/pedido?c=hola`)).status, 404);
  assert.equal((await tracking("dema 2345")).number, "P-2026-0001");
  const page = await fetch(`${SITE}/seguimiento/DEMA-2345`);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("x-robots-tag"), "noindex, nofollow");
  const prop = await fetch(`${SITE}/b/lucia-y-martin?propuesta=1&c=DEMA2345`);
  assert.equal(prop.status, 200);
  assert.match(prop.headers.get("cache-control"), /no-store/);
  assert.match(await prop.text(), /Propuesta 1 · aún no es la web publicada/);
  assert.equal((await fetch(`${SITE}/b/lucia-y-martin?propuesta=1&c=DEMB2345`)).status, 404, "código de otra boda");
});

test("propuestas y pagos a mano: solo el equipo", { skip: !configured }, async () => {
  assert.equal((await post({ accion: "propuesta", wedding_id: "b0000000-0000-4000-8000-000000000001" })).status, 403);
  assert.equal((await post({ accion: "pago", order_id: "e0000000-0000-4000-8000-000000000002", importe: 100 })).status, 403);
  const login = await fetch(`${E.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: E.SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "lucia@example.com", password: "demo-pareja-1234" }),
  }).then((x) => x.json());
  const asCouple = await post({ accion: "propuesta", wedding_id: "b0000000-0000-4000-8000-000000000001" }, { Authorization: `Bearer ${login.access_token}` });
  assert.equal(asCouple.status, 403, "la pareja no manda propuestas");
});
