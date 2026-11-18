import { dateParts, esc } from "./format.js";

// Regencia: elegancia de época Regencia (la estética "Bridgerton"). Azul Wedgwood, crema,
// camafeo ovalado con borde de perlas para la foto, lazo de seda rosa empolvado, guirnaldas
// y relieves blancos sobre azul como la porcelana jasperware. Letra de pluma para los nombres.

// Guirnalda colgante (festón de flores) para los antetítulos.
const swag = `<svg class="swag" viewBox="0 0 120 20" aria-hidden="true" focusable="false"><path d="M2 3c18 20 38 20 58 0 20 20 40 20 58 0"/><circle cx="2" cy="3" r="2"/><circle cx="60" cy="3" r="2"/><circle cx="118" cy="3" r="2"/></svg>`;

// Lazo de seda sobre el camafeo.
const bow = `<svg class="bow" viewBox="0 0 120 70" aria-hidden="true" focusable="false">
  <path class="bow__tail" d="M56 34c-6 12-14 24-22 34l10-2 4 6c4-12 8-24 10-36zM64 34c6 12 14 24 22 34l-10-2-4 6c-4-12-8-24-10-36z"/>
  <path class="bow__loop" d="M58 30C44 10 18 4 10 16s8 28 48 18zM62 30C76 10 102 4 110 16s-8 28-48 18z"/>
  <ellipse class="bow__knot" cx="60" cy="31" rx="7" ry="8"/>
</svg>`;

// Borde de perlas del camafeo: puntos repartidos por la elipse.
function pearls(n = 64) {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return `<circle cx="${(100 + 96 * Math.cos(t)).toFixed(1)}" cy="${(130 + 126 * Math.sin(t)).toFixed(1)}" r="2.6"/>`;
  }).join("");
}

export function head({ eyebrow, title, id, text }) {
  return `
      <header class="head">
        ${eyebrow ? `<p class="eyebrow head__eyebrow reveal">${esc(eyebrow)}</p>` : ""}
        ${title ? `<h2 class="head__title reveal" id="${id}">${esc(title)}</h2>` : ""}
        <div class="head__swag reveal">${swag}</div>
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
      <div class="cameo">
        ${bow}
        <figure class="cameo__photo"><img src="${esc(event.photo)}" alt="${esc(event.photoAlt || "")}"${focus} fetchpriority="high"></figure>
        <svg class="cameo__pearls" viewBox="0 0 200 260" aria-hidden="true" focusable="false">${pearls()}</svg>
      </div>
      <div class="hero__text" style="--len:${len}">
        ${t.eyebrow ? `<p class="hero__eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h1 class="hero__names" id="hero-title"><span>${esc(a)}</span> <span class="amp">&amp;</span> <span>${esc(b)}</span></h1>
        ${event.tagline ? `<p class="hero__tagline">${esc(event.tagline)}</p>` : ""}
        <p class="hero__date"><span class="cap">${esc(d.weekday)}</span>, ${esc(d.day)} de ${esc(d.month)} de ${esc(d.year)}</p>
        ${place ? `<p class="hero__place">${esc(place)}</p>` : ""}
      </div>
    </div>
  </section>`;
}

// Marca del programa: una perla.
export function mark() {
  return `<span class="pearl"></span>`;
}

// Cierre en azul jasperware con una corona de laurel en relieve blanco.
export function closingTop() {
  const leaves = Array.from({ length: 9 }, (_, i) => {
    const a = 200 + i * 15;
    return `<path transform="rotate(${a} 60 60) translate(60 14)" d="M0 0c4-4 10-4 12 0-4 4-10 4-12 0z"/><path transform="rotate(${-a + 180 + 180} 60 60) translate(60 14)" d="M0 0c4-4 10-4 12 0-4 4-10 4-12 0z"/>`;
  }).join("");
  return `<svg class="laurel reveal" viewBox="0 0 120 120" aria-hidden="true" focusable="false">${leaves}</svg>`;
}
