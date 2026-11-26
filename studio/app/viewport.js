// El teclado del móvil. En el iPhone (y en Android, por defecto) abrir el teclado no encoge la
// página: la tapa por abajo y desplaza la vista para enseñar el campo. Las capas a pantalla
// completa (paso a paso, guardar la web) quedaban medio debajo del teclado y la vista previa se
// iba por arriba. Aquí se mide lo que de verdad se ve (visualViewport) y se deja en CSS:
//   --vv-h    alto que se ve, sin el teclado
//   --vv-top  cuánto ha desplazado el navegador la vista al enfocar un campo
//   html.has-kb  teclado abierto: los pasos se compactan para que quepa todo encima.
// Solo con una capa abierta (body.locked): mientras se baja por la página no hace nada.
const root = document.documentElement;
let refresh = () => {};
const TEXT = "input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=button]):not([type=submit]), textarea";

// Al abrir o cerrar una capa (util.js > syncScrollLock), para medir enseguida.
export const refreshViewport = () => refresh();

export function watchViewport() {
  const vv = window.visualViewport;
  if (!vv) return;
  let full = 0, width = 0, raf = 0, last = "";

  const sync = () => {
    raf = 0;
    const locked = document.body.classList.contains("locked");
    const zoomed = Math.abs(vv.scale - 1) > 0.01; // con zoom de dos dedos, mejor no tocar nada
    if (innerWidth !== width) { width = innerWidth; full = 0; } // al girar el móvil, nueva medida
    if (!zoomed) full = Math.max(full, vv.height);
    const typing = document.activeElement?.matches?.(TEXT);
    const keyboard = locked && !zoomed && typing && full - vv.height > 120;
    const next = locked && !zoomed ? `${Math.round(vv.height)}|${Math.round(vv.offsetTop)}|${keyboard}` : "";
    if (next === last) return;
    last = next;
    if (next) {
      root.style.setProperty("--vv-h", `${Math.round(vv.height)}px`);
      root.style.setProperty("--vv-top", `${Math.round(vv.offsetTop)}px`);
    } else {
      root.style.removeProperty("--vv-h");
      root.style.removeProperty("--vv-top");
    }
    root.classList.toggle("has-kb", Boolean(keyboard));
  };
  const later = () => { if (!raf) raf = requestAnimationFrame(sync); };
  vv.addEventListener("resize", later);
  vv.addEventListener("scroll", later);
  addEventListener("focusin", later);
  // Al cerrar el teclado el foco se va antes de que la vista crezca: se mira otra vez después.
  addEventListener("focusout", () => { later(); setTimeout(later, 300); });
  refresh = sync;
  sync();
}
