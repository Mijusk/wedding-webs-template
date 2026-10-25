// /api/pedido  ·  pagar desde el escaparate y la página de seguimiento (sin contraseña: con el
// código del pedido, p. ej. K7M3-Q9TX).
//
//   GET  ?c=<código>             datos para /seguimiento/<código>
//   GET  ?c=<código>&pagar=1     lleva a la página de pago de Stripe (o de vuelta, si ya está pagado)
//   POST {accion: "reservar", …}                          escaparate: crea el pedido y devuelve la página de pago
//   POST {accion: "cambio", c, tipo, mensaje, propuesta}  la pareja pide cambios o una corrección
//   POST {accion: "aprobar", c, propuesta}                la pareja aprueba una propuesta
//   POST {accion: "panel", c}                             manda a la pareja el enlace a su panel de invitados
//   POST {accion: "propuesta", wedding_id, nota, resolver}  solo el equipo: manda una propuesta y avisa
//   POST {accion: "publicada", wedding_id}  solo el equipo: tras publicar, el email «web publicada» si toca
//   POST {accion: "pago", order_id, importe, forma, fecha}  solo el equipo: apunta un pago (Bizum,
//        transferencia…); si queda pagado, la pareja recibe la confirmación con la factura
//
// (Todo en una función para no pasar del límite de funciones del plan de Vercel.)
import { rpc, rpcAs, isConfigured, SupabaseError } from "./_lib/supabase.js";
import { sendJson, readJson, queryOf, clientIp, ipHash, origin, HttpError } from "./_lib/http.js";
import { stripeConfigured, createCheckout, expireCheckout, formatCode, StripeError } from "./_lib/stripe.js";
import { callerToken, isStaff, magicLink } from "./_lib/acceso.js";
import { sendEmail, notifyLuis } from "./_lib/avisos.js";
import { accessEmail, proposalEmail } from "./_lib/emails.js";
import { trackingUrl, afterPayment } from "./_lib/cobros.js";
import { runEvent } from "./_lib/automatizaciones.js";
import { validNif } from "../lib/nif.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CODE = /^[2-9A-HJKMNP-Z]{8}$/;
const EMAIL = /^\S+@\S+\.\S+$/;
const NO_INDEX = { "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };
const norm = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const FIELDS = ["email", "name", "nameA", "nameB", "phone", "tier", "style", "weddingDate", "venue", "city", "message",
  "wedding", "sections", "billing", "startNow", "startNowText", "consent", "consentText", "page", "attribution"];

export default async function handler(req, res) {
  if (!isConfigured()) return sendJson(res, 503, { ok: false, error: "no_configurado" });
  try {
    if (req.method === "GET") return await get(req, res);
    if (req.method !== "POST") return sendJson(res, 405, { ok: false }, { Allow: "GET, POST" });
    let body;
    try { body = await readJson(req, 96 * 1024); }
    catch (e) { return sendJson(res, e instanceof HttpError ? e.status : 400, { ok: false, error: e.code || "json" }); }
    switch (body.accion) {
      case "reservar": return await reservar(req, res, body);
      case "cambio": return await cambio(req, res, body);
      case "aprobar": return await aprobar(req, res, body);
      case "panel": return await panel(req, res, body);
      case "propuesta": return await propuesta(req, res, body);
      case "pago": return await pago(req, res, body);
      case "publicada": return await publicada(req, res, body);
      default: return sendJson(res, 400, { ok: false, error: "accion" });
    }
  } catch (e) {
    console.error("pedido", e.status, e.message);
    if (e instanceof StripeError) return sendJson(res, 502, { ok: false, error: "stripe" });
    return sendJson(res, 503, { ok: false, error: "error" });
  }
}

// Un intento con un código que no existe cuenta para el límite: así no se pueden ir probando.
async function limited(req) {
  return !(await rpc("api_hit_rate_limit", { p_key: `seguimiento:${ipHash(clientIp(req))}`, p_max: 120, p_window_seconds: 600 }));
}

async function get(req, res) {
  const q = queryOf(req);
  const code = norm(q.get("c"));
  if (await limited(req)) return sendJson(res, 429, { ok: false, error: "demasiadas" }, { ...NO_INDEX, "Retry-After": "600" });
  if (!CODE.test(code)) return sendJson(res, 404, { ok: false, error: "no_existe" }, NO_INDEX);

  if (q.get("pagar")) return pay(req, res, code);
  const data = await rpc("api_tracking", { p_code: code });
  if (!data) return sendJson(res, 404, { ok: false, error: "no_existe" }, NO_INDEX);
  return sendJson(res, 200, { ok: true, pedido: data, pagos: stripeConfigured() }, NO_INDEX);
}

function redirect(res, url) {
  res.statusCode = 303;
  res.setHeader("Location", url);
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(NO_INDEX)) res.setHeader(k, v);
  res.end();
}

