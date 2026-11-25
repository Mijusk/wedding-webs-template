import { loadConfig, isPreview, onPreviewConfig } from "./config.js";
import * as sections from "./sections.js";
import { mountRsvp } from "./rsvp.js";
import { reveal } from "./reveal.js";
import { bindCopy } from "./copy.js";
import { startMotion } from "./motion.js";

// Registro de secciones: config.sections decide cuáles salen y en qué orden. Cada sección es
// una función (config, n) => html.
const SECTIONS = ["hero", "details", "story", "schedule", "dresscode", "gallery", "gifts", "closing"];

function render(config) {
  const main = document.getElementById("app");
  const [a, b] = config.event.couple;
  document.title = `${a} & ${b}`;
  if (config.locale) document.documentElement.lang = config.locale.split("-")[0];

  let n = 0;
  main.innerHTML = config.sections.map((s) => {
    if (!SECTIONS.includes(s)) return "";
    const html = sections[s](config, s === "hero" || s === "closing" ? n : ++n);
    if (!html && s !== "hero" && s !== "closing") n--;
    return html;
  }).join("");
  const rsvp = document.getElementById("rsvp");
  if (config.sections.includes("rsvp")) mountRsvp(rsvp, config);
  else rsvp.innerHTML = "";

  reveal(main);
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
