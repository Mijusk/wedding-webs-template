import { dateParts, time, daysUntil, esc, fill, rsvpClosed } from "./format.js";
import { calendarUrl } from "./calendar.js";
import { weddingSunset } from "./sun.js";

// Plantilla Costa: boda de playa elegante. Arena, azul mar, espuma y sal.
// Una línea de horizonte fina recorre la página: nace de la ola de la portada, sostiene
// cada antetítulo, ordena el programa (con la puesta de sol real del día) y cierra la web.

/* ---------- utilidades ---------- */

const arrow = `<span class="link__arrow" aria-hidden="true">→</span>`;

// Sol medio hundido en el horizonte: el único adorno de la plantilla.
const sunIcon = (cls = "") => `<svg class="sun ${cls}" viewBox="0 0 40 22" aria-hidden="true" focusable="false">
  <path class="sun__disc" d="M8 18a12 12 0 0 1 24 0"/>
  <path class="sun__line" d="M0 18H40"/>
  <path class="sun__ray" d="M20 1.5v3.5M6.5 7l2.5 2.5M33.5 7L31 9.5"/>
</svg>`;

// Antetítulo sobre la línea de horizonte, que va de borde a borde de la pantalla.
function horizon(eyebrow, cls = "") {
  return `<div class="horizon reveal ${cls}" aria-hidden="${eyebrow ? "false" : "true"}">
      <span class="horizon__line"></span>
      ${eyebrow ? `<p class="eyebrow horizon__label">${esc(eyebrow)}</p>` : `<span class="horizon__dot"></span>`}
      <span class="horizon__line"></span>
    </div>`;
}

function head(eyebrow, title, id, text = "") {
  return `
      <header class="head">
        ${horizon(eyebrow)}
        ${title ? `<h2 class="head__title reveal" id="${id}">${esc(title)}</h2>` : ""}
        ${text ? `<p class="head__text reveal">${esc(text)}</p>` : ""}
      </header>`;
}

