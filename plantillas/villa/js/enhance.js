import { isPreview } from "./config.js";

// Villa: la entrada (escudo trazo a trazo, contraventanas, nombres) es CSS puro.
// Aquí solo:
// 1. En la vista previa del escaparate la web se vuelve a pintar con cada cambio de estilo;
//    la entrada se ve la primera vez y después la portada sale ya montada.
// 2. Ajustar el monograma del escudo cuando ya está cargada Bodoni, para que cualquier
//    pareja de iniciales quepa dentro de la corona.
// No añade listeners ni bucles: se puede llamar tantas veces como haga falta.
let introPlayed = false;
const MAX_MONO = 118; // ancho máximo del monograma dentro de la corona (unidades del viewBox)

export function enhance(main) {
  const hero = main.querySelector(".hero");
  if (hero && isPreview && introPlayed) hero.classList.add("is-static");
  introPlayed = true;

  fitMonograms(main);
  document.fonts?.ready.then(() => fitMonograms(main));
}

function fitMonograms(root) {
  for (const text of root.querySelectorAll(".crest__mono")) {
    if (!text.isConnected) continue;
    text.style.scale = "";
    let w = 0;
    try { w = text.getBBox().width; } catch { continue; }
    if (w > MAX_MONO) text.style.scale = (MAX_MONO / w).toFixed(3);
  }
}
