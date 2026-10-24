// Utilidades de interfaz del panel: plantillas HTML con escapado, fechas, avisos y diálogos.

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// html`<p>${texto}</p>` escapa lo que se interpola; raw() marca HTML ya seguro; las listas se unen.
const RAW = Symbol("raw");
export const raw = (s) => ({ [RAW]: String(s ?? "") });
const part = (v) => (v == null || v === false ? "" : Array.isArray(v) ? v.map(part).join("") : v[RAW] !== undefined ? v[RAW] : esc(v));
export const html = (strings, ...values) => raw(strings.reduce((out, s, i) => out + s + (i < values.length ? part(values[i]) : ""), ""));
export const str = (tpl) => (tpl && tpl[RAW] !== undefined ? tpl[RAW] : String(tpl ?? ""));
export const render = (el, tpl) => { el.innerHTML = str(tpl); return el; };
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ── Estados ─────────────────────────────────────────────────
export const LEAD_STATUSES = [
  ["nuevo", "Nuevo"], ["contactado", "Contactado"], ["propuesta", "Propuesta"],
  ["esperando_pago", "Esperando pago"], ["ganado", "Ganado"], ["perdido", "Perdido"],
];
export const WEDDING_STATUSES = [
  ["borrador", "Borrador"], ["vista_previa", "Vista previa"], ["publicada", "Publicada"], ["archivada", "Archivada"], ["retirada", "Retirada"],
];
export const ORDER_STATUSES = [
  ["borrador", "Borrador"], ["pendiente_pago", "Pendiente de pago"], ["pagado", "Pagado"], ["en_produccion", "En producción"],
  ["entregado", "Entregado"], ["cancelado", "Cancelado"], ["reembolsado", "Reembolsado"],
];
export const SOURCES = {
  prueba: "Prueba en el escaparate", reserva: "Reserva en el escaparate", importado: "Hoja de Google", manual: "A mano",
  whatsapp: "WhatsApp", email: "Email", telefono: "Teléfono", bodas_net: "Bodas.net", instagram: "Instagram",
  recomendacion: "Recomendación", otro: "Otro",
};
const LABELS = Object.fromEntries([...LEAD_STATUSES, ...WEDDING_STATUSES, ...ORDER_STATUSES, ["pendiente", "Pendiente"], ["hecha", "Hecha"], ["cancelada", "Cancelada"]]);
export const statusLabel = (s) => LABELS[s] || s;
export const statusChip = (s) => html`<span class="status" data-s="${s}">${statusLabel(s)}</span>`;
export const STATUS_COLOR = { nuevo: "var(--st-nuevo)", contactado: "var(--st-contactado)", propuesta: "var(--st-propuesta)", esperando_pago: "var(--st-esperando_pago)", ganado: "var(--st-ganado)", perdido: "var(--st-perdido)" };

