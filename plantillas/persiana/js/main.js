import { loadConfig, isPreview, onPreviewConfig } from "./config.js";
import * as sections from "./sections.js";
import { mountRsvp } from "./rsvp.js";
import { bindCopy } from "./copy.js";
import { startMotion } from "./motion.js";

// Registro de secciones: config.sections decide cuáles salen y en qué orden. Cada pared lleva su
// mancha de sol y su sombra de olivo (las añade js/motion.js).
const SECTIONS = ["hero", "details", "story", "schedule", "dresscode", "gallery", "gifts", "closing"];

function render(config) {
  const main = document.getElementById("app");
  const [a, b] = config.event.couple;
  document.title = `${a} & ${b}`;
  if (config.locale) document.documentElement.lang = config.locale.split("-")[0];

  const parts = config.sections.filter((s) => SECTIONS.includes(s)).map((s) => sections[s](config)).join("");
  main.innerHTML = `
  <div class="house" id="top">${parts}
  </div>
  ${sections.foot(config)}`;

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
