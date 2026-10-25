// /api/cron  ·  lo llama Vercel Cron cada mañana (vercel.json > crons) y hace:
//   · el resumen de respuestas de cada pareja (diario, o semanal los lunes);
//   · las automatizaciones que toquen (emails, tareas y retención de datos; Panel › Automatizaciones).
// ?tarea=resumen o ?tarea=automatizaciones para hacer solo una parte.
//
// Protegido con CRON_SECRET: Vercel lo envía solo como "Authorization: Bearer <CRON_SECRET>".
// El panel también puede lanzar las automatizaciones («Revisar ahora»), con la sesión de un administrador.
import { rpc, rpcAs, isConfigured } from "./_lib/supabase.js";
import { sendJson, origin } from "./_lib/http.js";
import { sendEmail } from "./_lib/avisos.js";
import { digestEmail } from "./_lib/emails.js";
import { callerToken } from "./_lib/acceso.js";
import { runDue } from "./_lib/automatizaciones.js";

export default async function handler(req, res) {
  if (!isConfigured()) return sendJson(res, 503, { ok: false, error: "no_configurado" });
  const secret = process.env.CRON_SECRET;
  const tarea = new URL(req.url, "http://x").searchParams.get("tarea") || "todo";
  if (!["todo", "resumen", "automatizaciones"].includes(tarea)) return sendJson(res, 400, { ok: false, error: "tarea" });

  // Desde el panel: solo administradores, solo automatizaciones, y una vez por minuto.
  if (!(secret && req.headers.authorization === `Bearer ${secret}`)) {
    const token = await callerToken(req);
    if (!token || req.method !== "POST" || tarea !== "automatizaciones" || (await rpcAs(token, "soy_admin")) !== true) {
      return sendJson(res, 401, { ok: false });
    }
    if (!(await rpc("api_hit_rate_limit", { p_key: "panel:automatizaciones", p_max: 1, p_window_seconds: 60 }))) {
      return sendJson(res, 429, { ok: false, error: "demasiadas" });
    }
    return sendJson(res, 200, { ok: true, automatizaciones: await runDue(origin(req)) });
  }

  // Vercel avisa de que a veces lanza la misma tarea dos veces: solo una por hora.
  if (!(await rpc("api_hit_rate_limit", { p_key: `cron:${tarea}`, p_max: 1, p_window_seconds: 3600 }))) {
    return sendJson(res, 200, { ok: true, repetida: true });
  }
  const out = { ok: true };
  if (tarea !== "automatizaciones") out.resumen = await digests(req);
  if (tarea !== "resumen") {
    try { out.automatizaciones = await runDue(origin(req)); }
    catch (e) { console.error("automatizaciones", e.message); out.automatizaciones = { error: e.message }; }
  }
  return sendJson(res, 200, out);
}

async function digests(req) {
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
  return { pendientes: due.length, enviados: sent.length, simulados, fallidos };
}
