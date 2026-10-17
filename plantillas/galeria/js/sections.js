import { dateParts, time, daysUntil, esc, fill, interpolate, rsvpClosed } from "./format.js";
import { calendarUrl } from "./calendar.js";

// Plantilla Galería: la pareja expuesta en un museo. Las fotos cuelgan como cuadros con marco
// dorado tallado y cartela blanca al lado; cada sección es una sala (Sala I, II…) y los textos
// prácticos hablan como un museo: horario, información para el visitante, tienda y taquilla.

/* ---------- utilidades ---------- */

const ROMAN = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
function roman(n) {
  let out = "";
  for (const [v, s] of ROMAN) while (n >= v) { out += s; n -= v; }
  return out;
}

// Las salas se numeran con las secciones que de verdad salen: al quitar una no quedan huecos.
const ROOMS = {
  story: (c) => c.story?.chapters?.some((ch) => ch.text),
  gallery: (c) => c.gallery?.length,
  schedule: (c) => c.schedule?.length,
  details: () => true,
  gifts: (c) => c.gifts?.iban,
};
function roomOf(config, name) {
  const shown = (config.sections || []).filter((s) => ROOMS[s] && ROOMS[s](config));
  const i = shown.indexOf(name);
  return i < 0 ? "" : fill(config.copy?.museum?.room || "Sala {n}", { n: roman(i + 1) });
}

const vars = ({ event, venue = {}, locale }) => {
  const [a, b] = event.couple;
  return { a, b, year: dateParts(event.date, locale).year, city: venue.city || venue.name || "" };
};

const arrow = `<span class="link__arrow" aria-hidden="true">→</span>`;

// Cartel de sala pintado en la pared: "Sala II · Textos de sala" y el título.
function plaque(config, name, t, id) {
  const room = roomOf(config, name);
  const eyebrow = [room, t.eyebrow].filter(Boolean).map(esc).join(` <span aria-hidden="true">·</span> `);
  return `
      <header class="plaque reveal">
        ${eyebrow ? `<p class="eyebrow plaque__room">${eyebrow}</p>` : ""}
        <h2 class="plaque__title" id="${id}">${esc(t.title || "")}</h2>
        ${t.intro ? `<p class="plaque__intro">${esc(t.intro)}</p>` : ""}
      </header>`;
}

/* ---------- el cuadro ---------- */

// Marco dorado: cinco molduras concéntricas (listel, media caña con picado, perlas, filete y
// filo interior). Cada una tiene la luz del foco arriba y la sombra abajo, así el relieve sale
// solo con bordes de colores, sin imágenes. Rosetas talladas en las esquinas.
const frame = (img) => `
          <div class="frame">
            <span class="frame__rose frame__rose--tl" aria-hidden="true"></span><span class="frame__rose frame__rose--tr" aria-hidden="true"></span><span class="frame__rose frame__rose--bl" aria-hidden="true"></span><span class="frame__rose frame__rose--br" aria-hidden="true"></span>
            <div class="frame__cove"><div class="frame__bead"><div class="frame__fillet"><div class="frame__sight">${img}</div></div></div></div>
          </div>`;

// Una obra: el cuadro con su foco y la cartela.
function work({ img, label, cls = "", style = "" }) {
  return `
      <figure class="work${cls}"${style ? ` style="${style}"` : ""}>
        <div class="work__piece">
          <span class="work__shade" aria-hidden="true"></span>
          ${frame(img)}
          <span class="work__beam" aria-hidden="true"></span>
        </div>
        ${label}
      </figure>`;
}

/* ---------- secciones ---------- */

export function hero(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.hero || {};
  const m = copy.museum || {};
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const v = vars(config);
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  const origin = v.city ? `${v.city}, ${v.year}` : v.year;
  const place = [venue.name, venue.city].filter(Boolean).map(esc).join(` <span aria-hidden="true">·</span> `);
  const img = event.photo
    ? `<img src="${esc(event.photo)}" alt="${esc(event.photoAlt || `${a} y ${b}`)}"${focus} fetchpriority="high">`
    : `<span class="frame__empty" aria-hidden="true">${esc(a[0] || "")}<em>&amp;</em>${esc(b[0] || "")}</span>`;
  const label = `
        <figcaption class="label label--hero">
          <p class="label__n">${fill(m.number || "Nº {n}", { n: 1 })}</p>
          <h1 class="label__artist" id="hero-title"><span>${esc(a)}</span> <em>${esc(m.and || "y")}</em> <span>${esc(b)}</span></h1>
          <p class="label__origin">(${esc(origin)})</p>
          ${event.tagline ? `<p class="label__title">${esc(event.tagline)}</p>` : ""}
          ${t.medium ? `<p class="label__medium">${fill(t.medium, v)}</p>` : ""}
          <dl class="label__facts">
            <div><dt>${esc(t.dateLabel || "Inauguración")}</dt><dd class="cap">${esc(d.weekday)}, ${esc(d.dayMonth)} de ${esc(d.year)} · ${esc(time(event.date))} h</dd></div>
            ${place ? `<div><dt>${esc(t.placeLabel || "Sede")}</dt><dd>${place}</dd></div>` : ""}
          </dl>
          ${t.credit ? `<p class="label__credit">${fill(t.credit, v)}</p>` : ""}
        </figcaption>`;
  return `
  <section class="hero room" aria-labelledby="hero-title">
    <div class="hero__in">
      ${t.eyebrow ? `<p class="eyebrow hero__expo">${fill(t.eyebrow, { date: `${d.dayMonth} de ${d.year}`, ...v }).split(" · ").map((x) => `<span>${x}</span>`).join(`<span class="sep" aria-hidden="true"> · </span>`)}</p>` : ""}
      <div class="hero__wall">
        ${work({ img, label, cls: " work--hero" })}
      </div>
    </div>
    <div class="zocalo" aria-hidden="true"></div>
  </section>`;
}

