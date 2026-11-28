import { dateParts, time, daysUntil, esc, fill, interpolate, rsvpClosed, weddingPhase } from "./format.js";
import { calendarUrl } from "./calendar.js";

// «Hilo rojo»: un solo hilo rojo recorre la web de arriba abajo y se va cosiendo al bajar. Une los
// dos nombres con un nudo, sostiene las fotos con pinzas, ata las etiquetas de cuándo y dónde,
// marca el programa nudo a nudo y acaba en un lazo alrededor del botón de confirmar.
// Aquí solo está el contenido. El hilo lo dibuja js/motion.js a partir de los «enganches» de cada
// parte ([data-hook]: pinza, ojal, nudo, lazo o vuelta); sin movimiento, sale ya cosido.
//
// Cada parte es un <section class="leg"> con su propio <svg class="thread"> (el tramo de hilo
// de esa parte), para que al bajar solo se repinte el tramo que se está cosiendo.

export const arrow = `<span class="link__arrow" aria-hidden="true">→</span>`;

const thread = `<svg class="thread" aria-hidden="true" focusable="false"><path class="thread__shade" pathLength="1"/><path class="thread__line" pathLength="1"/></svg>`;

const head = ({ eyebrow, title, id, text }) => `
    <header class="head" data-rise>
      ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ""}
      ${title ? `<h2 class="head__title" id="${id}">${esc(title)}</h2>` : ""}
      ${text ? `<p class="head__text">${esc(text)}</p>` : ""}
    </header>`;

const photo = (src, alt = "", focus = "", eager = false) =>
  `<img src="${esc(src)}" alt="${esc(alt)}" decoding="async"${eager ? ` fetchpriority="high"` : ` loading="lazy"`}${focus ? ` style="object-position:${esc(focus)}"` : ""}>`;

// Una foto colgada del hilo con una pinza. La pinza es el enganche: el hilo pasa por ella.
const print = ({ src, alt, focus, note = "", cls = "", eager = false }) => `
      <figure class="print hang ${cls}" data-hang>
        <div class="hang__sway">
          <span class="peg" data-hook="peg" aria-hidden="true"></span>
          <div class="print__photo">${photo(src, alt, focus, eager)}</div>
          ${note ? `<figcaption class="print__note">${esc(note)}</figcaption>` : ""}
        </div>
      </figure>`;

// Portada: los dos nombres unidos por un nudo y la foto de portada colgada del hilo.
export function hero(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.hero || {};
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const len = Math.max(String(a).length, String(b).length, 4);
  const place = venue.city || venue.name || "";
  return `
  <section class="leg hero" data-leg="hero" aria-labelledby="hero-title">
    ${thread}
    ${t.eyebrow ? `<p class="eyebrow hero__eyebrow">${esc(t.eyebrow)}</p>` : ""}
    <h1 class="hero__names" id="hero-title" style="--len:${len}">
      <span class="hero__name hero__name--a" data-name="a"><span>${esc(a)}</span></span>
      <span class="hero__knot" data-hook="knot-hero"><span class="visually-hidden"> y </span></span>
      <span class="hero__name hero__name--b" data-name="b"><span>${esc(b)}</span></span>
    </h1>
    <div class="hero__stage">
      ${print({ src: event.photo, alt: event.photoAlt || `${a} y ${b}`, focus: event.photoFocus, note: event.tagline, cls: "print--hero", eager: true })}
    </div>
    <p class="hero__date">${esc(d.numeric)}${place ? ` <span aria-hidden="true">·</span> ${esc(place)}` : ""}</p>
    ${t.hint ? `<p class="hero__hint" aria-hidden="true">${esc(t.hint)}</p>` : ""}
  </section>`;
}

