import { dateParts, time, daysUntil, esc, fill, interpolate, rsvpClosed, weddingPhase } from "./format.js";
import { calendarUrl } from "./calendar.js";

// «Persiana»: una tarde de verano en una casa encalada. La portada es una ventana en la pared con
// una persiana de madera echada; las lamas se entreabren, la luz entra y cae en franjas por la
// pared, y al bajar la persiana sube y deja ver la foto. Por las paredes pasa el sol y la sombra de
// un olivo; las fotos de la historia tienen su propia persiana, que se abre al llegar.
// Aquí solo está el contenido; el movimiento está en js/motion.js.

export const arrow = `<span class="link__arrow" aria-hidden="true">→</span>`;

// Una persiana de madera: barra, lamas, dos cintas y la barra de abajo (y el cordón, si se pide).
// Cada lama sabe su posición (--k de 0 a 1) para abrirse en ola.
export const blind = (n, { cord = false } = {}) => `<div class="blind" aria-hidden="true">
            <div class="blind__body"><div class="blind__slats">${Array.from({ length: n }, (_, i) => `<i class="slat" style="--k:${(i / (n - 1)).toFixed(3)}"></i>`).join("")}</div><i class="blind__bottom"></i><i class="blind__tape blind__tape--l"></i><i class="blind__tape blind__tape--r"></i></div>
            <i class="blind__head"></i>${cord ? `<i class="blind__cord"></i>` : ""}
          </div>`;

const head = ({ eyebrow, title, id, text }) => `
    <header class="head" data-rise>
      ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ""}
      ${title ? `<h2 class="head__title" id="${id}">${esc(title)}</h2>` : ""}
      ${text ? `<p class="head__text">${esc(text)}</p>` : ""}
    </header>`;

// Una ventana con foto y, si lleva lamas, su persiana de madera, que se abre al bajar (js/motion.js).
const windowed = (src, alt = "", { focus = "", slats = 11, cls = "" } = {}) => `
      <figure class="window ${cls}"${slats ? " data-window" : " data-rise"}>
        <div class="window__in">
          <img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async"${focus ? ` style="object-position:${esc(focus)}"` : ""}>
          ${slats ? blind(slats) : ""}
        </div>
      </figure>`;

export function hero(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.hero || {};
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const place = venue.city || venue.name || "";
  const len = Math.max(String(a).length, String(b).length, 4);
  const len2 = Math.max(String(a).length + String(b).length + 2, 9);
  return `
  <section class="hero" data-hero aria-labelledby="hero-title">
    <div class="hero__stage">
      <i class="hero__sun" aria-hidden="true"></i>
      <i class="sunbeam" aria-hidden="true"></i>
      <div class="hero__layout">
        <figure class="casement">
          <div class="casement__in">
            <img src="${esc(event.photo)}" alt="${esc(event.photoAlt || `${a} y ${b}`)}" fetchpriority="high" decoding="async"${event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : ""}>
            ${blind(15, { cord: true })}
          </div>
          <i class="casement__sill" aria-hidden="true"></i>
        </figure>
        <div class="hero__body">
          ${t.eyebrow ? `<p class="eyebrow hero__eyebrow">${esc(t.eyebrow)}</p>` : ""}
          <h1 class="hero__names" id="hero-title" style="--len:${len};--len2:${len2}">
            <span class="hero__name">${esc(a)}</span>
            <span class="hero__amp"><span class="visually-hidden"> y </span><span aria-hidden="true">&amp;</span></span>
            <span class="hero__name">${esc(b)}</span>
          </h1>
          <p class="hero__date"><span class="cap">${esc(d.weekday)}</span>, ${esc(d.dayMonth)} ${esc(d.year)}${place ? ` <span aria-hidden="true">·</span> ${esc(place)}` : ""}</p>
          ${t.hint ? `<p class="hero__hint" aria-hidden="true">${esc(t.hint)}</p>` : ""}
        </div>
      </div>
    </div>
  </section>`;
}

