import { dateParts, time, daysUntil, esc, fill, rsvpClosed } from "./format.js";
import { calendarUrl } from "./calendar.js";

// Plantilla Carrete: fotos analógicas de 35 mm. La portada es un negativo sobre la mesa de
// luz que se revela al entrar; la historia, una hoja de contactos; la galería, copias en papel
// con la fecha naranja de la cámara. DM Serif Display, DM Mono y DM Sans.

/* ---------- utilidades ---------- */

// Fecha de cámara antigua: "12 06 '27", sacada tal cual de event.date (sin zonas horarias).
export function camDate(iso) {
  const s = String(iso || "");
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return "";
  return `${s.slice(8, 10)} ${s.slice(5, 7)} '${s.slice(2, 4)}`;
}

const pad = (n) => String(n).padStart(2, "0");

// Secciones numeradas como fotogramas: el número sale de las que de verdad se pintan,
// así al quitar una la numeración no deja huecos.
const NUMBERED = {
  details: () => true,
  story: (c) => c.story?.chapters?.some((ch) => ch.text),
  schedule: (c) => c.schedule?.length,
  gallery: (c) => c.gallery?.length,
  gifts: (c) => c.gifts?.iban,
};
function numberOf(config, name) {
  const shown = (config.sections || []).filter((s) => NUMBERED[s] && NUMBERED[s](config));
  const i = shown.indexOf(name);
  return i < 0 ? "" : pad(i + 1);
}

function head(config, name, eyebrow, title, id) {
  const n = numberOf(config, name);
  return `
      <header class="head reveal">
        <p class="head__eyebrow">${n ? `<span class="head__no" aria-hidden="true">${n}</span><span class="head__rule" aria-hidden="true"></span>` : ""}${eyebrow ? `<span>${esc(eyebrow)}</span>` : ""}</p>
        ${title ? `<h2 class="head__title" id="${id}">${esc(title)}</h2>` : ""}
      </header>`;
}

const film = (copy) => ({ stock: copy?.film?.stock ?? "FILM 400", end: copy?.film?.end ?? "" });

const led = (iso, extra = "") => {
  const d = camDate(iso);
  return d ? `<span class="led${extra}" aria-hidden="true">${esc(d)}</span>` : "";
};

const arrow = `<span class="link__arrow" aria-hidden="true">→</span>`;

/* ---------- secciones ---------- */

