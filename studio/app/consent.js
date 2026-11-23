// Aviso de cookies del escaparate, por categorías.
//
//   · Necesarias (siempre activas): guardar esta elección y lo que pide la propia web.
//   · Analítica: contar visitas con Umami. No usa cookies, pero su script lee datos del navegador
//     (pantalla, idioma) y Umami reconoce la visita con una huella de IP + navegador. La guía de la
//     AEPD dice que la analítica no está exenta y que el art. 22.2 LSSI también cubre las técnicas
//     de huella, así que solo se carga si la aceptan.
//   · Publicidad: recordar de qué anuncio llegaron (primer toque, «ww-attribution») y, si está
//     encendido en studio.json > ads, el píxel de Meta y la etiqueta de Google Ads.
//
// Primera capa con tres botones del mismo peso (Rechazar todo, Configurar, Aceptar todo). En
// «Configurar» los interruptores salen apagados: las casillas premarcadas no valen como
// consentimiento (RGPD, considerando 32; guía de cookies de la AEPD, apartado 3.1.2.2).
//
// La elección se guarda en localStorage («ww-consent») y viaja con el lead para dejar constancia
// en la tabla consents (lo elegido en cada categoría, el texto que vieron, fecha e IP).
// Subir VERSION hace que quien ya eligió vuelva a ver el aviso (p. ej. si cambian las categorías).
export const VERSION = 3; // v3: la publicidad incluye el email o teléfono cifrado a Meta
const KEY = "ww-consent";
const MAX_AGE_DAYS = 365; // la AEPD considera buena práctica no pasar de 24 meses
const listeners = [];

export const CATEGORIES = [
  {
    id: "analitica",
    name: "Analítica",
    text: "Contamos visitas, páginas vistas, de qué web o anuncio llegáis y qué botones pulsáis, con Umami. "
      + "No usa cookies ni guarda nada en vuestro navegador, y no sabemos quiénes sois: solo vemos números agregados.",
  },
  {
    id: "publicidad",
    name: "Publicidad y medición de anuncios",
    text: "Recordamos durante 90 días de qué anuncio o web llegasteis la primera vez, para saber qué publicidad nos trae parejas. "
      + "Si anunciamos en Instagram, Facebook o Google, también avisamos a Meta o Google de que la visita vino de su anuncio (con sus cookies). "
      + "Si además nos dejáis vuestro email o teléfono, a Meta se lo mandamos cifrado, para que sepa si visteis su anuncio.",
  },
];

export const BANNER_TEXT = "Usamos tecnologías propias y de terceros para contar visitas (analítica) y para saber qué anuncio os trajo (publicidad). "
  + "Solo las activamos si nos dais permiso. Podéis cambiarlo cuando queráis en «Configurar cookies», al pie de cada página.";

// Texto completo que se guarda como constancia: la primera capa y lo que dice cada categoría.
export const CONSENT_TEXT = [BANNER_TEXT, ...CATEGORIES.map((c) => `${c.name}: ${c.text}`)].join(" | ");

function read() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!c || c.v !== VERSION || !c.at) return null;
    if (Date.now() - Date.parse(c.at) > MAX_AGE_DAYS * 864e5) return null;
    return c;
  } catch { return null; }
}

export const consent = () => read();
export const allowed = (category) => read()?.[category] === true;
export const adsAllowed = () => allowed("publicidad");
export const onConsentChange = (fn) => listeners.push(fn);

// choices: { analitica: bool, publicidad: bool }; method: aceptar_todo | rechazar_todo | configurar
export function saveConsent(choices, method = "configurar") {
  const before = read();
  const c = { v: VERSION, method, at: new Date().toISOString(), text: CONSENT_TEXT };
  for (const { id } of CATEGORIES) c[id] = choices[id] === true;
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* sin almacenamiento */ }
  listeners.forEach((fn) => { try { fn(c, before); } catch (e) { console.error(e); } });
  return c;
}

// Para el payload del lead: lo elegido en cada categoría, cómo, cuándo y el texto que vieron.
export function consentForLead() {
  const c = read();
  if (!c) return undefined;
  return {
    version: c.v, method: c.method, at: c.at, text: c.text,
    choices: Object.fromEntries(CATEGORIES.map(({ id }) => [id, c[id] === true])),
  };
}

// ── Interfaz ───────────────────────────────────────────────

const all = (value) => Object.fromEntries(CATEGORIES.map(({ id }) => [id, value]));
let lastFocus = null;

function closeBanner() { document.querySelector(".cookies")?.remove(); }

