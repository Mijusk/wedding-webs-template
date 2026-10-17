import { dateParts, time, daysUntil, esc, fill, rsvpClosed } from "./format.js";
import { calendarUrl } from "./calendar.js";
import { tile, monogram, sprig, mark } from "./tile.js";

// Plantilla Azulejo: Mediterráneo con clase, entre Lisboa y Andalucía. Cal blanca, azulejo
// cobalto y algún limón. El azulejo solo enmarca (portada, esquinas, cenefas); el resto es
// aire, Fraunces para los títulos y Lora para leer.

const arrow = `<span class="link__arrow" aria-hidden="true">→</span>`;

// Cabecera de sección: rombo de azulejo entre filetes, antetítulo y título.
function head(eyebrow, title, id) {
  return `
      <header class="head reveal">
        <p class="head__mark" aria-hidden="true"><span class="head__rule"></span>${mark}<span class="head__rule"></span></p>
        ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ""}
        ${title ? `<h2 class="head__title" id="${id}">${esc(title)}</h2>` : ""}
      </header>`;
}
const labelled = (title, id) => (title ? `aria-labelledby="${id}"` : "");

// Cenefa: banda fina de azulejo de borde (css: .band).
const band = (cls = "") => `<div class="band ${cls}" aria-hidden="true"></div>`;

// Cuatro azulejos pequeños en las esquinas de un panel.
const corners = (seed) =>
  ["tl", "tr", "bl", "br"].map((c, i) => tile(seed + i, "", `corner corner--${c}`)).join("");

/* ---------- Portada ---------- */

// Marco de la portada: 9 × 11 azulejos alrededor de la foto. Se numeran en el sentido de
// las agujas del reloj desde arriba a la izquierda (--i) para colocarlos uno a uno.
const COLS = 9, ROWS = 11;
function frameTiles() {
  const cells = [];
  for (let c = 1; c <= COLS; c++) cells.push([1, c]);
  for (let r = 2; r <= ROWS; r++) cells.push([r, COLS]);
  for (let c = COLS - 1; c >= 1; c--) cells.push([ROWS, c]);
  for (let r = ROWS - 1; r >= 2; r--) cells.push([r, 1]);
  return cells.map(([r, c], i) => tile(i * 7 + r, `grid-area:${r}/${c};--i:${i}`)).join("");
}

export function hero({ event, venue = {}, locale, copy = {} }) {
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  const len = Math.max(String(a).length, String(b).length, 5);
  const place = [venue.name, venue.city].filter(Boolean);
  return `
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero__text">
      ${sprig("hero__sprig")}
      ${copy.hero?.eyebrow ? `<p class="eyebrow hero__eyebrow">${esc(copy.hero.eyebrow)}</p>` : ""}
      <h1 class="hero__names" id="hero-title" style="--len:${len}">
        <span class="hero__name">${esc(a)}</span>
        <span class="hero__amp">&amp;</span>
        <span class="hero__name">${esc(b)}</span>
      </h1>
      <div class="hero__meta">
        <p class="hero__date">${esc(d.weekday)}, ${esc(d.dayMonth)} de ${esc(d.year)}</p>
        ${place.length ? `<p class="eyebrow hero__place">${place.map(esc).join(` <span class="hero__dot" aria-hidden="true">·</span> `)}</p>` : ""}
      </div>
    </div>
    <div class="hero__stage">
      <figure class="frame">
        <div class="frame__tiles" aria-hidden="true">${frameTiles()}</div>
        <div class="frame__photo">
          ${event.photo
            ? `<img src="${esc(event.photo)}" alt="${esc(event.photoAlt || `${a} y ${b}`)}"${focus} fetchpriority="high">`
            : `<div class="frame__empty">${sprig()}</div>`}
        </div>
        <div class="frame__mono">${monogram(event)}</div>
      </figure>
    </div>
  </section>
  ${band("band--hero")}`;
}

/* ---------- Cuándo y dónde ---------- */

