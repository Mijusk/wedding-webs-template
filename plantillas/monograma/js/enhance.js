import { isPreview } from "./config.js";

// La entrada de la portada (el marco se dibuja, las letras se aclaran) espera a que
// Bodoni Moda esté lista: así nunca se ve el monograma con la letra de reserva.
// En la vista previa del escaparate se vuelve a pintar todo con cada cambio de estilo:
// la entrada solo se reproduce la primera vez, después la portada sale ya montada.
let played = false;

export function enhance(main) {
  const hero = main.querySelector(".hero");
  if (!hero) return;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (still || (isPreview && played)) {
    hero.classList.add("is-static");
    return;
  }
  played = true;
  const go = () => hero.classList.add("is-in");
  const text = hero.textContent;
  const fonts = document.fonts
    ? Promise.all(['400 1em "Bodoni Moda"', 'italic 400 1em "Bodoni Moda"', '400 1em "Cormorant Garamond"', '400 1em "Tenor Sans"']
      .map((f) => document.fonts.load(f, text))).catch(() => {})
    : Promise.resolve();
  // Si la fuente tarda (conexión mala), no dejamos la portada en blanco más de 1,2 s.
  Promise.race([fonts, new Promise((r) => setTimeout(r, 1200))]).then(() => requestAnimationFrame(go));
}
