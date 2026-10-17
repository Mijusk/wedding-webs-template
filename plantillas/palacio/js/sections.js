import { dateParts, time, daysUntil, esc, fill, rsvpClosed } from "./format.js";
import { calendarUrl } from "./calendar.js";
import { fanRule, rule, corners, portraitFrame, rays, sunrise, stamp, archFrame, fanIcon, bowtie } from "./deco.js";

// Plantilla Palacio: una fiesta de los años veinte. Negro laca, esmeralda y oro; las puertas
// de la entrada (js/enhance.js) se abren y dejan ver la portada; los adornos dorados se
// dibujan solos al llegar a cada sección.

const head = (id, t = {}) => `
  <header class="section__head reveal">
    ${fanRule()}
    ${t.eyebrow ? `<p class="caps eyebrow">${esc(t.eyebrow)}</p>` : ""}
    ${t.title ? `<h2 class="section__title" id="${id}">${esc(t.title)}</h2>` : ""}
  </header>`;

const labelled = (id, t = {}) => (t.title ? ` aria-labelledby="${id}"` : t.eyebrow ? ` aria-label="${esc(t.eyebrow)}"` : "");

export function hero({ event, venue = {}, locale, copy = {} }) {
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const t = copy.hero || {};
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  const place = [venue.name, venue.city].filter(Boolean).map(esc).join(" · ");
  const initials = [a, b].map((n) => esc([...String(n).trim()][0] || "")).join(" &amp; ");
  return `
  <section class="hero" aria-labelledby="hero-names">
    <div class="hero__inner">
      <div class="portrait intro">
        ${rays("hero__rays")}
        ${event.photo
          ? `<img class="portrait__img" src="${esc(event.photo)}" alt="${esc(event.photoAlt)}"${focus} fetchpriority="high">`
          : `<span class="portrait__img portrait__img--empty" aria-hidden="true">${initials}</span>`}
        ${portraitFrame()}
      </div>
      <div class="hero__text">
        ${t.eyebrow ? `<p class="caps eyebrow hero__eyebrow intro" style="--i:1">${esc(t.eyebrow)}</p>` : ""}
        <h1 class="names intro" id="hero-names" style="--i:2">
          <span class="names__n">${esc(a)}</span>
          <span class="names__amp" aria-hidden="true">&amp;</span><span class="sr-only"> y </span>
          <span class="names__n">${esc(b)}</span>
        </h1>
        ${t.invite ? `<p class="hero__invite intro" style="--i:3">${esc(t.invite)}</p>` : ""}
        <p class="caps hero__date intro" style="--i:4"><span>${esc(d.weekday)}</span><i aria-hidden="true"></i><span>${esc(d.dayMonth)}</span><i aria-hidden="true"></i><span>${esc(d.year)}</span></p>
        <p class="hero__where intro" style="--i:5">${esc(time(event.date))} h${place ? ` · ${place}` : ""}</p>
        ${event.tagline ? `<p class="hero__tagline intro" style="--i:6">${esc(event.tagline)}</p>` : ""}
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
  return `
  <section class="section details"${labelled("details-title", t)}>
    <div class="wrap wrap--wide">
      ${head("details-title", t)}
      <div class="details__grid">
        <article class="panel reveal">
          ${corners()}
          <p class="caps eyebrow">${esc(t.when || "Cuándo")}</p>
          <p class="caps panel__kicker">${esc(d.weekday)}</p>
          <p class="details__day">${esc(d.day)}</p>
          <p class="details__month">${esc(d.month)} <i aria-hidden="true"></i> ${esc(d.year)}</p>
          ${rule("panel__rule")}
          <p class="details__sub">${esc(time(event.date))} ${esc(t.timeSuffix || "h")}</p>
          ${countdown ? `<p class="caps details__count">${countdown}</p>` : ""}
          ${t.calendar ? `<a class="link" href="${esc(calendarUrl(config))}" target="_blank" rel="noopener">${esc(t.calendar)}</a>` : ""}
        </article>
        <article class="panel reveal" style="--i:1">
          ${corners()}
          <p class="caps eyebrow">${esc(t.where || "Dónde")}</p>
          ${venue.city ? `<p class="caps panel__kicker">${esc(venue.city)}</p>` : ""}
          <p class="details__venue">${esc(venue.name)}</p>
          ${rule("panel__rule")}
          ${venue.address ? `<p class="details__sub">${esc(venue.address)}</p>` : ""}
          ${venue.mapsUrl && t.map ? `<a class="link" href="${esc(venue.mapsUrl)}" target="_blank" rel="noopener">${esc(t.map)}</a>` : ""}
        </article>
      </div>
    </div>
  </section>`;
}

export function story({ story, event, copy = {} }) {
  const chapters = story?.chapters?.filter((c) => c.text) || [];
  if (!chapters.length) return "";
  const t = copy.story || {};
  const [a, b] = event.couple;
  return `
  <section class="section story"${labelled("story-title", t)}>
    <div class="wrap">
      ${head("story-title", t)}
      <ol class="chapters">${chapters.map((c, i) => `
        <li class="chapter reveal">
          ${i ? rule("chapter__rule") : ""}
          ${c.photo ? `
          <figure class="arch chapter__photo">
            <img src="${esc(c.photo)}" alt="${esc(c.photoAlt || `${a} y ${b}`)}" loading="lazy">
            ${archFrame()}
          </figure>` : ""}
          ${c.meta ? `<p class="caps eyebrow">${esc(c.meta)}</p>` : ""}
          <p class="chapter__text">${esc(c.text)}</p>
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

export function schedule({ schedule = [], copy = {} }) {
  if (!schedule.length) return "";
  const t = copy.schedule || {};
  const n = schedule.length;
  const cols = n <= 4 ? n : n === 5 || n === 6 || n === 9 ? 3 : 4;
  return `
  <section class="section schedule"${labelled("schedule-title", t)}>
    <div class="wrap wrap--wide">
      ${head("schedule-title", t)}
      <ol class="program" style="--cols:${cols}">${schedule.map((s, i) => `
        <li class="program__item reveal" style="--i:${i % cols}">
          <span class="stamp">${stamp()}<time class="stamp__time">${esc(s.time)}</time></span>
          <span class="program__label">${esc(s.label)}</span>
          ${s.place ? `<span class="program__place">${esc(s.place)}</span>` : ""}
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

// Código de vestimenta: solo sale si copy.dresscode trae algún texto.
export function dresscode({ copy = {} }) {
  const t = copy.dresscode || {};
  if (!t.text && !t.her && !t.him) return "";
  const item = (icon, label, text, i) => text ? `
    <div class="dress__item reveal" style="--i:${i}">
      ${icon}
      ${label ? `<p class="caps eyebrow">${esc(label)}</p>` : ""}
      <p class="dress__text">${esc(text)}</p>
    </div>` : "";
  const items = item(fanIcon(), t.herLabel, t.her, 0) + item(bowtie(), t.himLabel, t.him, 1);
  return `
  <section class="section dresscode"${labelled("dresscode-title", t)}>
    <div class="wrap">
      ${head("dresscode-title", t)}
      ${t.text ? `<p class="dress__lead reveal">${esc(t.text)}</p>` : ""}
      ${items ? `<div class="dress__grid">${items}</div>` : ""}
    </div>
  </section>`;
}

export function gallery({ gallery = [], event, copy = {} }) {
  if (!gallery.length) return "";
  const t = copy.gallery || {};
  const [a, b] = event.couple;
  return `
  <section class="section gallery"${labelled("gallery-title", t)}>
    <div class="wrap wrap--wide">
      ${head("gallery-title", t)}
      <div class="album" data-count="${gallery.length}">${gallery.map((src, i) => `
        <figure class="arch reveal" style="--i:${i % 3}">
          <img src="${esc(src)}" alt="${esc(`${a} y ${b}`)}" loading="lazy">
          ${archFrame()}
        </figure>`).join("")}
      </div>
    </div>
  </section>`;
}

export function gifts({ gifts, copy = {} }) {
  if (!gifts?.iban) return "";
  const t = copy.gifts || {};
  const raw = gifts.iban.replace(/\s+/g, "").toUpperCase();
  return `
  <section class="section gifts" aria-labelledby="gifts-title">
    <div class="wrap">
      <div class="panel panel--gifts reveal">
        ${corners()}
        ${fanRule()}
        ${t.eyebrow ? `<p class="caps eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h2 class="section__title" id="gifts-title">${esc(t.title)}</h2>
        ${t.text ? `<p class="gifts__text">${esc(t.text)}</p>` : ""}
        <details class="iban">
          <summary class="link">${esc(t.reveal || "Ver los datos de la cuenta")}</summary>
          <dl class="iban__data">
            ${gifts.holder ? `<div><dt class="caps">${esc(t.holderLabel)}</dt><dd>${esc(gifts.holder)}</dd></div>` : ""}
            <div><dt class="caps">${esc(t.ibanLabel)}</dt><dd class="iban__num" id="iban-value">${esc(raw.match(/.{1,4}/g).join(" "))}</dd></div>
          </dl>
          <button class="link" type="button" data-copy="${esc(raw)}" data-done="${esc(t.copied)}" aria-controls="iban-value"><span data-label aria-live="polite">${esc(t.copy)}</span></button>
        </details>
      </div>
    </div>
  </section>`;
}

export function closing({ event, rsvp = {}, sections, locale, copy = {} }) {
  const [a, b] = event.couple;
  const t = copy.closing || {};
  const hasRsvp = sections.includes("rsvp") && !rsvpClosed({ event, rsvp });
  const deadline = rsvp.deadline ? dateParts(rsvp.deadline, locale).dayMonth : "";
  return `
  <section class="closing" aria-labelledby="closing-title">
    <div class="closing__inner reveal">
      ${sunrise("closing__sun")}
      ${hasRsvp ? `
        ${fanRule()}
        ${t.eyebrow ? `<p class="caps eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h2 class="section__title closing__title" id="closing-title">${esc(t.title)}</h2>
        ${deadline && t.text ? `<p class="closing__text">${fill(t.text, { deadline })}</p>` : ""}
        <button class="button" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button>`
      : `
        ${fanRule()}
        <h2 class="names closing__names" id="closing-title"><span class="names__n">${esc(a)}</span><span class="names__amp" aria-hidden="true">&amp;</span><span class="sr-only"> y </span><span class="names__n">${esc(b)}</span></h2>`}
    </div>
    <footer class="closing__foot">
      ${rule()}
      <p class="closing__sign">${esc(a)} <span aria-hidden="true">&amp;</span><span class="sr-only">y</span> ${esc(b)}</p>
      <p class="caps">${esc(dateParts(event.date, locale).year)}</p>
    </footer>
  </section>`;
}
