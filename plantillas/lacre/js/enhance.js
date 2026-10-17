import { isPreview } from "./config.js";
import { dateParts, esc, fill } from "./format.js";
import { sealSvg } from "./seal.js";

// El sobre de la entrada. Es una capa encima de la web (no forma parte de main, que se
// vuelve a pintar entero en la vista previa): se crea una sola vez por carga de página y,
// una vez abierto, no vuelve a salir aunque main.js llame otra vez a enhance().
const OPEN_MS = 2550;     // duración total de la apertura (coincide con style.css)
const UNSEAL_MS = 1750;   // momento en que arranca la entrada de la portada
const AUTO_MS = isPreview ? 800 : 3000;

let state = "idle";       // idle → sealed → opening → open
let stage = null;
let autoTimer = 0;

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function enhance(main, config) {
  if (state === "open") return;
  if (state === "idle") {
    if (reduced()) { state = "open"; return; }
    seal(main, config);
  } else if (state === "sealed") {
    // Vista previa: han cambiado los datos con el sobre aún cerrado.
    fillStage(config);
  }
  main.inert = true;
}

function seal(main, config) {
  state = "sealed";
  document.documentElement.classList.add("is-sealed");
  stage = document.createElement("div");
  stage.className = "stage";
  document.body.append(stage);
  fillStage(config);

  // Un solo juego de listeners: el contenido de stage puede cambiar, stage no.
  stage.addEventListener("click", (e) => {
    if (e.target.closest(".env, .stage__hint")) open(main);
  });
  autoTimer = setTimeout(() => open(main), AUTO_MS);
}

function fillStage({ event, locale, copy = {} }) {
  const [a, b] = event.couple;
  const t = copy.envelope || {};
  const d = dateParts(event.date, locale);
  const label = fill(t.label || "Invitación de {a} y {b}", { a, b });
  stage.setAttribute("role", "region");
  stage.setAttribute("aria-label", label);
  stage.innerHTML = `
    <div class="stage__inner">
      <div class="env" aria-hidden="true">
        <div class="env__back"></div>
        <div class="env__card">
          <span class="env__card-frame"></span>
          <p class="caps">${esc(t.eyebrow || copy.hero?.eyebrow || "")}</p>
          <p class="env__names">${esc(a)} <span>&amp;</span> ${esc(b)}</p>
          <p class="caps env__date">${esc(d.numeric)}</p>
        </div>
        <div class="env__layer env__layer--sides"><span class="env__side env__side--l"></span><span class="env__side env__side--r"></span></div>
        <div class="env__layer env__layer--bottom"><span class="env__bottom"></span></div>
        <div class="env__flapwrap"><div class="env__flap"><span class="env__flap-face"></span></div></div>
        <div class="env__seal">
          <span class="env__half env__half--l">${sealSvg(event.couple)}</span>
          <span class="env__half env__half--r">${sealSvg(event.couple)}</span>
          <svg class="env__crack" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M51 4 47 20 54 36 45 52 53 68 47 84 50 96" fill="none" stroke="#2a0409" stroke-width="1.6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>
        </div>
      </div>
      <button class="stage__hint caps" type="button">${esc(t.hint || "Toca el sello para abrir")}</button>
    </div>`;
}

function open(main) {
  if (state !== "sealed") return;
  state = "opening";
  clearTimeout(autoTimer);
  const hadFocus = stage.contains(document.activeElement);
  scrollTo(0, 0);
  stage.classList.add("is-opening");

  setTimeout(() => {
    document.documentElement.classList.remove("is-sealed");
    main.inert = false;
  }, UNSEAL_MS);

  setTimeout(() => {
    stage.remove();
    stage = null;
    state = "open";
    document.documentElement.classList.remove("is-sealed");
    main.inert = false;
    // Quien abrió con el teclado sigue en la invitación, no al principio del documento.
    if (hadFocus) {
      const h1 = main.querySelector("h1");
      if (h1) { h1.tabIndex = -1; h1.focus({ preventScroll: true }); }
    }
  }, OPEN_MS);
}
