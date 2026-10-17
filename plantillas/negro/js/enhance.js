import { isPreview } from "./config.js";

// Negro: la portada llega en blanco y negro y la foto gana color a medida que se baja.
// El filtro lo pinta CSS (filter: grayscale(var(--mono))); aquí solo se calcula --mono
// en un requestAnimationFrame por fotograma con scroll.
// main.js puede llamar a enhance() muchas veces (vista previa): los listeners se ponen una
// sola vez y siempre miran la portada actual, que puede haber sido sustituida.
let hero = null;
let bound = false;
let ticking = false;
let introPlayed = false;

export function enhance(main) {
  hero = main.querySelector(".hero");
  if (!hero) return;

  // En la vista previa la entrada de los nombres se ve la primera vez; después, ya montada.
  if (isPreview && introPlayed) hero.classList.add("is-static");
  introPlayed = true;

  update();
  if (bound) return;
  bound = true;
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule, { passive: true });
}

function schedule() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { ticking = false; update(); });
}

// 1 = blanco y negro; 0 = color. Termina de ganar color cuando se ha bajado
// algo más de la mitad de la portada, para que el color se llegue a ver.
function update() {
  if (!hero?.isConnected) return;
  const h = hero.offsetHeight || innerHeight;
  const p = Math.min(1, Math.max(0, scrollY / (h * 0.6)));
  const eased = p * p * (3 - 2 * p); // smoothstep: arranca y acaba suave
  hero.style.setProperty("--mono", (1 - eased).toFixed(3));
}