async function checkoutFor(o, site) {
  const s = await createCheckout(o, site);
  if (o.checkout_session_id && o.checkout_session_id !== s.id) await expireCheckout(o.checkout_session_id);
  await rpc("api_checkout_session", { p_order_id: o.order_id, p_session_id: s.id, p_url: s.url, p_expires_at: new Date(s.expires_at * 1000).toISOString() });
  return s;
}

async function pay(req, res, code) {
  const site = origin(req);
  const back = trackingUrl(site, code);
  const o = await rpc("api_order_for_payment", { p_code: code });
  if (!o) return redirect(res, `${site}/seguimiento/`);
  if (!o.payable) return redirect(res, back);
  if (!stripeConfigured()) return redirect(res, `${back}?pago=no_disponible`);
  const s = await checkoutFor(o, site);
  return redirect(res, s.url);
}

async function reservar(req, res, body) {
  if (body.website) return sendJson(res, 400, { ok: false, error: "datos" }); // campo trampa: un bot
  if (!stripeConfigured()) return sendJson(res, 503, { ok: false, error: "sin_pagos" });
  const email = String(body.email || "").trim();
  if (!EMAIL.test(email) || email.length > 200) return sendJson(res, 400, { ok: false, error: "email" });
  if (body.billing?.nif && !validNif(body.billing.nif)) return sendJson(res, 400, { ok: false, error: "nif" });
  const ipRaw = clientIp(req);
  if (!(await rpc("api_hit_rate_limit", { p_key: `reservar:${ipHash(ipRaw)}`, p_max: 10, p_window_seconds: 900 }))) {
    return sendJson(res, 429, { ok: false, error: "demasiadas" }, { "Retry-After": "900" });
  }
  const p = Object.fromEntries(FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));
  const r = await rpc("api_checkout_start", { p, p_ip: ipRaw || null, p_user_agent: String(req.headers["user-agent"] || "").slice(0, 300) });
  if (!r?.ok) return sendJson(res, 400, { ok: false, error: r?.error || "error" });
  const o = await rpc("api_order_for_payment", { p_code: r.tracking_code });
  const s = await checkoutFor(o, origin(req));
  return sendJson(res, 200, { ok: true, url: s.url, codigo: formatCode(r.tracking_code), pedido: r.number });
}

async function cambio(req, res, body) {
  const code = norm(body.c);
  if (!CODE.test(code)) return sendJson(res, 404, { ok: false, error: "no_existe" });
  if (!(await rpc("api_hit_rate_limit", { p_key: `cambio:${code}`, p_max: 20, p_window_seconds: 86400 }))) {
    return sendJson(res, 429, { ok: false, error: "demasiadas" });
  }
  const kind = body.tipo === "cambio" ? "cambio" : "correccion";
  const proposal = Number.isInteger(body.propuesta) ? body.propuesta : null;
  const r = await rpc("api_tracking_request", { p_code: code, p_kind: kind, p_message: String(body.mensaje || "").slice(0, 4000), p_proposal: proposal });
  if (!r?.ok) return sendJson(res, 400, r || { ok: false });
  const site = origin(req);
  await notifyLuis({
    subject: `${kind === "cambio" ? "Cambios pedidos" : "Corrección pedida"}: ${r.names}${r.proposal ? ` (propuesta ${r.proposal})` : ""}`,
    lines: [String(body.mensaje || "").slice(0, 1500)],
    panelUrl: r.wedding_id ? `${site}/panel/#/bodas/${r.wedding_id}` : `${site}/panel/#/clientes/${r.client_id}`,
  }).catch((e) => console.error("aviso cambio", e.message));
  return sendJson(res, 200, { ok: true });
}

async function aprobar(req, res, body) {
  const code = norm(body.c);
  if (!CODE.test(code) || !Number.isInteger(body.propuesta)) return sendJson(res, 400, { ok: false, error: "datos" });
  if (await limited(req)) return sendJson(res, 429, { ok: false, error: "demasiadas" });
  const r = await rpc("api_tracking_approve", { p_code: code, p_proposal: body.propuesta });
  if (!r?.ok) return sendJson(res, 400, r || { ok: false });
  if (!r.repetido) {
    const site = origin(req);
    await notifyLuis({
      subject: `¡Aprobada! ${r.names} (propuesta ${r.proposal})`,
      lines: ["Ya puedes publicar su web."],
      panelUrl: r.wedding_id ? `${site}/panel/#/bodas/${r.wedding_id}` : null,
    }).catch((e) => console.error("aviso aprobada", e.message));
  }
  return sendJson(res, 200, { ok: true });
}

