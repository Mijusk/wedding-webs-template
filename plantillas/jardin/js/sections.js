import { dateParts, time, daysUntil, esc, fill, rsvpClosed } from "./format.js";
import { calendarUrl } from "./calendar.js";
import { daisy, daisyBloom, lavender, fern, rose, olive, lace, loose, twine } from "./flowers.js";

// Plantilla Jardín: un jardín inglés en papel. Flores prensadas (dibujadas en js/flowers.js)
// repartidas sobre la hoja como en un herbario, Cormorant para todo y la firma en
// Mrs Saint Delafield. Cada sección tiene "su flor", con su etiqueta en latín.

/* ---------- utilidades ---------- */

// Una flor colocada: posición y tamaño en % de su contenedor, giro final y, para la
// entrada, desde dónde cae (--fx) y cuánto gira al caer (--fr). data-drift: cuánto se
// mueve con el ratón (js/enhance.js).
function fl(svg, { x, y, w, r = 0, z = 2, d = 0, fx = 0, fr = 0, drift = z ? 1.1 : .55, cls = "", label = "" }) {
  return `<span class="fl ${cls}" style="--x:${x}%;--y:${y}%;--w:${w}%;--r:${r}deg;--z:${z};--d:${d}ms;--fx:${fx}px;--fr:${fr}deg" data-drift="${drift}" aria-hidden="true"><span class="fl__in">${svg}</span>${label ? `<span class="fl__label">${esc(label)}</span>` : ""}</span>`;
}

// Flor de cada sección, al margen de la hoja (lados alternos).
function sectionFlower(svg, label, side) {
  return `<span class="fl fl--sec fl--${side} reveal" data-drift="1.4" aria-hidden="true"><span class="fl__in">${svg}</span><span class="fl__label">${esc(label)}</span></span>`;
}

function head(eyebrow, title, id) {
  return `
      <header class="head reveal">
        ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ""}
        <h2 class="head__title" id="${id}">${esc(title || eyebrow || "")}</h2>
        <span class="head__sprig" aria-hidden="true"></span>
      </header>`;
}

const arrow = `<span class="link__arrow" aria-hidden="true">→</span>`;

/* ---------- portada ---------- */

// Ramillete alrededor de la foto: detrás (z 0) asoman helecho, olivo y flor de encaje;
// delante (z 2) cruzan lavanda, margarita y rosa. Las posiciones son % del marco.
const HERO_FLOWERS = () => [
  fl(fern(3), { x: -36, y: -13, w: 54, r: -32, z: 0, d: 0, fx: -40, fr: 30 }),
  fl(lace(5), { x: -34, y: 34, w: 40, r: -42, z: 0, d: 90, fx: -30, fr: 40 }),
  fl(olive(5), { x: 70, y: -22, w: 42, r: 30, z: 0, d: 140, fx: 50, fr: -26 }),
  fl(lace(2), { x: 86, y: 30, w: 38, r: 40, z: 0, d: 240, fx: 60, fr: -30 }),
  fl(olive(9), { x: 82, y: 66, w: 38, r: 128, z: 0, d: 320, fx: 40, fr: 30 }),
  fl(lavender(4), { x: -18, y: 47, w: 22, r: -26, z: 2, d: 380, fx: -30, fr: 40 }),
  fl(lavender(9), { x: -5, y: 57, w: 19, r: -10, z: 2, d: 470, fx: -20, fr: -30 }),
  fl(daisy(6), { x: -17, y: -11, w: 36, r: 14, z: 2, d: 200, fx: 30, fr: -40 }),
  fl(rose(2), { x: 88, y: 80, w: 34, r: -28, z: 2, d: 560, fx: 40, fr: 35 }),
  fl(daisyBloom(11), { x: 82, y: 11, w: 25, r: 20, z: 2, d: 640, fx: 30, fr: 60 }),
  fl(daisy(13), { x: 18, y: 84, w: 30, r: 62, z: 2, d: 700, fx: -30, fr: -50 }),
  fl(loose("rose", 4), { x: 52, y: 104, w: 9, r: 30, z: 2, d: 760, fx: -30, fr: 90 }),
  fl(loose("daisy", 7), { x: 8, y: 103, w: 7, r: -50, z: 2, d: 820, fx: 20, fr: -80 }),
  fl(loose("bud", 2), { x: 108, y: 58, w: 6, r: 10, z: 2, d: 860, fx: 10, fr: 70 }),
  fl(loose("leaf", 8), { x: -12, y: 96, w: 8, r: 70, z: 2, d: 900, fx: 10, fr: 70 }),
];

