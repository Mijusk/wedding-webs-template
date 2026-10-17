import { dateParts, time, daysUntil, esc, fill, rsvpClosed } from "./format.js";
import { calendarUrl } from "./calendar.js";

// Plantilla Etiqueta: black tie. Azul noche, letras marfil y filetes dorados finos,
// todo centrado y simétrico, como una invitación grabada.

// Ornamentos de grabado (SVG en línea, heredan el dorado con currentColor).
const ORN = `<svg class="orn" viewBox="0 0 160 14" aria-hidden="true" focusable="false">
  <path d="M0 7H58M102 7H160" stroke="currentColor" stroke-width=".75"/>
  <circle cx="63" cy="7" r="1.3" fill="currentColor"/><circle cx="97" cy="7" r="1.3" fill="currentColor"/>
  <path d="M80 1.5 85.5 7 80 12.5 74.5 7Z" fill="none" stroke="currentColor" stroke-width=".75"/>
  <path d="M80 4.5 82.5 7 80 9.5 77.5 7Z" fill="currentColor"/>
  <path d="M70 7l2.4-2.4L74.8 7l-2.4 2.4Z M85.2 7l2.4-2.4L90 7l-2.4 2.4Z" fill="currentColor" opacity=".7"/>
</svg>`;
const DIAMOND = `<svg class="diamond" viewBox="0 0 60 12" aria-hidden="true" focusable="false">
  <path d="M0 6H22M38 6H60" stroke="currentColor" stroke-width=".75"/>
  <path d="M30 1 35 6 30 11 25 6Z" fill="none" stroke="currentColor" stroke-width=".75"/>
  <path d="M30 4 32 6 30 8 28 6Z" fill="currentColor"/>
</svg>`;
// Esquina grabada: filete en L, rombo y punto. Se gira con CSS para las cuatro esquinas.
const CORNER = `<svg class="corner" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
  <path d="M12 46V12H46" fill="none" stroke="currentColor" stroke-width=".75"/>
  <path d="M5 1 9 5 5 9 1 5Z" fill="currentColor"/>
  <circle cx="12" cy="12" r="1.4" fill="currentColor"/>
</svg>`;
const corners = () => ["tl", "tr", "bl", "br"].map((c) => `<span class="corner-wrap corner-wrap--${c}">${CORNER}</span>`).join("");
const BOWTIE = `<svg class="bowtie" viewBox="0 0 80 40" aria-hidden="true" focusable="false">
  <g fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round">
    <path d="M34 15C25 9 15 5 8 5 3.5 12 3.5 28 8 35 15 35 25 31 34 25Z"/>
    <path d="M46 15C55 9 65 5 72 5 76.5 12 76.5 28 72 35 65 35 55 31 46 25Z"/>
    <rect x="34" y="13.5" width="12" height="13" rx="2.5"/>
    <path d="M15 11c4 5 4 13 0 18M65 11c-4 5-4 13 0 18" opacity=".6"/>
  </g>
</svg>`;

const ext = `target="_blank" rel="noopener"`;

// Las palabras largas reducen el tamaño de los nombres para que nunca desborden.
function fit(names) {
  const longest = Math.max(...names.flatMap((n) => String(n).split(/\s+/)).map((w) => w.length));
  return longest <= 6 ? 1 : longest <= 8 ? 0.86 : longest <= 10 ? 0.74 : 0.62;
}

// Cabecera de sección: rótulo en Cinzel entre rombos, título y ornamento.
function head(id, eyebrow, title) {
  if (!eyebrow && !title) return "";
  return `
      <header class="sec__head reveal">
        ${eyebrow ? `<p class="eyebrow"${title ? "" : ` id="${id}"`}>${esc(eyebrow)}</p>` : ""}
        ${title ? `<h2 class="sec__title" id="${id}">${esc(title)}</h2>` : ""}
        ${ORN}
      </header>`;
}
const labelled = (id, eyebrow, title) => (eyebrow || title ? ` aria-labelledby="${id}"` : "");

