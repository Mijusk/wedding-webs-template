// La página "atardece": cada sección (y cada hora del programa) lleva data-tone,
// y <html data-hour> toma el de la última marca que ha cruzado el centro de la pantalla.
// Los colores de cada hora están en css/theme.css.

// Hora "HH:MM" -> tono. Las horas de madrugada (antes de las 6) cuentan como noche.
export function toneAt(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const t = (h < 6 ? h + 24 : h) + (m || 0) / 60;
  if (t < 19) return "day";
  if (t < 20.5) return "dusk";
  if (t < 22) return "blue";
  return "night";
}

let marks = [];
let frame = 0;

function update() {
  frame = 0;
  if (!marks.length) return;
  const mid = innerHeight / 2;
  let tone = marks[0].dataset.tone;
  for (const el of marks) {
    if (el.getBoundingClientRect().top > mid) break;
    tone = el.dataset.tone;
  }
  const html = document.documentElement;
  if (html.dataset.hour !== tone) html.dataset.hour = tone;
}
const queue = () => { if (!frame) frame = requestAnimationFrame(update); };

export function watchTone(root) {
  if (!marks.length) {
    addEventListener("scroll", queue, { passive: true });
    addEventListener("resize", queue);
  }
  marks = [...root.querySelectorAll("[data-tone]")];
  update();
}
