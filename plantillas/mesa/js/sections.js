import { dateParts, time, daysUntil, esc, fill, rsvpClosed, weddingPhase } from "./format.js";
import { calendarUrl } from "./calendar.js";
import { cutlery, glass, sprig } from "./props.js";

// «La mesa»: la web es una mesa de boda vista desde arriba. Al bajar se pone la mesa
// (js/motion.js): la invitación sobre el plato, los cubiertos, las copas y la tarjeta con el
// nombre del invitado; luego las fotos caen sobre el mantel, el programa es el menú y, al final,
// se encienden las velas. Cada función recibe (config, n): n es el número de la sección.

export const arrow = `<span class="link__arrow" aria-hidden="true">→</span>`;

const head = ({ eyebrow, title, id, text }) => `
      <header class="head">
        ${eyebrow ? `<p class="eyebrow head__eyebrow reveal">${esc(eyebrow)}</p>` : ""}
        ${title ? `<h2 class="head__title reveal" id="${id}">${esc(title)}</h2>` : ""}
        ${text ? `<p class="head__text reveal">${esc(text)}</p>` : ""}
      </header>`;

// Una pieza sobre la mesa. x, y: centro (en unidades de la mesa); w, h: tamaño; r: giro.
// from = "dx,dy,giro,retraso": de dónde llega al poner la mesa (js/motion.js).
const prop = (cls, { x, y, w, h = w, r = 0, from = "", z = 1 }, inner = "") =>
  `<div class="prop ${cls}" style="--x:${x};--y:${y};--w:${w};--h:${h};--r:${r};z-index:${z}"${from ? ` data-from="${from}"` : ""}>${inner}</div>`;

// Quién mira la web: con el enlace personal (RSVP ampliado), su nombre va en la tarjeta de su sitio.
export function guestOf(config) {
  const inv = config.rsvp?.extended?.invite;
  if (!inv?.name) return null;
  const many = (inv.guests?.length || inv.seats || 1) > 1;
  return { name: String(inv.name), many };
}

// Portada: la invitación ocupa la pantalla y, al bajar, la cámara se aleja y se pone la mesa.
export function hero(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.hero || {};
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const len = Math.max(String(a).length, String(b).length, 4);
  const guest = guestOf(config);
  const seat = guest ? guest.name : t.seat || "Tu sitio";
  const note = guest ? fill(guest.many ? t.seatNoteMany : t.seatNoteOne, { name: esc(guest.name) }) : esc(t.seatNote || "");
  const place = [venue.name, venue.city && venue.city !== venue.name ? venue.city : ""].filter(Boolean).join(" · ");
  return `
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero__stage">
      <div class="setting">
        ${prop("plate", { x: 0, y: 4, w: 60 })}
        ${prop("plate plate--bread", { x: -35, y: -33, w: 17, from: "-26,-18,-20,.18" })}
        ${prop("napkin", { x: -40, y: 6, w: 13, h: 46, from: "-30,4,-8,.06" })}
        ${prop("cutlery cutlery--fork", { x: -40, y: 6, w: 5.2, h: 43, r: -1, from: "-34,8,-14,.12", z: 2 }, cutlery("fork"))}
        ${prop("cutlery cutlery--butter", { x: -35, y: -33, w: 2.4, h: 19, r: 38, from: "-24,-20,10,.24", z: 2 }, cutlery("knife"))}
        ${prop("cutlery cutlery--knife", { x: 37, y: 6, w: 5.2, h: 44, r: 1, from: "34,6,12,.14", z: 2 }, cutlery("knife"))}
        ${prop("cutlery cutlery--spoon", { x: 44, y: 7, w: 5.2, h: 40, r: 2, from: "36,10,16,.2", z: 2 }, cutlery("spoon"))}
        ${prop("glass", { x: 36, y: -34, w: 15, from: "24,-24,0,.26", z: 3 }, glass())}
        ${prop("glass glass--water", { x: 22, y: -42, w: 12.5, from: "16,-30,0,.3", z: 3 }, glass())}
        ${[-1, 1].map((side) => {
          // Los sitios de al lado: solo se ven en pantallas anchas, y hacen de la mesa una mesa larga.
          const X = side * 104;
          const from = (d) => `${side * 40},0,${side * 6},${d}`;
          return `
        ${prop("plate far", { x: X, y: 4, w: 60, from: from(0.08) })}
        ${prop("napkin napkin--folded far", { x: X, y: 4, w: 17, h: 30, r: side * 9, from: from(0.12), z: 2 })}
        ${prop("cutlery far", { x: X - 37, y: 6, w: 5.2, h: 43, r: -1, from: from(0.16), z: 2 }, cutlery("fork"))}
        ${prop("cutlery far", { x: X + 37, y: 6, w: 5.2, h: 44, r: 1, from: from(0.18), z: 2 }, cutlery("knife"))}
        ${prop("glass far", { x: X + 34, y: -34, w: 15, from: from(0.22), z: 3 }, glass())}`;
        }).join("")}
        ${prop("seat", { x: 0, y: -37, w: 27, h: 11, r: -1.5, from: "0,-4,6,.32,.6", z: 4 }, `
          <span class="seat__line" aria-hidden="true"></span>
          <span class="seat__name" style="--len:${Math.max(6, seat.length)}">${esc(seat)}</span>`)}
        ${prop("invite", { x: 0, y: 4, w: 32, h: 44, z: 5 }, `
          <div class="invite__in">
            ${t.eyebrow ? `<p class="invite__eyebrow">${esc(t.eyebrow)}</p>` : ""}
            <h1 class="invite__names" id="hero-title" style="--len:${len}">
              <span class="invite__name">${esc(a)}</span>
              <span class="invite__amp">&amp;</span>
              <span class="invite__name">${esc(b)}</span>
            </h1>
            <p class="invite__date"><span class="cap">${esc(d.weekday)}</span>, ${esc(d.dayMonth)} ${esc(d.year)}</p>
            ${place ? `<p class="invite__place">${esc(place)}</p>` : ""}
          </div>`)}
        ${prop("sprig", { x: -22, y: -21, w: 12, h: 32, r: 135, z: 6 }, sprig(3))}
      </div>
      <div class="hero__after">
        ${note ? `<p class="hero__note">${note}</p>` : ""}
        ${event.tagline ? `<p class="hero__tagline">${esc(event.tagline)}</p>` : ""}
      </div>
      ${t.hint ? `<p class="hero__hint" aria-hidden="true"><span>${esc(t.hint)}</span></p>` : ""}
    </div>
  </section>`;
}

