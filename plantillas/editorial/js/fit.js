// Ajusta el texto de [data-fit] para que ocupe exactamente el ancho de su contenedor
// (la firma con los nombres al final de la página).
let els = [];
let watching = false;

function fit() {
  for (const el of els) {
    if (!el.isConnected) continue;
    const text = el.firstElementChild;
    el.style.fontSize = "100px";
    const ratio = el.clientWidth / text.getBoundingClientRect().width;
    el.style.fontSize = `${Math.floor(100 * ratio * 0.99)}px`;
  }
}

export function fitText(root) {
  els = [...root.querySelectorAll("[data-fit]")];
  if (!els.length) return;
  fit();
  if (watching) return;
  watching = true;
  // La cursiva de la firma se descarga al usarse: hay que volver a medir cuando llega.
  document.fonts?.ready.then(fit);
  document.fonts?.addEventListener("loadingdone", fit);
  new ResizeObserver(fit).observe(document.body);
}