// ── Fechas y dinero (siempre en hora de Madrid) ─────────────
const TZ = "Europe/Madrid";
const asDate = (v) => (v instanceof Date ? v : /^\d{4}-\d{2}-\d{2}$/.test(v || "") ? new Date(`${v}T12:00:00Z`) : new Date(v));
const fmt = (v, opts) => (v ? asDate(v).toLocaleString("es-ES", { timeZone: /^\d{4}-\d{2}-\d{2}$/.test(v) ? "UTC" : TZ, ...opts }) : "");
export const fmtDate = (v) => fmt(v, { day: "numeric", month: "short", year: "numeric" }).replace(".", "");
export const fmtDateLong = (v) => fmt(v, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
export const fmtDateTime = (v) => fmt(v, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).replace(".", "");
export const fmtTime = (v) => fmt(v, { hour: "2-digit", minute: "2-digit" });
export const todayMadrid = () => new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
export const fmtMoney = (cents) => (cents == null ? "" : (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" }));

export function timeAgo(v) {
  if (!v) return "";
  const s = (Date.now() - new Date(v).getTime()) / 1000;
  if (s < 60) return "ahora mismo";
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  if (s < 86400 * 7) return `hace ${Math.round(s / 86400)} d`;
  return fmtDate(v);
}

// "dentro de 8 meses", "en 12 días", "hoy", "hace 3 semanas"
export function untilDate(dateStr) {
  if (!dateStr) return "";
  const d = Math.round((asDate(dateStr) - asDate(todayMadrid())) / 864e5);
  if (d === 0) return "hoy";
  const a = Math.abs(d);
  const span = a < 14 ? `${a} día${a === 1 ? "" : "s"}` : a < 60 ? `${Math.round(a / 7)} semanas` : a < 730 ? `${Math.round(a / 30.4)} meses` : `${Math.round(a / 365)} años`;
  return d > 0 ? `en ${span}` : `hace ${span}`;
}

// Sello de fecha de una boda: día grande y mes/año pequeño.
export function stamp(dateStr) {
  if (!dateStr) return html`<span class="stamp stamp--none">sin fecha</span>`;
  const d = asDate(dateStr);
  const day = d.toLocaleDateString("es-ES", { day: "numeric", timeZone: "UTC" });
  const month = d.toLocaleDateString("es-ES", { month: "short", timeZone: "UTC" }).replace(".", "");
  const year = d.toLocaleDateString("es-ES", { year: "2-digit", timeZone: "UTC" });
  return html`<span class="stamp" title="${fmtDateLong(dateStr)}"><b>${day}</b><small>${month} ’${year}</small></span>`;
}

// ── Avisos ──────────────────────────────────────────────────
export function toast(message, { error = false, action, onAction, timeout = 4500 } = {}) {
  const box = document.getElementById("toasts");
  const el = document.createElement("div");
  el.className = `toast${error ? " toast--error" : ""}`;
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button type="button">${esc(action)}</button>` : ""}`;
  const close = () => el.remove();
  el.querySelector("button")?.addEventListener("click", () => { close(); onAction?.(); });
  box.append(el);
  setTimeout(close, action ? timeout * 2 : timeout);
}

export const fail = (e) => toast(e?.message || String(e), { error: true, timeout: 7000 });

// ── Diálogos ────────────────────────────────────────────────
// formDialog({ title, body: html`...campos...`, submit: "Guardar" }) -> FormData | null
export function formDialog({ title, body, submit = "Guardar", danger = false, text, onOpen }) {
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    render(dlg, html`<form method="dialog" class="dlg" novalidate>
      <h2>${title}</h2>
      ${text ? html`<p class="muted">${text}</p>` : ""}
      ${body || ""}
      <p class="error" data-error></p>
      <div class="dlg__actions">
        <button class="btn" value="cancel" type="button" data-cancel>Cancelar</button>
        <button class="btn ${danger ? "btn--danger" : "btn--primary"}" value="ok">${submit}</button>
      </div>
    </form>`);
    document.body.append(dlg);
    const form = dlg.querySelector("form");
    const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    form.querySelector("[data-cancel]").addEventListener("click", () => done(null));
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); done(null); });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const missing = [...form.querySelectorAll("[required]")].find((i) => !String(i.value).trim());
      if (missing) {
        form.querySelector("[data-error]").textContent = `Falta: ${missing.closest(".field")?.querySelector("label")?.textContent || missing.name}.`;
        missing.focus();
        return;
      }
      done(new FormData(form));
    });
    dlg.showModal();
    form.querySelector("input:not([type=hidden]), textarea, select")?.focus();
    onOpen?.(form);
  });
}

export const confirmDialog = async (title, text, submit = "Sí", danger = false) =>
  Boolean(await formDialog({ title, text, submit, danger }));

export function showDialog(content) {
  const dlg = document.createElement("dialog");
  render(dlg, content);
  document.body.append(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  dlg.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) dlg.close(); });
  dlg.showModal();
  return dlg;
}

// ── Varios ──────────────────────────────────────────────────
export const debounce = (fn, ms = 250) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

// Enlace de WhatsApp: los móviles españoles de 9 cifras llevan delante el 34.
export function waLink(phone, text = "") {
  let p = String(phone || "").replace(/[^\d+]/g, "").replace(/^\+/, "").replace(/^00/, "");
  if (/^[6789]\d{8}$/.test(p)) p = `34${p}`;
  return p ? `https://wa.me/${p}${text ? `?text=${encodeURIComponent(text)}` : ""}` : "";
}
export const mailLink = (email, subject = "", body = "") =>
  `mailto:${encodeURIComponent(email || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

// CSV para Excel: separador ";" (Excel en español), BOM para las tildes y nada que empiece por
// =, +, - o @ se lee como fórmula (se le pone delante un apóstrofo).
export function downloadCsv(filename, rows, columns) {
  const cell = (v) => {
    let s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map(([, label]) => cell(label)).join(";"), ...rows.map((r) => columns.map(([key]) => cell(typeof key === "function" ? key(r) : r[key])).join(";"))];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export const icons = {
  search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 11 12 4l8 7v9H4z"/><path d="M10 20v-6h4v6"/></svg>',
  leads: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="8.5" cy="12" r="5"/><circle cx="15.5" cy="12" r="5"/></svg>',
  tasks: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>',
  weddings: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>',
  more: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  whatsapp: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 12a8 8 0 0 1-11.8 7L4 20l1.1-4A8 8 0 1 1 20 12z"/><path d="M9 9.5c.5 2 2.5 4 4.5 4.5l1-1.2 2 1-.5 1.5c-3 .5-7.5-3.5-7.5-7l1.5-.5 1 2z"/></svg>',
  mail: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>',
  phone: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 4h10l4 4v12H5z"/><path d="M9 12h6M9 16h4"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 21V4h11l-2 4 2 4H5"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/></svg>',
  euro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 6a7 7 0 1 0 0 12M4 10h10M4 14h10"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
};
