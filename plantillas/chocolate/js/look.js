import { dateParts, esc } from "./format.js";

// Chocolate: el color de 2026. Marrón chocolate profundo, rosa empolvado y pan de oro.
// La foto en un arco alto con filete dorado, nombres en una serif escultórica con brillo de
// oro que se mueve, filetes dorados finos y mucho contraste. Para bodas de tarde y noche.

const rule = `<span class="goldrule" aria-hidden="true"><i></i><b></b><i></i></span>`;

export function head({ eyebrow, title, id, text }) {
  return `
      <header class="head">
        ${eyebrow ? `<p class="eyebrow head__eyebrow reveal">${esc(eyebrow)}</p>` : ""}
        ${title ? `<h2 class="head__title reveal" id="${id}">${esc(title)}</h2>` : ""}
        <div class="reveal">${rule}</div>
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
        ${t.eyebrow ? `<p class="eyebrow hero__eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h1 class="hero__names" id="hero-title"><span class="foil">${esc(a)}</span><span class="amp">&amp;</span><span class="foil">${esc(b)}</span></h1>
        ${rule}
        <p class="hero__date">${esc(d.day)} · ${esc(d.month)} · ${esc(d.year)}</p>
        ${place ? `<p class="hero__place">${esc(place)}</p>` : ""}
      </div>
      <figure class="arch"><img src="${esc(event.photo)}" alt="${esc(event.photoAlt || "")}"${focus} fetchpriority="high"></figure>
    </div>
  </section>`;
}

export function mark(i, s, total) {
  return `<span class="gem${i === total - 1 ? " gem--last" : ""}"></span>`;
}

export function closingTop() {
  return `<div class="closing__rule reveal">${rule}</div>`;
}
