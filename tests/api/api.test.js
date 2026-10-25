// Pruebas de las funciones de /api contra el servidor local (npm run dev) y la base con semillas.
//   node --test "tests/api/*.test.js"
import { test } from "node:test";
import assert from "node:assert/strict";
import { SITE, supabase } from "../e2e/_util.mjs";

const db = supabase();
const post = (path, body, headers = {}) => fetch(`${SITE}${path}`, {
  method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body),
});

test("/b/<slug>: publicada 200 con noindex y caché en el borde; borrador 404; sin slug válido 404", async () => {
  const ok = await fetch(`${SITE}/b/lucia-y-martin`);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.match(ok.headers.get("cache-control"), /s-maxage=60/);
  const html = await ok.text();
  assert.match(html, /<base href="\/plantillas\/editorial\/">/);
  assert.match(html, /<meta property="og:title" content="Lucía y Martín se casan">/);
  assert.match(html, /"endpoint":"\/api\/rsvp\?w=lucia-y-martin"/);
  assert.equal((await fetch(`${SITE}/b/marta-y-pablo`)).status, 404);
  assert.equal((await fetch(`${SITE}/b/a`)).status, 404);
  assert.equal((await fetch(`${SITE}/b/marta-y-pablo?vista=clave-falsa-1234567890`)).status, 404);
});

test("/b/<slug>?vista=<clave>: el borrador se ve, sin caché y con el RSVP simulado", async () => {
  const [w] = await db.select("weddings?slug=eq.marta-y-pablo&select=preview_token");
  const res = await fetch(`${SITE}/b/marta-y-pablo?vista=${w.preview_token}`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("cache-control"), /no-store/);
  const html = await res.text();
  assert.match(html, /Vista previa · aún no es la web publicada/);
  assert.match(html, /"endpoint":""/);
});

test("el config dentro de la página no puede romper el HTML", async () => {
  const [w] = await db.select("weddings?slug=eq.lucia-y-martin&select=id,published_version_id");
  const [v] = await db.select(`wedding_versions?id=eq.${w.published_version_id}&select=config`);
  const evil = structuredClone(v.config);
  evil.event.tagline = "</script><script>alert(1)</script>";
  await db.update(`wedding_versions?id=eq.${w.published_version_id}`, { config: evil });
  try {
    const html = await (await fetch(`${SITE}/b/lucia-y-martin`)).text();
    assert.ok(!html.includes("</script><script>alert(1)"));
    assert.ok(html.includes("\\u003c/script>\\u003cscript>alert(1)\\u003c/script>"));
  } finally {
    await db.update(`wedding_versions?id=eq.${w.published_version_id}`, { config: v.config });
  }
});

test("/api/rsvp: guarda, valida y respeta el cierre", async () => {
  const name = `Prueba API ${Date.now()}`;
  let r = await post("/api/rsvp?w=lucia-y-martin", { name, attending: "no" });
  assert.deepEqual(await r.json(), { ok: true });
  const [row] = await db.select(`rsvp_responses?name=eq.${encodeURIComponent(name)}&select=attending,ip_hash`);
  assert.equal(row.attending, false);
  assert.ok(row.ip_hash && !row.ip_hash.includes("."), "la IP se guarda como huella, no en claro");
  r = await post("/api/rsvp?w=lucia-y-martin", { name: "X", attending: "si" });
  assert.equal(r.status, 400);
  r = await post("/api/rsvp?w=sara-y-jon", { name: "Alguien", attending: "si" });
  assert.equal(r.status, 409);
  r = await post("/api/rsvp?w=no-existe", { name: "Alguien", attending: "si" });
  assert.equal(r.status, 404);
  r = await post("/api/rsvp?w=lucia-y-martin", "esto no es json");
  assert.equal(r.status, 400);
  r = await fetch(`${SITE}/api/rsvp?w=lucia-y-martin`);
  assert.equal(r.status, 405);
  await db.remove(`rsvp_responses?name=eq.${encodeURIComponent(name)}`);
});

test("/api/lead: campo trampa (bot) responde que sí y no guarda nada", async () => {
  const email = `bot.${Date.now()}@example.com`;
  const r = await post("/api/lead", { type: "prueba", email, website: "http://spam" });
  assert.deepEqual(await r.json(), { ok: true });
  assert.equal((await db.select(`leads?email=eq.${email}&select=id`)).length, 0);
});

