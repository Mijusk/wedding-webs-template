import { loadConfig, isPreview, onPreviewConfig } from "./config.js";
import * as sections from "./sections.js";
import { mountRsvp } from "./rsvp.js";
import { bindCopy } from "./copy.js";
import { startMotion } from "./motion.js";

// Registro de secciones: config.sections decide cuáles salen y en qué orden. Encima de todo
// caen unos pocos pétalos (.fall), que aparecen al dejar atrás la portada (js/motion.js).
const SECTIONS = ["hero", "details", "story", "schedule", "dresscode", "gallery", "gifts", "closing"];

// Pétalos que caen: posición, duración, retraso, tamaño y vaivén de cada uno (fijos, sin azar,
// para que la web se vea igual cada vez).
const FALL = [
  [8, 17, 0, 34, 1], [27, 21, 6, 26, 2], [46, 15, 11, 38, 3], [63, 19, 3, 30, 1],
  [79, 23, 9, 24, 2], [91, 18, 14, 32, 3], [36, 25, 17, 22, 1],
];

function render(config) {
  const main = document.getElementById("app");
  const [a, b] = config.event.couple;
  document.title = `${a} & ${b}`;
  if (config.locale) document.documentElement.lang = config.locale.split("-")[0];

  const parts = config.sections.filter((s) => SECTIONS.includes(s)).map((s) => sections[s](config)).join("");
  main.innerHTML = `
  <div class="garden" id="top">${parts}
  </div>
  ${sections.foot(config)}
  <div class="fall" aria-hidden="true"><div class="fall__wind">${FALL.map(([x, d, dl, s, v]) => `<i class="fall__p" style="--x:${x}vw;--d:${d}s;--dl:-${dl}s;--s:${s}px"><i class="p${v}"></i></i>`).join("")}</div></div>`;

  const rsvp = document.getElementById("rsvp");
  if (config.sections.includes("rsvp")) mountRsvp(rsvp, config);
  else rsvp.innerHTML = "";

  bindCopy(main);
  startMotion(main, config);
}

async function start() {
  if (isPreview) return onPreviewConfig(render);
  try {
    render(await loadConfig());
  } catch (e) {
    document.getElementById("app").innerHTML = `<p class="load-error">No se pudo cargar la invitación: ${e.message}</p>`;
  }
}
start();