export function hero({ event, venue = {}, gallery = [], locale, copy = {} }) {
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const { stock } = film(copy);
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  const len = Math.max(String(a).length, String(b).length, 5);
  const place = venue.city || venue.name || "";
  // Fotogramas vecinos: negativos de la galería (o de la portada) que asoman arriba y abajo.
  const edge = (n) => `<span class="film__edge film__edge--l" aria-hidden="true">${esc(stock)}</span><span class="film__edge film__edge--r" aria-hidden="true">▸ ${n}<span>${n}A</span></span>`;
  const neg = (src, n) => `<div class="film__frame film__frame--neg" aria-hidden="true"><div class="photo"><img src="${esc(src)}" alt="" decoding="async"></div>${edge(n)}</div>`;
  const before = gallery[0] || event.photo;
  const after = gallery[1] || gallery[0] || event.photo;
  return `
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero__text">
      ${copy.hero?.eyebrow ? `<p class="hero__eyebrow"><span class="hero__tri" aria-hidden="true">▸</span>${esc(copy.hero.eyebrow)}</p>` : ""}
      <h1 class="hero__names" id="hero-title" style="--len:${len}">
        <span class="hero__name">${esc(a)}</span>
        <span class="hero__amp">&amp;</span>
        <span class="hero__name">${esc(b)}</span>
      </h1>
      ${event.tagline ? `<p class="hero__tagline">${esc(event.tagline)}</p>` : ""}
      <p class="hero__meta">
        <span>${esc(d.weekday)} ${esc(d.dayMonth)} ${esc(d.year)}</span>
        ${place ? `<span class="hero__sep" aria-hidden="true"></span><span>${esc(place)}</span>` : ""}
      </p>
    </div>
    <div class="hero__reel">
      <div class="film">
        <div class="film__track">
          ${neg(before, 23)}
          <figure class="film__frame film__frame--main">
            <div class="photo">
              <img src="${esc(event.photo)}" alt="${esc(event.photoAlt || `${a} y ${b}`)}"${focus} fetchpriority="high">
              ${led(event.date, " led--hero")}
            </div>
            ${edge(24)}
          </figure>
          ${neg(after, 25)}
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
  const countdown = days < 0 ? "" : fill(days === 0 ? t.countdownToday : days === 1 ? t.countdownOne : t.countdown, { days });
  return `
  <section class="section details" aria-labelledby="details-title">
    <div class="wrap">
      ${head(config, "details", t.eyebrow, t.title || venue.name || "", "details-title")}
      ${t.intro ? `<p class="lede reveal">${esc(t.intro)}</p>` : ""}
      <dl class="facts">
        <div class="fact reveal">
          <dt class="label">${esc(t.when || "Fecha")}</dt>
          <dd class="fact__big">${esc(d.dayMonth)}</dd>
          <dd class="fact__small">${esc(d.weekday)} · ${esc(d.year)}</dd>
          ${t.calendar ? `<dd><a class="link" href="${esc(calendarUrl(config))}" target="_blank" rel="noopener">${esc(t.calendar)} ${arrow}</a></dd>` : ""}
        </div>
        <div class="fact reveal" style="--i:1">
          <dt class="label">${esc(t.time || "Hora")}</dt>
          <dd class="fact__big">${esc(time(event.date))}<small> ${esc(t.timeSuffix || "h")}</small></dd>
          ${countdown ? `<dd class="counter"><span class="counter__dot" aria-hidden="true"></span>${countdown}</dd>` : ""}
        </div>
        <div class="fact reveal" style="--i:2">
          <dt class="label">${esc(t.where || "Lugar")}</dt>
          <dd class="fact__big">${esc(venue.city || venue.name || "")}</dd>
          ${venue.address ? `<dd class="fact__small">${venue.city && venue.name ? `${esc(venue.name)}<br>` : ""}${esc(venue.address)}</dd>` : ""}
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
  const { stock } = film(copy);
  const count = Math.min(chapters.length, 3);
  return `
  <section class="section story" aria-labelledby="story-title">
    <div class="wrap">
      ${head(config, "story", t.eyebrow, t.title || "", "story-title")}
      <ol class="sheet" data-count="${count}">${chapters.map((c, i) => {
        const n = i + 1;
        return `
        <li class="shot reveal" style="--i:${i % 3}">
          <div class="shot__strip">
            <span class="shot__edge shot__edge--t" aria-hidden="true"><span>▸ ${n}</span><span>${n}A</span></span>
            ${c.photo
              ? `<figure class="shot__frame"><div class="photo"><img src="${esc(c.photo)}" alt="${esc(c.photoAlt || "")}" loading="lazy"></div></figure>`
              : `<div class="shot__frame shot__frame--blank" aria-hidden="true"><span class="shot__num">${pad(n)}</span></div>`}
            <span class="shot__edge shot__edge--b" aria-hidden="true"><span>${esc(stock)}</span><span>${pad(n)}</span></span>
          </div>
          <div class="shot__text">
            <p class="shot__meta"><span class="shot__no" aria-hidden="true">${pad(n)}</span>${c.meta ? `<span>${esc(c.meta)}</span>` : ""}</p>
            <p class="shot__body">${esc(c.text)}</p>
          </div>
        </li>`;
      }).join("")}
      </ol>
    </div>
  </section>`;
}

