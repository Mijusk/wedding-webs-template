import { dateParts, time, daysUntil, esc, fill, rsvpClosed, weddingPhase } from "./format.js";
import { calendarUrl } from "./calendar.js";

// «Infinito»: toda la web es un solo plano. Cada parte es una escena a pantalla completa y, al
// bajar, en ella se abre una ventana (un arco o un óvalo) con la siguiente parte dentro; la
// cámara entra por la ventana y la siguiente parte ocupa la pantalla. La última ventana enseña
// otra vez la portada. Todo el movimiento está en js/motion.js; sin movimiento, las escenas
// salen una debajo de otra.
//
// Cada sección devuelve una o varias escenas (<section class="scene">). La portada son dos: el
// título con los nombres y la foto de portada. La historia, una por capítulo. La galería, una
// por foto.

export const arrow = `<span class="link__arrow" aria-hidden="true">→</span>`;

const img = (src, alt = "", { eager = false, focus = "" } = {}) =>
  `<img class="scene__img" ${eager ? `src="${esc(src)}" fetchpriority="high"` : `data-src="${esc(src)}"`} alt="${esc(alt)}" decoding="async"${focus ? ` style="object-position:${esc(focus)}"` : ""}>`;

const head = ({ eyebrow, title, id, text }) => `
        ${eyebrow ? `<p class="eyebrow scene__eyebrow" data-part>${esc(eyebrow)}</p>` : ""}
        ${title ? `<h2 class="scene__title" id="${id}" data-part>${esc(title)}</h2>` : ""}
        ${text ? `<p class="scene__text" data-part>${esc(text)}</p>` : ""}`;

// La ventana de cada escena: el marco doble que se dibuja al abrirse. Dentro se ve la escena
// siguiente (la coloca motion.js). La forma se alterna: arco, óvalo, arco...
const frame = () => `<div class="scene__window" aria-hidden="true"><i></i><i></i></div>`;

// Portada (1): fondo tinta, el nombre de cada uno a un lado de la ventana en arco, que ya
// enseña la foto de portada. (2): la foto entera con la frase.
export function hero(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.hero || {};
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const len = Math.max(String(a).length, String(b).length, 4);
  const place = venue.city || venue.name || "";
  return `
  <section class="scene scene--ink scene--hero" data-kind="title" data-open="1" aria-labelledby="hero-title">
    <div class="scene__window" aria-hidden="true"><img class="scene__still" data-src="${esc(event.photo)}" alt=""${event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : ""}><i></i><i></i></div>
  </section>
  <div class="scene-over hero__body">
    ${t.eyebrow ? `<p class="eyebrow hero__eyebrow" data-part>${esc(t.eyebrow)}</p>` : ""}
    <h1 class="hero__names" id="hero-title" style="--len:${len}">
      <span class="hero__name hero__name--a" data-part="a"><span>${esc(a)}</span></span>
      <span class="hero__amp" data-part><span class="visually-hidden"> y </span><span aria-hidden="true">&amp;</span></span>
      <span class="hero__name hero__name--b" data-part="b"><span>${esc(b)}</span></span>
    </h1>
    <p class="hero__date" data-part>${esc(d.numeric)}${place ? ` <span aria-hidden="true">·</span> ${esc(place)}` : ""}</p>
    ${t.hint ? `<p class="hero__hint" data-part aria-hidden="true"><span>${esc(t.hint)}</span></p>` : ""}
  </div>
  <section class="scene scene--photo scene--cover" data-kind="photo" aria-label="${esc(event.photoAlt || `${a} y ${b}`)}">
    <div class="scene__bg">${img(event.photo, event.photoAlt || `${a} y ${b}`, { eager: true, focus: event.photoFocus })}<i class="scene__shade" aria-hidden="true"></i></div>
    <div class="scene__body scene__body--caption">
      ${event.tagline ? `<p class="cover__tagline" data-part>${esc(event.tagline)}</p>` : ""}
      <p class="eyebrow cover__meta" data-part><span class="cap">${esc(d.weekday)}</span>, ${esc(d.dayMonth)} ${esc(d.year)}${venue.name ? ` · ${esc(venue.name)}` : ""}</p>
    </div>
    ${frame()}
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
  <section class="scene scene--paper" data-kind="title" aria-labelledby="details-title">
    <div class="scene__body">
      ${head({ eyebrow: t.eyebrow, title: t.title, id: "details-title" })}
      <dl class="facts">
        <div class="fact" data-part>
          <dt class="eyebrow">${esc(t.when || "Cuándo")}</dt>
          <dd class="fact__big"><span class="cap">${esc(d.weekday)}</span>, ${esc(d.dayMonth)}</dd>
          <dd class="fact__small">${esc(d.year)} · ${esc(time(event.date))}${suffix}</dd>
          ${countdown ? `<dd class="fact__note${days === 0 ? " is-today" : ""}">${countdown}</dd>` : ""}
          ${t.calendar && phase === "before" ? `<dd class="fact__link"><a class="link" href="${esc(calendarUrl(config))}" target="_blank" rel="noopener">${esc(t.calendar)} ${arrow}</a></dd>` : ""}
        </div>
        <div class="fact" data-part>
          <dt class="eyebrow">${esc(t.where || "Dónde")}</dt>
          <dd class="fact__big">${esc(venue.name || venue.city || "")}</dd>
          ${venue.address ? `<dd class="fact__small">${esc(venue.address)}</dd>` : ""}
          ${venue.mapsUrl && t.map ? `<dd class="fact__link"><a class="link" href="${esc(venue.mapsUrl)}" target="_blank" rel="noopener">${esc(t.map)} ${arrow}</a></dd>` : ""}
        </div>
      </dl>
    </div>
    ${frame()}
  </section>`;
}

