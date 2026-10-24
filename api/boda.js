// GET /b/<slug>            -> la web publicada de esa boda (vercel.json la reescribe a /api/boda?slug=<slug>)
// GET /b/<slug>?vista=<k>  -> vista previa del borrador (la clave está en el panel: "Enlace de vista previa")
//
// Una sola ruta sirve todas las bodas con cualquiera de las 27 plantillas. La plantilla no cambia:
// solo recibe su config desde aquí en vez de desde config.json.
import { rpc, isConfigured } from "./_lib/supabase.js";
import { sendHtml, queryOf, origin } from "./_lib/http.js";
import { renderWedding, renderNotFound } from "./_lib/render.js";

const NO_INDEX = { "X-Robots-Tag": "noindex, nofollow" };

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    return res.end();
  }
  const q = queryOf(req);
  const slug = String(q.get("slug") || "").toLowerCase().replace(/\/+$/, "");
  const vista = q.get("vista");
  const host = q.get("host"); // dominio propio de la pareja (plan alto), si se configura

  if (!host && !/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug)) return notFound(res);
  if (!isConfigured()) return notFound(res, 503);

  let data;
  try {
    data = await rpc("api_public_wedding", { p_slug: slug, p_preview_token: vista || null, p_host: host || null });
  } catch (e) {
    console.error("api_public_wedding", e.status, e.message);
    return sendHtml(res, 503, await renderNotFound({
      title: "Ahora mismo no podemos abrir esta web",
      text: "Vuelve a intentarlo en unos minutos.",
    }), { ...NO_INDEX, "Cache-Control": "no-store", "Retry-After": "60" });
  }
  if (!data) return notFound(res);
  if (data.status === "retirada") {
    return sendHtml(res, 410, await renderNotFound({
      title: "Esta web de boda ya no está publicada",
      text: "Las webs se retiran un tiempo después de la boda. Si necesitas algo, escribe a los novios.",
    }), { ...NO_INDEX, "Cache-Control": "public, max-age=0, s-maxage=3600" });
  }

  const base = origin(req);
  const pageUrl = `${base}/b/${data.slug}`;
  let html;
  try {
    html = await renderWedding(data, { origin: base, pageUrl });
  } catch (e) {
    console.error("renderWedding", data.slug, e.message);
    return notFound(res, 500);
  }
  sendHtml(res, 200, html, {
    ...NO_INDEX,
    // Publicada: se sirve desde la caché de Vercel y se refresca en segundo plano (un cambio
    // publicado tarda como mucho un minuto en verse). Vista previa: nunca se cachea.
    "Cache-Control": data.draft ? "private, no-store" : "public, max-age=0, s-maxage=60, stale-while-revalidate=86400",
  });
}

async function notFound(res, status = 404) {
  return sendHtml(res, status, await renderNotFound(), {
    ...NO_INDEX,
    "Cache-Control": status === 404 ? "public, max-age=0, s-maxage=60" : "no-store",
  });
}
