import { $, esc, syncScrollLock } from "./util.js";
import { showInFrame, fitScaled } from "./preview.js";

// «Probar», paso 2: todos los estilos en tarjetas (en el móvil, dos por fila), cada una con un
// trocito de su web ya con los nombres de la pareja. Al tocar una, se abre esa web entera.
// Se vuelve aquí desde la vista previa con «Ver todas».
//
// Cada tarjeta es una web de verdad dentro de un iframe: se cargan solo las que están cerca de la
// pantalla, pocas a la vez, y las que quedan muy lejos se descargan para no agotar la memoria
// del móvil con 47 webs abiertas.
let ctx = null;
let wedding = null;   // la boda que se enseña en las tarjetas (null: el ejemplo de cada plantilla)
let current = "";     // el estilo que están viendo, si vienen de la vista previa
let opener = null;
const queue = [];
let loading = 0;
const MAX_LOADING = 3;

export function setupPicker(context) {
  ctx = context; // { studio, configFor, onPick(style, { position }), onClose() }
  const available = ctx.studio.styles.filter((s) => s.status === "available");
  const grid = $("#picker-grid");
  grid.innerHTML = available.map((s, i) => `
    <li><button type="button" class="pick-card" data-style="${esc(s.id)}" style="--i:${Math.min(i, 8)}">
      <span class="pick-card__shot scaled" data-base-width="390" data-base-height="560">
        <iframe title="Estilo ${esc(s.name)}" tabindex="-1" aria-hidden="true"></iframe>
        <span class="pick-card__now">Lo estáis viendo</span>
      </span>
      <span class="pick-card__label">
        <span class="swatch" style="--sw-a:${esc(s.swatch[0])};--sw-b:${esc(s.swatch[1])}" aria-hidden="true"></span>
        <span class="pick-card__name">${esc(s.name)}</span>
      </span>
    </button></li>`).join("");
  const boxes = [...grid.querySelectorAll(".scaled")];
  boxes.forEach(fitScaled);

  grid.addEventListener("click", (e) => {
    const card = e.target.closest("[data-style]");
    if (!card) return;
    const style = available.find((s) => s.id === card.dataset.style);
    card.classList.add("is-opening");
    ctx.onPick(style, { position: available.indexOf(style) + 1 }).finally(() => card.classList.remove("is-opening"));
  });
  $("#picker [data-close]").addEventListener("click", () => closePicker());
  $("#picker-names").addEventListener("click", () => { closePicker(); ctx.onNames?.(); });

  if (!("IntersectionObserver" in window)) return boxes.forEach(load);
  // Se cargan las que están a la vista (o casi). Si bajan rápido, las que ya pasaron salen de la
  // cola, para que las que tienen delante no esperen a las de arriba.
  const near = new IntersectionObserver((entries) => {
    for (const e of entries) {
      e.target.dataset.near = e.isIntersecting ? "1" : "";
      if (e.isIntersecting) enqueue(e.target);
      else if (e.target.dataset.state === "queued") delete e.target.dataset.state;
    }
  }, { root: $("#picker"), rootMargin: "200px 0px" });
  // Las muy lejanas se descargan, pero solo con la cuadrícula abierta: al cerrarla (para ver una
  // web) se quedan como estaban, y «Ver todas» vuelve a enseñarlas al momento.
  const far = new IntersectionObserver((entries) => {
    if ($("#picker").hidden) return;
    for (const e of entries) if (!e.isIntersecting) unload(e.target);
  }, { root: $("#picker"), rootMargin: "1600px 0px" });
  boxes.forEach((b) => { near.observe(b); far.observe(b); });
}

const enqueue = (box) => { if (!box.dataset.state) { box.dataset.state = "queued"; queue.push(box); pump(); } };

function pump() {
  while (loading < MAX_LOADING && queue.length) {
    const box = queue.shift();
    if (box.dataset.state !== "queued") continue;
    loading++;
    load(box).finally(() => { loading--; pump(); });
  }
}

async function load(box) {
  box.dataset.state = "loading";
  const style = ctx.studio.styles.find((s) => s.id === box.closest("[data-style]").dataset.style);
  try {
    // Si se descarga a medias (han bajado mucho), deja el hueco a otra en vez de esperar al límite.
    const dropped = new Promise((_, reject) => { box.drop = () => reject(new Error("descargada")); });
    await Promise.race([showInFrame(box.querySelector("iframe"), ctx.studio.templates[style.template].url, await ctx.configFor(style, wedding)), dropped]);
    if (box.dataset.state === "loading") box.dataset.state = "ready";
  } catch (e) {
    if (e.message === "descargada") return;
    if (box.dataset.state === "loading") delete box.dataset.state;
    console.error("[WeddingWebs] tarjeta", style.id, e);
    // Con mala conexión: otro intento al rato, si sigue a la vista.
    setTimeout(() => { if (box.dataset.near && !box.dataset.state) enqueue(box); }, 3000);
  } finally {
    box.drop = null;
  }
}

function unload(box) {
  if (!box.dataset.state) return;
  delete box.dataset.state;
  box.drop?.();
  const frame = box.querySelector("iframe");
  frame.dataset.src = "";
  frame.dataset.ready = "";
  frame.removeAttribute("src");
}

// Las tarjetas que ya están cargadas, con los nombres nuevos (sin recargarlas).
function repaint() {
  document.querySelectorAll('#picker-grid .scaled[data-state="ready"]').forEach((box) => load(box));
}

// w: la boda (con sus nombres) o null para los ejemplos. now: el estilo que están viendo.
export function openPicker(w, { now = "" } = {}) {
  opener = document.activeElement;
  const changed = JSON.stringify(w) !== JSON.stringify(wedding);
  wedding = w;
  current = now;
  const [a, b] = w?.couple || [];
  $("#picker-title").textContent = a && b ? `${a} & ${b}, ¿qué estilo os pega?` : "¿Qué estilo os pega?";
  $("#picker-lead").textContent = a && b
    ? "Tocad uno y lo veis entero, con vuestros nombres."
    : "Tocad uno y lo veis entero.";
  $("#picker-names").hidden = !(a && b) || Boolean(now);
  $("#picker-step").hidden = Boolean(now);
  document.querySelectorAll("#picker-grid [data-style]").forEach((c) => {
    c.classList.toggle("is-current", c.dataset.style === now);
    c.setAttribute("aria-current", c.dataset.style === now ? "true" : "false");
  });
  $("#picker").hidden = false;
  syncScrollLock();
  if (changed) repaint();
  // El que están viendo, a la vista; si vienen de los nombres, desde arriba.
  const card = now && $(`#picker-grid [data-style="${CSS.escape(now)}"]`);
  if (card) card.scrollIntoView({ block: "center" });
  else $("#picker").scrollTop = 0;
  $("#picker [data-close]").focus({ preventScroll: true });
}

export function closePicker({ restoreFocus = true } = {}) {
  if ($("#picker").hidden) return;
  $("#picker").hidden = true;
  syncScrollLock();
  ctx.onClose?.();
  if (restoreFocus && opener?.isConnected) opener.focus({ preventScroll: true });
}

export const pickerOpen = () => !$("#picker").hidden;
