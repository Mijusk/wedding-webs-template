// Hora de la puesta de sol del día de la boda en el lugar de la boda.
// Algoritmo de la NOAA (Solar Calculator, ecuaciones de Jean Meeus), sin librerías:
// precisión de ±1 minuto en latitudes medias, de sobra para un programa de boda.
// Se usa la "puesta oficial": centro del sol a 90,833° del cénit (radio solar + refracción).

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

// Declinación del sol y ecuación del tiempo (minutos) para un día juliano.
function solar(jd) {
  const T = (jd - 2451545) / 36525;
  const L0 = ((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360 + 360) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(rad(M)) * (1.914602 - T * (0.004817 + 0.000014 * T))
    + Math.sin(rad(2 * M)) * (0.019993 - 0.000101 * T)
    + Math.sin(rad(3 * M)) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(rad(omega));
  const decl = deg(Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lambda))));
  const y = Math.tan(rad(eps / 2)) ** 2;
  const eqTime = 4 * deg(
    y * Math.sin(2 * rad(L0)) - 2 * e * Math.sin(rad(M))
    + 4 * e * y * Math.sin(rad(M)) * Math.cos(2 * rad(L0))
    - 0.5 * y * y * Math.sin(4 * rad(L0)) - 1.25 * e * e * Math.sin(2 * rad(M)),
  );
  return { decl, eqTime };
}

// Instante (Date) de la puesta de sol del día civil y/m/d en lat/lon (grados, este positivo).
// null si ese día el sol no se pone o no sale (latitudes polares).
export function sunsetUTC(y, m, d, lat, lon) {
  const jd0 = Date.UTC(y, m - 1, d) / 864e5 + 2440587.5; // 0 h UTC
  let minutes = 720 - 4 * lon; // primera aproximación: mediodía solar
  for (let i = 0; i < 3; i++) { // se recalcula en la hora estimada hasta que converge
    const { decl, eqTime } = solar(jd0 + minutes / 1440);
    const cosH = Math.cos(rad(90.833)) / (Math.cos(rad(lat)) * Math.cos(rad(decl))) - Math.tan(rad(lat)) * Math.tan(rad(decl));
    if (cosH < -1 || cosH > 1) return null;
    minutes = 720 - 4 * lon - eqTime + 4 * deg(Math.acos(cosH));
  }
  return new Date(Date.UTC(y, m - 1, d) + Math.round(minutes) * 60e3);
}

const num = (v) => (v === "" || v === null || v === undefined ? NaN : Number(v));

// Puesta de sol de la boda a partir de config.venue.lat / venue.lon (opcionales).
// Devuelve { label: "21:45", minutes: 1305 } en hora local del lugar, o null si no hay coordenadas.
export function weddingSunset({ event, venue = {}, locale } = {}) {
  const lat = num(venue.lat), lon = num(venue.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const [y, m, d] = String(event?.date || "").slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const when = sunsetUTC(y, m, d, lat, lon);
  if (!when) return null;
  let label;
  try {
    label = new Intl.DateTimeFormat(locale || "es-ES", {
      hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: venue.timeZone || "Europe/Madrid",
    }).format(when);
  } catch { return null; }
  const [h, min] = label.match(/\d+/g).map(Number);
  return { label: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`, minutes: h * 60 + min };
}
