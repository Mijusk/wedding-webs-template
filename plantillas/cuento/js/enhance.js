import { isPreview } from "./config.js";

// Cuento: la tapa se abre sola (CSS, ~2,8 s) y no se repite; al abrirse se retira del todo.
// Tocarla la abre antes.
// En la vista previa del escaparate, a partir del segundo pintado, el libro sale ya abierto.
let introPlayed = false;

export function enhance(main) {
  const hero = main.querySelector(".hero");
  if (!hero) return;
  if ((isPreview && introPlayed) || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    hero.classList.add("is-static");
    introPlayed = true;
    return;
  }
  introPlayed = true;
  const cover = hero.querySelector(".cover");
  const done = () => { hero.classList.add("is-open"); cover?.remove(); };
  cover?.addEventListener("animationend", (e) => { if (e.target === cover) done(); });
  cover?.addEventListener("click", () => hero.classList.add("is-opening"), { once: true });
  setTimeout(done, 4200); // por si el navegador no avisa del final de la animación
}
