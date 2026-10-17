import { isPreview } from "./config.js";

// Costa: la entrada (la ola cruza la pantalla, deja los nombres y se queda quieta como
// línea de horizonte) es CSS puro y no se repite. Aquí solo:
// - En la vista previa del escaparate la web se vuelve a pintar con cada cambio; la ola se ve
//   la primera vez y después la portada sale ya montada (.is-static, añadido antes del primer
//   fotograma porque main.js llama a enhance justo después de pintar).
// No añade listeners ni bucles: se puede llamar tantas veces como haga falta.
let introPlayed = false;

export function enhance(main) {
  const hero = main.querySelector(".hero");
  if (!hero) return;
  if (isPreview && introPlayed) hero.classList.add("is-static");
  introPlayed = true;
}
