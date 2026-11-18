import { $, esc, sleep, syncScrollLock } from "./util.js";
import { pickRandom } from "./demo.js";
import { showInFrame, fitScaled } from "./preview.js";

// Generador paso a paso: una pregunta por pantalla y, al lado, su web cambiando con cada dato
// (lo que aún no han puesto sale del ejemplo de la plantilla). Sin email: se pide al final, si
// quieren guardarla (send.js). Recoge los datos de la pareja (ver wedding.js).
const STEPS = ["nombres", "fecha", "lugar", "estilo", "fotos"];
// Qué parte de la web enseña el móvil en cada paso, y en algunos campos concretos: así ven
// cambiar justo lo que están rellenando. "top" es la portada; el resto, la sección de ese nombre.
const STEP_VIEW = { nombres: "top", fecha: "details", lugar: "details", estilo: "top", fotos: "top" };
const FIELD_VIEW = { "b-name-a": "top", "b-name-b": "top", "b-date": "details", "b-time": "schedule", "b-venue": "details", "b-city": "details" };
let photos = []; // data URLs ya reducidas
let opener = null;
let step = 0;
let ctx = null;

export function setupBuilder(context) {
  ctx = context;
  const { studio, demoPhotos = [] } = ctx;
  const sheet = $("#builder"), form = $("#builder-form"), err = $("#b-error");
  const available = studio.styles.filter((s) => s.status === "available");

  $("#b-styles").innerHTML = studio.styles.filter((s) => s.status === "available").map((s) => `
    <label class="chip">
      <input type="radio" name="style" value="${esc(s.id)}">
      <span class="swatch" style="--sw-a:${esc(s.swatch[0])};--sw-b:${esc(s.swatch[1])}"></span>
      ${esc(s.name)}
    </label>`).join("");
  form.elements.style.value = available[0].id;
  fitScaled($(".wizard__phone .scaled"));

  const max = studio.generator.maxPhotos;
  const input = $("#b-photo-input");
  input.addEventListener("change", async () => {
    const files = [...input.files].slice(0, max - photos.length);
    input.value = "";
    err.textContent = "";
    $("#b-photos").classList.add("is-busy");
    for (const file of files) {
      try { photos.push(await shrink(file)); }
      catch {
        err.textContent = /\.hei[cf]$/i.test(file.name)
          ? `«${file.name}» es una foto HEIC del iPhone y este navegador no la abre. Abridla en el móvil y compartidla como JPG, o elegid otra.`
          : `No se pudo leer «${file.name}». Probad con una foto JPG o PNG.`;
      }
    }
    $("#b-photos").classList.remove("is-busy");
    renderPhotos(max);
    livePreview();
  });

  // Para probar rápido: una pareja inventada, tres fotos de ejemplo al azar y directos a su web.
  $("#b-sample").addEventListener("click", async () => {
    const d = new Date(); d.setMonth(d.getMonth() + 10);
    const f = form.elements;
    f.nameA.value = "Ana"; f.nameB.value = "Pablo";
    f.date.value = d.toLocaleDateString("sv-SE"); f.time.value = "18:30";
    f.venue.value = "Cortijo Los Almendros"; f.city.value = "Ronda, Málaga";
    err.textContent = "";
    photos = [];
    for (const url of pickRandom(demoPhotos, max)) {
      try { photos.push(await shrink(await (await fetch(url)).blob())); } catch { /* foto ilegible: se salta */ }
    }
    renderPhotos(max);
    generate(true);
  });

  // Enter (o «Siguiente») avanza; en el último paso, crea la web.
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validStep()) return;
    if (step < STEPS.length - 1) return go(step + 1);
    generate(false);
  });
  $("#w-back").addEventListener("click", () => go(step - 1));

  form.addEventListener("focusin", (e) => {
    const view = FIELD_VIEW[e.target.id];
    if (view && view !== previewView) { previewView = view; scrollPreview(); }
  });
  form.addEventListener("input", (e) => {
    if (e.target.id === "b-date") countdown();
    if (e.target.closest(".wstep")) err.textContent = "";
    // Escribiendo, la web cambia cuando paran (1 s), no a cada letra; fecha y hora, enseguida.
    livePreview(e.target.matches("input[type=text]") ? 1000 : 250);
  });
  form.addEventListener("change", (e) => { if (e.target.name === "style") livePreview(0); });

  sheet.querySelector("[data-close]").addEventListener("click", closeBuilder);
  sheet.addEventListener("click", (e) => { if (e.target === sheet) closeBuilder(); });
}

const today = () => new Date().toLocaleDateString("sv-SE"); // AAAA-MM-DD en hora local
const inYears = (n) => { const d = new Date(); d.setFullYear(d.getFullYear() + n); return d.toLocaleDateString("sv-SE"); };
const daysUntil = (date) => Math.round((new Date(`${date}T12:00:00`) - new Date(`${today()}T12:00:00`)) / 864e5);

