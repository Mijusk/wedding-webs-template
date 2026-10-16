import { dateParts, time, daysUntil, esc, fill, rsvpClosed } from "./format.js";
import { calendarUrl } from "./calendar.js";

// Plantilla Capilla: arco y vidriera para bodas religiosas, sin recargar.
// Piedra clara, oro y granate; las fotos van en arcos de medio punto con molduras finas
// y un rosetón dibujado a línea con las iniciales de la pareja en el centro.

/* ---------- utilidades ---------- */

const f = (n) => n.toFixed(2).replace(/\.?0+$/, "");
const arrow = `<span class="link__arrow" aria-hidden="true">→</span>`;

// Inicial sin tilde ("Íñigo" → "I"): en una vidriera no se graban acentos.
const initial = (name) => (String(name || "").trim().normalize("NFD").replace(/[̀-ͯ]/g, "")[0] || "").toUpperCase();

// Palabra más larga de los nombres: decide el tamaño de los nombres en móvil.
const longestWord = (...names) => Math.max(5, ...names.flatMap((n) => String(n).split(/\s+/)).map((w) => w.length));

/* ---------- rosetón ---------- */

// Geometría radial de vidriera: dos anillos, una corona de lóbulos, doce lancetas con su
// óculo y radios de piedra entre ellas, y un medallón central con las iniciales.
// Cada trazo lleva --d (ms) para dibujarse en orden en la entrada.
const PETALS = 12, LOBES = 24;
const petal = "M-4.5 -37L-10.5 -60Q-11.5 -71 0 -77Q11.5 -71 10.5 -60L4.5 -37Q0 -35.2 -4.5 -37Z";
// Ancho aproximado de cada mayúscula de Cinzel (en em) para centrar cualquier pareja de iniciales.
const WIDE = { M: 0.98, W: 1.12, Æ: 1.1, Œ: 1.12 }, NARROW = { I: 0.38, J: 0.42 };
const capWidth = (c) => WIDE[c] ?? NARROW[c] ?? 0.74;

export function rose(event, { label = "", cls = "" } = {}) {
  const [a, b] = event.couple;
  const ia = initial(a), ib = initial(b);
  const size = Math.min(22, 40 / (capWidth(ia) + capWidth(ib) + 0.5));
  const parts = [];
  const ring = (r, d, c = "rose__line") => `<circle class="${c} draw" pathLength="1" style="--d:${d}" r="${r}" transform="rotate(-90)"/>`;

  parts.push(`<circle class="rose__disc" r="99"/>`);
  parts.push(ring(96, 0), ring(91.5, 90, "rose__line rose__line--thin"));
  for (let i = 0; i < LOBES; i++) {
    const deg = (i * 360) / LOBES;
    parts.push(`<circle class="rose__lobe draw" pathLength="1" style="--d:${260 + i * 22}" cx="0" cy="-84.6" r="5.4" transform="rotate(${f(deg)})"/>`);
  }
  parts.push(ring(78, 200));
  for (let i = 0; i < PETALS; i++) {
    const deg = (i * 360) / PETALS;
    const glass = i % 2 ? "rose__petal--blue" : "rose__petal--red";
    parts.push(`<g transform="rotate(${f(deg)})">
      <path class="rose__petal ${glass} draw" pathLength="1" style="--d:${420 + i * 50}" d="${petal}"/>
      <circle class="rose__oculus draw" pathLength="1" style="--d:${760 + i * 40}" cy="-63.5" r="3.7"/>
      <path class="rose__spoke draw" pathLength="1" style="--d:${340 + i * 30}" d="M0 -32V-78" transform="rotate(15)"/>
    </g>`);
  }
  parts.push(ring(32, 300), ring(27.5, 380, "rose__line rose__line--thin"));
  parts.push(`<circle class="rose__core" r="27"/>`);
  parts.push(`<text class="rose__mono" y="${f(size * 0.35)}" text-anchor="middle" font-size="${f(size)}">${esc(ia)}<tspan class="rose__amp" dx="${f(size * 0.08)}" dy="${f(-size * 0.04)}" font-size="${f(size * 0.6)}">&amp;</tspan><tspan dx="${f(size * 0.08)}" dy="${f(size * 0.04)}">${esc(ib)}</tspan></text>`);

  return `<svg class="rose${cls ? ` ${cls}` : ""}" viewBox="-100 -100 200 200" role="img" aria-label="${esc(label || `${a} & ${b}`)}">${parts.join("")}</svg>`;
}

// Rosetón pequeño de adorno (cabeceras de sección): ocho pétalos a línea.
const mini = `<svg class="mini" viewBox="-12 -12 24 24" aria-hidden="true"><circle r="11"/><circle r="3.2"/>${
  Array.from({ length: 8 }, (_, i) => `<path d="M0 -3.6Q2.6 -7.4 0 -10.4Q-2.6 -7.4 0 -3.6Z" transform="rotate(${i * 45})"/>`).join("")
}</svg>`;

