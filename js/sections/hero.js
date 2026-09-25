import { dateParts, time, esc } from "../format.js";
import { toneAt } from "../tone.js";

export function hero({ event, locale, copy = {} }) {
  const [a, b] = event.couple;
  const t = copy.hero || {};
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  return `
  <section class="hero" data-tone="${toneAt(time(event.date))}">
    <img class="hero__photo" src="${esc(event.photo)}" alt="${esc(event.photoAlt)}"${focus} fetchpriority="high">
    <div class="wrap hero__inner">
      <p class="hero__eyebrow">${t.eyebrow ? `<span>${esc(t.eyebrow)}</span>` : ""}<span>${esc(dateParts(event.date, locale).numeric)}</span></p>
      <h1 class="hero__names">
        <span class="hero__line"><span style="--i:0">${esc(a)}</span></span>
        <span class="hero__line"><span style="--i:1"><span class="hero__amp">&amp;</span>${esc(b)}</span></span>
      </h1>
      ${event.tagline ? `<p class="hero__tagline">${esc(event.tagline)}</p>` : ""}
    </div>
    ${t.scrollHint ? `<span class="hero__cue" aria-hidden="true">${esc(t.scrollHint)}</span>` : ""}
  </section>`;
}
