import { time, esc } from "../format.js";
import { toneAt } from "../tone.js";

export function story({ story, event, copy = {} }) {
  if (!story?.text) return "";
  return `
  <section class="section story" data-tone="${toneAt(time(event.date))}">
    <div class="wrap split">
      <p class="eyebrow">${esc(copy.story?.eyebrow)}</p>
      <p class="story__text reveal">${esc(story.text)}</p>
    </div>
  </section>`;
}
