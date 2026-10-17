import { dateParts, time, daysUntil, esc, fill, rsvpClosed } from "./format.js";
import { calendarUrl } from "./calendar.js";
import { PALETTE, wash, paperMask, stroke, seedOf } from "./acuarela.js";

// Plantilla Acuarela: papel de algodón, manchas de color pintadas con SVG,
// fotos con borde de acuarela y nombres caligrafiados.
const COLORS = [PALETTE.sage, PALETTE.blue, PALETTE.peach];
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

// Las imágenes se generan una vez por boda (misma semilla → mismo dibujo) y se guardan:
// al volver a pintar en la vista previa no se recalcula nada.
const cache = new Map();
const memo = (key, make) => (cache.has(key) ? cache.get(key) : cache.set(key, make()).get(key));
const seedFor = (event) => seedOf(event.couple.join("&"));

const washImg = (cls, color, seed, opts) =>
  `<img class="wash ${cls}" src="${esc(memo(`w${color}${seed}${JSON.stringify(opts || {})}`, () => wash(color, seed, opts)))}" alt="" aria-hidden="true" decoding="async">`;
const cssUrl = (u) => `url(&quot;${esc(u)}&quot;)`;
const maskStyle = (seed, w, h) => `--shape:${cssUrl(memo(`m${seed}${w}x${h}`, () => paperMask(seed, { w, h })))}`;

const head = (eyebrow, title, id, color, seed) => `
  <header class="head reveal">
    ${washImg("head__wash", color, seed, { w: 760, h: 300 })}
    ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ""}
    ${title ? `<h2 class="script head__title" id="${id}">${esc(title)}</h2>` : ""}
  </header>`;

const arrow = `<svg class="link__arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M6 4h6v6"/></svg>`;
const link = (href, text) => `<a class="link" href="${esc(href)}" target="_blank" rel="noopener">${esc(text)}${arrow}</a>`;

// Pequeña rama dibujada a línea, como separador.
const sprig = `<svg class="sprig" viewBox="0 0 120 24" aria-hidden="true"><path d="M4 12h112"/><path d="M60 12c-6-7-14-8-20-6 5 4 12 6 20 6Zm0 0c6-7 14-8 20-6-5 4-12 6-20 6Zm-22 0c-4 4-10 5-15 4 4-3 9-4 15-4Zm44 0c4 4 10 5 15 4-4-3-9-4-15-4Z"/></svg>`;

export function hero({ event, venue = {}, locale, copy = {} }) {
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const seed = seedFor(event);
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  const len = Math.max(a.length, b.length, 4);
  const strokes = [0, 1, 2, 3, 4].map((i) => `--s${i}:${cssUrl(memo(`s${seed}${i}`, () => stroke(seed + i * 31, { flip: i % 2 === 1 })))}`).join(";");
  const place = [venue.name, venue.city].filter(Boolean);
  return `
  <section class="hero" aria-labelledby="hero-names">
    <div class="hero__washes" aria-hidden="true">
      ${washImg("hero__wash hero__wash--a", PALETTE.peach, seed + 1, { w: 1000, h: 700 })}
      ${washImg("hero__wash hero__wash--b", PALETTE.sage, seed + 2, { w: 900, h: 700 })}
      ${washImg("hero__wash hero__wash--c", PALETTE.blue, seed + 3, { w: 900, h: 700 })}
    </div>
    ${copy.hero?.eyebrow ? `<p class="eyebrow hero__eyebrow">${esc(copy.hero.eyebrow)}</p>` : ""}
    <figure class="hero__paint paint" style="${maskStyle(seed, 1600, 760)};--shape-m:${cssUrl(memo(`mm${seed}`, () => paperMask(seed, { w: 800, h: 1000 })))};${strokes}">
      <img src="${esc(event.photo)}" alt="${esc(event.photoAlt)}"${focus} fetchpriority="high">
    </figure>
    <h1 class="hero__names script" id="hero-names" style="--len:${len};--total:${a.length + b.length + 3}">
      <span class="hero__name">${esc(a)}</span> <span class="hero__amp">&amp;</span> <span class="hero__name">${esc(b)}</span>
    </h1>
    <div class="hero__meta">
      <p class="hero__date">${esc(d.weekday)}, ${esc(d.dayMonth)} de ${esc(d.year)}</p>
      ${place.length ? `<p class="eyebrow hero__place">${place.map(esc).join(" · ")}</p>` : ""}
      ${event.tagline ? `<p class="hero__tagline">${esc(event.tagline)}</p>` : ""}
    </div>
  </section>`;
}