// Historia: una escena por capítulo. Con foto, la foto entera y el texto abajo; sin foto, en tinta.
export function story(config) {
  const { story, copy = {} } = config;
  const chapters = story?.chapters?.filter((c) => c.text) || [];
  if (!chapters.length) return "";
  const t = copy.story || {};
  const total = String(chapters.length).padStart(2, "0");
  return chapters.map((c, i) => {
    const n = `${String(i + 1).padStart(2, "0")} / ${total}`;
    const label = `${t.eyebrow ? `${esc(t.eyebrow)} · ` : ""}<span class="scene__count">${n}</span>`;
    const id = `story-${i + 1}`;
    if (c.photo) return `
  <section class="scene scene--photo scene--chapter" data-kind="photo" aria-labelledby="${id}">
    <div class="scene__bg">${img(c.photo, c.photoAlt || "")}<i class="scene__shade" aria-hidden="true"></i></div>
    <div class="scene__body scene__body--caption">
      <p class="eyebrow chapter__label" data-part>${label}</p>
      ${i === 0 && t.title ? `<h2 class="chapter__title" data-part>${esc(t.title)}</h2>` : ""}
      ${c.meta ? `<p class="chapter__meta" id="${id}" data-part>${esc(c.meta)}</p>` : `<span id="${id}" hidden></span>`}
      <p class="chapter__text" data-part>${esc(c.text)}</p>
    </div>
    ${frame()}
  </section>`;
    return `
  <section class="scene scene--ink scene--chapter" data-kind="title" aria-labelledby="${id}">
    <div class="scene__body">
      <p class="eyebrow scene__eyebrow" data-part>${label}</p>
      ${i === 0 && t.title ? `<h2 class="scene__title" data-part>${esc(t.title)}</h2>` : ""}
      ${c.meta ? `<p class="chapter__meta" id="${id}" data-part>${esc(c.meta)}</p>` : `<span id="${id}" hidden></span>`}
      <p class="chapter__text chapter__text--big" data-part>${esc(c.text)}</p>
    </div>
    ${frame()}
  </section>`;
  }).join("");
}

export function schedule(config) {
  const { schedule = [], copy = {} } = config;
  if (!schedule.length) return "";
  const t = copy.schedule || {};
  return `
  <section class="scene scene--ink" data-kind="title" aria-labelledby="schedule-title">
    <div class="scene__body">
      ${head({ eyebrow: t.eyebrow, title: t.title, id: "schedule-title" })}
      <ol class="plan">${schedule.map((s) => `
        <li class="plan__item" data-part>
          <time class="plan__time">${esc(s.time)}</time>
          <div class="plan__what">
            <p class="plan__label">${esc(s.label)}</p>
            ${s.place ? `<p class="plan__place">${esc(s.place)}</p>` : ""}
          </div>
        </li>`).join("")}
      </ol>
      ${t.text ? `<p class="scene__note" data-part>${esc(t.text)}</p>` : ""}
    </div>
    ${frame()}
  </section>`;
}

export function dresscode(config) {
  const t = config.copy?.dresscode || {};
  if (!t.text) return "";
  const palette = (t.palette || []).filter((c) => c && c.color);
  return `
  <section class="scene scene--paper" data-kind="title" aria-labelledby="dresscode-title">
    <div class="scene__body">
      ${head({ eyebrow: t.eyebrow, title: t.title, id: "dresscode-title" })}
      <p class="scene__lead" data-part>${esc(t.text)}</p>
      ${palette.length ? `
      ${t.paletteLabel ? `<p class="eyebrow dresscode__label" data-part>${esc(t.paletteLabel)}</p>` : ""}
      <ul class="swatches" data-part>${palette.map((c) => `<li class="swatch"><span class="swatch__dot" style="--c:${esc(c.color)}"></span><span class="swatch__name">${esc(c.name || "")}</span></li>`).join("")}</ul>` : ""}
    </div>
    ${frame()}
  </section>`;
}

