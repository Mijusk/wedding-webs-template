import { dateParts, time, daysUntil, esc, fill, rsvpClosed, weddingPhase } from "./format.js";
import { calendarUrl } from "./calendar.js";
import { scheduleLight, lightName } from "./sky.js";

// «Del día a la noche»: bajar por la web es pasar el día de la boda. Cada sección lleva
// data-sky con su momento (minutos respecto a la puesta de sol); las que no lo tienen
// (data-sky="") lo reciben en js/motion.js, repartido entre las que sí.
// Cada función recibe (config, n): n es el número de la sección entre las que se pintan.

// Para meter una dirección en url('…') sin que unas comillas o paréntesis la rompan.
const cssUrl = (u) => String(u || "").replace(/['"()\\\s]/g, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`);

export const arrow = `<span class="link__arrow" aria-hidden="true">→</span>`;

const head = ({ eyebrow, title, id, text }) => `
      <header class="head">
        ${eyebrow ? `<p class="eyebrow head__eyebrow reveal">${esc(eyebrow)}</p>` : ""}
        ${title ? `<h2 class="head__title reveal" id="${id}">${esc(title)}</h2>` : ""}
        ${text ? `<p class="head__text reveal">${esc(text)}</p>` : ""}
      </header>`;

// Portada: la foto se ve a través de los nombres gigantes y, al bajar, las letras crecen
// hasta abrirse a la foto entera (js/motion.js).
export function hero(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.hero || {};
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const len = Math.max(String(a).length, String(b).length, 4);
  const total = String(a).length + String(b).length + 3;
  const place = venue.city || venue.name || "";
  return `
  <section class="hero" data-sky="-330" aria-labelledby="hero-title">
    <div class="hero__stage">
      <img class="hero__photo" src="${esc(event.photo)}" alt="${esc(event.photoAlt || `${a} y ${b}`)}" fetchpriority="high">
      <div class="hero__veil" aria-hidden="true"></div>
      <div class="hero__mask" aria-hidden="true"></div>
      <h1 class="hero__names" id="hero-title" style="--len:${len};--total:${total};background-image:url('${esc(cssUrl(event.photo))}')">
          <span class="hero__name">${esc(a)}</span>
          <span class="hero__amp">&amp;</span>
          <span class="hero__name">${esc(b)}</span>
      </h1>
      <div class="hero__frame">
        ${t.eyebrow ? `<p class="eyebrow hero__eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <p class="hero__date">${esc(d.numeric)}${place ? ` <span aria-hidden="true">·</span> ${esc(place)}` : ""}</p>
      </div>
      <div class="hero__after">
        <p class="eyebrow"><span class="cap">${esc(d.weekday)}</span>, ${esc(d.dayMonth)} ${esc(d.year)}</p>
        ${event.tagline ? `<p class="hero__tagline">${esc(event.tagline)}</p>` : ""}
        ${venue.name ? `<p class="hero__place">${esc(venue.name)}${venue.city && venue.city !== venue.name ? ` · ${esc(venue.city)}` : ""}</p>` : ""}
      </div>
      ${t.hint ? `<p class="hero__hint" aria-hidden="true"><span>${esc(t.hint)}</span></p>` : ""}
    </div>
  </section>`;
}

// Lo esencial: dos tarjetas que caen sobre la mesa como polaroids al bajar.
export function details(config, n) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.details || {};
  const d = dateParts(event.date, locale);
  const days = daysUntil(event.date);
  const phase = weddingPhase(event);
  const countdown = phase === "after" || days < 0 ? "" : fill(days === 0 ? t.countdownToday : days === 1 ? t.countdownOne : t.countdown, { days });
  const suffix = t.timeSuffix ? ` ${esc(t.timeSuffix)}` : "";
  return `
  <section class="section details" data-sky="" aria-labelledby="details-title">
    ${head({ eyebrow: t.eyebrow, title: t.title || "", id: "details-title", text: t.intro, n })}
    <div class="wrap">
      <dl class="cards">
        <div class="card" data-deal="0">
          <dt class="eyebrow">${esc(t.when || "Cuándo")}</dt>
          <dd class="card__big"><span class="cap">${esc(d.weekday)}</span>, ${esc(d.dayMonth)}</dd>
          <dd class="card__small">${esc(d.year)} · ${esc(time(event.date))}${suffix}</dd>
          ${countdown ? `<dd class="card__note${days === 0 ? " is-today" : ""}">${countdown}</dd>` : ""}
          ${t.calendar && phase === "before" ? `<dd class="card__link"><a class="link" href="${esc(calendarUrl(config))}" target="_blank" rel="noopener">${esc(t.calendar)} ${arrow}</a></dd>` : ""}
        </div>
        <div class="card" data-deal="1">
          <dt class="eyebrow">${esc(t.where || "Dónde")}</dt>
          <dd class="card__big">${esc(venue.name || venue.city || "")}</dd>
          ${venue.address ? `<dd class="card__small">${esc(venue.address)}</dd>` : ""}
          ${venue.mapsUrl && t.map ? `<dd class="card__link"><a class="link" href="${esc(venue.mapsUrl)}" target="_blank" rel="noopener">${esc(t.map)} ${arrow}</a></dd>` : ""}
        </div>
      </dl>
    </div>
  </section>`;
}

// Historia: al bajar, los capítulos pasan de lado (js/motion.js). Sin movimiento, en columna.
export function story(config, n) {
  const { story, event, copy = {} } = config;
  const chapters = story?.chapters?.filter((c) => c.text) || [];
  if (!chapters.length) return "";
  const t = copy.story || {};
  const year = String(event.date).slice(0, 4);
  return `
  <section class="section story" data-sky="" aria-labelledby="story-title">
    <div class="hs">
      <div class="hs__stage">
        <p class="hs__word" aria-hidden="true">${esc(t.word || t.eyebrow || year)}</p>
        <ol class="hs__track">
          <li class="hs__intro">
            ${t.eyebrow ? `<p class="eyebrow">${esc(t.eyebrow)}</p>` : ""}
            <h2 class="hs__title" id="story-title">${esc(t.title || "")}</h2>
            ${t.more ? `<p class="hs__more" aria-hidden="true">${esc(t.more)} ${arrow}</p>` : ""}
          </li>${chapters.map((c, i) => `
          <li class="hs__card${c.photo ? " has-photo" : ""}" style="--i:${i}">
            ${c.photo ? `<figure class="hs__photo"><img src="${esc(c.photo)}" alt="${esc(c.photoAlt || "")}" loading="lazy"></figure>` : ""}
            <div class="hs__body">
              <p class="hs__num" aria-hidden="true">${String(i + 1).padStart(2, "0")}</p>
              ${c.meta ? `<p class="eyebrow hs__meta">${esc(c.meta)}</p>` : ""}
              <p class="hs__text">${esc(c.text)}</p>
            </div>
          </li>`).join("")}
        </ol>
      </div>
    </div>
  </section>`;
}

// Programa: cada momento ocupa la pantalla, con el cielo de su hora real.
export function schedule(config, n) {
  const { schedule = [], copy = {} } = config;
  if (!schedule.length) return "";
  const t = copy.schedule || {};
  const light = t.light || {};
  const { sunset, items } = scheduleLight(config);
  return `
  <section class="section schedule" data-sky="" aria-labelledby="schedule-title">
    ${head({ eyebrow: t.eyebrow, title: t.title || "", id: "schedule-title", text: t.text, n })}
    <ol class="moments">${schedule.map((s, i) => {
      const delta = items[i];
      const name = lightName(delta);
      const label = name && light[name] ? fill(light[name], { time: sunset.label }) : "";
      return `
      <li class="moment" data-sky="${Number.isFinite(delta) ? delta : ""}">
        <div class="moment__in">
          <time class="moment__time">${esc(s.time)}</time>
          <div class="moment__what">
            ${label ? `<p class="eyebrow moment__light">${label}</p>` : ""}
            <h3 class="moment__label">${esc(s.label)}</h3>
            ${s.place ? `<p class="moment__place">${esc(s.place)}</p>` : ""}
          </div>
        </div>
      </li>`;
    }).join("")}
    </ol>
  </section>`;
}

export function dresscode(config, n) {
  const t = config.copy?.dresscode || {};
  if (!t.text) return "";
  const palette = (t.palette || []).filter((c) => c && c.color);
  return `
  <section class="section dresscode" data-sky="" aria-labelledby="dresscode-title">
    ${head({ eyebrow: t.eyebrow, title: t.title || "", id: "dresscode-title", n })}
    <div class="wrap dresscode__in reveal">
      <p class="dresscode__text">${esc(t.text)}</p>
      ${palette.length ? `
      ${t.paletteLabel ? `<p class="eyebrow dresscode__label">${esc(t.paletteLabel)}</p>` : ""}
      <ul class="swatches">${palette.map((c) => `<li class="swatch"><span class="swatch__dot" style="--c:${esc(c.color)}"></span><span class="swatch__name">${esc(c.name || "")}</span></li>`).join("")}</ul>` : ""}
    </div>
  </section>`;
}

// Posiciones de las fotos flotantes: [izquierda %, ancho en móvil %, profundidad].
// La profundidad decide la velocidad (las cercanas suben más rápido) y lo que queda delante.
const SLOTS = [
  [6, 54, 1.0], [52, 40, 1.3], [14, 36, 0.75], [56, 46, 1.1], [4, 42, 1.2],
  [50, 34, 0.8], [18, 50, 1.05], [60, 36, 1.35], [8, 38, 0.9],
];

// Galería: las fotos flotan a distintas profundidades y pasan a distinta velocidad, con los
// nombres enormes cruzando por detrás (js/motion.js). Sin movimiento, una rejilla normal.
export function gallery(config, n) {
  const { gallery = [], event, copy = {} } = config;
  if (!gallery.length) return "";
  const t = copy.gallery || {};
  const [a, b] = event.couple;
  // Con pocas fotos, se repiten con otro encuadre para que la pantalla no quede vacía.
  const pool = [...new Set([...gallery, ...(gallery.length < 4 && event.photo ? [event.photo] : [])])];
  const count = Math.min(SLOTS.length, Math.max(pool.length, Math.min(5, pool.length * 2)));
  const focus = ["50% 50%", "50% 30%", "40% 60%", "60% 40%"];
  return `
  <section class="section gallery" data-sky="" aria-labelledby="gallery-title">
    <div class="layers" style="--count:${count}">
      <div class="layers__stage">
        <p class="layers__names" aria-hidden="true">${esc(a)} &amp; ${esc(b)}</p>
        ${head({ eyebrow: t.eyebrow, title: t.title || "", id: "gallery-title", text: t.text, n })}
        <div class="layers__photos">${Array.from({ length: count }, (_, i) => {
          const [x, w, depth] = SLOTS[i];
          const src = pool[i % pool.length];
          const repeat = i >= pool.length;
          return `
          <figure class="layer${repeat ? " is-repeat" : ""}" style="--x:${x};--w:${w};--depth:${depth};--i:${i}" data-depth="${depth}">
            <img src="${esc(src)}" alt="${repeat ? "" : esc(`${a} y ${b}`)}" loading="lazy" style="object-position:${focus[Math.floor(i / pool.length) % focus.length]}">
          </figure>`;
        }).join("")}
        </div>
      </div>
    </div>
  </section>`;
}

export function gifts(config, n) {
  const { gifts, copy = {} } = config;
  if (!gifts?.iban) return "";
  const t = copy.gifts || {};
  const raw = gifts.iban.replace(/\s+/g, "").toUpperCase();
  return `
  <section class="section gifts" data-sky="" aria-labelledby="gifts-title">
    ${head({ eyebrow: t.eyebrow, title: t.title || "", id: "gifts-title", text: t.text, n })}
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

// Cierre, ya de noche: botón de confirmar mientras la lista está abierta; después, los nombres.
export function closing(config) {
  const { event, rsvp = {}, sections, locale, copy = {} } = config;
  const [a, b] = event.couple;
  const t = copy.closing || {};
  const open = sections.includes("rsvp") && !rsvpClosed({ event, rsvp });
  const phase = weddingPhase(event);
  const deadline = rsvp.deadline ? dateParts(rsvp.deadline, locale).dayMonth : "";
  const year = dateParts(event.date, locale).year;
  const len = Math.max(String(a).length, String(b).length, 5);
  const late = phase === "today" ? t.today : phase === "after" ? t.after : "";
  return `
  <section class="closing" data-sky="" aria-labelledby="closing-title">
    <div class="closing__body">
      <div class="closing__moon" aria-hidden="true"></div>
      <div class="wrap closing__in">
        ${open ? `
          ${t.eyebrow ? `<p class="eyebrow reveal">${esc(t.eyebrow)}</p>` : ""}
          <h2 class="closing__title reveal" id="closing-title">${esc(t.title)}</h2>
          ${deadline && t.text ? `<p class="closing__text reveal">${fill(t.text, { deadline })}</p>` : ""}
          <div class="closing__action reveal"><button class="button" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button></div>`
        : `<h2 class="closing__title closing__title--names reveal" id="closing-title" style="--len:${len}">${esc(a)} <span class="amp">&amp;</span> ${esc(b)}</h2>
           ${late ? `<p class="closing__text reveal">${esc(late)}</p>` : ""}`}
      </div>
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