export function details(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.details || {};
  const d = dateParts(event.date, locale);
  const seed = seedFor(event) + 10;
  const days = daysUntil(event.date);
  const countdown = days < 0 ? "" : fill(days === 0 ? t.countdownToday : days === 1 ? t.countdownOne : t.countdown, { days });
  const hour = t.timeLine ? fill(t.timeLine, { time: time(event.date) }) : `${esc(time(event.date))} ${esc(t.timeSuffix || "h")}`;
  return `
  <section class="sec details" aria-labelledby="details-title">
    ${washImg("sec__wash details__wash", PALETTE.blue, seed, { w: 1100, h: 700, layers: 3 })}
    ${head(t.eyebrow, t.title, "details-title", PALETTE.peach, seed + 1)}
    <div class="facts">
      <div class="fact reveal">
        <p class="eyebrow">${esc(t.when || "Cuándo")}</p>
        <p class="fact__big"><span class="fact__weekday">${esc(d.weekday)}</span> ${esc(d.dayMonth)} de ${esc(d.year)}</p>
        <p class="fact__sub">${hour}</p>
        ${t.calendar ? link(calendarUrl(config), t.calendar) : ""}
      </div>
      <div class="facts__sep" aria-hidden="true">${sprig}</div>
      <div class="fact reveal" style="--i:1">
        <p class="eyebrow">${esc(t.where || "Dónde")}</p>
        <p class="fact__big">${esc(venue.name)}</p>
        ${venue.address ? `<p class="fact__sub">${esc(venue.address)}</p>` : ""}
        ${venue.mapsUrl && t.map ? link(venue.mapsUrl, t.map) : ""}
      </div>
    </div>
    ${countdown ? `<p class="countdown reveal">${countdown}</p>` : ""}
  </section>`;
}

export function story({ story, event, copy = {} }) {
  const chapters = story?.chapters?.filter((c) => c.text) || [];
  if (!chapters.length) return "";
  const t = copy.story || {};
  const seed = seedFor(event) + 20;
  return `
  <section class="sec story" aria-labelledby="story-title">
    ${head(t.eyebrow, t.title, "story-title", PALETTE.sage, seed)}
    <ol class="chapters">${chapters.map((c, i) => {
      const n = ROMAN[i] || String(i + 1);
      const label = `${t.chapter || "Capítulo"} ${n}`;
      return `
      <li class="chapter reveal${c.photo ? " chapter--photo" : ""}">
        ${c.photo ? `<div class="chapter__media">
          ${washImg("chapter__photowash", COLORS[(i + 1) % 3], seed + i * 7 + 3, { w: 800, h: 900 })}
          <figure class="chapter__photo paint" style="${maskStyle(seed + i * 7, 800, 1000)}"><img src="${esc(c.photo)}" alt="${esc(c.photoAlt || "")}" loading="lazy" decoding="async"></figure>
        </div>` : ""}
        <div class="chapter__body">
          <div class="chapter__mark">
            ${washImg("chapter__wash", COLORS[i % 3], seed + i, { w: 700, h: 360 })}
            <p class="eyebrow">${esc(label)}</p>
            ${c.meta ? `<h3 class="script chapter__meta">${esc(c.meta)}</h3>` : ""}
          </div>
          <p class="chapter__text">${esc(c.text)}</p>
        </div>
      </li>`;
    }).join("")}
    </ol>
  </section>`;
}

