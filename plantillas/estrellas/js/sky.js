import { STARS, FIGURES } from "./stars.js";
import { esc } from "./format.js";

// Mapa del cielo real: qué estrellas había sobre el lugar de la boda esa noche.
// Todo se calcula aquí, en el navegador, sin librerías ni peticiones.
//
// Momento elegido: las 23:00 (hora del lugar) del día de la boda. Las ceremonias suelen
// ser de día y a esa hora todavía no hay estrellas; a las 23:00 es noche cerrada todo el año
// en la Península y la boda sigue en pie. Si la boda empieza ya de noche (22:00–04:59),
// se usa su hora exacta.

const RAD = Math.PI / 180;
const sin = (d) => Math.sin(d * RAD);
const cos = (d) => Math.cos(d * RAD);
const norm = (d) => ((d % 360) + 360) % 360;

export const DEFAULT_PLACE = { lat: 40.4, lon: -3.7 };

// Instante (ms UTC) y hora local mostrada. event.date trae la zona: "2027-06-12T18:00:00+02:00".
export function skyMoment(iso) {
  const day = iso.slice(0, 10);
  const hh = +iso.slice(11, 13) || 0;
  const night = hh >= 22 || hh < 5;
  const clock = night ? iso.slice(11, 16) : "23:00";
  const zone = (iso.slice(19).match(/([+-]\d{2}):?(\d{2})|Z/) || [])[0];
  const local = `${day}T${clock}:00`;
  // Sin zona en el texto: la del navegador (los invitados suelen estar en la misma).
  const ms = new Date(zone ? local + (zone === "Z" ? "Z" : zone.replace(/^([+-]\d{2})(\d{2})$/, "$1:$2")) : local).getTime();
  return { ms, clock };
}

// Tiempo sidéreo local (grados) para un instante y una longitud (este positiva).
export function localSidereal(ms, lon) {
  const d = ms / 864e5 + 2440587.5 - 2451545.0; // días desde J2000.0
  const T = d / 36525;
  return norm(280.46061837 + 360.98564736629 * d + 0.000387933 * T * T + lon);
}

// Ecuatoriales → horizontales. az desde el norte, hacia el este.
export function horizontal(ra, dec, lst, lat) {
  const H = lst - ra;
  const sinAlt = sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(H);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt))) / RAD;
  const az = norm(Math.atan2(-cos(dec) * sin(H), sin(dec) * cos(lat) - cos(dec) * sin(lat) * cos(H)) / RAD);
  return { alt, az };
}

// Sol y Luna, fórmulas de baja precisión del Astronomical Almanac (error < 0,3°).
function sunMoon(ms) {
  const d = ms / 864e5 + 2440587.5 - 2451545.0;
  const T = d / 36525;
  const g = norm(357.528 + 0.9856003 * d);
  const sunLon = norm(280.46 + 0.9856474 * d + 1.915 * sin(g) + 0.02 * sin(2 * g));
  const moonLon = norm(218.32 + 481267.881 * T
    + 6.29 * sin(135.0 + 477198.87 * T) - 1.27 * sin(259.3 - 413335.36 * T)
    + 0.66 * sin(235.7 + 890534.22 * T) + 0.21 * sin(269.9 + 954397.74 * T)
    - 0.19 * sin(357.5 + 35999.05 * T) - 0.11 * sin(186.5 + 966404.03 * T));
  const moonLat = 5.13 * sin(93.3 + 483202.02 * T) + 0.28 * sin(228.2 + 960400.89 * T)
    - 0.28 * sin(318.3 + 6003.15 * T) - 0.17 * sin(217.6 - 407332.21 * T);
  const eps = 23.439 - 0.0000004 * d;
  const eq = (l, b) => ({
    ra: norm(Math.atan2(sin(l) * cos(eps) - Math.tan(b * RAD) * sin(eps), cos(l)) / RAD),
    dec: Math.asin(sin(b) * cos(eps) + cos(b) * sin(eps) * sin(l)) / RAD,
  });
  const elong = norm(moonLon - sunLon); // 0 nueva, 180 llena
  return { sun: eq(sunLon, 0), moon: eq(moonLon, moonLat), lit: (1 - cos(elong)) / 2, waxing: elong < 180 };
}

// Proyección estereográfica azimutal: cénit en el centro, horizonte en el radio R.
// Mapa para mirarlo "hacia arriba": norte arriba, este a la izquierda.
const R = 420;
function project({ alt, az }) {
  const r = R * Math.tan(((90 - alt) / 2) * RAD);
  return [-r * sin(az), -r * cos(az)];
}

