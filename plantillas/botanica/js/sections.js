import { dateParts, time, daysUntil, esc, fill, rsvpClosed } from "./format.js";
import { calendarUrl } from "./calendar.js";
import { PLANTS, plantFor, plate, sprig } from "./plates.js";

// Plantilla Botánica: la web como un libro antiguo de láminas de botánica. Pergamino, tinta,
// verde y el rojo de la numeración. La portada es un frontispicio con la lámina de la planta
// de la estación de la boda; cada sección es una lámina numerada en romano.

/* ---------- utilidades ---------- */

const ROMAN = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
export function roman(n) {
  let out = "";
  for (const [v, s] of ROMAN) while (n >= v) { out += s; n -= v; }
  return out;
}

// La portada es la lámina I. Las demás se numeran con las secciones que de verdad salen,
// así al quitar una la numeración sigue sin huecos.
const NUMBERED = {
  details: () => true,
  story: (c) => c.story?.chapters?.some((ch) => ch.text),
  schedule: (c) => c.schedule?.length,
  gallery: (c) => c.gallery?.length,
  gifts: (c) => c.gifts?.iban,
  closing: () => true,
};
function numberOf(config, name) {
  const shown = (config.sections || []).filter((s) => NUMBERED[s] && NUMBERED[s](config));
  const i = shown.indexOf(name);
  return i < 0 ? "" : roman(i + 2);
}
const lam = (config) => config.copy?.plates?.label || "Lám.";
const figLabel = (config) => config.copy?.plates?.figure || "Fig.";

// Planta de la portada (según la estación) y las otras, para las láminas de las secciones.
function plants(config) {
  const hero = plantFor(config.event.date, config.copy?.hero?.plant);
  const order = ["olivo", "azahar", "lavanda", "granado"].filter((p) => p !== hero);
  return { hero, others: order };
}

const arrow = `<span class="link__arrow" aria-hidden="true">→</span>`;

// Cabecera de sección: "Lám. II" en rojo, título y una ramita como viñeta.
function head(config, name, title, note, id) {
  const n = numberOf(config, name);
  return `
      <header class="head reveal">
        ${n ? `<p class="head__no"><span class="head__rule" aria-hidden="true"></span>${esc(lam(config))} ${n}<span class="head__rule" aria-hidden="true"></span></p>` : ""}
        <h2 class="head__title" id="${id}">${esc(title)}</h2>
        ${note ? `<p class="head__note">${esc(note)}</p>` : ""}
        ${sprig("sprig head__sprig")}
      </header>`;
}

// Lámina botánica con su pie: número, nombre latino en cursiva con su autoridad y nombre común.
function specimen(config, name, { no = "", cls = "", anim = true } = {}) {
  const pl = PLANTS[name];
  return `
    <figure class="specimen ${cls}${anim ? " is-anim" : ""}">
      ${no ? `<p class="specimen__no">${esc(lam(config))} ${no}</p>` : ""}
      <div class="specimen__plate">${plate(name)}</div>
      <figcaption class="specimen__cap">
        <span class="specimen__latin"><i>${esc(pl.latin)}</i> ${esc(pl.author)}</span>
        <span class="specimen__common">${esc(pl.common)}</span>
      </figcaption>
    </figure>`;
}

/* ---------- secciones ---------- */

