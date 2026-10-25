// Stripe sin librerías: crear la página de pago (Checkout) y comprobar la firma de sus avisos.
//
//   STRIPE_SECRET_KEY       sk_test_… (pruebas) o sk_live_… (cobros de verdad). Solo en el servidor.
//   STRIPE_WEBHOOK_SECRET   whsec_… del aviso (Stripe › Desarrolladores › Webhooks › tu destino).
//   STRIPE_API_BASE         solo para las pruebas automáticas, que usan un Stripe falso en local.
//
// No usamos las facturas de Stripe: las facturas salen de nuestra base de datos (numeración,
// rectificativas y Verifactu). Stripe solo cobra.
import { createHmac, timingSafeEqual } from "node:crypto";

export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);
export const stripeLive = () => String(process.env.STRIPE_SECRET_KEY || "").startsWith("sk_live_");

export class StripeError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

// { a: 1, b: { c: [ { d: 2 } ] } } -> a=1&b[c][0][d]=2  (el formato que pide la API de Stripe)
export function formEncode(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === "object" ? formEncode(item, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))));
    else if (typeof v === "object") formEncode(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function call(path, params, { idempotencyKey } = {}) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError("Stripe no está configurado (STRIPE_SECRET_KEY).", 503);
  const base = (process.env.STRIPE_API_BASE || "https://api.stripe.com").replace(/\/+$/, "");
  const res = await fetch(`${base}/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: formEncode(params).toString(),
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new StripeError(data.error?.message || `Stripe respondió ${res.status}`, res.status, data.error);
  return data;
}

export const formatCode = (code) => (code && code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code || "");

// Página de pago de Stripe para lo que queda por pagar de un pedido. Sin "payment_method_types":
// así salen los métodos activados en el panel de Stripe (tarjeta, Bizum, Apple Pay, Google Pay…).
export async function createCheckout(order, origin) {
  const back = `${origin}/seguimiento/${formatCode(order.tracking_code)}`;
  // Misma clave y mismos datos durante una hora: si se pulsa dos veces, Stripe devuelve la misma página.
  const hour = Math.floor(Date.now() / 3600e3);
  return call("checkout/sessions", {
    mode: "payment",
    locale: "es",
    customer_email: order.email || undefined,
    client_reference_id: order.order_id,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: order.due_cents,
        product_data: { name: `Pedido ${order.number} · ${order.description || "Web de boda"}`.slice(0, 250) },
      },
    }],
    metadata: { order_id: order.order_id, order_number: order.number },
    payment_intent_data: {
      description: `WeddingWebs · pedido ${order.number}`,
      metadata: { order_id: order.order_id, order_number: order.number },
    },
    success_url: `${back}?pago=ok`,
    cancel_url: `${back}?pago=cancelado`,
    expires_at: (hour + 23) * 3600, // entre 22 y 23 horas (Stripe admite de 30 minutos a 24 horas)
  }, { idempotencyKey: `checkout-${order.order_id}-${order.due_cents}-${hour}` });
}

// Cierra una página de pago anterior (si ya no está abierta, Stripe da error y no pasa nada): así
// una pareja con dos pestañas abiertas de días distintos no puede pagar dos veces.
export async function expireCheckout(id) {
  try { await call(`checkout/sessions/${encodeURIComponent(id)}/expire`, {}); return true; } catch { return false; }
}

// Firma de los avisos: cabecera "Stripe-Signature: t=<segundos>,v1=<hmac>[,v1=…]".
// El HMAC-SHA256 se calcula sobre "<t>.<cuerpo tal cual llegó>" con el secreto whsec_….
export function verifySignature(raw, header, secret = process.env.STRIPE_WEBHOOK_SECRET, toleranceSec = 300) {
  if (!secret || !header) return false;
  let t = null;
  const sigs = [];
  for (const part of String(header).split(",")) {
    const i = part.indexOf("=");
    const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
    if (k === "t") t = Number(v);
    if (k === "v1") sigs.push(v);
  }
  if (!Number.isFinite(t) || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = Buffer.from(sign(raw, secret, t));
  return sigs.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), expected));
}

function sign(raw, secret, t) {
  return createHmac("sha256", secret).update(`${t}.`).update(Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw))).digest("hex");
}

// Para las pruebas automáticas (simulan los avisos de Stripe).
export const signatureHeader = (raw, secret, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${sign(raw, secret, t)}`;
