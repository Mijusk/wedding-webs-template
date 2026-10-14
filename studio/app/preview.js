// Pinta una plantilla dentro de un iframe pasándole el config por postMessage
// (ver isPreview en js/config.js de la plantilla). El iframe avisa con "wedding:ready"
// al cargar; a partir de ahí, cambiar de config o de estilo es un mensaje, sin recargar.
const configs = new Map(); // iframe -> último config pedido

addEventListener("message", (e) => {
  if (e.data?.type !== "wedding:ready") return;
  for (const [frame, config] of configs) {
    if (frame.contentWindow !== e.source) continue;
    frame.dataset.ready = "1";
    send(frame, config);
  }
});

function send(frame, config) {
  frame.contentWindow?.postMessage({ type: "wedding:config", config }, "*");
}

export function showInFrame(frame, templateUrl, config) {
  configs.set(frame, config);
  const target = new URL(templateUrl, location.href);
  target.hash = "preview";
  if (frame.dataset.src === target.href && frame.dataset.ready) return send(frame, config);
  frame.dataset.ready = "";
  frame.dataset.src = target.href;
  frame.src = target.href;
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
