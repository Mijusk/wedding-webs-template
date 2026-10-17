import { dateParts, time, daysUntil, esc, fill, interpolate, rsvpClosed } from "./format.js";
import { calendarUrl } from "./calendar.js";
import { skyMap, skyMoment, coords, place } from "./sky.js";

// Plantilla Estrellas: el cielo de esa noche. La portada es el mapa real de las estrellas
// sobre el lugar de la boda (js/sky.js), en dorado sobre azul tinta, como una lámina.

// Estrella de cuatro puntas, el adorno de toda la web.
const STAR = `<svg class="spark" viewBox="-10 -10 20 20" aria-hidden="true" focusable="false"><path d="M0-10C.8-2.2 2.2-.8 10 0 2.2.8.8 2.2 0 10-.8 2.2-2.2.8-10 0-2.2-.8-.8-2.2 0-10Z"/></svg>`;
const ORN = `<span class="orn" aria-hidden="true"><i></i>${STAR}<i></i></span>`;
const ext = `target="_blank" rel="noopener"`;
const cap = (s) => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : "");

// Los nombres largos bajan de cuerpo para no desbordar.
function fit(names) {
  const longest = Math.max(...names.flatMap((n) => String(n).split(/\s+/)).map((w) => w.length));
  const total = names.join(" ").length;
  const k = longest <= 7 ? 1 : longest <= 9 ? 0.88 : longest <= 11 ? 0.76 : 0.64;
  return total > 24 ? Math.min(k, 0.8) : k;
}

function head(id, t = {}) {
  if (!t.eyebrow && !t.title) return "";
  return `
      <header class="head reveal">
        ${ORN}
        ${t.eyebrow ? `<p class="eyebrow"${t.title ? "" : ` id="${id}"`}>${esc(t.eyebrow)}</p>` : ""}
        ${t.title ? `<h2 class="title" id="${id}">${esc(t.title)}</h2>` : ""}
      </header>`;
}
const section = (cls, id, t = {}, body) => `
  <section class="sec ${cls}"${t.eyebrow || t.title ? ` aria-labelledby="${id}"` : ""}>
    <div class="wrap">${head(id, t)}${body}</div>
  </section>`;

// ---------------------------------------------------------------------------

export function hero(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const [a, b] = event.couple;
  const t = copy.hero || {};
  const d = dateParts(event.date, locale);
  const where = venue.city || venue.name || "";
  const p = place(venue);
  const { clock } = skyMoment(event.date);
  const label = interpolate(t.skyLabel || "Mapa de las estrellas sobre {place} la noche del {date}, a las {time}", { place: where, date: `${d.dayMonth} de ${d.year}`, time: clock });
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  return `
  <section class="hero" aria-labelledby="hero-names">
    <div class="hero__map">${skyMap(config, { label })}</div>
    <div class="hero__text">
      ${t.eyebrow ? `<p class="eyebrow hero__eyebrow anim" style="--d:.7s">${esc(t.eyebrow)}</p>` : ""}
      <h1 class="hero__names anim" id="hero-names" style="--d:.85s;--fit:${fit([a, b])}">
        <span>${esc(a)}</span> <em>&amp;</em> <span>${esc(b)}</span>
      </h1>
      <p class="hero__date anim" style="--d:1.05s"><time datetime="${esc(event.date.slice(0, 10))}">${esc(cap(d.weekday))}, ${esc(d.dayMonth)} de ${esc(d.year)}</time></p>
      <p class="hero__coords anim" style="--d:1.2s">
        ${where ? `<span>${esc(where)}</span>` : ""}${where && p.known ? `<i aria-hidden="true">·</i>` : ""}${p.known ? `<span>${esc(coords(p.lat, p.lon))}</span>` : ""}
      </p>
      ${t.sky ? `<p class="hero__note anim" style="--d:1.35s">${fill(t.sky, { time: clock })}</p>` : ""}
    </div>
  </section>
  ${event.photo ? `
  <section class="portrait" aria-label="${esc(event.photoAlt || `${a} y ${b}`)}">
    <figure class="portrait__frame reveal">
      <img src="${esc(event.photo)}" alt="${esc(event.photoAlt || "")}"${focus} fetchpriority="high">
    </figure>
    ${event.tagline ? `<p class="portrait__tagline reveal">${esc(event.tagline)}</p>` : ""}
  </section>` : event.tagline ? `
  <section class="portrait"><p class="portrait__tagline reveal">${esc(event.tagline)}</p></section>` : ""}`;
}

export function details(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.details || {};
  const d = dateParts(event.date, locale);
  const days = daysUntil(event.date);
  const countdown = days < 0 ? "" : fill(days === 0 ? t.countdownToday : days === 1 ? t.countdownOne : t.countdown, { days });
  const link = (href, label) => (href && label ? `<a class="link" href="${esc(href)}" ${ext}>${esc(label)}</a>` : "");
  return section("details", "details-title", t, `
    <dl class="facts">
      <div class="fact reveal">
        <dt class="eyebrow">${esc(t.when || "Cuándo")}</dt>
        <dd class="fact__main">${esc(d.dayMonth)}</dd>
        <dd class="fact__sub">${esc(cap(d.weekday))}, ${esc(d.year)}</dd>
        <dd>${link(calendarUrl(config), t.calendar)}</dd>
      </div>
      <div class="fact reveal" style="--i:1">
        <dt class="eyebrow">${esc(t.time || "Hora")}</dt>
        <dd class="fact__main">${esc(time(event.date))}${t.timeSuffix ? `<small> ${esc(t.timeSuffix)}</small>` : ""}</dd>
        ${countdown ? `<dd class="fact__sub fact__count">${countdown}</dd>` : ""}
      </div>
      <div class="fact reveal" style="--i:2">
        <dt class="eyebrow">${esc(t.where || "Dónde")}</dt>
        <dd class="fact__main">${esc(venue.name)}</dd>
        ${venue.address ? `<dd class="fact__sub">${esc(venue.address)}</dd>` : ""}
        <dd>${link(venue.mapsUrl, t.map)}</dd>
      </div>
    </dl>`);
}