// "Abrir el panel de invitados": el enlace va al email de la pareja, nunca se enseña aquí.
async function panel(req, res, body) {
  const code = norm(body.c);
  if (!CODE.test(code)) return sendJson(res, 404, { ok: false, error: "no_existe" });
  if (!(await rpc("api_hit_rate_limit", { p_key: `panel:${code}`, p_max: 3, p_window_seconds: 3600 }))) {
    return sendJson(res, 429, { ok: false, error: "demasiadas" });
  }
  const c = await rpc("api_tracking_couple", { p_code: code });
  const emails = (c?.emails || []).filter((e) => EMAIL.test(e));
  if (!emails.length) return sendJson(res, 409, { ok: false, error: "sin_panel" });
  const site = origin(req);
  const results = await Promise.all(emails.map(async (email) => {
    const link = await magicLink(email, site);
    const r = await sendEmail({ to: email, template: "acceso_pareja", weddingId: c.wedding_id,
      ...accessEmail({ link, couple: String(c.names || "").split(" y ") }) });
    return { email: mask(email), status: r.status };
  }));
  return sendJson(res, 200, { ok: true, enviados: results });
}

const mask = (email) => email.replace(/^(.)(.*)(@.*)$/, (_, a, b, d) => `${a}${"•".repeat(Math.min(b.length, 6))}${d}`);

async function propuesta(req, res, body) {
  const token = await callerToken(req);
  if (!token || !(await isStaff(token))) return sendJson(res, 403, { ok: false, error: "permiso" });
  if (!UUID.test(body.wedding_id || "")) return sendJson(res, 400, { ok: false, error: "datos" });
  let r;
  try {
    r = await rpcAs(token, "send_proposal", { p_wedding_id: body.wedding_id, p_note: body.nota || null, p_resolve: body.resolver !== false });
  } catch (e) {
    if (e instanceof SupabaseError && e.status < 500) {
      return sendJson(res, 409, { ok: false, error: e.body?.hint || "error", message: e.message });
    }
    throw e;
  }
  const site = origin(req);
  const url = trackingUrl(site, r.tracking_code);
  const emails = await Promise.all((r.emails || []).filter((e) => EMAIL.test(e)).map(async (email) => {
    const m = await sendEmail({ to: email, template: "propuesta", weddingId: body.wedding_id, meta: { propuesta: r.number },
      ...proposalEmail({ names: r.names, number: r.number, note: r.note, trackingUrl: url }) });
    return { email, status: m.status };
  }));
  return sendJson(res, 200, { ok: true, number: r.number, resolved: r.resolved, url, code: formatCode(r.tracking_code), names: r.names, emails });
}

async function pago(req, res, body) {
  const token = await callerToken(req);
  if (!token || !(await isStaff(token))) return sendJson(res, 403, { ok: false, error: "permiso" });
  const cents = Math.round(Number(body.importe));
  if (!UUID.test(body.order_id || "") || !Number.isFinite(cents) || cents <= 0) return sendJson(res, 400, { ok: false, error: "datos" });
  let r;
  try {
    r = await rpcAs(token, "record_payment", { p_order_id: body.order_id, p_amount_cents: cents, p_provider: String(body.forma || "otro"),
      p_paid_at: body.fecha || null, p_notes: body.nota || null });
  } catch (e) {
    if (e instanceof SupabaseError && e.status < 500) return sendJson(res, 409, { ok: false, error: "error", message: e.message });
    throw e;
  }
  if (!r?.ok) return sendJson(res, 400, r || { ok: false });
  await afterPayment(r, origin(req), { amountCents: cents });
  return sendJson(res, 200, { ok: true, status: r.status, became_paid: r.became_paid, invoice: r.invoice, promised: r.promised_delivery_at });
}

async function publicada(req, res, body) {
  const token = await callerToken(req);
  if (!token || !(await isStaff(token))) return sendJson(res, 403, { ok: false, error: "permiso" });
  if (!UUID.test(body.wedding_id || "")) return sendJson(res, 400, { ok: false, error: "datos" });
  const r = await runEvent("web_publicada", body.wedding_id, origin(req));
  return sendJson(res, 200, { ok: true, emails: r });
}
