import { dateParts, time, daysUntil, esc, fill, rsvpClosed } from "./format.js";
import { calendarUrl } from "./calendar.js";

// Plantilla Villa: "old money" mediterráneo. Marfil, oliva y oro viejo; un escudo con las
// iniciales dentro de una corona de olivo, secciones numeradas en romano y mucho aire.

/* ---------- utilidades ---------- */

const ROMAN = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
export function roman(n) {
  let out = "";
  for (const [v, s] of ROMAN) while (n >= v) { out += s; n -= v; }
  return out;
}

// Inicial sin tilde ("Álvaro" → "A"): en un monograma clásico no se graban acentos.
const initial = (name) => (String(name || "").trim().normalize("NFD").replace(/[̀-ͯ]/g, "")[0] || "").toUpperCase();

// Secciones numeradas: el número se calcula con las que de verdad salen, así al quitar una
// la numeración sigue siendo I, II, III… sin huecos.
const NUMBERED = {
  details: () => true,
  story: (c) => c.story?.chapters?.some((ch) => ch.text),
  schedule: (c) => c.schedule?.length,
  dresscode: (c) => c.copy?.dresscode?.text,
  gallery: (c) => c.gallery?.length,
  gifts: (c) => c.gifts?.iban,
};
function numberOf(config, name) {
  const shown = (config.sections || []).filter((s) => NUMBERED[s] && NUMBERED[s](config));
  const i = shown.indexOf(name);
  return i < 0 ? "" : roman(i + 1);
}

const arrow = `<span class="link__arrow" aria-hidden="true">→</span>`;

// Cabecera de sección: número romano entre filetes de oro, antetítulo y título.
function head(config, name, eyebrow, title, id) {
  const n = numberOf(config, name);
  return `
      <header class="head reveal">
        <p class="head__num" aria-hidden="true"><span class="head__rule"></span>${n ? `<span>${n}</span>` : `<span class="head__dot"></span>`}<span class="head__rule"></span></p>
        ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ""}
        <h2 class="head__title" id="${id}">${esc(title)}</h2>
      </header>`;
}

/* ---------- escudo ---------- */

// Corona de olivo dibujada a línea: dos ramas que se cruzan abajo y dejan un hueco arriba.
// Se genera una rama y la otra es su reflejo, así el escudo es siempre simétrico.
const CX = 120, CY = 108, R = 78;
const pt = (deg, r = R) => [CX + r * Math.cos((deg * Math.PI) / 180), CY + r * Math.sin((deg * Math.PI) / 180)];
const f = (n) => n.toFixed(1);

function branch() {
  const from = 78, to = 252; // ángulos en grados (90 = abajo, 270 = arriba)
  const [x0, y0] = pt(from), [x1, y1] = pt(to);
  const parts = [`<path class="crest__stem draw" pathLength="1" style="--d:0" d="M${f(x0)} ${f(y0)} A${R} ${R} 0 0 1 ${f(x1)} ${f(y1)}"/>`];
  const leaves = [];
  const N = 11;
  for (let i = 0; i < N; i++) {
    const deg = 112 + (i * (to - 8 - 112)) / (N - 1);
    const side = i % 2 ? -1 : 1; // 1 = hacia fuera, -1 = hacia dentro
    const len = 22 - i * 0.8;
    const [x, y] = pt(deg);
    // Tangente hacia la punta de la rama (sentido de los ángulos crecientes) girada hacia fuera o dentro.
    const rot = deg + 90 + side * -38;
    leaves.push({ x, y, rot, len, d: 120 + i * 55 });
    if (i % 4 === 1) {
      const [ox, oy] = pt(deg + 4, R - side * 9);
      parts.push(`<ellipse class="crest__olive" style="--d:${700 + i * 40}" cx="${f(ox)}" cy="${f(oy)}" rx="2.6" ry="3.4" transform="rotate(${f(deg)} ${f(ox)} ${f(oy)})"/>`);
    }
  }
  // Hoja final en la punta, siguiendo la rama.
  leaves.push({ x: x1, y: y1, rot: to + 90 - 8, len: 15, d: 120 + N * 55 });
  for (const l of leaves) {
    const L = l.len, w = L * 0.27;
    parts.push(`<g transform="translate(${f(l.x)} ${f(l.y)}) rotate(${f(l.rot)})">
      <path class="crest__leaf draw" pathLength="1" style="--d:${l.d}" d="M0 0C${f(L * 0.3)} ${f(-w)} ${f(L * 0.72)} ${f(-w)} ${f(L)} 0C${f(L * 0.72)} ${f(w)} ${f(L * 0.3)} ${f(w)} 0 0Z"/>
      <path class="crest__vein draw" pathLength="1" style="--d:${l.d + 120}" d="M${f(L * 0.12)} 0L${f(L * 0.8)} 0"/>
    </g>`);
  }
  return parts.join("");
}

