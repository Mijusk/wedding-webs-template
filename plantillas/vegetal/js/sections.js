import { dateParts, time, daysUntil, esc, fill, rsvpClosed } from "./format.js";
import { calendarUrl } from "./calendar.js";

// Plantilla Vegetal: invitación de lujo con papel vegetal. Hojas translúcidas (blanco
// semitransparente + fibra + borde con brillo) impresas en tinta, con detalles en plata,
// sobre fotos a sangre o sobre un fondo gris perla.

/* ---------- utilidades ---------- */

// Inicial sin tilde ("Álvaro" → "A"), como se graba un sello.
const initial = (name) => (String(name || "").trim().normalize("NFD").replace(/[̀-ͯ]/g, "")[0] || "").toUpperCase();

// Secciones numeradas: el número sale de las que de verdad se pintan (01, 02, 03… sin huecos).
const NUMBERED = {
  details: () => true,
  story: (c) => c.story?.chapters?.some((ch) => ch.text),
  schedule: (c) => c.schedule?.length,
  gallery: (c) => c.gallery?.length,
  gifts: (c) => c.gifts?.iban,
};
function numberOf(config, name) {
  const shown = (config.sections || []).filter((s) => NUMBERED[s] && NUMBERED[s](config));
  const i = shown.indexOf(name);
  return i < 0 ? "" : String(i + 1).padStart(2, "0");
}

const arrow = `<span class="link__arrow" aria-hidden="true">→</span>`;

// Sello de plata con las iniciales, como el lacre metalizado de una invitación.
function seal(event, cls = "") {
  const [a, b] = event.couple;
  return `<span class="seal ${cls}" aria-hidden="true"><span class="seal__in">${esc(initial(a))}<i>&amp;</i>${esc(initial(b))}</span></span>`;
}

// Cabecera de sección impresa en la hoja: antetítulo, título y filete de plata.
function head(eyebrow, title, id) {
  return `
        <header class="head reveal">
          ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ""}
          ${title ? `<h2 class="head__title" id="${id}">${esc(title)}</h2>` : ""}
          <span class="rule" aria-hidden="true"><i></i></span>
        </header>`;
}

// Una "hoja" de la suite: el número grande impreso en el papel de debajo asoma por arriba
// y, bajo el vegetal, se ve más claro y desenfocado (copia fantasma dentro de la hoja:
// mismo efecto que un backdrop-filter pero sin coste al hacer scroll).
function leafBox(config, name, inner, extra = "") {
  const n = numberOf(config, name);
  return `
    <div class="leaf reveal${extra}">
      ${n ? `<span class="leaf__num" aria-hidden="true">${n}</span>` : ""}
      <div class="sheet sheet--paper">
        ${n ? `<span class="leaf__num leaf__num--ghost" aria-hidden="true">${n}</span>` : ""}
        <div class="sheet__body">${inner}</div>
      </div>
    </div>`;
}
function leaf(config, name, labelId, inner, extra = "") {
  return `
  <section class="section ${name}" aria-labelledby="${labelId}">${leafBox(config, name, inner, extra)}
  </section>`;
}

/* ---------- secciones ---------- */

export function hero({ event, venue = {}, locale, copy = {} }) {
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  const len = Math.max(String(a).length, String(b).length, 5);
  const place = [venue.name, venue.city].filter(Boolean);
  const t = copy.hero || {};
  return `
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero__stage">
      <img class="hero__photo" src="${esc(event.photo)}" alt="${esc(event.photoAlt)}"${focus} fetchpriority="high">
      <span class="hero__shade" aria-hidden="true"></span>
      ${event.tagline ? `<p class="hero__tagline">${esc(event.tagline)}</p>` : ""}
      <div class="sheet sheet--glass hero__sheet">
        ${seal(event, "hero__seal")}
        <div class="sheet__body hero__body">
          ${t.eyebrow ? `<p class="eyebrow hero__eyebrow">${esc(t.eyebrow)}</p>` : ""}
          <h1 class="hero__names" id="hero-title" style="--len:${len}">
            <span class="hero__name">${esc(a)}</span>
            <span class="hero__amp">&amp;</span>
            <span class="hero__name">${esc(b)}</span>
          </h1>
          <span class="rule" aria-hidden="true"><i></i></span>
          <p class="hero__date"><span class="hero__weekday">${esc(d.weekday)}</span> ${esc(d.dayMonth)} <span class="hero__dot" aria-hidden="true"></span> ${esc(d.year)}</p>
          ${place.length ? `<p class="hero__place">${place.map(esc).join(` <span aria-hidden="true">·</span> `)}</p>` : ""}
          ${event.tagline ? `<p class="hero__lede" aria-hidden="true">${esc(event.tagline)}</p>` : ""}
        </div>
        ${t.hint ? `<p class="hero__hint" aria-hidden="true">${esc(t.hint)}<span></span></p>` : ""}
      </div>
    </div>
  </section>`;
}

