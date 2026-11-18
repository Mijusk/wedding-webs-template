import { dateParts, esc } from "./format.js";

// Laca: chinoiserie de seda pintada. Rojo laca, verde jade y oro; la foto en una puerta de luna
// redonda con un aro dorado, una rama de ciruelo en flor con dos pájaros que la cruza y una greca
// de celosía que enmarca la portada y separa las secciones. Marcellus y Cormorant.

// Greca de celosía (un motivo de 24 que se repite)
export const fret = (cls = "", id = cls) => `<svg class="fret ${cls}" aria-hidden="true" focusable="false">
  <defs><pattern id="fret-${id}" width="24" height="16" patternUnits="userSpaceOnUse">
    <path d="M0 15H6V1H18V11H10V5H14V7" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="square"/>
    <path d="M18 15H24" fill="none" stroke="currentColor" stroke-width="1.3"/>
  </pattern></defs>
  <rect width="100%" height="100%" fill="url(#fret-${id})"/>
</svg>`;

const blossom = (x, y, r = 6, rot = 0) => `<g class="blossom" transform="translate(${x} ${y}) rotate(${rot})">${[0, 72, 144, 216, 288].map((a) => `<ellipse rx="${r * .55}" ry="${r}" transform="rotate(${a}) translate(0 ${-r * .9})"/>`).join("")}<circle class="blossom__c" r="${r * .38}"/></g>`;

// Rama de ciruelo con dos pájaros
const branch = `<svg class="branch" viewBox="0 0 420 200" aria-hidden="true" focusable="false">
  <path class="branch__wood" d="M-10 170C60 150 110 120 160 118C210 116 250 92 300 60C330 40 370 30 430 34" />
  <path class="branch__wood branch__wood--thin" d="M160 118C175 95 172 70 190 50" />
  <path class="branch__wood branch__wood--thin" d="M250 92C268 104 290 118 322 120" />
  <path class="branch__wood branch__wood--thin" d="M80 150C90 170 110 178 128 182" />
  ${blossom(190, 48, 8, 10)}${blossom(322, 120, 7, 30)}${blossom(128, 182, 6, 0)}${blossom(300, 60, 9, -12)}${blossom(60, 160, 6, 20)}${blossom(380, 33, 7, 5)}
  <circle class="bud" cx="214" cy="104" r="3.4"/><circle class="bud" cx="236" cy="96" r="2.6"/><circle class="bud" cx="350" cy="44" r="3"/>
  <g class="bird" transform="translate(232 80) scale(.9)"><path d="M0 0C6-14 22-18 34-12C40-18 48-18 52-14C46-12 44-8 44-4C40 6 26 10 12 8C6 12-6 14-14 12C-6 8-2 4 0 0Z"/><circle class="bird__eye" cx="45" cy="-11" r="1.4"/></g>
  <g class="bird" transform="translate(110 120) scale(-.7 .7)"><path d="M0 0C6-14 22-18 34-12C40-18 48-18 52-14C46-12 44-8 44-4C40 6 26 10 12 8C6 12-6 14-14 12C-6 8-2 4 0 0Z"/><circle class="bird__eye" cx="45" cy="-11" r="1.4"/></g>
</svg>`;

export function head({ eyebrow, title, id, text }) {
  return `
      <header class="head">
        ${eyebrow ? `<p class="eyebrow head__eyebrow reveal">${esc(eyebrow)}</p>` : ""}
        ${title ? `<h2 class="head__title reveal" id="${id}">${esc(title)}</h2>` : ""}
        <span class="head__knot reveal" aria-hidden="true"><i></i><b></b><i></i></span>
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
    ${fret("hero__fret", "top")}
    <div class="hero__in">
      <div class="moon">
        <figure class="moon__photo"><img src="${esc(event.photo)}" alt="${esc(event.photoAlt || "")}"${focus} fetchpriority="high"></figure>
        ${branch}
      </div>
      <div class="hero__text" style="--len:${len}">
        ${t.eyebrow ? `<p class="eyebrow hero__eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h1 class="hero__names" id="hero-title"><span>${esc(a)}</span><span class="amp">&amp;</span><span>${esc(b)}</span></h1>
        <p class="hero__date">${esc(d.day)} · ${esc(d.month)} · ${esc(d.year)}</p>
        ${place ? `<p class="hero__place">${esc(place)}</p>` : ""}
        ${event.tagline ? `<p class="hero__tagline">${esc(event.tagline)}</p>` : ""}
      </div>
    </div>
    ${fret("hero__fret hero__fret--bottom", "bottom")}
  </section>`;
}

export function mark(i, s, total) {
  return `<span class="lantern${i === total - 1 ? " lantern--last" : ""}"><i></i></span>`;
}

export function closingTop() {
  return fret("closing__fret");
}
