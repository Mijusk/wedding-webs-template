import { dateParts, time, daysUntil, esc, fill, rsvpClosed } from "./format.js";
import { calendarUrl } from "./calendar.js";

// Plantilla Monograma: papelería de lujo, sin fotos en la portada.
// Todo gira en torno a un monograma SVG con las dos iniciales entrelazadas.

// ---------------------------------------------------------------------------
// Monograma
// ---------------------------------------------------------------------------

// Tinta de cada mayúscula de Bodoni Moda, en fracciones del cuerpo: [izquierda, derecha]
// medidas desde el origen del glifo (recta y cursiva). Sirve para centrar y escalar
// cualquier pareja de iniciales sin depender de que la fuente ya esté cargada.
const INK = {
  up: { A: [2, 72], B: [2, 59], C: [4, 63], D: [2, 66], E: [2, 56], F: [2, 54], G: [4, 71], H: [2, 72], I: [2, 35], J: [1, 41], K: [2, 68], L: [2, 55], M: [2, 81], N: [2, 72], Ñ: [2, 72], O: [4, 69], P: [2, 58], Q: [4, 69], R: [2, 69], S: [4, 52], T: [2, 62], U: [2, 68], V: [2, 72], W: [1, 96], X: [1, 72], Y: [1, 70], Z: [1, 53] },
  it: { A: [-4, 66], B: [-4, 63], C: [6, 73], D: [-3, 70], E: [-4, 65], F: [-4, 64], G: [6, 73], H: [-4, 82], I: [-4, 45], J: [-3, 53], K: [-4, 74], L: [-4, 54], M: [-2, 91], N: [-3, 81], Ñ: [-3, 81], O: [6, 72], P: [-4, 64], Q: [6, 72], R: [-4, 68], S: [-2, 60], T: [8, 73], U: [8, 78], V: [12, 82], W: [12, 107], X: [-5, 79], Y: [12, 83], Z: [-5, 62] },
};

// Primera letra del nombre en mayúscula, sin tildes (Á → A) pero respetando la Ñ.
export function initial(name) {
  const ch = Array.from(String(name ?? "").trim())[0] || "";
  const up = ch.toLocaleUpperCase("es");
  if (up === "Ñ") return up;
  return up.normalize("NFD").replace(/[̀-ͯ]/g, "") || "·";
}

const CAP = 0.75; // altura de las mayúsculas de Bodoni Moda
const C = 200; // centro del lienzo (viewBox 400 × 400)

// Arco de circunferencia que deja un hueco abajo (para el año) y arranca en un extremo del hueco:
// así el trazo se dibuja de una vez, como una pluma que rodea las letras.
function ring(r, gapDeg) {
  const rad = (d) => (d * Math.PI) / 180;
  const p = (d) => `${(C + r * Math.cos(rad(d))).toFixed(2)} ${(C + r * Math.sin(rad(d))).toFixed(2)}`;
  const from = 90 + gapDeg / 2;
  const to = 90 - gapDeg / 2 + 360;
  return `M ${p(from)} A ${r} ${r} 0 1 1 ${p(to)}`;
}

export function monogram({ event, locale }, { id = "m", label = true } = {}) {
  const [a, b] = event.couple;
  const A = initial(a), B = initial(b);
  const wa = INK.up[A] || [2, 66], wb = INK.it[B] || [-3, 70];
  const w1 = (wa[1] - wa[0]) / 100, w2 = (wb[1] - wb[0]) / 100;

  // La segunda letra (cursiva) va desplazada a la derecha y hacia abajo, cruzándose con la primera.
  const k = (w1 + w2) * 0.27; // distancia entre centros, en cuerpos
  const drop = 0.24; // caída de la cursiva, en cuerpos
  const width = w1 / 2 + k + w2 / 2;
  const height = CAP + drop;
  const S = Math.min(236 / width, 214 / height, 232);

  // Centro del conjunto en (200, 196): ojo, la tinta de la Ñ sube un poco más.
  const left = C - (width * S) / 2;
  const cx1 = left + (w1 / 2) * S;
  const cx2 = cx1 + k * S;
  const top = 196 - (height * S) / 2;
  const y1 = top + CAP * S;
  const y2 = y1 + drop * S;
  const x1 = cx1 - ((wa[0] + wa[1]) / 200) * S;
  const x2 = cx2 - ((wb[0] + wb[1]) / 200) * S;
  const knock = (S * 0.034).toFixed(1);
  const year = dateParts(event.date, locale).year;

  const L1 = `<text x="${x1.toFixed(1)}" y="${y1.toFixed(1)}" font-size="${S.toFixed(1)}">${esc(A)}</text>`;
  const L2 = `<text x="${x2.toFixed(1)}" y="${y2.toFixed(1)}" font-size="${S.toFixed(1)}" font-style="italic">${esc(B)}</text>`;
  // Entrelazado de verdad: cada letra lleva una máscara con la silueta engordada de la otra,
  // así el "filo de papel" que las separa es transparente (se ve el papel, no un color pintado).
  // A la derecha de la línea de corte la cursiva pasa por encima; a la izquierda, la recta:
  // por encima / por debajo, como un monograma grabado.
  const split = (cx1 + (cx2 - cx1) * 0.5).toFixed(1);
  const cut = (t) => t.replace("<text ", `<text fill="#000" stroke="#000" stroke-width="${knock}" stroke-linejoin="round" `);

  const title = label ? `<title id="${id}-t">${esc(a)} &amp; ${esc(b)} · ${esc(year)}</title>` : "";
  return `
  <svg class="mono" viewBox="0 0 400 400" ${label ? `role="img" aria-labelledby="${id}-t"` : `aria-hidden="true" focusable="false"`}>
    ${title}
    <defs>
      <clipPath id="${id}-l"><rect x="0" y="0" width="${split}" height="400"/></clipPath>
      <clipPath id="${id}-r"><rect x="${split}" y="0" width="400" height="400"/></clipPath>
      <mask id="${id}-m1" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="400">
        <rect width="400" height="400" fill="#fff"/><g clip-path="url(#${id}-r)">${cut(L2)}</g>
      </mask>
      <mask id="${id}-m2" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="400">
        <rect width="400" height="400" fill="#fff"/><g clip-path="url(#${id}-l)">${cut(L1)}</g>
      </mask>
    </defs>
    <path class="mono__ring mono__ring--out" d="${ring(188, 36)}" pathLength="1"/>
    <path class="mono__ring mono__ring--in" d="${ring(180, 30)}" pathLength="1"/>
    <g class="mono__orn">
      <path d="M200 6.5 L204.5 12 L200 17.5 L195.5 12 Z"/>
      <text class="mono__year" x="200" y="394">${esc(year)}</text>
    </g>
    <g class="mono__letters">
      <g class="mono__l1"><g mask="url(#${id}-m1)">${L1}</g></g>
      <g class="mono__l2"><g mask="url(#${id}-m2)">${L2}</g></g>
    </g>
  </svg>`;
}

