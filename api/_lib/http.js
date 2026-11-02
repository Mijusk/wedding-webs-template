// Utilidades HTTP comunes a las funciones de /api. Solo usan la API de Node, así funcionan igual
// en Vercel y en el servidor local (scripts/servidor-local.mjs).
import { createHash, createHmac } from "node:crypto";
import { config } from "./supabase.js";

export function sendJson(res, status, data, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(data));
}

export function sendHtml(res, status, html, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(html);
}

export const queryOf = (req) => new URL(req.url, "http://x").searchParams;

// Cuerpo de la petición como objeto. Vercel puede haberlo leído ya (req.body); si no, se lee aquí.
// Las plantillas y el escaparate mandan JSON como text/plain (para evitar la petición previa CORS).
export async function readJson(req, maxBytes = 64 * 1024) {
  if (req.body !== undefined && req.body !== null && req.body !== "") {
    if (typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
    const text = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body);
    if (text.length > maxBytes) throw new HttpError(413, "demasiado_grande");
    return parse(text);
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new HttpError(413, "demasiado_grande");
    chunks.push(chunk);
  }
  return parse(Buffer.concat(chunks).toString("utf8"));
}

function parse(text) {
  try {
    const v = JSON.parse(text || "{}");
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error();
    return v;
  } catch {
    throw new HttpError(400, "json");
  }
}

export class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export function clientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || String(req.headers["x-real-ip"] || "") || req.socket?.remoteAddress || "";
}

// Huella de la IP para el límite de peticiones: nunca se guarda la IP en claro.
export function ipHash(ip) {
  const key = createHash("sha256").update(`ip-hash:${config().serviceKey}`).digest();
  return createHmac("sha256", key).update(String(ip)).digest("base64url").slice(0, 22);
}

export function origin(req) {
  const site = (process.env.SITE_URL || "").replace(/\/+$/, "");
  if (site) return site;
  const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0] || (req.socket?.encrypted ? "https" : "http");
  return `${proto}://${req.headers["x-forwarded-host"] || req.headers.host}`;
}

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// JSON seguro dentro de <script type="application/json">: sin "</script>" ni separadores de línea raros.
export const jsonForHtml = (data) =>
  JSON.stringify(data).replace(/[<\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);

// Copia a una hoja de Google (Apps Script) durante la transición. Nunca bloquea ni rompe la respuesta.
export async function forwardToSheet(url, payload, timeoutMs = 4000) {
  if (!url || !/^https:\/\/script\.google\.com\//.test(url)) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
}
