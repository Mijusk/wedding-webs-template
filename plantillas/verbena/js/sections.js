import { dateParts, time, daysUntil, esc, fill, interpolate, rsvpClosed } from "./format.js";
import { calendarUrl } from "./calendar.js";

// Plantilla Verbena: la boda como una fiesta de pueblo. Colores a tope, banderines, pegatinas,
// una cinta que no para de correr y fotos torcidas como en la nevera.
const COLORS = ["tomato", "cobalt", "lemon", "pink"];

// Banderines de papel picado: un triángulo por color, repetidos a lo ancho.
const bunting = () => `
  <svg class="bunting" viewBox="0 0 1200 70" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 6 Q600 46 1200 6" fill="none" stroke="currentColor" stroke-width="2"/>
    ${Array.from({ length: 16 }, (_, i) => {
      const x = 20 + i * 74, y = 6 + 40 * (1 - Math.pow((x - 600) / 600, 2));
      return `<path class="flag flag--${COLORS[i % 4]}" style="--f:${i}" d="M${x - 24} ${y - 2} L${x + 24} ${y - 2} L${x} ${y + 40} Z"/>`;
    }).join("")}
  </svg>`;

function marquee({ event, venue = {}, locale, copy = {} }) {
  if (!copy.marquee) return "";
  const d = dateParts(event.date, locale);
  const text = esc(interpolate(copy.marquee, { date: `${d.dayMonth} ${d.year}`, city: venue.city || venue.name || "" }));
  // Dos copias seguidas: al llegar a la mitad se vuelve al principio sin que se note.
  const run = `<span>${text}&nbsp;</span>`.repeat(3);
  return `<div class="marquee" aria-hidden="true"><div class="marquee__track">${run}${run}</div></div>`;
}

export function hero(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const stickers = copy.hero?.stickers || [];
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  return `
  <section class="hero">
    ${bunting()}
    <div class="wrap hero__grid">
      <div class="hero__text">
        <p class="hero__eyebrow">${esc(copy.hero?.eyebrow || "")}</p>
        <h1 class="hero__names">
          <span class="hero__name hero__name--a">${esc(a)}</span>
          <span class="hero__amp" aria-label="y">&amp;</span>
          <span class="hero__name hero__name--b">${esc(b)}</span>
        </h1>
        <p class="hero__date"><span>${esc(d.day)}</span> ${esc(d.month)} <span>${esc(d.year)}</span></p>
        ${event.tagline ? `<p class="hero__tagline">${esc(event.tagline)}</p>` : ""}
      </div>
      <figure class="hero__photo">
        <div class="hero__frame"><img src="${esc(event.photo)}" alt="${esc(event.photoAlt)}"${focus} fetchpriority="high"></div>
        ${stickers.slice(0, 3).map((s, i) => `<span class="sticker sticker--${i + 1}" aria-hidden="true">${esc(s)}</span>`).join("")}
      </figure>
    </div>
    ${marquee(config)}
  </section>`;
}

export function details(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.details || {};
  const d = dateParts(event.date, locale);
  const days = daysUntil(event.date);
  const big = days > 1 ? String(days) : "";
  const word = days === 1 ? t.countdownOne : days === 0 ? t.countdownToday : "";
  return `
  <section class="block details" aria-labelledby="details-title">
    <div class="wrap">
      <p class="kicker reveal" id="details-title">${esc(t.eyebrow)}</p>
      <div class="cards">
        <article class="card card--tomato reveal">
          <p class="card__label">${esc(t.when)}</p>
          <p class="card__big">${esc(d.weekday)}<br>${esc(d.dayMonth)}</p>
          <p>${esc(time(event.date))} ${esc(t.timeSuffix || "h")}</p>
          ${t.calendar ? `<a class="chip" href="${esc(calendarUrl(config))}" target="_blank" rel="noopener">${esc(t.calendar)}</a>` : ""}
        </article>
        ${big || word ? `
        <article class="card card--lemon card--count reveal" style="--i:1">
          ${big ? `<p class="count" data-count="${big}">${big}</p><p class="card__label">${esc(t.countdownLabel || "")}</p>` : `<p class="card__big">${esc(word)}</p>`}
        </article>` : ""}
        <article class="card card--cobalt reveal" style="--i:2">
          <p class="card__label">${esc(t.where)}</p>
          <p class="card__big">${esc(venue.name)}</p>
          ${venue.address ? `<p>${esc(venue.address)}</p>` : ""}
          ${venue.mapsUrl && t.map ? `<a class="chip" href="${esc(venue.mapsUrl)}" target="_blank" rel="noopener">${esc(t.map)}</a>` : ""}
        </article>
      </div>
    </div>
  </section>`;
}