// Lo esencial: dos tarjetas de papel grueso que llegan a la mesa desde los lados.
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
      <div class="details__sprig" aria-hidden="true">${sprig(7)}</div>
    </div>
  </section>`;
}

// Giro y desplazamiento de cada foto del montón: parecen dejadas a mano, siempre igual.
const PILE = [[-4, -3, 1], [3.5, 3, -2], [-2, -1, 3], [5, 2, -1], [-5.5, -2, -3], [2.5, 1, 2]];

// Historia: la sección se queda quieta y cada capítulo cae sobre el montón de fotos.
// Sin movimiento, una lista normal de foto y texto.
export function story(config, n) {
  const { story, event, copy = {} } = config;
  const chapters = story?.chapters?.filter((c) => c.text) || [];
  if (!chapters.length) return "";
  const t = copy.story || {};
  const [a, b] = event.couple;
  const initials = `${String(a).trim()[0] || ""} & ${String(b).trim()[0] || ""}`;
  return `
  <section class="section story" aria-labelledby="story-title">
    <div class="pile" style="--count:${chapters.length}">
      <div class="pile__stage">
        ${head({ eyebrow: t.eyebrow, title: t.title || "", id: "story-title", n })}
        <ol class="pile__list">${chapters.map((c, i) => {
          const [r, dx, dy] = PILE[i % PILE.length];
          return `
          <li class="pile__item" style="--i:${i};--r:${r};--dx:${dx};--dy:${dy}">
            ${c.photo
              ? `<figure class="print"><img src="${esc(c.photo)}" alt="${esc(c.photoAlt || "")}" loading="lazy">${c.meta ? `<figcaption class="print__note">${esc(c.meta)}</figcaption>` : ""}</figure>`
              : `<div class="print print--card" aria-hidden="true"><span class="print__initials">${esc(initials)}</span></div>`}
            <div class="pile__text">
              ${c.meta ? `<p class="eyebrow pile__meta">${esc(c.meta)}</p>` : ""}
              <p class="pile__body">${esc(c.text)}</p>
            </div>
          </li>`;
        }).join("")}
        </ol>
        ${chapters.length > 1 ? `<p class="pile__count" aria-hidden="true"><span class="pile__now">01</span> / ${String(chapters.length).padStart(2, "0")}</p>` : ""}
      </div>
    </div>
  </section>`;
}

// Programa: el menú de la mesa. Cada momento se imprime al llegar a él.
export function schedule(config, n) {
  const { schedule = [], copy = {} } = config;
  if (!schedule.length) return "";
  const t = copy.schedule || {};
  return `
  <section class="section schedule" aria-labelledby="schedule-title">
    <div class="menu-table">
      <div class="menu-table__plate" aria-hidden="true"></div>
      <div class="menu-table__fork" aria-hidden="true">${cutlery("fork")}</div>
      <div class="menu-table__knife" aria-hidden="true">${cutlery("knife")}</div>
      <article class="menu">
        ${t.eyebrow ? `<p class="eyebrow menu__eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h2 class="menu__title" id="schedule-title">${esc(t.title || "")}</h2>
        <span class="menu__rule" aria-hidden="true"></span>
        <ol class="menu__list">${schedule.map((s) => `
          <li class="course">
            <time class="course__time">${esc(s.time)}</time>
            <h3 class="course__label">${esc(s.label)}</h3>
            ${s.place ? `<p class="course__place">${esc(s.place)}</p>` : ""}
          </li>`).join("")}
        </ol>
        ${t.text ? `<p class="menu__note">${esc(t.text)}</p>` : ""}
      </article>
    </div>
  </section>`;
}

