import { dateParts, time, daysUntil, esc, fill, rsvpClosed } from "./format.js";
import { calendarUrl } from "./calendar.js";

// Plantilla Minimal: blanco, una serif fina, líneas de pelo y secciones numeradas.
// Cada sección es una fila: etiqueta numerada a la izquierda, contenido a la derecha.
const arrow = `<span aria-hidden="true">↗</span>`;
const row = (cls, label, body, id) => `
  <section class="row ${cls}"${id ? ` aria-labelledby="${id}"` : ""}>
    <div class="wrap row__grid">
      <span class="rule reveal" aria-hidden="true"></span>
      <p class="label"${id ? ` id="${id}"` : ""}>${esc(label)}</p>
      <div class="row__body">${body}</div>
    </div>
  </section>`;

export function hero({ event, venue = {}, locale, copy = {} }) {
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  return `
  <section class="hero">
    <div class="wrap">
      <div class="hero__bar">
        <span class="hero__mono" aria-hidden="true">${esc(a[0])}&thinsp;&amp;&thinsp;${esc(b[0])}</span>
        <span>${esc(copy.hero?.eyebrow || "")}</span>
        <span>${esc(d.numeric)}</span>
      </div>
      <h1 class="hero__names"><span class="hero__line"><span>${esc(a)}</span></span><span class="hero__line"><span><em>&amp;</em> ${esc(b)}</span></span></h1>
      <div class="hero__meta">
        ${event.tagline ? `<p>${esc(event.tagline)}</p>` : "<span></span>"}
        <p>${esc(venue.city || venue.name || "")}</p>
      </div>
    </div>
    <figure class="hero__photo wrap"><img src="${esc(event.photo)}" alt="${esc(event.photoAlt)}"${focus} fetchpriority="high"></figure>
  </section>`;
}

export function details(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.details || {};
  const d = dateParts(event.date, locale);
  const days = daysUntil(event.date);
  const countdown = days < 0 ? "" : fill(days === 0 ? t.countdownToday : days === 1 ? t.countdownOne : t.countdown, { days });
  return row("details", t.eyebrow, `
    <dl class="facts">
      <div class="reveal"><dt>Fecha</dt><dd>${esc(d.weekday)}, ${esc(d.dayMonth)} ${esc(d.year)}</dd>
        ${t.calendar ? `<a class="link" href="${esc(calendarUrl(config))}" target="_blank" rel="noopener">${esc(t.calendar)} ${arrow}</a>` : ""}</div>
      <div class="reveal" style="--i:1"><dt>Hora</dt><dd>${esc(time(event.date))} h</dd>${countdown ? `<p class="muted">${countdown}</p>` : ""}</div>
      <div class="reveal" style="--i:2"><dt>Lugar</dt><dd>${esc(venue.name)}</dd>${venue.address ? `<p class="muted">${esc(venue.address)}</p>` : ""}
        ${venue.mapsUrl && t.map ? `<a class="link" href="${esc(venue.mapsUrl)}" target="_blank" rel="noopener">${esc(t.map)} ${arrow}</a>` : ""}</div>
    </dl>`, "details-title");
}

export function story({ story, copy = {} }) {
  const chapters = story?.chapters?.filter((c) => c.text) || [];
  if (!chapters.length) return "";
  return row("story", copy.story?.eyebrow, `
    <ol class="chapters">${chapters.map((c, i) => `
      <li class="chapter reveal" style="--i:${i}">
        ${c.meta ? `<p class="muted">${esc(c.meta)}</p>` : ""}
        <p class="chapter__text">${esc(c.text)}</p>
      </li>`).join("")}
    </ol>`, "story-title");
}

export function schedule({ schedule = [], copy = {} }) {
  if (!schedule.length) return "";
  return row("schedule", copy.schedule?.eyebrow, `
    <ol class="timeline">${schedule.map((s, i) => `
      <li class="reveal" style="--i:${i}"><time>${esc(s.time)}</time><span class="timeline__what">${esc(s.label)}</span><span class="muted">${esc(s.place || "")}</span></li>`).join("")}
    </ol>`, "schedule-title");
}

export function gallery({ gallery = [], event, copy = {} }) {
  if (!gallery.length) return "";
  const [a, b] = event.couple;
  return row("gallery", copy.gallery?.eyebrow, `
    <div class="photos" data-count="${Math.min(gallery.length, 3)}">${gallery.slice(0, 3).map((src, i) => `
      <figure class="reveal" style="--i:${i}"><img src="${esc(src)}" alt="${esc(`${a} y ${b}`)}" loading="lazy"><figcaption>${String(i + 1).padStart(2, "0")}</figcaption></figure>`).join("")}
    </div>`, "gallery-title");
}

export function gifts({ gifts, copy = {} }) {
  if (!gifts?.iban) return "";
  const t = copy.gifts || {};
  const raw = gifts.iban.replace(/\s+/g, "").toUpperCase();
  return row("gifts", t.eyebrow, `
    <h2 class="row__title reveal">${esc(t.title)}</h2>
    ${t.text ? `<p class="muted reveal">${esc(t.text)}</p>` : ""}
    <details class="iban reveal">
      <summary class="link">${esc(t.reveal || "Ver los datos de la cuenta")}</summary>
      ${gifts.holder ? `<p><span class="muted">${esc(t.holderLabel)}</span> ${esc(gifts.holder)}</p>` : ""}
      <p><span class="muted">${esc(t.ibanLabel)}</span> <span class="iban__num" id="iban-value">${esc(raw.match(/.{1,4}/g).join(" "))}</span></p>
      <button class="link" type="button" data-copy="${esc(raw)}" data-done="${esc(t.copied)}" aria-controls="iban-value"><span data-label aria-live="polite">${esc(t.copy)}</span></button>
    </details>`, "gifts-title");
}

export function closing({ event, rsvp = {}, sections, locale, copy = {} }) {
  const [a, b] = event.couple;
  const t = copy.closing || {};
  const hasRsvp = sections.includes("rsvp") && !rsvpClosed({ event, rsvp });
  const deadline = rsvp.deadline ? dateParts(rsvp.deadline, locale).dayMonth : "";
  return `
  <section class="closing" aria-labelledby="closing-title">
    <div class="wrap row__grid">
      <span class="rule reveal" aria-hidden="true"></span>
      <p class="label">${esc(t.eyebrow)}</p>
      <div class="row__body">
        <h2 class="closing__title reveal" id="closing-title">${esc(hasRsvp ? t.title : `${a} & ${b}`)}</h2>
        ${hasRsvp && deadline && t.text ? `<p class="muted reveal">${fill(t.text, { deadline })}</p>` : ""}
        ${hasRsvp ? `<div class="reveal"><button class="button" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button></div>` : ""}
      </div>
    </div>
    <p class="wrap closing__foot"><span>${esc(a)} &amp; ${esc(b)}</span><span>${esc(dateParts(event.date, locale).year)}</span></p>
  </section>`;
}
