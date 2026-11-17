export const $ = (sel, root = document) => root.querySelector(sel);

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
