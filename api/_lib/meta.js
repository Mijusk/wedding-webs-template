// API de conversiones de Meta: manda a Meta, desde el servidor, el mismo «Lead» o «SubmitApplication»
// que ya lanza el píxel en el navegador. Así Meta no pierde los que tienen un bloqueador de anuncios
// o un navegador que corta el píxel, y aprende mejor a quién enseñar los anuncios.
//
// Solo se manda si:
//   · hay identificador de píxel (studio.json > ads.metaPixelId, o la variable META_PIXEL_ID) y la
//     clave META_CAPI_TOKEN en Vercel (Administrador de eventos › Configuración › API de conversiones ›
//     «Generar identificador de acceso»). Sin las dos, no se hace nada;
//   · y la pareja ACEPTÓ «Publicidad y medición de anuncios» en el aviso de cookies: es el mismo
//     permiso que el píxel. Sin él no sale nada hacia Meta.
//
// Datos que salen: email y teléfono cifrados con SHA-256 (Meta no los ve en claro), IP, navegador, las
// cookies _fbp/_fbc de Meta, la página y la tarifa. Nunca nombres, fecha ni lugar de la boda.
// El navegador y el servidor mandan el mismo eventID: Meta los cuenta una sola vez.
// META_TEST_EVENT_CODE (opcional): el código de «Probar eventos», para ver los envíos en directo.
// Guía: docs/ANUNCIOS.md
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ROOT } from "./render.js";

const GRAPH_VERSION = () => process.env.META_GRAPH_VERSION || "v23.0";
const DEFAULT_NAMES = { lead: "Lead", reserva: "SubmitApplication" };

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

export function normalizeEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  return /^\S+@\S+\.\S+$/.test(e) ? e : "";
}

// Meta quiere el teléfono solo con cifras y con el prefijo del país. Un móvil o fijo español de 9
// cifras lleva 34 delante; los que ya traen prefijo (+34, 0034, +33…) se quedan como vienen.
export function normalizePhone(phone) {
  let p = String(phone || "").trim();
  if (!p) return "";
  const plus = p.startsWith("+");
  p = p.replace(/\D/g, "");
  if (!plus && p.startsWith("00")) p = p.slice(2);
  else if (!plus && /^[6789]\d{8}$/.test(p)) p = `34${p}`;
  return p.length >= 8 && p.length <= 15 ? p : "";
}

function cookie(header, name) {
  const m = String(header || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  if (!m) return "";
  try { return decodeURIComponent(m[1]); } catch { return m[1]; } // un % suelto no puede tumbar el envío
}

// Permiso de publicidad del aviso de cookies (v1: { granted }; v2: { choices: { publicidad } }).
export function adsConsented(cookieConsent) {
  const c = cookieConsent || {};
  return (typeof c.choices?.publicidad === "boolean" ? c.choices.publicidad : c.granted) === true;
}

// El evento tal como lo pide Meta. Devuelve null si no hay que mandarlo. Sin efectos: se prueba solo.
export function buildMetaEvent({ kind, eventId, payload = {}, ip, userAgent, cookies, siteOrigin, value, eventName, now = Date.now() }) {
  if (!DEFAULT_NAMES[kind] || !adsConsented(payload.cookieConsent)) return null;
  const em = normalizeEmail(payload.email), ph = normalizePhone(payload.phone);
  const user = {};
  if (em) user.em = [sha256(em)];
  if (ph) user.ph = [sha256(ph)];
  if (ip) user.client_ip_address = ip;
  if (userAgent) user.client_user_agent = userAgent;
  const fbp = cookie(cookies, "_fbp");
  if (fbp) user.fbp = fbp;
  // _fbc: la cookie del píxel; si no está, se rehace con el fbclid del anuncio que guardó la atribución.
  const fbclid = payload.attribution?.last?.fbclid || payload.attribution?.first?.fbclid;
  const fbc = cookie(cookies, "_fbc") || (fbclid ? `fb.1.${now}.${fbclid}` : "");
  if (fbc) user.fbc = fbc;
  if (!user.em && !user.ph && !user.fbp && !user.fbc) return null; // Meta no podría emparejarlo

  const custom = {};
  const name = payload.tier || payload.style;
  if (name) custom.content_name = String(name).slice(0, 100);
  if (typeof value === "number" && value > 0) { custom.value = value; custom.currency = "EUR"; }
  const page = typeof payload.page === "string" && payload.page.startsWith("/") ? payload.page.slice(0, 300) : "/studio/";
  const event = {
    event_name: eventName || DEFAULT_NAMES[kind],
    event_time: Math.floor(now / 1000),
    action_source: "website",
    event_source_url: `${siteOrigin}${page}`,
    user_data: user,
    custom_data: custom,
  };
  if (/^[A-Za-z0-9_-]{8,64}$/.test(eventId || "")) event.event_id = eventId;
  return event;
}

let studioAds = null;
async function adsConfig() {
  if (!studioAds) {
    try {
      const studio = JSON.parse(await readFile(join(ROOT, "studio/studio.json"), "utf8"));
      studioAds = { ads: studio.ads || {}, tiers: studio.pricing?.tiers || studio.tiers || [] };
    } catch {
      studioAds = { ads: {}, tiers: [] };
    }
  }
  return studioAds;
}

// Manda el evento. Nunca lanza: si Meta falla, el lead ya está guardado y solo se apunta en el log.
export async function sendMetaEvent({ kind, eventId, payload, ip, userAgent, cookies, siteOrigin }) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return { sent: false, reason: "sin_token" };
  try {
    const { ads, tiers } = await adsConfig();
    const pixel = String(process.env.META_PIXEL_ID || ads.metaPixelId || "").trim();
    if (!/^\d{6,20}$/.test(pixel)) return { sent: false, reason: "sin_pixel" };
    const tier = kind === "reserva" ? tiers.find((t) => t.id === payload?.tier) : null;
    const value = Array.isArray(tier?.price) ? Number(tier.price[0]) : undefined;
    const event = buildMetaEvent({ kind, eventId, payload, ip, userAgent, cookies, siteOrigin, value, eventName: ads.events?.[kind]?.meta });
    if (!event) return { sent: false, reason: "sin_permiso" };
    const body = { data: [event] };
    if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION()}/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      console.error("meta capi", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return { sent: false, reason: "meta_error" };
    }
    return { sent: true };
  } catch (e) {
    console.error("meta capi", e.message);
    return { sent: false, reason: "meta_error" };
  }
}
