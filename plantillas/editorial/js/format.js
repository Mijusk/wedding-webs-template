// Fecha y hora se leen tal cual del config (hora local del lugar),
// sin convertir a la zona horaria del invitado.
export function dateParts(iso, locale) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  const f = (opts) => d.toLocaleDateString(locale, { ...opts, timeZone: "UTC" });
  return {
    day: f({ day: "numeric" }),
    month: f({ month: "long" }),
    year: f({ year: "numeric" }),
    weekday: f({ weekday: "long" }),
    dayMonth: f({ day: "numeric", month: "long" }),
    numeric: `${iso.slice(8, 10)} · ${iso.slice(5, 7)} · ${iso.slice(0, 4)}`,
  };
}

export const time = (iso) => iso.slice(11, 16);

export const daysUntil = (iso) => Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 864e5));

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Rellena "{clave}" con valores. interpolate devuelve texto plano; fill, HTML escapado.
export const interpolate = (template, vars = {}) =>
  String(template ?? "").replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

export const fill = (template, vars) => esc(interpolate(template, vars));
