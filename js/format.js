const LOCALE = "es-ES";

// Fecha y hora se leen tal cual del config (hora local del lugar),
// sin convertir a la zona horaria del invitado.
export const longDate = (iso) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString(LOCALE, {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });

export const time = (iso) => iso.slice(11, 16);

export const dayMonth = (iso) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString(LOCALE, { day: "numeric", month: "long", timeZone: "UTC" });

// Días de calendario que faltan para la fecha de la boda (negativo si ya pasó), contando
// por días y no por horas: la mañana de la boda es 0 ("es hoy"), no 1.
export function daysUntil(iso, now = new Date()) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
}

// "before" hasta que empieza, "today" hasta que acaba (event.end, o 12 h después) y "after".
export function weddingPhase(event, now = Date.now()) {
  const start = new Date(event.date).getTime();
  const end = event.end ? new Date(event.end).getTime() : start + 12 * 3600e3;
  return now < start ? "before" : now <= end ? "today" : "after";
}

// La lista se cierra al acabar el día límite o al empezar la boda.
export function rsvpClosed({ event, rsvp = {} }, now = Date.now()) {
  if (weddingPhase(event, now) !== "before") return true;
  return Boolean(rsvp.deadline) && now > new Date(`${rsvp.deadline.slice(0, 10)}T23:59:59`).getTime();
}


export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