export function story(config) {
  const { story, copy = {} } = config;
  const chapters = story?.chapters?.filter((c) => c.text) || [];
  if (!chapters.length) return "";
  const t = copy.story || {};
  return `
  <section class="section room story" aria-labelledby="story-title">
    <div class="wrap">
      ${plaque(config, "story", t, "story-title")}
      <div class="walltext">${chapters.map((c, i) => `
        <article class="walltext__item reveal${c.photo ? " has-photo" : ""}${i === 0 ? " is-lead" : ""}">
          ${c.photo ? `<div class="walltext__photo">${frame(`<img src="${esc(c.photo)}" alt="${esc(c.photoAlt || "")}" loading="lazy">`)}</div>` : ""}
          <div class="walltext__body">
            ${c.meta ? `<p class="eyebrow walltext__meta">${esc(c.meta)}</p>` : ""}
            <p class="walltext__text">${esc(c.text)}</p>
          </div>
        </article>`).join("")}
      </div>
    </div>
  </section>`;
}

// Cartelas de la exposición: se reparten en orden y vuelven a empezar si hay más fotos.
// Cada una puede ser un texto o {title, medium, credit}; todas aceptan {a} {b} {year} {city} {n}.
const DEFAULT_LABELS = [
  { title: "Retrato a dos tiempos, {year}", medium: "Técnica mixta: risas y paciencia", credit: "Colección particular" },
];

