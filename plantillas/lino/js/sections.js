import { dateParts, time, daysUntil, esc, fill, rsvpClosed } from "./format.js";
import { calendarUrl } from "./calendar.js";

// Plantilla Lino: minimal cálido, lujo silencioso. Lino, piedra y tierra; fotos con mucho
// espacio alrededor, una serif a tamaño contenido y texto pequeño, espaciado y perfecto.
// Nada de adornos: el ritmo (márgenes, alineaciones, silencios) es el diseño.

const arrow = `<span class="link__arrow" aria-hidden="true">→</span>`;
const link = (href, label) => `<a class="link" href="${esc(href)}" target="_blank" rel="noopener">${esc(label)} ${arrow}</a>`;

// Cabecera de sección: antetítulo pequeño en Inter y título en Instrument Serif.
function head(eyebrow, title, id, cls = "") {
  if (!eyebrow && !title) return "";
  return `
      <header class="head ${cls}">
        ${eyebrow ? `<p class="eyebrow reveal"${title ? "" : ` id="${id}"`}>${esc(eyebrow)}</p>` : ""}
        ${title ? `<h2 class="head__title reveal" style="--i:1" id="${id}">${esc(title)}</h2>` : ""}
      </header>`;
}
const labelled = (t) => (t.eyebrow || t.title ? " aria-labelledby" : "");

// "12 de junio de 2027" en español; en otros idiomas, día y mes seguidos del año.
const longDate = (d, locale = "es") => `${d.dayMonth}${/^(es|ca|gl|pt)/.test(locale) ? " de " : " "}${d.year}`;

/* ---------- portada ---------- */

export function hero({ event, venue = {}, locale, copy = {} }) {
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  const place = [venue.name, venue.city].filter(Boolean).map(esc).join(" · ");
  return `
  <section class="hero">
    <div class="wrap hero__grid">
      <div class="hero__bar">
        <span class="hero__mono" aria-hidden="true">${esc(a[0])}<em>&amp;</em>${esc(b[0])}</span>
        <span class="hero__date">${esc(d.numeric)}</span>
      </div>
      <div class="hero__text">
        ${copy.hero?.eyebrow ? `<p class="eyebrow hero__in" style="--d:.9s">${esc(copy.hero.eyebrow)}</p>` : ""}
        <h1 class="hero__names">
          <span class="hero__name hero__in" style="--d:1.1s">${esc(a)}</span>
          <span class="hero__name hero__in" style="--d:1.35s"><em>&amp;</em> ${esc(b)}</span>
        </h1>
        <span class="hero__rule hero__in" style="--d:1.7s" aria-hidden="true"></span>
        <dl class="hero__meta hero__in" style="--d:1.9s">
          <div><dt class="sr">${esc(copy.details?.when || "Cuándo")}</dt><dd><span class="cap">${esc(d.weekday)}</span>, ${esc(longDate(d, locale))}</dd></div>
          ${place ? `<div><dt class="sr">${esc(copy.details?.where || "Dónde")}</dt><dd>${place}</dd></div>` : ""}
        </dl>
        ${event.tagline ? `<p class="hero__tagline hero__in" style="--d:2.1s">${esc(event.tagline)}</p>` : ""}
      </div>
      <figure class="hero__photo">
        <img src="${esc(event.photo)}" alt="${esc(event.photoAlt)}"${focus} fetchpriority="high">
      </figure>
    </div>
  </section>`;
}

/* ---------- lo esencial ---------- */

export function details(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.details || {};
  const d = dateParts(event.date, locale);
  const days = daysUntil(event.date);
  const countdown = days < 0 ? "" : fill(days === 0 ? t.countdownToday : days === 1 ? t.countdownOne : t.countdown, { days });
  const suffix = t.timeSuffix ? ` ${esc(t.timeSuffix)}` : "";
  return `
  <section class="block details"${labelled(t) && ` aria-labelledby="details-title"`}>
    <div class="wrap">
      ${head(t.eyebrow, t.title, "details-title", "head--center")}
      <dl class="facts">
        <div class="fact reveal">
          <dt class="eyebrow">${esc(t.when || "Cuándo")}</dt>
          <dd class="fact__main"><span class="cap">${esc(d.weekday)}</span>, ${esc(d.dayMonth)}<br>${esc(d.year)}</dd>
          <dd class="fact__sub">${esc(time(event.date))}${suffix}</dd>
          ${t.calendar ? `<dd>${link(calendarUrl(config), t.calendar)}</dd>` : ""}
        </div>
        <div class="fact reveal" style="--i:1">
          <dt class="eyebrow">${esc(t.where || "Dónde")}</dt>
          <dd class="fact__main">${esc(venue.name)}</dd>
          ${venue.address ? `<dd class="fact__sub">${esc(venue.address)}</dd>` : ""}
          ${venue.mapsUrl && t.map ? `<dd>${link(venue.mapsUrl, t.map)}</dd>` : ""}
        </div>
      </dl>
      ${countdown ? `<p class="countdown reveal" style="--i:2">${countdown}</p>` : ""}
    </div>
  </section>`;
}

/* ---------- historia ---------- */

