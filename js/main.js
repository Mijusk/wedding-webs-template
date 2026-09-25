import { loadConfig } from "./config.js";
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

// Registro de secciones: añadir galería, alojamiento, etc. es crear un archivo y registrarlo aquí.
const SECTIONS = { hero, story, details, schedule, gifts, closing };

async function start() {
  const main = document.getElementById("app");
  try {
    const config = await loadConfig();
    const [a, b] = config.event.couple;
    document.title = `${a} & ${b}`;
    if (config.locale) document.documentElement.lang = config.locale.split("-")[0];

    main.innerHTML = config.sections.filter((s) => SECTIONS[s]).map((s) => SECTIONS[s](config)).join("");
    if (config.sections.includes("rsvp")) mountRsvp(document.getElementById("rsvp"), config);

    watchTone(main);
    reveal(main);
    fitText(main);
    bindCopy(main);
  } catch (e) {
    main.innerHTML = `<p class="load-error">No se pudo cargar la invitación: ${e.message}</p>`;
  }
}
start();
