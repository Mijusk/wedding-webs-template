import { longDate, time, esc } from "../format.js";

export function details({ event, venue }) {
  return `
  <section class="details" aria-label="Datos del evento">
    <div><p class="eyebrow">Cuándo</p><p class="value">${esc(longDate(event.date))}</p></div>
    <div><p class="eyebrow">Hora</p><p class="value">${esc(time(event.date))} h</p></div>
    <div>
      <p class="eyebrow">Dónde</p>
      <p class="value">${esc(venue.name)}</p>
      <p>${esc(venue.address)}</p>
      ${venue.mapsUrl ? `<p><a href="${esc(venue.mapsUrl)}" target="_blank" rel="noopener">Ver en el mapa</a></p>` : ""}
    </div>
  </section>`;
}
