import { dateParts, esc } from "./format.js";

// Vendimia: la invitación es la etiqueta de un vino de reserva. Papel verjurado crema, tinta
// burdeos y oro viejo. La cosecha es el año de la boda, la historia son "notas de cata" y el
// programa, un maridaje. Pensada para bodegas, viñedos y fincas.

// Racimo con dos hojas, a línea: el sello de la bodega.
const crest = (cls = "") => `<svg class="crest ${cls}" viewBox="0 0 80 80" aria-hidden="true" focusable="false">
  <path class="crest__stem" d="M40 6c0 6 2 9 6 11"/>
  <path class="crest__leaf" d="M41 14c-9-7-21-5-27 2 6 3 9 9 17 9 5 0 9-4 10-11z"/>
  <path class="crest__leaf" d="M43 14c7-8 19-8 25-2-5 4-8 10-15 11-5 1-9-3-10-9z"/>
  <path class="crest__vein" d="M41 14c-7 1-14 3-20 3M43 14c6 0 12 1 18 0"/>
  ${[[40, 30], [32, 37], [48, 37], [40, 44], [26, 45], [54, 45], [33, 52], [47, 52], [40, 59], [36, 66], [44, 66], [40, 73]]
    .map(([x, y]) => `<circle class="crest__grape" cx="${x}" cy="${y}" r="5.4"/>`).join("")}
</svg>`;

// Hoja de parra pequeña para los antetítulos.
const leaf = `<svg class="leaf" viewBox="0 0 24 14" aria-hidden="true" focusable="false"><path d="M1 7h8M12 2c-3 2-3 8 0 10 3-2 3-8 0-10zM15 7h8"/></svg>`;

export function head({ eyebrow, title, id, text }) {
  return `
      <header class="head">
        ${eyebrow ? `<p class="eyebrow head__eyebrow reveal">${leaf}<span>${esc(eyebrow)}</span>${leaf}</p>` : ""}
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
    <figure class="hero__photo"><img src="${esc(event.photo)}" alt="${esc(event.photoAlt || "")}"${focus} fetchpriority="high"></figure>
    <div class="hero__stage">
      <div class="label" style="--len:${len}">
        <div class="label__frame">
          <p class="label__vintage"><span>${esc(t.eyebrow || "Cosecha")}</span><strong>${esc(d.year)}</strong></p>
          ${crest("label__crest")}
          <h1 class="label__names" id="hero-title">
            <span class="label__name">${esc(a)}</span>
            <span class="label__amp">&amp;</span>
            <span class="label__name">${esc(b)}</span>
          </h1>
          ${t.reserve ? `<p class="label__reserve">${esc(t.reserve)}</p>` : ""}
          <p class="label__rule" aria-hidden="true"><span></span></p>
          <p class="label__date">${esc(d.day)} · ${esc(d.month)} · ${esc(d.year)}</p>
          ${place ? `<p class="label__origin">${t.origin ? `<span>${esc(t.origin)}</span>` : ""}${esc(place)}</p>` : ""}
          ${t.volume || t.strength ? `<p class="label__small">${t.volume ? `<span>${esc(t.volume)}</span>` : ""}${t.strength ? `<span>${esc(t.strength)}</span>` : ""}</p>` : ""}
        </div>
      </div>
    </div>
  </section>`;
}

// Marca del programa: el cerco que deja una copa sobre el mantel.
export function mark(i) {
  return `<svg class="ring" viewBox="0 0 40 40" aria-hidden="true" focusable="false" style="--r:${(i * 67) % 360}deg">
    <path d="M20 4.5a15.5 15.5 0 1 1-11 4.6" /><path class="ring__drop" d="M7 12.6a1.6 1.6 0 1 0 .1 0"/></svg>`;
}

export function closingTop() {
  return `<div class="closing__crest reveal" aria-hidden="true">${crest()}</div>`;
}
