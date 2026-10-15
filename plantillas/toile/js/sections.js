import { dateParts, time, daysUntil, esc, fill, rsvpClosed } from "./format.js";
import { calendarUrl } from "./calendar.js";
import { bow } from "./toile.js";

// Plantilla Toile: tela de Jouy en azul empolvado sobre crema. El estampado (js/toile.js)
// enmarca la portada, el programa y el cierre, y corre en bandas entre secciones;
// las tarjetas color crema van atadas con un lazo de seda rosa.

// Ramita grabada que separa bloques.
const sprig = (cls = "") => `
  <svg class="sprig ${cls}" viewBox="0 0 180 20" aria-hidden="true" focusable="false">
    <g fill="none" stroke="currentColor" stroke-width=".8" stroke-linecap="round">
      <path d="M2 10h62M116 10h62"/>
      <path d="M90 10c-6-4-14-5-20-2M90 10c6-4 14-5 20-2M90 10c-5 3-11 5-17 4M90 10c5 3 11 5 17 4" />
      <path d="M72 8c-3-2-6-2-8 0 3 2 6 2 8 0zM108 8c3-2 6-2 8 0-3 2-6 2-8 0z"/>
    </g>
    <circle cx="90" cy="10" r="2.2" fill="currentColor"/>
  </svg>`;

// Banda de estampado entre secciones; enhance.js le da un paralaje muy suave.
const band = () => `<div class="band" data-parallax aria-hidden="true"></div>`;

const head = (id, t = {}) => `
  <header class="section__head reveal">
    ${t.eyebrow ? `<p class="script eyebrow">${esc(t.eyebrow)}</p>` : ""}
    ${t.title ? `<h2 class="section__title" id="${id}">${esc(t.title)}</h2>` : ""}
    ${sprig()}
  </header>`;

const labelled = (id, t = {}) => (t.title ? ` aria-labelledby="${id}"` : t.eyebrow ? ` aria-label="${esc(t.eyebrow)}"` : "");

const names = (a, b, cls) =>
  `<span class="${cls}">${esc(a)}</span> <span class="amp" aria-hidden="true">&amp;</span><span class="sr-only"> y </span> <span class="${cls}">${esc(b)}</span>`;

