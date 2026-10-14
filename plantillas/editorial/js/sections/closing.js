import { dateParts, esc, fill } from "../format.js";

// Cierre de noche: la invitación a confirmar y los nombres firmando la página a todo el ancho.
export function closing({ event, venue = {}, rsvp = {}, sections, locale, copy = {} }) {
  const [a, b] = event.couple;
  const t = copy.closing || {};
  const hasRsvp = sections.includes("rsvp");
  const deadline = rsvp.deadline ? dateParts(rsvp.deadline, locale).dayMonth : "";
  return `
  <section class="closing" data-tone="night" aria-labelledby="closing-title">
    <div class="wrap closing__inner">
      <p class="eyebrow reveal">${fill(t.eyebrow, { date: dateParts(event.date, locale).numeric, city: venue.city || "" })}</p>
      <h2 class="closing__title reveal" id="closing-title" style="--i:1">${esc(t.title)}</h2>
      ${hasRsvp && deadline && t.text ? `<p class="closing__text reveal" style="--i:2">${fill(t.text, { deadline })}</p>` : ""}
      ${hasRsvp ? `<div class="reveal" style="--i:3"><button class="button" type="button" data-rsvp-open aria-haspopup="dialog">${esc(rsvp.buttonLabel)}</button></div>` : ""}
    </div>
    <div class="wrap">
      <p class="closing__mark" data-fit aria-hidden="true"><span>${esc(a)}<span class="amp">&amp;</span>${esc(b)}</span></p>
    </div>
  </section>`;
}
