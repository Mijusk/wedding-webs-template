import { dateParts, time, daysUntil, esc, fill, interpolate, rsvpClosed, weddingPhase } from "./format.js";
import { calendarUrl } from "./calendar.js";

// «Floración»: una flor se abre en la portada con la foto de la pareja en el corazón; al bajar
// termina de abrirse y sus pétalos caen por la web. Cada parte tiene un capullo que florece al
// llegar, las fotos se abren en círculo como una flor y, al final, una flor grande se abre
// alrededor de la confirmación.
// Aquí solo está el contenido; cuánto está abierta cada flor (--b) lo pone js/motion.js.

export const arrow = `<span class="link__arrow" aria-hidden="true">→</span>`;

// Capas de pétalos, de fuera adentro: cuántos, qué imagen (1 claro, 2 medio, 3 intenso), tamaño,
// distancia al centro cerrada y abierta (en anchos de flor) y giro de partida.
const FULL = [
  { n: 11, v: 2, s0: 0.34, s1: 1, d0: 0.02, d1: 0.14, off: 0 },
  { n: 9, v: 1, s0: 0.3, s1: 0.9, d0: 0.016, d1: 0.15, off: 16 },
  { n: 8, v: 3, s0: 0.27, s1: 0.72, d0: 0.012, d1: 0.165, off: 8 },
  { n: 7, v: 2, s0: 0.24, s1: 0.56, d0: 0.01, d1: 0.18, off: 25 },
];
const SMALL = [
  { n: 8, v: 2, s0: 0.3, s1: 1, d0: 0.02, d1: 0.1, off: 0 },
  { n: 6, v: 3, s0: 0.24, s1: 0.7, d0: 0.01, d1: 0.1, off: 30 },
];

// Una flor: hojas detrás, pétalos por capas y un corazón (la foto, un texto o un punto).
export function flower({ layers = FULL, leaves = 5, heart = "", cls = "" } = {}) {
  const leafs = Array.from({ length: leaves }, (_, i) => `<i class="leaf" style="--a:${Math.round(i * (360 / leaves) + 18)}deg"></i>`).join("");
  const petals = layers.map((L, l) => Array.from({ length: L.n }, (_, i) => {
    const a = Math.round(i * (360 / L.n) + L.off + ((i * 37) % 11) - 5);
    const j = 1 + (((i * 53 + l * 17) % 13) - 6) / 100;   // cada pétalo, un poco distinto
    return `<i class="petal p${L.v}" style="--a:${a}deg;--l:${l};--s0:${L.s0};--s1:${(L.s1 * j).toFixed(3)};--d0:${L.d0};--d1:${L.d1}"></i>`;
  }).join("")).join("");
  return `<div class="flower ${cls}" data-flower aria-hidden="${heart ? "false" : "true"}">${leafs}${petals}<div class="flower__heart">${heart}</div></div>`;
}

// Capullo pequeño que acompaña a cada título.
const bud = () => flower({ layers: SMALL, leaves: 0, cls: "flower--bud" });

const head = ({ eyebrow, title, id, text }) => `
    <header class="head">
      ${bud()}
      ${eyebrow ? `<p class="eyebrow" data-rise>${esc(eyebrow)}</p>` : ""}
      ${title ? `<h2 class="head__title" id="${id}" data-rise>${esc(title)}</h2>` : ""}
      ${text ? `<p class="head__text" data-rise>${esc(text)}</p>` : ""}
    </header>`;

// Foto que se abre en círculo desde el centro, como una flor (--r lo pone js/motion.js).
const bloomPhoto = (src, alt = "", focus = "", cls = "") => `
      <figure class="bloom ${cls}" data-bloom>
        <img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async"${focus ? ` style="object-position:${esc(focus)}"` : ""}>
      </figure>`;

export function hero(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.hero || {};
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const place = venue.city || venue.name || "";
  const len = String(a).length + String(b).length + 3;
  const photo = `<img src="${esc(event.photo)}" alt="${esc(event.photoAlt || `${a} y ${b}`)}" fetchpriority="high" decoding="async"${event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : ""}>`;
  return `
  <section class="hero" data-hero aria-labelledby="hero-title">
    ${t.eyebrow ? `<p class="eyebrow hero__eyebrow">${esc(t.eyebrow)}</p>` : ""}
    <div class="hero__flower">${flower({ heart: photo, cls: "flower--hero" })}</div>
    <h1 class="hero__names" id="hero-title" style="--len:${len}">${esc(a)} <span class="hero__amp">&amp;</span> ${esc(b)}</h1>
    <p class="hero__date"><span class="cap">${esc(d.weekday)}</span>, ${esc(d.dayMonth)} ${esc(d.year)}${place ? `<span class="hero__dot" aria-hidden="true"> · </span><span class="hero__place">${esc(place)}</span>` : ""}</p>
    ${t.hint ? `<p class="hero__hint" aria-hidden="true">${esc(t.hint)}</p>` : ""}
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
  <section class="part details" aria-labelledby="details-title">
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
  <section class="part story" aria-labelledby="story-title">
    ${head({ eyebrow: t.eyebrow, title: t.title, id: "story-title" })}
    <ol class="chapters">${chapters.map((c, i) => `
      <li class="chapter${c.photo ? " has-photo" : ""}${i % 2 ? " is-flip" : ""}">
        ${c.photo ? bloomPhoto(c.photo, c.photoAlt || "", c.photoFocus) : `<div class="chapter__bud">${bud()}</div>`}
        <div class="chapter__body" data-rise>
          ${c.meta ? `<p class="chapter__meta">${esc(c.meta)}</p>` : ""}
          <p class="chapter__text">${esc(c.text)}</p>
        </div>
      </li>`).join("")}
    </ol>
  </section>`;
}

