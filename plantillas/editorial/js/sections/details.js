import { dateParts, time, daysUntil, esc, fill } from "../format.js";
import { toneAt } from "../tone.js";
import { calendarUrl } from "../calendar.js";

const arrow = `<span class="arrow" aria-hidden="true">→</span>`;

function countdown(iso, t) {
  const days = daysUntil(iso);
  const text = days === 0 ? t.countdownToday : days === 1 ? t.countdownOne : t.countdown;
  return text ? `<p class="details__countdown">${fill(text, { days })}</p>` : "";
}

export function details(config) {
  const { event, venue, locale, copy = {} } = config;
  const t = copy.details || {};
  const d = dateParts(event.date, locale);
  return `
  <section class="section details" data-tone="${toneAt(time(event.date))}" aria-labelledby="details-title">
    <div class="wrap split">
      <p class="eyebrow" id="details-title">${esc(t.eyebrow)}</p>
      <div class="details__grid">
        <div class="details__col reveal">
          <p class="label">${esc(t.when)}</p>
          <p class="details__day">${esc(d.day)}</p>
          <p class="details__month">${esc(d.month)} ${esc(d.year)}</p>
          <p class="details__meta">${esc(d.weekday)} · ${esc(time(event.date))} ${esc(t.timeSuffix)}</p>
          ${t.calendar ? `<a class="link" href="${esc(calendarUrl(config))}" target="_blank" rel="noopener">${esc(t.calendar)} ${arrow}</a>` : ""}
        </div>
        <div class="details__col reveal" style="--i:1">
          <p class="label">${esc(t.where)}</p>
          <p class="details__venue">${esc(venue.name)}</p>
          <p class="details__address">${esc(venue.address)}</p>
          ${venue.mapsUrl && t.map ? `<a class="link" href="${esc(venue.mapsUrl)}" target="_blank" rel="noopener">${esc(t.map)} ${arrow}</a>` : ""}
        </div>
        ${countdown(event.date, t)}
      </div>
    </div>
  </section>`;
}
