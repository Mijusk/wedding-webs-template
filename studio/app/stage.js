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
  // Con ratón, la rueda vertical también desliza la fila de estilos.
  $("#stage-styles").addEventListener("wheel", (e) => {
    const row = e.currentTarget;
    if (row.scrollWidth <= row.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    row.scrollLeft += e.deltaY;
  }, { passive: false });
  setupDock(available);
  setupGuests();
  setupShare();

  const view = (mobile) => {
    $("#stage-frame-wrap").classList.toggle("is-mobile", mobile);
    $("#view-desktop").setAttribute("aria-pressed", !mobile);
    $("#view-mobile").setAttribute("aria-pressed", mobile);
  };
  $("#view-desktop").addEventListener("click", () => view(false));
  $("#view-mobile").addEventListener("click", () => view(true));
  if (matchMedia("(max-width: 560px)").matches) view(true);

  // Editar datos: encima de la propia web, sin salir de aquí (edit.js).
  $("#stage-edit").addEventListener("click", () => ctx.onEdit(state));
  // Volver a la cuadrícula con todos los estilos (picker.js).
  $("#stage-all").addEventListener("click", () => ctx.onAll(state));
  // Flechas del teclado: estilo anterior o siguiente (salvo escribiendo o con un panel abierto).
  document.addEventListener("keydown", (e) => {
    if ($("#stage").hidden || !["ArrowLeft", "ArrowRight"].includes(e.key) || e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.target.closest("input, textarea, select, [role=radiogroup], .seg") || !$("#send").hidden) return;
    e.preventDefault();
    stepStyle(e.key === "ArrowRight" ? 1 : -1);
  });
  $("#stage-keep").addEventListener("click", () => { closeStage(); ctx.onKeep(state); });
  $("#stage-try").addEventListener("click", () => { closeStage(); ctx.onTry(state.style.id); });
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
export async function prepareStage(wedding, style) {
  const demo = !wedding;
  if (!state || state.wedding !== wedding) resetGuests();
  state = { wedding, style, config: withSections(await ctx.configFor(style, wedding)) };
  renderSectionsList();
  const ready = showInFrame($("#stage-frame"), ctx.studio.templates[style.template].url, state.config);
  const [a, b] = state.config.event.couple;
  $("#stage-kind").textContent = demo ? "Web de ejemplo" : "Vuestra web";
  $("#stage-title").textContent = `${a} & ${b}`;
  $("#stage-edit").textContent = wedding?.partial ? "Poner datos" : "Editar datos";
  $("#stage-edit").hidden = demo;
  $("#stage-keep").hidden = demo;
  $("#stage-try").hidden = !demo;
  $("#stage-save").hidden = demo;
  $("#stage-share").hidden = demo;
  closeShare();
  markStyle();
  return ready;
}

// Con los datos nuevos que van poniendo encima de la web (edit.js): misma plantilla, mismo
// estilo, solo se le manda el config nuevo (sin recargar ni repetir la entrada).
export async function updateWedding(wedding) {
  if (!state) return;
  state = { ...state, wedding, config: withSections(await ctx.configFor(state.style, wedding)) };
  const [a, b] = state.config.event.couple;
  $("#stage-title").textContent = `${a} & ${b}`;
  $("#stage-edit").textContent = wedding.partial ? "Poner datos" : "Editar datos";
  return showInFrame($("#stage-frame"), ctx.studio.templates[state.style.template].url, state.config);
}

// Cambiar a otro estilo desde fuera (la cuadrícula de «Ver todas»).
export const showStyle = (id) => switchStyle(id);

export function openStage() {
  $("#stage").hidden = false;
  syncScrollLock();
  centerChip("auto");
  $("#stage [data-close]").focus();
}

export function closeStage() {
  if ($("#stage").hidden) return;
  toggleSectionsPanel(false);
  closeShare();
  $("#guest-panel").hidden = true;
  ctx.onClose?.();
  $("#stage").hidden = true;
  syncScrollLock();
}

export const stageState = () => state;

function markStyle() {
  const list = ctx.studio.styles.filter((s) => s.status === "available");
  const i = list.findIndex((s) => s.id === state.style.id);
  $("#dock-name").textContent = state.style.name;
  $("#dock-count").textContent = `Estilo ${i + 1} de ${list.length}`;
  document.querySelectorAll("#stage-styles [data-style]").forEach((b) =>
    b.setAttribute("aria-checked", b.dataset.style === state.style.id));
  requestAnimationFrame(() => centerChip("smooth"));
}

// Los estilos van en una fila que se desliza: que el elegido quede a la vista.
function centerChip(behavior) {
  const row = $("#stage-styles"), chip = row.querySelector('[aria-checked="true"]');
  if (!chip) return;
  const r = row.getBoundingClientRect(), c = chip.getBoundingClientRect();
  if (r.width) row.scrollBy({ left: c.left - r.left - (r.width - c.width) / 2, behavior });
}

// Los datos ya están cargados: con la misma plantilla, cambiar de estilo es reenviar el config;
// con otra plantilla, el iframe carga la nueva y recibe los mismos datos.
async function switchStyle(id) {
  if (id === state.style.id || busy) return;
  busy = true;
  try { await applyStyle(id); } finally { busy = false; }
}
let busy = false;

function stepStyle(dir) {
  const list = ctx.studio.styles.filter((s) => s.status === "available");
  const i = list.findIndex((s) => s.id === state.style.id);
  switchStyle(list[(i + dir + list.length) % list.length].id);
}

async function applyStyle(id) {
  const style = ctx.studio.styles.find((s) => s.id === id);
  const overlay = $("#switching");
  $("#switching-msg").textContent = `Aplicando estilo ${style.name}…`;
  overlay.hidden = false;
  try {
    state = { ...state, style, config: withSections(await ctx.configFor(style, state.wedding)) };
  } catch (e) {
    console.error("[WeddingWebs] estilo", id, e);
    $("#switching-msg").textContent = "No hemos podido cargar este estilo. Probad otra vez en un momento.";
    await sleep(2200);
    overlay.hidden = true;
    return;
  }
  renderSectionsList();
  markStyle();
  const ready = showInFrame($("#stage-frame"), ctx.studio.templates[style.template].url, state.config);
  await Promise.all([ready, sleep(ctx.studio.generator.switchMs)]);
  overlay.hidden = true;
}

// Barra de abajo: el nombre del estilo con flechas a los lados. En el móvil, deslizar el dedo
// sobre ella cambia de estilo (el iframe se queda el gesto, por eso va aquí y no sobre la web).
function setupDock(available) {
  $("#style-dock").hidden = available.length < 2;
  $("#dock-prev").addEventListener("click", () => stepStyle(-1));
  $("#dock-next").addEventListener("click", () => stepStyle(1));
  const touch = matchMedia("(pointer: coarse)").matches;
  $("#dock-hint").textContent = touch ? "Deslizad para ver otro" : "O usad las flechas ← →";
  const pad = $("#dock-swipe");
  let x0 = null, y0 = 0;
  pad.addEventListener("pointerdown", (e) => { x0 = e.clientX; y0 = e.clientY; pad.setPointerCapture?.(e.pointerId); });
  pad.addEventListener("pointermove", (e) => {
    if (x0 == null) return;
    pad.style.setProperty("--drag", `${Math.max(-60, Math.min(60, e.clientX - x0))}px`);
  });
  const end = (e) => {
    if (x0 == null) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    x0 = null;
    pad.style.setProperty("--drag", "0px");
    if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy)) stepStyle(dx < 0 ? 1 : -1);
  };
  pad.addEventListener("pointerup", end);
  pad.addEventListener("pointercancel", () => { x0 = null; pad.style.setProperty("--drag", "0px"); });
}

