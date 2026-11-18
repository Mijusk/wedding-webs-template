import { dateParts, esc } from "./format.js";

// Kintsugi: el arte japonés de reparar la cerámica con oro. Papel washi, tinta sumi, un
// ensō (círculo de pincel) que se traza al entrar y una grieta de oro que lo atraviesa.
// Las grietas doradas separan las secciones y un sello rojo lleva vuestras iniciales.
// Mucho aire, composición asimétrica y calma.

const initial = (s) => String(s || "").trim().charAt(0).toUpperCase();

// Grieta de oro: una línea quebrada distinta según la semilla, siempre de 0 a 1000.
export function crack(seed = 1, cls = "") {
  let x = 0, s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const pts = [[0, 20]];
  while (x < 1000) { x = Math.min(1000, x + 50 + rnd() * 90); pts.push([x, 8 + rnd() * 24]); }
  const d = "M" + pts.map(([px, py]) => `${px.toFixed(0)} ${py.toFixed(1)}`).join("L");
  const branch = pts[3] ? `M${pts[3][0].toFixed(0)} ${pts[3][1].toFixed(1)}l${(20 + rnd() * 30).toFixed(0)} ${(10 + rnd() * 10).toFixed(0)}` : "";
  return `<svg class="crack ${cls}" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path pathLength="1" d="${d}"/>${branch ? `<path class="crack__branch" pathLength="1" d="${branch}"/>` : ""}</svg>`;
}

// Ensō: un trazo de pincel casi cerrado.
export const enso = (cls = "", photo = "") => `<svg class="enso ${cls}" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
  <defs><filter id="brush-${cls || "x"}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="5"/></filter>
  ${photo ? `<clipPath id="enso-clip"><circle cx="100" cy="100" r="74"/></clipPath>` : ""}</defs>
  ${photo ? `<image href="${esc(photo)}" x="20" y="20" width="160" height="160" preserveAspectRatio="xMidYMid slice" clip-path="url(#enso-clip)" class="enso__photo"/>` : ""}
  <path class="enso__ink" pathLength="1" filter="url(#brush-${cls || "x"})" d="M128 22C78 8 24 42 20 98s38 86 82 84 82-40 78-88C177 62 160 38 136 28"/>
  <path class="enso__gold" pathLength="1" d="M150 40l-14 22 6 14-16 20 8 10-12 22 4 16-10 18"/>
</svg>`;

export function head({ eyebrow, title, id, text, n }) {
  return `
      <header class="head">
        ${eyebrow ? `<p class="eyebrow head__eyebrow reveal">${esc(eyebrow)}</p>` : ""}
        ${title ? `<h2 class="head__title reveal" id="${id}">${esc(title)}</h2>` : ""}
        <div class="head__crack reveal">${crack(n + 2)}</div>
        ${text ? `<p class="head__text reveal">${esc(text)}</p>` : ""}
      </header>`;
}

export function hero({ event, venue = {}, locale, copy = {} }) {
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const t = copy.hero || {};
  const len = Math.max(String(a).length, String(b).length, 5);
  const place = venue.city || venue.name || "";
  return `
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero__in">
      <div class="hero__art">${enso("hero__enso", event.photo)}</div>
      <div class="hero__text" style="--len:${len}">
        ${t.eyebrow ? `<p class="hero__eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h1 class="hero__names" id="hero-title"><span>${esc(a)}</span><span class="hero__and">y</span><span>${esc(b)}</span></h1>
        <p class="hero__date">${esc(d.day)} · ${esc(d.month)} · ${esc(d.year)}</p>
        ${place ? `<p class="hero__place">${esc(place)}</p>` : ""}
        <span class="seal" aria-hidden="true"><span>${esc(initial(a))}</span><span>${esc(initial(b))}</span></span>
      </div>
    </div>
    ${event.tagline ? `<p class="hero__tagline">${esc(event.tagline)}</p>` : ""}
  </section>`;
}

// Marca del programa: una pincelada redonda; la última, de oro.
export function mark(i, s, total) {
  return `<span class="dot${i === total - 1 ? " dot--gold" : ""}"></span>`;
}

export function closingTop() {
  return `<div class="closing__enso reveal">${enso("closing__mark")}</div>`;
}