// Programa: un capullo por hora, que florece al pasar por el centro de la pantalla.
export function schedule(config) {
  const { schedule = [], copy = {} } = config;
  if (!schedule.length) return "";
  const t = copy.schedule || {};
  return `
  <section class="part schedule" aria-labelledby="schedule-title">
    ${head({ eyebrow: t.eyebrow, title: t.title, id: "schedule-title" })}
    <ol class="plan">${schedule.map((s) => `
      <li class="plan__item">
        ${bud()}
        <time class="plan__time" data-rise>${esc(s.time)}</time>
        <div class="plan__what" data-rise>
          <p class="plan__label">${esc(s.label)}</p>
          ${s.place ? `<p class="plan__place">${esc(s.place)}</p>` : ""}
        </div>
      </li>`).join("")}
    </ol>
    ${t.text ? `<p class="schedule__note" data-rise>${esc(t.text)}</p>` : ""}
  </section>`;
}

// Vestimenta: cada color es un pétalo; se abren en abanico.
export function dresscode(config) {
  const t = config.copy?.dresscode || {};
  if (!t.text) return "";
  const palette = (t.palette || []).filter((c) => c && c.color);
  const n = palette.length;
  return `
  <section class="part dresscode" aria-labelledby="dresscode-title">
    ${head({ eyebrow: t.eyebrow, title: t.title, id: "dresscode-title", text: t.text })}
    ${n ? `
    <div class="fan" data-fan>
      ${t.paletteLabel ? `<p class="eyebrow fan__label">${esc(t.paletteLabel)}</p>` : ""}
      <ul class="fan__list">${palette.map((c, i) => `<li class="fan__item" style="--c:${esc(c.color)};--fi:${n > 1 ? Math.round((i / (n - 1) - 0.5) * 150) : 0}"><span class="fan__petal" aria-hidden="true"></span><span class="fan__name">${esc(c.name || "")}</span></li>`).join("")}</ul>
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
  <section class="part gallery" aria-labelledby="gallery-title">
    ${head({ eyebrow: t.eyebrow, title: t.title, id: "gallery-title" })}
    <div class="blooms" data-count="${photos.length}">${photos.map((src, i) => bloomPhoto(src, `${a} y ${b}`, i % 2 ? "50% 35%" : "", `is-${i % 3}`)).join("")}
    </div>
  </section>`;
}

export function gifts(config) {
  const { gifts, copy = {} } = config;
  if (!gifts?.iban) return "";
  const t = copy.gifts || {};
  const raw = gifts.iban.replace(/\s+/g, "").toUpperCase();
  return `
  <section class="part gifts" aria-labelledby="gifts-title">
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

// Cierre: una flor grande se abre alrededor de la pregunta; el botón, debajo.
export function closing(config) {
  const { event, rsvp = {}, sections, locale, copy = {} } = config;
  const [a, b] = event.couple;
  const t = copy.closing || {};
  const open = sections.includes("rsvp") && !rsvpClosed({ event, rsvp });
  const phase = weddingPhase(event);
  const deadline = rsvp.deadline ? dateParts(rsvp.deadline, locale).dayMonth : "";
  const late = phase === "today" ? t.today : phase === "after" ? t.after : "";
  const heart = open
    ? `${t.eyebrow ? `<p class="eyebrow">${esc(t.eyebrow)}</p>` : ""}<h2 class="closing__title" id="closing-title">${esc(t.title)}</h2>`
    : `<h2 class="closing__title closing__title--names" id="closing-title">${esc(a)} <span class="amp">&amp;</span> ${esc(b)}</h2>`;
  return `
  <section class="part closing" aria-labelledby="closing-title">
    <div class="closing__flower">${flower({ heart, cls: "flower--closing" })}</div>
    ${open ? `
    ${deadline && t.text ? `<p class="closing__text" data-rise>${esc(interpolate(t.text, { deadline }))}</p>` : ""}
    <div class="closing__action" data-rise><button class="button" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button></div>`
    : late ? `<p class="closing__text" data-rise>${esc(late)}</p>` : ""}
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
