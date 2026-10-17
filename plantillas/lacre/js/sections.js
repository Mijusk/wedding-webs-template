import { dateParts, time, daysUntil, esc, fill, rsvpClosed } from "./format.js";
import { calendarUrl } from "./calendar.js";
import { sealSvg } from "./seal.js";

// Plantilla Lacre: una invitación de papel de lujo. La portada es la tarjeta que sale del
// sobre (js/enhance.js); el resto, hojas de papel verjurado con filetes en oro viejo.

// Filete con rombo: separa bloques dentro de la tarjeta.
const rule = (cls = "") => `
  <svg class="orn ${cls}" viewBox="0 0 160 12" aria-hidden="true" focusable="false">
    <path d="M0 6H64M96 6H160" stroke="currentColor" stroke-width=".8"/>
    <path d="M80 1.2 84.8 6 80 10.8 75.2 6Z" fill="none" stroke="currentColor" stroke-width=".8"/>
    <circle cx="70" cy="6" r="1.2" fill="currentColor"/><circle cx="90" cy="6" r="1.2" fill="currentColor"/>
  </svg>`;

// Floritura que abre cada sección.
const fleuron = () => `
  <svg class="fleuron" viewBox="0 0 120 24" aria-hidden="true" focusable="false">
    <g fill="none" stroke="currentColor" stroke-width=".9" stroke-linecap="round">
      <path d="M60 12c-6-8-16-9-22-4-4 3-3 9 2 9 4 0 5-5 1-6"/>
      <path d="M60 12c6-8 16-9 22-4 4 3 3 9-2 9-4 0-5-5-1-6"/>
      <path d="M36 12H4M84 12h32"/>
    </g>
    <path d="M60 7.5 64.5 12 60 16.5 55.5 12Z" fill="currentColor"/>
  </svg>`;

const head = (id, t = {}) => `
  <header class="section__head reveal">
    ${fleuron()}
    ${t.eyebrow ? `<p class="caps eyebrow">${esc(t.eyebrow)}</p>` : ""}
    ${t.title ? `<h2 class="section__title" id="${id}">${esc(t.title)}</h2>` : ""}
  </header>`;

const labelled = (id, t = {}) => (t.title ? ` aria-labelledby="${id}"` : t.eyebrow ? ` aria-label="${esc(t.eyebrow)}"` : "");

const names = (a, b, cls) => `<span class="${cls}">${esc(a)}</span><span class="amp" aria-hidden="true">&amp;</span><span class="sr-only"> y </span><span class="${cls}">${esc(b)}</span>`;

export function hero({ event, venue = {}, locale, copy = {} }) {
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const t = copy.hero || {};
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  const place = [venue.name, venue.city].filter(Boolean).map(esc).join(" · ");
  return `
  <section class="hero" aria-labelledby="hero-names">
    <div class="invite">
      <span class="invite__frame" aria-hidden="true"></span>
      ${event.photo ? `
      <figure class="invite__photo">
        <span class="oval"><img src="${esc(event.photo)}" alt="${esc(event.photoAlt)}"${focus} fetchpriority="high"></span>
      </figure>` : ""}
      <div class="invite__text">
        ${t.eyebrow ? `<p class="caps eyebrow invite__eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h1 class="invite__names" id="hero-names">${names(a, b, "invite__name")}</h1>
        ${t.invite ? `<p class="invite__line">${esc(t.invite)}</p>` : ""}
        ${rule("invite__rule")}
        <p class="caps invite__date">${esc(d.weekday)}<i aria-hidden="true">·</i>${esc(d.dayMonth)}<i aria-hidden="true">·</i>${esc(d.year)}</p>
        <p class="invite__where">${esc(time(event.date))} h${place ? ` · ${place}` : ""}</p>
        ${event.tagline ? `<p class="invite__tagline">${esc(event.tagline)}</p>` : ""}
      </div>
    </div>
  </section>`;
}

// Mes de la boda en miniatura, con el día rodeado a mano en burdeos.
function calendar(iso, locale) {
  const [y, m, day] = iso.slice(0, 10).split("-").map(Number);
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const wd = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(locale, { weekday: "narrow", timeZone: "UTC" }));
  const d = dateParts(iso, locale);
  const cells = [
    ...Array.from({ length: offset }, () => `<span></span>`),
    ...Array.from({ length: total }, (_, i) => i + 1 === day
      ? `<span class="cal__day is-day"><svg viewBox="0 0 40 36" aria-hidden="true" focusable="false"><path d="M30 6C24 1 9 2 5 11c-4 9 3 19 15 20 11 1 18-6 17-14-1-7-9-11-17-10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>${i + 1}</span>`
      : `<span>${i + 1}</span>`),
  ];
  return `
    <div class="cal" aria-hidden="true">
      <p class="caps cal__month">${esc(d.month)} ${esc(d.year)}</p>
      <div class="cal__grid">${wd.map((w) => `<span class="cal__wd">${esc(w)}</span>`).join("")}${cells.join("")}</div>
    </div>`;
}

