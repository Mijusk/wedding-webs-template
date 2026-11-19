import { dateParts, esc } from "./format.js";

// Festón: el borde ondulado de la vajilla antigua, los manteles y las tartas de boda. Salvia y
// crema; la foto recortada con festón, la fecha en un sello festoneado y las secciones de color
// con el borde en ondas. Young Serif, redonda y amable, para los títulos; Mulish para el resto.

export function head({ eyebrow, title, id, text }) {
  return `
      <header class="head">
        ${eyebrow ? `<p class="eyebrow head__eyebrow reveal">${esc(eyebrow)}</p>` : ""}
        ${title ? `<h2 class="head__title reveal" id="${id}">${esc(title)}</h2>` : ""}
        <span class="head__scallops reveal" aria-hidden="true"></span>
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
    <div class="hero__in" style="--len:${len}">
      <figure class="hero__photo scallop"><img src="${esc(event.photo)}" alt="${esc(event.photoAlt || "")}"${focus} fetchpriority="high"></figure>
      <p class="seal" aria-hidden="true"><span class="seal__day">${esc(d.day)}</span><span class="seal__month">${esc(d.month)}</span><span class="seal__year">${esc(d.year)}</span></p>
      ${t.eyebrow ? `<p class="eyebrow hero__eyebrow">${esc(t.eyebrow)}</p>` : ""}
      <h1 class="hero__names" id="hero-title"><span>${esc(a)}</span> <span class="amp">&amp;</span> <span>${esc(b)}</span></h1>
      <p class="hero__date">${esc(d.day)} · ${esc(d.month)} · ${esc(d.year)}${place ? ` · ${esc(place)}` : ""}</p>
      ${event.tagline ? `<p class="hero__tagline">${esc(event.tagline)}</p>` : ""}
    </div>
  </section>`;
}

export function mark(i, s, total) {
  return `<span class="dot-scallop${i === total - 1 ? " dot-scallop--last" : ""}"></span>`;
}

export function photo(src, alt) {
  return `<span class="scallop scallop--sm"><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy"></span>`;
}