// Lo esencial: dos etiquetas de papel atadas al hilo por el ojal.
export function details(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.details || {};
  const d = dateParts(event.date, locale);
  const days = daysUntil(event.date);
  const phase = weddingPhase(event);
  const countdown = phase === "after" || days < 0 ? "" : fill(days === 0 ? t.countdownToday : days === 1 ? t.countdownOne : t.countdown, { days });
  const suffix = t.timeSuffix ? ` ${esc(t.timeSuffix)}` : "";
  return `
  <section class="leg details" data-leg="rows" aria-labelledby="details-title">
    ${thread}
    ${head({ eyebrow: t.eyebrow, title: t.title, id: "details-title" })}
    <div class="tags">
      <div class="tag hang" data-hang>
        <div class="hang__sway">
          <span class="tag__hole" aria-hidden="true"></span><svg class="tag__string" viewBox="-12 -4 24 60" aria-hidden="true" focusable="false"><path d="M0 0C-3 14-6.5 33-4.5 53M0 0C3 14 6.5 33 4.5 53"/></svg><span class="tag__tie" data-hook="tie" aria-hidden="true"></span>
          <dl class="tag__in">
            <dt class="eyebrow">${esc(t.when || "Cuándo")}</dt>
            <dd class="tag__big"><span class="cap">${esc(d.weekday)}</span>, ${esc(d.dayMonth)}</dd>
            <dd class="tag__small">${esc(d.year)} · ${esc(time(event.date))}${suffix}</dd>
            ${countdown ? `<dd class="tag__note${days === 0 ? " is-today" : ""}">${countdown}</dd>` : ""}
            ${t.calendar && phase === "before" ? `<dd class="tag__link"><a class="link" href="${esc(calendarUrl(config))}" target="_blank" rel="noopener">${esc(t.calendar)} ${arrow}</a></dd>` : ""}
          </dl>
        </div>
      </div>
      <div class="tag hang" data-hang>
        <div class="hang__sway">
          <span class="tag__hole" aria-hidden="true"></span><svg class="tag__string" viewBox="-12 -4 24 60" aria-hidden="true" focusable="false"><path d="M0 0C-3 14-6.5 33-4.5 53M0 0C3 14 6.5 33 4.5 53"/></svg><span class="tag__tie" data-hook="tie" aria-hidden="true"></span>
          <dl class="tag__in">
            <dt class="eyebrow">${esc(t.where || "Dónde")}</dt>
            <dd class="tag__big">${esc(venue.name || venue.city || "")}</dd>
            ${venue.address ? `<dd class="tag__small">${esc(venue.address)}</dd>` : ""}
            ${venue.mapsUrl && t.map ? `<dd class="tag__link"><a class="link" href="${esc(venue.mapsUrl)}" target="_blank" rel="noopener">${esc(t.map)} ${arrow}</a></dd>` : ""}
          </dl>
        </div>
      </div>
    </div>
  </section>`;
}

// Historia: cada capítulo es una foto colgada del hilo, con su texto. Sin foto, una nota en papel.
export function story(config) {
  const { story, copy = {} } = config;
  const chapters = story?.chapters?.filter((c) => c.text) || [];
  if (!chapters.length) return "";
  const t = copy.story || {};
  return `
  <section class="leg story" data-leg="rows" aria-labelledby="story-title">
    ${thread}
    ${head({ eyebrow: t.eyebrow, title: t.title, id: "story-title" })}
    <ol class="chapters">${chapters.map((c, i) => `
      <li class="chapter${c.photo ? " has-photo" : ""}${i % 2 ? " is-flip" : ""}">
        ${c.photo
          ? print({ src: c.photo, alt: c.photoAlt || "", focus: c.photoFocus, cls: i % 2 ? "is-right" : "is-left" })
          : `<div class="note hang" data-hang><div class="hang__sway"><span class="peg" data-hook="peg" aria-hidden="true"></span><p class="note__num">${String(i + 1).padStart(2, "0")}</p></div></div>`}
        <div class="chapter__body" data-rise>
          ${c.meta ? `<p class="chapter__meta">${esc(c.meta)}</p>` : ""}
          <p class="chapter__text">${esc(c.text)}</p>
        </div>
      </li>`).join("")}
    </ol>
  </section>`;
}

// Programa: el hilo baja por el centro y hace un nudo en cada hora.
export function schedule(config) {
  const { schedule = [], copy = {} } = config;
  if (!schedule.length) return "";
  const t = copy.schedule || {};
  return `
  <section class="leg schedule" data-leg="cord" aria-labelledby="schedule-title">
    ${thread}
    ${head({ eyebrow: t.eyebrow, title: t.title, id: "schedule-title" })}
    <ol class="cord">${schedule.map((s) => `
      <li class="cord__item">
        <time class="cord__time" data-rise>${esc(s.time)}</time>
        <span class="knot" data-hook="knot" aria-hidden="true"></span>
        <div class="cord__what" data-rise>
          <p class="cord__label">${esc(s.label)}</p>
          ${s.place ? `<p class="cord__place">${esc(s.place)}</p>` : ""}
        </div>
      </li>`).join("")}
    </ol>
    ${t.text ? `<p class="schedule__note" data-rise>${esc(t.text)}</p>` : ""}
  </section>`;
}