export function details(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.details || {};
  const d = dateParts(event.date, locale);
  const days = daysUntil(event.date);
  const phase = weddingPhase(event);
  const countdown = phase === "after" || days < 0 ? "" : fill(days === 0 ? t.countdownToday : days === 1 ? t.countdownOne : t.countdown, { days });
  const suffix = t.timeSuffix ? ` ${esc(t.timeSuffix)}` : "";
  return `
  <section class="wall details" aria-labelledby="details-title">
    ${event.tagline ? `<p class="tagline" data-rise>${esc(event.tagline)}</p>` : ""}
    ${head({ eyebrow: t.eyebrow, title: t.title, id: "details-title" })}
    <dl class="facts">
      <div class="fact" data-rise>
        <dt class="eyebrow">${esc(t.when || "Cuándo")}</dt>
        <dd class="fact__big"><span class="cap">${esc(d.weekday)}</span>, ${esc(d.dayMonth)}</dd>
        <dd class="fact__small">${esc(d.year)} · ${esc(time(event.date))}${suffix}</dd>
        ${countdown ? `<dd class="fact__note${days === 0 ? " is-today" : ""}">${countdown}</dd>` : ""}
        ${t.calendar && phase === "before" ? `<dd class="fact__link"><a class="link" href="${esc(calendarUrl(config))}" target="_blank" rel="noopener">${esc(t.calendar)} ${arrow}</a></dd>` : ""}
      </div>
      <div class="fact" data-rise>
        <dt class="eyebrow">${esc(t.where || "Dónde")}</dt>
        <dd class="fact__big">${esc(venue.name || venue.city || "")}</dd>
        ${venue.address ? `<dd class="fact__small">${esc(venue.address)}</dd>` : ""}
        ${venue.mapsUrl && t.map ? `<dd class="fact__link"><a class="link" href="${esc(venue.mapsUrl)}" target="_blank" rel="noopener">${esc(t.map)} ${arrow}</a></dd>` : ""}
      </div>
    </dl>
  </section>`;
}

export function story(config) {
  const { story, copy = {} } = config;
  const chapters = story?.chapters?.filter((c) => c.text) || [];
  if (!chapters.length) return "";
  const t = copy.story || {};
  return `
  <section class="wall story" aria-labelledby="story-title">
    ${head({ eyebrow: t.eyebrow, title: t.title, id: "story-title" })}
    <ol class="chapters">${chapters.map((c, i) => `
      <li class="chapter${c.photo ? " has-photo" : ""}${i % 2 ? " is-flip" : ""}">
        ${c.photo ? windowed(c.photo, c.photoAlt || "", { focus: c.photoFocus, slats: 12 }) : `<p class="chapter__num" aria-hidden="true">${String(i + 1).padStart(2, "0")}</p>`}
        <div class="chapter__body" data-rise>
          ${c.meta ? `<p class="chapter__meta">${esc(c.meta)}</p>` : ""}
          <p class="chapter__text">${esc(c.text)}</p>
        </div>
      </li>`).join("")}
    </ol>
  </section>`;
}

// Programa: cada hora se enciende cuando le pasa la franja de sol (js/motion.js).
export function schedule(config) {
  const { schedule = [], copy = {} } = config;
  if (!schedule.length) return "";
  const t = copy.schedule || {};
  return `
  <section class="wall schedule" aria-labelledby="schedule-title">
    ${head({ eyebrow: t.eyebrow, title: t.title, id: "schedule-title" })}
    <ol class="plan">${schedule.map((s) => `
      <li class="plan__item" data-lit>
        <time class="plan__time">${esc(s.time)}</time>
        <div class="plan__what">
          <p class="plan__label">${esc(s.label)}</p>
          ${s.place ? `<p class="plan__place">${esc(s.place)}</p>` : ""}
        </div>
      </li>`).join("")}
    </ol>
    ${t.text ? `<p class="schedule__note" data-rise>${esc(t.text)}</p>` : ""}
  </section>`;
}