// ---------------------------------------------------------------------------
// Piezas comunes
// ---------------------------------------------------------------------------

const orn = `<span class="orn" aria-hidden="true"><i></i><b></b><i></i></span>`;
const arrow = `<span aria-hidden="true">→</span>`;

const head = (t = {}, id) => `
  <header class="head reveal">
    ${orn}
    ${t.eyebrow ? `<p class="eyebrow">${esc(t.eyebrow)}</p>` : ""}
    ${t.title ? `<h2 class="title" id="${id}">${esc(t.title)}</h2>` : ""}
  </header>`;

const section = (cls, t = {}, id, body) => `
  <section class="sec ${cls}"${t.title ? ` aria-labelledby="${id}"` : t.eyebrow ? ` aria-label="${esc(t.eyebrow)}"` : ""}>
    <div class="wrap">${head(t, id)}${body}</div>
  </section>`;

const cap = (s) => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : "");

// ---------------------------------------------------------------------------
// Secciones
// ---------------------------------------------------------------------------

export function hero(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const place = [venue.name, venue.city].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join(" · ");
  return `
  <section class="hero" aria-labelledby="hero-names">
    <div class="hero__card">
      ${copy.hero?.eyebrow ? `<p class="eyebrow hero__eyebrow anim" style="--d:1.5s">${esc(copy.hero.eyebrow)}</p>` : ""}
      <div class="hero__mono">${monogram(config, { id: "mh", label: false })}</div>
      <h1 class="hero__names anim" id="hero-names" style="--d:1.55s">
        <span>${esc(a)}</span> <em>&amp;</em> <span>${esc(b)}</span>
      </h1>
      ${event.tagline ? `<p class="hero__tagline anim" style="--d:1.7s">${esc(event.tagline)}</p>` : ""}
      <span class="anim" style="--d:1.8s">${orn}</span>
      <p class="hero__date anim" style="--d:1.85s">
        <time datetime="${esc(event.date.slice(0, 10))}">${esc(cap(d.weekday))}, ${esc(d.dayMonth)} de ${esc(d.year)}</time>
      </p>
      ${place ? `<p class="hero__place anim" style="--d:1.95s">${place}</p>` : ""}
    </div>
  </section>`;
}

export function details(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.details || {};
  const d = dateParts(event.date, locale);
  const days = daysUntil(event.date);
  const countdown = days < 0 ? "" : fill(days === 0 ? t.countdownToday : days === 1 ? t.countdownOne : t.countdown, { days });
  const link = (href, label) => (href && label ? `<a class="link" href="${esc(href)}" target="_blank" rel="noopener">${esc(label)} ${arrow}</a>` : "");
  return section("details", t, "details-title", `
    <dl class="facts">
      <div class="fact reveal">
        <dt class="eyebrow">${esc(t.when || "Cuándo")}</dt>
        <dd class="fact__main">${esc(d.dayMonth)}</dd>
        <dd class="fact__sub">${esc(cap(d.weekday))}, ${esc(d.year)}</dd>
        <dd>${link(calendarUrl(config), t.calendar)}</dd>
      </div>
      <div class="fact reveal" style="--i:1">
        <dt class="eyebrow">${esc(t.time || "Hora")}</dt>
        <dd class="fact__main">${esc(time(event.date))}${t.timeSuffix ? ` <small>${esc(t.timeSuffix)}</small>` : ""}</dd>
        ${countdown ? `<dd class="fact__sub">${countdown}</dd>` : ""}
      </div>
      <div class="fact reveal" style="--i:2">
        <dt class="eyebrow">${esc(t.where || "Dónde")}</dt>
        <dd class="fact__main">${esc(venue.name)}</dd>
        ${venue.address ? `<dd class="fact__sub">${esc(venue.address)}</dd>` : ""}
        <dd>${link(venue.mapsUrl, t.map)}</dd>
      </div>
    </dl>`);
}

