export const $ = (sel, root = document) => root.querySelector(sel);

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// sessionStorage puede no existir o lanzar (modo privado, vista previa): todo es opcional.
export const session = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
};

export const priceLabel = ([min, max], currency) =>
  min === max ? `${min} ${currency}` : `${min} – ${max} ${currency}`;

// Bloquea el scroll de la página mientras haya una capa abierta.
export function syncScrollLock() {
  const open = ["#builder", "#loading", "#stage"].some((id) => !$(id).hidden);
  document.body.classList.toggle("locked", open);
}
