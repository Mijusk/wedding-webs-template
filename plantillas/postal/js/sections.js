import { dateParts, time, daysUntil, esc, fill, interpolate, rsvpClosed } from "./format.js";
import { calendarUrl } from "./calendar.js";

// Plantilla Postal: una sola invitación de papel, como la que llega por correo. Todo lo esencial
// cabe en la tarjeta; debajo, solo el regalo y una firma.
const sprig = (cls) => `
  <svg class="sprig ${cls}" viewBox="0 0 120 60" aria-hidden="true">
    <path d="M6 54 C 30 40, 60 30, 114 8" />
    <path d="M30 42 c -4 -10 2 -18 12 -20 c 0 10 -4 16 -12 20 Z" />
    <path d="M30 42 c 4 8 14 10 22 6 c -6 -8 -14 -9 -22 -6 Z" />
    <path d="M56 30 c -2 -10 6 -17 15 -17 c -1 9 -6 15 -15 17 Z" />
    <path d="M56 30 c 6 7 15 8 22 3 c -6 -7 -15 -7 -22 -3 Z" />
    <path d="M82 19 c 0 -9 7 -14 15 -13 c -2 8 -7 12 -15 13 Z" />
    <path d="M82 19 c 6 5 13 5 19 0 c -6 -5 -13 -4 -19 0 Z" />
  </svg>`;

export function card(config) {
  const { event, venue = {}, rsvp = {}, schedule = [], sections, locale, copy = {} } = config;
  const t = copy.card || {};
  const det = copy.details || {};
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const open = sections.includes("rsvp") && !rsvpClosed({ event, rsvp });
  const days = daysUntil(event.date);
  const countdown = days < 0 ? "" : fill(days === 0 ? det.countdownToday : days === 1 ? det.countdownOne : det.countdown, { days });
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  return `
  <section class="hero">
    <article class="card">
      ${sprig("sprig--top")}
      ${event.photo ? `<figure class="card__photo"><img src="${esc(event.photo)}" alt="${esc(event.photoAlt)}"${focus} fetchpriority="high"></figure>` : ""}
      ${t.eyebrow ? `<p class="small">${esc(t.eyebrow)}</p>` : ""}
      <h1 class="card__names">${esc(a)} <span>&amp;</span> ${esc(b)}</h1>
      ${t.invite ? `<p class="card__invite">${esc(t.invite)}</p>` : ""}
      <div class="card__date">
        <span>${esc(d.weekday)}</span>
        <strong>${esc(d.day)}</strong>
        <span>${esc(d.month)} · ${esc(d.year)}</span>
      </div>
      <p class="card__place">${fill(t.at || "{time} h", { time: time(event.date) })}<br>${esc(venue.name)}${venue.address ? `<br><span class="muted">${esc(venue.address)}</span>` : ""}</p>
      ${countdown ? `<p class="small">${countdown}</p>` : ""}
      ${schedule.length ? `
      <div class="card__program">
        <p class="small">${esc(t.schedule || "")}</p>
        <ol>${schedule.map((s) => `<li><time>${esc(s.time)}</time> ${esc(s.label)}</li>`).join("")}</ol>
      </div>` : ""}
      <div class="card__actions">
        ${venue.mapsUrl && det.map ? `<a class="link" href="${esc(venue.mapsUrl)}" target="_blank" rel="noopener">${esc(det.map)}</a>` : ""}
        ${det.calendar ? `<a class="link" href="${esc(calendarUrl(config))}" target="_blank" rel="noopener">${esc(det.calendar)}</a>` : ""}
      </div>
      ${open ? `<button class="button" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button>
        ${rsvp.deadline && copy.rsvp?.deadlineNote ? `<p class="small">${esc(interpolate(copy.rsvp.deadlineNote, { deadline: dateParts(rsvp.deadline, locale).dayMonth }))}</p>` : ""}` : ""}
      ${sprig("sprig--bottom")}
    </article>
  </section>`;
}

export function gifts({ gifts, copy = {} }) {
  if (!gifts?.iban) return "";
  const t = copy.gifts || {};
  const raw = gifts.iban.replace(/\s+/g, "").toUpperCase();
  return `
  <section class="note reveal" aria-labelledby="gifts-title">
    <p class="small">${esc(t.eyebrow || "")}</p>
    <h2 id="gifts-title">${esc(t.title)}</h2>
    ${t.text ? `<p>${esc(t.text)}</p>` : ""}
    <details class="iban">
      <summary class="link">${esc(t.reveal || "Ver los datos de la cuenta")}</summary>
      ${gifts.holder ? `<p><span class="muted">${esc(t.holderLabel)}</span> ${esc(gifts.holder)}</p>` : ""}
      <p><span class="muted">${esc(t.ibanLabel)}</span> <span class="iban__num" id="iban-value">${esc(raw.match(/.{1,4}/g).join(" "))}</span></p>
      <button class="link" type="button" data-copy="${esc(raw)}" data-done="${esc(t.copied)}" aria-controls="iban-value"><span data-label aria-live="polite">${esc(t.copy)}</span></button>
    </details>
  </section>`;
}

// Firma al pie. Se llama "closing" para que el botón flotante de confirmar se aparte aquí.
export function closing({ event, locale }) {
  const [a, b] = event.couple;
  return `<footer class="closing"><p>${esc(a[0])} &amp; ${esc(b[0])}</p><p class="small">${esc(dateParts(event.date, locale).numeric)}</p></footer>`;
}
