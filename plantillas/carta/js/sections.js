import { dateParts, time, daysUntil, esc, fill, rsvpClosed } from "./format.js";
import { calendarUrl } from "./calendar.js";

// Plantilla Carta: la portada es una carta manuscrita de la pareja a sus invitados, que se
// escribe sola con tinta azul (js/enhance.js). Debajo, los datos prácticos pasados a limpio.

// Clip de papelería que sujeta la foto a la carta.
const paperClip = () => `
  <svg class="clip" viewBox="0 0 26 76" aria-hidden="true" focusable="false">
    <path d="M9 24V9.5a4.5 4.5 0 0 1 9 0V58a8 8 0 0 1-16 0V17" fill="none" stroke="url(#clip-metal)" stroke-width="2.4" stroke-linecap="round"/>
    <defs><linearGradient id="clip-metal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#b9bcc2"/><stop offset=".5" stop-color="#7d828b"/><stop offset="1" stop-color="#a7abb2"/>
    </linearGradient></defs>
  </svg>`;

// Mancha de tinta mínima: un borrón y dos gotitas.
const inkBlot = (cls) => `
  <svg class="blot ${cls}" viewBox="0 0 60 40" aria-hidden="true" focusable="false">
    <path d="M22 12c4-5 12-4 15 0 4 1 7 5 5 9-1 4-6 5-9 7-4 3-10 3-13-1-4-1-6-6-3-9 0-3 2-5 5-6Z" fill="currentColor" opacity=".55"/>
    <circle cx="48" cy="9" r="1.6" fill="currentColor" opacity=".5"/>
    <circle cx="10" cy="30" r="1.1" fill="currentColor" opacity=".45"/>
    <circle cx="53" cy="30" r=".8" fill="currentColor" opacity=".4"/>
  </svg>`;

// Plumilla: abre cada sección.
const nib = () => `
  <svg class="nib" viewBox="0 0 120 16" aria-hidden="true" focusable="false">
    <path d="M2 9c14-5 28 4 42 0s18-4 16-1-6 3-2 1" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
    <path d="M118 7c-14 5-28-4-42 0" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
    <circle cx="66" cy="8" r="1.3" fill="currentColor"/>
  </svg>`;

const head = (id, t = {}) => `
  <header class="section__head reveal">
    ${nib()}
    ${t.eyebrow ? `<p class="eyebrow">${esc(t.eyebrow)}</p>` : ""}
    ${t.title ? `<h2 class="section__title" id="${id}">${esc(t.title)}</h2>` : ""}
  </header>`;

const labelled = (id, t = {}) => (t.title ? ` aria-labelledby="${id}"` : t.eyebrow ? ` aria-label="${esc(t.eyebrow)}"` : "");

// Párrafos de la carta: copy.letter.body puede ser una lista o un texto con líneas en blanco.
function letterBody(letter, event) {
  const body = letter?.body ?? event.tagline ?? "";
  return (Array.isArray(body) ? body : String(body).split(/\n\s*\n/)).filter((p) => String(p).trim());
}

