import { isPreview } from "./config.js";
import { contours } from "./look.js";

// Cumbre:
// - Entrada (el sol con la foto sale detrás de las cimas) en CSS, una vez; en la vista previa,
//   a partir del segundo pintado, la portada sale ya montada (.is-static).
// - Paralaje: cada cordillera de la portada baja a su velocidad al hacer scroll.
//   Un solo listener para toda la vida de la página.
// - Curvas de nivel de fondo en la historia (se añaden aquí para no ensuciar el HTML de sections.js).
let introPlayed = false;
let bound = false;

function parallax() {
  const hero = document.querySelector(".hero");
  if (!hero) return;
  const y = Math.min(scrollY, innerHeight);
  hero.querySelectorAll(".ridge").forEach((r) => {
    r.style.transform = `translateY(${(y * (0.22 - r.dataset.depth * 0.06)).toFixed(1)}px)`;
  });
  const sun = hero.querySelector(".hero__sun");
  if (sun) sun.style.translate = `0 ${(y * 0.35).toFixed(1)}px`;
}

export function enhance(main) {
  const hero = main.querySelector(".hero");
  if (hero && isPreview && introPlayed) hero.classList.add("is-static");
  introPlayed = true;
  const story = main.querySelector(".story");
  if (story && !story.querySelector(".contours")) story.insertAdjacentHTML("afterbegin", contours(5, "story__contours"));
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  parallax();
  if (bound) return;
  bound = true;
  let queued = false;
  addEventListener("scroll", () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; parallax(); });
  }, { passive: true });
}
