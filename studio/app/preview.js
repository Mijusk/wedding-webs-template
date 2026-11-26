// Pinta una plantilla dentro de un iframe pasándole el config por postMessage
// (ver isPreview en js/config.js de la plantilla). El iframe avisa con "wedding:ready"
// al cargar; a partir de ahí, cambiar de config o de estilo es un mensaje, sin recargar.
const configs = new Map(); // iframe -> último config pedido
const waiting = new Map(); // iframe -> { done, timer } de la promesa de showInFrame
const TIMEOUT_MS = 20000;  // con mala conexión: mejor un aviso que una espera sin fin

addEventListener("message", (e) => {
  if (e.origin !== location.origin || e.data?.type !== "wedding:ready") return;
  for (const [frame, config] of configs) {
    if (frame.contentWindow !== e.source) continue;
    frame.dataset.ready = "1";
    send(frame, config);
    waiting.get(frame)?.done();
  }
});

function send(frame, config) {
  frame.contentWindow?.postMessage({ type: "wedding:config", config }, location.origin);
}

// Devuelve una promesa que se cumple cuando la plantilla ya tiene el config, o falla si no llega a cargar.
export function showInFrame(frame, templateUrl, config) {
  configs.set(frame, config);
  const target = new URL(templateUrl, location.href);
  target.hash = "preview";
  if (frame.dataset.src === target.href && frame.dataset.ready) {
    send(frame, config);
    return Promise.resolve();
  }
  frame.dataset.ready = "";
  frame.dataset.src = target.href;
  frame.src = target.href;
  clearTimeout(waiting.get(frame)?.timer); // si se pide otra antes de acabar, manda la última
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiting.delete(frame);
      frame.dataset.src = ""; // para que otro intento la vuelva a cargar
      reject(new Error(`La plantilla no ha cargado a tiempo: ${target.pathname}`));
    }, TIMEOUT_MS);
    waiting.set(frame, { timer, done: () => { clearTimeout(timer); waiting.delete(frame); resolve(); } });
  });
}

// Miniaturas: el iframe se pinta a tamaño real (data-base-width/height) y se escala al hueco.
const observer = new ResizeObserver((entries) => {
  for (const { target } of entries) {
    const base = Number(target.dataset.baseWidth);
    target.style.setProperty("--s", target.clientWidth / base);
  }
});

export function fitScaled(box) {
  const frame = box.querySelector("iframe");
  frame.style.width = `${box.dataset.baseWidth}px`;
  frame.style.height = `${box.dataset.baseHeight}px`;
  observer.observe(box);
}
