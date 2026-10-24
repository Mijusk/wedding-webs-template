// POST /api/rsvp?w=<slug>  ·  cuerpo: {"name","attending":"si"|"no","song"}  (lo manda js/storage.js de cada plantilla)
// Responde {"ok":true} solo cuando la respuesta está guardada: si no, el invitado ve el error y reintenta.
import { rpc, isConfigured } from "./_lib/supabase.js";
import { sendJson, readJson, queryOf, clientIp, ipHash, forwardToSheet, HttpError } from "./_lib/http.js";

const STATUS = { no_existe: 404, sin_rsvp: 404, cerrado: 409, nombre: 400, asistencia: 400 };

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "metodo" }, { Allow: "POST" });
  const slug = String(queryOf(req).get("w") || "").toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug)) return sendJson(res, 404, { ok: false, error: "no_existe" });
  if (!isConfigured()) return sendJson(res, 503, { ok: false, error: "no_configurado" });

  let body;
  try {
    body = await readJson(req, 8 * 1024);
  } catch (e) {
    return sendJson(res, e instanceof HttpError ? e.status : 400, { ok: false, error: e.code || "json" });
  }
  if (body.website) return sendJson(res, 200, { ok: true }); // campo trampa: un bot. Se le dice que sí y no se guarda.

  const ip = ipHash(clientIp(req));
  try {
    const [porBoda, porIp] = await Promise.all([
      rpc("api_hit_rate_limit", { p_key: `rsvp:${slug}:${ip}`, p_max: 20, p_window_seconds: 600 }),
      rpc("api_hit_rate_limit", { p_key: `rsvp:${ip}`, p_max: 60, p_window_seconds: 3600 }),
    ]);
    if (!porBoda || !porIp) return sendJson(res, 429, { ok: false, error: "demasiadas" }, { "Retry-After": "600" });

    const entry = {
      name: String(body.name ?? "").slice(0, 200),
      attending: String(body.attending ?? ""),
      song: String(body.song ?? "").slice(0, 400),
      sentAt: typeof body.sentAt === "string" ? body.sentAt.slice(0, 40) : undefined,
    };
    const r = await rpc("api_submit_rsvp", {
      p_slug: slug, p_payload: entry, p_ip_hash: ip, p_user_agent: String(req.headers["user-agent"] || "").slice(0, 300),
    });
    if (!r?.ok) return sendJson(res, STATUS[r?.error] || 400, { ok: false, error: r?.error || "error" });

    // Copia en la hoja de Google de la pareja durante la transición (si la boda la tiene).
    if (r.sheet) await forwardToSheet(r.sheet, entry);
    return sendJson(res, 200, { ok: true });
  } catch (e) {
    console.error("rsvp", slug, e.status, e.message);
    return sendJson(res, 503, { ok: false, error: "no_guardado" });
  }
}