// Galería: una escena por foto, con su número. Con pocas fotos no se repiten.
export function gallery(config) {
  const { gallery = [], event, copy = {} } = config;
  const photos = gallery.filter(Boolean).slice(0, 6);
  if (!photos.length) return "";
  const t = copy.gallery || {};
  const [a, b] = event.couple;
  const total = String(photos.length).padStart(2, "0");
  return photos.map((src, i) => `
  <section class="scene scene--photo scene--shot" data-kind="photo" data-quick ${i === 0 ? `aria-labelledby="gallery-title"` : `aria-label="${esc(`${t.title || ""} ${i + 1}`)}"`}>
    <div class="scene__bg">${img(src, `${a} y ${b}`, { focus: i % 2 ? "50% 35%" : "" })}<i class="scene__shade" aria-hidden="true"></i></div>
    <div class="scene__body scene__body--caption scene__body--shot">
      ${i === 0 && t.eyebrow ? `<p class="eyebrow chapter__label" data-part>${esc(t.eyebrow)}</p>` : ""}
      ${i === 0 && t.title ? `<h2 class="chapter__title" id="gallery-title" data-part>${esc(t.title)}</h2>` : ""}
      <p class="eyebrow shot__count" data-part>${String(i + 1).padStart(2, "0")} / ${total}</p>
    </div>
    ${frame()}
  </section>`).join("");
}

export function gifts(config) {
  const { gifts, copy = {} } = config;
  if (!gifts?.iban) return "";
  const t = copy.gifts || {};
  const raw = gifts.iban.replace(/\s+/g, "").toUpperCase();
  return `
  <section class="scene scene--paper" data-kind="title" aria-labelledby="gifts-title">
    <div class="scene__body">
      ${head({ eyebrow: t.eyebrow, title: t.title, id: "gifts-title", text: t.text })}
      <details class="iban" data-part>
        <summary class="link">${esc(t.reveal || "Ver los datos de la cuenta")}</summary>
        <div class="iban__card">
          ${gifts.holder ? `<p class="eyebrow">${esc(t.holderLabel)}</p><p class="iban__holder">${esc(gifts.holder)}</p>` : ""}
          <p class="eyebrow">${esc(t.ibanLabel)}</p>
          <p class="iban__num" id="iban-value">${esc(raw.match(/.{1,4}/g).join(" "))}</p>
          <button class="link iban__copy" type="button" data-copy="${esc(raw)}" data-done="${esc(t.copied)}" aria-controls="iban-value"><span data-label aria-live="polite">${esc(t.copy)}</span></button>
        </div>
      </details>
    </div>
    ${frame()}
  </section>`;
}

// Cierre: confirmar mientras la lista está abierta; después, los nombres. Su ventana enseña
// otra vez la portada: al entrar, la web vuelve a empezar.
export function closing(config) {
  const { event, rsvp = {}, sections, locale, copy = {} } = config;
  const [a, b] = event.couple;
  const t = copy.closing || {};
  const open = sections.includes("rsvp") && !rsvpClosed({ event, rsvp });
  const phase = weddingPhase(event);
  const deadline = rsvp.deadline ? dateParts(rsvp.deadline, locale).dayMonth : "";
  const len = Math.max(String(a).length, String(b).length, 5);
  const late = phase === "today" ? t.today : phase === "after" ? t.after : "";
  return `
  <section class="scene scene--ink scene--closing" data-kind="title" data-last aria-labelledby="closing-title">
    <div class="scene__body">
      ${open ? `
        ${t.eyebrow ? `<p class="eyebrow scene__eyebrow" data-part>${esc(t.eyebrow)}</p>` : ""}
        <h2 class="scene__title scene__title--big" id="closing-title" data-part>${esc(t.title)}</h2>
        ${deadline && t.text ? `<p class="scene__text" data-part>${fill(t.text, { deadline })}</p>` : ""}
        <div class="closing__action" data-part><button class="button" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button></div>`
      : `<h2 class="scene__title closing__names" id="closing-title" style="--len:${len}" data-part>${esc(a)} <span class="amp">&amp;</span> ${esc(b)}</h2>
         ${late ? `<p class="scene__text" data-part>${esc(late)}</p>` : ""}`}
      ${t.loop ? `<p class="eyebrow closing__loop" data-part>${esc(t.loop)}</p>` : ""}
    </div>
    ${frame()}
  </section>`;
}

// Pie, después del plano: los nombres, el año y la vuelta al principio.
export function foot(config) {
  const { event, locale, copy = {} } = config;
  const [a, b] = event.couple;
  const year = dateParts(event.date, locale).year;
  const t = copy.closing || {};
  return `
  <footer class="foot">
    <div class="foot__in">
      <span>${esc(a)} &amp; ${esc(b)}</span>
      <span class="foot__dash" aria-hidden="true"></span>
      <span>${esc(year)}</span>
    </div>
    ${t.again ? `<a class="link foot__again" href="#top">${esc(t.again)} <span class="link__arrow" aria-hidden="true">↑</span></a>` : ""}
  </footer>`;
}