const f = (n) => n.toFixed(1);

// Coordenadas legibles: 40° 2′ N · 3° 36′ O
export function coords(lat, lon) {
  const dm = (v) => {
    let deg = Math.floor(Math.abs(v)), min = Math.round((Math.abs(v) - deg) * 60);
    if (min === 60) { deg += 1; min = 0; }
    return `${deg}° ${min}′`;
  };
  return `${dm(lat)} ${lat >= 0 ? "N" : "S"} · ${dm(lon)} ${lon >= 0 ? "E" : "O"}`;
}

export function place(venue = {}) {
  const lat = Number.parseFloat(venue.lat), lon = Number.parseFloat(venue.lon);
  const ok = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  return ok ? { lat, lon, known: true } : { ...DEFAULT_PLACE, known: false };
}

// SVG del mapa. label: texto alternativo. Los retrasos de la entrada van en --t (segundos).
export function skyMap({ event, venue }, { label = "" } = {}) {
  const { lat, lon } = place(venue);
  const { ms } = skyMoment(event.date);
  const lst = localSidereal(ms, lon);

  const pos = new Map();
  for (const s of STARS) pos.set(s.key, { ...s, ...horizontal(s.ra, s.dec, lst, lat) });
  const up = [...pos.values()].filter((s) => s.alt > -0.5).sort((a, b) => a.mag - b.mag);

  // Estrellas: aparecen de la más brillante a la más débil en ~1,5 s.
  const n = up.length;
  const stars = up.map((s, i) => {
    const [x, y] = project(s);
    s.xy = [x, y];
    const r = Math.max(1.5, 0.9 + 1.12 * (4.7 - s.mag));
    const o = Math.min(1, 0.5 + (4.7 - s.mag) * 0.17);
    const t = 0.35 + (i / Math.max(1, n - 1)) * 1.35;
    const glow = s.mag < 1.3 ? `<circle class="sky__halo" r="${f(r * 3.2)}"/>` : "";
    return `<g class="sky__star${glow ? " is-bright" : ""}" transform="translate(${f(x)} ${f(y)})" style="--t:${t.toFixed(2)}s;--o:${o.toFixed(2)}">${glow}<circle r="${f(r)}"/></g>`;
  }).join("");

  // Figuras: cada trazo se dibuja cuando ya están sus estrellas (1,3 s → 2,4 s).
  const segs = [];
  for (const chain of FIGURES) {
    const keys = chain.split(" ");
    for (let i = 1; i < keys.length; i++) {
      const a = pos.get(keys[i - 1]), b = pos.get(keys[i]);
      if (!a || !b || (a.alt < 0 && b.alt < 0) || a.alt < -25 || b.alt < -25) continue;
      segs.push([a, b]);
    }
  }
  const lines = segs.map(([a, b], i) => {
    const [x1, y1] = project(a), [x2, y2] = project(b);
    const t = 1.25 + (i / Math.max(1, segs.length - 1)) * 0.95;
    return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" pathLength="1" style="--t:${t.toFixed(2)}s"/>`;
  }).join("");

  // Luna, con su fase y el lado iluminado mirando al Sol.
  let moon = "";
  const sm = sunMoon(ms);
  const m = horizontal(sm.moon.ra, sm.moon.dec, lst, lat);
  m.alt -= 0.95 * cos(m.alt); // paralaje: desde la superficie se ve algo más baja
  if (m.alt > 1) {
    const [mx, my] = project(m);
    // Dirección hacia el Sol: un paso de 2° por el círculo máximo Luna → Sol, proyectado.
    const toXYZ = ({ ra, dec }) => [cos(dec) * cos(ra), cos(dec) * sin(ra), sin(dec)];
    const A = toXYZ(sm.moon), B = toXYZ(sm.sun);
    const dot = A[0] * B[0] + A[1] * B[1] + A[2] * B[2];
    const P = B.map((v, k) => v - dot * A[k]);
    const len = Math.hypot(...P) || 1;
    const S = A.map((v, k) => v * cos(2) + (P[k] / len) * sin(2));
    const step = { ra: norm(Math.atan2(S[1], S[0]) / RAD), dec: Math.asin(S[2]) / RAD };
    const [sx, sy] = project(horizontal(step.ra, step.dec, lst, lat));
    const ang = Math.atan2(sy - my, sx - mx) / RAD;
    const r = 13;
    const rx = Math.abs(1 - 2 * sm.lit) * r;
    const lit = sm.lit < 0.03 ? "" : sm.lit > 0.97
      ? `<circle r="${r}"/>`
      : `<path d="M0 ${-r} A${r} ${r} 0 0 1 0 ${r} A${f(rx)} ${r} 0 0 ${sm.lit > 0.5 ? 1 : 0} 0 ${-r}Z"/>`;
    moon = `<g class="sky__moon" transform="translate(${f(mx)} ${f(my)})" style="--t:1.6s">
      <circle class="sky__moon-halo" r="${r * 3}"/><circle class="sky__moon-dark" r="${r}"/>
      <g transform="rotate(${f(ang)})">${lit}</g>
      <text class="sky__label" x="0" y="${r + 30}" text-anchor="middle">Luna</text></g>`;
  }

  // Nombres de las estrellas más brillantes, sin que se pisen.
  const boxes = [];
  if (moon) { const [mx, my] = project(m); boxes.push([mx - 50, my - 22, mx + 50, my + 52]); }
  for (const s of up) if (s.mag < 2.2) { const [x, y] = s.xy; boxes.push([x - 7, y - 7, x + 7, y + 7]); }
  const named = up.filter((s) => s.name && s.alt > 6 && (s.mag < 1.45 || s.key === "aUMi")).slice(0, 12);
  const labels = named.map((s) => {
    const [x, y] = s.xy;
    const w = s.name.length * 12.2 + 6, h = 26, off = 13 + Math.max(0, 4.7 - s.mag) * 1.6;
    for (const [dx, anchor] of [[off, "start"], [-off, "end"]]) {
      const x0 = anchor === "start" ? x + dx : x + dx - w;
      const box = [x0, y - h + 8, x0 + w, y + 8];
      const inside = [[box[0], box[1]], [box[2], box[1]], [box[0], box[3]], [box[2], box[3]]].every(([px, py]) => Math.hypot(px, py) < R - 10);
      if (!inside || boxes.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
      boxes.push(box);
      return `<text class="sky__label" x="${f(x + dx)}" y="${f(y + 8)}" text-anchor="${anchor}">${esc(s.name)}</text>`;
    }
    return "";
  }).join("");

  // Esfera: doble círculo con marcas cada 5° y puntos cardinales (N arriba, E a la izquierda).
  const ticks = [];
  for (let a = 0; a < 360; a += 5) {
    const long = a % 45 === 0, mid = a % 15 === 0;
    const r1 = R + 10, r2 = R + (long ? 28 : mid ? 22 : 17);
    ticks.push(`M${f(-r1 * sin(a))} ${f(-r1 * cos(a))}L${f(-r2 * sin(a))} ${f(-r2 * cos(a))}`);
  }
  const cards = [["N", 0], ["E", 90], ["S", 180], ["O", 270]].map(([t, a]) => {
    const r = R + 54;
    return `<text class="sky__card" x="${f(-r * sin(a))}" y="${f(-r * cos(a) + 10)}" text-anchor="middle">${t}</text>`;
  }).join("");
  const alt = (h) => R * Math.tan(((90 - h) / 2) * RAD);

  return `
  <svg class="sky" viewBox="-500 -500 1000 1000" ${label ? `role="img" aria-label="${esc(label)}"` : `aria-hidden="true"`} focusable="false">
    <defs>
      <clipPath id="sky-clip"><circle r="${R}"/></clipPath>
      <radialGradient id="sky-bg"><stop offset="0" stop-color="#16213A"/><stop offset=".75" stop-color="#101A2E"/><stop offset="1" stop-color="#0D1424"/></radialGradient>
      <radialGradient id="sky-glow"><stop offset="0" stop-color="#F3E2B8" stop-opacity=".5"/><stop offset=".3" stop-color="#D8B46A" stop-opacity=".16"/><stop offset="1" stop-color="#D8B46A" stop-opacity="0"/></radialGradient>
    </defs>
    <g class="sky__frame">
      <circle class="sky__disc" r="${R}" fill="url(#sky-bg)"/>
      <circle class="sky__grid" r="${f(alt(30))}"/><circle class="sky__grid" r="${f(alt(60))}"/>
      <path class="sky__grid" d="M-6 0H6M0 -6V6"/>
      <circle class="sky__ring" r="${R}" pathLength="1"/>
      <circle class="sky__ring sky__ring--out" r="${R + 34}" pathLength="1"/>
      <path class="sky__ticks" d="${ticks.join("")}"/>
      ${cards}
    </g>
    <g clip-path="url(#sky-clip)">
      <g class="sky__lines">${lines}</g>
      <g class="sky__stars">${stars}</g>
      ${moon}
      <g class="sky__labels">${labels}</g>
    </g>
  </svg>`;
}
