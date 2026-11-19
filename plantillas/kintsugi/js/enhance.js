import { isPreview } from "./config.js";

// La entrada de la portada es CSS puro y se ve una vez. En la vista previa del escaparate la web
// se vuelve a pintar con cada cambio: a partir de la segunda vez la portada sale ya montada
// (.is-static, añadido antes del primer fotograma porque main.js llama aquí justo después de pintar).
let introPlayed = false;

export function enhance(main) {
  const hero = main.querySelector(".hero");
  if (!hero) return;
  if (isPreview && introPlayed) hero.classList.add("is-static");
  introPlayed = true;
}
