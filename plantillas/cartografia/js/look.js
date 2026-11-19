import { dateParts, esc } from "./format.js";

// Cartografía: la invitación es una carta náutica antigua. Papel envejecido con meridianos,
// tinta sepia y rojo de imprenta. Rosa de los vientos que busca el norte al entrar, las
// coordenadas reales del lugar (venue.lat / venue.lon) y un itinerario que se traza al bajar.

// 40.0331 -> 40° 1′ 59″ N. Sin coordenadas, no se pinta.
export function coords(venue = {}) {
  if (typeof venue.lat !== "number" || typeof venue.lon !== "number") return "";
  const dms = (v, pos, neg) => {
    const a = Math.abs(v), d = Math.floor(a), m = Math.floor((a - d) * 60), s = Math.round(((a - d) * 60 - m) * 60);
    return `${d}° ${m}′ ${s}″ ${v >= 0 ? pos : neg}`;
  };
  return `${dms(venue.lat, "N", "S")} · ${dms(venue.lon, "E", "O")}`;
}

// Rosa de los vientos: 8 puntas, la del norte en rojo, con aguja que gira.
const rose = (cls = "") => {
  const big = [0, 90, 180, 270].map((r) => `<path class="rose__pt${r === 0 ? " rose__pt--n" : ""}" transform="rotate(${r} 60 60)" d="M60 6L67 53 60 60z"/><path class="rose__pt rose__pt--shade" transform="rotate(${r} 60 60)" d="M60 6L53 53 60 60z"/>`).join("");
  const small = [45, 135, 225, 315].map((r) => `<path class="rose__pt rose__pt--small" transform="rotate(${r} 60 60)" d="M60 22L64 56 60 60 56 56z"/>`).join("");
  const ticks = Array.from({ length: 32 }, (_, i) => `<path class="rose__tick" transform="rotate(${i * 11.25} 60 60)" d="M60 ${i % 4 ? 2.5 : 0.5}V5.5"/>`).join("");
  return `<svg class="rose ${cls}" viewBox="-4 -14 128 138" aria-hidden="true" focusable="false">
    <circle class="rose__ring" cx="60" cy="60" r="58"/><circle class="rose__ring" cx="60" cy="60" r="54"/>
    ${ticks}
    <g class="rose__needle">${small}${big}<circle class="rose__hub" cx="60" cy="60" r="3"/></g>
    <text class="rose__n" x="60" y="-4" text-anchor="middle">N</text>
  </svg>`;
};

const star = `<svg class="star" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 0l2 8 8 2-8 2-2 8-2-8-8-2 8-2z"/></svg>`;

export function head({ eyebrow, title, id, text }) {
  return `
      <header class="head">
        ${eyebrow ? `<p class="eyebrow head__eyebrow reveal"><span class="head__rule"></span>${star}<span>${esc(eyebrow)}</span>${star}<span class="head__rule"></span></p>` : ""}
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
  const where = coords(venue);
  return `
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero__grid" aria-hidden="true"></div>
    <div class="hero__in">
      <div class="cartouche" style="--len:${len}">
        ${t.eyebrow ? `<p class="cartouche__eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h1 class="cartouche__names" id="hero-title">
          <span>${esc(a)}</span>
          <span class="amp">&amp;</span>
          <span>${esc(b)}</span>
        </h1>
        <p class="cartouche__date">${esc(d.day)} de ${esc(d.month)} de ${esc(d.year)}</p>
        ${place ? `<p class="cartouche__place">${esc(place)}</p>` : ""}
        ${where ? `<p class="cartouche__coords">${esc(where)}</p>` : ""}
      </div>
      ${rose("hero__rose")}
      <figure class="hero__photo">
        <img src="${esc(event.photo)}" alt="${esc(event.photoAlt || "")}"${focus} fetchpriority="high">
        ${place ? `<figcaption>Lám. I · ${esc(place)}</figcaption>` : ""}
      </figure>
    </div>
    <svg class="hero__route" viewBox="0 0 1000 80" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path pathLength="1" d="M0 60C140 20 260 70 400 44S640 8 760 40 920 66 1000 30"/>
    </svg>
  </section>`;
}

// Marcas del itinerario: puntos numerados y una cruz en el destino final.
const roman = (n) => ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][n] || String(n + 1);
export function mark(i, s, total) {
  if (i === total - 1) return `<span class="stop stop--x"><svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M4 4l12 12M16 4L4 16"/></svg></span>`;
  return `<span class="stop">${roman(i)}</span>`;
}

export function closingTop() {
  return `<div class="closing__rose reveal" aria-hidden="true">${rose()}</div>`;
}

export function closingBottom({ copy = {}, venue = {} }) {
  const t = copy.hero || {};
  const where = coords(venue);
  return `<div class="wrap closing__legend reveal">
    ${t.scale ? `<p class="scale"><span class="scale__bar" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>${esc(t.scale)}</span></p>` : ""}
    ${where ? `<p class="closing__coords">${esc(where)}</p>` : ""}
  </div>`;
}
