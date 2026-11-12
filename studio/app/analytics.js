// Analítica anónima y sin cookies (Umami): visitas, de dónde vienen, páginas y eventos del embudo.
// No guarda nada en el navegador ni datos personales, así que no necesita consentimiento.
// Se activa poniendo studio.json > analytics.websiteId (el id de la web en Umami). Vacío = apagada.
let ready = false;
const queue = [];

export function initAnalytics(studio) {
  const cfg = studio?.analytics || {};
  if (!cfg.websiteId || ready || location.hostname === "localhost" || location.hostname === "127.0.0.1") return;
  ready = true;
  const s = document.createElement("script");
  s.defer = true;
  s.src = cfg.src || "https://cloud.umami.is/script.js";
  s.dataset.websiteId = cfg.websiteId;
  if (cfg.domains) s.dataset.domains = cfg.domains;
  s.addEventListener("load", () => queue.splice(0).forEach(([n, d]) => window.umami?.track(n, d)));
  document.head.append(s);
}

// Evento del embudo, p. ej. track("prueba_generada", { estilo: "villa" }). Nunca datos personales.
export function track(name, data) {
  if (!ready) return;
  try {
    if (window.umami) window.umami.track(name, data);
    else queue.push([name, data]);
  } catch { /* la analítica nunca rompe el escaparate */ }
}
