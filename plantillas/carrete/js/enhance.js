import { isPreview } from "./config.js";

// Carrete: entrada de la portada. El carrete avanza un fotograma y la foto se revela de
// negativo a positivo (las animaciones están en CSS, dentro de prefers-reduced-motion).
// Aquí solo se decide cuándo arrancan: cuando la foto ya está cargada, para que el revelado
// no ocurra sobre un hueco vacío.
// - Con "reducir movimiento" no se anima nada: la portada sale ya revelada.
// - En la vista previa del escaparate la web se repinta con cada cambio; la entrada se ve la
//   primera vez y después la portada sale ya montada.
// No deja listeners ni bucles vivos: se puede llamar tantas veces como haga falta.
let introPlayed = false;
const INTRO_MS = 2600;

export function enhance(main) {
  const hero = main.querySelector(".hero");
  if (!hero) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || (isPreview && introPlayed)) return;
  introPlayed = true;

  // Mismo tick que el innerHTML de main.js: el navegador no llega a pintar la portada revelada.
  hero.classList.add("is-intro");
  const img = hero.querySelector(".film__frame--main img");
  let started = false;
  const play = () => {
    if (started || !hero.isConnected) return;
    started = true;
    hero.classList.add("is-play");
    setTimeout(() => hero.classList.remove("is-intro", "is-play"), INTRO_MS);
  };
  if (!img || img.complete) requestAnimationFrame(() => requestAnimationFrame(play));
  else {
    img.addEventListener("load", play, { once: true });
    img.addEventListener("error", play, { once: true });
  }
  // Si la foto tarda (conexión lenta), no dejamos al invitado mirando un negativo.
  setTimeout(play, 1600);
}
