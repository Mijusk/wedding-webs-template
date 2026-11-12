// Consentimiento de cookies del escaparate. Solo hay una categoría opcional: «publicidad», que
// guarda de qué anuncio o web llegó la pareja la primera vez (primer toque) entre visitas.
// La analítica (Umami) no usa cookies ni datos personales y no necesita consentimiento.
//
// La elección se guarda en localStorage («ww-consent») y viaja con el lead para dejar constancia
// en la tabla consents (texto exacto aceptado, fecha e IP), igual que el consentimiento comercial.
const KEY = "ww-consent";
const VERSION = 1;
const listeners = [];

export const BANNER_TEXT = "Usamos un almacenamiento en vuestro navegador para recordar de qué anuncio o web llegasteis, "
  + "y así saber qué publicidad nos trae parejas. Es opcional. Contamos visitas de forma anónima, sin cookies.";

function read() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "null");
    return c && c.v === VERSION ? c : null;
  } catch { return null; }
}

export const consent = () => read();
export const adsAllowed = () => read()?.ads === true;

function save(ads) {
  const c = { v: VERSION, ads, at: new Date().toISOString(), text: BANNER_TEXT };
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* sin almacenamiento */ }
  listeners.forEach((fn) => fn(c));
  return c;
}

export const onConsentChange = (fn) => listeners.push(fn);

// Para el payload del lead: lo que eligió y el texto que vio.
export function consentForLead() {
  const c = read();
  return c ? { granted: c.ads, text: c.text, at: c.at } : undefined;
}

function banner() {
  const el = document.createElement("div");
  el.className = "cookies";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Cookies");
  el.innerHTML = `
    <p>${BANNER_TEXT} <a href="legal.html#cookies">Más información</a></p>
    <div class="cookies__actions">
      <button class="btn btn--small btn--ghost" type="button" data-ads="0">Rechazar</button>
      <button class="btn btn--small" type="button" data-ads="1">Aceptar</button>
    </div>`;
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ads]");
    if (!b) return;
    save(b.dataset.ads === "1");
    el.remove();
  });
  return el;
}

export function showConsentBanner() {
  document.querySelector(".cookies")?.remove();
  document.body.append(banner());
}

// Se llama al cargar cada página del escaparate. [data-cookies] (en el pie) vuelve a abrir el aviso.
export function setupConsent() {
  document.querySelectorAll("[data-cookies]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    showConsentBanner();
  }));
  if (!read()) showConsentBanner();
}
