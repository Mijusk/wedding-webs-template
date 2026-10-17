import { isPreview } from "./config.js";
import { dateParts, esc } from "./format.js";
import { bow } from "./toile.js";

// 1) La entrada: la web llega envuelta en tela de Jouy con una cinta cruzada y un lazo.
//    El lazo se deshace y las dos mitades de la tela se abren hacia los lados (~2 s).
//    Es una capa encima de main (que la vista previa vuelve a pintar entera), así que se crea
//    una sola vez por carga de página y no vuelve a salir aunque enhance() se llame otra vez.
// 2) Paralaje muy suave del estampado en las bandas y fondos [data-parallax]: un único par
//    de listeners y un único rAF, que buscan los elementos en cada fotograma.

const DELAY_MS = isPreview ? 400 : 900;   // el lazo se ve atado un momento
const OPEN_MS = 1750;                      // deshacer + abrir (coincide con style.css)

let state = "idle";   // idle → wrapped → opening → open
let stage = null;
let timer = 0;
let parallaxBound = false;
let frame = 0;

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function enhance(main, config) {
  if (reduced()) { state = "open"; return; }
  if (state === "idle") wrap(main, config);
  else if (state === "wrapped") label(config);
  bindParallax();
  queue();
}

function wrap(main, config) {
  state = "wrapped";
  document.documentElement.classList.add("is-wrapped");
  stage = document.createElement("div");
  stage.className = "wrapping";
  stage.setAttribute("aria-hidden", "true");
  stage.innerHTML = `
    <div class="wrapping__half wrapping__half--l"><span class="ribbon ribbon--h"></span><span class="ribbon ribbon--v"></span></div>
    <div class="wrapping__half wrapping__half--r"><span class="ribbon ribbon--h"></span><span class="ribbon ribbon--v"></span></div>
    <div class="wrapping__tag"></div>
    <div class="wrapping__knot">${bow("wrapping__bow")}</div>`;
  document.body.append(stage);
  label(config);
  stage.addEventListener("click", () => open(main));
  timer = setTimeout(() => open(main), DELAY_MS);
}

// Etiqueta colgada de la cinta con los nombres (cambia si llegan datos nuevos en la vista previa).
function label({ event, locale }) {
  const [a, b] = event.couple;
  stage.querySelector(".wrapping__tag").innerHTML =
    `<p class="wrapping__names">${esc(a)} <span class="amp">&amp;</span> ${esc(b)}</p><p class="caps">${esc(dateParts(event.date, locale).numeric)}</p>`;
}

function open(main) {
  if (state !== "wrapped") return;
  state = "opening";
  clearTimeout(timer);
  scrollTo(0, 0);
  stage.classList.add("is-open");
  // La tarjeta de la portada asoma mientras se abre la tela.
  setTimeout(() => document.documentElement.classList.remove("is-wrapped"), 450);
  setTimeout(() => {
    stage.remove();
    stage = null;
    state = "open";
    document.documentElement.classList.remove("is-wrapped");
  }, OPEN_MS);
}

function bindParallax() {
  if (parallaxBound) return;
  parallaxBound = true;
  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", queue, { passive: true });
}

function queue() {
  if (!frame) frame = requestAnimationFrame(update);
}

function update() {
  frame = 0;
  const vh = innerHeight;
  for (const el of document.querySelectorAll("[data-parallax]")) {
    const r = el.getBoundingClientRect();
    if (r.bottom < -100 || r.top > vh + 100) continue;
    // Desplazamiento proporcional a la distancia al centro de la pantalla: pocos píxeles.
    const shift = (r.top + r.height / 2 - vh / 2) * 0.12;
    el.style.backgroundPositionY = `${shift.toFixed(1)}px`;
  }
}
