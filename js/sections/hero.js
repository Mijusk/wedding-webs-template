import { longDate, esc } from "../format.js";

export function hero({ event }) {
  const [a, b] = event.couple;
  const days = Math.max(0, Math.ceil((new Date(event.date) - Date.now()) / 864e5));
  return `
  <section class="hero">
    <figure class="hero__photo"><img src="${esc(event.photo)}" alt="${esc(event.photoAlt)}"${event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : ""}></figure>
    <div class="hero__text">
      <p class="eyebrow">Nuestra ${esc(event.type)}</p>
      <h1 class="hero__names">${esc(a)}<span class="amp">&amp;</span>${esc(b)}</h1>
      <p class="hero__date">${esc(longDate(event.date))}</p>
      <p class="hero__tagline">${esc(event.tagline)}</p>
      <div class="countdown" aria-label="Cuenta atrás">
        <div><strong>${days}</strong><span>días</span></div>
        <div><strong>${Math.floor(days / 7)}</strong><span>semanas</span></div>
      </div>
    </div>
  </section>`;
}