export function details(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.details || {};
  const d = dateParts(event.date, locale);
  const days = daysUntil(event.date);
  const countdown = days < 0 ? "" : fill(days === 0 ? t.countdownToday : days === 1 ? t.countdownOne : t.countdown, { days });
  const title = t.title || "Cuándo y dónde";
  return `
  <section class="section details" ${labelled(title, "details-title")}>
    <div class="wrap">
      ${head(t.eyebrow, title, "details-title")}
      ${t.intro ? `<p class="lede reveal">${esc(t.intro)}</p>` : ""}
      <div class="cards">
        <article class="card reveal">
          ${corners(3)}
          <h3 class="eyebrow card__label">${esc(t.when || "Cuándo")}</h3>
          <p class="card__big">${esc(d.dayMonth)}</p>
          <p class="card__sub">${esc(d.weekday)} · ${esc(d.year)}</p>
          <p class="card__time">${esc(time(event.date))}<span> ${esc(t.timeSuffix || "h")}</span></p>
          ${countdown ? `<p class="card__count"><span class="card__lemon" aria-hidden="true"></span>${countdown}</p>` : ""}
          ${t.calendar ? `<a class="link" href="${esc(calendarUrl(config))}" target="_blank" rel="noopener">${esc(t.calendar)} ${arrow}</a>` : ""}
        </article>
        <article class="card reveal" style="--i:1">
          ${corners(11)}
          <h3 class="eyebrow card__label">${esc(t.where || "Dónde")}</h3>
          <p class="card__big">${esc(venue.name || venue.city || "")}</p>
          ${venue.address ? `<p class="card__sub">${esc(venue.address)}</p>` : ""}
          ${venue.city && venue.name && !String(venue.address || "").includes(venue.city) ? `<p class="card__sub">${esc(venue.city)}</p>` : ""}
          ${venue.mapsUrl ? `<a class="link" href="${esc(venue.mapsUrl)}" target="_blank" rel="noopener">${esc(t.map || "Cómo llegar")} ${arrow}</a>` : ""}
        </article>
      </div>
    </div>
  </section>`;
}

/* ---------- Historia ---------- */

