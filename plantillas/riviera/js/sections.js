import { dateParts, time, daysUntil, esc, fill, rsvpClosed, weddingPhase } from "./format.js";
import { calendarUrl } from "./calendar.js";
import * as look from "./look.js";

// Secciones comunes de esta plantilla. Lo que da carácter (portada, cabeceras, adornos, marcas
// del programa y cierre) está en js/look.js; si look.js exporta una sección con el mismo nombre
// (por ejemplo "story"), main.js usa la suya en lugar de esta.
// Cada función recibe (config, n): n es el número de la sección entre las que se pintan.

export const arrow = `<span class="link__arrow" aria-hidden="true">→</span>`;

const head = (eyebrow, title, id, text, n) => look.head({ eyebrow, title, id, text, n });

export function hero(config, n) {
  return look.hero(config, n);
}

export function details(config, n) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.details || {};
  const d = dateParts(event.date, locale);
  const days = daysUntil(event.date);
  const phase = weddingPhase(event);
  const countdown = phase === "after" || days < 0 ? "" : fill(days === 0 ? t.countdownToday : days === 1 ? t.countdownOne : t.countdown, { days });
  const suffix = t.timeSuffix ? ` ${esc(t.timeSuffix)}` : "";
  return `
  <section class="section details" aria-labelledby="details-title">
    ${head(t.eyebrow, t.title || "", "details-title", t.intro, n)}
    <div class="wrap">
      <dl class="facts">
        <div class="fact reveal">
          ${look.factMark ? look.factMark("when") : ""}
          <dt class="eyebrow">${esc(t.when || "Cuándo")}</dt>
          <dd class="fact__big"><span class="cap">${esc(d.weekday)}</span>, ${esc(d.dayMonth)}</dd>
          <dd class="fact__small">${esc(d.year)} · ${esc(time(event.date))}${suffix}</dd>
          ${countdown ? `<dd class="fact__note${days === 0 ? " is-today" : ""}">${countdown}</dd>` : ""}
          ${t.calendar && phase === "before" ? `<dd class="fact__link"><a class="link" href="${esc(calendarUrl(config))}" target="_blank" rel="noopener">${esc(t.calendar)} ${arrow}</a></dd>` : ""}
        </div>
        <div class="fact reveal" style="--i:1">
          ${look.factMark ? look.factMark("where") : ""}
          <dt class="eyebrow">${esc(t.where || "Dónde")}</dt>
          <dd class="fact__big">${esc(venue.name || venue.city || "")}</dd>
          ${venue.address ? `<dd class="fact__small">${esc(venue.address)}</dd>` : ""}
          ${venue.mapsUrl && t.map ? `<dd class="fact__link"><a class="link" href="${esc(venue.mapsUrl)}" target="_blank" rel="noopener">${esc(t.map)} ${arrow}</a></dd>` : ""}
        </div>
      </dl>
      ${look.afterFacts ? look.afterFacts(config) : ""}
    </div>
  </section>`;
}

