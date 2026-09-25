const LOCALE = "es-ES";

// Fecha y hora se leen tal cual del config (hora local del lugar),
// sin convertir a la zona horaria del invitado.
export const longDate = (iso) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString(LOCALE, {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });

export const time = (iso) => iso.slice(11, 16);

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
