#!/usr/bin/env node
// Un Stripe de mentira para probar los cobros en local, sin cuenta ni internet.
//
//   node tests/stripe-falso.mjs        (escucha en http://127.0.0.1:12111)
//
// y en .env.local:
//   STRIPE_SECRET_KEY=sk_test_local
//   STRIPE_WEBHOOK_SECRET=whsec_local
//   STRIPE_API_BASE=http://127.0.0.1:12111
//
// Imita lo justo: crear la página de pago (Checkout), una página "Pagar / Cancelar" y los avisos
// firmados (checkout.session.completed y charge.refunded) que manda a /api/stripe.
import http from "node:http";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { signatureHeader } from "../api/_lib/stripe.js";

const id = (p) => `${p}_test_${randomBytes(12).toString("hex")}`;

// "a[b][0][c]=1" -> { a: { b: [ { c: "1" } ] } }
function parseForm(text) {
  const out = {};
  for (const [k, v] of new URLSearchParams(text)) {
    const path = k.replace(/\]/g, "").split("[");
    let o = out;
    path.forEach((p, i) => {
      if (i === path.length - 1) o[p] = v;
      else o = o[p] ||= /^\d+$/.test(path[i + 1]) ? [] : {};
    });
  }
  return out;
}

export function startFakeStripe({ port = 12111, webhookUrl = "http://127.0.0.1:3000/api/stripe", secret = "whsec_local" } = {}) {
  const sessions = new Map();
  const byKey = new Map();
  const charges = new Map(); // payment_intent -> { amount, refunded }
  const sent = [];

  async function notify(type, object) {
    const event = { id: id("evt"), object: "event", type, created: Math.floor(Date.now() / 1000), livemode: false, data: { object } };
    const raw = JSON.stringify(event);
    const res = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json", "Stripe-Signature": signatureHeader(raw, secret) }, body: raw });
    sent.push({ type, status: res.status, body: await res.json().catch(() => null) });
    return { event, status: res.status };
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let body = "";
    for await (const c of req) body += c;
    const send = (status, data, type = "application/json") => {
      res.writeHead(status, { "Content-Type": type });
      res.end(type === "application/json" ? JSON.stringify(data) : data);
    };

    if (req.method === "POST" && url.pathname === "/v1/checkout/sessions") {
      if (!/^Bearer sk_test_/.test(req.headers.authorization || "")) return send(401, { error: { message: "Invalid API Key provided" } });
      const key = req.headers["idempotency-key"];
      if (key && byKey.has(key)) return send(200, byKey.get(key));
      const f = parseForm(body);
      const item = f.line_items?.[0];
      if (f.mode !== "payment" || !item?.price_data?.unit_amount || !f.success_url) return send(400, { error: { message: "Faltan parámetros" } });
      const exp = Number(f.expires_at);
      const now = Date.now() / 1000;
      if (exp && (exp < now + 1800 - 5 || exp > now + 86400 + 5)) return send(400, { error: { message: "expires_at fuera de rango" } });
      const s = {
        id: id("cs"), object: "checkout.session", mode: "payment", status: "open", payment_status: "unpaid",
        amount_total: Number(item.price_data.unit_amount) * Number(item.quantity || 1), currency: item.price_data.currency,
        client_reference_id: f.client_reference_id || null, customer_email: f.customer_email || null,
        metadata: f.metadata || {}, success_url: f.success_url, cancel_url: f.cancel_url, expires_at: exp || Math.floor(now + 86400),
        payment_intent: null, name: item.price_data.product_data?.name,
      };
      s.url = `http://127.0.0.1:${port}/pagar/${s.id}`;
      sessions.set(s.id, s);
      if (key) byKey.set(key, s);
      return send(200, s);
    }

    const x = /^\/v1\/checkout\/sessions\/(cs_test_\w+)\/expire$/.exec(url.pathname);
    if (req.method === "POST" && x) {
      const s = sessions.get(x[1]);
      if (!s || s.status !== "open") return send(400, { error: { message: "Only open sessions can be expired" } });
      s.status = "expired";
      return send(200, s);
    }

    const m = /^\/pagar\/(cs_test_\w+)$/.exec(url.pathname);
    if (m) {
      const s = sessions.get(m[1]);
      if (!s) return send(404, "No existe", "text/html");
      if (req.method === "GET") {
        return send(200, `<!doctype html><meta charset="utf-8"><title>Stripe de pruebas</title>
          <main style="font:16px system-ui;max-width:420px;margin:60px auto;display:grid;gap:14px">
          <h1>Stripe de pruebas</h1><p>${s.name}</p><p><b>${(s.amount_total / 100).toFixed(2).replace(".", ",")} €</b></p>
          <form method="post"><button name="accion" value="pagar">Pagar</button> <button name="accion" value="cancelar">Cancelar</button></form></main>`, "text/html; charset=utf-8");
      }
      if (new URLSearchParams(body).get("accion") === "cancelar") { res.writeHead(303, { Location: s.cancel_url }); return res.end(); }
      if (s.status !== "open") return send(409, "Esta página de pago ya no está abierta", "text/html");
      s.status = "complete"; s.payment_status = "paid"; s.payment_intent = id("pi");
      s.customer_details = { email: s.customer_email };
      charges.set(s.payment_intent, { id: id("ch"), amount: s.amount_total, refunded: 0 });
      await notify("checkout.session.completed", s);
      res.writeHead(303, { Location: s.success_url });
      return res.end();
    }

    // Solo para las pruebas: devolver dinero de un pago, como si Luis lo hiciera en Stripe.
    if (req.method === "POST" && url.pathname === "/prueba/devolver") {
      const { payment_intent, amount } = JSON.parse(body || "{}");
      const c = charges.get(payment_intent);
      if (!c) return send(404, { error: "no existe" });
      c.refunded = Math.min(c.amount, c.refunded + Number(amount || c.amount));
      const r = await notify("charge.refunded", { id: c.id, object: "charge", amount: c.amount, amount_refunded: c.refunded, payment_intent, refunded: c.refunded >= c.amount });
      return send(200, { ok: true, webhook: r.status });
    }
    if (req.method === "GET" && url.pathname === "/prueba/sesiones") return send(200, [...sessions.values()]);
    if (req.method === "GET" && url.pathname === "/prueba/avisos") return send(200, sent);
    return send(404, { error: { message: "No implementado en el Stripe de pruebas" } });
  });

  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ server, sessions, sent, notify, close: () => server.close() })));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startFakeStripe();
  console.log("Stripe de pruebas en http://127.0.0.1:12111 (avisos a http://127.0.0.1:3000/api/stripe)");
}
