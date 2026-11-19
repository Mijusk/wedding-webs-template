import { dateParts, esc } from "./format.js";

// Origami: papel plegado. Una grulla de papel (el símbolo de los mil deseos) se pliega al
// entrar, la foto es una tarjeta con la esquina doblada y cada sección se despliega como un
// papel al bajar. Blanco cálido, rosa empolvado, azul tinta y un filo de oro.

// Grulla: cada faceta es un polígono con su tono (luz, medio, sombra).
const CRANE = [
  ["l", "100,72 84,79 58,6"], ["s", "84,79 58,6 72,82"],
  ["m", "72,82 100,72 128,82 100,98"], ["s", "72,82 100,98 128,82 100,90"],
  ["s", "72,82 86,88 26,28"], ["s", "26,28 17,40 30,33"],
  ["m", "128,82 114,88 180,30"],
  ["l", "100,72 116,79 148,2"], ["m", "116,79 148,2 128,82"],
];
export const crane = (cls = "") => `<svg class="crane ${cls}" viewBox="0 0 200 120" aria-hidden="true" focusable="false">
  ${CRANE.map(([tone, pts], i) => `<polygon class="crane__f crane__f--${tone}" style="--i:${i}" points="${pts}"/>`).join("")}
</svg>`;

// Rombo de papel doblado por la mitad.
const fold = `<svg class="fold" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path class="fold__a" d="M8 0L16 8 8 16z"/><path class="fold__b" d="M8 0L0 8 8 16z"/></svg>`;

export function head({ eyebrow, title, id, text }) {
  return `
      <header class="head">
        ${eyebrow ? `<p class="eyebrow head__eyebrow reveal">${fold}<span>${esc(eyebrow)}</span></p>` : ""}
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
        ${crane("hero__crane")}
        ${t.eyebrow ? `<p class="eyebrow hero__eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h1 class="hero__names" id="hero-title"><span>${esc(a)}</span><span class="amp">&amp;</span><span>${esc(b)}</span></h1>
        <p class="hero__date">${esc(d.day)} · ${esc(d.month)} · ${esc(d.year)}</p>
        ${place ? `<p class="hero__place">${esc(place)}</p>` : ""}
      </div>
      <figure class="hero__photo"><img src="${esc(event.photo)}" alt="${esc(event.photoAlt || "")}"${focus} fetchpriority="high"><span class="hero__corner" aria-hidden="true"></span></figure>
    </div>
    ${event.tagline ? `<p class="hero__tagline">${esc(event.tagline)}</p>` : ""}
  </section>`;
}

export function mark(i) {
  return `<span class="pmark pmark--${i % 3}">${fold}</span>`;
}

// Guirnalda de grullas (senbazuru) colgando de hilos, cada una a su altura.
export function closingTop() {
  const drops = [46, 78, 30, 92, 58, 38, 70];
  return `<div class="garland reveal" aria-hidden="true">${drops.map((h, i) => `<span class="garland__thread" style="--h:${h}px;--i:${i}">${crane("garland__crane")}</span>`).join("")}</div>`;
}
