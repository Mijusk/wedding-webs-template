import { dateParts, esc } from "./format.js";

// Mármol: una inscripción en una losa de mármol de Carrara con filetes de oro, como el vestíbulo de
// un hotel clásico. La foto ocupa media portada con un filo de oro; el resto es la losa con los
// nombres en capitales romanas. El cierre es un Nero Marquina con vetas doradas. Cinzel y Cormorant.

export function head({ eyebrow, title, id, text }) {
  return `
      <header class="head">
        ${eyebrow ? `<p class="eyebrow head__eyebrow reveal">${esc(eyebrow)}</p>` : ""}
        ${title ? `<h2 class="head__title reveal" id="${id}">${esc(title)}</h2>` : ""}
        <span class="head__rule reveal" aria-hidden="true"><i></i><i></i><i></i></span>
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
    <div class="slab">
      <div class="slab__frame" style="--len:${len}">
        ${t.eyebrow ? `<p class="eyebrow hero__eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h1 class="hero__names" id="hero-title"><span>${esc(a)}</span><span class="amp">&amp;</span><span>${esc(b)}</span></h1>
        <p class="hero__date">${esc(d.day)} · ${esc(d.month)} · ${esc(d.year)}</p>
        ${place ? `<p class="hero__place">${esc(place)}</p>` : ""}
        ${event.tagline ? `<p class="hero__tagline">${esc(event.tagline)}</p>` : ""}
      </div>
    </div>
  </section>`;
}

export function mark(i, s, total) {
  return `<span class="tessera${i === total - 1 ? " tessera--last" : ""}"></span>`;
}
