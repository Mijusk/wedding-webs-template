import { dateParts, time, daysUntil, esc, fill, interpolate, rsvpClosed, weddingPhase } from "./format.js";
import { calendarUrl } from "./calendar.js";

// «Promesa»: la web se lee como una promesa dicha en voz alta. Las frases grandes se encienden
// palabra a palabra al bajar y, entre las palabras, hay fotos en óvalo, como un camafeo. Algunos
// de esos óvalos crecen hasta llenar la pantalla: la foto de la portada entre los dos nombres,
// la de cada capítulo de la historia y, al final, la portada vuelve a cerrarse en su óvalo.
// Aquí solo está el contenido. Cuánto se ha encendido cada frase (--p) y cuánto ha crecido cada
// óvalo lo pone js/motion.js.

export const arrow = `<span class="link__arrow" aria-hidden="true">→</span>`;

// Palabras que se encienden. Cada palabra es un <span class="w" style="--i:n">; la frase entera
// lleva --n (cuántas hay) y --p (cuánto se ha leído). Los signos sueltos van con la palabra anterior.
const SOLO_SIGNOS = /^[^\p{L}\p{N}]+$/u;
function words(text, ctx, cls = "") {
  return String(text ?? "").split(/(\s+)/).map((tok) => {
    if (!tok) return "";
    if (/^\s+$/.test(tok)) return " ";
    const i = SOLO_SIGNOS.test(tok) ? Math.max(0, ctx.i - 1) : ctx.i++;
    return `<span class="w${cls}" style="--i:${i}">${esc(tok)}</span>`;
  }).join("");
}

// Óvalo con foto dentro de una frase: cuenta como una palabra más.
function slot(src, ctx, { focus = "", lens = false } = {}) {
  const i = ctx.i++;
  return `<span class="slot${lens ? " slot--lens" : ""}" style="--i:${i}"${lens ? ` data-slot="${i}"` : ""} aria-hidden="true"><img src="${esc(src)}" alt="" loading="lazy" decoding="async"${focus ? ` style="object-position:${esc(focus)}"` : ""}></span>`;
}

// Plantilla de texto con {huecos}: los valores salen destacados y {photo} es un óvalo.
function template(tpl, values, ctx) {
  return String(tpl).split(/(\{\w+\})/).map((part) => {
    const m = part.match(/^\{(\w+)\}$/);
    if (!m) return words(part, ctx);
    const v = values[m[1]];
    if (!v) return "";
    return v.src ? slot(v.src, ctx, v) : words(v, ctx, " w--key");
  }).join("");
}

// Dónde meter el óvalo en un texto: después de una coma o un punto cerca del 40 %, o en el 45 %.
function withSlot(text, src, ctx, opts) {
  const toks = String(text).trim().split(/\s+/);
  const n = toks.length;
  let at = -1, best = 1;
  toks.forEach((t, k) => {
    if (k === n - 1 || !/[,.;:]$/.test(t)) return;
    const d = Math.abs((k + 1) / n - 0.4);
    if ((k + 1) / n >= 0.2 && (k + 1) / n <= 0.72 && d < best) { best = d; at = k + 1; }
  });
  if (at < 0) at = Math.max(1, Math.min(n - 1, Math.round(n * 0.45)));
  return `${words(toks.slice(0, at).join(" "), ctx)} ${slot(src, ctx, opts)} ${words(toks.slice(at).join(" "), ctx)}`;
}

const lit = (inner, ctx, cls = "", attrs = "data-lit") => `<p class="lit ${cls}" style="--n:${ctx.i}" ${attrs}>${inner}</p>`;

// Títulos: cada palabra sube desde detrás de una línea (máscara) al llegar.
const rise = (text) => String(text ?? "").trim().split(/\s+/).map((w, i) => `<span class="rw"><span class="rw__in" style="--k:${i}">${esc(w)}</span></span>`).join(" ");

const head = ({ eyebrow, title, id, text }) => `
    <header class="head" data-rise>
      ${eyebrow ? `<p class="eyebrow head__eyebrow">${esc(eyebrow)}</p>` : ""}
      ${title ? `<h2 class="head__title" id="${id}">${rise(title)}</h2>` : ""}
      ${text ? `<p class="head__text">${esc(text)}</p>` : ""}
    </header>`;

// La lente: una foto en óvalo que crece desde su hueco en la frase hasta llenar el escenario.
const lens = (src, alt = "", focus = "", eager = false) => `
      <div class="lens" data-lens aria-hidden="${alt ? "false" : "true"}"><img src="${esc(src)}" alt="${esc(alt)}" decoding="async"${eager ? ` fetchpriority="high"` : ` loading="lazy"`}${focus ? ` style="object-position:${esc(focus)}"` : ""}></div>`;

const letters = (s, from = 0) => [...String(s)].map((c, k) => (c === " " ? " " : `<span class="ch" style="--k:${from + k}">${esc(c)}</span>`)).join("");

