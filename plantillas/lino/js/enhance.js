import { isPreview } from "./config.js";

// Lino: toda la entrada (fundidos lentos, la foto que se aclara) es CSS.
// En la vista previa del escaparate la web se vuelve a pintar con cada cambio de estilo:
// la entrada se ve la primera vez y después la portada sale ya montada.
// No añade listeners ni bucles, así que se puede llamar tantas veces como haga falta.
let introPlayed = false;

export function enhance(main) {
  const hero = main.querySelector(".hero");
  if (!hero) return;
  if (isPreview && introPlayed) hero.classList.add("is-static");
  introPlayed = true;
}
