// Lo que pasa después de un pago o una devolución: emails a la pareja (con la factura en PDF)
// y aviso a Luis. Lo usan el aviso de Stripe (api/stripe.js) y el panel.
import { rpc } from "./supabase.js";
import { sendEmail, notifyLuis } from "./avisos.js";
import { paymentEmail, refundEmail } from "./emails.js";
import { provider } from "./facturacion.js";
import { invoiceFileName } from "./pdf.js";
import { formatCode } from "./stripe.js";

export const trackingUrl = (origin, code) => `${origin}/seguimiento/${formatCode(code)}`;
const eur = (cents) => `${(cents / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

// El PDF de una factura emitida, listo para adjuntar. Si algo falla, el email sale sin adjunto.
export async function invoiceAttachment(invoiceId) {
  if (!invoiceId) return null;
  try {
    const doc = await rpc("invoice_document", { p_invoice_id: invoiceId });
    if (!doc) return null;
    return { doc, attachment: { filename: invoiceFileName(doc), content: await provider().getPdf(doc) } };
  } catch (e) {
    console.error("factura pdf", e.message);
    return null;
  }
}

// r: lo que devuelve api_payment_succeeded / record_payment.
export async function afterPayment(r, origin, { amountCents } = {}) {
  if (!r?.ok || r.repetido) return;
  const tasks = [];
  if (r.became_paid && r.email) {
    const inv = r.invoice?.ok ? await invoiceAttachment(r.invoice.id) : null;
    const extra = await rpc("api_automation_block", { p_code: "pago_bienvenida" }).catch(() => null);
    tasks.push(sendEmail({
      to: r.email, template: "pago_recibido", clientId: r.client_id, weddingId: r.wedding_id, meta: { pedido: r.number },
      attachments: inv ? [inv.attachment] : [],
      ...paymentEmail({
        names: r.names, number: r.number, plan: r.plan, amountCents: amountCents ?? r.paid_cents,
        promised: r.promised_delivery_at, trackingUrl: trackingUrl(origin, r.tracking_code), code: formatCode(r.tracking_code),
        conditionsUrl: `${origin}/studio/legal.html#condiciones`, invoiceNumber: inv ? r.invoice.number : null, extra,
      }),
    }));
  }
  tasks.push(notifyLuis({
    subject: r.repeated ? `Pago de más en ${r.number} (${r.names})` : `Pago recibido: ${r.names} (${eur(amountCents ?? r.paid_cents)})`,
    lines: [
      `Pedido ${r.number}${r.plan ? ` · ${r.plan}` : ""}`,
      r.became_paid && r.promised_delivery_at ? `Entrega prometida: ${r.promised_delivery_at}` : "",
      r.invoice && !r.invoice.ok ? `La factura no se ha podido hacer: ${r.invoice.error}` : r.invoice?.number ? `Factura ${r.invoice.number}` : "",
      r.repeated ? "El pedido ya estaba pagado: revisa si hay que devolver este pago." : "",
    ],
    panelUrl: r.client_id ? `${origin}/panel/#/clientes/${r.client_id}` : `${origin}/panel/`,
  }));
  await Promise.allSettled(tasks);
}

export async function afterRefund(r, origin) {
  if (!r?.ok || r.nada) return;
  const corr = r.corrective?.ok ? await invoiceAttachment(r.corrective.id) : null;
  const tasks = [];
  if (r.email) {
    tasks.push(sendEmail({
      to: r.email, template: "devolucion", meta: { pedido: r.number }, attachments: corr ? [corr.attachment] : [],
      ...refundEmail({ names: r.names, number: r.number, amountCents: r.delta_cents, invoiceNumber: corr ? r.corrective.number : null,
        trackingUrl: null }),
    }));
  }
  tasks.push(notifyLuis({
    subject: `Devolución de ${eur(r.delta_cents)}: ${r.names}`,
    lines: [`Pedido ${r.number}`, r.corrective?.ok ? `Rectificativa ${r.corrective.number}` : r.corrective ? `Rectificativa pendiente: ${r.corrective.error}` : ""],
  }));
  await Promise.allSettled(tasks);
}
