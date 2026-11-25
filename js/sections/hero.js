import { longDate, esc, daysUntil } from "../format.js";

const TITLES = { boda: "Nuestra boda", aniversario: "Nuestro aniversario", otra: "Nuestra celebración" };

export function hero({ event }) {
  const [a, b] = event.couple;
  const days = daysUntil(event.date);
  // Antes de la boda, cuenta atrás; el día, "es hoy"; después, nada.
  const countdown = days > 0
    ? `<div class="countdown" aria-label="Cuenta atrás">
        <div><strong>${days}</strong><span>${days === 1 ? "día" : "días"}</span></div>
        ${days >= 14 ? `<div><strong>${Math.floor(days / 7)}</strong><span>semanas</span></div>` : ""}
      </div>`
    : days === 0 ? `<p class="countdown countdown--today">¡Es hoy!</p>` : "";
  return `
  <section class="hero${event.photo ? "" : " hero--solo"}">
    ${event.photo ? `<figure class="hero__photo"><img src="${esc(event.photo)}" alt="${esc(event.photoAlt)}"${event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : ""}></figure>` : ""}
    <div class="hero__text">
      <p class="eyebrow">${TITLES[event.type] || TITLES.boda}</p>
      <h1 class="hero__names">${esc(a)}<span class="amp">&amp;</span>${esc(b)}</h1>
      <p class="hero__date">${esc(longDate(event.date))}</p>
      ${event.tagline ? `<p class="hero__tagline">${esc(event.tagline)}</p>` : ""}
      ${countdown}
    </div>
  </section>`;
}