export function hero({ event, venue = {}, locale, copy = {} }) {
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const t = copy.hero || {};
  const letter = copy.letter || {};
  const vars = {
    a, b, weekday: d.weekday, date: `${d.dayMonth} de ${d.year}`, dayMonth: d.dayMonth, year: d.year,
    time: time(event.date), venue: venue.name || "", city: venue.city || "", address: venue.address || "",
  };
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  const place = venue.city || venue.name;
  return `
  <section class="hero" aria-labelledby="hero-names">
    <div class="desk${event.photo ? " desk--photo" : ""}">
      ${event.photo ? `
      <figure class="snapshot">
        ${paperClip()}
        <span class="snapshot__frame"><img src="${esc(event.photo)}" alt="${esc(event.photoAlt)}"${focus} fetchpriority="high"></span>
      </figure>` : ""}
      <article class="letter" tabindex="-1">
        <header class="letter__head">
          ${t.eyebrow ? `<p class="eyebrow letter__eyebrow">${esc(t.eyebrow)}</p>` : ""}
          <h1 class="letter__names" id="hero-names"><span class="nm">${esc(a)}</span> <span class="amp" aria-hidden="true">&amp;</span><span class="sr-only">y</span> <span class="nm">${esc(b)}</span></h1>
          <p class="letter__date">${esc(d.numeric)}${place ? ` <span aria-hidden="true">—</span><span class="sr-only">,</span> ${esc(place)}` : ""}</p>
        </header>
        <div class="letter__hand">
          ${letter.greeting ? `<p class="letter__greeting" data-ink>${fill(letter.greeting, vars)}</p>` : ""}
          ${letterBody(letter, event).map((p) => `<p class="letter__p" data-ink>${fill(p, vars)}</p>`).join("")}
          ${letter.closing ? `<p class="letter__closing" data-ink>${fill(letter.closing, vars)}</p>` : ""}
          <p class="letter__sign"><span class="letter__sign-ink">${esc(a)} y ${esc(b)}</span></p>
          ${inkBlot("letter__blot")}
        </div>
      </article>
    </div>
    <button class="skip" type="button" hidden>${esc(letter.skip || "Saltar")}<span class="sr-only"> ${esc(letter.skipHint || "la animación de la carta")}</span></button>
  </section>`;
}

export function details(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.details || {};
  const d = dateParts(event.date, locale);
  const days = daysUntil(event.date);
  const countdown = days < 0 ? "" : fill(days === 0 ? t.countdownToday : days === 1 ? t.countdownOne : t.countdown, { days });
  return `
  <section class="section details"${labelled("details-title", t)}>
    <div class="wrap wrap--wide">
      ${head("details-title", t)}
      <div class="details__grid">
        <article class="fact reveal">
          <p class="eyebrow">${esc(t.when || "Cuándo")}</p>
          <p class="fact__big"><span class="fact__wd">${esc(d.weekday)}</span> ${esc(d.dayMonth)} de ${esc(d.year)}</p>
          <p class="fact__sub">${esc(time(event.date))} ${esc(t.timeSuffix || "h")}</p>
          ${countdown ? `<p class="note">${countdown}</p>` : ""}
          ${t.calendar ? `<a class="link" href="${esc(calendarUrl(config))}" target="_blank" rel="noopener">${esc(t.calendar)}</a>` : ""}
        </article>
        <span class="details__rule" aria-hidden="true"></span>
        <article class="fact reveal" style="--i:1">
          <p class="eyebrow">${esc(t.where || "Dónde")}</p>
          <p class="fact__big">${esc(venue.name)}</p>
          ${venue.address ? `<p class="fact__sub">${esc(venue.address)}</p>` : ""}
          ${venue.mapsUrl && t.map ? `<a class="link" href="${esc(venue.mapsUrl)}" target="_blank" rel="noopener">${esc(t.map)}</a>` : ""}
        </article>
      </div>
    </div>
  </section>`;
}

