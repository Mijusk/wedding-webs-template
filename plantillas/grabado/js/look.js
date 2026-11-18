import { dateParts, esc } from "./format.js";

// Grabado: papelería de imprenta tipográfica. Una lámina a plumilla de la finca (fachada con
// espadaña, portal de arco, cipreses y un olivo) que se dibuja sola trazo a trazo, la foto como una
// lámina numerada y textos en Caslon con el aire de una invitación impresa en relieve.

const p = (d, cls = "") => `<path pathLength="1"${cls ? ` class="${cls}"` : ""} d="${d}"/>`;
const hatch = (x0, y0, x1, y1, n, dx = 0) => Array.from({ length: n }, (_, i) => {
  const t = i / (n - 1);
  const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
  return `M${x.toFixed(1)} ${y.toFixed(1)}l${dx} 6`;
}).join("");

const cypress = (x, base, h, w) => p(`M${x} ${base}C${x - w} ${base - h * .3} ${x - w * .7} ${base - h * .75} ${x} ${base - h}C${x + w * .7} ${base - h * .75} ${x + w} ${base - h * .3} ${x} ${base}`) +
  p(Array.from({ length: Math.floor(h / 9) }, (_, i) => `M${x - w * .45 + (i % 2) * 2} ${base - 8 - i * 9}l${w * .7} -5`).join(""), "fine");

export const engraving = (cls = "") => `<svg class="engraving ${cls}" viewBox="0 0 600 300" aria-hidden="true" focusable="false">
  <g class="engraving__lines">
    ${p("M0 278C80 270 160 276 300 274S520 270 600 276")}
    ${p("M0 200C60 170 110 160 170 176S260 150 320 160 440 140 520 162 580 170 600 168", "fine")}
    ${p("M150 274V176H450V274")}
    ${p("M140 178L300 132L460 178")}
    ${p(hatch(160, 170, 440, 170, 36, -4), "fine")}
    ${p("M270 132V96H330V132M264 96H336M280 96V80C280 64 320 64 320 80V96")}
    ${p("M300 90a6 6 0 1 0 .1 0M300 70V60M294 60H306")}
    ${p("M262 274V218C262 192 338 192 338 218V274")}
    ${p("M272 274V220C272 202 328 202 328 220V274", "fine")}
    ${p("M300 202V274", "fine")}
    ${p(hatch(276, 218, 324, 218, 9, 0).replaceAll("l0 6", "l0 54"), "fine")}
    ${[178, 214, 372, 408].map((x) => p(`M${x} 204h22v30h-22zM${x + 11} 204v30M${x} 219h22`)).join("")}
    ${[178, 214, 372, 408].map((x) => p(`M${x - 3} 238h28`, "fine")).join("")}
    ${p("M150 252H450", "fine")}
    ${cypress(118, 276, 132, 16)}
    ${cypress(482, 276, 150, 18)}
    ${cypress(510, 276, 104, 13)}
    ${p("M60 276C62 250 56 236 48 226M60 276C64 254 74 242 82 236M54 244C40 238 30 240 24 232")}
    ${p("M10 222C14 196 40 184 60 192C70 174 100 176 106 196C120 200 118 222 102 226C92 238 70 236 62 228C46 236 18 236 10 222Z")}
    ${p("M24 210c6-3 12-3 18 0M52 202c6-4 14-4 20 0M76 214c6-3 14-3 18 1M38 222c5-2 10-2 14 0", "fine")}
    ${p("M560 60a22 22 0 1 0 .1 0", "fine")}
    ${p("M200 70c10-6 20-6 28 0M224 58c8-5 16-5 22 0", "fine")}
  </g>
</svg>`;

const fleuron = `<svg class="fleuron" viewBox="0 0 120 20" aria-hidden="true" focusable="false"><path d="M0 10H44M76 10H120"/><path d="M60 3C54 8 50 9 46 10C50 11 54 12 60 17C66 12 70 11 74 10C70 9 66 8 60 3Z"/><circle cx="60" cy="10" r="1.8"/></svg>`;

export function head({ eyebrow, title, id, text }) {
  return `
      <header class="head">
        ${eyebrow ? `<p class="eyebrow head__eyebrow reveal">${esc(eyebrow)}</p>` : ""}
        ${title ? `<h2 class="head__title reveal" id="${id}">${esc(title)}</h2>` : ""}
        <div class="reveal">${fleuron}</div>
        ${text ? `<p class="head__text reveal">${esc(text)}</p>` : ""}
      </header>`;
}

export function hero({ event, venue = {}, locale, copy = {} }) {
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const t = copy.hero || {};
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  const len = String(a).length + String(b).length + 3;
  const place = [venue.name, venue.city].filter(Boolean).join(" · ");
  return `
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero__in">
      <div class="hero__text" style="--len:${len}">
        ${engraving("hero__engraving")}
        ${t.eyebrow ? `<p class="hero__eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h1 class="hero__names" id="hero-title"><span>${esc(a)}</span> <span class="amp">&amp;</span> <span>${esc(b)}</span></h1>
        ${event.tagline ? `<p class="hero__tagline">${esc(event.tagline)}</p>` : ""}
        ${fleuron}
        <p class="hero__date"><span class="cap">${esc(d.weekday)}</span>, ${esc(d.dayMonth)} · ${esc(d.year)}</p>
        ${place ? `<p class="hero__place">${esc(place)}</p>` : ""}
      </div>
      <figure class="plate">
        <img src="${esc(event.photo)}" alt="${esc(event.photoAlt || "")}"${focus} fetchpriority="high">
        <figcaption class="plate__cap">Lám. I</figcaption>
      </figure>
    </div>
  </section>`;
}

export function mark(i, s, total) {
  return `<span class="bullet${i === total - 1 ? " bullet--last" : ""}"></span>`;
}

export function closingTop() {
  return `<div class="closing__engraving reveal">${engraving()}</div>`;
}