export function story({ story, copy = {} }) {
  const chapters = story?.chapters?.filter((c) => c && String(c.text || "").trim()) || [];
  if (!chapters.length) return "";
  return section("story", "story-title", copy.story, `
    <ol class="chapters">${chapters.map((c) => `
      <li class="chapter reveal${c.photo ? " has-photo" : ""}">
        ${c.photo ? `<figure class="gold-frame chapter__photo"><img src="${esc(c.photo)}" alt="${esc(c.photoAlt || "")}" loading="lazy"></figure>` : ""}
        <div class="chapter__body">
          ${c.meta ? `<p class="chapter__meta">${esc(c.meta)}</p>` : ""}
          <p class="chapter__text">${esc(c.text)}</p>
        </div>
      </li>`).join("")}
    </ol>`);
}

// El programa, como una constelación: cada momento es una estrella unida a la siguiente.
export function schedule({ schedule = [], copy = {} }) {
  const items = (schedule || []).filter((s) => s && (s.label || s.time));
  if (!items.length) return "";
  return section("schedule", "schedule-title", copy.schedule, `
    <ol class="program">${items.map((s, i) => `
      <li class="reveal" style="--i:${i}">
        <span class="program__dot" aria-hidden="true">${STAR}</span>
        ${s.time ? `<time class="program__time">${esc(s.time)}</time>` : ""}
        <span class="program__what">${esc(s.label)}</span>
        ${s.place ? `<span class="program__where">${esc(s.place)}</span>` : ""}
      </li>`).join("")}
    </ol>`);
}

export function gallery({ gallery = [], event, copy = {} }) {
  const photos = (gallery || []).filter(Boolean).slice(0, 6);
  if (!photos.length) return "";
  const [a, b] = event.couple;
  return section("gallery", "gallery-title", copy.gallery, `
    <div class="photos" data-count="${photos.length}">${photos.map((src, i) => `
      <figure class="gold-frame reveal" style="--i:${i % 3}"><img src="${esc(src)}" alt="${esc(`${a} y ${b}`)}" loading="lazy"></figure>`).join("")}
    </div>`);
}

export function gifts({ gifts, copy = {} }) {
  if (!gifts?.iban) return "";
  const t = copy.gifts || {};
  const raw = String(gifts.iban).replace(/\s+/g, "").toUpperCase();
  return section("gifts", "gifts-title", t, `
    ${t.text ? `<p class="lead reveal">${esc(t.text)}</p>` : ""}
    <details class="iban reveal">
      <summary class="link">${esc(t.reveal || "Ver los datos de la cuenta")}</summary>
      <div class="iban__card">
        ${gifts.holder ? `<p class="eyebrow">${esc(t.holderLabel || "Titular")}</p><p class="iban__holder">${esc(gifts.holder)}</p>` : ""}
        <p class="eyebrow">${esc(t.ibanLabel || "IBAN")}</p>
        <p class="iban__num" id="iban-value">${esc(raw.match(/.{1,4}/g).join(" "))}</p>
        <button class="link" type="button" data-copy="${esc(raw)}" data-done="${esc(t.copied)}" aria-controls="iban-value"><span data-label aria-live="polite">${esc(t.copy)}</span></button>
      </div>
    </details>`);
}

export function closing(config) {
  const { event, venue = {}, rsvp = {}, sections, locale, copy = {} } = config;
  const [a, b] = event.couple;
  const t = copy.closing || {};
  const hasRsvp = sections.includes("rsvp") && !rsvpClosed({ event, rsvp });
  const deadline = rsvp.deadline ? dateParts(rsvp.deadline, locale).dayMonth.replace(/ /g, " ") : "";
  const year = dateParts(event.date, locale).year;
  const p = place(venue);
  return `
  <section class="closing" aria-labelledby="closing-title">
    <div class="wrap">
      <div class="reveal">${ORN}</div>
      ${hasRsvp && t.eyebrow ? `<p class="eyebrow reveal">${esc(t.eyebrow)}</p>` : ""}
      <h2 class="closing__title reveal${hasRsvp ? "" : " is-names"}" id="closing-title" style="--fit:${fit([a, b])}">${hasRsvp ? esc(t.title) : `<span>${esc(a)}</span> <em>&amp;</em> <span>${esc(b)}</span>`}</h2>
      ${hasRsvp && deadline && t.text ? `<p class="lead reveal">${fill(t.text, { deadline })}</p>` : ""}
      ${hasRsvp ? `<div class="reveal"><button class="button" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button></div>` : ""}
    </div>
    <footer class="closing__foot">
      <span>${esc(a)} &amp; ${esc(b)}</span>${STAR}<span>${esc(year)}</span>${p.known ? `${STAR}<span>${esc(coords(p.lat, p.lon))}</span>` : ""}
    </footer>
  </section>`;
}
