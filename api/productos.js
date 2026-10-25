// GET /api/productos  ·  tarifas activas (los precios viven en la base de datos, tabla products).
// El escaparate las usa para pintar sus precios; si esto falla, se queda con los de studio.json.
// "pagos": si se puede pagar al momento (Stripe configurado). Si no, el escaparate reserva sin pagar.
import { rpc, isConfigured } from "./_lib/supabase.js";
import { sendJson } from "./_lib/http.js";
import { stripeConfigured } from "./_lib/stripe.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { ok: false }, { Allow: "GET" });
  if (!isConfigured()) return sendJson(res, 503, { ok: false, error: "no_configurado" });
  try {
    const products = await rpc("api_products");
    return sendJson(res, 200, { ok: true, products, pagos: stripeConfigured() }, { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600" });
  } catch (e) {
    console.error("productos", e.message);
    return sendJson(res, 503, { ok: false });
  }
}
