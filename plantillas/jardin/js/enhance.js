import { DEFS } from "./flowers.js";

// Jardín:
// 1. El filtro de papel de las flores (#jd-press) se añade una sola vez al documento,
//    fuera de main, que en la vista previa se vuelve a pintar entero.
// 2. La caída de las flores de la portada es CSS. En la vista previa del escaparate la web
//    se repinta con cada cambio: a partir del segundo render las flores salen ya posadas.
// 3. Con ratón (puntero fino) cada flor se mece un poco siguiéndolo. Un único listener y un
//    único bucle rAF para toda la página, que se para en cuanto las flores llegan a su sitio;
//    en cada render solo se renueva la lista de flores. En móvil quedan quietas.
let painted = false;
let flowers = [];
let bound = false;
let raf = 0;
const target = { x: 0, y: 0 }, now = { x: 0, y: 0 };

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function enhance(main) {
  if (!document.getElementById("jd-defs")) document.body.insertAdjacentHTML("afterbegin", DEFS);

  main.classList.toggle("is-replanted", painted);
  painted = true;

  flowers = [...main.querySelectorAll("[data-drift]")].map((el) => ({ el, k: Number(el.dataset.drift) || 1 }));
  if (reduced()) return;
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  if (!bound) {
    bound = true;
    addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" || !fine.matches) return;
      target.x = (e.clientX / innerWidth) * 2 - 1;
      target.y = (e.clientY / innerHeight) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(step);
    }, { passive: true });
  }
  apply();
}

function step() {
  now.x += (target.x - now.x) * .06;
  now.y += (target.y - now.y) * .06;
  apply();
  raf = Math.abs(target.x - now.x) + Math.abs(target.y - now.y) > .002 ? requestAnimationFrame(step) : 0;
}

function apply() {
  if (!now.x && !now.y) return;
  for (const { el, k } of flowers) {
    el.style.transform = `translate3d(${(now.x * 7 * k).toFixed(2)}px, ${(now.y * 5 * k).toFixed(2)}px, 0) rotate(${(now.x * 2.2 * k).toFixed(2)}deg)`;
  }
}
