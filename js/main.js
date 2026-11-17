import { loadConfig, isPreview, onPreviewConfig } from "./config.js";
import { hero } from "./sections/hero.js";
import { details } from "./sections/details.js";
import { gallery } from "./sections/gallery.js";
import { schedule } from "./sections/schedule.js";
import { mountRsvp } from "./rsvp.js";

// Registro de secciones: añadir galería, regalos, etc. es crear un archivo y registrarlo aquí.
const SECTIONS = { hero, details, gallery, schedule };

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

function render(config) {
  const [a, b] = config.event.couple;
  document.title = `${a} & ${b}`;
  applyTheme(config.theme);
  document.getElementById("app").innerHTML =
    config.sections.filter((s) => SECTIONS[s]).map((s) => SECTIONS[s](config)).join("");
  const rsvp = document.getElementById("rsvp");
  if (config.sections.includes("rsvp")) mountRsvp(rsvp, config);
  else rsvp.innerHTML = "";
}

async function start() {
  if (isPreview) return onPreviewConfig(render);
  try {
    render(await loadConfig());
  } catch (e) {
    document.getElementById("app").innerHTML = `<p class="error">No se pudo cargar la invitación: ${e.message}</p>`;
  }
}
start();
