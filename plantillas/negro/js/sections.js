import { dateParts, time, daysUntil, esc, fill, rsvpClosed } from "./format.js";
import { calendarUrl } from "./calendar.js";

// Plantilla Negro: una revista de moda en negro y marfil. La portada es una cubierta a
// sangre (la foto gana color al bajar, js/enhance.js); cada sección es una página con su
// folio; la historia se lee como una entrevista y el programa como el sumario.

const cap = (s) => String(s ?? "").replace(/^\p{L}/u, (c) => c.toLocaleUpperCase());
const two = (n) => String(n).padStart(2, "0");

// Qué secciones llegan a pintarse: así los folios (p. 02, p. 06…) no se saltan números.
const shows = {
  details: () => true,
  story: (c) => Boolean(c.story?.chapters?.some((ch) => ch.text)),
  schedule: (c) => Boolean(c.schedule?.length),
  gallery: (c) => Boolean(c.gallery?.length),
  gifts: (c) => Boolean(c.gifts?.iban),
};
function folio(config, name) {
  const pages = config.sections.filter((s) => shows[s]?.(config));
  return two(2 + Math.max(0, pages.indexOf(name)) * 4);
}

const head = (config, name, id, t = {}) => `
  <header class="head">
    <p class="folio reveal"><span class="folio__page">p. ${folio(config, name)}</span><span class="folio__rule" aria-hidden="true"></span>${t.eyebrow ? `<span class="folio__kicker">${esc(t.eyebrow)}</span>` : ""}</p>
    ${t.title ? `<h2 class="title reveal" id="${id}">${esc(t.title)}</h2>` : ""}
    ${t.standfirst ? `<p class="standfirst reveal">${esc(t.standfirst)}</p>` : ""}
  </header>`;

const labelled = (id, t = {}) => (t.title ? ` aria-labelledby="${id}"` : t.eyebrow ? ` aria-label="${esc(t.eyebrow)}"` : "");

// Longitud de la palabra más larga: fija el cuerpo de los nombres para que siempre quepan.
const longest = (s) => Math.max(...String(s).split(/\s+/).map((w) => w.length));

export function hero({ event, venue = {}, locale, copy = {} }) {
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const t = copy.hero || {};
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  const len = Math.max(longest(a), longest(b) + 1.4, 5);           // móvil: los nombres pueden partirse
  const full = Math.max(String(a).length, String(b).length + 1.4, 5); // escritorio: cada nombre en una línea
  const issue = fill(t.issue || "Nº {day} · {month} {year}", { day: d.day, month: cap(d.month), year: d.year });
  return `
  <section class="hero${event.photo ? "" : " hero--nophoto"}" aria-labelledby="hero-names" style="--len:${len};--full:${full}">
    ${event.photo ? `
    <figure class="hero__photo">
      <img src="${esc(event.photo)}" alt="${esc(event.photoAlt)}"${focus} fetchpriority="high">
    </figure>` : ""}
    <div class="hero__shade" aria-hidden="true"></div>
    <div class="hero__inner">
      <div class="masthead">
        <p class="masthead__issue">${issue}</p>
        ${t.eyebrow ? `<p class="masthead__title">${esc(t.eyebrow)}</p>` : ""}
        ${venue.city ? `<p class="masthead__place">${esc(venue.city)}</p>` : ""}
      </div>
      <div class="cover">
        <div class="coverline">
          ${t.exclusive ? `<p class="tag">${esc(t.exclusive)}</p>` : ""}
          ${event.tagline ? `<p class="coverline__text">${esc(event.tagline)}</p>` : ""}
          <p class="coverline__meta">${esc(cap(d.weekday))}, ${esc(d.dayMonth)} · ${esc(time(event.date))} h${venue.name ? `<br>${esc(venue.name)}` : ""}</p>
        </div>
        <h1 class="names" id="hero-names">
          <span class="names__line"><span class="names__in">${esc(a)}</span></span>
          <span class="names__line names__line--b"><span class="names__in"><span class="names__amp" aria-hidden="true">&amp;</span><span class="sr-only"> y </span>${esc(b)}</span></span>
        </h1>
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
  <section class="page details"${labelled("details-title", t)}>
    <div class="wrap">
      ${head(config, "details", "details-title", t)}
      <div class="details__grid">
        <article class="fact reveal">
          <p class="label">${esc(t.when || "Cuándo")}</p>
          <div class="fact__date">
            <span class="fact__day">${esc(d.day)}</span>
            <p class="fact__lines">
              <span class="fact__big">${esc(cap(d.weekday))}</span>
              <span class="fact__sub">${esc(d.month)} ${esc(d.year)} · ${esc(time(event.date))} ${esc(t.timeSuffix || "h")}</span>
            </p>
          </div>
          ${countdown ? `<p class="fact__count">${countdown}</p>` : ""}
          ${t.calendar ? `<a class="link" href="${esc(calendarUrl(config))}" target="_blank" rel="noopener">${esc(t.calendar)}<span class="link__arrow" aria-hidden="true">→</span></a>` : ""}
        </article>
        <article class="fact reveal" style="--i:1">
          <p class="label">${esc(t.where || "Dónde")}</p>
          <p class="fact__venue">${esc(venue.name)}</p>
          ${venue.address ? `<p class="fact__sub fact__address">${esc(venue.address)}</p>` : ""}
          ${venue.mapsUrl && t.map ? `<a class="link" href="${esc(venue.mapsUrl)}" target="_blank" rel="noopener">${esc(t.map)}<span class="link__arrow" aria-hidden="true">→</span></a>` : ""}
        </article>
      </div>
    </div>
  </section>`;
}

