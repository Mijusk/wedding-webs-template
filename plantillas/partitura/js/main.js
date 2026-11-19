import { loadConfig, isPreview, onPreviewConfig } from "./config.js";
import * as base from "./sections.js";
import * as look from "./look.js";
import { mountRsvp } from "./rsvp.js";
import { reveal } from "./reveal.js";
import { bindCopy } from "./copy.js";
import { enhance } from "./enhance.js";

// Registro de secciones: config.sections decide cuáles salen y en qué orden. Cada sección es
// una función (config, n) => html; la de js/look.js, si existe, manda sobre la de sections.js.
const SECTIONS = ["hero", "details", "story", "schedule", "dresscode", "gallery", "gifts", "closing"];
const sectionFor = (s) => (SECTIONS.includes(s) ? (typeof look[s] === "function" ? look[s] : base[s]) : null);

function render(config) {
  const main = document.getElementById("app");
  const [a, b] = config.event.couple;
  document.title = `${a} & ${b}`;
  if (config.locale) document.documentElement.lang = config.locale.split("-")[0];

  let n = 0;
  main.innerHTML = config.sections.map((s) => {
    const fn = sectionFor(s);
    if (!fn) return "";
    const html = fn(config, s === "hero" || s === "closing" ? n : ++n);
    if (!html && s !== "hero" && s !== "closing") n--;
    return html;
  }).join("");
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
