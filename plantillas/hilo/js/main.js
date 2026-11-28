import { loadConfig, isPreview, onPreviewConfig } from "./config.js";
import * as sections from "./sections.js";
import { mountRsvp } from "./rsvp.js";
import { bindCopy } from "./copy.js";
import { startMotion } from "./motion.js";

// Registro de secciones: config.sections decide cuáles salen y en qué orden. Cada una es un tramo
// del hilo (js/motion.js los cose seguidos, de arriba abajo).
const SECTIONS = ["hero", "details", "story", "schedule", "dresscode", "gallery", "gifts", "closing"];

function render(config) {
  const main = document.getElementById("app");
  const [a, b] = config.event.couple;
  document.title = `${a} & ${b}`;
  if (config.locale) document.documentElement.lang = config.locale.split("-")[0];

  const legs = config.sections.filter((s) => SECTIONS.includes(s)).map((s) => sections[s](config)).join("");
  main.innerHTML = `
  <div class="page" id="top">${legs}
    <span class="needle" aria-hidden="true"><svg viewBox="-6 -4 44 8" width="44" height="8"><defs><linearGradient id="needle-steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3f4f5"/><stop offset=".5" stop-color="#a9adb3"/><stop offset="1" stop-color="#6d7178"/></linearGradient></defs><path d="M-5 0C-5-1.5-3.6-2.1-1.8-2.1L30-0.5 37 0 30 .5-1.8 2.1C-3.6 2.1-5 1.5-5 0Z" fill="url(#needle-steel)"/><path d="M-3.6 0C-3.6-.6-3-.8-2.4-.8H2.6C3.1-.8 3.4-.5 3.4 0S3.1.8 2.6.8H-2.4C-3 .8-3.6.6-3.6 0Z" fill="#f6f0e6"/></svg></span>
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
