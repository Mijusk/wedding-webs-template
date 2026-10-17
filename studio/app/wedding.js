// Datos de la pareja (lo que pide el formulario) -> config.json de una plantilla concreta.
// Cada plantilla trae su propio config de ejemplo como base (textos, secciones, idioma);
// aquí se sustituyen los campos comunes. Una plantilla nueva que use otros campos
// para lo mismo (fotos, historia...) necesita su línea aquí.

const addMinutes = (hhmm, mins) => {
  const [h, m] = hhmm.split(":").map(Number);
  const t = (h * 60 + m + mins) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

// Fecha límite del RSVP: 6 semanas antes; si eso ya pasó, una semana antes; si tampoco
// da tiempo, sin fecha límite.
function rsvpDeadline(date) {
  const before = (days) => {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - days);
    return d;
  };
  const soon = new Date(Date.now() + 2 * 864e5);
  const d = [before(42), before(7)].find((x) => x > soon);
  return d ? d.toISOString().slice(0, 10) : "";
}

// Desfase horario del lugar en esa fecha ("+02:00" en verano en España). Sin él, "Añadir al
// calendario" y la cuenta atrás usarían la zona del invitado: a quien vive en México la boda
// de las 18:00 le saldría a las 18:00 de México.
export function utcOffset(date, time, timeZone = "Europe/Madrid") {
  const guess = new Date(`${date}T${time}:00Z`);
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(guess).map((x) => [x.type, x.value]));
  const mins = Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - guess.getTime()) / 6e4);
  const a = Math.abs(mins), pad = (n) => String(n).padStart(2, "0");
  return `${mins < 0 ? "-" : "+"}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}
const withZone = (local, tz) => `${local}${utcOffset(local.slice(0, 10), local.slice(11, 16), tz)}`;

// Fin aproximado (para "Añadir al calendario"): 9 horas después, aunque pase de medianoche.
function endOf(date, time) {
  const end = addMinutes(time, 540);
  if (end > time) return `${date}T${end}:00`;
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.toISOString().slice(0, 10)}T${end}:00`;
}

const dayMonth = (date) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("es-ES", { day: "numeric", month: "long", timeZone: "UTC" });

export function toConfig(base, w, style) {
  const config = structuredClone(base);
  config.theme = style.theme;
  if (!w) return config; // ejemplo de la plantilla tal cual

  const [a, b] = w.couple;
  const photos = w.photos;
  const canarias = /canari|tenerife|lanzarote|fuerteventura|la palma|gomera|el hierro|las palmas/i.test(`${w.venue} ${w.city}`);
  const tz = canarias ? "Atlantic/Canary" : base.timeZone || "Europe/Madrid";
  const start = withZone(`${w.date}T${w.time}:00`, tz);
  config.event = {
    ...base.event,
    couple: [a, b],
    date: start,
    end: withZone(endOf(w.date, w.time), tz),
    photo: photos[0] || base.event.photo,
    photoAlt: `${a} y ${b}`,
  };
  if (photos[0]) delete config.event.photoFocus;

  config.venue = {
    name: w.venue,
    address: w.city,
    city: w.city || w.venue,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([w.venue, w.city].filter(Boolean).join(", "))}`,
  };
  config.schedule = [
    { time: w.time, label: "Ceremonia", place: w.venue },
    { time: addMinutes(w.time, 90), label: "Cóctel", place: "" },
    { time: addMinutes(w.time, 180), label: "Cena", place: "" },
    { time: addMinutes(w.time, 330), label: "Fiesta", place: "Hasta que el cuerpo aguante" },
  ];
  config.rsvp = { ...base.rsvp, deadline: rsvpDeadline(w.date), endpoint: "" };

  // Clásica: fotos 2 y 3 en la galería.
  config.gallery = photos.slice(1);
  // Editorial: historia en capítulos, con las fotos 2 y 3 si las hay.
  if (base.story) {
    config.story = {
      chapters: [
        { meta: "Cómo empezó", text: "Aquí irá vuestra historia: cómo os conocisteis, el primer viaje, la pedida. La escribimos juntos cuando reservéis.", photo: photos[1], photoAlt: `${a} y ${b}` },
        { meta: w.city || w.venue, text: `El ${dayMonth(w.date)} nos casamos en ${w.venue}, y queremos que estés allí.`, photo: photos[2], photoAlt: `${a} y ${b}` },
      ],
    };
  }
  // Regalo: con titular de la pareja y una cuenta de ejemplo, para que se vea la sección.
  if (base.gifts) config.gifts = { holder: `${a} y ${b}`, iban: "ES00 0000 0000 0000 0000 0000" };
  return config;
}
