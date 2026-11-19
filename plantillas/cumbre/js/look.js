import { dateParts, esc } from "./format.js";

// Cumbre: boda en la montaña. Cielo de amanecer, cordilleras en capas que se mueven a distinta
// velocidad al bajar y vuestra foto como un sol que sale detrás de las cimas. Curvas de nivel
// de mapa topográfico como fondo y un sendero con hitos para el programa.

// Perfil de una cordillera (0-1440 de ancho, 0-200 de alto), siempre igual para la misma semilla.
function ridge(seed, base, amp, peaks) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pts = [];
  const step = 1440 / peaks;
  for (let i = 0; i <= peaks; i++) {
    pts.push([i * step + (i && i < peaks ? (rnd() - .5) * step * .3 : 0), base - amp * (.45 + rnd() * .55)]);
    if (i < peaks) pts.push([i * step + step * (.4 + rnd() * .2), base - amp * (.05 + rnd() * .3)]);
  }
  // Laderas casi rectas con pequeños resaltes de roca: perfil de montaña, ni sierra ni ola.
  let d = `M0 200L${pts[0][0].toFixed(0)} ${pts[0][1].toFixed(0)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    for (let k = 1; k <= 6; k++) {
      const f = k / 6, jitter = k < 6 ? (rnd() - .5) * amp * .07 : 0;
      d += `L${(x1 + (x2 - x1) * f).toFixed(0)} ${(y1 + (y2 - y1) * f + jitter).toFixed(1)}`;
    }
  }
  return d + "L1440 200Z";
}

const RIDGES = [ridge(7, 130, 120, 4), ridge(13, 155, 90, 5), ridge(29, 178, 64, 6), ridge(41, 196, 34, 7)];

export const ridges = (cls = "") => `<svg class="ridges ${cls}" viewBox="0 0 1440 200" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  ${RIDGES.map((d, i) => `<path class="ridge ridge--${i}" data-depth="${i}" d="${d}"/>`).join("")}
</svg>`;

// Curvas de nivel: anillos irregulares concéntricos.
export function contours(seed = 3, cls = "") {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const bumps = Array.from({ length: 7 }, () => rnd() * 2 * Math.PI);
  const rings = [];
  for (let r = 30; r <= 300; r += 24) {
    const pts = [];
    for (let a = 0; a < 360; a += 10) {
      const t = (a * Math.PI) / 180;
      const k = 1 + bumps.reduce((acc, ph, j) => acc + Math.sin(t * (j + 2) + ph) * (.06 / (j + 1)), 0) * (1 + r / 200);
      pts.push([300 + Math.cos(t) * r * k * 1.25, 300 + Math.sin(t) * r * k]);
    }
    rings.push(`<path d="M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z"/>`);
  }
  return `<svg class="contours ${cls}" viewBox="0 0 600 600" aria-hidden="true" focusable="false">${rings.join("")}</svg>`;
}

const peak = `<svg class="peak" viewBox="0 0 24 14" aria-hidden="true" focusable="false"><path d="M1 13L9 3l4 5 3-3 7 8"/></svg>`;

export function head({ eyebrow, title, id, text }) {
  return `
      <header class="head">
        ${eyebrow ? `<p class="eyebrow head__eyebrow reveal">${peak}<span>${esc(eyebrow)}</span></p>` : ""}
        ${title ? `<h2 class="head__title reveal" id="${id}">${esc(title)}</h2>` : ""}
        ${text ? `<p class="head__text reveal">${esc(text)}</p>` : ""}
      </header>`;
}

export function hero({ event, venue = {}, locale, copy = {} }) {
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const t = copy.hero || {};
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  const len = String(a).length + String(b).length + 3;
  const place = venue.city || venue.name || "";
  return `
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero__sky">
      <div class="hero__text">
        ${t.eyebrow ? `<p class="eyebrow hero__eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h1 class="hero__names" id="hero-title" style="--len:${len}">${esc(a)} <span class="amp">&amp;</span> ${esc(b)}</h1>
        <p class="hero__meta"><span>${esc(d.day)} · ${esc(d.month)} · ${esc(d.year)}</span>${place ? `<span>${esc(place)}${t.altitude ? ` · ${esc(t.altitude)}` : ""}</span>` : ""}</p>
      </div>
      <figure class="hero__sun"><img src="${esc(event.photo)}" alt="${esc(event.photoAlt || "")}"${focus} fetchpriority="high"></figure>
      ${ridges("hero__ridges")}
    </div>
  </section>`;
}

// Hitos del sendero; el último es la bandera de la cima.
export function mark(i, s, total) {
  if (i === total - 1) return `<svg class="flag" viewBox="0 0 20 24" aria-hidden="true" focusable="false"><path d="M4 23V2M4 3h12l-3 4 3 4H4"/></svg>`;
  return `<span class="cairn"></span>`;
}

export function closingTop() {
  return `${ridges("closing__ridges")}${contours(11, "closing__contours")}`;
}

// La historia sobre curvas de nivel.
export function afterFacts() {
  return "";
}