export function story({ story, event, copy = {} }) {
  const chapters = story?.chapters?.filter((c) => c.text) || [];
  if (!chapters.length) return "";
  const t = copy.story || {};
  const [a, b] = event.couple;
  return `
  <section class="section story"${labelled("story-title", t)}>
    <div class="wrap">
      ${head("story-title", t)}
      <ol class="chapters">${chapters.map((c, i) => `
        <li class="chapter reveal${c.photo ? " chapter--photo" : ""}" style="--i:${i}">
          ${c.photo ? `<figure class="print chapter__photo"><img src="${esc(c.photo)}" alt="${esc(c.photoAlt || `${a} y ${b}`)}" loading="lazy"></figure>` : ""}
          <div class="chapter__body">
            ${c.meta ? `<p class="eyebrow">${esc(c.meta)}</p>` : ""}
            <p class="chapter__text">${esc(c.text)}</p>
          </div>
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

export function schedule({ schedule = [], copy = {} }) {
  if (!schedule.length) return "";
  const t = copy.schedule || {};
  return `
  <section class="section schedule"${labelled("schedule-title", t)}>
    <div class="wrap">
      ${head("schedule-title", t)}
      <ol class="program">${schedule.map((s, i) => `
        <li class="program__item reveal" style="--i:${i}">
          <time class="program__time">${esc(s.time)}</time>
          <span class="program__what"><span class="program__label">${esc(s.label)}</span>${s.place ? `<span class="program__place">${esc(s.place)}</span>` : ""}</span>
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

// Fotos sueltas sobre la mesa: cada una con su giro, como caídas de un sobre.
const TILTS = [-3.2, 2.4, -1.4, 3.1, -2.2, 1.6];
export function gallery({ gallery = [], event, copy = {} }) {
  if (!gallery.length) return "";
  const t = copy.gallery || {};
  const [a, b] = event.couple;
  const photos = gallery.slice(0, 6);
  return `
  <section class="section gallery"${labelled("gallery-title", t)}>
    <div class="wrap wrap--wide">
      ${head("gallery-title", t)}
      <div class="table" data-count="${photos.length}">${photos.map((src, i) => `
        <figure class="print reveal" style="--i:${i};--r:${TILTS[i % TILTS.length]}deg"><img src="${esc(src)}" alt="${esc(`${a} y ${b}`)}" loading="lazy"></figure>`).join("")}
      </div>
    </div>
  </section>`;
}

export function gifts({ gifts, copy = {} }) {
  if (!gifts?.iban) return "";
  const t = copy.gifts || {};
  const raw = gifts.iban.replace(/\s+/g, "").toUpperCase();
  return `
  <section class="section gifts" aria-labelledby="gifts-title">
    <div class="wrap">
      <div class="card reveal">
        ${nib()}
        ${t.eyebrow ? `<p class="eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h2 class="section__title" id="gifts-title">${esc(t.title)}</h2>
        ${t.text ? `<p class="gifts__text">${esc(t.text)}</p>` : ""}
        <details class="iban">
          <summary class="link">${esc(t.reveal || "Ver los datos de la cuenta")}</summary>
          <dl class="iban__data">
            ${gifts.holder ? `<div><dt class="eyebrow">${esc(t.holderLabel)}</dt><dd>${esc(gifts.holder)}</dd></div>` : ""}
            <div><dt class="eyebrow">${esc(t.ibanLabel)}</dt><dd class="iban__num" id="iban-value">${esc(raw.match(/.{1,4}/g).join(" "))}</dd></div>
          </dl>
          <button class="link" type="button" data-copy="${esc(raw)}" data-done="${esc(t.copied)}" aria-controls="iban-value"><span data-label aria-live="polite">${esc(t.copy)}</span></button>
        </details>
      </div>
    </div>
  </section>`;
}

export function closing({ event, rsvp = {}, sections, locale, copy = {} }) {
  const [a, b] = event.couple;
  const t = copy.closing || {};
  const hasRsvp = sections.includes("rsvp") && !rsvpClosed({ event, rsvp });
  const deadline = rsvp.deadline ? dateParts(rsvp.deadline, locale).dayMonth : "";
  return `
  <section class="closing" aria-labelledby="closing-title">
    <div class="wrap closing__inner reveal">
      ${nib()}
      ${hasRsvp ? `
        ${t.eyebrow ? `<p class="eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h2 class="section__title closing__title" id="closing-title">${esc(t.title)}</h2>
        ${deadline && t.text ? `<p class="closing__text">${fill(t.text, { deadline })}</p>` : ""}
        <button class="button" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button>`
      : `<h2 class="closing__names" id="closing-title">${esc(a)} y ${esc(b)}</h2>`}
    </div>
    <footer class="closing__foot">
      ${hasRsvp ? `<p class="closing__sign">${esc(a)} y ${esc(b)}</p>` : ""}
      <p class="eyebrow">${esc(dateParts(event.date, locale).year)}</p>
    </footer>
  </section>`;
}
