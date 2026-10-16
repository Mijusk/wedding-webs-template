import { tileDefs } from "./tile.js";

// Azulejo: la entrada (azulejos del marco colocándose uno a uno) es CSS puro. Aquí solo:
// 1. Poner en <body> una vez el dibujo del azulejo (<symbol>, esmalte y brillo) al que
//    apuntan todas las piezas con <use>. Va fuera de main porque main se repinta.
// 2. En la vista previa del escaparate la web se repinta con cada cambio: la entrada se ve
//    la primera vez y después la portada sale ya montada (.is-static).
// 3. Encajar las iniciales del azulejo central cuando Fraunces ya está cargada.
// Sin listeners ni bucles: se puede llamar tantas veces como haga falta.
let introPlayed = false;
const MAX_MONO = 50; // ancho máximo de las iniciales dentro del círculo (unidades del viewBox)

export function enhance(main) {
  if (!document.getElementById("az-defs")) document.body.insertAdjacentHTML("afterbegin", tileDefs());

  const hero = main.querySelector(".hero");
  if (hero && introPlayed) hero.classList.add("is-static");
  if (hero) introPlayed = true;

  fitMonograms(main);
  document.fonts?.ready.then(() => fitMonograms(main));
}

function fitMonograms(root) {
  for (const text of root.querySelectorAll(".mono__txt")) {
    if (!text.isConnected) continue;
    text.style.scale = "";
    let w = 0;
    try { w = text.getBBox().width; } catch { continue; }
    if (w > MAX_MONO) text.style.scale = (MAX_MONO / w).toFixed(3);
  }
}