// Cabecera de sección: rosetón pequeño entre filetes, antetítulo y título.
function head(eyebrow, title, id) {
  return `
      <header class="head reveal">
        <p class="head__orn" aria-hidden="true"><span class="head__rule"></span>${mini}<span class="head__rule"></span></p>
        ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ""}
        ${title ? `<h2 class="head__title" id="${id}">${esc(title)}</h2>` : ""}
      </header>`;
}

// Foto en arco de medio punto con molduras.
function arch(src, alt, { cls = "", focus = "", lazy = true } = {}) {
  const pos = focus ? ` style="object-position:${esc(focus)}"` : "";
  return `<div class="portal${cls ? ` ${cls}` : ""}"><div class="arch"><img src="${esc(src)}" alt="${esc(alt)}"${pos}${lazy ? ` loading="lazy"` : ` fetchpriority="high"`}></div></div>`;
}

/* ---------- secciones ---------- */

export function hero({ event, venue = {}, locale, copy = {} }) {
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const place = [venue.name, venue.city].filter(Boolean);
  const len = longestWord(a, b);
  const total = Math.max(12, String(a).length + String(b).length + 3);
  return `
  <section class="hero" aria-labelledby="hero-title">
    <span class="hero__beam" aria-hidden="true"></span>
    <div class="hero__in">
      <div class="hero__rose">${rose(event)}</div>
      <div class="portal portal--hero">
        <div class="arch">
          <img src="${esc(event.photo)}" alt="${esc(event.photoAlt)}"${event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : ""} fetchpriority="high">
          <span class="arch__shade" aria-hidden="true"></span>
          <span class="arch__glow" aria-hidden="true"></span>
        </div>
      </div>
      <div class="hero__text">
        ${copy.hero?.eyebrow ? `<p class="eyebrow hero__eyebrow">${esc(copy.hero.eyebrow)}</p>` : ""}
        <h1 class="hero__names" id="hero-title" style="--len:${len};--total:${total}">
          <span class="hero__name">${esc(a)}</span>
          <span class="hero__amp">&amp;</span>
          <span class="hero__name">${esc(b)}</span>
        </h1>
        <p class="hero__date">${esc(d.weekday)}, ${esc(d.dayMonth)} de ${esc(d.year)}</p>
        ${place.length ? `<p class="hero__place">${place.map(esc).join(` <span class="hero__sep" aria-hidden="true"></span> `)}</p>` : ""}
      </div>
    </div>
  </section>`;
}

// La ceremonia es el momento del programa que se llama así (o el primero); la celebración,
// el siguiente. Si no hay programa, un solo panel con el lugar.
const CEREMONY = /ceremon|misa|iglesia|enlace|bendici|boda civil|templo|capilla/i;

