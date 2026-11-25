import { sunsetUTC } from "./sun.js";

// El cielo de «Del día a la noche». Cada momento del día se mide en minutos respecto a la
// puesta de sol REAL de la boda (fecha y lugar; sin coordenadas, la de Madrid): -240 es plena
// tarde, 0 la puesta y +150 noche cerrada. De ahí salen el color del cielo, el de las letras,
// la altura del sol y cuántas estrellas se ven.

// Paradas del cielo: [minutos respecto a la puesta, cielo, horizonte, acento].
const STOPS = [
  [-420, "#f4efe6", "#f7f1e6", "#9a4b2c"], // día
  [-210, "#f6e7cc", "#f8ead2", "#9a4b2c"], // tarde
  [-100, "#f1cf9c", "#f6dcae", "#94401f"], // hora dorada
  [-20, "#e79a74", "#f2b98c", "#7e2f1d"], // puesta
  [35, "#9a6b8c", "#d38f86", "#f1c48c"], // crepúsculo
  [85, "#424a7c", "#7b6a95", "#efc183"], // hora azul
  [160, "#161b33", "#232a4a", "#e9b877"], // noche
];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const PARSED = STOPS.map(([m, sky, low, accent]) => ({ m, sky: hex(sky), low: hex(low), accent: hex(accent) }));

// Colores (y tokens de texto) para un momento dado, en minutos respecto a la puesta.
export function skyAt(minutes) {
  const m = clamp(minutes, PARSED[0].m, PARSED[PARSED.length - 1].m);
  let i = 0;
  while (i < PARSED.length - 2 && m > PARSED[i + 1].m) i++;
  const a = PARSED[i], b = PARSED[i + 1];
  const t = clamp((m - a.m) / (b.m - a.m), 0, 1);
  const sky = mix(a.sky, b.sky, t), low = mix(a.low, b.low, t), accent = mix(a.accent, b.accent, t);
  const dark = lum(sky) < 0.5;
  return {
    sky: toHex(sky), low: toHex(low), accent: toHex(accent),
    ink: dark ? "#f7efe3" : "#2b211c",
    muted: dark ? "rgb(247 239 227 / .72)" : "rgb(43 33 28 / .68)",
    line: dark ? "rgb(247 239 227 / .22)" : "rgb(43 33 28 / .16)",
    onAccent: lum(accent) < 0.5 ? "#fbf6ee" : "#181c33",
    dark,
    // Sol: 1 arriba del todo, 0 en el horizonte, negativo ya escondido. Luna y estrellas, de noche.
    sun: clamp(-m / 300, -0.4, 1),
    stars: clamp((m - 50) / 100, 0, 1),
  };
}

const toMinutes = (hhmm) => {
  const [h, min] = String(hhmm || "").split(":").map(Number);
  return Number.isFinite(h) ? h * 60 + (min || 0) : NaN;
};

// Puesta de sol de la boda: la de su lugar o, si no hay coordenadas, la de Madrid ese día.
// Se pasa a la hora del lugar con el desfase que ya trae la fecha de la boda (+02:00 en verano
// en la península, +01:00 en Canarias), sin depender de nombres de zona horaria.
export function sunsetOf(config) {
  const venue = config.venue || {};
  const num = (v) => (v === "" || v === null || v === undefined ? NaN : Number(v));
  let lat = num(venue.lat), lon = num(venue.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) { lat = 40.4168; lon = -3.7038; }
  const iso = String(config.event?.date || "");
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const off = /([+-])(\d{2}):(\d{2})$/.exec(iso);
  const offset = off ? (off[1] === "-" ? -1 : 1) * (Number(off[2]) * 60 + Number(off[3])) : iso.endsWith("Z") ? 0 : 120;
  const when = y && m && d ? sunsetUTC(y, m, d, lat, lon) : null;
  if (!when) return { label: "21:00", minutes: 1260 };
  const minutes = (((when.getUTCHours() * 60 + when.getUTCMinutes() + offset) % 1440) + 1440) % 1440;
  const pad = (n) => String(n).padStart(2, "0");
  return { label: `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`, minutes };
}

// Cada momento del programa en minutos respecto a la puesta. Lo que va después de medianoche
// (la fiesta a la 01:00) cuenta como del mismo día.
export function scheduleLight(config) {
  const sunset = sunsetOf(config);
  const start = toMinutes(config.event?.date?.slice(11, 16));
  return {
    sunset,
    items: (config.schedule || []).map((s) => {
      let m = toMinutes(s.time);
      if (!Number.isFinite(m)) return NaN;
      if (Number.isFinite(start) && m < start - 120) m += 1440;
      return m - sunset.minutes;
    }),
  };
}

// Nombre de la luz de cada momento (para la línea pequeña bajo cada etapa del programa).
export function lightName(delta) {
  if (!Number.isFinite(delta)) return "";
  if (delta < -150) return "day";
  if (delta < -45) return "golden";
  if (delta <= 25) return "sunset";
  if (delta < 95) return "dusk";
  return "night";
}