// "18:00" → minutos. Las horas que vuelven atrás respecto a la anterior son de madrugada (+24 h).
const toMinutes = (s) => {
  const m = String(s || "").match(/(\d{1,2})[:.h](\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

/* ---------- secciones ---------- */

export function hero({ event, venue = {}, locale, copy = {} }) {
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  const len = Math.max(String(a).length, String(b).length, 5);
  const total = String(a).length + String(b).length + 3;
  const place = venue.city || venue.name || "";
  return `
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero__text">
      ${copy.hero?.eyebrow ? `<p class="eyebrow hero__eyebrow">${esc(copy.hero.eyebrow)}</p>` : ""}
      <h1 class="hero__names" id="hero-title" style="--len:${len};--total:${total}">
        <span class="hero__name">${esc(a)}</span>
        <span class="hero__amp">&amp;</span>
        <span class="hero__name">${esc(b)}</span>
      </h1>
      <div class="hero__sea" aria-hidden="true">
        <svg class="wave" viewBox="0 0 1440 60" preserveAspectRatio="none" focusable="false">
          <path class="wave__path" pathLength="1" d="M0 30C60 30 90 12 150 12S240 48 300 48 390 12 450 12 540 48 600 48 690 12 750 12 840 48 900 48 990 12 1050 12 1140 48 1200 48 1290 12 1350 12 1410 30 1440 30"/>
        </svg>
      </div>
      <p class="hero__meta">
        <span class="hero__date">${esc(d.day)} <span class="hero__sep">·</span> ${esc(d.month)} <span class="hero__sep">·</span> ${esc(d.year)}</span>
        ${place ? `<span class="hero__place">${esc(place)}</span>` : ""}
      </p>
    </div>
    <figure class="hero__photo">
      <img src="${esc(event.photo)}" alt="${esc(event.photoAlt)}"${focus} fetchpriority="high">
    </figure>
  </section>`;
}

export function details(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.details || {};
  const d = dateParts(event.date, locale);
  const days = daysUntil(event.date);
  const countdown = days < 0 ? "" : fill(days === 0 ? t.countdownToday : days === 1 ? t.countdownOne : t.countdown, { days });
  const sun = weddingSunset(config);
  const suffix = t.timeSuffix ? ` ${esc(t.timeSuffix)}` : "";
  return `
  <section class="section details" aria-labelledby="details-title">
    ${head(t.eyebrow, t.title || "", "details-title", t.intro)}
    <div class="wrap">
      <dl class="facts">
        <div class="fact reveal">
          <dt class="eyebrow">${esc(t.when || "Cuándo")}</dt>
          <dd class="fact__big"><span class="cap">${esc(d.weekday)}</span>, ${esc(d.dayMonth)}</dd>
          <dd class="fact__small">${esc(d.year)} · ${esc(time(event.date))}${suffix}</dd>
          ${countdown ? `<dd class="fact__note">${countdown}</dd>` : ""}
          ${t.calendar ? `<dd class="fact__link"><a class="link" href="${esc(calendarUrl(config))}" target="_blank" rel="noopener">${esc(t.calendar)} ${arrow}</a></dd>` : ""}
        </div>
        <div class="fact reveal" style="--i:1">
          <dt class="eyebrow">${esc(t.where || "Dónde")}</dt>
          <dd class="fact__big">${esc(venue.name || venue.city || "")}</dd>
          ${venue.address ? `<dd class="fact__small">${esc(venue.address)}</dd>` : ""}
          ${venue.mapsUrl && t.map ? `<dd class="fact__link"><a class="link" href="${esc(venue.mapsUrl)}" target="_blank" rel="noopener">${esc(t.map)} ${arrow}</a></dd>` : ""}
        </div>
      </dl>
      ${sun && t.sunset ? `
      <p class="sunset reveal">
        ${sunIcon("sunset__icon")}
        <span class="sunset__text">${fill(t.sunset, { time: sun.label, place: venue.city || venue.name || "" })}</span>
      </p>` : ""}
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
    ${head(t.eyebrow, t.title || "", "story-title")}
    <div class="wrap">
      <ol class="chapters">${chapters.map((c) => `
        <li class="chapter reveal${c.photo ? " has-photo" : ""}">
          ${c.photo ? `<figure class="chapter__photo"><img src="${esc(c.photo)}" alt="${esc(c.photoAlt || "")}" loading="lazy"></figure>` : ""}
          <div class="chapter__body">
            ${c.meta ? `<p class="eyebrow chapter__meta">${esc(c.meta)}</p>` : ""}
            <p class="chapter__text">${esc(c.text)}</p>
          </div>
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

// Programa con la puesta de sol intercalada en su sitio por hora.
export function schedule(config) {
  const { schedule = [], copy = {} } = config;
  if (!schedule.length) return "";
  const t = copy.schedule || {};
  let prev = -Infinity, day = 0;
  const items = schedule.map((s) => {
    let m = toMinutes(s.time);
    if (Number.isFinite(m)) {
      if (m + day < prev) day += 1440;
      m += day;
      prev = m;
    }
    return { ...s, m };
  });
  const sun = weddingSunset(config);
  if (sun && t.sunset) {
    // La puesta de sol es siempre por la tarde: si el programa empieza de madrugada no se cuela antes.
    const at = items.findIndex((s) => Number.isFinite(s.m) && s.m > sun.minutes);
    const item = { time: sun.label, label: t.sunset, place: t.sunsetNote || "", sun: true };
    items.splice(at < 0 ? items.length : at, 0, item);
  }
  const wide = items.length <= 6 ? " plan--wide" : "";
  return `
  <section class="section schedule" aria-labelledby="schedule-title">
    ${head(t.eyebrow, t.title || "", "schedule-title", t.text)}
    <div class="wrap">
      <ol class="plan${wide}" style="--n:${items.length}">${items.map((s, i) => `
        <li class="plan__item reveal${s.sun ? " plan__item--sun" : ""}" style="--i:${i}">
          <time class="plan__time">${esc(s.time)}</time>
          <span class="plan__mark" aria-hidden="true">${s.sun ? sunIcon("plan__sun") : ""}</span>
          <span class="plan__what"><span class="plan__label">${esc(s.label)}</span>${s.place ? `<span class="plan__place">${esc(s.place)}</span>` : ""}</span>
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

// Cómo llegar: lugar, dirección, una nota práctica y el mapa.
export function travel(config) {
  const { venue = {}, copy = {} } = config;
  const t = copy.travel || {};
  if (!venue.address && !venue.mapsUrl) return "";
  const notes = (t.notes || []).filter((n) => n && n.text);
  return `
  <section class="section travel" aria-labelledby="travel-title">
    ${head(t.eyebrow, t.title || "", "travel-title")}
    <div class="wrap travel__in">
      <div class="travel__place reveal">
        ${venue.name ? `<p class="travel__name">${esc(venue.name)}</p>` : ""}
        ${venue.address ? `<p class="travel__address">${esc(venue.address)}</p>` : ""}
        ${venue.mapsUrl ? `<a class="button button--line" href="${esc(venue.mapsUrl)}" target="_blank" rel="noopener">${esc(t.map || copy.details?.map || "Abrir el mapa")} ${arrow}</a>` : ""}
      </div>
      ${t.text || notes.length ? `
      <div class="travel__notes reveal" style="--i:1">
        ${t.text ? `<p class="travel__text">${esc(t.text)}</p>` : ""}
        ${notes.length ? `<dl class="notes">${notes.map((n) => `
          <div class="note">${n.title ? `<dt class="eyebrow">${esc(n.title)}</dt>` : ""}<dd>${esc(n.text)}</dd></div>`).join("")}
        </dl>` : ""}
      </div>` : ""}
    </div>
  </section>`;
}

export function gallery(config) {
  const { gallery = [], event, copy = {} } = config;
  if (!gallery.length) return "";
  const t = copy.gallery || {};
  const [a, b] = event.couple;
  const n = gallery.length;
  const cols = n === 1 ? 1 : n === 2 || n === 4 ? 2 : 3;
  return `
  <section class="section gallery" aria-labelledby="gallery-title">
    ${head(t.eyebrow, t.title || "", "gallery-title")}
    <div class="wrap">
      <div class="photos${n % 2 ? " is-odd" : ""}" data-count="${n}" style="--cols:${cols}">${gallery.map((src, i) => `
        <figure class="photos__item reveal" style="--i:${i % 3}">
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
    ${head(t.eyebrow, t.title || "", "gifts-title", t.text)}
    <div class="wrap">
      <details class="iban reveal">
        <summary class="link">${esc(t.reveal || "Ver los datos de la cuenta")}</summary>
        <div class="iban__card">
          ${gifts.holder ? `<p class="eyebrow">${esc(t.holderLabel)}</p><p class="iban__holder">${esc(gifts.holder)}</p>` : ""}
          <p class="eyebrow">${esc(t.ibanLabel)}</p>
          <p class="iban__num" id="iban-value">${esc(raw.match(/.{1,4}/g).join(" "))}</p>
          <button class="link iban__copy" type="button" data-copy="${esc(raw)}" data-done="${esc(t.copied)}" aria-controls="iban-value"><span data-label aria-live="polite">${esc(t.copy)}</span></button>
        </div>
      </details>
    </div>
  </section>`;
}

export function closing(config) {
  const { event, rsvp = {}, sections, locale, copy = {} } = config;
  const [a, b] = event.couple;
  const t = copy.closing || {};
  const hasRsvp = sections.includes("rsvp") && !rsvpClosed({ event, rsvp });
  const deadline = rsvp.deadline ? dateParts(rsvp.deadline, locale).dayMonth : "";
  const year = dateParts(event.date, locale).year;
  const len = Math.max(String(a).length, String(b).length, 5);
  return `
  <section class="closing" aria-labelledby="closing-title">
    <div class="closing__sky">
      <div class="wrap closing__in">
        ${hasRsvp ? `
          ${t.eyebrow ? `<p class="eyebrow reveal">${esc(t.eyebrow)}</p>` : ""}
          <h2 class="closing__title reveal" id="closing-title">${esc(t.title)}</h2>
          ${deadline && t.text ? `<p class="closing__text reveal">${fill(t.text, { deadline })}</p>` : ""}
          <div class="closing__action reveal"><button class="button" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button></div>`
        : `<h2 class="closing__title closing__title--names reveal" id="closing-title" style="--len:${len}">${esc(a)} <span class="closing__amp">&amp;</span> ${esc(b)}</h2>
           ${t.after ? `<p class="closing__text reveal">${esc(t.after)}</p>` : ""}`}
      </div>
      <div class="closing__horizon reveal" aria-hidden="true">${sunIcon("closing__sun")}</div>
    </div>
    <footer class="closing__foot">
      <div class="wrap closing__foot-in">
        <span>${esc(a)} &amp; ${esc(b)}</span>
        <span class="closing__dash" aria-hidden="true"></span>
        <span>${esc(year)}</span>
      </div>
    </footer>
  </section>`;
}