// «Probadla como invitados»: abre el formulario de confirmación dentro de la web y, al responder,
// la respuesta aparece al momento en un panel como el que tendrán (las plantillas avisan con
// "wedding:rsvp" en la vista previa; ver js/storage.js). Nada se guarda en ningún sitio.
let guests = [];
function setupGuests() {
  $("#stage-guest").addEventListener("click", () => {
    $("#guest-panel").hidden = false;
    toggleSectionsPanel(false);
    closeShare();
    const doc = $("#stage-frame").contentDocument;
    const open = doc?.querySelector("[data-rsvp-open], #rsvp-open");
    if (open) open.click();
    ctx.onGuest?.();
  });
  $("#guest-close").addEventListener("click", () => { $("#guest-panel").hidden = true; });
  addEventListener("message", (e) => {
    if (e.origin !== location.origin || e.data?.type !== "wedding:rsvp") return;
    if (e.source !== $("#stage-frame").contentWindow) return;
    const entry = e.data.entry || {};
    guests.unshift({ name: String(entry.name || "Invitado"), attending: entry.attending, song: String(entry.song || "").trim() });
    renderGuests(true);
    $("#guest-panel").hidden = false;
  });
}

function resetGuests() { guests = []; renderGuests(false); }

function renderGuests(fresh) {
  const yes = guests.filter((g) => g.attending === "si").length;
  $("#g-yes").textContent = yes;
  $("#g-no").textContent = guests.length - yes;
  $("#g-songs").textContent = guests.filter((g) => g.song).length;
  $("#guest-panel").classList.toggle("has-entries", guests.length > 0);
  $("#guest-note").textContent = guests.length
    ? "Así os llega cada respuesta. Probad otra, con otro nombre."
    : "Responded en la web como si fuerais un invitado y mirad cómo os llega aquí, al momento.";
  $("#g-list").innerHTML = guests.slice(0, 6).map((g, i) => `
    <li class="${i === 0 && fresh ? "is-new" : ""}">
      <span class="guest-panel__dot ${g.attending === "si" ? "is-yes" : "is-no"}" aria-hidden="true"></span>
      <span><strong>${esc(g.name)}</strong><small>${g.attending === "si" ? "Viene" : "No viene"}${g.song ? ` · «${esc(g.song)}»` : ""}</small></span>
      <time>ahora</time>
    </li>`).join("");
}