export function hero({ event, venue = {}, locale, copy = {} }) {
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  // Palabra más larga: los nombres compuestos pueden partirse en dos líneas.
  const len = Math.max(...`${a} ${b}`.split(/\s+/).map((w) => w.length), 5);
  const place = [venue.name, venue.city].filter(Boolean);
  return `
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero__in">
      <div class="hero__art">
        <figure class="hero__photo">
          <img src="${esc(event.photo)}" alt="${esc(event.photoAlt)}"${focus} fetchpriority="high">
        </figure>
        ${HERO_FLOWERS().join("")}
      </div>
      <div class="hero__text">
        ${copy.hero?.eyebrow ? `<p class="eyebrow hero__eyebrow">${esc(copy.hero.eyebrow)}</p>` : ""}
        <h1 class="hero__names" id="hero-title" style="--len:${len}">
          <span class="hero__name">${esc(a)}</span>
          <span class="hero__amp"><span>&amp;</span></span>
          <span class="hero__name">${esc(b)}</span>
        </h1>
        <div class="hero__meta">
          <p class="hero__date">${esc(d.weekday)}, ${esc(d.dayMonth)} de ${esc(d.year)}</p>
          ${place.length ? `<p class="eyebrow hero__place">${place.map(esc).join(` <span aria-hidden="true">·</span> `)}</p>` : ""}
          ${event.tagline ? `<p class="hero__tagline">${esc(event.tagline)}</p>` : ""}
        </div>
      </div>
    </div>
  </section>`;
}

/* ---------- secciones ---------- */

export function details(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.details || {};
  const d = dateParts(event.date, locale);
  const days = daysUntil(event.date);
  const countdown = days < 0 ? "" : fill(days === 0 ? t.countdownToday : days === 1 ? t.countdownOne : t.countdown, { days });
  return `
  <section class="section details" aria-labelledby="details-title">
    ${sectionFlower(daisy(21), "Bellis perennis", "right")}
    <div class="wrap">
      ${head(t.eyebrow, t.title, "details-title")}
      <dl class="facts">
        <div class="fact reveal">
          <dt class="eyebrow">${esc(t.when || "Cuándo")}</dt>
          <dd class="fact__big">${esc(d.dayMonth)}</dd>
          <dd class="fact__small">${esc(d.weekday)} · ${esc(d.year)}</dd>
          ${t.calendar ? `<dd><a class="link" href="${esc(calendarUrl(config))}" target="_blank" rel="noopener">${esc(t.calendar)} ${arrow}</a></dd>` : ""}
        </div>
        <div class="fact reveal" style="--i:1">
          <dt class="eyebrow">${esc(t.time || "Hora")}</dt>
          <dd class="fact__big">${esc(time(event.date))}<small> ${esc(t.timeSuffix || "h")}</small></dd>
          ${countdown ? `<dd class="fact__small">${countdown}</dd>` : ""}
        </div>
        <div class="fact reveal" style="--i:2">
          <dt class="eyebrow">${esc(t.where || "Dónde")}</dt>
          <dd class="fact__big">${esc(venue.name || venue.city || "")}</dd>
          ${venue.address ? `<dd class="fact__small">${esc(venue.address)}</dd>` : ""}
          ${venue.mapsUrl && t.map ? `<dd><a class="link" href="${esc(venue.mapsUrl)}" target="_blank" rel="noopener">${esc(t.map)} ${arrow}</a></dd>` : ""}
        </div>
      </dl>
    </div>
  </section>`;
}