// La historia como entrevista: el título de cada capítulo es la pregunta y el texto, la respuesta.
export function story(config) {
  const { story, event, copy = {} } = config;
  const chapters = story?.chapters?.filter((c) => c.text) || [];
  if (!chapters.length) return "";
  const t = copy.story || {};
  const [a, b] = event.couple;
  return `
  <section class="page page--light story"${labelled("story-title", t)}>
    <div class="wrap">
      ${head(config, "story", "story-title", t)}
      <div class="interview">${chapters.map((c, i) => `
        <div class="qa reveal${c.photo ? " qa--photo" : ""}">
          ${c.meta ? `<h3 class="qa__q">${esc(c.meta)}</h3>` : ""}
          ${c.photo ? `
          <figure class="qa__fig">
            <img src="${esc(c.photo)}" alt="${esc(c.photoAlt || `${a} y ${b}`)}" loading="lazy">
            <figcaption class="caption">${esc(c.photoAlt || `${a} y ${b}`)}</figcaption>
          </figure>` : ""}
          <p class="qa__a${i === 0 ? " qa__a--first" : ""}">${esc(c.text)}${i === chapters.length - 1 ? `<span class="endmark" aria-hidden="true"></span>` : ""}</p>
        </div>`).join("")}
      </div>
    </div>
  </section>`;
}

// El programa como sumario de revista: hora, momento, puntos guía y página.
export function schedule(config) {
  const { schedule = [], copy = {} } = config;
  if (!schedule.length) return "";
  const t = copy.schedule || {};
  return `
  <section class="page schedule"${labelled("schedule-title", t)}>
    <div class="wrap">
      ${head(config, "schedule", "schedule-title", t)}
      <ol class="toc">${schedule.map((s, i) => `
        <li class="toc__item reveal" style="--i:${i}">
          <time class="toc__time">${esc(s.time)}</time>
          <span class="toc__what">
            <span class="toc__label">${esc(s.label)}</span>
            ${s.place ? `<span class="toc__place">${esc(s.place)}</span>` : ""}
          </span>
          <span class="toc__dots" aria-hidden="true"></span>
          <span class="toc__page" aria-hidden="true">p.&nbsp;${two(4 + i * 12)}</span>
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

export function gallery(config) {
  const { gallery = [], event, copy = {} } = config;
  if (!gallery.length) return "";
  const t = copy.gallery || {};
  const [a, b] = event.couple;
  const photos = gallery.slice(0, 9);
  const alt = `${a} y ${b}`;
  return `
  <section class="page gallery"${labelled("gallery-title", t)}>
    <div class="wrap">
      ${head(config, "gallery", "gallery-title", t)}
      <div class="spread${photos.length % 2 ? " spread--odd" : ""}" data-count="${photos.length}">${photos.map((src, i) => `
        <figure class="plate reveal" style="--i:${i % 3}">
          <div class="plate__img"><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy"></div>
          <figcaption class="caption"><span class="caption__n">${two(i + 1)}</span>${t.caption ? `<span>${fill(t.caption, { a, b })}</span>` : ""}</figcaption>
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
  <section class="page page--light gifts" aria-labelledby="gifts-title">
    <div class="wrap">
      ${head(config, "gifts", "gifts-title", { eyebrow: t.eyebrow, title: t.title })}
      <div class="gifts__body reveal">
        ${t.text ? `<p class="gifts__text">${esc(t.text)}</p>` : ""}
        <details class="iban">
          <summary class="link">${esc(t.reveal || "Ver los datos de la cuenta")}<span class="link__arrow" aria-hidden="true">+</span></summary>
          <dl class="iban__data">
            ${gifts.holder ? `<div><dt class="label">${esc(t.holderLabel)}</dt><dd>${esc(gifts.holder)}</dd></div>` : ""}
            <div><dt class="label">${esc(t.ibanLabel)}</dt><dd class="iban__num" id="iban-value">${esc(raw.match(/.{1,4}/g).join(" "))}</dd></div>
          </dl>
          <button class="link" type="button" data-copy="${esc(raw)}" data-done="${esc(t.copied)}" aria-controls="iban-value"><span data-label aria-live="polite">${esc(t.copy)}</span></button>
        </details>
      </div>
    </div>
  </section>`;
}

export function closing({ event, rsvp = {}, sections, venue = {}, locale, copy = {} }) {
  const [a, b] = event.couple;
  const t = copy.closing || {};
  const d = dateParts(event.date, locale);
  const hasRsvp = sections.includes("rsvp") && !rsvpClosed({ event, rsvp });
  const deadline = rsvp.deadline ? dateParts(rsvp.deadline, locale).dayMonth : "";
  return `
  <section class="closing" aria-labelledby="closing-title">
    <div class="wrap">
      ${hasRsvp ? `
      <div class="closing__body">
        ${t.eyebrow ? `<p class="label reveal">${esc(t.eyebrow)}</p>` : ""}
        <h2 class="closing__title reveal" id="closing-title">${esc(t.title)}</h2>
        ${deadline && t.text ? `<p class="closing__text reveal">${fill(t.text, { deadline })}</p>` : ""}
        <p class="reveal"><button class="button" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button></p>
      </div>` : `
      <h2 class="closing__names reveal" id="closing-title"><span>${esc(a)}</span> <span class="closing__amp" aria-hidden="true">&amp;</span><span class="sr-only">y</span> <span>${esc(b)}</span></h2>`}
      <footer class="colophon">
        <p class="colophon__names">${esc(a)} <span aria-hidden="true">&amp;</span><span class="sr-only">y</span> ${esc(b)}</p>
        <p class="colophon__meta">${esc(d.numeric)}${venue.city ? ` · ${esc(venue.city)}` : ""}</p>
        <p class="colophon__meta">${esc(t.edition || "Edición única")} · ${esc(d.year)}</p>
      </footer>
    </div>
  </section>`;
}
