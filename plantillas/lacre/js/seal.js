import { esc } from "./format.js";

// Sello de lacre en SVG: una gota irregular de cera con la zona prensada por el sello,
// un cordón de puntos y las iniciales grabadas. La forma del borde sale de las iniciales,
// así cada pareja tiene "su" lacre y no cambia entre visitas.
let uid = 0;

function seedFrom(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) % 1000) / 1000;
}

function blobPath(rand, r = 90, n = 56) {
  const p = [rand() * 6.28, rand() * 6.28, rand() * 6.28, rand() * 6.28];
  const pts = Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    const k = 1 + 0.032 * Math.sin(3 * t + p[0]) + 0.024 * Math.sin(5 * t + p[1]) + 0.014 * Math.sin(9 * t + p[2]) + 0.008 * Math.sin(17 * t + p[3]);
    return [Math.cos(t) * r * k, Math.sin(t) * r * k];
  });
  // Catmull-Rom cerrado → curvas Bézier: borde blando, como la cera al enfriarse.
  const f = (v) => v.toFixed(1);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d}Z`;
}

export function initials([a = "", b = ""]) {
  const first = (s) => [...String(s).trim()][0]?.toLocaleUpperCase("es") || "";
  return [first(a), first(b)];
}

export function sealSvg(couple, cls = "") {
  const u = `s${++uid}`;
  const [x, y] = initials(couple);
  const d = blobPath(seedFrom(`${x}${y}`));
  const mono = `<tspan font-family="Cinzel, serif" font-weight="600">${esc(x)}</tspan><tspan font-family="'Pinyon Script', cursive" font-size="34" dx="3" dy="-2">&amp;</tspan><tspan font-family="Cinzel, serif" font-weight="600" dx="2" dy="2">${esc(y)}</tspan>`;
  return `
  <svg class="seal ${cls}" viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="${u}w" cx="36%" cy="30%" r="78%">
        <stop offset="0" stop-color="#a8394b"/><stop offset=".42" stop-color="#7a1f2b"/><stop offset=".82" stop-color="#5c1520"/><stop offset="1" stop-color="#480e17"/>
      </radialGradient>
      <radialGradient id="${u}p" cx="64%" cy="70%" r="72%">
        <stop offset="0" stop-color="#8e2a39"/><stop offset=".6" stop-color="#76202c"/><stop offset="1" stop-color="#5a1520"/>
      </radialGradient>
      <linearGradient id="${u}r" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#2a0409" stop-opacity=".7"/><stop offset=".5" stop-color="#2a0409" stop-opacity="0"/><stop offset="1" stop-color="#ffd9d9" stop-opacity=".45"/>
      </linearGradient>
      <radialGradient id="${u}g" cx="32%" cy="24%" r="40%">
        <stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <path d="${d}" fill="url(#${u}w)"/>
    <path d="${d}" fill="none" stroke="#ffd0d0" stroke-opacity=".16" stroke-width="1.4" transform="translate(-.8 -1) scale(.985)"/>
    <circle r="66" fill="url(#${u}p)"/>
    <circle r="66" fill="none" stroke="url(#${u}r)" stroke-width="3"/>
    <circle r="57" fill="none" stroke="#ffd9d9" stroke-opacity=".28" stroke-width="2.2" stroke-dasharray=".1 5.97" stroke-linecap="round" transform="translate(.7 .9)"/>
    <circle r="57" fill="none" stroke="#2a0409" stroke-opacity=".55" stroke-width="2.2" stroke-dasharray=".1 5.97" stroke-linecap="round"/>
    <text x="0" y="15" text-anchor="middle" font-size="42" fill="#ffd9d9" fill-opacity=".3" transform="translate(.8 1.2)">${mono}</text>
    <text x="0" y="15" text-anchor="middle" font-size="42" fill="#3e0911" fill-opacity=".82">${mono}</text>
    <ellipse cx="-30" cy="-46" rx="44" ry="26" fill="url(#${u}g)" transform="rotate(-28 -30 -46)"/>
  </svg>`;
}
