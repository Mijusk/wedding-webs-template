import { dateParts, esc } from "./format.js";

// Riviera: verano en la costa, con aire de cartel de viajes de los años cincuenta. Toldo de rayas
// azul marino y crema con el borde festoneado, la foto como un cartel enmarcado, nombres en una
// serif de cartel y salvavidas como marcas del programa. DM Serif Display y Josefin Sans.

const awning = (cls = "") => `<div class="awning ${cls}" aria-hidden="true"></div>`;

export function head({ eyebrow, title, id, text }) {
  return `
      <header class="head">
        ${eyebrow ? `<p class="eyebrow head__eyebrow reveal">${esc(eyebrow)}</p>` : ""}
        ${title ? `<h2 class="head__title reveal" id="${id}">${esc(title)}</h2>` : ""}
        <span class="head__wave reveal" aria-hidden="true"></span>
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
    ${awning("hero__awning")}
    <div class="hero__in">
      <figure class="poster">
        <img src="${esc(event.photo)}" alt="${esc(event.photoAlt || "")}"${focus} fetchpriority="high">
        ${place ? `<figcaption class="poster__place">${esc(place)}</figcaption>` : ""}
      </figure>
      <div class="hero__text" style="--len:${len}">
        ${t.eyebrow ? `<p class="eyebrow hero__eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h1 class="hero__names" id="hero-title"><span>${esc(a)}</span><span class="amp">&amp;</span><span>${esc(b)}</span></h1>
        <p class="hero__date"><span>${esc(d.day)}</span><span>${esc(d.month)}</span><span>${esc(d.year)}</span></p>
        ${event.tagline ? `<p class="hero__tagline">${esc(event.tagline)}</p>` : ""}
      </div>
    </div>
  </section>`;
}

export function mark(i, s, total) {
  return `<span class="buoy${i === total - 1 ? " buoy--last" : ""}"></span>`;
}

export function closingTop() {
  return awning("closing__awning");
}
