import { $ } from "./util.js";
import { showInFrame } from "./preview.js";

// Portada: según escriben sus nombres, el móvil de al lado ya es su web. Solo cambian los
// nombres (el resto es la web de ejemplo tal cual); al pulsar, sigue el paso a paso con ellos.
export function setupQuick({ style, url, withTheme, onStart }) {
  const form = $("#quick"), a = $("#q-a"), b = $("#q-b"), frame = $("#intro-frame");
  let base = null, timer = 0, shown = "";

  const names = () => [a.value.trim(), b.value.trim()];
  const paint = async (force = false) => {
    const [x, y] = names();
    const key = `${x}|${y}`;
    if (key === shown && !force) return;
    shown = key;
    base ||= await withTheme(style);
    const config = structuredClone(base);
    const couple = [x || base.event.couple[0], y || base.event.couple[1]];
    config.event.couple = couple;
    config.event.photoAlt = couple.join(" y ");
    showInFrame(frame, url, config);
    frame.title = `Vuestra web: ${couple.join(" y ")}`;
  };
  // En pantallas grandes el móvil queda por debajo del pliegue: con la primera letra, la página
  // baja lo justo para verlo sin perder de vista el campo. En el móvil no (el teclado manda).
  let revealed = false;
  const reveal = () => {
    if (revealed || !matchMedia("(min-width: 701px)").matches) return;
    revealed = true;
    const phone = frame.closest(".phone").getBoundingClientRect(), box = form.getBoundingClientRect();
    const need = phone.top + phone.height * 0.82 - innerHeight;
    if (need > 0) scrollBy({ top: Math.min(need, box.top - 90), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  const later = () => { reveal(); clearTimeout(timer); timer = setTimeout(() => paint().catch(() => {}), 450); }; // en cuanto hacen una pausa, no a cada letra
  a.addEventListener("input", later);
  b.addEventListener("input", later);
  // Enter en el primer nombre pasa al segundo, no envía.
  a.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); b.focus(); } });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    onStart(names());
  });
  // En el móvil el teclado taparía el móvil de la portada: tocar un nombre abre el paso a paso a
  // pantalla completa, con la web en grande encima y el teclado ya en ese nombre. Va con un botón
  // por encima de los campos (solo se ve en el móvil, ver .quick__tap): el foco que se da en su
  // clic es el que deja al iPhone abrir el teclado en el paso a paso.
  $("#quick-tap")?.addEventListener("click", (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    onStart(names(), e.clientX > r.left + r.width / 2 ? "b" : "a");
  });
  return { paint };
}
