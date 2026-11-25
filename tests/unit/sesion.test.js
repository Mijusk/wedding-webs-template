// Sesión de los paneles (panel/js/supa.js) con un navegador y un Supabase de mentira. Lo importante: no
// cerrar la sesión por un corte de red (el enlace de acceso de las parejas sirve una sola vez).
import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

const KEY = "ww-panel-session";
const real = { fetch: globalThis.fetch, localStorage: Object.getOwnPropertyDescriptor(globalThis, "localStorage") };
const store = new Map();
let token; // qué responde la renovación de la sesión
let used;  // claves de refresco usadas
let supa;

const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const saved = () => JSON.parse(store.get(KEY) || "null");
const session = (refresh, secondsLeft) => ({ access_token: `a-${refresh}`, refresh_token: refresh, expires_at: Math.floor(Date.now() / 1000) + secondsLeft });

before(async () => {
  globalThis.addEventListener ||= () => {};
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k),
  } });
  globalThis.fetch = async (url, init = {}) => {
    if (url === "/api/panel-config") return json({ ok: true, supabaseUrl: "http://sb", supabaseKey: "sb_publishable_x", siteUrl: "http://x" });
    if (url.startsWith("http://sb/auth/v1/token")) { used.push(JSON.parse(init.body).refresh_token); return token(); }
    return json([]);
  };
  supa = await import("../../panel/js/supa.js");
});

after(() => {
  globalThis.fetch = real.fetch;
  if (real.localStorage) Object.defineProperty(globalThis, "localStorage", real.localStorage); else delete globalThis.localStorage;
});

beforeEach(async () => {
  used = [];
  token = () => json({ access_token: "nuevo", refresh_token: "r2", expires_in: 3600 });
  store.set(KEY, JSON.stringify(session("r1", -10))); // caducada: toca renovar
  await supa.init();
});

test("renueva la sesión caducada y la guarda", async () => {
  await supa.db.select("x");
  assert.equal(saved().refresh_token, "r2");
});

test("sin conexión, con límite de peticiones o con el servidor caído, la sesión se conserva", async () => {
  for (const bad of [() => { throw new TypeError("Failed to fetch"); }, () => json({ msg: "lento" }, 429), () => json({ msg: "caído" }, 503)]) {
    token = bad;
    await assert.rejects(supa.db.select("x"), { code: "sin_conexion" });
    assert.equal(saved().refresh_token, "r1");
  }
  token = () => json({ access_token: "nuevo", refresh_token: "r2", expires_in: 3600 });
  await supa.db.select("x");
  assert.equal(saved().refresh_token, "r2");
});

test("si Supabase dice que ya no vale, se cierra", async () => {
  token = () => json({ msg: "Invalid Refresh Token" }, 400);
  await supa.db.select("x");
  assert.equal(saved(), null);
});

test("si otra pestaña ya la ha renovado, usa la suya sin gastar otra clave", async () => {
  store.set(KEY, JSON.stringify(session("r9", 3600)));
  await supa.db.select("x");
  assert.deepEqual(used, []);
  assert.equal(supa.currentSession().refresh_token, "r9");
});

test("varias peticiones a la vez renuevan una sola vez", async () => {
  await Promise.all([supa.db.select("x"), supa.db.select("y"), supa.db.select("z")]);
  assert.deepEqual(used, ["r1"]);
});