export function gallery(config) {
  const { gallery = [], copy = {} } = config;
  if (!gallery.length) return "";
  const t = copy.gallery || {};
  const m = copy.museum || {};
  const labels = t.labels?.length ? t.labels : DEFAULT_LABELS;
  const v = vars(config);
  return `
  <section class="section room gallery" aria-labelledby="gallery-title">
    <div class="wrap">
      ${plaque(config, "gallery", t, "gallery-title")}
      <div class="hang" data-count="${gallery.length}">${gallery.map((src, i) => {
        const n = i + 2; // el Nº 1 es el retrato de la portada
        const raw = labels[i % labels.length];
        const l = typeof raw === "string" ? { medium: raw } : raw || {};
        const tv = { ...v, n };
        const title = l.title ? fill(l.title, tv) : "";
        const label = `
        <figcaption class="label">
          <p class="label__n">${fill(m.number || "Nº {n}", { n })}</p>
          <p class="label__artist">${esc(v.a)} <em>${esc(m.and || "y")}</em> ${esc(v.b)}</p>
          ${title ? `<p class="label__title">${title}</p>` : ""}
          ${l.medium ? `<p class="label__medium">${fill(l.medium, tv)}</p>` : ""}
          ${l.credit ? `<p class="label__credit">${fill(l.credit, tv)}</p>` : ""}
        </figcaption>`;
        const alt = [`${v.a} y ${v.b}`, l.title && interpolate(l.title, tv)].filter(Boolean).join(". ");
        return work({ img: `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy">`, label, style: `--i:${i}` });
      }).join("")}
      </div>
    </div>
  </section>`;
}

export function schedule(config) {
  const { schedule = [], copy = {} } = config;
  if (!schedule.length) return "";
  const t = copy.schedule || {};
  return `
  <section class="section room schedule" aria-labelledby="schedule-title">
    <div class="wrap">
      ${plaque(config, "schedule", t, "schedule-title")}
      <ol class="hours">${schedule.map((s, i) => `
        <li class="hours__row reveal" style="--i:${i}">
          <time class="hours__time">${esc(s.time)}</time>
          <span class="hours__what">
            <span class="hours__label">${esc(s.label)}</span>
            ${s.place ? `<span class="hours__place">${esc(s.place)}</span>` : ""}
          </span>
        </li>`).join("")}
      </ol>
      ${t.note ? `<p class="hours__note reveal">${esc(t.note)}</p>` : ""}
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
  <section class="section room details" aria-labelledby="details-title">
    <div class="wrap">
      ${plaque(config, "details", t, "details-title")}
      ${countdown ? `<p class="countdown reveal">${countdown}</p>` : ""}
      <dl class="info">
        <div class="info__item reveal">
          <dt class="eyebrow">${esc(t.when || "Fecha")}</dt>
          <dd class="info__big">${esc(d.dayMonth)}</dd>
          <dd class="info__small cap">${esc(d.weekday)}, ${esc(d.year)}</dd>
          ${t.calendar ? `<dd><a class="link" href="${esc(calendarUrl(config))}" target="_blank" rel="noopener">${esc(t.calendar)} ${arrow}</a></dd>` : ""}
        </div>
        <div class="info__item reveal" style="--i:1">
          <dt class="eyebrow">${esc(t.time || "Apertura")}</dt>
          <dd class="info__big">${esc(time(event.date))}<small> ${esc(t.timeSuffix || "h")}</small></dd>
          ${t.timeNote ? `<dd class="info__small">${esc(t.timeNote)}</dd>` : ""}
        </div>
        <div class="info__item reveal" style="--i:2">
          <dt class="eyebrow">${esc(t.where || "Sede")}</dt>
          <dd class="info__big">${esc(venue.name || venue.city || "")}</dd>
          ${venue.address ? `<dd class="info__small">${esc(venue.address)}</dd>` : ""}
          ${venue.mapsUrl && t.map ? `<dd><a class="link" href="${esc(venue.mapsUrl)}" target="_blank" rel="noopener">${esc(t.map)} ${arrow}</a></dd>` : ""}
        </div>
      </dl>
    </div>
  </section>`;
}

export function gifts(config) {
  const { gifts, copy = {} } = config;
  if (!gifts?.iban) return "";
  const t = copy.gifts || {};
  const raw = gifts.iban.replace(/\s+/g, "").toUpperCase();
  return `
  <section class="section room gifts" aria-labelledby="gifts-title">
    <div class="wrap">
      ${plaque(config, "gifts", t, "gifts-title")}
      ${t.text ? `<p class="lede reveal">${esc(t.text)}</p>` : ""}
      <details class="shop reveal">
        <summary class="link">${esc(t.reveal || "Ver los datos de la cuenta")}</summary>
        <div class="shop__card">
          ${gifts.holder ? `<p class="eyebrow">${esc(t.holderLabel)}</p><p class="shop__holder">${esc(gifts.holder)}</p>` : ""}
          <p class="eyebrow">${esc(t.ibanLabel)}</p>
          <p class="shop__iban" id="iban-value">${esc(raw.match(/.{1,4}/g).join(" "))}</p>
          <button class="link" type="button" data-copy="${esc(raw)}" data-done="${esc(t.copied)}" aria-controls="iban-value"><span data-label aria-live="polite">${esc(t.copy)}</span></button>
        </div>
      </details>
    </div>
  </section>`;
}

export function closing({ event, rsvp = {}, sections, locale, copy = {} }) {
  const [a, b] = event.couple;
  const t = copy.closing || {};
  const m = copy.museum || {};
  const hasRsvp = sections.includes("rsvp") && !rsvpClosed({ event, rsvp });
  const d = dateParts(event.date, locale);
  const deadline = rsvp.deadline ? dateParts(rsvp.deadline, locale).dayMonth : "";
  const and = esc(m.and || "y");
  return `
  <section class="closing room" aria-labelledby="closing-title">
    <div class="wrap closing__in">
      <div class="ticket reveal">
       <div class="ticket__paper">
        <div class="ticket__main">
          ${hasRsvp ? `
          ${t.eyebrow ? `<p class="eyebrow">${esc(t.eyebrow)}</p>` : ""}
          <h2 class="ticket__title" id="closing-title">${esc(t.title)}</h2>
          ${deadline && t.text ? `<p class="ticket__text">${fill(t.text, { deadline })}</p>` : ""}
          <button class="button" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button>`
          : `
          ${t.eyebrowAfter ? `<p class="eyebrow">${esc(t.eyebrowAfter)}</p>` : ""}
          <h2 class="ticket__title ticket__title--names" id="closing-title">${esc(a)} <em>${and}</em> ${esc(b)}</h2>`}
        </div>
        <div class="ticket__stub" aria-hidden="true">
          ${t.admit ? `<span class="ticket__admit">${esc(t.admit)}</span>` : ""}
          <span class="ticket__date">${esc(d.numeric)}</span>
          <span class="ticket__no">${fill(m.number || "Nº {n}", { n: "0001" })}</span>
        </div>
       </div>
      </div>
      ${m.notice ? `<p class="closing__notice reveal">${esc(m.notice)}</p>` : ""}
    </div>
    <footer class="closing__foot">
      <div class="wrap closing__foot-in">
        <span>${esc(a)} ${and} ${esc(b)}</span>
        <span class="closing__dot" aria-hidden="true"></span>
        <span>${esc(d.year)}</span>
      </div>
    </footer>
  </section>`;
}