// «Enseñádsela a vuestra pareja»: un enlace con sus datos (sin fotos) en el #, que no llega a
// ningún servidor. En el móvil, el menú de compartir del sistema; si no, WhatsApp o copiar.
function setupShare() {
  $("#stage-share").addEventListener("click", async () => {
    const url = shareUrl();
    const [a, b] = state.wedding.couple;
    const text = `Mira cómo quedaría nuestra web de boda, ${a} y ${b}:`;
    ctx.onShare?.();
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      try { await navigator.share({ title: `${a} & ${b}`, text, url }); return; }
      catch (e) { if (e?.name === "AbortError") return; }
    }
    $("#share-wa").href = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
    $("#share-copy").textContent = "Copiar enlace";
    $("#share-url").value = url;
    toggleSectionsPanel(false);
    $("#share-pop").hidden = false;
    $("#share-wa").focus();
  });
  $("#share-copy").addEventListener("click", async () => {
    const input = $("#share-url");
    try { await navigator.clipboard.writeText(input.value); $("#share-copy").textContent = "¡Copiado!"; }
    catch { input.focus(); input.select(); $("#share-copy").textContent = "Copiadlo de arriba"; }
  });
  $("#share-close").addEventListener("click", closeShare);
}

function closeShare() { $("#share-pop").hidden = true; }

function shareUrl() {
  const w = state.wedding;
  const data = w.partial
    ? { c: w.couple, d: w.date || undefined, t: w.time || undefined, v: w.venue || undefined, ci: w.city || undefined, s: state.style.id, p: 1 }
    : { c: w.couple, d: w.date, t: w.time, v: w.venue, ci: w.city, s: state.style.id };
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${location.origin}${location.pathname}#boda=${b64}`;
}

// Lo contrario: el enlace que les han pasado -> los datos de la boda (o null si no vale).
export function weddingFromHash(hash = location.hash) {
  const m = /^#boda=([\w-]+)$/.exec(hash);
  if (!m) return null;
  try {
    const bin = atob(m[1].replace(/-/g, "+").replace(/_/g, "/"));
    const d = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    const str = (v, n = 80) => String(v ?? "").trim().slice(0, n);
    const couple = Array.isArray(d.c) ? d.c.slice(0, 2).map((x) => str(x, 24)) : [];
    if (couple.length !== 2 || !couple[0] || !couple[1]) return null;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(d.d) ? d.d : "", time = /^\d{2}:\d{2}$/.test(d.t) ? d.t : "";
    const wedding = { couple, date, time, venue: str(d.v), city: str(d.ci), photos: [], shared: true };
    // Sin fecha, hora o lugar: con los del ejemplo (lo que hoy se puede probar solo con los nombres).
    if (!date || !time || !wedding.venue) { if (!d.p) return null; wedding.partial = true; }
    return { wedding, style: str(d.s, 40) };
  } catch { return null; }
}
