import { dateParts, esc } from "./format.js";

// Partitura: la invitación es la primera página de una partitura impresa. Título centrado,
// "Op. 1 · para dos voces", la fecha donde iría el compositor y un pentagrama a todo lo ancho
// con clave de sol y compás de 2/4 (para dos). Las notas aparecen una a una al entrar.
// Las secciones son movimientos y el programa, un programa de mano. Burdeos, negro y crema.

// Melodía de la portada: [posición en el pentagrama (0 = primera línea, sube de medio en medio), duración]
const TUNE = [[4, "q"], [5, "e"], [6, "e"], [7, "q"], [6, "q"], "|", [5, "q"], [4, "e"], [3, "e"], [4, "h"], "|", [6, "q"], [7, "e"], [8, "e"], [9, "q"], [7, "q"], "|", [8, "q"], [6, "q"], [5, "h"], "||"];

// Pentagrama en SVG: 5 líneas separadas 10 unidades; y de la primera línea = 60.
function staff(cls = "", tune = TUNE) {
  const lines = [0, 1, 2, 3, 4].map((i) => `<path class="st__line" d="M0 ${60 - i * 10}H1000"/>`).join("");
  let x = 150, k = 0;
  const marks = tune.map((n) => {
    if (n === "|" || n === "||") {
      const bar = `<path class="st__bar${n === "||" ? " st__bar--end" : ""}" d="M${x} 20V60"/>${n === "||" ? `<path class="st__bar st__bar--thick" d="M${x + 6} 20V60"/>` : ""}`;
      x += 26;
      return bar;
    }
    const [pos, dur] = n;
    const y = 60 - pos * 5;
    const up = pos < 4;
    const stem = up ? `M${x + 6.2} ${y - 1}V${y - 34}` : `M${x - 6.2} ${y + 1}V${y + 34}`;
    const flag = dur === "e" ? (up ? `<path class="st__flag" d="M${x + 6.2} ${y - 34}c2 8 12 10 8 22"/>` : `<path class="st__flag" d="M${x - 6.2} ${y + 34}c2-8 12-10 8-22"/>`) : "";
    const ledger = pos <= -2 || pos >= 10 ? `<path class="st__line" d="M${x - 11} ${y}H${x + 11}"/>` : "";
    const head = `<ellipse class="st__head${dur === "h" ? " st__head--open" : ""}" cx="${x}" cy="${y}" rx="6.6" ry="4.6" transform="rotate(-20 ${x} ${y})"/>`;
    const out = `<g class="st__note" style="--i:${k++}">${ledger}${head}<path class="st__stem" d="${stem}"/>${flag}</g>`;
    x += dur === "h" ? 64 : dur === "q" ? 48 : 36;
    return out;
  }).join("");
  return `<svg class="st ${cls}" viewBox="0 0 1000 80" preserveAspectRatio="xMinYMid meet" aria-hidden="true" focusable="false">
    ${lines}
    <text class="st__clef" x="14" y="66">𝄞</text>
    <text class="st__time" x="80" y="38">2</text><text class="st__time" x="80" y="58">4</text>
    ${marks}
  </svg>`;
}

const NOTES = ["♩", "♪", "♫", "♬"];

export function head({ eyebrow, title, id, text }) {
  return `
      <header class="head">
        ${eyebrow ? `<p class="eyebrow head__eyebrow reveal">${esc(eyebrow)}</p>` : ""}
        ${title ? `<h2 class="head__title reveal" id="${id}">${esc(title)}</h2>` : ""}
        <p class="head__staff reveal" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><i>𝄐</i></p>
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
    <div class="score">
      <p class="score__opus">${esc(t.opus || "")}</p>
      <p class="score__eyebrow">${esc(t.eyebrow || "")}</p>
      <h1 class="score__title" id="hero-title" style="--len:${len}">${esc(a)} <span class="amp">&amp;</span> ${esc(b)}</h1>
      ${event.tagline ? `<p class="score__sub">${esc(event.tagline)}</p>` : ""}
      <div class="score__credits">
        <p class="score__tempo">${t.song ? esc(t.song) : ""}</p>
        <p class="score__composer"><span class="cap">${esc(d.weekday)}</span>, ${esc(d.day)} de ${esc(d.month)} de ${esc(d.year)}${place ? `<br>${esc(place)}` : ""}</p>
      </div>
      ${staff("score__staff")}
    </div>
    <figure class="hero__photo"><img src="${esc(event.photo)}" alt="${esc(event.photoAlt || "")}"${focus} fetchpriority="high"></figure>
  </section>`;
}

export function mark(i) {
  return `<span class="note-mark">${NOTES[i % NOTES.length]}</span>`;
}

// Cierre: doble barra final con calderón.
export function closingTop() {
  return `<p class="fine reveal" aria-hidden="true"><span class="fine__fermata">𝄐</span><span class="fine__bars"><i></i><i></i></span><span class="fine__word">Fine</span></p>`;
}