export function dresscode(config) {
  const t = config.copy?.dresscode || {};
  if (!t.text) return "";
  const palette = (t.palette || []).filter((c) => c && c.color);
  return `
  <section class="wall dresscode" aria-labelledby="dresscode-title">
    ${head({ eyebrow: t.eyebrow, title: t.title, id: "dresscode-title", text: t.text })}
    ${palette.length ? `
    <div class="swatches-wrap" data-rise>
      ${t.paletteLabel ? `<p class="eyebrow">${esc(t.paletteLabel)}</p>` : ""}
      <ul class="swatches">${palette.map((c) => `<li class="swatch"><span class="swatch__dot" style="--c:${esc(c.color)}"></span><span class="swatch__name">${esc(c.name || "")}</span></li>`).join("")}</ul>
    </div>` : ""}
  </section>`;
}

export function gallery(config) {
  const { gallery = [], event, copy = {} } = config;
  const photos = gallery.filter(Boolean).slice(0, 9);
  if (!photos.length) return "";
  const t = copy.gallery || {};
  const [a, b] = event.couple;
  return `
  <section class="wall gallery" aria-labelledby="gallery-title">
    ${head({ eyebrow: t.eyebrow, title: t.title, id: "gallery-title" })}
    <div class="windows" data-count="${photos.length}">${photos.map((src, i) => windowed(src, `${a} y ${b}`, { focus: i % 2 ? "50% 35%" : "", slats: 0, cls: `is-${i % 3}` })).join("")}
    </div>
  </section>`;
}

export function gifts(config) {
  const { gifts, copy = {} } = config;
  if (!gifts?.iban) return "";
  const t = copy.gifts || {};
  const raw = gifts.iban.replace(/\s+/g, "").toUpperCase();
  return `
  <section class="wall gifts" aria-labelledby="gifts-title">
    ${head({ eyebrow: t.eyebrow, title: t.title, id: "gifts-title", text: t.text })}
    <details class="iban" data-rise>
      <summary class="link">${esc(t.reveal || "Ver los datos de la cuenta")}</summary>
      <div class="iban__card">
        ${gifts.holder ? `<p class="eyebrow">${esc(t.holderLabel)}</p><p class="iban__holder">${esc(gifts.holder)}</p>` : ""}
        <p class="eyebrow">${esc(t.ibanLabel)}</p>
        <p class="iban__num" id="iban-value">${esc(raw.match(/.{1,4}/g).join(" "))}</p>
        <button class="link iban__copy" type="button" data-copy="${esc(raw)}" data-done="${esc(t.copied)}" aria-controls="iban-value"><span data-label aria-live="polite">${esc(t.copy)}</span></button>
      </div>
    </details>
  </section>`;
}

export function closing(config) {
  const { event, rsvp = {}, sections, locale, copy = {} } = config;
  const [a, b] = event.couple;
  const t = copy.closing || {};
  const open = sections.includes("rsvp") && !rsvpClosed({ event, rsvp });
  const phase = weddingPhase(event);
  const deadline = rsvp.deadline ? dateParts(rsvp.deadline, locale).dayMonth : "";
  const late = phase === "today" ? t.today : phase === "after" ? t.after : "";
  const len = Math.max(String(a).length + String(b).length + 3, 8);
  return `
  <section class="wall closing" aria-labelledby="closing-title">
    ${open ? `
    ${head({ eyebrow: t.eyebrow, title: t.title, id: "closing-title", text: deadline && t.text ? interpolate(t.text, { deadline }) : "" })}
    <div class="closing__action" data-rise><button class="button" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button></div>`
    : `
    <header class="head" data-rise>
      <h2 class="closing__names" id="closing-title" style="--len:${len}">${esc(a)} <span class="amp">&amp;</span> ${esc(b)}</h2>
      ${late ? `<p class="head__text">${esc(late)}</p>` : ""}
    </header>`}
  </section>`;
}

export function foot(config) {
  const { event, locale } = config;
  const [a, b] = event.couple;
  const year = dateParts(event.date, locale).year;
  return `
  <footer class="foot">
    <span>${esc(a)} &amp; ${esc(b)}</span>
    <span class="foot__dash" aria-hidden="true"></span>
    <span>${esc(year)}</span>
  </footer>`;
}
