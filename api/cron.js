// GET /api/cron?tarea=resumen  ·  lo llama Vercel Cron cada mañana (vercel.json > crons).
// Manda a cada pareja su resumen de respuestas nuevas (diario, o semanal los lunes).
// Protegido con CRON_SECRET: Vercel lo envía solo como "Authorization: Bearer <CRON_SECRET>".
import { rpc, isConfigured } from "./_lib/supabase.js";
import { sendJson, origin } from "./_lib/http.js";
import { sendEmail } from "./_lib/avisos.js";
import { digestEmail } from "./_lib/emails.js";

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return sendJson(res, 401, { ok: false });
  if (!isConfigured()) return sendJson(res, 503, { ok: false, error: "no_configurado" });
  const tarea = new URL(req.url, "http://x").searchParams.get("tarea") || "resumen";
  if (tarea !== "resumen") return sendJson(res, 400, { ok: false, error: "tarea" });

  // Vercel avisa de que a veces lanza la misma tarea dos veces: solo una por hora.
  if (!(await rpc("api_hit_rate_limit", { p_key: "cron:resumen", p_max: 1, p_window_seconds: 3600 }))) {
    return sendJson(res, 200, { ok: true, repetida: true });
  }
  const due = await rpc("api_digests_due");
  const sent = [];
  let simulados = 0, fallidos = 0;
  for (const d of due) {
    const r = await sendEmail({
      to: d.email, template: `resumen_${d.digest}`, weddingId: d.wedding_id,
      ...digestEmail({ couple: d.couple, nuevas: d.nuevas, stats: d.stats, link: `${origin(req)}/pareja/#/respuestas` }),
    });
    // Solo se marca como enviado si ha salido de verdad: si el email aún no está configurado, se
    // mandará cuando lo esté (con todo lo acumulado).
    if (r.status === "enviado") sent.push(d.couple_user_id);
    else if (r.status === "simulado") simulados++;
    else fallidos++;
  }
  if (sent.length) await rpc("api_digest_sent", { p_ids: sent });
  return sendJson(res, 200, { ok: true, pendientes: due.length, enviados: sent.length, simulados, fallidos });
}