export function hero(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const [a, b] = event.couple;
  const t = copy.hero || {};
  const d = dateParts(event.date, locale);
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  const len = Math.max(String(a).length, String(b).length, 5);
  const place = [venue.name, venue.city].filter(Boolean);
  const { hero: plant } = plants(config);
  return `
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero__book">
      ${specimen(config, plant, { no: "I", cls: "hero__plate" })}
      <div class="hero__title">
        ${t.eyebrow ? `<p class="hero__eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h1 class="hero__names" id="hero-title" style="--len:${len}">
          <span class="hero__name">${esc(a)}</span>
          <span class="hero__amp">&amp;</span>
          <span class="hero__name">${esc(b)}</span>
        </h1>
        ${event.tagline ? `<p class="hero__tagline">${esc(event.tagline)}</p>` : ""}
        ${sprig("sprig hero__sprig")}
        <p class="hero__date">${esc(d.weekday)}, ${esc(d.dayMonth)} de ${esc(d.year)}</p>
        ${place.length ? `<p class="hero__place">${place.map(esc).join(` <span aria-hidden="true">·</span> `)}</p>` : ""}
        ${event.photo ? `
        <figure class="hero__photo">
          <div class="frame"><img src="${esc(event.photo)}" alt="${esc(event.photoAlt || "")}"${focus} fetchpriority="high"></div>
          ${t.photoCaption ? `<figcaption class="caption">${fill(t.photoCaption, { a, b, city: venue.city || "" })}</figcaption>` : ""}
        </figure>` : ""}
      </div>
    </div>
  </section>`;
}

export function details(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.details || {};
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const days = daysUntil(event.date);
  const countdown = days < 0 ? "" : fill(days === 0 ? t.countdownToday : days === 1 ? t.countdownOne : t.countdown, { days });
  const { others } = plants(config);
  return `
  <section class="section details" aria-labelledby="details-title">
    <div class="wrap">
      ${head(config, "details", t.title || "", t.eyebrow, "details-title")}
      <div class="details__grid">
        ${specimen(config, others[0], { cls: "details__plate reveal" })}
        <div class="sheet reveal" style="--i:1">
          ${t.label ? `<p class="sheet__top">${fill(t.label, { a, b })}</p>` : ""}
          <dl class="sheet__rows">
            <div class="sheet__row">
              <dt>${esc(t.when || "Fecha")}</dt>
              <dd class="sheet__value"><span class="cap">${esc(d.weekday)}</span>, ${esc(d.dayMonth)} de ${esc(d.year)}</dd>
              ${t.calendar ? `<dd><a class="link" href="${esc(calendarUrl(config))}" target="_blank" rel="noopener">${esc(t.calendar)} ${arrow}</a></dd>` : ""}
            </div>
            <div class="sheet__row">
              <dt>${esc(t.time || "Hora")}</dt>
              <dd class="sheet__value">${esc(time(event.date))} ${esc(t.timeSuffix || "h")}</dd>
              ${countdown ? `<dd class="sheet__note">${countdown}</dd>` : ""}
            </div>
            <div class="sheet__row">
              <dt>${esc(t.where || "Lugar")}</dt>
              <dd class="sheet__value">${esc(venue.name || venue.city || "")}</dd>
              ${venue.address ? `<dd class="sheet__sub">${esc(venue.address)}</dd>` : ""}
              ${venue.mapsUrl && t.map ? `<dd><a class="link" href="${esc(venue.mapsUrl)}" target="_blank" rel="noopener">${esc(t.map)} ${arrow}</a></dd>` : ""}
            </div>
          </dl>
        </div>
      </div>
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
    <div class="wrap">
      ${head(config, "story", t.title || "", t.eyebrow, "story-title")}
      <ol class="chapters">${chapters.map((c, i) => `
        <li class="chapter reveal">
          ${i ? sprig("sprig chapter__sprig") : ""}
          ${c.photo ? `<figure class="chapter__photo"><div class="frame"><img src="${esc(c.photo)}" alt="${esc(c.photoAlt || "")}" loading="lazy"></div></figure>` : ""}
          <p class="chapter__meta"><span class="chapter__no">§ ${i + 1}</span>${c.meta ? ` <span>${esc(c.meta)}</span>` : ""}</p>
          <p class="chapter__text">${esc(c.text)}</p>
        </li>`).join("")}
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
      ${head(config, "schedule", t.title || "", t.eyebrow, "schedule-title")}
      <ol class="index">${schedule.map((s, i) => `
        <li class="index__item reveal" style="--i:${i}">
          <span class="index__label">${esc(s.label)}</span>
          <span class="index__dots" aria-hidden="true"></span>
          <time class="index__time">${esc(s.time)}</time>
          ${s.place ? `<span class="index__place">${esc(s.place)}</span>` : ""}
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

export function gallery(config) {
  const { gallery = [], event, copy = {} } = config;
  if (!gallery.length) return "";
  const t = copy.gallery || {};
  const [a, b] = event.couple;
  const n = gallery.length;
  return `
  <section class="section gallery" aria-labelledby="gallery-title">
    <div class="wrap">
      ${head(config, "gallery", t.title || "", t.eyebrow, "gallery-title")}
      <div class="figs" data-count="${n > 3 ? "many" : n}">${gallery.map((src, i) => `
        <figure class="fig reveal" style="--i:${i % 3}">
          <div class="frame"><img src="${esc(src)}" alt="${esc(`${a} y ${b}`)}" loading="lazy"></div>
          <figcaption class="caption"><span class="caption__no">${esc(figLabel(config))} ${i + 1}</span>${t.caption ? ` ${fill(t.caption, { a, b, n: i + 1 })}` : ""}</figcaption>
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
    <div class="wrap">
      ${head(config, "gifts", t.title || "", t.eyebrow, "gifts-title")}
      ${t.text ? `<p class="lede reveal">${esc(t.text)}</p>` : ""}
      <details class="iban reveal">
        <summary class="link">${esc(t.reveal || "Ver los datos de la cuenta")}</summary>
        <div class="sheet iban__sheet">
          ${gifts.holder ? `<p class="iban__label">${esc(t.holderLabel)}</p><p class="iban__holder">${esc(gifts.holder)}</p>` : ""}
          <p class="iban__label">${esc(t.ibanLabel)}</p>
          <p class="iban__num" id="iban-value">${esc(raw.match(/.{1,4}/g).join(" "))}</p>
          <button class="link" type="button" data-copy="${esc(raw)}" data-done="${esc(t.copied)}" aria-controls="iban-value"><span data-label aria-live="polite">${esc(t.copy)}</span></button>
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
  const year = Number(String(event.date).slice(0, 4));
  const { others } = plants(config);
  return `
  <section class="section closing" aria-labelledby="closing-title">
    <div class="wrap closing__in">
      ${head(config, "closing", hasRsvp ? t.title || "" : `${a} & ${b}`, hasRsvp ? t.eyebrow : "", "closing-title")}
      ${hasRsvp ? `
        ${deadline && t.text ? `<p class="lede reveal">${fill(t.text, { deadline })}</p>` : ""}
        <div class="closing__cta reveal"><button class="button" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button></div>` : ""}
      ${specimen(config, others[1], { cls: "closing__plate reveal" })}
    </div>
    <footer class="colophon">
      <p class="colophon__finis">${esc(t.finis || "Finis")}</p>
      <p class="colophon__names">${esc(a)} &amp; ${esc(b)}</p>
      ${year ? `<p class="colophon__year">${roman(year)}</p>` : ""}
    </footer>
  </section>`;
}