export function dresscode(config, n) {
  const t = config.copy?.dresscode || {};
  if (!t.text) return "";
  const palette = (t.palette || []).filter((c) => c && c.color);
  return `
  <section class="section dresscode" aria-labelledby="dresscode-title">
    <div class="wrap">
      <div class="tag reveal">
        ${t.eyebrow ? `<p class="eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h2 class="tag__title" id="dresscode-title">${esc(t.title || "")}</h2>
        <p class="dresscode__text">${esc(t.text)}</p>
        ${palette.length ? `
        ${t.paletteLabel ? `<p class="eyebrow dresscode__label">${esc(t.paletteLabel)}</p>` : ""}
        <ul class="swatches">${palette.map((c) => `<li class="swatch"><span class="swatch__dot" style="--c:${esc(c.color)}"></span><span class="swatch__name">${esc(c.name || "")}</span></li>`).join("")}</ul>` : ""}
      </div>
    </div>
  </section>`;
}

// Giro de cada foto esparcida y lado del que llega.
const SPREAD = [-5, 4, -2.5, 6, -4, 3, -6, 2, -3];

// Galería: las fotos llegan deslizándose sobre el mantel, cada una con su giro, entre una copa
// y una ramita. Sin movimiento, se quedan quietas en su sitio.
export function gallery(config, n) {
  const { gallery = [], event, copy = {} } = config;
  if (!gallery.length) return "";
  const t = copy.gallery || {};
  const [a, b] = event.couple;
  const photos = gallery.slice(0, 9);
  return `
  <section class="section gallery" aria-labelledby="gallery-title">
    ${head({ eyebrow: t.eyebrow, title: t.title || "", id: "gallery-title", text: t.text, n })}
    <div class="spread" data-count="${photos.length}">
      <div class="spread__glass prop-free" aria-hidden="true">${glass()}</div>
      <div class="spread__sprig prop-free" aria-hidden="true">${sprig(5)}</div>${photos.map((src, i) => `
      <figure class="print spread__item" style="--r:${SPREAD[i]};--i:${i}" data-side="${i % 2 ? 1 : -1}">
        <img src="${esc(src)}" alt="${esc(`${a} y ${b}`)}" loading="lazy">
      </figure>`).join("")}
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
    ${head({ eyebrow: t.eyebrow, title: t.title || "", id: "gifts-title", text: t.text, n })}
    <div class="wrap">
      ${t.envelope ? `<div class="envelope reveal" aria-hidden="true"><span class="envelope__flap"></span><span class="envelope__label">${esc(t.envelope)}</span></div>` : ""}
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

// Velas del cierre: [izquierda %, arriba %, tamaño].
const CANDLES = [[9, 18, 1], [86, 12, 0.85], [16, 78, 0.8], [90, 70, 1.05], [52, 6, 0.7]];

// Cierre: cae la noche sobre la mesa y se encienden las velas. Botón de confirmar mientras
// la lista está abierta; después, los nombres.
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
      <div class="candles" aria-hidden="true">${CANDLES.map(([x, y, s], i) => `<span class="candle" style="--x:${x};--y:${y};--s:${s};--i:${i}"><span class="candle__flame"></span></span>`).join("")}</div>
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
