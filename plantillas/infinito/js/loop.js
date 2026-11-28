// Bucle de movimiento común: un solo listener de scroll, requestAnimationFrame y medidas solo
// cuando cambia el tamaño de verdad. Cada plantilla le pasa dos funciones:
//   measure({ vw, vh })            -> lee tamaños y posiciones (nunca escribe estilos que muevan nada)
//   frame({ y, vw, vh, t, dt })    -> escribe transform/opacity a partir de la posición del scroll
// Con la rueda del ratón la posición se suaviza un poco (inercia), para que lo que depende del
// scroll se mueva fluido aunque la rueda vaya a saltos. En el móvil se usa tal cual: el dedo ya es fino.
// Con «reducir movimiento» del sistema, html lleva .is-still y la plantilla no debería mover nada.

const stillQuery = matchMedia("(prefers-reduced-motion: reduce)");
export const isStill = () => stillQuery.matches;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut = (t) => 1 - (1 - t) ** 3;
export const easeInOut = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
// Progreso 0..1 de x entre a y b, sin curva.
export const span = (a, b, x) => clamp((x - a) / (b - a || 1));

let scene = null;
let bound = false;
let queued = false;
let measureQueued = false;
let y = 0;
let wheel = false;
let lastT = 0;
let size = { vw: 0, vh: 0 };

const viewport = () => ({ vw: document.documentElement.clientWidth, vh: innerHeight });

function frame(t) {
  queued = false;
  if (!scene) return;
  const target = scrollY;
  const dt = lastT ? Math.min(64, t - lastT) : 16;
  lastT = t;
  // Inercia solo con rueda: alcanza el destino en ~0,2 s sin pasarse.
  if (wheel && !isStill()) {
    y += (target - y) * (1 - Math.exp(-dt / 70));
    if (Math.abs(target - y) < 0.4) y = target;
  } else y = target;
  scene.frame({ y, vw: size.vw, vh: size.vh, t, dt });
  if (y !== target || scene.animating?.()) request();
  else lastT = 0;
}

export function request() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(frame);
}

function measure() {
  measureQueued = false;
  if (!scene) return;
  size = viewport();
  document.documentElement.classList.toggle("is-still", isStill());
  scene.measure?.(size);
  y = scrollY;
  request();
}

export function remeasure() {
  if (measureQueued) return;
  measureQueued = true;
  requestAnimationFrame(measure);
}

// La barra del navegador del móvil cambia el alto al bajar: eso no obliga a volver a medir
// (los escenarios fijos usan 100svh). Sí un cambio de ancho o de alto grande (girar el móvil).
function onResize() {
  const next = viewport();
  const coarse = matchMedia("(pointer: coarse)").matches;
  if (coarse && next.vw === size.vw && Math.abs(next.vh - size.vh) < 160) { size.vh = next.vh; return request(); }
  remeasure();
}

// Cada vez que la web se pinta (también en la vista previa del escaparate) se llama de nuevo.
export function run(next, root) {
  scene = next;
  y = scrollY;
  measure();
  root?.querySelectorAll("img").forEach((img) => { if (!img.complete) img.addEventListener("load", remeasure, { once: true }); });
  document.fonts?.ready.then(remeasure);
  if (bound) return;
  bound = true;
  addEventListener("scroll", request, { passive: true });
  addEventListener("resize", onResize);
  addEventListener("wheel", () => { wheel = true; }, { passive: true });
  addEventListener("touchstart", () => { wheel = false; }, { passive: true });
  addEventListener("keydown", () => { wheel = false; });
  stillQuery.addEventListener?.("change", () => { scene?.reset?.(); remeasure(); });
  if ("ResizeObserver" in window) {
    let last = 0;
    new ResizeObserver(() => { const h = document.getElementById("app")?.offsetHeight || 0; if (h !== last) { last = h; remeasure(); } })
      .observe(document.getElementById("app"));
  }
}