export function hero({ event, venue = {}, locale, copy = {} }) {
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  const place = venue.city || venue.name || "";
  const box = `<span class="frame__box"><i></i><i></i><i></i><i></i></span>`;
  return `
  <section class="hero" aria-labelledby="hero-names">
    <div class="frame" aria-hidden="true">${box}${box}${corners()}</div>
    <div class="hero__inner">
      ${copy.hero?.eyebrow ? `<p class="hero__eyebrow">${esc(copy.hero.eyebrow)}</p>` : ""}
      <h1 class="hero__names" id="hero-names" style="--fit:${fit([a, b])}">
        <span class="name" data-text="${esc(a)}">${esc(a)}</span>
        <span class="amp">&amp;</span>
        <span class="name name--b" data-text="${esc(b)}">${esc(b)}</span>
      </h1>
      <div class="hero__orn">${ORN}</div>
      <p class="hero__date"><span>${esc(d.weekday)}</span><span class="dot" aria-hidden="true">·</span><span>${esc(d.dayMonth)} ${esc(d.year)}</span></p>
      ${place ? `<p class="hero__place">${esc(place)}</p>` : ""}
      ${event.tagline ? `<p class="hero__tagline">${esc(event.tagline)}</p>` : ""}
    </div>
    <span class="hero__cue" aria-hidden="true"></span>
  </section>
  ${event.photo ? `
  <figure class="portrait reveal">
    <div class="portrait__frame">${corners()}<img src="${esc(event.photo)}" alt="${esc(event.photoAlt || `${a} y ${b}`)}"${focus} fetchpriority="high"></div>
  </figure>` : ""}`;
}

export function details(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.details || {};
  const d = dateParts(event.date, locale);
  const days = daysUntil(event.date);
  const countdown = days < 0 ? "" : fill(days === 0 ? t.countdownToday : days === 1 ? t.countdownOne : t.countdown, { days });
  const hour = time(event.date);
  const at = t.at ? fill(t.at, { time: hour }) : `${esc(hour)} h`;
  return `
  <section class="sec details"${labelled("details-title", t.eyebrow, t.title)}>
    <div class="wrap">
      ${head("details-title", t.eyebrow, t.title)}
      <div class="when reveal">
        ${t.when ? `<p class="label">${esc(t.when)}</p>` : ""}
        <p class="date" aria-label="${esc(`${d.weekday}, ${d.dayMonth} ${d.year}`)}">
          <span class="date__side" aria-hidden="true">${esc(d.weekday)}</span>
          <span class="date__day" aria-hidden="true">${esc(d.day)}</span>
          <span class="date__side" aria-hidden="true">${esc(d.month)}</span>
        </p>
        <p class="date__year">${esc(d.year)}</p>
        <p class="date__time">${at}</p>
        ${countdown ? `<p class="countdown">${countdown}</p>` : ""}
        ${t.calendar ? `<a class="link" href="${esc(calendarUrl(config))}" ${ext}>${esc(t.calendar)}</a>` : ""}
      </div>
      <div class="sep reveal">${DIAMOND}</div>
      <div class="where reveal">
        ${t.where ? `<p class="label">${esc(t.where)}</p>` : ""}
        <p class="venue">${esc(venue.name)}</p>
        ${venue.address ? `<p class="muted">${esc(venue.address)}</p>` : ""}
        ${venue.mapsUrl && t.map ? `<a class="link" href="${esc(venue.mapsUrl)}" ${ext}>${esc(t.map)}</a>` : ""}
      </div>
    </div>
  </section>`;
}

