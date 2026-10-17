import { isPreview } from "./config.js";

// Entrada de la portada: la esfera se dibuja, las estrellas se encienden de la más brillante
// a la más débil y se trazan las constelaciones (todo en CSS, ~2,5 s).
// En la vista previa del escaparate se vuelve a pintar todo con cada cambio: la entrada
// solo se reproduce la primera vez y después la portada sale ya montada.
// Sin listeners ni bucles: se puede llamar en cada repintado sin duplicar nada.
let played = false;

export function enhance(main) {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
  }
  meta.content = "#0D1424";

  const hero = main.querySelector(".hero");
  if (!hero) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || (isPreview && played)) {
    hero.classList.add("is-static");
    return;
  }
  played = true;
  const go = () => hero.classList.add("is-in");
  const fonts = document.fonts
    ? Promise.all(['400 1em "Cormorant"', 'italic 400 1em "Cormorant"', '400 1em "Cinzel"']
      .map((f) => document.fonts.load(f, hero.textContent))).catch(() => {})
    : Promise.resolve();
  // Con una conexión lenta no dejamos la portada a oscuras más de 0,8 s.
  Promise.race([fonts, new Promise((r) => setTimeout(r, 800))]).then(() => requestAnimationFrame(go));
}