export function details(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.details || {};
  const d = dateParts(event.date, locale);
  const days = daysUntil(event.date);
  const countdown = days < 0 ? "" : fill(days === 0 ? t.countdownToday : days === 1 ? t.countdownOne : t.countdown, { days });
  const inner = `
        ${head(t.eyebrow, t.title || venue.name || "", "details-title")}
        ${t.intro ? `<p class="lede reveal">${esc(t.intro)}</p>` : ""}
        <dl class="facts">
          <div class="fact reveal">
            <dt class="eyebrow">${esc(t.when || "Fecha")}</dt>
            <dd class="fact__big">${esc(d.dayMonth)}</dd>
            <dd class="fact__small">${esc(d.weekday)}, ${esc(d.year)}</dd>
            ${t.calendar ? `<dd class="fact__act"><a class="link" href="${esc(calendarUrl(config))}" target="_blank" rel="noopener">${esc(t.calendar)} ${arrow}</a></dd>` : ""}
          </div>
          <div class="fact reveal" style="--i:1">
            <dt class="eyebrow">${esc(t.time || "Hora")}</dt>
            <dd class="fact__big">${esc(time(event.date))}<small> ${esc(t.timeSuffix || "h")}</small></dd>
            ${countdown ? `<dd class="fact__small fact__count">${countdown}</dd>` : ""}
          </div>
          <div class="fact reveal" style="--i:2">
            <dt class="eyebrow">${esc(t.where || "Lugar")}</dt>
            <dd class="fact__big">${esc(venue.city || venue.name || "")}</dd>
            ${venue.address ? `<dd class="fact__small">${esc(venue.address)}</dd>` : ""}
            ${venue.mapsUrl && t.map ? `<dd class="fact__act"><a class="link" href="${esc(venue.mapsUrl)}" target="_blank" rel="noopener">${esc(t.map)} ${arrow}</a></dd>` : ""}
          </div>
        </dl>`;
  return leaf(config, "details", "details-title", inner);
}

export function story(config) {
  const { story, copy = {} } = config;
  const chapters = story?.chapters?.filter((c) => c.text) || [];
  if (!chapters.length) return "";
  const t = copy.story || {};
  const inner = `
        ${head(t.eyebrow, t.title || "", "story-title")}
        <ol class="chapters">${chapters.map((c, i) => `
          <li class="chapter${c.photo ? " chapter--photo" : ""} reveal">
            ${c.photo ? `<figure class="chapter__photo"><img src="${esc(c.photo)}" alt="${esc(c.photoAlt || "")}" loading="lazy"></figure>` : ""}
            <div class="chapter__text">
              ${c.meta ? `<p class="chapter__meta"><span class="chapter__n" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>${esc(c.meta)}</p>` : ""}
              <p>${esc(c.text)}</p>
            </div>
          </li>`).join("")}
        </ol>`;
  return leaf(config, "story", "story-title", inner);
}

export function schedule(config) {
  const { schedule = [], copy = {} } = config;
  if (!schedule.length) return "";
  const t = copy.schedule || {};
  const inner = `
        ${head(t.eyebrow, t.title || "", "schedule-title")}
        <ol class="plan">${schedule.map((s, i) => `
          <li class="plan__item reveal" style="--i:${i}">
            <time class="plan__time">${esc(s.time)}</time>
            <span class="plan__mark" aria-hidden="true"></span>
            <span class="plan__what"><span class="plan__label">${esc(s.label)}</span>${s.place ? `<span class="plan__place">${esc(s.place)}</span>` : ""}</span>
          </li>`).join("")}
        </ol>`;
  return leaf(config, "schedule", "schedule-title", inner);
}