function data() {
  return Object.fromEntries(new FormData($("#builder-form")));
}

function chosenStyle() {
  const id = data().style;
  return ctx.studio.styles.find((s) => s.id === id && s.status === "available")
    || ctx.studio.styles.find((s) => s.status === "available");
}

// Lo que lleven escrito, para la vista previa (la fecha solo si es válida).
function partial() {
  const d = data();
  const okDate = d.date && d.date >= today() && d.date <= inYears(4);
  return {
    couple: [d.nameA || "", d.nameB || ""],
    date: okDate ? d.date : "", time: okDate ? d.time : "",
    venue: d.venue || "", city: d.city || "",
    photos: [...photos],
  };
}

let previewTimer = 0;
function livePreview(delay = 180) {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(async () => {
    const style = chosenStyle();
    try {
      const config = await ctx.previewFor(style, partial());
      const frame = $("#w-frame"), url = ctx.studio.templates[style.template].url;
      const reload = frame.dataset.src !== new URL(url, location.href).href.replace(/#.*$/, "") + "#preview" || !frame.dataset.ready;
      await showInFrame(frame, url, config);
      // La plantilla se vuelve a pintar con los datos nuevos: el móvil sigue en la sección que toca.
      setTimeout(() => scrollPreview(reload ? "auto" : "keep"), reload ? 350 : 120);
    } catch (e) { console.error("[WeddingWebs] vista previa en vivo:", e); }
  }, delay);
}

function validStep() {
  const d = data(), err = $("#b-error");
  const fail = (msg, id) => { err.textContent = msg; $(`#${id}`).focus(); return false; };
  const name = STEPS[step];
  if (name === "nombres") {
    if (!String(d.nameA || "").trim()) return fail("Escribid los dos nombres.", "b-name-a");
    if (!String(d.nameB || "").trim()) return fail("Escribid los dos nombres.", "b-name-b");
  }
  if (name === "fecha") {
    if (!d.date) return fail("Falta la fecha de la boda.", "b-date");
    if (d.date < today()) return fail("La fecha de la boda ya ha pasado. Revisadla.", "b-date");
    if (d.date > inYears(4)) return fail("Revisad la fecha: ¿seguro que es tan lejos?", "b-date");
    if (!d.time) return fail("Falta la hora de la ceremonia.", "b-time");
  }
  if (name === "lugar" && !String(d.venue || "").trim()) return fail("Falta el lugar de la boda.", "b-venue");
  err.textContent = "";
  return true;
}

// Desplaza la web del móvil hasta la sección que están rellenando. "keep" solo corrige si la
// plantilla, al volver a pintarse, la ha movido de sitio.
let previewView = "top";
function scrollPreview(behavior = "smooth") {
  const frame = $("#w-frame");
  let doc, win;
  try { doc = frame.contentDocument; win = frame.contentWindow; } catch { return; }
  if (!doc?.body || !win) return;
  let y = 0;
  if (previewView !== "top") {
    const el = doc.getElementById(`${previewView}-title`)?.closest("section") || doc.querySelector(`section.${previewView}`);
    if (!el) return;
    y = Math.max(0, el.getBoundingClientRect().top + win.scrollY - 8);
  }
  if (behavior === "keep") { if (Math.abs(win.scrollY - y) < 40) return; behavior = "auto"; }
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) behavior = "auto";
  win.scrollTo({ top: y, behavior });
}

// Muestra el paso i: barra, contador, botones y el foco en su primer campo.
function go(i) {
  step = Math.max(0, Math.min(STEPS.length - 1, i));
  document.querySelectorAll("#builder .wstep").forEach((s) => { s.hidden = s.dataset.step !== STEPS[step]; });
  $("#w-bar").style.width = `${((step + 1) / STEPS.length) * 100}%`;
  $("#w-count").textContent = `Paso ${step + 1} de ${STEPS.length}`;
  $("#w-back").hidden = step === 0;
  $("#w-next").textContent = step === STEPS.length - 1
    ? (photos.length ? "Crear nuestra web" : "Crear con fotos de ejemplo")
    : "Siguiente";
  $("#b-error").textContent = "";
  if (STEPS[step] === "fecha") countdown();
  const current = $(`#builder .wstep[data-step="${STEPS[step]}"]`);
  const first = current.querySelector("input:checked, input:not([type=hidden]):not([type=file])");
  // En móvil, sin abrir el teclado solo por cambiar de paso a la elección de estilo.
  previewView = STEP_VIEW[STEPS[step]];
  if (first && !(STEPS[step] === "estilo" && matchMedia("(pointer: coarse)").matches)) first.focus({ preventScroll: true });
  previewView = STEP_VIEW[STEPS[step]]; // el primer campo del paso manda menos que el paso
  setTimeout(() => scrollPreview(), 60);
}

