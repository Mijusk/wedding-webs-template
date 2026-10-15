import { dateParts, esc } from "./format.js";

// Entrada de la web (config.intro = "firma"): fondo liso, los nombres se escriben solos, la foto
// se abre desde un arco hasta ocupar la pantalla y la portada toma el relevo. ~3,8 s.
// Se salta con cualquier toque o tecla, sale una vez por visita (siempre en la vista previa
// del escaparate) y no sale si el invitado tiene las animaciones del sistema desactivadas.
const DURATION_MS = 3800;
let played = false;

export function intro(config, { preview = false } = {}) {
  if (config.intro !== "firma" || played) return;
  played = true;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!preview && seenThisVisit(config)) return;

  const { event, locale } = config;
  const [a, b] = event.couple;
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  const root = document.documentElement;
  const el = document.createElement("div");
  el.className = "intro";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <div class="intro__window"><img src="${esc(event.photo)}" alt=""${focus}></div>
    <div class="intro__card">
      <p class="intro__eyebrow">${esc(dateParts(event.date, locale).numeric)}</p>
      <p class="intro__names">${esc(a)}<span class="intro__amp">&amp;</span>${esc(b)}</p>
      <span class="intro__rule"></span>
    </div>
    <span class="intro__skip">${esc(config.copy?.intro?.skip || "Toca para entrar")}</span>`;
  document.body.append(el);
  root.classList.add("intro-on");

  // Con la foto aún sin cargar, el arco se abriría vacío: se espera un poco por ella.
  const img = el.querySelector("img");
  const ready = Promise.race([img.decode().catch(() => {}), new Promise((r) => setTimeout(r, 1200))]);
  let timer = 0;
  ready.then(() => {
    el.classList.add("is-playing");
    timer = setTimeout(finish, DURATION_MS);
  });

  function finish() {
    clearTimeout(timer);
    removeEventListener("keydown", finish);
    root.classList.remove("intro-on"); // arranca la animación de la portada mientras se funde
    el.classList.add("is-done");
    setTimeout(() => el.remove(), 800);
  }
  el.addEventListener("pointerdown", finish, { once: true });
  addEventListener("keydown", finish, { once: true });
}

function seenThisVisit({ event }) {
  const key = `intro:${event.couple.join("&")}`;
  try {
    if (sessionStorage.getItem(key)) return true;
    sessionStorage.setItem(key, "1");
  } catch { /* sin almacenamiento: sale siempre */ }
  return false;
}
