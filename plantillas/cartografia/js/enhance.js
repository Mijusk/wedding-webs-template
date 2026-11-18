import { isPreview } from "./config.js";

// Cartografía:
// - La entrada (la rosa busca el norte y la ruta se dibuja) es CSS y se ve una vez; en la vista
//   previa del escaparate, a partir del segundo pintado, la portada sale ya montada (.is-static).
// - El itinerario se traza al bajar: --p (0 a 1) en .plan según cuánto se ha recorrido.
//   Un solo listener de scroll para toda la vida de la página, aunque se pinte muchas veces.
let introPlayed = false;
let bound = false;

function track() {
  const plan = document.querySelector(".plan");
  if (!plan) return;
  const r = plan.getBoundingClientRect();
  const p = Math.min(1, Math.max(0, (innerHeight * 0.7 - r.top) / r.height));
  plan.style.setProperty("--p", p.toFixed(3));
}

export function enhance(main) {
  const hero = main.querySelector(".hero");
  if (hero && isPreview && introPlayed) hero.classList.add("is-static");
  introPlayed = true;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    main.querySelector(".plan")?.style.setProperty("--p", "1");
    return;
  }
  track();
  if (bound) return;
  bound = true;
  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; track(); });
  };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll, { passive: true });
}