export function story({ story, copy = {} }) {
  const chapters = story?.chapters?.filter((c) => c.text) || [];
  if (!chapters.length) return "";
  return `
  <section class="block story" aria-labelledby="story-title">
    <div class="wrap">
      <p class="kicker reveal" id="story-title">${esc(copy.story?.eyebrow || "")}</p>
      <ol class="bubbles">${chapters.map((c, i) => `
        <li class="bubble bubble--${COLORS[i % 4]} reveal" style="--i:${i}">
          ${c.meta ? `<p class="card__label">${esc(c.meta)}</p>` : ""}<p>${esc(c.text)}</p>
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

export function gallery({ gallery = [], event, copy = {} }) {
  if (!gallery.length) return "";
  const [a, b] = event.couple;
  return `
  <section class="block gallery" aria-labelledby="gallery-title">
    <div class="wrap">
      <p class="kicker reveal" id="gallery-title">${esc(copy.gallery?.eyebrow || "")}</p>
      <div class="polaroids">${gallery.slice(0, 4).map((src, i) => `
        <figure class="polaroid reveal" style="--i:${i}"><img src="${esc(src)}" alt="${esc(`${a} y ${b}`)}" loading="lazy"></figure>`).join("")}
      </div>
    </div>
  </section>`;
}

export function schedule({ schedule = [], copy = {} }) {
  if (!schedule.length) return "";
  const t = copy.schedule || {};
  return `
  <section class="block schedule" aria-labelledby="schedule-title">
    <div class="wrap">
      <p class="kicker reveal">${esc(t.eyebrow || "")}</p>
      <h2 class="title reveal" id="schedule-title">${esc(t.title || "")}</h2>
      <ol class="plan">${schedule.map((s, i) => `
        <li class="plan__item card--${COLORS[i % 4]} reveal" style="--i:${i}">
          <time>${esc(s.time)}</time><strong>${esc(s.label)}</strong>${s.place ? `<span>${esc(s.place)}</span>` : ""}
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

export function gifts({ gifts, copy = {} }) {
  if (!gifts?.iban) return "";
  const t = copy.gifts || {};
  const raw = gifts.iban.replace(/\s+/g, "").toUpperCase();
  return `
  <section class="block gifts" aria-labelledby="gifts-title">
    <div class="wrap gifts__in reveal">
      <span class="burst" aria-hidden="true">${esc(t.eyebrow || "")}</span>
      <h2 class="title" id="gifts-title">${esc(t.title)}</h2>
      ${t.text ? `<p>${esc(t.text)}</p>` : ""}
      <details class="iban">
        <summary class="chip">${esc(t.reveal || "Ver los datos de la cuenta")}</summary>
        ${gifts.holder ? `<p><span class="card__label">${esc(t.holderLabel)}</span> ${esc(gifts.holder)}</p>` : ""}
        <p><span class="card__label">${esc(t.ibanLabel)}</span> <span class="iban__num" id="iban-value">${esc(raw.match(/.{1,4}/g).join(" "))}</span></p>
        <button class="chip" type="button" data-copy="${esc(raw)}" data-done="${esc(t.copied)}" aria-controls="iban-value"><span data-label aria-live="polite">${esc(t.copy)}</span></button>
      </details>
    </div>
  </section>`;
}

export function closing(config) {
  const { event, venue = {}, rsvp = {}, sections, locale, copy = {} } = config;
  const [a, b] = event.couple;
  const t = copy.closing || {};
  const d = dateParts(event.date, locale);
  const hasRsvp = sections.includes("rsvp") && !rsvpClosed({ event, rsvp });
  const deadline = rsvp.deadline ? dateParts(rsvp.deadline, locale).dayMonth : "";
  return `
  <section class="closing" aria-labelledby="closing-title">
    ${marquee(config)}
    <div class="wrap closing__in">
      <p class="kicker reveal">${fill(t.eyebrow, { date: `${d.dayMonth} ${d.year}`, city: venue.city || "" })}</p>
      <h2 class="closing__title reveal" id="closing-title">${esc(hasRsvp ? t.title : `${a} & ${b}`)}</h2>
      ${hasRsvp && deadline && t.text ? `<p class="reveal">${fill(t.text, { deadline })}</p>` : ""}
      ${hasRsvp ? `<div class="reveal"><button class="button button--big" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button></div>` : ""}
    </div>
    ${bunting()}
    <p class="closing__foot">${esc(a)} &amp; ${esc(b)} ✺ ${esc(d.year)}</p>
  </section>`;
}
