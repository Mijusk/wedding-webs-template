// POST /api/lead  ·  lo manda el escaparate (studio/app/leads.js) en cada prueba y en cada reserva.
// Guarda el lead con su atribución de publicidad y su consentimiento, y avisa a Luis.
// Responde {"ok":true} solo cuando está guardado.
//
// GET  /api/lead?prueba=<clave>        la web que probó un lead (para el enlace de su email de bienvenida)
// GET  /api/lead?baja=<…>&t=<firma>    página para darse de baja de los emails comerciales
// POST /api/lead?baja=<…>&t=<firma>    la baja (botón de esa página o «darse de baja» del programa de correo)
import { rpc, isConfigured } from "./_lib/supabase.js";
import { sendJson, sendHtml, readJson, queryOf, clientIp, ipHash, origin, forwardToSheet, HttpError, esc } from "./_lib/http.js";
import { notifyLead } from "./_lib/avisos.js";
import { runEvent, unsubscribeEmail } from "./_lib/automatizaciones.js";

const FIELDS = ["type", "email", "name", "nameA", "nameB", "weddingDate", "venue", "city", "style", "photos", "tier",
  "phone", "message", "wedding", "sections", "consent", "consentText", "page", "attribution", "sentAt"];

export default async function handler(req, res) {
  const q = queryOf(req);
  if (q.has("baja")) return baja(req, res, q);
  if (req.method === "GET" && q.has("prueba")) return prueba(req, res, q.get("prueba"));
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
    // Bienvenida con su web guardada (si está activa en Panel › Automatizaciones).
    if (r.is_new && r.type === "prueba") tasks.push(runEvent("lead_bienvenida", r.lead_id, origin(req)));
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

// La web que probó: nombres, fecha, lugar y estilo (sin fotos: nunca salieron de su móvil).
async function prueba(req, res, token) {
  if (!isConfigured() || !/^[A-Za-z0-9_-]{20,80}$/.test(token || "")) return sendJson(res, 404, { ok: false });
  try {
    if (!(await rpc("api_hit_rate_limit", { p_key: `prueba:${ipHash(clientIp(req))}`, p_max: 60, p_window_seconds: 600 }))) {
      return sendJson(res, 429, { ok: false, error: "demasiadas" });
    }
    const data = await rpc("api_lead_preview", { p_token: token });
    if (!data) return sendJson(res, 404, { ok: false });
    return sendJson(res, 200, { ok: true, prueba: data }, { "X-Robots-Tag": "noindex, nofollow" });
  } catch (e) {
    console.error("prueba", e.message);
    return sendJson(res, 503, { ok: false });
  }
}

// Darse de baja. Con GET solo se enseña la página (los antivirus del correo abren los enlaces y no
// deben dar de baja a nadie); la baja se hace con POST: el botón o el «darse de baja» del programa de correo.
async function baja(req, res, q) {
  const email = unsubscribeEmail(q.get("baja"), q.get("t"));
  const page = (title, text, form = "") => sendHtml(res, email ? 200 : 400, `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${esc(title)}</title></head>
<body style="margin:0;background:#f7f4f1;font:17px/1.6 system-ui,-apple-system,sans-serif;color:#1f1a24;display:grid;place-items:center;min-height:90vh;padding:24px">
<main style="max-width:420px;text-align:center"><h1 style="font-weight:600;font-size:26px">${esc(title)}</h1><p>${text}</p>${form}</main></body></html>`,
  { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" });
  if (!email) return page("Este enlace no funciona", "Puede que esté incompleto. Si queréis que no os escribamos, contestad a cualquiera de nuestros emails y lo hacemos nosotros.");
  if (req.method === "POST") {
    if (!isConfigured()) return page("Ahora mismo no podemos", "Volved a intentarlo en un rato.");
    try { await rpc("api_optout", { p_email: email, p_source: "enlace del email" }); }
    catch (e) { console.error("baja", e.message); return page("Ahora mismo no podemos", "Volved a intentarlo en un rato."); }
    return page("Listo, no os escribiremos más", `No recibiréis más emails comerciales en <b>${esc(email)}</b>. Si tenéis una web con nosotros, seguiréis recibiendo lo imprescindible sobre ella.`);
  }
  return page("¿Dejamos de escribiros?", `No recibiréis más emails comerciales en <b>${esc(email)}</b>.`,
    `<form method="post"><button style="font:inherit;font-weight:600;background:#7d2a4b;color:#fff;border:0;border-radius:999px;padding:12px 24px;cursor:pointer">Sí, darme de baja</button></form>`);
}
