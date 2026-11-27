import { $ } from "./util.js";
import { shrink } from "./builder.js";

// Sus datos, encima de la propia web (sin volver a ningún formulario): nombres, fecha, lugar y
// fotos en un panel pequeño, y la web cambia según escriben. Mientras solo han puesto los nombres,
// al ir bajando por la web sale un aviso que no bloquea nada, como el de las cookies:
// «¿Queréis probarla con vuestros datos?».
let ctx = null;
let photos = [];
let timer = 0;
let prompted = false; // el aviso de los datos, una vez por visita
let promptTimer = 0;

const today = () => new Date().toLocaleDateString("sv-SE"); // AAAA-MM-DD en hora local
const inYears = (n) => { const d = new Date(); d.setFullYear(d.getFullYear() + n); return d.toLocaleDateString("sv-SE"); };

export function setupEdit(context) {
  ctx = context; // { getState, update(wedding), onDone(wedding, before), maxPhotos, onPrompt(evento) }
  const form = $("#edit-form");
  form.addEventListener("input", (e) => {
    $("#edit-error").textContent = "";
    clearTimeout(timer);
    timer = setTimeout(apply, e.target.type === "text" ? 350 : 120);
  });
  form.addEventListener("submit", (e) => { e.preventDefault(); done(); });
  $("#edit-close").addEventListener("click", () => done());
  // La web, a lo que están cambiando.
  form.addEventListener("focusin", (e) => aim(e.target.dataset.aim));
  // Enter pasa al campo siguiente (en el último, «Listo»).
  form.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.target.type !== "text") return;
    const next = { "e-name-a": "e-name-b", "e-name-b": "e-date", "e-venue": "e-city" }[e.target.id];
    if (!next) return;
    e.preventDefault();
    $(`#${next}`).focus();
  });

  const input = $("#e-photo-input");
  input.addEventListener("change", async () => {
    const files = [...input.files].slice(0, ctx.maxPhotos - photos.length);
    input.value = "";
    $("#edit-photos").classList.add("is-busy");
    for (const file of files) {
      try { photos.push(await shrink(file)); }
      catch { $("#edit-error").textContent = `No se pudo leer «${file.name}». Probad con una foto JPG o PNG.`; }
    }
    $("#edit-photos").classList.remove("is-busy");
    renderPhotos();
    apply();
  });

  // Los otros paneles de la vista previa cierran este (no caben dos a la vez).
  ["#stage-sections", "#stage-guest", "#stage-share", "#stage-all", "#stage-save", "#stage-keep"].forEach((id) => $(id).addEventListener("click", closeEdit));

  $("#data-prompt-yes").addEventListener("click", () => { hidePrompt(); ctx.onPrompt?.("si"); openEdit("date"); });
  $("#data-prompt-no").addEventListener("click", () => { hidePrompt(); ctx.onPrompt?.("no"); });
  // El aviso sale cuando bajan por su web (ya han visto la portada con sus nombres) o, si no
  // bajan, pasado un rato. La web vive en un iframe de la misma página: se escucha su scroll.
  const frame = $("#stage-frame");
  frame.addEventListener("load", () => {
    try {
      frame.contentDocument.addEventListener("scroll", (e) => {
        const win = frame.contentWindow;
        const y = e.target === frame.contentDocument ? win.scrollY : e.target.scrollTop || 0;
        if (y > win.innerHeight * 0.8) maybePrompt();
      }, { capture: true, passive: true });
    } catch { /* otra página: sin aviso al bajar, queda el del tiempo */ }
  });
}

// Cuando se abre la vista previa con solo los nombres.
export function armPrompt(ms = 25000) {
  clearTimeout(promptTimer);
  if (prompted) return;
  promptTimer = setTimeout(maybePrompt, ms);
}

function maybePrompt() {
  const st = ctx.getState();
  if (prompted || !st?.wedding?.partial || $("#stage").hidden || !$("#edit-panel").hidden) return;
  if (!$("#picker").hidden || !$("#send").hidden || !$("#share-pop").hidden || !$("#sections-panel").hidden) return;
  prompted = true;
  clearTimeout(promptTimer);
  $("#save-nudge").hidden = true;
  $("#data-prompt").hidden = false;
  ctx.onPrompt?.("visto");
}

export function hidePrompt() {
  clearTimeout(promptTimer);
  $("#data-prompt").hidden = true;
}

