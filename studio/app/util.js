export const $ = (sel, root = document) => root.querySelector(sel);

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Contacto para los mensajes de error: el de studio.json > legal.email, o este si ni eso carga.
export const CONTACT_EMAIL = "weddingwebstudios@gmail.com";

// Error amable para la persona; el detalle técnico, solo a la consola.
export function friendlyError(what, error, email = CONTACT_EMAIL) {
  console.error(`[WeddingWebs] ${what}:`, error);
  const mail = esc(email);
  return `<div class="load-error" role="alert">
    <p><strong>Vaya, no hemos podido cargar ${esc(what)}.</strong></p>
    <p>Suele ser un problema pasajero de conexión. <button class="btn btn--small btn--ghost" type="button" onclick="location.reload()">Recargar la página</button></p>
    <p>Si sigue sin salir, escribidnos a <a href="mailto:${mail}">${mail}</a> y os ayudamos.</p>
  </div>`;
}

// sessionStorage puede no existir o lanzar (modo privado, vista previa): todo es opcional.
export const session = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
};

// "Entrega en {deliveryDays} días" + { deliveryDays: 3 } → "Entrega en 3 días". Lo que no está, se deja igual.
export const fill = (text, vars = {}) =>
  String(text ?? "").replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? "") !== "" ? String(vars[k]) : m);

// Rondas de cambios de una tarifa (studio.json > pricing.roundsText).
export const roundsLine = (n, texts = {}) =>
  n == null ? "" : n === 0 ? texts.none || "" : n === 1 ? texts.one || "" : fill(texts.many, { n });

// «ninguna en Tal cual (se entrega tal cual se ha probado), 2 en Con cambios y 3 en A medida»
export function roundsSummary(tiers = []) {
  const parts = tiers.filter((t) => t.rounds != null)
    .map((t) => t.rounds === 0 ? `ninguna en ${t.name} (se entrega tal cual se ha probado)` : `${t.rounds} en ${t.name}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}` : parts[0] || "";
}

// Preguntas frecuentes de studio.json > faq, con los huecos rellenos ({onlineMonths}, {rounds}…).
export function faqItems(studio) {
  const g = studio.guarantee;
  const vars = {
    ...studio.legal,
    rounds: roundsSummary(studio.pricing?.tiers),
    guarantee: g?.enabled ? fill(g.conditions, { days: g.days }) : "",
  };
  return (studio.faq?.items || [])
    .filter((i) => i.q && i.a && (i.needs !== "guarantee" || g?.enabled))
    .map((i) => ({ q: fill(i.q, vars), a: fill(i.a, vars) }));
}

// [79, 79] → "79 €" · [60, 80] → "60 – 80 €" · [249, null] → "desde 249 €"
export const priceLabel = ([min, max], currency) =>
  max == null ? `desde ${min} ${currency}` : min === max ? `${min} ${currency}` : `${min} – ${max} ${currency}`;

// Mientras haya una capa abierta: sin scroll detrás, y la página de fondo inerte para que
// el teclado y los lectores de pantalla se queden dentro de la capa.
export function syncScrollLock() {
  const open = ["#builder", "#loading", "#stage"].some((id) => !$(id).hidden);
  document.body.classList.toggle("locked", open);
  document.querySelectorAll("body > header, body > main, body > footer, #nudge").forEach((el) => { el.inert = open; });
}