function banner() {
  const el = document.createElement("section");
  el.className = "cookies";
  el.setAttribute("aria-labelledby", "cookies-title");
  el.innerHTML = `
    <h2 class="cookies__title" id="cookies-title">Cookies</h2>
    <p>${BANNER_TEXT} <a href="legal.html#cookies">Más información</a></p>
    <div class="cookies__actions">
      <button class="cookies__btn" type="button" data-choice="rechazar">Rechazar todo</button>
      <button class="cookies__btn" type="button" data-choice="configurar">Configurar</button>
      <button class="cookies__btn" type="button" data-choice="aceptar">Aceptar todo</button>
    </div>`;
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-choice]");
    if (!b) return;
    if (b.dataset.choice === "configurar") return openCookieSettings();
    saveConsent(all(b.dataset.choice === "aceptar"), b.dataset.choice === "aceptar" ? "aceptar_todo" : "rechazar_todo");
    closeBanner();
  });
  return el;
}

function settingsDialog() {
  const current = read();
  const dlg = document.createElement("dialog");
  dlg.className = "cookies-settings";
  dlg.setAttribute("aria-labelledby", "cookies-settings-title");
  // Interruptores apagados de entrada; si ya eligieron, se ve lo que eligieron.
  dlg.innerHTML = `
    <form method="dialog" class="cookies-settings__form">
      <div class="cookies-settings__head">
        <h2 id="cookies-settings-title">Configurar cookies</h2>
        <button class="close" type="submit" value="cerrar" aria-label="Cerrar sin guardar">×</button>
      </div>
      <p class="cookies-settings__intro">Elegid qué permitís. Lo que no activéis no se usa, y podéis cambiarlo cuando queráis desde «Configurar cookies», al pie de la página. <a href="legal.html#cookies">Más información</a></p>
      <ul class="cookies-settings__list">
        <li>
          <div class="switch is-fixed">
            <span><strong>Necesarias</strong><small>Guardan esta elección («ww-consent», 12 meses) y lo que la web necesita para funcionar. No se pueden desactivar.</small></span>
            <span class="cookies-settings__always">Siempre activas</span>
          </div>
        </li>
        ${CATEGORIES.map((c) => `
        <li>
          <label class="switch" for="ck-${c.id}">
            <span><strong>${c.name}</strong><small>${c.text}</small></span>
            <input type="checkbox" id="ck-${c.id}" name="${c.id}" ${current?.[c.id] ? "checked" : ""}>
            <span class="switch__track" aria-hidden="true"></span>
          </label>
        </li>`).join("")}
      </ul>
      <div class="cookies__actions cookies-settings__actions">
        <button class="cookies__btn" type="submit" value="rechazar">Rechazar todo</button>
        <button class="cookies__btn" type="submit" value="guardar">Guardar mi elección</button>
        <button class="cookies__btn" type="submit" value="aceptar">Aceptar todo</button>
      </div>
    </form>`;
  dlg.querySelector("form").addEventListener("submit", (e) => {
    const action = e.submitter?.value;
    if (action === "aceptar") saveConsent(all(true), "aceptar_todo");
    else if (action === "rechazar") saveConsent(all(false), "rechazar_todo");
    else if (action === "guardar") {
      saveConsent(Object.fromEntries(CATEGORIES.map(({ id }) => [id, dlg.querySelector(`#ck-${id}`).checked])), "configurar");
    }
    if (action && action !== "cerrar") closeBanner();
  });
  dlg.addEventListener("close", () => {
    dlg.remove();
    // Si cierran sin elegir, sigue el aviso; el foco vuelve a donde estaba.
    const back = document.querySelector(".cookies [data-choice=configurar]") || lastFocus;
    back?.focus?.();
  });
  return dlg;
}

export function openCookieSettings() {
  document.querySelector(".cookies-settings")?.remove();
  lastFocus = document.activeElement;
  const dlg = settingsDialog();
  document.body.append(dlg);
  if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  dlg.querySelector("input")?.focus();
}

export function showConsentBanner() {
  closeBanner();
  // Al principio del documento: con el teclado es lo primero a lo que se llega.
  const el = banner();
  document.body.prepend(el);
  watchHeight(el);
}

// Altura del aviso en --cookies-h, para que no tape el final de la página ni de las capas (móvil).
function watchHeight(el) {
  const root = document.documentElement;
  const set = () => root.style.setProperty("--cookies-h", el.isConnected ? `${el.offsetHeight + 16}px` : "0px");
  set();
  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(() => { set(); if (!el.isConnected) ro.disconnect(); });
    ro.observe(el);
  }
  const mo = new MutationObserver(() => { if (!el.isConnected) { set(); mo.disconnect(); } });
  mo.observe(document.body, { childList: true });
}

// Se llama al cargar cada página del escaparate. [data-cookies] (en el pie) abre la configuración.
export function setupConsent() {
  document.querySelectorAll("[data-cookies]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    openCookieSettings();
  }));
  if (!read()) showConsentBanner();
}
