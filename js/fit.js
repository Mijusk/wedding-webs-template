// Ajusta el texto de [data-fit] para que ocupe exactamente el ancho de su contenedor
// (la firma con los nombres al final de la página).
export function fitText(root) {
  const els = [...root.querySelectorAll("[data-fit]")];
  if (!els.length) return;

  const fit = () => {
    for (const el of els) {
      const text = el.firstElementChild;
      el.style.fontSize = "100px";
      const ratio = el.clientWidth / text.getBoundingClientRect().width;
      el.style.fontSize = `${Math.floor(100 * ratio * 0.99)}px`;
    }
  };

  fit();
  // La cursiva de la firma se descarga al usarse: hay que volver a medir cuando llega.
  document.fonts?.ready.then(fit);
  document.fonts?.addEventListener("loadingdone", fit);
  new ResizeObserver(fit).observe(document.body);
}
