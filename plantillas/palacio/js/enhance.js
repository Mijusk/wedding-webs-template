import { isPreview } from "./config.js";
import { doorArt } from "./deco.js";
import { esc } from "./format.js";

// Las puertas Déco de la entrada. Son una capa encima de la web (fuera de main, que en la
// vista previa se vuelve a pintar entero): salen una sola vez por carga de página y
// después enhance() no hace nada, aunque main.js lo llame en cada repintado.
const OPEN_AT = isPreview ? 250 : 450;   // pausa con las puertas cerradas
const GONE_AT = 2200;                     // puertas abiertas y retiradas (coincide con style.css)
const SETTLED_AT = 4000;                  // la portada ha terminado de entrar

let played = false;

export function enhance(main, config) {
  if (played) return;
  played = true;
  const root = document.documentElement;
  // Sin animaciones: ni puertas ni entrada de la portada.
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { root.classList.add("is-settled"); return; }

  const [a, b] = config.event.couple;
  const mono = [a, b].map((n) => esc([...String(n).trim()][0] || "")).join("<span>&amp;</span>");
  const leaf = (side) => `
    <div class="door door--${side}">
      <div class="door__art">${doorArt()}<p class="door__mono">${mono}</p></div>
    </div>`;

  const doors = document.createElement("div");
  doors.className = "doors";
  doors.setAttribute("aria-hidden", "true");
  doors.innerHTML = leaf("l") + leaf("r");
  document.body.append(doors);
  root.classList.add("is-doors");

  setTimeout(() => doors.classList.add("is-open"), OPEN_AT);
  setTimeout(() => { doors.remove(); root.classList.remove("is-doors"); }, GONE_AT);
  // A partir de aquí, repintar la vista previa no repite la entrada de la portada.
  setTimeout(() => root.classList.add("is-settled"), SETTLED_AT);
}
