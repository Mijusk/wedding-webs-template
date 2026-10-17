import { isPreview } from "./config.js";

// Capilla: la entrada (la luz que entra por el arco y el rosetón trazo a trazo) es CSS puro.
// Aquí solo:
// 1. En la vista previa del escaparate la web se vuelve a pintar con cada cambio; la entrada
//    se ve la primera vez y después la portada sale ya montada (.is-static).
// 2. Ajustar las iniciales del rosetón cuando ya está cargada Cinzel, para que cualquier
//    pareja de letras quepa en el medallón central.
// No añade listeners ni bucles: se puede llamar tantas veces como haga falta.
let introPlayed = false;
const MAX_MONO = 40; // ancho máximo de las iniciales dentro del medallón (unidades del viewBox)

export function enhance(main) {
  const hero = main.querySelector(".hero");
  if (hero && isPreview && introPlayed) hero.classList.add("is-static");
  introPlayed = true;

  fitMonograms(main);
  document.fonts?.ready.then(() => fitMonograms(main));
}

function fitMonograms(root) {
  for (const text of root.querySelectorAll(".rose__mono")) {
    if (!text.isConnected) continue;
    text.style.scale = "";
    let w = 0;
    try { w = text.getBBox().width; } catch { continue; }
    if (w > MAX_MONO) text.style.scale = (MAX_MONO / w).toFixed(3);
  }
}
