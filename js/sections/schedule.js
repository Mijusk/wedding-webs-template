import { esc } from "../format.js";
import { toneAt } from "../tone.js";

// Cada hora lleva su tono: al recorrer el programa, la página pasa de la tarde a la noche.
// Un elemento puede forzar el suyo con "tone": "day" | "dusk" | "blue" | "night".
export function schedule({ schedule = [], copy = {} }) {
  if (!schedule.length) return "";
  const t = copy.schedule || {};
  return `
  <section class="section schedule" aria-labelledby="schedule-title">
    <div class="wrap split">
      <header class="schedule__head">
        <p class="eyebrow">${esc(t.eyebrow)}</p>
        <h2 id="schedule-title">${esc(t.title)}</h2>
      </header>
      <ol class="schedule__list">
        ${schedule.map((s) => `
        <li class="schedule__item reveal" data-tone="${esc(s.tone || toneAt(s.time))}">
          <time class="schedule__time">${esc(s.time)}</time>
          <div>
            <p class="schedule__what">${esc(s.label)}</p>
            ${s.place ? `<p class="schedule__where">${esc(s.place)}</p>` : ""}
          </div>
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}