export function story({ story, event, copy = {} }) {
  const chapters = story?.chapters?.filter((c) => c.text) || [];
  if (!chapters.length) return "";
  const t = copy.story || {};
  const [a, b] = event.couple;
  return `
  <section class="block story"${labelled(t) && ` aria-labelledby="story-title"`}>
    <div class="wrap">
      ${head(t.eyebrow, t.title, "story-title", "head--center")}
      <ol class="chapters">${chapters.map((c, i) => `
        <li class="chapter${c.photo ? " chapter--photo" : ""}">
          ${c.photo ? `<figure class="chapter__photo reveal reveal--photo"><img src="${esc(c.photo)}" alt="${esc(c.photoAlt || `${a} y ${b}`)}" loading="lazy"></figure>` : ""}
          <div class="chapter__body">
            ${c.meta ? `<p class="eyebrow reveal">${esc(c.meta)}</p>` : ""}
            <p class="chapter__text reveal" style="--i:1">${esc(c.text)}</p>
          </div>
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

/* ---------- programa ---------- */

export function schedule({ schedule = [], copy = {} }) {
  if (!schedule.length) return "";
  const t = copy.schedule || {};
  return `
  <section class="block schedule"${labelled(t) && ` aria-labelledby="schedule-title"`}>
    <div class="wrap schedule__grid">
      <div class="schedule__head">
        ${head(t.eyebrow, t.title, "schedule-title")}
        ${t.text ? `<p class="schedule__note reveal" style="--i:2">${esc(t.text)}</p>` : ""}
      </div>
      <ol class="timeline">${schedule.map((s, i) => `
        <li class="reveal" style="--i:${i % 2}">
          <time>${esc(s.time)}</time>
          <span class="timeline__what">${esc(s.label)}</span>
          ${s.place ? `<span class="timeline__where">${esc(s.place)}</span>` : ""}
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

/* ---------- galería ---------- */

export function gallery({ gallery = [], event, copy = {} }) {
  if (!gallery.length) return "";
  const t = copy.gallery || {};
  const [a, b] = event.couple;
  return `
  <section class="block gallery"${labelled(t) && ` aria-labelledby="gallery-title"`}>
    <div class="wrap">
      ${head(t.eyebrow, t.title, "gallery-title", "head--center")}
      <div class="photos" data-count="${gallery.length > 2 ? "many" : gallery.length}">${gallery.map((src, i) => `
        <figure class="photo reveal reveal--photo"><img src="${esc(src)}" alt="${esc(`${a} y ${b}`)} · ${i + 1}" loading="lazy"></figure>`).join("")}
      </div>
    </div>
  </section>`;
}

/* ---------- regalo ---------- */

export function gifts({ gifts, copy = {} }) {
  if (!gifts?.iban) return "";
  const t = copy.gifts || {};
  const raw = gifts.iban.replace(/\s+/g, "").toUpperCase();
  return `
  <section class="block gifts"${labelled(t) && ` aria-labelledby="gifts-title"`}>
    <div class="wrap gifts__inner">
      ${head(t.eyebrow, t.title, "gifts-title", "head--center")}
      ${t.text ? `<p class="gifts__text reveal" style="--i:2">${esc(t.text)}</p>` : ""}
      <details class="iban reveal" style="--i:3">
        <summary class="link">${esc(t.reveal || "Ver los datos de la cuenta")}</summary>
        <dl class="iban__card">
          ${gifts.holder ? `<div><dt class="eyebrow">${esc(t.holderLabel)}</dt><dd>${esc(gifts.holder)}</dd></div>` : ""}
          <div><dt class="eyebrow">${esc(t.ibanLabel)}</dt><dd class="iban__num" id="iban-value">${esc(raw.match(/.{1,4}/g).join(" "))}</dd></div>
        </dl>
        <button class="link" type="button" data-copy="${esc(raw)}" data-done="${esc(t.copied)}" aria-controls="iban-value"><span data-label aria-live="polite">${esc(t.copy)}</span></button>
      </details>
    </div>
  </section>`;
}

/* ---------- cierre ---------- */

export function closing({ event, rsvp = {}, sections, locale, copy = {} }) {
  const [a, b] = event.couple;
  const t = copy.closing || {};
  const hasRsvp = sections.includes("rsvp") && !rsvpClosed({ event, rsvp });
  const deadline = rsvp.deadline ? dateParts(rsvp.deadline, locale).dayMonth : "";
  const names = `${esc(a)} <em>&amp;</em> ${esc(b)}`;
  return `
  <section class="closing" aria-labelledby="closing-title">
    <div class="wrap">
      <div class="closing__panel">
        ${hasRsvp && t.eyebrow ? `<p class="eyebrow reveal">${esc(t.eyebrow)}</p>` : ""}
        <h2 class="closing__title reveal${hasRsvp ? "" : " closing__title--names"}" style="--i:1" id="closing-title">${hasRsvp ? esc(t.title) : names}</h2>
        ${hasRsvp && deadline && t.text ? `<p class="closing__text reveal" style="--i:2">${fill(t.text, { deadline })}</p>` : ""}
        ${hasRsvp ? `<div class="reveal" style="--i:3"><button class="button" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button></div>` : ""}
      </div>
      <footer class="foot">
        <span class="foot__names">${names}</span>
        <span>${esc(dateParts(event.date, locale).numeric)}</span>
      </footer>
    </div>
  </section>`;
}
