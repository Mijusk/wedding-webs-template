// POST /api/lead  ·  lo manda el escaparate (studio/app/leads.js) en cada prueba y en cada reserva.
// Guarda el lead con su atribución de publicidad y su consentimiento, y avisa a Luis.
// Responde {"ok":true} solo cuando está guardado.
import { rpc, isConfigured } from "./_lib/supabase.js";
import { sendJson, readJson, clientIp, ipHash, origin, forwardToSheet, HttpError } from "./_lib/http.js";
import { notifyLead } from "./_lib/avisos.js";

const FIELDS = ["type", "email", "name", "nameA", "nameB", "weddingDate", "venue", "city", "style", "photos", "tier",
  "phone", "message", "wedding", "sections", "consent", "consentText", "page", "attribution", "sentAt"];

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "metodo" }, { Allow: "POST" });

  let body;
  try {
    body = await readJson(req, 96 * 1024);
  } catch (e) {
    return sendJson(res, e instanceof HttpError ? e.status : 400, { ok: false, error: e.code || "json" });
  }
  if (body.website) return sendJson(res, 200, { ok: true }); // campo trampa: un bot

  const ipRaw = clientIp(req);
  const payload = Object.fromEntries(FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));

  // Durante la transición, copia en la hoja de Google de siempre (LEADS_SHEET_ENDPOINT).
  const sheet = process.env.LEADS_SHEET_ENDPOINT;

  if (!isConfigured()) {
    // Sin base de datos todavía: que el escaparate siga funcionando como hoy, solo con la hoja.
    const ok = await forwardToSheet(sheet, body, 8000);
    return sendJson(res, ok ? 200 : 503, ok ? { ok: true } : { ok: false, error: "no_configurado" });
  }

  try {
    if (!(await rpc("api_hit_rate_limit", { p_key: `lead:${ipHash(ipRaw)}`, p_max: 12, p_window_seconds: 600 }))) {
      return sendJson(res, 429, { ok: false, error: "demasiadas" }, { "Retry-After": "600" });
    }
    if (!(await turnstileOk(body.turnstileToken, ipRaw))) return sendJson(res, 403, { ok: false, error: "verificacion" });

    const r = await rpc("api_submit_lead", {
      p: payload, p_ip: ipRaw || null, p_user_agent: String(req.headers["user-agent"] || "").slice(0, 300),
    });
    if (!r?.ok) return sendJson(res, 400, { ok: false, error: r?.error || "error" });

    const tasks = [forwardToSheet(sheet, body)];
    // Aviso a Luis: lead nuevo o reserva (una pareja que repite la prueba no vuelve a avisar).
    if (r.is_new || r.type === "reserva") {
      tasks.push(notifyLead({ lead: r, payload, panelUrl: `${origin(req)}/panel/#/leads/${r.lead_id}` })
        .catch((e) => console.error("aviso", e.message)));
    }
    await Promise.all(tasks);
    return sendJson(res, 200, { ok: true });
  } catch (e) {
    console.error("lead", e.status, e.message);
    return sendJson(res, 503, { ok: false, error: "no_guardado" });
  }
}

// Anti-bots de Cloudflare Turnstile, solo si está configurado (TURNSTILE_SECRET_KEY). Aún NO está el
// widget en el escaparate: no pongas esta variable hasta añadirlo, o se rechazarían todos los leads.
// Mientras tanto protegen el campo trampa y el límite de peticiones.
async function turnstileOk(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: String(token), remoteip: ip || "" }),
      signal: AbortSignal.timeout(5000),
    });
    return (await res.json()).success === true;
  } catch {
    return false;
  }
}