export function hero(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.hero || {};
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const place = venue.city || venue.name || "";
  const len = Math.max(String(a).length, String(b).length);
  const ctx = { i: 0 };
  const tagline = event.tagline ? lit(words(event.tagline, ctx), ctx, "hero__tagline", "data-lit-stage") : "";
  return `
  <section class="hero${tagline ? " has-tagline" : ""}" data-hero data-stage="hero" aria-labelledby="hero-title">
    <div class="stage">
      ${lens(event.photo, event.photoAlt || `${a} y ${b}`, event.photoFocus, true)}
      <div class="veil" aria-hidden="true"></div>
      <div class="hero__body">
        ${t.eyebrow ? `<p class="eyebrow hero__eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h1 class="hero__names" id="hero-title" aria-label="${esc(a)} &amp; ${esc(b)}" style="--len:${len};--sum:${String(a).length + String(b).length}">
          <span class="hero__name" data-name aria-hidden="true">${letters(a)}</span>
          <span class="slot slot--lens slot--hero" data-slot="-1" aria-hidden="true"><img src="${esc(event.photo)}" alt="" decoding="async"${event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : ""}></span>
          <span class="hero__name" data-name aria-hidden="true">${letters(b, String(a).length + 2)}</span>
        </h1>
        <p class="hero__date"><span class="cap">${esc(d.weekday)}</span> · ${esc(d.numeric)}${place ? `<span class="hero__dot" aria-hidden="true"> · </span><span class="hero__place">${esc(place)}</span>` : ""}</p>
        ${t.hint ? `<p class="hero__hint" aria-hidden="true">${esc(t.hint)}</p>` : ""}
      </div>
      ${tagline}
    </div>
  </section>`;
}

export function details(config) {
  const { event, venue = {}, locale, copy = {}, gallery = [] } = config;
  const t = copy.details || {};
  const d = dateParts(event.date, locale);
  const days = daysUntil(event.date);
  const phase = weddingPhase(event);
  const countdown = phase === "after" || days < 0 ? "" : fill(days === 0 ? t.countdownToday : days === 1 ? t.countdownOne : t.countdown, { days });
  const suffix = t.timeSuffix ? ` ${esc(t.timeSuffix)}` : "";
  const where = [venue.name, venue.city].filter(Boolean).filter((v, i, all) => all.indexOf(v) === i).join(", ");
  const ctx = { i: 0 };
  const lead = t.lead ? template(t.lead, {
    date: `${d.weekday} ${d.dayMonth} de ${d.year}`,
    time: time(event.date),
    venue: where,
    photo: { src: gallery.find(Boolean) || event.photo },
  }, ctx) : event.tagline ? words(event.tagline, ctx) : "";
  return `
  <section class="part details" aria-labelledby="details-title">
    ${lead ? lit(lead, ctx, "lead") : ""}
    ${head({ eyebrow: t.eyebrow, title: t.title, id: "details-title" })}
    <dl class="facts">
      <div class="fact" data-rise>
        <dt class="eyebrow">${esc(t.when || "Cuándo")}</dt>
        <dd class="fact__big"><span class="cap">${esc(d.weekday)}</span>, ${esc(d.dayMonth)}</dd>
        <dd class="fact__small">${esc(d.year)} · ${esc(time(event.date))}${suffix}${countdown ? ` · <span class="fact__note${days === 0 ? " is-today" : ""}">${countdown}</span>` : ""}</dd>
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

// Historia: cada capítulo con foto se queda quieto mientras se enciende su frase; después, el
// óvalo de la frase crece hasta llenar la pantalla. Sin foto, la frase se enciende al pasar.
export function story(config) {
  const { story, copy = {} } = config;
  const chapters = story?.chapters?.filter((c) => c.text) || [];
  if (!chapters.length) return "";
  const t = copy.story || {};
  const total = String(chapters.length).padStart(2, "0");
  return `
  <section class="part story" aria-labelledby="story-title">
    ${head({ eyebrow: t.eyebrow, title: t.title, id: "story-title" })}
    <ol class="chapters">${chapters.map((c, k) => {
      const ctx = { i: 0 };
      const len = String(c.text).length;
      const size = len > 240 ? " is-longer" : len > 150 ? " is-long" : "";
      const num = `${String(k + 1).padStart(2, "0")} / ${total}`;
      if (!c.photo) return `
      <li class="chapter${size}">
        <p class="chapter__meta" data-rise><span class="chapter__num">${num}</span>${c.meta ? ` ${esc(c.meta)}` : ""}</p>
        ${lit(words(c.text, ctx), ctx, "chapter__text")}
      </li>`;
      const text = withSlot(c.text, c.photo, ctx, { focus: c.photoFocus, lens: true });
      return `
      <li class="chapter has-photo${size}" data-stage="chapter">
        <div class="stage">
          ${lens(c.photo, c.photoAlt || "", c.photoFocus)}
          <div class="veil" aria-hidden="true"></div>
          <div class="chapter__body">
            <p class="chapter__meta"><span class="chapter__num">${num}</span>${c.meta ? ` ${esc(c.meta)}` : ""}</p>
            ${lit(text, ctx, "chapter__text", "data-lit-stage")}
          </div>
          ${c.meta ? `<p class="chapter__caption" aria-hidden="true">${esc(c.meta)}</p>` : ""}
        </div>
      </li>`;
    }).join("")}
    </ol>
  </section>`;
}

// Programa: horas grandes que se encienden al pasar por el centro de la pantalla.
export function schedule(config) {
  const { schedule = [], copy = {} } = config;
  if (!schedule.length) return "";
  const t = copy.schedule || {};
  return `
  <section class="part schedule" aria-labelledby="schedule-title">
    ${head({ eyebrow: t.eyebrow, title: t.title, id: "schedule-title" })}
    <ol class="plan">${schedule.map((s) => `
      <li class="plan__item" data-glow>
        <time class="plan__time">${esc(s.time)}</time>
        <div class="plan__what">
          <p class="plan__label">${esc(s.label)}</p>
          ${s.place ? `<p class="plan__place">${esc(s.place)}</p>` : ""}
        </div>
      </li>`).join("")}
    </ol>
    ${t.text ? `<p class="schedule__note" data-rise>${esc(t.text)}</p>` : ""}
  </section>`;
}

// Vestimenta: la frase se enciende y los colores se abren en óvalos, uno detrás de otro.
export function dresscode(config) {
  const t = config.copy?.dresscode || {};
  if (!t.text) return "";
  const palette = (t.palette || []).filter((c) => c && c.color);
  const ctx = { i: 0 };
  return `
  <section class="part dresscode" aria-labelledby="dresscode-title">
    ${head({ eyebrow: t.eyebrow, title: t.title, id: "dresscode-title" })}
    ${lit(words(t.text, ctx), ctx, "dress__text")}
    ${palette.length ? `
    <div class="swatches" data-rise>
      ${t.paletteLabel ? `<p class="eyebrow swatches__label">${esc(t.paletteLabel)}</p>` : ""}
      <ul class="swatches__list">${palette.map((c, i) => `<li class="swatch" style="--c:${esc(c.color)};--k:${i}"><span class="swatch__oval" aria-hidden="true"></span><span class="swatch__name">${esc(c.name || "")}</span></li>`).join("")}</ul>
    </div>` : ""}
  </section>`;
}

// Galería: cada foto se abre como un iris, del óvalo al marco entero, al llegar al centro.
export function gallery(config) {
  const { gallery = [], event, copy = {} } = config;
  const photos = gallery.filter(Boolean).slice(0, 9);
  if (!photos.length) return "";
  const t = copy.gallery || {};
  const [a, b] = event.couple;
  return `
  <section class="part gallery" aria-labelledby="gallery-title">
    ${head({ eyebrow: t.eyebrow, title: t.title, id: "gallery-title" })}
    <div class="frames" data-count="${photos.length}">${photos.map((src, i) => `
      <figure class="frame frame--${i % 4}" data-grow>${lens(src, `${a} y ${b}`, i % 2 ? "50% 35%" : "")}
      </figure>`).join("")}
    </div>
  </section>`;
}

export function gifts(config) {
  const { gifts, copy = {} } = config;
  if (!gifts?.iban) return "";
  const t = copy.gifts || {};
  const raw = gifts.iban.replace(/\s+/g, "").toUpperCase();
  const ctx = { i: 0 };
  return `
  <section class="part gifts" aria-labelledby="gifts-title">
    ${head({ eyebrow: t.eyebrow, title: t.title, id: "gifts-title" })}
    ${t.text ? lit(words(t.text, ctx), ctx, "gifts__text") : ""}
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

// Cierre: la foto de la portada vuelve a llenar la pantalla con la pregunta encima y, al bajar,
// se cierra en su óvalo; debajo salen el texto y el botón.
export function closing(config) {
  const { event, rsvp = {}, sections, locale, copy = {} } = config;
  const [a, b] = event.couple;
  const t = copy.closing || {};
  const open = sections.includes("rsvp") && !rsvpClosed({ event, rsvp });
  const phase = weddingPhase(event);
  const deadline = rsvp.deadline ? dateParts(rsvp.deadline, locale).dayMonth : "";
  const late = phase === "today" ? t.today : phase === "after" ? t.after : "";
  const ctx = { i: 0 };
  const title = open ? words(t.title, ctx) : `${words(a, ctx)} ${words("&", ctx, " w--key")} ${words(b, ctx)}`;
  const text = open ? (deadline && t.text ? interpolate(t.text, { deadline }) : "") : late;
  return `
  <section class="part closing" data-stage="closing" aria-labelledby="closing-title">
    <div class="stage">
      ${lens(event.photo, "", event.photoFocus)}
      <div class="veil" aria-hidden="true"></div>
      <div class="closing__body">
        ${open && t.eyebrow ? `<p class="eyebrow closing__eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h2 class="closing__title lit" id="closing-title" style="--n:${ctx.i}" data-lit-stage>${title}</h2>
        <span class="slot slot--lens slot--closing" data-slot="-1" aria-hidden="true"><img src="${esc(event.photo)}" alt="" loading="lazy" decoding="async"${event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : ""}></span>
        <div class="closing__end">
          ${text ? `<p class="closing__text">${esc(text)}</p>` : ""}
          ${open ? `<div class="closing__action"><button class="button" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button></div>` : ""}
        </div>
      </div>
    </div>
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