export function story({ story, copy = {} }) {
  const chapters = story?.chapters?.filter((c) => c.text) || [];
  if (!chapters.length) return "";
  return section("story", copy.story, "story-title", `
    <div class="chapters">${chapters.map((c, i) => `
      <article class="chapter reveal">
        ${c.photo ? `<figure class="frame chapter__photo"><img src="${esc(c.photo)}" alt="${esc(c.photoAlt || "")}" loading="lazy"></figure>` : ""}
        ${c.meta ? `<p class="eyebrow chapter__meta">${esc(c.meta)}</p>` : ""}
        <p class="chapter__text${i === 0 ? " has-drop" : ""}">${esc(c.text)}</p>
      </article>`).join("")}
    </div>`);
}

export function schedule({ schedule = [], copy = {} }) {
  if (!schedule.length) return "";
  return section("schedule", copy.schedule, "schedule-title", `
    <ol class="program">${schedule.map((s, i) => `
      <li class="reveal" style="--i:${i}">
        <time class="program__time">${esc(s.time)}</time>
        <span class="program__what">${esc(s.label)}</span>
        ${s.place ? `<span class="program__where">${esc(s.place)}</span>` : ""}
      </li>`).join("")}
    </ol>`);
}

export function gallery({ gallery = [], event, copy = {} }) {
  const photos = (gallery || []).filter(Boolean).slice(0, 4);
  if (!photos.length) return "";
  const [a, b] = event.couple;
  return section("gallery", copy.gallery, "gallery-title", `
    <div class="photos" data-count="${photos.length}">${photos.map((src, i) => `
      <figure class="frame reveal" style="--i:${i}"><img src="${esc(src)}" alt="${esc(`${a} y ${b}`)}" loading="lazy"></figure>`).join("")}
    </div>`);
}

export function gifts({ gifts, copy = {} }) {
  if (!gifts?.iban) return "";
  const t = copy.gifts || {};
  const raw = gifts.iban.replace(/\s+/g, "").toUpperCase();
  return section("gifts", t, "gifts-title", `
    ${t.text ? `<p class="lead reveal">${esc(t.text)}</p>` : ""}
    <details class="iban reveal">
      <summary class="link">${esc(t.reveal || "Ver los datos de la cuenta")}</summary>
      <div class="iban__card">
        ${gifts.holder ? `<p class="eyebrow">${esc(t.holderLabel)}</p><p class="iban__holder">${esc(gifts.holder)}</p>` : ""}
        <p class="eyebrow">${esc(t.ibanLabel)}</p>
        <p class="iban__num" id="iban-value">${esc(raw.match(/.{1,4}/g).join(" "))}</p>
        <button class="link" type="button" data-copy="${esc(raw)}" data-done="${esc(t.copied)}" aria-controls="iban-value"><span data-label aria-live="polite">${esc(t.copy)}</span></button>
      </div>
    </details>`);
}

export function closing(config) {
  const { event, rsvp = {}, sections, locale, copy = {} } = config;
  const [a, b] = event.couple;
  const t = copy.closing || {};
  const hasRsvp = sections.includes("rsvp") && !rsvpClosed({ event, rsvp });
  const deadline = rsvp.deadline ? dateParts(rsvp.deadline, locale).dayMonth.replace(/ /g, "\u00a0") : "";
  const year = dateParts(event.date, locale).year;
  return `
  <section class="closing" aria-labelledby="closing-title">
    <div class="wrap">
      <div class="closing__mono reveal">${monogram(config, { id: "mc", label: false })}</div>
      ${hasRsvp && t.eyebrow ? `<p class="eyebrow reveal">${esc(t.eyebrow)}</p>` : ""}
      <h2 class="closing__title reveal${hasRsvp ? "" : " is-names"}" id="closing-title">${hasRsvp ? esc(t.title) : `${esc(a)} <em>&amp;</em> ${esc(b)}`}</h2>
      ${hasRsvp && deadline && t.text ? `<p class="lead reveal">${fill(t.text, { deadline })}</p>` : ""}
      ${hasRsvp ? `<div class="reveal"><button class="button" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button></div>` : ""}
    </div>
    <footer class="closing__foot">
      <span>${esc(a)} &amp; ${esc(b)}</span><i aria-hidden="true"></i><span>${esc(year)}</span>
    </footer>
  </section>`;
}
