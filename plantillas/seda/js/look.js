import { dateParts, esc } from "./format.js";

// Seda: una invitación envuelta como un regalo. Una cinta de raso malva con brillo cruza la foto
// en vertical y en horizontal y se anuda en un lazo; los títulos llevan un lacito y el programa
// nudos de raso. Italiana, fina y alta, para los nombres; Raleway para el resto.

let n = 0;
// Lazo de raso: dos lazadas, dos caídas cortadas en cola de golondrina y el nudo
export function bow(cls = "") {
  const id = `satin-${++n}`;
  return `<svg class="bow ${cls}" viewBox="0 0 200 160" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="var(--satin-3)"/><stop offset=".35" stop-color="var(--satin-1)"/>
      <stop offset=".5" stop-color="var(--satin-hi)"/><stop offset=".65" stop-color="var(--satin-1)"/><stop offset="1" stop-color="var(--satin-3)"/>
    </linearGradient>
  </defs>
  <g fill="url(#${id})" stroke="var(--satin-3)" stroke-width=".8">
    <path class="bow__tail" d="M94 66L64 146L78 138L86 154L104 70Z"/>
    <path class="bow__tail" d="M106 66L136 146L122 138L114 154L96 70Z"/>
    <path class="bow__loop" d="M100 60C70 18 18 14 16 52C14 88 60 86 100 64Z"/>
    <path class="bow__loop" d="M100 60C130 18 182 14 184 52C186 88 140 86 100 64Z"/>
    <path d="M100 60C78 44 44 38 40 52" fill="none" stroke="var(--satin-3)" stroke-width="1" opacity=".45"/>
    <path d="M100 60C122 44 156 38 160 52" fill="none" stroke="var(--satin-3)" stroke-width="1" opacity=".45"/>
    <rect x="88" y="50" width="24" height="24" rx="8"/>
  </g>
</svg>`;
}

export function head({ eyebrow, title, id, text }) {
  return `
      <header class="head">
        ${eyebrow ? `<p class="eyebrow head__eyebrow reveal">${esc(eyebrow)}</p>` : ""}
        ${title ? `<h2 class="head__title reveal" id="${id}">${esc(title)}</h2>` : ""}
        <div class="head__bow reveal">${bow()}</div>
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
        <h1 class="hero__names" id="hero-title"><span>${esc(a)}</span><span class="amp">&amp;</span><span>${esc(b)}</span></h1>
        <p class="hero__date">${esc(d.day)} · ${esc(d.month)} · ${esc(d.year)}</p>
        ${place ? `<p class="hero__place">${esc(place)}</p>` : ""}
        ${event.tagline ? `<p class="hero__tagline">${esc(event.tagline)}</p>` : ""}
      </div>
      <div class="gift">
        <figure class="gift__photo"><img src="${esc(event.photo)}" alt="${esc(event.photoAlt || "")}"${focus} fetchpriority="high"></figure>
        <span class="ribbon ribbon--v" aria-hidden="true"></span>
        <span class="ribbon ribbon--h" aria-hidden="true"></span>
        ${bow("gift__bow")}
      </div>
    </div>
  </section>`;
}

export function mark(i, s, total) {
  return `<span class="knot${i === total - 1 ? " knot--last" : ""}"></span>`;
}

export function closingTop() {
  return `<div class="closing__ribbon" aria-hidden="true"><span class="ribbon ribbon--h"></span>${bow("closing__bow")}</div>`;
}
