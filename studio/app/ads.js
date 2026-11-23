// Medición de anuncios: píxel de Meta (Instagram y Facebook) y etiqueta de Google Ads.
//
// Se configura en studio.json > ads. Sin identificadores no se carga nada. Con ellos, solo se
// carga si la persona acepta «Publicidad y medición de anuncios» en el aviso de cookies; si
// rechaza o no contesta, nada. Si retira el permiso, se deja de enviar y se borran sus cookies.
// No se carga en localhost (como la analítica): se prueba en la vista previa de Vercel.
//
// conversion() es el ÚNICO sitio desde el que se lanzan las conversiones (lead del generador y
// reserva): las manda a Umami siempre que la analítica esté aceptada, y a Meta y Google si la
// publicidad lo está. Nunca datos personales: ni nombres ni emails.
// Guía: docs/ANUNCIOS.md
import { allowed, onConsentChange } from "./consent.js";
import { track } from "./analytics.js";

let cfg = {};
let loaded = { meta: false, google: false };
const local = () => ["localhost", "127.0.0.1"].includes(location.hostname);
const metaId = () => String(cfg.metaPixelId || "").trim();
const googleId = () => String(cfg.googleAdsId || "").trim();
const on = () => allowed("publicidad") && !local();

export function initAds(studio) {
  cfg = studio?.ads || {};
  if (!metaId() && !googleId()) return;
  onConsentChange((c) => { if (c.publicidad) load(); else revoke(); });
  load();
}

function load() {
  if (!on()) return;
  if (metaId() && !loaded.meta) {
    loaded.meta = true;
    /* Código oficial del píxel de Meta, sin cambios de funcionamiento. */
    const f = window, n = (f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); });
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
    addScript("https://connect.facebook.net/en_US/fbevents.js");
    f.fbq("consent", "grant");
    f.fbq("init", metaId());
    f.fbq("track", "PageView");
  } else if (metaId()) window.fbq?.("consent", "grant");

  if (googleId() && !loaded.google) {
    loaded.google = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    // Modo de consentimiento: solo se llega aquí con la publicidad aceptada. La personalización
    // de anuncios (remarketing) no la pedimos en el aviso, así que va denegada.
    window.gtag("consent", "default", { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "denied", analytics_storage: "denied" });
    window.gtag("js", new Date());
    window.gtag("config", googleId());
    addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleId())}`);
  } else if (googleId()) window.gtag?.("consent", "update", { ad_storage: "granted", ad_user_data: "granted" });
}

function revoke() {
  window.fbq?.("consent", "revoke");
  window.gtag?.("consent", "update", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  // Cookies que dejan Meta (_fbp, _fbc) y Google Ads (_gcl_*) en esta web.
  const names = document.cookie.split(";").map((c) => c.split("=")[0].trim()).filter((k) => /^(_fbp|_fbc|_gcl_\w+)$/.test(k));
  const host = location.hostname, parts = host.split(".");
  const domains = ["", host, ...parts.map((_, i) => "." + parts.slice(i).join(".")).slice(0, -1)];
  for (const k of names) for (const d of domains) document.cookie = `${k}=; Max-Age=0; path=/${d ? `; domain=${d}` : ""}`;
}

function addScript(src) {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.append(s);
}

// Conversiones. type: "lead" (envían el formulario «Probar con vuestra boda») o "reserva".
// data: { estilo, tarifa, valor } sin datos personales. eventId: el mismo que se mandó con el lead al
// servidor, que lo reenvía a Meta por la API de conversiones; con él Meta no lo cuenta dos veces.
export function conversion(type, data = {}, { eventId } = {}) {
  if (!DEFAULT_EVENTS[type]) return;
  const ev = { ...DEFAULT_EVENTS[type], ...cfg.events?.[type] };
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v != null && v !== ""));
  track(ev.umami, clean); // Umami (solo si la analítica está aceptada; ver analytics.js)
  if (!on()) return;
  try {
    const value = typeof clean.valor === "number" ? { value: clean.valor, currency: "EUR" } : {};
    if (loaded.meta && ev.meta) window.fbq?.("track", ev.meta, { content_name: clean.tarifa || clean.estilo, ...value }, eventId ? { eventID: eventId } : undefined);
    const label = String(ev.googleLabel || "").trim();
    if (loaded.google && label) window.gtag?.("event", "conversion", { send_to: `${googleId()}/${label}`, ...value });
  } catch (e) { console.error("[WeddingWebs] anuncios:", e); }
}

// Si studio.json > ads.events no dice otra cosa.
const DEFAULT_EVENTS = {
  lead: { umami: "lead_prueba", meta: "Lead" },
  reserva: { umami: "reserva_enviada", meta: "SubmitApplication" },
};
