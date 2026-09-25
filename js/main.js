import { loadConfig } from "./config.js";
import { hero } from "./sections/hero.js";
import { details } from "./sections/details.js";
import { schedule } from "./sections/schedule.js";
import { mountRsvp } from "./rsvp.js";

// Registro de secciones: añadir galería, regalos, etc. es crear un archivo y registrarlo aquí.
const SECTIONS = { hero, details, schedule };

async function start() {
  const main = document.getElementById("app");
  try {
    const config = await loadConfig();
    const [a, b] = config.event.couple;
    document.title = `${a} & ${b}`;
    main.innerHTML = config.sections.filter((s) => SECTIONS[s]).map((s) => SECTIONS[s](config)).join("");
    if (config.sections.includes("rsvp")) mountRsvp(document.getElementById("rsvp"), config);
  } catch (e) {
    main.innerHTML = `<p class="error">No se pudo cargar la invitación: ${e.message}</p>`;
  }
}
start();
