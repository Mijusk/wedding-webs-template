// POST /api/pareja  ·  acceso de las parejas y recordatorios.  {"accion": ..., ...}
//
//   acceso        {email}               Público. Si el email es de una pareja, le manda el enlace de acceso.
//                                       Siempre responde lo mismo (no dice qué emails existen).
//   enlace        {wedding_id, email}   Solo el equipo. Devuelve el enlace para mandarlo por WhatsApp.
//   recordatorio  {wedding_id}          La pareja o el equipo. Email a los grupos que no han contestado.
//
// (Todo en una función para no pasar del límite de funciones del plan de Vercel.)
import { rpc, isConfigured } from "./_lib/supabase.js";
import { sendJson, readJson, clientIp, ipHash, origin, HttpError } from "./_lib/http.js";
import { magicLink, callerToken, isStaff, canManage } from "./_lib/acceso.js";
import { sendEmail } from "./_lib/avisos.js";
import { accessEmail, reminderEmail } from "./_lib/emails.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EMAIL = /^\S+@\S+\.\S+$/;

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { ok: false }, { Allow: "POST" });
  if (!isConfigured()) return sendJson(res, 503, { ok: false, error: "no_configurado" });
  let body;
  try { body = await readJson(req, 8 * 1024); }
  catch (e) { return sendJson(res, e instanceof HttpError ? e.status : 400, { ok: false, error: e.code || "json" }); }

  try {
    if (body.accion === "acceso") return await acceso(req, res, body);
    if (body.accion === "enlace") return await enlace(req, res, body);
    if (body.accion === "recordatorio") return await recordatorio(req, res, body);
    return sendJson(res, 400, { ok: false, error: "accion" });
  } catch (e) {
    console.error("pareja", body.accion, e.status, e.message);
    return sendJson(res, 503, { ok: false, error: "error" });
  }
}

async function acceso(req, res, body) {
  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 200) return sendJson(res, 400, { ok: false, error: "email" });
  const ip = ipHash(clientIp(req));
  const [porIp, porEmail] = await Promise.all([
    rpc("api_hit_rate_limit", { p_key: `acceso:${ip}`, p_max: 8, p_window_seconds: 900 }),
    rpc("api_hit_rate_limit", { p_key: `acceso:${email}`, p_max: 3, p_window_seconds: 3600 }),
  ]);
  if (!porIp || !porEmail) return sendJson(res, 429, { ok: false, error: "demasiadas" }, { "Retry-After": "900" });
  const couple = await rpc("api_couple_access", { p_email: email });
  if (couple) {
    const link = await magicLink(couple.email, origin(req));
    await sendEmail({ to: couple.email, template: "acceso_pareja", ...accessEmail({ link, couple: couple.couple }) });
  }
  return sendJson(res, 200, { ok: true });
}

async function enlace(req, res, body) {
  const token = await callerToken(req);
  if (!token || !(await isStaff(token))) return sendJson(res, 403, { ok: false, error: "permiso" });
  const email = String(body.email || "").trim().toLowerCase();
  if (!UUID.test(body.wedding_id || "") || !EMAIL.test(email)) return sendJson(res, 400, { ok: false, error: "datos" });
  const couple = await rpc("api_couple_access", { p_email: email });
  if (!couple) return sendJson(res, 404, { ok: false, error: "no_es_pareja" });
  const link = await magicLink(couple.email, origin(req));
  return sendJson(res, 200, { ok: true, link });
}

async function recordatorio(req, res, body) {
  const token = await callerToken(req);
  if (!token || !UUID.test(body.wedding_id || "") || !(await canManage(token, body.wedding_id))) {
    return sendJson(res, 403, { ok: false, error: "permiso" });
  }
  const w = await rpc("api_pending_groups", { p_wedding_id: body.wedding_id });
  if (!w || w.status !== "publicada") return sendJson(res, 409, { ok: false, error: "no_publicada" });
  const conEmail = w.groups.filter((g) => g.email && EMAIL.test(g.email));
  const summary = { ok: true, pendientes: w.groups.length, con_email: conEmail.length, enviados: 0, simulados: 0, fallidos: 0 };
  if (!conEmail.length) return sendJson(res, 200, summary);
  // Como mucho un recordatorio por email cada 12 horas por boda: que nadie reciba tres seguidos.
  if (!(await rpc("api_hit_rate_limit", { p_key: `recordatorio:${body.wedding_id}`, p_max: 1, p_window_seconds: 12 * 3600 }))) {
    return sendJson(res, 429, { ok: false, error: "ya_enviado" });
  }
  const base = origin(req);
  let enviados = 0, simulados = 0, fallidos = 0;
  for (const g of conEmail) {
    const link = `${base}/b/${w.slug}?i=${encodeURIComponent(g.token)}`;
    const r = await sendEmail({ to: g.email, template: "recordatorio_rsvp", weddingId: body.wedding_id,
      ...reminderEmail({ group: g.name, link, couple: w.couple, deadline: w.deadline }) });
    if (r.status === "enviado") enviados++; else if (r.status === "simulado") simulados++; else fallidos++;
  }
  return sendJson(res, 200, { ...summary, enviados, simulados, fallidos });
}