export function story(config) {
  const { story, copy = {} } = config;
  const chapters = story?.chapters?.filter((c) => c.text) || [];
  if (!chapters.length) return "";
  const t = copy.story || {};
  return `
  <section class="section story" ${labelled(t.title, "story-title")}>
    <div class="wrap">
      ${head(t.eyebrow, t.title, "story-title")}
      <ol class="chapters">${chapters.map((c, i) => `
        <li class="chapter reveal">
          ${i ? `<span class="chapter__sep" aria-hidden="true">${mark}</span>` : ""}
          ${c.photo ? `<figure class="tiled chapter__photo"><img src="${esc(c.photo)}" alt="${esc(c.photoAlt || "")}" loading="lazy"></figure>` : ""}
          ${c.meta ? `<p class="chapter__meta">${esc(c.meta)}</p>` : ""}
          <p class="chapter__text">${esc(c.text)}</p>
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

/* ---------- Programa ---------- */

export function schedule(config) {
  const { schedule = [], copy = {} } = config;
  if (!schedule.length) return "";
  const t = copy.schedule || {};
  return `
  <section class="section schedule" ${labelled(t.title, "schedule-title")}>
    ${band()}
    <div class="wrap schedule__in">
      ${head(t.eyebrow, t.title, "schedule-title")}
      <ol class="plan">${schedule.map((s, i) => `
        <li class="plan__item reveal" style="--i:${i}">
          <span class="plan__time">${esc(s.time)}</span>
          <span class="plan__mark" aria-hidden="true">${mark}</span>
          <span class="plan__what"><span class="plan__label">${esc(s.label)}</span>${s.place ? `<span class="plan__place">${esc(s.place)}</span>` : ""}</span>
        </li>`).join("")}
      </ol>
    </div>
    ${band()}
  </section>`;
}

/* ---------- Galería ---------- */

export function gallery(config) {
  const { gallery = [], event, copy = {} } = config;
  const photos = (gallery || []).filter(Boolean);
  if (!photos.length) return "";
  const t = copy.gallery || {};
  const [a, b] = event.couple;
  const n = photos.length;
  return `
  <section class="section gallery" ${labelled(t.title, "gallery-title")}>
    <div class="wrap">
      ${head(t.eyebrow, t.title, "gallery-title")}
      <div class="photos" data-count="${n > 3 ? "many" : n}">${photos.map((src, i) => `
        <figure class="tiled photos__item reveal" style="--i:${i % 3}">
          <img src="${esc(src)}" alt="${esc(n > 1 ? `${a} y ${b} (${i + 1} de ${n})` : `${a} y ${b}`)}" loading="lazy">
        </figure>`).join("")}
      </div>
    </div>
  </section>`;
}

/* ---------- Regalo ---------- */

export function gifts(config) {
  const { gifts, copy = {} } = config;
  if (!gifts?.iban) return "";
  const t = copy.gifts || {};
  const raw = String(gifts.iban).replace(/\s+/g, "").toUpperCase();
  return `
  <section class="section gifts" ${labelled(t.title, "gifts-title")}>
    <div class="wrap gifts__in">
      ${head(t.eyebrow, t.title, "gifts-title")}
      ${t.text ? `<p class="lede reveal">${esc(t.text)}</p>` : ""}
      <details class="iban reveal">
        <summary class="link">${esc(t.reveal || "Ver los datos de la cuenta")}</summary>
        <div class="iban__card card">
          ${corners(21)}
          ${gifts.holder ? `<p class="eyebrow">${esc(t.holderLabel || "Titular")}</p><p class="iban__holder">${esc(gifts.holder)}</p>` : ""}
          <p class="eyebrow">${esc(t.ibanLabel || "IBAN")}</p>
          <p class="iban__num" id="iban-value">${esc(raw.match(/.{1,4}/g).join(" "))}</p>
          <button class="link" type="button" data-copy="${esc(raw)}" data-done="${esc(t.copied || "Copiado")}" aria-controls="iban-value"><span data-label aria-live="polite">${esc(t.copy || "Copiar IBAN")}</span></button>
        </div>
      </details>
    </div>
  </section>`;
}

/* ---------- Cierre ---------- */

export function closing({ event, rsvp = {}, sections = [], locale, copy = {} }) {
  const [a, b] = event.couple;
  const t = copy.closing || {};
  const hasRsvp = sections.includes("rsvp") && !rsvpClosed({ event, rsvp });
  const deadline = rsvp.deadline ? dateParts(rsvp.deadline, locale).dayMonth : "";
  const year = dateParts(event.date, locale).year;
  return `
  <section class="closing" aria-labelledby="closing-title">
    ${band()}
    <div class="wrap closing__in">
      <div class="closing__mono reveal">${monogram(event)}</div>
      ${hasRsvp ? `
        ${t.eyebrow ? `<p class="eyebrow reveal">${esc(t.eyebrow)}</p>` : ""}
        <h2 class="closing__title reveal" id="closing-title">${esc(t.title || rsvp.buttonLabel)}</h2>
        ${deadline && t.text ? `<p class="closing__text reveal">${fill(t.text, { deadline })}</p>` : ""}
        <div class="reveal"><button class="button" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button></div>`
      : `<h2 class="closing__title closing__title--names reveal" id="closing-title">${esc(a)} <em>&amp;</em> ${esc(b)}</h2>
        ${t.thanks ? `<p class="closing__text reveal">${esc(t.thanks)}</p>` : ""}`}
      ${sprig("closing__sprig reveal")}
    </div>
    <footer class="closing__foot">
      <span>${esc(a)} &amp; ${esc(b)}</span>
      <span aria-hidden="true" class="closing__dot"></span>
      <span>${esc(year)}</span>
    </footer>
  </section>`;
}
