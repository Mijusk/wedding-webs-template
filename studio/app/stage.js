import { $, esc, sleep, syncScrollLock } from "./util.js";
import { showInFrame } from "./preview.js";

// Pantalla de resultado: la web a tamaño real, con cambio de estilo instantáneo.
let state = null; // { wedding (null en los ejemplos), style, config }
let ctx = null;

export function setupStage(context) {
  ctx = context;
  const { studio } = ctx;
  const available = studio.styles.filter((s) => s.status === "available");

  $("#stage-styles").innerHTML = studio.styles.map((s) => `
    <button type="button" class="chip" role="radio" data-style="${esc(s.id)}" aria-checked="false"
      ${s.status !== "available" ? 'aria-disabled="true" title="Próximamente"' : ""}>
      <span class="swatch" style="--sw-a:${esc(s.swatch[0])};--sw-b:${esc(s.swatch[1])}"></span>${esc(s.name)}
    </button>`).join("");
  $("#stage-styles").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-style]");
    if (!btn || btn.getAttribute("aria-disabled") === "true") return;
    switchStyle(btn.dataset.style);
  });
  $("#stage-next").addEventListener("click", () => {
    const i = available.findIndex((s) => s.id === state.style.id);
    switchStyle(available[(i + 1) % available.length].id);
  });
  $("#stage-next").hidden = available.length < 2;

  const view = (mobile) => {
    $("#stage-frame-wrap").classList.toggle("is-mobile", mobile);
    $("#view-desktop").setAttribute("aria-pressed", !mobile);
    $("#view-mobile").setAttribute("aria-pressed", mobile);
  };
  $("#view-desktop").addEventListener("click", () => view(false));
  $("#view-mobile").addEventListener("click", () => view(true));
  if (matchMedia("(max-width: 560px)").matches) view(true);

  $("#stage-edit").addEventListener("click", () => { closeStage(); ctx.onEdit(state.style.id); });
  $("#stage-keep").addEventListener("click", () => { closeStage(); ctx.onKeep(state); });
  $("#stage-try").addEventListener("click", () => { closeStage(); ctx.onEdit(state.style.id); });
  $("#stage [data-close]").addEventListener("click", closeStage);
}

// Carga el iframe antes de mostrarlo, para que la web ya esté pintada al acabar la barra.
// wedding = null muestra el ejemplo de la plantilla.
export function prepareStage(wedding, style) {
  const demo = !wedding;
  state = { wedding, style, config: ctx.configFor(style, wedding) };
  const ready = showInFrame($("#stage-frame"), ctx.studio.templates[style.template].url, state.config);
  const [a, b] = state.config.event.couple;
  $("#stage-kind").textContent = demo ? "Web de ejemplo" : "Vuestra web";
  $("#stage-title").textContent = `${a} & ${b}`;
  $("#stage-edit").hidden = demo;
  $("#stage-keep").hidden = demo;
  $("#stage-try").hidden = !demo;
  markStyle();
  return ready;
}

export function openStage() {
  $("#stage").hidden = false;
  syncScrollLock();
  $("#stage [data-close]").focus();
}

export function closeStage() {
  if ($("#stage").hidden) return;
  $("#stage").hidden = true;
  syncScrollLock();
}

function markStyle() {
  document.querySelectorAll("#stage-styles [data-style]").forEach((b) =>
    b.setAttribute("aria-checked", b.dataset.style === state.style.id));
}

// Los datos ya están cargados: con la misma plantilla, cambiar de estilo es reenviar el config;
// con otra plantilla, el iframe carga la nueva y recibe los mismos datos.
async function switchStyle(id) {
  if (id === state.style.id) return;
  const style = ctx.studio.styles.find((s) => s.id === id);
  const overlay = $("#switching");
  $("#switching-msg").textContent = `Aplicando estilo ${style.name}…`;
  overlay.hidden = false;
  state = { ...state, style, config: ctx.configFor(style, state.wedding) };
  markStyle();
  const ready = showInFrame($("#stage-frame"), ctx.studio.templates[style.template].url, state.config);
  await Promise.all([ready, sleep(ctx.studio.generator.switchMs)]);
  overlay.hidden = true;
}
