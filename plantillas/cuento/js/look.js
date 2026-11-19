import { dateParts, esc } from "./format.js";

// Cuento: la invitación es un libro antiguo con tapa de tela verde y letras doradas.
// Al entrar la tapa se abre y aparece la portadilla con la foto. Cada sección es un capítulo
// numerado, con letra capital y número de página.

const roman = (n) => ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][n] || String(n);

// Florón (hoja de hiedra) para separar.
export const fleuron = (cls = "") => `<svg class="fleuron ${cls}" viewBox="0 0 60 16" aria-hidden="true" focusable="false">
  <path d="M2 8h18M40 8h18"/><path class="fleuron__leaf" d="M30 2c-5 0-8 3-8 6s3 6 8 6c-2-2-3-4-3-6s1-4 3-6zM30 2c5 0 8 3 8 6s-3 6-8 6c2-2 3-4 3-6s-1-4-3-6z"/>
</svg>`;

// Esquina del marco dorado de la tapa.
const corner = (cls) => `<svg class="corner ${cls}" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><path d="M2 38V2h36M8 32V8h24M2 2l6 6M14 2c0 7 5 12 12 12M2 14c7 0 12 5 12 12"/></svg>`;

export function head({ eyebrow, title, id, text, n }) {
  return `
      <header class="head">
        ${eyebrow ? `<p class="eyebrow head__eyebrow reveal">${esc(eyebrow)} ${roman(n)}</p>` : ""}
        ${title ? `<h2 class="head__title reveal" id="${id}">${esc(title)}</h2>` : ""}
        ${fleuron("head__fleuron reveal")}
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
  <section class="hero" aria-labelledby="hero-title" style="--len:${len}">
    <div class="page">
      <div class="page__in">
        ${t.eyebrow ? `<p class="page__eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h1 class="page__names" id="hero-title"><span>${esc(a)}</span> <span class="amp">&amp;</span> <span>${esc(b)}</span></h1>
        ${fleuron("page__fleuron")}
        <figure class="page__photo"><img src="${esc(event.photo)}" alt="${esc(event.photoAlt || "")}"${focus} fetchpriority="high"></figure>
        ${event.tagline ? `<p class="page__tagline">${esc(event.tagline)}</p>` : ""}
        <p class="page__imprint">${place ? `${esc(place)} · ` : ""}${esc(d.day)} de ${esc(d.month)} de ${esc(d.year)}</p>
      </div>
    </div>
    <div class="cover" aria-hidden="true">
      <div class="cover__face">
        <div class="cover__frame">
          ${corner("corner--tl")}${corner("corner--tr")}${corner("corner--bl")}${corner("corner--br")}
          ${t.eyebrow ? `<p class="cover__eyebrow">${esc(t.eyebrow)}</p>` : ""}
          <p class="cover__names"><span>${esc(a)}</span><span class="amp">&amp;</span><span>${esc(b)}</span></p>
          ${fleuron("cover__fleuron")}
          <p class="cover__volume">${t.volume ? `${esc(t.volume)} · ` : ""}${esc(d.year)}</p>
        </div>
      </div>
      <div class="cover__back"></div>
    </div>
  </section>`;
}

export function closingTop({ copy = {} }) {
  const t = copy.closing || {};
  return t.end ? `<p class="closing__end reveal" aria-hidden="true">${esc(t.end)}</p>${fleuron("closing__fleuron reveal")}` : "";
}