// Vestimenta: los colores, como carretes de hilo.
export function dresscode(config) {
  const t = config.copy?.dresscode || {};
  if (!t.text) return "";
  const palette = (t.palette || []).filter((c) => c && c.color);
  return `
  <section class="leg dresscode" data-leg="rows" aria-labelledby="dresscode-title">
    ${thread}
    ${head({ eyebrow: t.eyebrow, title: t.title, id: "dresscode-title", text: t.text })}
    ${palette.length ? `
    <div class="spools" data-rise>
      ${t.paletteLabel ? `<p class="eyebrow spools__label">${esc(t.paletteLabel)}</p>` : ""}
      <ul class="spools__list">${palette.map((c, i) => `
        <li class="spool" style="--c:${esc(c.color)};--i:${i}"><span class="spool__reel" data-hook="spool" aria-hidden="true"><i></i></span><span class="spool__name">${esc(c.name || "")}</span></li>`).join("")}
      </ul>
    </div>` : ""}
  </section>`;
}

// Galería: las fotos tendidas en el hilo, como una guirnalda.
export function gallery(config) {
  const { gallery = [], event, copy = {} } = config;
  const photos = gallery.filter(Boolean).slice(0, 9);
  if (!photos.length) return "";
  const t = copy.gallery || {};
  const [a, b] = event.couple;
  return `
  <section class="leg gallery" data-leg="rows" aria-labelledby="gallery-title">
    ${thread}
    ${head({ eyebrow: t.eyebrow, title: t.title, id: "gallery-title" })}
    <div class="line" data-count="${photos.length}">${photos.map((src, i) => print({ src, alt: `${a} y ${b}`, focus: i % 2 ? "50% 35%" : "", cls: `is-${i % 3}` })).join("")}
    </div>
  </section>`;
}

// Regalo: una tarjeta atada con un lazo; los datos de la cuenta, al abrirla.
export function gifts(config) {
  const { gifts, copy = {} } = config;
  if (!gifts?.iban) return "";
  const t = copy.gifts || {};
  const raw = gifts.iban.replace(/\s+/g, "").toUpperCase();
  return `
  <section class="leg gifts" data-leg="rows" aria-labelledby="gifts-title">
    ${thread}
    <div class="card">
      <span class="bow" data-hook="bow" aria-hidden="true"></span>
      <div class="card__in">
        ${head({ eyebrow: t.eyebrow, title: t.title, id: "gifts-title", text: t.text })}
        <details class="iban">
          <summary class="link">${esc(t.reveal || "Ver los datos de la cuenta")}</summary>
          <div class="iban__card">
            ${gifts.holder ? `<p class="eyebrow">${esc(t.holderLabel)}</p><p class="iban__holder">${esc(gifts.holder)}</p>` : ""}
            <p class="eyebrow">${esc(t.ibanLabel)}</p>
            <p class="iban__num" id="iban-value">${esc(raw.match(/.{1,4}/g).join(" "))}</p>
            <button class="link iban__copy" type="button" data-copy="${esc(raw)}" data-done="${esc(t.copied)}" aria-controls="iban-value"><span data-label aria-live="polite">${esc(t.copy)}</span></button>
          </div>
        </details>
      </div>
    </div>
  </section>`;
}

// Cierre: el hilo da la vuelta al botón de confirmar y acaba en un lazo. Con la lista cerrada,
// la vuelta es a los nombres.
export function closing(config) {
  const { event, rsvp = {}, sections, locale, copy = {} } = config;
  const [a, b] = event.couple;
  const t = copy.closing || {};
  const open = sections.includes("rsvp") && !rsvpClosed({ event, rsvp });
  const phase = weddingPhase(event);
  const deadline = rsvp.deadline ? dateParts(rsvp.deadline, locale).dayMonth : "";
  const len = Math.max(String(a).length + String(b).length + 3, 8);
  const late = phase === "today" ? t.today : phase === "after" ? t.after : "";
  return `
  <section class="leg closing" data-leg="end" aria-labelledby="closing-title">
    ${thread}
    ${open ? `
    ${head({ eyebrow: t.eyebrow, title: t.title, id: "closing-title", text: deadline && t.text ? interpolate(t.text, { deadline }) : "" })}
    <div class="closing__action"><button class="button closing__button" type="button" data-rsvp-open data-hook="wrap" aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button></div>`
    : `
    <header class="head" data-rise>
      <h2 class="closing__names" id="closing-title" style="--len:${len}" data-hook="wrap">${esc(a)} <span class="amp">&amp;</span> ${esc(b)}</h2>
      ${late ? `<p class="head__text">${esc(late)}</p>` : ""}
    </header>`}
    ${t.knot ? `<p class="closing__knot" data-knot-note aria-hidden="true">${esc(t.knot)}</p>` : ""}
  </section>`;
}

// Pie: los nombres y el año.
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
