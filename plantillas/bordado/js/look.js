import { dateParts, esc } from "./format.js";

// Bordado: un bastidor de madera con vuestras iniciales bordadas en hilo y una corona de
// flores a punto de margarita. Fondo de lino, pespuntes en lugar de líneas y un corazón a
// punto de cruz para cerrar. Artesanal, delicada y nada recargada.

const initial = (s) => String(s || "").trim().charAt(0).toUpperCase();

// Corona de flores bordadas alrededor del aro (coordenadas en un círculo de 200 x 200).
function wreath() {
  const out = [];
  const flowers = [200, 228, 256, 284, 312, 340, 20, 48, 76, 104, 132, 160];
  flowers.forEach((deg, i) => {
    const r = 77, rad = (deg * Math.PI) / 180;
    const x = 100 + r * Math.cos(rad), y = 100 + r * Math.sin(rad);
    const small = i % 2 === 1;
    if (small) {
      // hojitas a punto atrás
      out.push(`<path class="w-leaf" style="--i:${i}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg + 90})" d="M-7 0C-3-5 3-5 7 0C3 5-3 5-7 0z"/>`);
    } else {
      const petals = Array.from({ length: 5 }, (_, p) => `<ellipse class="w-petal" rx="2.4" ry="5" transform="rotate(${p * 72}) translate(0 -5.2)"/>`).join("");
      out.push(`<g class="w-flower w-flower--${i % 3}" style="--i:${i}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">${petals}<circle class="w-knot" r="1.9"/></g>`);
    }
  });
  return out.join("");
}

export function hoop(a, b, cls = "") {
  return `<svg class="hoop ${cls}" viewBox="0 0 200 222" aria-hidden="true" focusable="false">
    <defs>
      <pattern id="satin" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><rect width="3" height="3" class="satin__bg"/><path d="M0 1.5H3" class="satin__line"/></pattern>
      <radialGradient id="cloth" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#FBF7EF"/><stop offset="1" stop-color="#EDE4D3"/></radialGradient>
    </defs>
    <rect class="hoop__screw" x="92" y="2" width="16" height="16" rx="3"/>
    <rect class="hoop__clasp" x="86" y="14" width="28" height="10" rx="2"/>
    <circle class="hoop__wood" cx="100" cy="122" r="97"/>
    <circle class="hoop__cloth" cx="100" cy="122" r="89" fill="url(#cloth)"/>
    <circle class="hoop__inner" cx="100" cy="122" r="89"/>
    <g transform="translate(0 22)">
      <g class="w">${wreath()}</g>
      <text class="hoop__initials" x="100" y="116" text-anchor="middle">${esc(initial(a))}<tspan class="hoop__amp" dx="2" dy="-4">&amp;</tspan><tspan dx="2" dy="4">${esc(initial(b))}</tspan></text>
    </g>
  </svg>`;
}

// Línea de pespunte con un nudo en el centro.
const stitch = `<span class="stitch" aria-hidden="true"></span>`;

export function head({ eyebrow, title, id, text }) {
  return `
      <header class="head">
        ${eyebrow ? `<p class="eyebrow head__eyebrow reveal">${stitch}<span>${esc(eyebrow)}</span>${stitch}</p>` : ""}
        ${title ? `<h2 class="head__title reveal" id="${id}">${esc(title)}</h2>` : ""}
        ${text ? `<p class="head__text reveal">${esc(text)}</p>` : ""}
      </header>`;
}

export function hero({ event, venue = {}, locale, copy = {} }) {
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const t = copy.hero || {};
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  const len = Math.max(String(a).length, String(b).length, 5);
  const place = venue.city || venue.name || "";
  return `
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero__in">
      <div class="hero__text" style="--len:${len}">
        ${hoop(a, b, "hero__hoop")}
        ${t.eyebrow ? `<p class="eyebrow hero__eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h1 class="hero__names" id="hero-title"><span>${esc(a)}</span> <span class="amp">y</span> <span>${esc(b)}</span></h1>
        <p class="hero__date">${esc(d.day)} · ${esc(d.month)} · ${esc(d.year)}</p>
        ${place ? `<p class="hero__place">${esc(place)}</p>` : ""}
      </div>
      <figure class="hero__photo"><img src="${esc(event.photo)}" alt="${esc(event.photoAlt || "")}"${focus} fetchpriority="high"></figure>
    </div>
  </section>`;
}

// Punto de cruz: una X de hilo, cada momento en un color de la madeja.
export function mark(i) {
  return `<svg class="xst xst--${i % 3}" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 3l10 10M13 3L3 13"/></svg>`;
}

// Corazón a punto de cruz (9 x 8).
const HEART = ["011000110", "111101111", "111111111", "111111111", "011111110", "001111100", "000111000", "000010000"];
export function closingTop() {
  const cells = HEART.flatMap((row, y) => [...row].map((c, x) => (c === "1" ? `<path style="--i:${y * 9 + x}" d="M${x * 10 + 2} ${y * 10 + 2}l6 6M${x * 10 + 8} ${y * 10 + 2}l-6 6"/>` : ""))).join("");
  return `<svg class="heart reveal" viewBox="0 0 90 80" aria-hidden="true" focusable="false">${cells}</svg>`;
}