// Ancho aproximado de cada mayúscula de Bodoni (en em) para que cualquier pareja de
// iniciales quepa dentro de la corona.
const WIDE = { M: 0.95, W: 1.05, Æ: 1.1, Œ: 1.1 }, NARROW = { I: 0.4, J: 0.45 };
const capWidth = (c) => WIDE[c] ?? NARROW[c] ?? 0.72;

export function crest(event, { small = false, label = "" } = {}) {
  const [a, b] = event.couple;
  const ia = initial(a), ib = initial(b);
  const year = Number(String(event.date).slice(0, 4));
  const size = Math.min(54, 96 / (capWidth(ia) + capWidth(ib)));
  const left = branch();
  return `
  <svg class="crest${small ? " crest--small" : ""}" viewBox="0 0 240 236" role="img" aria-label="${esc(label || `${a} & ${b}`)}">
    <g class="crest__branch">${left}</g>
    <g class="crest__branch" transform="translate(240 0) scale(-1 1)">${left}</g>
    <path class="crest__star" d="M120 25l3 5-3 5-3-5z"/>
    <text class="crest__mono" x="120" y="${f(CY + size * 0.34)}" text-anchor="middle" font-size="${f(size)}">${esc(ia)}<tspan class="crest__amp" dx="${f(size * 0.06)}" dy="${f(-size * 0.04)}" font-size="${f(size * 0.52)}">&amp;</tspan><tspan dx="${f(size * 0.06)}" dy="${f(size * 0.04)}">${esc(ib)}</tspan></text>
    ${year ? `<g class="crest__year">
      <path d="M${f(120 - 64)} 222H${f(120 - 46)}M${f(120 + 46)} 222H${f(120 + 64)}"/>
      <text x="120" y="226" text-anchor="middle">${roman(year)}</text>
    </g>` : ""}
  </svg>`;
}

/* ---------- secciones ---------- */

export function hero({ event, venue = {}, locale, copy = {} }) {
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  const len = Math.max(String(a).length, String(b).length, 4);
  const place = [venue.name, venue.city].filter(Boolean);
  return `
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero__text">
      <div class="hero__crest">${crest(event)}</div>
      ${copy.hero?.eyebrow ? `<p class="eyebrow hero__eyebrow">${esc(copy.hero.eyebrow)}</p>` : ""}
      <h1 class="hero__names" id="hero-title" style="--len:${len}">
        <span class="hero__name">${esc(a)}</span>
        <span class="hero__amp">&amp;</span>
        <span class="hero__name">${esc(b)}</span>
      </h1>
      <div class="hero__meta">
        <span class="hero__rule" aria-hidden="true"></span>
        <p class="hero__date">${esc(d.weekday)}, ${esc(d.dayMonth)} de ${esc(d.year)}</p>
        ${place.length ? `<p class="eyebrow hero__place">${place.map(esc).join(` <span aria-hidden="true">·</span> `)}</p>` : ""}
      </div>
    </div>
    <figure class="hero__window">
      <div class="hero__frame">
        <img src="${esc(event.photo)}" alt="${esc(event.photoAlt)}"${focus} fetchpriority="high">
        <span class="shutter shutter--l" aria-hidden="true"></span>
        <span class="shutter shutter--r" aria-hidden="true"></span>
      </div>
    </figure>
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
      ${head(config, "details", t.eyebrow, venue.name || t.title || "", "details-title")}
      ${t.intro ? `<p class="lede reveal">${esc(t.intro)}</p>` : ""}
      <dl class="facts">
        <div class="fact reveal">
          <dt class="eyebrow">${esc(t.when || "Fecha")}</dt>
          <dd class="fact__big">${esc(d.dayMonth)}</dd>
          <dd class="fact__small">${esc(d.weekday)} · ${esc(d.year)}</dd>
          ${t.calendar ? `<dd><a class="link" href="${esc(calendarUrl(config))}" target="_blank" rel="noopener">${esc(t.calendar)} ${arrow}</a></dd>` : ""}
        </div>
        <div class="fact reveal" style="--i:1">
          <dt class="eyebrow">${esc(t.time || "Hora")}</dt>
          <dd class="fact__big">${esc(time(event.date))}<small> ${esc(t.timeSuffix || "h")}</small></dd>
          ${countdown ? `<dd class="fact__small">${countdown}</dd>` : ""}
        </div>
        <div class="fact reveal" style="--i:2">
          <dt class="eyebrow">${esc(t.where || "Lugar")}</dt>
          <dd class="fact__big">${esc(venue.city || venue.name || "")}</dd>
          ${venue.address ? `<dd class="fact__small">${esc(venue.address)}</dd>` : ""}
          ${venue.mapsUrl && t.map ? `<dd><a class="link" href="${esc(venue.mapsUrl)}" target="_blank" rel="noopener">${esc(t.map)} ${arrow}</a></dd>` : ""}
        </div>
      </dl>
    </div>
  </section>`;
}

