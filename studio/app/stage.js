import { $, esc, sleep, syncScrollLock } from "./util.js";
import { showInFrame } from "./preview.js";

// Pantalla de resultado: la web a tamaño real, con cambio de estilo instantáneo y secciones que
// se encienden y apagan al momento.
let state = null; // { wedding (null en los ejemplos), style, config }
let ctx = null;
const off = new Set(); // secciones apagadas; se mantienen al cambiar de estilo o editar datos

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

  $("#sections-note").textContent = studio.sections?.note || "";
  $("#stage-sections").addEventListener("click", () => toggleSectionsPanel());
  $("#sections-close").addEventListener("click", () => toggleSectionsPanel(false));
  $("#sections-list").addEventListener("change", (e) => {
    const input = e.target.closest("input[data-section]");
    if (!input) return;
    input.checked ? off.delete(input.dataset.section) : off.add(input.dataset.section);
    state = { ...state, config: withSections(state.config) };
    showInFrame($("#stage-frame"), ctx.studio.templates[state.style.template].url, state.config);
  });
}

// El config de la plantilla con las secciones apagadas fuera. Se parte siempre de la lista
// completa de la plantilla, para poder volver a encenderlas.
function withSections(config) {
  const list = ctx.studio.sections?.list || {};
  const all = config.allSections || config.sections;
  return { ...config, allSections: all, sections: all.filter((id) => list[id]?.fixed || !off.has(id)) };
}

function renderSectionsList() {
  const list = ctx.studio.sections?.list || {};
  const ids = state.config.allSections.filter((id) => list[id]);
  $("#sections-list").innerHTML = ids.map((id) => {
    const { name, hint, fixed } = list[id];
    return `
    <li>
      <label class="switch${fixed ? " is-fixed" : ""}">
        <span><strong>${esc(name)}</strong>${fixed ? "<small>Siempre</small>" : hint ? `<small>${esc(hint)}</small>` : ""}</span>
        <input type="checkbox" role="switch" data-section="${esc(id)}" ${fixed || !off.has(id) ? "checked" : ""} ${fixed ? "disabled" : ""}>
        <span class="switch__track" aria-hidden="true"></span>
      </label>
    </li>`;
  }).join("");
}

export function toggleSectionsPanel(open = $("#sections-panel").hidden) {
  $("#sections-panel").hidden = !open;
  $("#stage-sections").setAttribute("aria-expanded", String(open));
  if (open) $("#sections-list input:not(:disabled)")?.focus();
  return !open;
}

// Carga el iframe antes de mostrarlo, para que la web ya esté pintada al acabar la barra.
// wedding = null muestra el ejemplo de la plantilla.
export function prepareStage(wedding, style) {
  const demo = !wedding;
  state = { wedding, style, config: withSections(ctx.configFor(style, wedding)) };
  renderSectionsList();
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
  toggleSectionsPanel(false);
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
  state = { ...state, style, config: withSections(ctx.configFor(style, state.wedding)) };
  renderSectionsList();
  markStyle();
  const ready = showInFrame($("#stage-frame"), ctx.studio.templates[style.template].url, state.config);
  await Promise.all([ready, sleep(ctx.studio.generator.switchMs)]);
  overlay.hidden = true;
}