export function schedule(config) {
  const { schedule = [], copy = {} } = config;
  if (!schedule.length) return "";
  const t = copy.schedule || {};
  return `
  <section class="section schedule" aria-labelledby="schedule-title">
    <div class="wrap">
      ${head(config, "schedule", t.eyebrow, t.title || "", "schedule-title")}
      <ol class="plan">${schedule.map((s, i) => `
        <li class="plan__item reveal" style="--i:${i}">
          <time class="plan__time">${esc(s.time)}</time>
          <span class="plan__what">
            <span class="plan__label">${esc(s.label)}</span>
            ${s.place ? `<span class="plan__place">${esc(s.place)}</span>` : ""}
          </span>
          <span class="plan__no" aria-hidden="true">${pad(i + 1)}A</span>
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

// Giros de las copias: fijos (no aleatorios) para que la página sea siempre igual.
const TILT = [-2.2, 1.6, -0.8, 2.4, -1.6, 0.9];

export function gallery(config) {
  const { gallery = [], event, copy = {} } = config;
  if (!gallery.length) return "";
  const t = copy.gallery || {};
  const [a, b] = event.couple;
  return `
  <section class="section gallery" aria-labelledby="gallery-title">
    <div class="wrap">
      ${head(config, "gallery", t.eyebrow, t.title || "", "gallery-title")}
      <div class="prints" data-count="${Math.min(gallery.length, 4)}">${gallery.map((src, i) => `
        <figure class="print reveal" style="--i:${i % 3};--r:${TILT[i % TILT.length]}deg">
          <div class="print__paper">
            <div class="photo"><img src="${esc(src)}" alt="${esc(`${a} y ${b}`)}" loading="lazy">${led(event.date)}</div>
          </div>
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
    <div class="wrap wrap--narrow">
      ${head(config, "gifts", t.eyebrow, t.title || "", "gifts-title")}
      ${t.text ? `<p class="lede reveal">${esc(t.text)}</p>` : ""}
      <details class="iban reveal">
        <summary class="link">${esc(t.reveal || "Ver los datos de la cuenta")}</summary>
        <div class="iban__card">
          ${gifts.holder ? `<p class="label">${esc(t.holderLabel)}</p><p class="iban__holder">${esc(gifts.holder)}</p>` : ""}
          <p class="label">${esc(t.ibanLabel)}</p>
          <p class="iban__num" id="iban-value">${esc(raw.match(/.{1,4}/g).join(" "))}</p>
          <button class="link" type="button" data-copy="${esc(raw)}" data-done="${esc(t.copied)}" aria-controls="iban-value"><span data-label aria-live="polite">${esc(t.copy)}</span></button>
        </div>
      </details>
    </div>
  </section>`;
}

export function closing({ event, rsvp = {}, sections, locale, copy = {} }) {
  const [a, b] = event.couple;
  const t = copy.closing || {};
  const { stock, end } = film(copy);
  const hasRsvp = sections.includes("rsvp") && !rsvpClosed({ event, rsvp });
  const deadline = rsvp.deadline ? dateParts(rsvp.deadline, locale).dayMonth : "";
  const year = dateParts(event.date, locale).year;
  return `
  <section class="closing" aria-labelledby="closing-title">
    <div class="closing__perf" aria-hidden="true"><span>${esc(stock)}</span><span>▸ 36</span><span>36A</span></div>
    <div class="wrap closing__in">
      ${hasRsvp ? `
        ${t.eyebrow ? `<p class="closing__eyebrow reveal">${esc(t.eyebrow)}</p>` : ""}
        <h2 class="closing__title reveal" id="closing-title">${esc(t.title)}</h2>
        ${deadline && t.text ? `<p class="closing__text reveal">${fill(t.text, { deadline })}</p>` : ""}
        <div class="reveal"><button class="button button--amber" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button></div>`
      : `<h2 class="closing__title closing__title--names reveal" id="closing-title">${esc(a)} <em>&amp;</em> ${esc(b)}</h2>
        ${led(event.date, " led--closing reveal")}`}
    </div>
    <footer class="wrap closing__foot">
      <span>${esc(a)} &amp; ${esc(b)}</span>
      <span aria-hidden="true" class="closing__dot"></span>
      <span>${esc(year)}</span>
      ${end ? `<span class="closing__end">${esc(end)}</span>` : ""}
    </footer>
  </section>`;
}
