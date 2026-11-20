// /api/compartir  ·  las fotos de la prueba que una pareja comparte con su pareja (#boda=…&f=<id>).
// Decidido con Luis (20 nov 2026): se suben solo al pulsar «Compartir», a un cubo privado, y se
// borran a los 30 días (api/cron.js). Sin email ni datos de la pareja: solo un id y las fotos.
//
//   POST /api/compartir               {"fotos": n}        -> {"ok":true,"id":"<22 caracteres>"}
//   POST /api/compartir?id=<id>&n=<i>  {"foto":"data:image/jpeg;base64,…"}  (una foto por petición,
//                                      en los 15 minutos siguientes; no se puede reemplazar)
//   GET  /api/compartir?id=<id>        -> {"ok":true,"fotos":[enlace firmado de 1 hora, …]}
//                                      404 si no existe, 410 si ya tiene 30 días.
import { randomBytes } from "node:crypto";
import { rpc, storage, storageUrl, isConfigured } from "./_lib/supabase.js";
import { BUCKET, MAX_PHOTOS, photoPath } from "./_lib/compartidas.js";
import { sendJson, readJson, queryOf, clientIp, ipHash, HttpError } from "./_lib/http.js";
import { sniff } from "../lib/fotos.js";

const MAX_BYTES = 8 * 1024 * 1024;
const ID = /^[A-Za-z0-9_-]{22}$/;

export default async function handler(req, res) {
  if (!isConfigured()) return sendJson(res, 503, { ok: false, error: "no_configurado" });
  const q = queryOf(req);
  const id = q.get("id") || "";
  try {
    if (req.method === "GET" && ID.test(id)) return await show(req, res, id);
    if (req.method === "POST" && !q.has("id")) return await create(req, res);
    if (req.method === "POST" && ID.test(id)) return await upload(req, res, id, q.get("n"));
    return sendJson(res, req.method === "GET" || req.method === "POST" ? 400 : 405, { ok: false, error: "peticion" });
  } catch (e) {
    if (e instanceof HttpError) return sendJson(res, e.status, { ok: false, error: e.code });
    console.error("compartir", e.status, e.message);
    return sendJson(res, 503, { ok: false, error: "no_disponible" });
  }
}

const limited = async (req, what, max) =>
  !(await rpc("api_hit_rate_limit", { p_key: `compartir:${what}:${ipHash(clientIp(req))}`, p_max: max, p_window_seconds: 600 }));

async function create(req, res) {
  const body = await readJson(req, 2048);
  const n = Number(body.fotos);
  if (!Number.isInteger(n) || n < 1 || n > MAX_PHOTOS) return sendJson(res, 400, { ok: false, error: "fotos" });
  if (await limited(req, "nueva", 10)) return sendJson(res, 429, { ok: false, error: "demasiadas" }, { "Retry-After": "600" });
  const id = randomBytes(16).toString("base64url"); // 22 caracteres, imposible de adivinar
  await rpc("api_share_create", { p_id: id, p_photos: n });
  return sendJson(res, 200, { ok: true, id });
}

async function upload(req, res, id, nRaw) {
  const n = Number(nRaw);
  if (!/^\d$/.test(String(nRaw)) || n >= MAX_PHOTOS) return sendJson(res, 400, { ok: false, error: "n" });
  if (await limited(req, "foto", 40)) return sendJson(res, 429, { ok: false, error: "demasiadas" }, { "Retry-After": "600" });
  // Una foto de 2000 px al 90 % pesa ~0,5–1,5 MB (en base64, un tercio más). Vercel admite 4,5 MB.
  const body = await readJson(req, 4.4 * 1024 * 1024);
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(body.foto || ""));
  if (!m) return sendJson(res, 400, { ok: false, error: "foto" });
  const bytes = Buffer.from(m[1], "base64");
  if (!bytes.length || bytes.length > MAX_BYTES || sniff(bytes) !== "jpeg") return sendJson(res, 400, { ok: false, error: "foto" });
  if (!(await rpc("api_share_upload_ok", { p_id: id, p_n: n }))) return sendJson(res, 404, { ok: false, error: "no_existe" });
  try {
    await storage(`/object/${BUCKET}/${photoPath(id, n)}`, {
      method: "POST", body: new Uint8Array(bytes), contentType: "image/jpeg",
      extra: { "x-upsert": "false", "cache-control": "max-age=3600" },
    });
  } catch (e) {
    // Ya estaba (un reintento del navegador después de un corte): vale igual.
    if (!(e.status === 409 || e.body?.statusCode === "409" || /exists|duplicate/i.test(e.message))) throw e;
  }
  return sendJson(res, 200, { ok: true });
}

async function show(req, res, id) {
  if (await limited(req, "ver", 60)) return sendJson(res, 429, { ok: false, error: "demasiadas" });
  const n = await rpc("api_share_get", { p_id: id });
  if (n == null) return sendJson(res, 410, { ok: false, error: "caducado" });
  const paths = Array.from({ length: n }, (_, i) => photoPath(id, i));
  const signed = await storage(`/object/sign/${BUCKET}`, { method: "POST", body: { expiresIn: 3600, paths } });
  // Las que no llegaron a subirse (se cortó la conexión) salen con error: se saltan.
  const fotos = (Array.isArray(signed) ? signed : []).filter((s) => s?.signedURL && !s.error).map((s) => storageUrl(s.signedURL));
  if (!fotos.length) return sendJson(res, 410, { ok: false, error: "sin_fotos" });
  return sendJson(res, 200, { ok: true, fotos }, { "X-Robots-Tag": "noindex, nofollow" });
}