export function hero({ event, venue = {}, locale, copy = {} }) {
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const t = copy.hero || {};
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  const place = [venue.name, venue.city].filter(Boolean).map(esc).join(", ");
  return `
  <section class="hero toile${event.photo ? " hero--photo" : ""}" data-parallax aria-labelledby="hero-names">
    <div class="hero__card">
      ${bow("hero__bow")}
      ${event.photo ? `
      <figure class="hero__photo">
        <img src="${esc(event.photo)}" alt="${esc(event.photoAlt)}"${focus} fetchpriority="high">
      </figure>` : ""}
      <div class="hero__text">
        ${t.eyebrow ? `<p class="script hero__eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h1 class="hero__names" id="hero-names">${names(a, b, "hero__name")}</h1>
        ${sprig("hero__sprig")}
        <p class="caps hero__date">${esc(d.weekday)}<i aria-hidden="true">·</i>${esc(d.dayMonth)}<i aria-hidden="true">·</i>${esc(d.year)}</p>
        <p class="hero__where">${esc(time(event.date))} h${place ? ` · ${place}` : ""}</p>
        ${event.tagline ? `<p class="hero__tagline">${esc(event.tagline)}</p>` : ""}
      </div>
    </div>
  </section>`;
}

export function details(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.details || {};
  const d = dateParts(event.date, locale);
  const days = daysUntil(event.date);
  const countdown = days < 0 ? "" : fill(days === 0 ? t.countdownToday : days === 1 ? t.countdownOne : t.countdown, { days });
  return `
  ${band()}
  <section class="section details"${labelled("details-title", t)}>
    <div class="wrap wrap--wide">
      ${head("details-title", t)}
      <div class="details__grid">
        <article class="plate reveal">
          <span class="cameo" aria-hidden="true"></span>
          <p class="caps label">${esc(t.when || "Cuándo")}</p>
          <p class="plate__big">${esc(d.weekday)}, ${esc(d.dayMonth)} de ${esc(d.year)}</p>
          <p class="plate__sub">${esc(time(event.date))} ${esc(t.timeSuffix || "h")}</p>
          ${countdown ? `<p class="script plate__count">${countdown}</p>` : ""}
          ${t.calendar ? `<a class="link" href="${esc(calendarUrl(config))}" target="_blank" rel="noopener">${esc(t.calendar)}</a>` : ""}
        </article>
        <article class="plate reveal" style="--i:1">
          <span class="cameo cameo--2" aria-hidden="true"></span>
          <p class="caps label">${esc(t.where || "Dónde")}</p>
          <p class="plate__big">${esc(venue.name)}</p>
          ${venue.address ? `<p class="plate__sub">${esc(venue.address)}</p>` : ""}
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
          ${c.photo ? `<figure class="frame chapter__photo"><img src="${esc(c.photo)}" alt="${esc(c.photoAlt || `${a} y ${b}`)}" loading="lazy"></figure>` : ""}
          <div class="chapter__body">
            ${c.meta ? `<p class="script chapter__meta">${esc(c.meta)}</p>` : ""}
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
  <section class="schedule toile" data-parallax${labelled("schedule-title", t)}>
    <div class="ticket reveal">
      ${bow("ticket__bow")}
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

export function gallery({ gallery = [], event, copy = {} }) {
  if (!gallery.length) return "";
  const t = copy.gallery || {};
  const [a, b] = event.couple;
  const photos = gallery.slice(0, 9);
  return `
  ${band()}
  <section class="section gallery"${labelled("gallery-title", t)}>
    <div class="wrap wrap--wide">
      ${head("gallery-title", t)}
      <div class="album" data-count="${Math.min(photos.length, 4)}">${photos.map((src, i) => `
        <figure class="frame reveal" style="--i:${i % 3}"><img src="${esc(src)}" alt="${esc(`${a} y ${b}`)}" loading="lazy"></figure>`).join("")}
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
      <div class="toile-frame reveal">
        <div class="toile-frame__inner">
          ${t.eyebrow ? `<p class="script eyebrow">${esc(t.eyebrow)}</p>` : ""}
          <h2 class="section__title" id="gifts-title">${esc(t.title)}</h2>
          ${sprig()}
          ${t.text ? `<p class="gifts__text">${esc(t.text)}</p>` : ""}
          <details class="iban">
            <summary class="link">${esc(t.reveal || "Ver los datos de la cuenta")}</summary>
            <dl class="iban__data">
              ${gifts.holder ? `<div><dt class="caps label">${esc(t.holderLabel)}</dt><dd>${esc(gifts.holder)}</dd></div>` : ""}
              <div><dt class="caps label">${esc(t.ibanLabel)}</dt><dd class="iban__num" id="iban-value">${esc(raw.match(/.{1,4}/g).join(" "))}</dd></div>
            </dl>
            <button class="link" type="button" data-copy="${esc(raw)}" data-done="${esc(t.copied)}" aria-controls="iban-value"><span data-label aria-live="polite">${esc(t.copy)}</span></button>
          </details>
        </div>
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
    <div class="closing__field toile" data-parallax>
      <div class="ticket closing__card reveal">
        ${bow("ticket__bow")}
        ${hasRsvp ? `
          ${t.eyebrow ? `<p class="script eyebrow">${esc(t.eyebrow)}</p>` : ""}
          <h2 class="section__title" id="closing-title">${esc(t.title)}</h2>
          ${sprig()}
          ${deadline && t.text ? `<p class="closing__text">${fill(t.text, { deadline })}</p>` : ""}
          <button class="button" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button>`
        : `<h2 class="closing__names" id="closing-title">${names(a, b, "closing__name")}</h2>
          ${t.after ? `<p class="closing__text">${esc(t.after)}</p>` : ""}`}
      </div>
    </div>
    <footer class="closing__foot">
      <p class="closing__sign">${esc(a)} <span class="amp" aria-hidden="true">&amp;</span><span class="sr-only">y</span> ${esc(b)}</p>
      <p class="caps label">${esc(dateParts(event.date, locale).year)}</p>
    </footer>
  </section>`;
}
