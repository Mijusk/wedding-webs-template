import { dateParts, esc } from "./format.js";

// Caligrafía: una invitación escrita a mano con plumilla sobre papel de algodón con el canto
// desbarbado. Nombres en letra inglesa terracota, un rasgueo de tinta que se dibuja solo bajo los
// nombres y la foto como una copia aparte, posada junto a la tarjeta. Italianno y Cormorant.

// Canto desbarbado: un polígono con mellas pequeñas y deterministas en los cuatro lados
function deckle(seed = 1, n = 38, amp = .55) {
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const pts = [];
  const side = (fn) => { for (let i = 0; i < n; i++) pts.push(fn(i / n, (r() * amp).toFixed(2))); };
  side((t, j) => `${(t * 100).toFixed(2)}% ${j}%`);
  side((t, j) => `${(100 - j * 1.6).toFixed(2)}% ${(t * 100).toFixed(2)}%`);
  side((t, j) => `${(100 - t * 100).toFixed(2)}% ${(100 - j).toFixed(2)}%`);
  side((t, j) => `${(j * 1.6).toFixed(2)}% ${(100 - t * 100).toFixed(2)}%`);
  return `clip-path:polygon(${pts.join(",")})`;
}

// Rasgueo de plumilla: un trazo con bucle que termina en punta
const flourish = (cls = "") => `<svg class="flourish ${cls}" viewBox="0 0 320 40" aria-hidden="true" focusable="false">
  <path d="M8 26C60 30 110 30 150 22C178 16 182 4 168 6C154 8 156 30 186 30C230 30 270 20 312 12" />
  <circle cx="312" cy="12" r="1.8"/>
</svg>`;

export function head({ eyebrow, title, id, text }) {
  return `
      <header class="head">
        ${eyebrow ? `<p class="eyebrow head__eyebrow reveal">${esc(eyebrow)}</p>` : ""}
        ${title ? `<h2 class="head__title reveal" id="${id}">${esc(title)}</h2>` : ""}
        <div class="reveal">${flourish("head__flourish")}</div>
        ${text ? `<p class="head__text reveal">${esc(text)}</p>` : ""}
      </header>`;
}

export function hero({ event, venue = {}, locale, copy = {} }) {
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const t = copy.hero || {};
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  const len = Math.max(String(a).length + String(b).length + 2, 10);
  const place = [venue.name, venue.city].filter(Boolean).join(" · ");
  return `
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero__in">
      <figure class="print" style="${deckle(7, 30, .5)}"><img src="${esc(event.photo)}" alt="${esc(event.photoAlt || "")}"${focus} fetchpriority="high"></figure>
      <div class="card" style="${deckle(3)}">
        <div class="card__in" style="--len:${len}">
          ${t.eyebrow ? `<p class="hero__eyebrow">${esc(t.eyebrow)}</p>` : ""}
          <h1 class="hero__names" id="hero-title"><span>${esc(a)}</span> <span class="amp">y</span> <span>${esc(b)}</span></h1>
          ${flourish("hero__flourish")}
          <p class="hero__date"><span class="cap">${esc(d.weekday)}</span>, ${esc(d.dayMonth)} · ${esc(d.year)}</p>
          ${place ? `<p class="hero__place">${esc(place)}</p>` : ""}
          ${event.tagline ? `<p class="hero__tagline">${esc(event.tagline)}</p>` : ""}
        </div>
      </div>
    </div>
  </section>`;
}

export function mark(i, s, total) {
  return `<span class="ink${i === total - 1 ? " ink--last" : ""}"></span>`;
}

export function closingTop() {
  return `<div class="closing__flourish reveal">${flourish()}</div>`;
}
