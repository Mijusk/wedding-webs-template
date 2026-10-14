import { time, esc } from "../format.js";
import { toneAt } from "../tone.js";

// La historia en capítulos: cada uno con su etiqueta (lugar, época...), su texto y, si quiere, una foto.
// Las fotos alternan de lado para que el scroll tenga ritmo.
// Capítulo sin foto: etiqueta en la columna estrecha y texto grande en la ancha.
// Con foto: la foto ocupa media página y la etiqueta y el texto, la otra mitad.
function chapter(c, i) {
  const meta = c.meta ? `<p class="label chapter__meta">${esc(c.meta)}</p>` : "<span></span>";
  const text = `<p class="chapter__text reveal" style="--i:1">${esc(c.text)}</p>`;
  if (!c.photo) return `<li class="chapter chapter--text">${meta}${text}</li>`;

  const focus = c.photoFocus ? ` style="object-position:${esc(c.photoFocus)}"` : "";
  return `
    <li class="chapter chapter--photo${i % 2 ? " chapter--flip" : ""}">
      <figure class="chapter__photo reveal"><img src="${esc(c.photo)}" alt="${esc(c.photoAlt)}"${focus} loading="lazy"></figure>
      <div class="chapter__copy">${meta}${text}</div>
    </li>`;
}

export function story({ story, event, copy = {} }) {
  const chapters = story?.chapters?.filter((c) => c.text) || [];
  if (!chapters.length) return "";
  return `
  <section class="section story" data-tone="${toneAt(time(event.date))}" aria-labelledby="story-title">
    <div class="wrap">
      <p class="eyebrow" id="story-title">${esc(copy.story?.eyebrow)}</p>
      <ol class="story__chapters">${chapters.map(chapter).join("")}</ol>
    </div>
  </section>`;
}
