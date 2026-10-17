import { isPreview } from "./config.js";

// Botánica: el dibujo de las láminas (trazo a trazo y después la aguada) es CSS puro.
// Las láminas de las secciones esperan en pausa mientras llevan .is-pending (js/reveal.js)
// y se dibujan al llegar a ellas.
// Aquí solo: en la vista previa del escaparate la web se vuelve a pintar con cada cambio;
// la entrada se ve la primera vez y después las láminas salen ya coloreadas.
// No añade listeners ni bucles: se puede llamar tantas veces como haga falta.
let played = false;

export function enhance(main) {
  if (isPreview && played) main.classList.add("is-static");
  played = true;
}