// Iconos a línea para el programa. Si la etiqueta no se reconoce, una hoja.
const ICONS = {
  rings: `<circle cx="19" cy="29" r="9.5"/><circle cx="29.5" cy="29" r="9.5"/><path d="M19 19.5 16 16l3-3.2 3 3.2Z"/>`,
  glasses: `<g transform="rotate(-14 17 26)"><path d="M12.5 9h9l-.6 9.5a3.9 3.9 0 0 1-7.8 0Z"/><path d="M17 22.4V37M13 37h8"/></g><g transform="rotate(14 31 26)"><path d="M26.5 9h9l-.6 9.5a3.9 3.9 0 0 1-7.8 0Z"/><path d="M31 22.4V37M27 37h8"/></g><path d="M24 4.5v3M20.6 6l1.4 2.2M27.4 6 26 8.2"/>`,
  plate: `<circle cx="24" cy="25" r="10"/><circle cx="24" cy="25" r="6.2" opacity=".55"/><path d="M8 13v6.5a2 2 0 0 0 4 0V13M10 13v24"/><path d="M39.5 37V13c3 2.4 3.6 8.6 0 12"/>`,
  note: `<path d="M19 33V12.5l15-3.5v20.5"/><path d="M19 17l15-3.5"/><ellipse cx="15.6" cy="33.4" rx="4" ry="3.1" transform="rotate(-18 15.6 33.4)"/><ellipse cx="30.6" cy="29.8" rx="4" ry="3.1" transform="rotate(-18 30.6 29.8)"/>`,
  leaf: `<path d="M24 39C13 31 13 17 24 8c11 9 11 23 0 31Z"/><path d="M24 43V14M24 24l-5-4M24 30l5-4"/>`,
};
const RULES = [
  ["rings", /ceremon|boda|iglesia|civil|enlace|rito|altar|votos|si,? quiero/],
  ["glasses", /coctel|cocktail|aperitivo|brindis|vino|recepcion|bienvenida|copa|vermut/],
  ["plate", /cena|comida|banquete|almuerzo|menu|mesa|brunch|desayuno|merienda/],
  ["note", /fiesta|baile|musica|barra|dj|concierto|bail|orquesta|copas/],
];
function iconFor(label = "") {
  const s = label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const hit = RULES.find(([, re]) => re.test(s));
  return `<svg class="icon" viewBox="0 0 48 48" aria-hidden="true">${ICONS[hit ? hit[0] : "leaf"]}</svg>`;
}

export function schedule({ schedule = [], event, copy = {} }) {
  if (!schedule.length) return "";
  const t = copy.schedule || {};
  const seed = seedFor(event) + 30;
  return `
  <section class="sec schedule" aria-labelledby="schedule-title">
    ${washImg("sec__wash schedule__wash", PALETTE.sage, seed, { w: 900, h: 1100, layers: 3 })}
    ${head(t.eyebrow, t.title, "schedule-title", PALETTE.blue, seed + 1)}
    <ol class="timeline">${schedule.map((s, i) => `
      <li class="reveal" style="--i:${i}">
        <time class="timeline__time">${esc(s.time)}</time>
        <span class="timeline__icon">${washImg("timeline__wash", COLORS[i % 3], seed + 2 + (i % 3), { w: 240, h: 240, layers: 1 })}${iconFor(s.label)}</span>
        <span class="timeline__text"><span class="timeline__what">${esc(s.label)}</span>${s.place ? `<span class="timeline__where">${esc(s.place)}</span>` : ""}</span>
      </li>`).join("")}
    </ol>
  </section>`;
}

