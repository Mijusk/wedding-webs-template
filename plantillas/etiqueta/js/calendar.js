import { interpolate } from "./format.js";

const stamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// Enlace "Añadir a Google Calendar" con los datos del config (sin descargar archivos).
export function calendarUrl({ event, venue = {}, copy = {} }) {
  const [a, b] = event.couple;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: interpolate(copy.details?.calendarTitle || "{a} & {b}", { a, b }),
    dates: `${stamp(event.date)}/${stamp(event.end || event.date)}`,
    location: [venue.name, venue.address].filter(Boolean).join(", "),
    details: event.tagline || "",
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