const sprig = `<svg class="sprig" viewBox="0 0 60 16" aria-hidden="true"><path d="M2 8H58"/><path d="M30 8c-4-5-9-6-13-5 3 3 8 5 13 5zM30 8c4 5 9 6 13 5-3-3-8-5-13-5zM18 8c-3-3-6-4-9-3 2 2 5 3 9 3zM42 8c3 3 6 4 9 3-2-2-5-3-9-3z"/></svg>`;

export function story(config) {
  const { story, copy = {} } = config;
  const chapters = story?.chapters?.filter((c) => c.text) || [];
  if (!chapters.length) return "";
  const t = copy.story || {};
  const drop = t.dropCap !== false ? " has-drop" : "";
  return `
  <section class="section story" aria-labelledby="story-title">
    <div class="wrap">
      ${head(config, "story", t.eyebrow, t.title || "", "story-title")}
      <ol class="chapters${drop}">${chapters.map((c, i) => `
        <li class="chapter reveal">
          ${i ? sprig : ""}
          ${c.photo ? `<figure class="chapter__photo"><img src="${esc(c.photo)}" alt="${esc(c.photoAlt || "")}" loading="lazy"></figure>` : ""}
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
      ${head(config, "schedule", t.eyebrow, t.title || "", "schedule-title")}
      <ol class="plan">${schedule.map((s, i) => `
        <li class="plan__item reveal" style="--i:${i}">
          <time class="plan__time">${esc(s.time)}</time>
          <span class="plan__dots" aria-hidden="true"></span>
          <span class="plan__what"><span class="plan__label">${esc(s.label)}</span>${s.place ? `<span class="plan__place">${esc(s.place)}</span>` : ""}</span>
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

// Solo colores en formato seguro (#hex, rgb(), hsl()): van dentro de un atributo style.
const safeColor = (c) => (/^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([\d\s.,%/]+\))$/i.test(String(c).trim()) ? String(c).trim() : "");

export function dresscode(config) {
  const t = config.copy?.dresscode || {};
  if (!t.text) return "";
  const swatches = (t.palette || [])
    .map((p) => (typeof p === "string" ? { color: p } : p || {}))
    .map((p) => ({ color: safeColor(p.color), name: p.name || "" }))
    .filter((p) => p.color)
    .slice(0, 6);
  return `
  <section class="section dresscode" aria-labelledby="dresscode-title">
    <div class="wrap">
      ${head(config, "dresscode", t.eyebrow, t.title || "", "dresscode-title")}
      <p class="lede reveal">${esc(t.text)}</p>
      ${swatches.length ? `
      <div class="palette reveal">
        ${t.paletteLabel ? `<p class="eyebrow palette__label">${esc(t.paletteLabel)}</p>` : ""}
        <ul class="palette__list">${swatches.map((p, i) => `
          <li class="swatch" style="--c:${esc(p.color)};--i:${i}"${p.name ? "" : ` aria-label="${esc(p.color)}"`}><span class="swatch__dot" aria-hidden="true"></span>${p.name ? `<span class="swatch__name">${esc(p.name)}</span>` : ""}</li>`).join("")}
        </ul>
      </div>` : ""}
    </div>
  </section>`;
}

export function gallery(config) {
  const { gallery = [], event, copy = {} } = config;
  if (!gallery.length) return "";
  const t = copy.gallery || {};
  const [a, b] = event.couple;
  const photos = gallery.slice(0, 3);
  return `
  <section class="section gallery" aria-labelledby="gallery-title">
    <div class="wrap">
      ${head(config, "gallery", t.eyebrow, t.title || "", "gallery-title")}
      <div class="spread" data-count="${photos.length}">${photos.map((src, i) => `
        <figure class="spread__item reveal" style="--i:${i}">
          <div class="spread__img"><img src="${esc(src)}" alt="${esc(`${a} y ${b}`)}" loading="lazy"></div>
          <figcaption aria-hidden="true">${roman(i + 1)}</figcaption>
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
      ${head(config, "gifts", t.eyebrow, t.title || "", "gifts-title")}
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
    <div class="wrap closing__in">
      <div class="closing__crest reveal">${crest(event, { small: true })}</div>
      ${hasRsvp ? `
        ${t.eyebrow ? `<p class="eyebrow reveal">${esc(t.eyebrow)}</p>` : ""}
        <h2 class="closing__title reveal" id="closing-title">${esc(t.title)}</h2>
        ${deadline && t.text ? `<p class="closing__text reveal">${fill(t.text, { deadline })}</p>` : ""}
        <div class="reveal"><button class="button button--light" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button></div>`
      : `<h2 class="closing__title reveal" id="closing-title">${esc(a)} <em>&amp;</em> ${esc(b)}</h2>`}
    </div>
    <footer class="wrap closing__foot">
      <span>${esc(a)} &amp; ${esc(b)}</span>
      <span aria-hidden="true" class="closing__dot"></span>
      <span>${esc(year)}</span>
    </footer>
  </section>`;
}