// Con los datos de la vista previa. focus: "names", "date", "venue" o "photos".
export function openEdit(focus = "") {
  const w = ctx.getState()?.wedding;
  if (!w) return;
  hidePrompt();
  prompted = true; // ya están en ello: el aviso no hace falta
  const f = $("#edit-form").elements;
  f.nameA.value = w.couple[0]; f.nameB.value = w.couple[1];
  f.date.value = w.date || ""; f.time.value = w.time || "18:00";
  f.venue.value = w.venue || ""; f.city.value = w.city || "";
  f.date.min = today(); f.date.max = inYears(4);
  photos = [...(w.photos || [])];
  renderPhotos();
  $("#edit-error").textContent = "";
  before = w;
  $("#sections-panel").hidden = true;
  $("#share-pop").hidden = true;
  $("#save-nudge").hidden = true;
  // Mientras escriben, la web no repite su entrada a cada letra (ver holdStill en preview.js).
  $("#stage-frame").dataset.still = "";
  $("#edit-panel").hidden = false;
  $("#stage").classList.add("is-editing");
  const field = { names: "e-name-a", date: "e-date", venue: "e-venue" }[focus] || (w.partial && !w.date ? "e-date" : "e-name-a");
  // En el móvil, sin abrir el teclado de golpe salvo que hayan pedido un campo concreto.
  if (focus || !matchMedia("(pointer: coarse)").matches) $(`#${field}`).focus({ preventScroll: true });
  aim($(`#${field}`).dataset.aim);
}
let before = null;

export function closeEdit() {
  if ($("#edit-panel").hidden) return;
  $("#edit-panel").hidden = true;
  $("#stage").classList.remove("is-editing");
  delete $("#stage-frame").dataset.still;
}

export const editOpen = () => !$("#edit-panel").hidden;

// Lo que lleven escrito -> la boda. Lo que no esté (o no valga) sale del ejemplo de la plantilla.
function read() {
  const d = Object.fromEntries(new FormData($("#edit-form")));
  const w = ctx.getState().wedding;
  const okDate = d.date && d.date >= today() && d.date <= inYears(4);
  const wedding = {
    ...w,
    couple: [String(d.nameA).trim() || w.couple[0], String(d.nameB).trim() || w.couple[1]],
    date: okDate ? d.date : "",
    time: okDate && d.time ? d.time : "",
    venue: String(d.venue || "").trim(),
    city: String(d.city || "").trim(),
    photos: [...photos],
  };
  wedding.partial = !(wedding.date && wedding.time && wedding.venue);
  return { wedding, d, okDate };
}

async function apply() {
  clearTimeout(timer);
  const { wedding } = read();
  try { await ctx.update(wedding); } catch (e) { console.error("[WeddingWebs] datos:", e); }
}

async function done() {
  const { wedding, d, okDate } = read();
  const err = $("#edit-error");
  if (!String(d.nameA).trim() || !String(d.nameB).trim()) { err.textContent = "Escribid los dos nombres."; return $(String(d.nameA).trim() ? "#e-name-b" : "#e-name-a").focus(); }
  if (d.date && !okDate) {
    err.textContent = d.date < today() ? "La fecha de la boda ya ha pasado. Revisadla." : "Revisad la fecha: ¿seguro que es tan lejos?";
    return $("#e-date").focus();
  }
  await apply();
  closeEdit();
  ctx.onDone?.(wedding, before);
}

// Lleva la web (dentro del iframe) a lo que están cambiando: arriba para los nombres y las fotos,
// la sección de detalles para la fecha y el lugar.
function aim(what) {
  const frame = $("#stage-frame");
  let doc, win;
  try { doc = frame.contentDocument; win = frame.contentWindow; } catch { return; }
  if (!doc?.body || !win) return;
  const smooth = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  if (what !== "details") return win.scrollTo({ top: 0, behavior: smooth });
  // Lo que acaban de escribir (el lugar, o el año de la fecha) donde salga más grande; si no, la
  // sección de detalles. Arriba de lo que se ve: en el móvil, el panel tapa la mitad de abajo.
  const cfg = ctx.getState()?.config;
  const words = [cfg?.venue?.name, String(cfg?.event?.date || "").slice(0, 4)].filter((w) => w && w.length > 1);
  let el = null;
  for (const word of words) {
    let size = 0;
    const walk = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (!n.nodeValue.includes(word) || !n.parentElement?.offsetHeight) continue;
      const px = Number.parseFloat(win.getComputedStyle(n.parentElement).fontSize) || 0;
      if (px > size && n.parentElement.getBoundingClientRect().top + win.scrollY > win.innerHeight * 0.6) { size = px; el = n.parentElement; }
    }
    if (el) break;
  }
  el ||= doc.getElementById("details-title")?.closest("section") || doc.querySelector("section.details, section#details, #detalles");
  if (!el) return;
  const top = el.getBoundingClientRect().top + win.scrollY - win.innerHeight * 0.18;
  win.scrollTo({ top: Math.max(0, top), behavior: smooth });
}

function renderPhotos() {
  const box = $("#edit-photos"), add = $("#e-photo-add");
  box.querySelectorAll(".photos__item").forEach((n) => n.remove());
  photos.forEach((src, i) => {
    const item = document.createElement("div");
    item.className = "photos__item";
    item.innerHTML = `<img src="${src}" alt="Foto ${i + 1}">${i === 0 ? '<span class="first">Portada</span>' : ""}
      <button type="button" aria-label="Quitar foto ${i + 1}">×</button>`;
    item.querySelector("button").addEventListener("click", () => { photos.splice(i, 1); renderPhotos(); apply(); });
    box.insertBefore(item, add);
  });
  add.hidden = photos.length >= ctx.maxPhotos;
}