export function story(config) {
  const { story, copy = {} } = config;
  const chapters = story?.chapters?.filter((c) => c.text) || [];
  if (!chapters.length) return "";
  const t = copy.story || {};
  return `
  <section class="section story" aria-labelledby="story-title">
    ${sectionFlower(rose(7), "Rosa canina", "left")}
    <div class="wrap">
      ${head(t.eyebrow, t.title, "story-title")}
      <ol class="chapters">${chapters.map((c, i) => `
        <li class="chapter reveal">
          ${i ? `<span class="chapter__leaf" aria-hidden="true">${loose("leaf", 3 + i)}</span>` : ""}
          ${c.photo ? `<figure class="chapter__photo paper"><img src="${esc(c.photo)}" alt="${esc(c.photoAlt || "")}" loading="lazy"></figure>` : ""}
          ${c.meta ? `<p class="eyebrow chapter__meta">${esc(c.meta)}</p>` : ""}
          <p class="chapter__text">${esc(c.text)}</p>
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

// Programa: un tallo vertical con una hoja en cada momento del día.
export function schedule(config) {
  const { schedule = [], copy = {} } = config;
  if (!schedule.length) return "";
  const t = copy.schedule || {};
  return `
  <section class="section schedule" aria-labelledby="schedule-title">
    ${sectionFlower(lavender(12), "Lavandula angustifolia", "right")}
    <div class="wrap">
      ${head(t.eyebrow, t.title, "schedule-title")}
      <ol class="plan">${schedule.map((s, i) => `
        <li class="plan__item reveal" style="--i:${i}">
          <time class="plan__time">${esc(s.time)}</time>
          <span class="plan__node" aria-hidden="true"></span>
          <span class="plan__what"><span class="plan__label">${esc(s.label)}</span>${s.place ? `<span class="plan__place">${esc(s.place)}</span>` : ""}</span>
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

// Galería: fotos con borde de papel, algo giradas, como pegadas en un álbum.
const TILT = [-1.4, 1.1, -.6, 1.6, -1.1, .7];
export function gallery(config) {
  const { gallery = [], event, copy = {} } = config;
  if (!gallery.length) return "";
  const t = copy.gallery || {};
  const [a, b] = event.couple;
  const n = gallery.length;
  return `
  <section class="section gallery" aria-labelledby="gallery-title">
    ${sectionFlower(fern(14), "Polypodium vulgare", "left")}
    <div class="wrap">
      ${head(t.eyebrow, t.title, "gallery-title")}
      <div class="album" data-count="${n > 3 ? "many" : n}">${gallery.map((src, i) => `
        <figure class="album__item paper reveal" style="--i:${i % 3};--t:${TILT[i % TILT.length]}deg">
          <img src="${esc(src)}" alt="${esc(`${a} y ${b}`)}" loading="lazy">
        </figure>`).join("")}
      </div>
    </div>
  </section>`;
}

export function gifts(config) {
  const { gifts, copy = {} } = config;
  if (!gifts?.iban) return "";
  const t = copy.gifts || {};
  const raw = gifts.iban.replace(/\s+/g, "").toUpperCase();
  return `
  <section class="section gifts" aria-labelledby="gifts-title">
    ${sectionFlower(olive(8), "Olea europaea", "right")}
    <div class="wrap">
      ${head(t.eyebrow, t.title, "gifts-title")}
      ${t.text ? `<p class="lede reveal">${esc(t.text)}</p>` : ""}
      <details class="iban reveal">
        <summary class="link">${esc(t.reveal || "Ver los datos de la cuenta")}</summary>
        <div class="iban__card">
          ${gifts.holder ? `<p class="eyebrow">${esc(t.holderLabel)}</p><p class="iban__holder">${esc(gifts.holder)}</p>` : ""}
          <p class="eyebrow">${esc(t.ibanLabel)}</p>
          <p class="iban__num" id="iban-value">${esc(raw.match(/.{1,4}/g).join(" "))}</p>
          <button class="link" type="button" data-copy="${esc(raw)}" data-done="${esc(t.copied)}" aria-controls="iban-value"><span data-label aria-live="polite">${esc(t.copy)}</span></button>
        </div>
      </details>
    </div>
  </section>`;
}

// Cierre: un ramillete atado con cordel (todas las especies juntas).
function posy() {
  const part = (svg, x, w, r, z = 1) => `<span class="posy__part" style="--x:${x}%;--w:${w}%;--r:${r}deg;--z:${z}">${svg}</span>`;
  return `<span class="fl posy reveal" data-drift="1.2" aria-hidden="true"><span class="fl__in">
    ${part(fern(31), 40, 46, -16, 0)}
    ${part(olive(32), 58, 40, 18, 0)}
    ${part(lace(34), 56, 44, 8)}
    ${part(lavender(33), 44, 17, -7)}
    ${part(lavender(35), 53, 15, 4)}
    ${part(daisy(36), 38, 40, -20, 2)}
    ${part(rose(37), 50, 50, 2, 2)}
    ${part(daisy(38), 63, 34, 21, 2)}
    <span class="posy__twine">${twine()}</span>
  </span></span>`;
}

export function closing({ event, rsvp = {}, sections, locale, copy = {} }) {
  const [a, b] = event.couple;
  const t = copy.closing || {};
  const hasRsvp = sections.includes("rsvp") && !rsvpClosed({ event, rsvp });
  const deadline = rsvp.deadline ? dateParts(rsvp.deadline, locale).dayMonth : "";
  const year = dateParts(event.date, locale).year;
  return `
  <section class="closing" aria-labelledby="closing-title">
    <div class="wrap closing__in">
      ${posy()}
      ${hasRsvp ? `
        ${t.eyebrow ? `<p class="eyebrow reveal">${esc(t.eyebrow)}</p>` : ""}
        <h2 class="closing__title reveal" id="closing-title">${esc(t.title)}</h2>
        ${deadline && t.text ? `<p class="closing__text reveal">${fill(t.text, { deadline })}</p>` : ""}
        <div class="reveal"><button class="button" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button></div>`
      : `<h2 class="closing__title closing__title--names reveal" id="closing-title">${esc(a)} <span class="closing__amp">&amp;</span> ${esc(b)}</h2>
        ${t.thanks ? `<p class="closing__text reveal">${esc(t.thanks)}</p>` : ""}`}
    </div>
    <footer class="closing__foot">
      <span class="closing__sign">${esc(a)} &amp; ${esc(b)}</span>
      <span class="eyebrow">${esc(year)}</span>
    </footer>
  </section>`;
}
