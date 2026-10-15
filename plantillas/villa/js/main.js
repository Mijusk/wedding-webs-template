import { loadConfig, isPreview, onPreviewConfig } from "./config.js";
import * as sections from "./sections.js";
import { mountRsvp } from "./rsvp.js";
import { reveal } from "./reveal.js";
import { bindCopy } from "./copy.js";
import { enhance } from "./enhance.js";

// Registro de secciones: cada una es una función (config) => html exportada en sections.js.
// config.sections decide cuáles salen y en qué orden.
function render(config) {
  const main = document.getElementById("app");
  const [a, b] = config.event.couple;
  document.title = `${a} & ${b}`;
  if (config.locale) document.documentElement.lang = config.locale.split("-")[0];

  main.innerHTML = config.sections.filter((s) => typeof sections[s] === "function").map((s) => sections[s](config)).join("");
  const rsvp = document.getElementById("rsvp");
  if (config.sections.includes("rsvp")) mountRsvp(rsvp, config);
  else rsvp.innerHTML = "";

  reveal(main);
  bindCopy(main);
  enhance(main, config);
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
