import { loadConfig, isPreview, onPreviewConfig } from "./config.js";
import { hero } from "./sections/hero.js";
import { story } from "./sections/story.js";
import { details } from "./sections/details.js";
import { schedule } from "./sections/schedule.js";
import { gifts } from "./sections/gifts.js";
import { closing } from "./sections/closing.js";
import { mountRsvp } from "./rsvp.js";
import { watchTone } from "./tone.js";
import { reveal } from "./reveal.js";
import { fitText } from "./fit.js";
import { bindCopy } from "./copy.js";
import { heroShape } from "./hero-shape.js";

// Registro de secciones: añadir galería, alojamiento, etc. es crear un archivo y registrarlo aquí.
const SECTIONS = { hero, story, details, schedule, gifts, closing };

// config.theme elige un archivo de css/themes/ que sobrescribe los tokens de css/theme.css.
function applyTheme(theme) {
  let link = document.getElementById("theme-variant");
  if (!theme || !/^[a-z0-9-]+$/.test(theme)) return link?.remove();
  if (!link) {
    link = Object.assign(document.createElement("link"), { id: "theme-variant", rel: "stylesheet" });
    document.head.append(link);
  }
  link.href = `css/themes/${theme}.css`;
}

// Se puede llamar varias veces (vista previa del generador): cada ayudante es idempotente.
function render(config) {
  const main = document.getElementById("app");
  const [a, b] = config.event.couple;
  document.title = `${a} & ${b}`;
  if (config.locale) document.documentElement.lang = config.locale.split("-")[0];
  applyTheme(config.theme);

  main.innerHTML = config.sections.filter((s) => SECTIONS[s]).map((s) => SECTIONS[s](config)).join("");
  const rsvp = document.getElementById("rsvp");
  if (config.sections.includes("rsvp")) mountRsvp(rsvp, config);
  else rsvp.innerHTML = "";

  heroShape(main);
  watchTone(main);
  reveal(main);
  fitText(main);
  bindCopy(main);
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
