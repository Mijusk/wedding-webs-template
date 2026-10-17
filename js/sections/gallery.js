import { esc } from "../format.js";

// config.gallery: lista de fotos (rutas o data URLs). Sin fotos, la sección no se pinta.
export function gallery({ gallery = [], event }) {
  if (!gallery.length) return "";
  const [a, b] = event.couple;
  return `
  <section class="gallery" aria-label="Fotos">
    <p class="eyebrow">Nosotros</p>
    <div class="gallery__grid" data-count="${Math.min(gallery.length, 4)}">
      ${gallery.slice(0, 4).map((src, i) => `
        <figure><img src="${esc(src)}" alt="${esc(`${a} y ${b}, foto ${i + 2}`)}" loading="lazy"></figure>`).join("")}
    </div>
  </section>`;
}
