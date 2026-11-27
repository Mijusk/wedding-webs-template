// Analítica con Umami: visitas, de dónde vienen, páginas y eventos del embudo. Sin cookies y sin
// datos personales, pero es la categoría «analítica» del aviso: solo se carga si la aceptan, y si la
// retiran deja de enviar en el acto (data-before-send cancela cada envío).
// Se activa poniendo studio.json > analytics.websiteId (el id de la web en Umami). Vacío = apagada.
// No se carga en localhost.
import { allowed, onConsentChange } from "./consent.js";

let cfg = null;
let loaded = false;
const queue = [];

const local = () => ["localhost", "127.0.0.1"].includes(location.hostname);

function load() {
  if (loaded || !cfg?.websiteId || local() || !allowed("analitica")) return;
  loaded = true;
  // Umami llama a esta función antes de cada envío: devolver null lo cancela.
  window.__wwAnalyticsBeforeSend = (type, payload) => (allowed("analitica") ? payload : null);
  const s = document.createElement("script");
  s.defer = true;
  s.src = cfg.src || "https://cloud.umami.is/script.js";
  s.dataset.websiteId = cfg.websiteId;
  s.dataset.beforeSend = "__wwAnalyticsBeforeSend";
  if (cfg.domains) s.dataset.domains = cfg.domains;
  s.addEventListener("load", () => queue.splice(0).forEach(([n, d]) => window.umami?.track(n, d)));
  document.head.append(s);
}

export function initAnalytics(studio) {
  if (cfg) return;
  cfg = studio?.analytics || {};
  onConsentChange((c) => { if (c.analitica) load(); else queue.length = 0; });
  load();
}

// Datos que van con todos los eventos de la visita, p. ej. el grupo de una prueba A/B
// ({ grupo_movil: "tarjeta" }): en Umami se filtra cualquier evento por ese grupo.
const extra = {};
export const trackAlways = (data) => Object.assign(extra, data);

// Evento del embudo, p. ej. track("prueba_generada", { estilo: "villa" }). Nunca datos personales.
export function track(name, data) {
  if (!loaded || !allowed("analitica")) return;
  data = { ...extra, ...data };
  try {
    if (window.umami) window.umami.track(name, data);
    else queue.push([name, data]);
  } catch { /* la analítica nunca rompe el escaparate */ }
}