export function story(config, n) {
  const { story, copy = {} } = config;
  const chapters = story?.chapters?.filter((c) => c.text) || [];
  if (!chapters.length) return "";
  const t = copy.story || {};
  const labels = t.labels || [];
  return `
  <section class="section story" aria-labelledby="story-title">
    ${head(t.eyebrow, t.title || "", "story-title", t.text, n)}
    <div class="wrap">
      <ol class="chapters">${chapters.map((c, i) => `
        <li class="chapter reveal${c.photo ? " has-photo" : ""}" style="--i:${i}">
          ${c.photo ? `<figure class="chapter__photo">${look.photo ? look.photo(c.photo, c.photoAlt || "", i) : `<img src="${esc(c.photo)}" alt="${esc(c.photoAlt || "")}" loading="lazy">`}</figure>` : ""}
          <div class="chapter__body">
            ${labels[i] ? `<p class="chapter__label">${esc(labels[i])}</p>` : ""}
            ${c.meta ? `<p class="eyebrow chapter__meta">${esc(c.meta)}</p>` : ""}
            <p class="chapter__text">${esc(c.text)}</p>
          </div>
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

export function schedule(config, n) {
  const { schedule = [], copy = {} } = config;
  if (!schedule.length) return "";
  const t = copy.schedule || {};
  const notes = t.notes || [];
  return `
  <section class="section schedule" aria-labelledby="schedule-title">
    ${head(t.eyebrow, t.title || "", "schedule-title", t.text, n)}
    <div class="wrap">
      <ol class="plan" style="--n:${schedule.length}">${schedule.map((s, i) => `
        <li class="plan__item reveal" style="--i:${i}">
          <time class="plan__time">${esc(s.time)}</time>
          <span class="plan__mark" aria-hidden="true">${look.mark ? look.mark(i, s, schedule.length) : ""}</span>
          <span class="plan__what">
            ${notes[i] ? `<span class="plan__note">${esc(notes[i])}</span>` : ""}
            <span class="plan__label">${esc(s.label)}</span>
            ${s.place ? `<span class="plan__place">${esc(s.place)}</span>` : ""}
          </span>
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

export function dresscode(config, n) {
  const t = config.copy?.dresscode || {};
  if (!t.text) return "";
  const palette = (t.palette || []).filter((c) => c && c.color);
  return `
  <section class="section dresscode" aria-labelledby="dresscode-title">
    ${head(t.eyebrow, t.title || "", "dresscode-title", "", n)}
    <div class="wrap dresscode__in reveal">
      <p class="dresscode__text">${esc(t.text)}</p>
      ${palette.length ? `
      ${t.paletteLabel ? `<p class="eyebrow dresscode__label">${esc(t.paletteLabel)}</p>` : ""}
      <ul class="swatches">${palette.map((c) => `<li class="swatch"><span class="swatch__dot" style="--c:${esc(c.color)}"></span><span class="swatch__name">${esc(c.name || "")}</span></li>`).join("")}</ul>` : ""}
    </div>
  </section>`;
}

export function gallery(config, n) {
  const { gallery = [], event, copy = {} } = config;
  if (!gallery.length) return "";
  const t = copy.gallery || {};
  const [a, b] = event.couple;
  const count = gallery.length;
  const cols = count === 1 ? 1 : count === 2 || count === 4 ? 2 : 3;
  return `
  <section class="section gallery" aria-labelledby="gallery-title">
    ${head(t.eyebrow, t.title || "", "gallery-title", t.text, n)}
    <div class="wrap">
      <div class="photos${count % 2 ? " is-odd" : ""}" data-count="${count}" style="--cols:${cols}">${gallery.map((src, i) => `
        <figure class="photos__item reveal" style="--i:${i % 3}">
          ${look.photo ? look.photo(src, `${a} y ${b}`, i) : `<img src="${esc(src)}" alt="${esc(`${a} y ${b}`)}" loading="lazy">`}
        </figure>`).join("")}
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
  <section class="section gifts" aria-labelledby="gifts-title">
    ${head(t.eyebrow, t.title || "", "gifts-title", t.text, n)}
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

// Cierre: botón de confirmar mientras la lista está abierta; después, los nombres.
// El día de la boda y después, t.today / t.after si existen.
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
  <section class="closing" aria-labelledby="closing-title">
    <div class="closing__body">
      ${look.closingTop ? look.closingTop(config) : ""}
      <div class="wrap closing__in">
        ${open ? `
          ${t.eyebrow ? `<p class="eyebrow reveal">${esc(t.eyebrow)}</p>` : ""}
          <h2 class="closing__title reveal" id="closing-title">${esc(t.title)}</h2>
          ${deadline && t.text ? `<p class="closing__text reveal">${fill(t.text, { deadline })}</p>` : ""}
          <div class="closing__action reveal"><button class="button" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button></div>`
        : `<h2 class="closing__title closing__title--names reveal" id="closing-title" style="--len:${len}">${esc(a)} <span class="amp">&amp;</span> ${esc(b)}</h2>
           ${late ? `<p class="closing__text reveal">${esc(late)}</p>` : ""}`}
      </div>
      ${look.closingBottom ? look.closingBottom(config) : ""}
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