export function story({ story, copy = {} }) {
  const chapters = story?.chapters?.filter((c) => c.text) || [];
  if (!chapters.length) return "";
  const t = copy.story || {};
  return `
  <section class="sec story"${labelled("story-title", t.eyebrow, t.title)}>
    <div class="wrap">
      ${head("story-title", t.eyebrow, t.title)}
      <ol class="chapters">${chapters.map((c, i) => `
        <li class="chapter reveal">
          ${i ? `<div class="sep">${DIAMOND}</div>` : ""}
          ${c.photo ? `<figure class="framed chapter__photo"><img src="${esc(c.photo)}" alt="${esc(c.photoAlt || "")}" loading="lazy"></figure>` : ""}
          ${c.meta ? `<p class="label">${esc(c.meta)}</p>` : ""}
          <p class="chapter__text">${esc(c.text)}</p>
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

// Código de vestimenta: obligatorio en esta plantilla, sale si hay texto en copy.dresscode.
export function dresscode({ copy = {} }) {
  const t = copy.dresscode || {};
  if (!t.title && !t.text) return "";
  return `
  <section class="sec dresscode"${labelled("dresscode-title", t.eyebrow, t.title)}>
    <div class="wrap">
      <div class="card reveal">
        ${corners()}
        ${BOWTIE}
        ${t.eyebrow ? `<p class="eyebrow"${t.title ? "" : ` id="dresscode-title"`}>${esc(t.eyebrow)}</p>` : ""}
        ${t.title ? `<h2 class="sec__title" id="dresscode-title">${esc(t.title)}</h2>` : ""}
        ${ORN}
        ${t.text ? `<p class="card__text">${esc(t.text)}</p>` : ""}
      </div>
    </div>
  </section>`;
}

export function schedule({ schedule = [], copy = {} }) {
  if (!schedule.length) return "";
  const t = copy.schedule || {};
  return `
  <section class="sec schedule"${labelled("schedule-title", t.eyebrow, t.title)}>
    <div class="wrap">
      ${head("schedule-title", t.eyebrow, t.title)}
      <ol class="programme">${schedule.map((s, i) => `
        <li class="reveal">
          ${i ? `<span class="sep">${DIAMOND}</span>` : ""}
          <time>${esc(s.time)}</time>
          <span class="programme__what">${esc(s.label)}</span>
          ${s.place ? `<span class="programme__where">${esc(s.place)}</span>` : ""}
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

export function gallery({ gallery = [], event, copy = {} }) {
  if (!gallery.length) return "";
  const [a, b] = event.couple;
  const t = copy.gallery || {};
  const photos = gallery.slice(0, 6);
  const n = photos.length;
  const cols = n === 1 ? 1 : n === 2 || n === 4 ? 2 : 3;
  return `
  <section class="sec gallery"${labelled("gallery-title", t.eyebrow, t.title)}>
    <div class="wrap">
      ${head("gallery-title", t.eyebrow, t.title)}
      <div class="photos" style="--cols:${cols}" data-count="${n}">${photos.map((src, i) => `
        <figure class="framed reveal" style="--i:${i % cols}"><img src="${esc(src)}" alt="${esc(`${a} y ${b}`)}" loading="lazy"></figure>`).join("")}
      </div>
    </div>
  </section>`;
}

export function gifts({ gifts, copy = {} }) {
  if (!gifts?.iban) return "";
  const t = copy.gifts || {};
  const raw = gifts.iban.replace(/\s+/g, "").toUpperCase();
  return `
  <section class="sec gifts"${labelled("gifts-title", t.eyebrow, t.title)}>
    <div class="wrap">
      ${head("gifts-title", t.eyebrow, t.title)}
      ${t.text ? `<p class="lead reveal">${esc(t.text)}</p>` : ""}
      <details class="iban reveal">
        <summary class="link">${esc(t.reveal || "Ver los datos de la cuenta")}</summary>
        <dl class="iban__data">
          ${gifts.holder ? `<div><dt class="label">${esc(t.holderLabel)}</dt><dd>${esc(gifts.holder)}</dd></div>` : ""}
          <div><dt class="label">${esc(t.ibanLabel)}</dt><dd class="iban__num" id="iban-value">${esc(raw.match(/.{1,4}/g).join(" "))}</dd></div>
        </dl>
        <button class="link" type="button" data-copy="${esc(raw)}" data-done="${esc(t.copied)}" aria-controls="iban-value"><span data-label aria-live="polite">${esc(t.copy)}</span></button>
      </details>
    </div>
  </section>`;
}

export function closing({ event, rsvp = {}, sections, locale, copy = {} }) {
  const [a, b] = event.couple;
  const t = copy.closing || {};
  const hasRsvp = sections.includes("rsvp") && !rsvpClosed({ event, rsvp });
  const deadline = rsvp.deadline ? dateParts(rsvp.deadline, locale).dayMonth : "";
  const year = dateParts(event.date, locale).year;
  return `
  <section class="closing" aria-labelledby="closing-title">
    <div class="wrap">
      <div class="card closing__card reveal">
        ${corners()}
        ${hasRsvp && t.eyebrow ? `<p class="eyebrow">${esc(t.eyebrow)}</p>` : ""}
        ${hasRsvp
          ? `<h2 class="sec__title closing__title" id="closing-title">${esc(t.title)}</h2>`
          : `<h2 class="closing__names" id="closing-title" style="--fit:${fit([a, b])}">${esc(a)} <span class="amp">&amp;</span> ${esc(b)}</h2>`}
        ${ORN}
        ${hasRsvp && deadline && t.text ? `<p class="card__text">${fill(t.text, { deadline })}</p>` : ""}
        ${hasRsvp ? `<button class="button" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button>` : ""}
      </div>
    </div>
    <footer class="foot">
      <span class="foot__mono" aria-hidden="true">${esc(a[0] || "")}<span>&amp;</span>${esc(b[0] || "")}</span>
      <p>${esc(a)} &amp; ${esc(b)} <span aria-hidden="true">·</span> ${esc(year)}</p>
    </footer>
  </section>`;
}