// Cuenta atrás: al poner la fecha, los días suben hasta su número.
let shownDays = 0, raf = 0;
function countdown() {
  const box = $("#w-countdown"), d = data().date;
  const ok = d && d >= today() && d <= inYears(4);
  box.hidden = !ok;
  if (!ok) { shownDays = 0; return; }
  const target = daysUntil(d), from = shownDays, t0 = performance.now();
  const ms = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 900;
  const label = target === 0 ? "¡Es hoy! Vuestro «sí, quiero»" : target === 1 ? "día para vuestro «sí, quiero»" : "días para vuestro «sí, quiero»";
  $("#w-days-label").textContent = label;
  cancelAnimationFrame(raf);
  const tick = (now) => {
    const p = ms ? Math.min(1, (now - t0) / ms) : 1;
    const v = Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3)));
    $("#w-days").textContent = v.toLocaleString("es-ES");
    shownDays = v;
    if (p < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

function generate(sample) {
  const d = data();
  if (d.website) return closeBuilder(); // campo trampa: lo rellena un bot, no una pareja
  const style = chosenStyle();
  closeBuilder();
  ctx.onGenerate({
    couple: [d.nameA.trim(), d.nameB.trim()],
    date: d.date, time: d.time,
    venue: d.venue.trim(), city: (d.city || "").trim(),
    photos: [...photos],
    sample,
  }, style);
}

// styleId: el estilo marcado. names: los de la portada (si vienen los dos, empieza por la fecha).
export function openBuilder(styleId, { names } = {}) {
  opener = document.activeElement;
  const form = $("#builder-form");
  const radio = styleId && form.querySelector(`input[name="style"][value="${CSS.escape(styleId)}"]`);
  if (radio) radio.checked = true;
  if (names) {
    if (names[0]) form.elements.nameA.value = names[0];
    if (names[1]) form.elements.nameB.value = names[1];
  }
  $("#nudge").hidden = true;
  $("#b-date").min = today();
  $("#b-date").max = inYears(4);
  $("#builder").hidden = false;
  syncScrollLock();
  const d = data();
  go(names && d.nameA?.trim() && d.nameB?.trim() ? 1 : 0);
  livePreview(0);
}

export function closeBuilder() {
  if ($("#builder").hidden) return;
  $("#builder").hidden = true;
  syncScrollLock();
  if (opener?.isConnected && $("#stage").hidden) opener.focus();
}

function renderPhotos(max) {
  const box = $("#b-photos"), add = $("#b-photo-add");
  box.querySelectorAll(".photos__item").forEach((n) => n.remove());
  photos.forEach((src, i) => {
    const item = document.createElement("div");
    item.className = "photos__item";
    item.innerHTML = `<img src="${src}" alt="Foto ${i + 1}">${i === 0 ? '<span class="first">Portada</span>' : ""}
      <button type="button" aria-label="Quitar foto ${i + 1}">×</button>`;
    item.querySelector("button").addEventListener("click", () => { photos.splice(i, 1); renderPhotos(max); livePreview(); });
    box.insertBefore(item, add);
  });
  add.hidden = photos.length >= max;
  if (STEPS[step] === "fotos") $("#w-next").textContent = photos.length ? "Crear nuestra web" : "Crear con fotos de ejemplo";
}

// Reduce la foto (File o Blob) a 2000 px de lado mayor en JPEG de calidad alta: la pareja tiene
// que ver sus fotos bien en la prueba. Cabe en un postMessage y no sale del navegador.
function shrink(file, maxSide = 2000) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      const g = c.getContext("2d");
      g.imageSmoothingQuality = "high";
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("imagen ilegible")); };
    img.src = url;
  });
}

// Barra de progreso de la primera generación. El trabajo real (montar el config)
// ya está hecho; esto es la espera que hace que se sienta "generada".
export async function playLoading(wedding, { firstRunMs, messages }) {
  const [a, b] = wedding.couple;
  $("#loading-names").textContent = `${a} & ${b}`;
  const bar = $("#loading-bar"), msg = $("#loading-msg");
  $("#loading").hidden = false;
  syncScrollLock();
  const t0 = performance.now();
  await new Promise((done) => {
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / firstRunMs);
      const eased = 1 - Math.pow(1 - p, 2.2);
      bar.style.width = `${(eased * 100).toFixed(1)}%`;
      const text = messages[Math.min(messages.length - 1, Math.floor(eased * messages.length))];
      if (msg.textContent !== text) msg.textContent = text;
      p < 1 ? requestAnimationFrame(tick) : done();
    };
    requestAnimationFrame(tick);
  });
  await sleep(250);
  $("#loading").hidden = true;
  syncScrollLock();
}