export function details(config) {
  const { event, venue = {}, schedule = [], locale, copy = {} } = config;
  const t = copy.details || {};
  const d = dateParts(event.date, locale);
  const days = daysUntil(event.date);
  const countdown = days < 0 ? "" : fill(days === 0 ? t.countdownToday : days === 1 ? t.countdownOne : t.countdown, { days });
  const suffix = t.timeSuffix ? `<small> ${esc(t.timeSuffix)}</small>` : "";

  let ci = schedule.findIndex((s) => CEREMONY.test(s.label || ""));
  if (ci < 0) ci = schedule.length ? 0 : -1;
  const cer = schedule[ci];
  const party = ci >= 0 ? schedule[ci + 1] : undefined;
  const map = venue.mapsUrl && t.map ? `<a class="link" href="${esc(venue.mapsUrl)}" target="_blank" rel="noopener">${esc(t.map)} ${arrow}</a>` : "";
  const cal = t.calendar ? `<a class="link" href="${esc(calendarUrl(config))}" target="_blank" rel="noopener">${esc(t.calendar)} ${arrow}</a>` : "";
  const address = venue.address ? `<p class="panel__small">${esc(venue.address)}</p>` : "";

  const panels = [];
  panels.push(`
        <article class="panel reveal">
          <div class="panel__orn" aria-hidden="true">${mini}</div>
          <h3 class="eyebrow panel__label">${esc(party ? t.ceremony || "La ceremonia" : t.single || t.ceremony || "La ceremonia")}</h3>
          <p class="panel__time">${esc(time(event.date))}${suffix}</p>
          <p class="panel__place">${esc(cer?.place && party ? cer.place : venue.name || cer?.place || "")}</p>
          ${party ? (cer?.place && venue.name && cer.place !== venue.name ? `<p class="panel__small">${esc(venue.name)}</p>` : "") + cal : `${address}<span class="panel__links">${cal}${map}</span>`}
        </article>`);
  if (party) {
    panels.push(`
        <article class="panel reveal" style="--i:1">
          <div class="panel__orn" aria-hidden="true">${mini}</div>
          <h3 class="eyebrow panel__label">${esc(t.celebration || "La celebración")}</h3>
          <p class="panel__time">${esc(party.time)}${suffix}</p>
          <p class="panel__place">${esc(venue.name || party.place || "")}</p>
          ${address}${map}
        </article>`);
  }

  return `
  <section class="section details" aria-labelledby="details-title">
    <div class="wrap">
      ${head(t.eyebrow, t.title || venue.name || "", "details-title")}
      <div class="when reveal">
        <p class="when__date"><span class="when__wd">${esc(d.weekday)}</span> ${esc(d.dayMonth)} <span class="when__y">${esc(d.year)}</span></p>
        ${countdown ? `<p class="when__count">${countdown}</p>` : ""}
      </div>
      <div class="panels" data-count="${panels.length}">${panels.join("")}
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
      ${head(t.eyebrow, t.title || "", "story-title")}
      <ol class="chapters">${chapters.map((c, i) => `
        <li class="chapter reveal">
          ${i ? `<span class="chapter__sep" aria-hidden="true"></span>` : ""}
          ${c.photo ? arch(c.photo, c.photoAlt || "", { cls: "portal--small" }) : ""}
          ${c.meta ? `<p class="eyebrow chapter__meta">${esc(c.meta)}</p>` : ""}
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
      ${head(t.eyebrow, t.title || "", "schedule-title")}
      <ol class="order">${schedule.map((s, i) => `
        <li class="order__item reveal" style="--i:${i}">
          <time class="order__time">${esc(s.time)}</time>
          <span class="order__node" aria-hidden="true"></span>
          <span class="order__what"><span class="order__label">${esc(s.label)}</span>${s.place ? `<span class="order__place">${esc(s.place)}</span>` : ""}</span>
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

// Lecturas y música: solo si hay alguna entrada con texto.
export function liturgy(config) {
  const t = config.copy?.liturgy || {};
  const items = (t.items || []).filter((it) => it && (it.label || it.text));
  if (!items.length) return "";
  return `
  <section class="section liturgy" aria-labelledby="liturgy-title">
    <div class="wrap">
      ${head(t.eyebrow, t.title || "", "liturgy-title")}
      ${t.intro ? `<p class="lede reveal">${esc(t.intro)}</p>` : ""}
      <div class="missal reveal">
        <dl class="missal__list">${items.map((it) => `
          <div class="missal__item">
            ${it.label ? `<dt class="missal__label">${esc(it.label)}</dt>` : ""}
            ${it.text ? `<dd class="missal__text">${esc(it.text)}</dd>` : ""}
          </div>`).join("")}
        </dl>
      </div>
    </div>
  </section>`;
}

export function gallery(config) {
  const { gallery = [], event, copy = {} } = config;
  const photos = gallery.filter(Boolean);
  if (!photos.length) return "";
  const t = copy.gallery || {};
  const [a, b] = event.couple;
  return `
  <section class="section gallery" aria-labelledby="gallery-title">
    <div class="wrap">
      ${head(t.eyebrow, t.title || "", "gallery-title")}
      <ul class="arcade" data-count="${photos.length > 4 ? "many" : photos.length}">${photos.map((src, i) => `
        <li class="arcade__item reveal" style="--i:${i % 3}">${arch(src, `${a} y ${b}`)}</li>`).join("")}
      </ul>
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
      ${head(t.eyebrow, t.title || "", "gifts-title")}
      ${t.text ? `<p class="lede reveal">${esc(t.text)}</p>` : ""}
      <details class="iban reveal">
        <summary class="link">${esc(t.reveal || "Ver los datos de la cuenta")}</summary>
        <div class="iban__card">
          ${gifts.holder ? `<p class="eyebrow">${esc(t.holderLabel)}</p><p class="iban__holder">${esc(gifts.holder)}</p>` : ""}
          <p class="eyebrow">${esc(t.ibanLabel)}</p>
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
  const hasRsvp = sections.includes("rsvp") && !rsvpClosed({ event, rsvp });
  const deadline = rsvp.deadline ? dateParts(rsvp.deadline, locale).dayMonth : "";
  const year = dateParts(event.date, locale).year;
  return `
  <section class="closing" aria-labelledby="closing-title">
    <div class="wrap">
      <div class="closing__portal">
        <div class="closing__rose reveal">${rose(event, { cls: "rose--small" })}</div>
        ${hasRsvp ? `
          ${t.eyebrow ? `<p class="eyebrow reveal">${esc(t.eyebrow)}</p>` : ""}
          <h2 class="closing__title reveal" id="closing-title">${esc(t.title)}</h2>
          ${deadline && t.text ? `<p class="closing__text reveal">${fill(t.text, { deadline })}</p>` : ""}
          <div class="reveal"><button class="button" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button></div>`
        : `
          ${t.after ? `<p class="eyebrow reveal">${esc(t.after)}</p>` : ""}
          <h2 class="closing__title closing__title--names reveal" id="closing-title"><span>${esc(a)}</span> <em>&amp;</em> <span>${esc(b)}</span></h2>`}
      </div>
    </div>
    <footer class="closing__foot">
      <span>${esc(a)} &amp; ${esc(b)}</span>
      <span aria-hidden="true" class="closing__dot"></span>
      <span>${esc(year)}</span>
    </footer>
  </section>`;
}