// Plano dibujado a línea: un río, caminos, árboles y el lacre marcando el sitio.
const sketchMap = () => `
  <svg class="map" viewBox="0 0 320 190" aria-hidden="true" focusable="false">
    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <path d="M-4 150c40-14 62-6 96-20s50-44 92-46 70 22 140 2" stroke-width="1.1" opacity=".55"/>
      <path d="M-4 160c42-14 66-6 100-20s48-42 90-44 72 22 138 2" stroke-width=".7" opacity=".4"/>
      <path d="M20 18c50 24 80 40 140 52s100 30 150 74" stroke-width="1.6" opacity=".7"/>
      <path d="M160 70c-8 30-6 60 4 120" stroke-width="1.2" opacity=".6"/>
      <path d="M60 0c8 30 20 50 34 62M250 0c-10 30-30 56-54 76" stroke-width=".9" opacity=".5" stroke-dasharray="3 4"/>
      <path d="M220 104h34v24h-34zM230 110h14" stroke-width=".8" opacity=".55"/>
      <path d="M104 26h22v16h-22zM270 40h20v14h-20z" stroke-width=".7" opacity=".45"/>
    </g>
    <g fill="none" stroke="currentColor" stroke-width=".7" opacity=".5">
      ${[[40, 70], [52, 80], [34, 86], [120, 110], [132, 118], [270, 160], [286, 150], [196, 30], [208, 24], [290, 94]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5"/><path d="M${x} ${y + 5}v4"/>`).join("")}
    </g>
    <g class="map__compass" transform="translate(292 24)">
      <circle r="12" fill="none" stroke="currentColor" stroke-width=".6" opacity=".6"/>
      <path d="M0-10 3 0 0 10-3 0Z" fill="currentColor" opacity=".6"/>
      <text y="-15" text-anchor="middle" font-size="8" font-family="Cinzel, serif" fill="currentColor" opacity=".8">N</text>
    </g>
    <g class="map__pin" transform="translate(178 88)">
      <ellipse cx="0" cy="14" rx="9" ry="2.5" fill="#2b2a28" opacity=".15"/>
      <circle r="11" fill="#7a1f2b"/><circle r="11" fill="none" stroke="#3e0911" stroke-opacity=".5" stroke-width="1"/>
      <circle r="6.5" fill="none" stroke="#f4efe6" stroke-opacity=".6" stroke-width=".8"/>
      <circle cx="-3.5" cy="-4" r="3" fill="#fff" opacity=".2"/>
    </g>
  </svg>`;

export function details(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.details || {};
  const d = dateParts(event.date, locale);
  const days = daysUntil(event.date);
  const countdown = days < 0 ? "" : fill(days === 0 ? t.countdownToday : days === 1 ? t.countdownOne : t.countdown, { days });
  const map = venue.mapsUrl
    ? `<a class="map__link" href="${esc(venue.mapsUrl)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">${sketchMap()}</a>`
    : sketchMap();
  return `
  <section class="section details"${labelled("details-title", t)}>
    <div class="wrap wrap--wide">
      ${head("details-title", t)}
      <div class="details__grid">
        <article class="details__col reveal">
          <p class="caps eyebrow">${esc(t.when || "Cuándo")}</p>
          <p class="details__big">${esc(d.weekday)}, ${esc(d.dayMonth)} de ${esc(d.year)}</p>
          <p class="details__sub">${esc(time(event.date))} ${esc(t.timeSuffix || "h")}${countdown ? ` <span class="details__count">· ${countdown}</span>` : ""}</p>
          ${calendar(event.date, locale)}
          ${t.calendar ? `<a class="link" href="${esc(calendarUrl(config))}" target="_blank" rel="noopener">${esc(t.calendar)}</a>` : ""}
        </article>
        <span class="details__rule" aria-hidden="true"></span>
        <article class="details__col reveal" style="--i:1">
          <p class="caps eyebrow">${esc(t.where || "Dónde")}</p>
          <p class="details__big">${esc(venue.name)}</p>
          ${venue.address ? `<p class="details__sub">${esc(venue.address)}</p>` : ""}
          ${map}
          ${venue.mapsUrl && t.map ? `<a class="link" href="${esc(venue.mapsUrl)}" target="_blank" rel="noopener">${esc(t.map)}</a>` : ""}
        </article>
      </div>
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
          <span class="program__dots" aria-hidden="true"></span>
          <span class="program__what"><span class="program__label">${esc(s.label)}</span>${s.place ? `<span class="program__place">${esc(s.place)}</span>` : ""}</span>
        </li>`).join("")}
      </ol>
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
          ${c.photo ? `<figure class="mount chapter__photo"><img src="${esc(c.photo)}" alt="${esc(c.photoAlt || `${a} y ${b}`)}" loading="lazy"></figure>` : ""}
          <div class="chapter__body">
            ${c.meta ? `<p class="caps eyebrow">${esc(c.meta)}</p>` : ""}
            <p class="chapter__text">${esc(c.text)}</p>
          </div>
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

export function gallery({ gallery = [], event, copy = {} }) {
  if (!gallery.length) return "";
  const t = copy.gallery || {};
  const [a, b] = event.couple;
  const photos = gallery.slice(0, 6);
  return `
  <section class="section gallery"${labelled("gallery-title", t)}>
    <div class="wrap wrap--wide">
      ${head("gallery-title", t)}
      <div class="album" data-count="${photos.length}">${photos.map((src, i) => `
        <figure class="mount reveal" style="--i:${i}"><img src="${esc(src)}" alt="${esc(`${a} y ${b}`)}" loading="lazy"></figure>`).join("")}
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
      <div class="framed reveal">
        ${fleuron()}
        ${t.eyebrow ? `<p class="caps eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h2 class="section__title" id="gifts-title">${esc(t.title)}</h2>
        ${t.text ? `<p class="gifts__text">${esc(t.text)}</p>` : ""}
        <details class="iban">
          <summary class="link">${esc(t.reveal || "Ver los datos de la cuenta")}</summary>
          <dl class="iban__data">
            ${gifts.holder ? `<div><dt class="caps">${esc(t.holderLabel)}</dt><dd>${esc(gifts.holder)}</dd></div>` : ""}
            <div><dt class="caps">${esc(t.ibanLabel)}</dt><dd class="iban__num" id="iban-value">${esc(raw.match(/.{1,4}/g).join(" "))}</dd></div>
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
    <div class="closing__card reveal">
      <span class="invite__frame" aria-hidden="true"></span>
      <div class="closing__seal">${sealSvg(event.couple)}</div>
      ${hasRsvp ? `
        ${t.eyebrow ? `<p class="caps eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h2 class="section__title closing__title" id="closing-title">${esc(t.title)}</h2>
        ${deadline && t.text ? `<p class="closing__text">${fill(t.text, { deadline })}</p>` : ""}
        <button class="button" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button>`
      : `<h2 class="closing__names" id="closing-title">${names(a, b, "closing__name")}</h2>`}
    </div>
    <footer class="closing__foot">
      ${rule()}
      <p class="closing__sign">${esc(a)} <span aria-hidden="true">&amp;</span><span class="sr-only">y</span> ${esc(b)}</p>
      <p class="caps">${esc(dateParts(event.date, locale).year)}</p>
    </footer>
  </section>`;
}