export function gallery({ gallery = [], event, copy = {} }) {
  if (!gallery.length) return "";
  const [a, b] = event.couple;
  const t = copy.gallery || {};
  const seed = seedFor(event) + 40;
  const photos = gallery.slice(0, 6);
  return `
  <section class="sec gallery" aria-labelledby="gallery-title">
    ${head(t.eyebrow, t.title, "gallery-title", PALETTE.peach, seed)}
    <div class="photos" data-count="${photos.length}">
      ${washImg("sec__wash gallery__wash", PALETTE.blue, seed + 1, { w: 1100, h: 600, layers: 3 })}
      ${photos.map((src, i) => `
      <figure class="photo paint reveal" style="--i:${i};${maskStyle(seed + i * 13, 800, 1000)}">
        <img src="${esc(src)}" alt="${esc(`${a} y ${b}`)}" loading="lazy" decoding="async">
      </figure>`).join("")}
    </div>
  </section>`;
}

export function gifts({ gifts, event, copy = {} }) {
  if (!gifts?.iban) return "";
  const t = copy.gifts || {};
  const raw = gifts.iban.replace(/\s+/g, "").toUpperCase();
  const seed = seedFor(event) + 50;
  return `
  <section class="sec gifts" aria-labelledby="gifts-title">
    ${head(t.eyebrow, t.title, "gifts-title", PALETTE.sage, seed)}
    ${t.text ? `<p class="gifts__text reveal">${esc(t.text)}</p>` : ""}
    <details class="iban reveal">
      <summary class="link">${esc(t.reveal || "Ver los datos de la cuenta")}</summary>
      <div class="iban__card">
        ${gifts.holder ? `<p class="eyebrow">${esc(t.holderLabel)}</p><p class="iban__holder">${esc(gifts.holder)}</p>` : ""}
        <p class="eyebrow">${esc(t.ibanLabel)}</p>
        <p class="iban__num" id="iban-value">${esc(raw.match(/.{1,4}/g).join(" "))}</p>
        <button class="link" type="button" data-copy="${esc(raw)}" data-done="${esc(t.copied)}" aria-controls="iban-value"><span data-label aria-live="polite">${esc(t.copy)}</span></button>
      </div>
    </details>
  </section>`;
}

export function closing({ event, rsvp = {}, sections, locale, copy = {} }) {
  const [a, b] = event.couple;
  const t = copy.closing || {};
  const hasRsvp = sections.includes("rsvp") && !rsvpClosed({ event, rsvp });
  const deadline = rsvp.deadline ? dateParts(rsvp.deadline, locale).dayMonth : "";
  const seed = seedFor(event) + 60;
  return `
  <section class="closing" aria-labelledby="closing-title">
    <div class="closing__washes" aria-hidden="true">
      ${washImg("closing__wash closing__wash--a", PALETTE.blue, seed, { w: 1000, h: 700 })}
      ${washImg("closing__wash closing__wash--b", PALETTE.peach, seed + 1, { w: 900, h: 700 })}
      ${washImg("closing__wash closing__wash--c", PALETTE.sage, seed + 2, { w: 800, h: 600 })}
    </div>
    <div class="closing__inner">
      ${t.eyebrow && hasRsvp ? `<p class="eyebrow reveal">${esc(t.eyebrow)}</p>` : ""}
      <h2 class="script closing__title reveal${hasRsvp ? "" : " is-names"}" id="closing-title" style="--len:${Math.max(a.length, b.length, 4)}">${hasRsvp ? esc(t.title) : `${esc(a)} <span class="hero__amp">&amp;</span> ${esc(b)}`}</h2>
      ${hasRsvp && deadline && t.text ? `<p class="closing__text reveal">${fill(t.text, { deadline })}</p>` : ""}
      ${hasRsvp ? `<div class="reveal"><button class="button" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button></div>` : ""}
    </div>
    <footer class="foot">
      ${sprig}
      ${t.sign ? `<p class="foot__sign">${esc(t.sign)}</p>` : ""}
      <p class="script foot__names"><span class="nowrap">${esc(a)}</span> &amp; <span class="nowrap">${esc(b)}</span></p>
      <p class="eyebrow">${esc(dateParts(event.date, locale).numeric)}</p>
    </footer>
  </section>`;
}
