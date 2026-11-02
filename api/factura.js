// GET /api/factura?id=<factura>          el panel (dueño o administrador), con su sesión
// GET /api/factura?c=<código>&n=<número> la pareja, desde su página de seguimiento
// Devuelve el PDF de una factura emitida. Siempre se genera desde los datos guardados (que no
// cambian nunca), así que es idéntico cada vez que se descarga.
import { rpc, rpcAs, isConfigured } from "./_lib/supabase.js";
import { sendJson, queryOf, clientIp, ipHash } from "./_lib/http.js";
import { callerToken } from "./_lib/acceso.js";
import { provider } from "./_lib/facturacion.js";
import { invoiceFileName } from "./_lib/pdf.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export default async function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { ok: false }, { Allow: "GET" });
  if (!isConfigured()) return sendJson(res, 503, { ok: false, error: "no_configurado" });
  const q = queryOf(req);
  let doc = null;
  try {
    if (q.get("id")) {
      const token = await callerToken(req);
      if (!token || !UUID.test(q.get("id"))) return sendJson(res, 403, { ok: false, error: "permiso" });
      doc = await rpcAs(token, "invoice_document", { p_invoice_id: q.get("id") }).catch((e) => {
        if (e.status === 401 || e.status === 403 || /dueño|administrador/.test(e.message)) return "permiso";
        throw e;
      });
      if (doc === "permiso") return sendJson(res, 403, { ok: false, error: "permiso" });
    } else {
      const ok = await rpc("api_hit_rate_limit", { p_key: `seguimiento:${ipHash(clientIp(req))}`, p_max: 120, p_window_seconds: 600 });
      if (!ok) return sendJson(res, 429, { ok: false, error: "demasiadas" });
      doc = await rpc("api_tracking_invoice", { p_code: q.get("c") || "", p_number: q.get("n") || "" });
    }
  } catch (e) {
    console.error("factura", e.status, e.message);
    return sendJson(res, 503, { ok: false, error: "error" });
  }
  if (!doc) return sendJson(res, 404, { ok: false, error: "no_existe" });
  const pdf = await provider().getPdf(doc);
  const name = invoiceFileName(doc);
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Length", pdf.length);
  res.setHeader("Content-Disposition", `${q.get("descargar") ? "attachment" : "inline"}; filename="${name.replace(/[^\w .-]/g, "")}"; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.end(pdf);
}
