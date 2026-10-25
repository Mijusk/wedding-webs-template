// POST /api/stripe  ·  avisos (webhooks) de Stripe. Configúralo en Stripe › Desarrolladores › Webhooks
// con estos eventos: checkout.session.completed, checkout.session.async_payment_succeeded,
// checkout.session.async_payment_failed, charge.refunded y charge.dispute.created.
//
// - Comprueba la firma (STRIPE_WEBHOOK_SECRET) sobre el cuerpo tal cual llega.
// - Cada aviso se guarda una vez (webhook_events): si Stripe lo repite, no se cobra dos veces.
// - Si algo falla, responde 500 y Stripe lo vuelve a intentar (durante días).
import { rpc, isConfigured } from "./_lib/supabase.js";
import { verifySignature } from "./_lib/stripe.js";
import { afterPayment, afterRefund } from "./_lib/cobros.js";
import { notifyLuis } from "./_lib/avisos.js";

// Función con la forma estándar de la web (Request → Response): así el cuerpo llega tal cual, byte
// a byte, que es lo que firma Stripe. (Con la forma req/res, Vercel podría convertirlo antes en objeto.)
const json = (status, data) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

function siteOf(request) {
  const site = (process.env.SITE_URL || "").replace(/\/+$/, "");
  if (site) return site;
  const h = request.headers;
  const host = h.get("x-forwarded-host") || h.get("host") || new URL(request.url).host;
  const proto = (h.get("x-forwarded-proto") || new URL(request.url).protocol.replace(":", "")).split(",")[0];
  return `${proto}://${host}`;
}

export async function POST(request) {
  if (!isConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) return json(503, { ok: false, error: "no_configurado" });
  const raw = Buffer.from(await request.arrayBuffer());
  if (raw.length > 512 * 1024) return json(413, { ok: false });
  if (!verifySignature(raw, request.headers.get("stripe-signature"))) return json(400, { ok: false, error: "firma" });

  let event;
  try { event = JSON.parse(raw.toString("utf8")); } catch { return json(400, { ok: false, error: "json" }); }
  if (!event?.id || !event?.type) return json(400, { ok: false, error: "evento" });

  let rec;
  try {
    rec = await rpc("api_webhook_received", { p_provider: "stripe", p_event_id: event.id, p_type: event.type, p_payload: event });
  } catch (e) {
    console.error("stripe: no se pudo guardar el aviso", e.message);
    return json(500, { ok: false }); // Stripe lo reintentará
  }
  if (rec.processed) return json(200, { ok: true, repetido: true });
  try {
    const result = await handle(event, siteOf(request));
    await rpc("api_webhook_done", { p_id: rec.id, p_error: null });
    return json(200, { ok: true, ...result });
  } catch (e) {
    console.error("stripe", event.type, e.message);
    await rpc("api_webhook_done", { p_id: rec.id, p_error: e.message }).catch(() => {});
    return json(500, { ok: false }); // Stripe lo reintentará
  }
}

async function handle(event, site) {
  const o = event.data?.object || {};
  switch (event.type) {
    case "checkout.session.completed":
      // Tarjeta y Bizum llegan pagados aquí. Los métodos lentos (transferencia SEPA) avisan después.
      return o.payment_status === "paid" ? paid(o, event, site) : { esperando: true };
    case "checkout.session.async_payment_succeeded":
      return paid(o, event, site);
    case "checkout.session.async_payment_failed":
      await notifyLuis({ subject: `Pago fallido del pedido ${o.metadata?.order_number || ""}`, lines: [o.customer_details?.email] });
      return { fallido: true };
    case "charge.refunded": {
      if (!o.payment_intent) return { ignorado: true };
      const r = await rpc("api_payment_refunded", {
        p: { provider: "stripe", external_id: o.payment_intent, refunded_cents: o.amount_refunded,
             reason: "Devolución", raw: { charge: o.id, amount_refunded: o.amount_refunded } },
      });
      if (r?.ok === false && r.error === "pago") return { desconocido: true }; // un cobro que no es de un pedido
      await afterRefund(r, site);
      return { devolucion: r?.delta_cents || 0 };
    }
    case "charge.dispute.created": {
      await notifyLuis({
        subject: "Reclamación de un pago (contracargo)",
        lines: [`Importe: ${(o.amount / 100).toFixed(2)} €`, `Motivo: ${o.reason}`, "Respóndela en Stripe › Pagos › Reclamaciones antes de la fecha límite."],
      });
      await rpc("api_auto_task", { p_key: `reclamacion:${o.id}`, p_title: "Responder a una reclamación de pago en Stripe",
        p_notes: `Motivo: ${o.reason}. Hazlo antes de la fecha límite que indica Stripe.`, p_payment_ref: o.payment_intent || null })
        .catch((e) => console.error("tarea reclamación", e.message));
      return { reclamacion: true };
    }
    default:
      return { ignorado: true };
  }
}

async function paid(s, event, site) {
  const orderId = s.metadata?.order_id || s.client_reference_id;
  if (!orderId) return { sin_pedido: true };
  if (String(s.currency || "eur").toLowerCase() !== "eur") throw new Error(`Moneda inesperada: ${s.currency}`);
  const r = await rpc("api_payment_succeeded", {
    p: {
      order_id: orderId, provider: "stripe", external_id: s.payment_intent || s.id, amount_cents: s.amount_total,
      paid_at: new Date((event.created || Date.now() / 1000) * 1000).toISOString(),
      raw: { session: s.id, payment_intent: s.payment_intent, email: s.customer_details?.email || null, livemode: Boolean(event.livemode) },
    },
  });
  if (!r?.ok) throw new Error(`No se ha podido apuntar el pago: ${r?.error}`);
  await afterPayment(r, site, { amountCents: s.amount_total });
  return { pedido: r.number, pagado: r.became_paid, repetido: Boolean(r.repetido) };
}