export function gallery(config) {
  const { gallery = [], event, locale, copy = {} } = config;
  if (!gallery.length) return "";
  const t = copy.gallery || {};
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const alt = (i) => (gallery.length > 1 ? `${a} y ${b} (${i + 1} de ${gallery.length})` : `${a} y ${b}`);
  return `
  <section class="section gallery" aria-labelledby="gallery-title">
    ${leafBox(config, "gallery", head(t.eyebrow, t.title || `${a} & ${b}`, "gallery-title"), " leaf--narrow")}
    <div class="photos" data-count="${Math.min(gallery.length, 4)}">${gallery.map((src, i) => `
      <figure class="photo reveal" style="--i:${i % 3}">
        <img src="${esc(src)}" alt="${esc(alt(i))}" loading="lazy">
        ${i === 0 ? `<figcaption class="overlay overlay--card" aria-hidden="true"><span class="overlay__names">${esc(a)} <i>&amp;</i> ${esc(b)}</span><span class="overlay__date">${esc(d.numeric)}</span></figcaption>`
          : i === 2 ? `<span class="overlay overlay--strip" aria-hidden="true"></span>` : ""}
      </figure>`).join("")}
    </div>
  </section>`;
}

export function gifts(config) {
  const { gifts, copy = {} } = config;
  if (!gifts?.iban) return "";
  const t = copy.gifts || {};
  const raw = gifts.iban.replace(/\s+/g, "").toUpperCase();
  const inner = `
        ${head(t.eyebrow, t.title || "", "gifts-title")}
        ${t.text ? `<p class="lede reveal">${esc(t.text)}</p>` : ""}
        <details class="iban reveal">
          <summary class="link"><span>${esc(t.reveal || "Ver los datos de la cuenta")}</span><span class="iban__plus" aria-hidden="true"></span></summary>
          <div class="iban__card">
            ${gifts.holder ? `<p class="eyebrow">${esc(t.holderLabel || "Titular")}</p><p class="iban__holder">${esc(gifts.holder)}</p>` : ""}
            <p class="eyebrow">${esc(t.ibanLabel || "IBAN")}</p>
            <p class="iban__num" id="iban-value">${esc(raw.match(/.{1,4}/g).join(" "))}</p>
            <button class="button button--ghost" type="button" data-copy="${esc(raw)}" data-done="${esc(t.copied || "Copiado")}" aria-controls="iban-value"><span data-label aria-live="polite">${esc(t.copy || "Copiar")}</span></button>
          </div>
        </details>`;
  return leaf(config, "gifts", "gifts-title", inner, " leaf--narrow");
}

export function closing({ event, rsvp = {}, sections, locale, copy = {} }) {
  const [a, b] = event.couple;
  const t = copy.closing || {};
  const hasRsvp = sections.includes("rsvp") && !rsvpClosed({ event, rsvp });
  const deadline = rsvp.deadline ? dateParts(rsvp.deadline, locale).dayMonth : "";
  const year = dateParts(event.date, locale).year;
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  return `
  <section class="closing" aria-labelledby="closing-title">
    <img class="closing__photo" src="${esc(event.photo)}" alt=""${focus} loading="lazy">
    <span class="closing__shade" aria-hidden="true"></span>
    <div class="closing__in">
      <div class="sheet sheet--glass closing__sheet reveal">
        ${seal(event, "closing__seal")}
        <div class="sheet__body">
        ${hasRsvp ? `
          ${t.eyebrow ? `<p class="eyebrow">${esc(t.eyebrow)}</p>` : ""}
          <h2 class="closing__title" id="closing-title">${esc(t.title)}</h2>
          <span class="rule" aria-hidden="true"><i></i></span>
          ${deadline && t.text ? `<p class="closing__text">${fill(t.text, { deadline })}</p>` : ""}
          <button class="button" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button>`
        : `
          ${t.thanks ? `<p class="eyebrow">${esc(t.thanks)}</p>` : ""}
          <h2 class="closing__title closing__names" id="closing-title"><span>${esc(a)}</span> <i>&amp;</i> <span>${esc(b)}</span></h2>
          <span class="rule" aria-hidden="true"><i></i></span>
          <p class="closing__text">${esc(dateParts(event.date, locale).numeric)}</p>`}
        </div>
      </div>
    </div>
    <footer class="closing__foot">
      <span>${esc(a)} &amp; ${esc(b)}</span>
      <span aria-hidden="true" class="closing__dot"></span>
      <span>${esc(year)}</span>
    </footer>
  </section>`;
}