test("/api/lead: email no válido se rechaza", async () => {
  const r = await post("/api/lead", { type: "prueba", email: "sin-arroba" });
  assert.equal(r.status, 400);
});

test("/api/lead: más de 12 envíos en 10 minutos desde la misma IP se frenan", async () => {
  const ip = `198.51.100.${Math.floor(Math.random() * 200)}`;
  let last;
  for (let i = 0; i < 13; i++) last = await post("/api/lead", { type: "prueba", email: "x" }, { "X-Forwarded-For": ip });
  assert.equal(last.status, 429);
});

test("/api/productos: precios desde la base de datos", async () => {
  const { products } = await (await fetch(`${SITE}/api/productos`)).json();
  assert.deepEqual(products.map((p) => [p.code, p.price_cents]), [["tal-cual", 7900], ["con-cambios", 13900], ["a-medida", 24900]]);
});

test("carpetas internas no se sirven en la web pública", async () => {
  for (const path of ["/supabase/seed.sql", "/scripts/importar-boda.mjs", "/docs/SUPABASE.md", "/package.json", "/.env.local"]) {
    const r = await fetch(`${SITE}${path}`, { redirect: "manual" });
    assert.ok([307, 308].includes(r.status), `${path} responde ${r.status}`);
  }
});

// ── Fase 3 ──
import { env } from "../e2e/_util.mjs";
const loginToken = async (email, password) => {
  const e = env();
  const r = await fetch(`${e.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: e.SUPABASE_ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
  });
  return (await r.json()).access_token;
};
const asUser = (token, body) => fetch(`${SITE}/api/pareja`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
const LUCIA_WEDDING = "b0000000-0000-4000-8000-000000000001";

test("/api/pareja acceso: responde igual exista o no el email (no revela quién es cliente)", async () => {
  const a = await post("/api/pareja", { accion: "acceso", email: "lucia@example.com" }, { "X-Forwarded-For": "198.51.100.201" });
  const b = await post("/api/pareja", { accion: "acceso", email: "nadie.nunca@example.com" }, { "X-Forwarded-For": "198.51.100.202" });
  assert.equal(a.status, 200);
  assert.deepEqual(await a.json(), await b.json());
});

test("/api/pareja enlace: solo el equipo puede generar el enlace de una pareja", async () => {
  const body = { accion: "enlace", wedding_id: LUCIA_WEDDING, email: "lucia@example.com" };
  assert.equal((await post("/api/pareja", body)).status, 403);
  assert.equal((await asUser(await loginToken("lucia@example.com", "demo-pareja-1234"), body)).status, 403);
  const r = await asUser(await loginToken("ayudante@example.com", "demo-ayudante-1234"), body);
  assert.equal(r.status, 200);
  assert.match((await r.json()).link, /\/pareja\/#acceso=[0-9a-f]{40,}/);
  const nope = await asUser(await loginToken("luis@example.com", "demo-luis-1234"), { ...body, email: "desconocido@example.com" });
  assert.equal(nope.status, 404);
});

test("/api/pareja recordatorio: la pareja solo puede en su boda", async () => {
  const t = await loginToken("lucia@example.com", "demo-pareja-1234");
  assert.equal((await asUser(t, { accion: "recordatorio", wedding_id: "b0000000-0000-4000-8000-000000000002" })).status, 403);
  const r = await asUser(t, { accion: "recordatorio", wedding_id: LUCIA_WEDDING });
  assert.ok([200, 429].includes(r.status), `responde ${r.status}`);
});

test("/b/<slug>?i=<clave>: el enlace personal no se guarda en la caché compartida", async () => {
  const r = await fetch(`${SITE}/b/lucia-y-martin?i=demo-familia-ortega-0000000001`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get("cache-control"), /private, no-store/);
  assert.match(await r.text(), /"name":"Familia Ortega"/);
});

test("/api/cron: sin la clave no hace nada; con ella, manda los resúmenes que tocan", async () => {
  assert.equal((await fetch(`${SITE}/api/cron`)).status, 401);
  const secret = env().CRON_SECRET;
  if (!secret) return;
  const r = await fetch(`${SITE}/api/cron`, { headers: { Authorization: `Bearer ${secret}` } });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ok, true);
});
