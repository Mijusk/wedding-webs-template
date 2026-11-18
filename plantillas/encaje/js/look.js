import { dateParts, esc } from "./format.js";

// Encaje: alta costura nupcial. Puntilla de encaje con festones calados y ojales, marfil, rosa
// polvo y perlas. La foto se ve a través de un marco de encaje; tira de puntilla entre
// secciones. Letra caligráfica para los nombres y Cormorant para el resto.

// Tira de puntilla (un motivo de 40 de ancho que se repite): festón, ojales y una florecita.
export const lace = (cls = "") => `<svg class="lace ${cls}" aria-hidden="true" focusable="false">
  <defs><pattern id="lace-${cls}" width="40" height="34" patternUnits="userSpaceOnUse">
    <path class="lace__edge" d="M0 20a10 10 0 0 0 20 0a10 10 0 0 0 20 0"/>
    <path class="lace__edge" d="M0 14a10 10 0 0 0 20 0a10 10 0 0 0 20 0" opacity=".5"/>
    <circle class="lace__hole" cx="10" cy="22" r="2.2"/><circle class="lace__hole" cx="30" cy="22" r="2.2"/>
    <circle class="lace__dot" cx="20" cy="31" r="1.4"/><circle class="lace__dot" cx="0" cy="31" r="1.4"/><circle class="lace__dot" cx="40" cy="31" r="1.4"/>
    <g class="lace__flower" transform="translate(20 6)"><circle r="2.4"/><circle cx="-4" r="1.6"/><circle cx="4" r="1.6"/><circle cy="-4" r="1.6"/><circle cy="4" r="1.6"/></g>
    <path class="lace__line" d="M0 1H40"/>
  </pattern></defs>
  <rect width="100%" height="100%" fill="url(#lace-${cls})"/>
</svg>`;

export function head({ eyebrow, title, id, text }) {
  return `
      <header class="head">
        ${eyebrow ? `<p class="eyebrow head__eyebrow reveal">${esc(eyebrow)}</p>` : ""}
        ${title ? `<h2 class="head__title reveal" id="${id}">${esc(title)}</h2>` : ""}
        <p class="head__pearls reveal" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></p>
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
    <figure class="hero__photo"><img src="${esc(event.photo)}" alt="${esc(event.photoAlt || "")}"${focus} fetchpriority="high"></figure>
    ${lace("hero__lace")}
    <div class="hero__text" style="--len:${len}">
      ${t.eyebrow ? `<p class="eyebrow hero__eyebrow">${esc(t.eyebrow)}</p>` : ""}
      <h1 class="hero__names" id="hero-title"><span>${esc(a)}</span> <span class="amp">&amp;</span> <span>${esc(b)}</span></h1>
      <p class="hero__date">${esc(d.day)} · ${esc(d.month)} · ${esc(d.year)}</p>
      ${place ? `<p class="hero__place">${esc(place)}</p>` : ""}
      ${event.tagline ? `<p class="hero__tagline">${esc(event.tagline)}</p>` : ""}
    </div>
  </section>`;
}

export function mark() {
  return `<span class="pearl"></span>`;
}

export function closingTop() {
  return lace("closing__lace");
}
