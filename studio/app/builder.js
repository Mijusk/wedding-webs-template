import { $, esc, sleep, syncScrollLock } from "./util.js";
import { pickRandom } from "./demo.js";
import { showInFrame, fitScaled } from "./preview.js";
import { track } from "./analytics.js";

// Generador paso a paso: una pregunta por pantalla y, al lado, su web cambiando con cada dato
// (lo que aún no han puesto sale del ejemplo de la plantilla). Sin email: se pide al final, si
// quieren guardarla (send.js). Recoge los datos de la pareja (ver wedding.js).
const STEPS = ["nombres", "fecha", "lugar", "estilo", "fotos"];
// Qué parte de la web enseña la vista previa en cada paso, y en algunos campos concretos: así ven
// cambiar justo lo que están rellenando. "names": los nombres de la portada · "date": la fecha
// · "venue": el lugar · "schedule": el horario · "top": arriba del todo (la foto de portada).
const STEP_VIEW = { nombres: "names", fecha: "date", lugar: "venue", estilo: "names", fotos: "top" };
const FIELD_VIEW = { "b-name-a": "names", "b-name-b": "names", "b-date": "date", "b-time": "schedule", "b-venue": "venue", "b-city": "venue" };
const MOBILE = "(max-width: 760px)";
let photos = []; // data URLs ya reducidas
let opener = null;
let step = 0;
let ctx = null;
// Embudo del generador: en Umami, el evento «paso_generador» sale una vez por paso cada vez que se
// abre, con { paso, numero }. Comparando cuántos llegan a cada número se ve dónde abandona la gente.
let stepsSeen = new Set();

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
  // En el móvil la ventana de la vista previa crece y encoge con el teclado: se vuelve a apuntar.
  let boxH = 0;
  new ResizeObserver(([e]) => {
    const h = Math.round(e.contentRect.height);
    if (h && Math.abs(h - boxH) > 2 && !sheet.hidden) { boxH = h; aimPreview("auto"); }
  }).observe($(".wizard__phone .scaled"));

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
  // Enter (o «Siguiente» en el teclado del móvil) en el primer nombre pasa al segundo; en el
  // lugar, a la ciudad. Sin avisos de que falta algo que aún no les ha dado tiempo a escribir.
  form.addEventListener("keydown", (e) => {
    const next = { "b-name-a": "b-name-b", "b-venue": "b-city" }[e.target.id];
    if (e.key !== "Enter" || !next || !e.target.value.trim()) return;
    e.preventDefault();
    $(`#${next}`).focus();
  });

  form.addEventListener("focusin", (e) => {
    const view = FIELD_VIEW[e.target.id];
    if (view && view !== previewView) { previewView = view; aimPreview(); }
  });
  form.addEventListener("input", (e) => {
    if (e.target.id === "b-date") countdown();
    if (e.target.closest(".wstep")) err.textContent = "";
    // Escribiendo, la web cambia en cuanto hacen una pausa mínima, no a cada letra; fecha y hora, ya.
    livePreview(e.target.matches("input[type=text]") ? 380 : 150);
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
let shown = null; // el último config enviado a la vista previa (para encontrar en ella los nombres, el lugar…)
function livePreview(delay = 180) {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(async () => {
    const style = chosenStyle();
    try {
      const config = await ctx.previewFor(style, partial());
      const frame = $("#w-frame"), url = ctx.studio.templates[style.template].url;
      const reload = frame.dataset.src !== new URL(url, location.href).href.replace(/#.*$/, "") + "#preview" || !frame.dataset.ready;
      shown = config;
      await showInFrame(frame, url, config);
      // La plantilla se vuelve a pintar con los datos nuevos: la vista sigue en lo que toca.
      // Recién cargada, se espera también a sus tipografías (mueven los nombres de sitio).
      if (reload) {
        setTimeout(() => aimPreview("auto"), 120);
        frame.contentDocument?.fonts?.ready.then(() => setTimeout(() => aimPreview("keep"), 60)).catch(() => {});
      } else setTimeout(() => aimPreview("keep"), 50); // tras pintarse con el config nuevo
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

// Lleva la vista previa a lo que están rellenando. La web se pinta como en un móvil (390 × 780)
// y, dentro, se desplaza hasta ese punto. En el ordenador se ve el teléfono entero; en el móvil
// la vista previa es una ventana más grande pero más baja, así que además se mueve la web
// dentro de la ventana (--cam) para dejar ese punto en medio. "keep" solo corrige si la
// plantilla, al volver a pintarse, lo ha movido de sitio.
let previewView = "names";
function aimPreview(behavior = "smooth") {
  const frame = $("#w-frame"), box = frame.parentElement;
  let doc, win;
  try { doc = frame.contentDocument; win = frame.contentWindow; } catch { return; }
  if (!doc?.body || !win || !frame.dataset.ready) return;
  const base = Number(box.dataset.baseHeight), s = box.clientWidth / Number(box.dataset.baseWidth), h = box.clientHeight;
  if (!s || !h) return;
  const spot = findSpot(doc, win, previewView, base);
  const max = Math.max(0, doc.documentElement.scrollHeight - base);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  let y = 0, at = 0; // y: desplazamiento dentro de la web · at: punto que debe quedar a la vista
  if (spot?.center) {
    const mid = (spot.top + spot.bottom) / 2;
    y = spot.bottom <= base ? 0 : clamp(mid - base / 2, 0, max); // en la portada, sin moverla
    at = mid - y;
  } else if (spot) {
    y = clamp(spot.top - 8, 0, max);
    at = spot.top - y;
  }
  // Si lo que hay que enseñar no cabe en la ventana (móviles pequeños con el teclado abierto),
  // la web se aleja lo justo y se centra; a los lados, el color de fondo de la propia web.
  const tall = spot?.center ? spot.bottom - spot.top : 0;
  const z = tall * s > h - 28 ? Math.max(s * 0.55, (h - 28) / tall) : s;
  const cam = Math.round(clamp(spot?.center ? at * z - h / 2 : at * z - 8, 0, Math.max(0, base * z - h)));
  const now = Number.parseFloat(box.style.getPropertyValue("--cam")) || 0;
  if (behavior === "keep") {
    const zoom = Number.parseFloat(box.style.getPropertyValue("--z")) || s;
    if (Math.abs(win.scrollY - y) < 40 && Math.abs(now - cam) < 24 && Math.abs(zoom - z) < 0.02) return;
    behavior = "auto";
  }
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) behavior = "auto";
  box.classList.toggle("is-instant", behavior === "auto");
  box.style.setProperty("--cam", `${cam}px`);
  if (z < s) {
    box.style.setProperty("--z", z.toFixed(4));
    box.style.setProperty("--cam-x", `${Math.round((box.clientWidth - Number(box.dataset.baseWidth) * z) / 2)}px`);
    const bg = [doc.body, doc.documentElement].map((el) => win.getComputedStyle(el).backgroundColor).find((c) => c && !/^rgba\(.*,\s*0\)$|^transparent$/.test(c));
    box.style.background = bg || "";
  } else {
    box.style.removeProperty("--z");
    box.style.removeProperty("--cam-x");
    box.style.background = "";
  }
  win.scrollTo({ top: y, behavior });
}

// Dónde está, dentro de la web, lo que están rellenando: { top, bottom } en coordenadas de la
// página, y center si hay que dejarlo en medio (si no, arriba). Se busca por el texto (los
// nombres, el lugar, el año), que vale para cualquier plantilla; si no aparece, su sección.
function findSpot(doc, win, view, base) {
  const sy = win.scrollY;
  const section = (id) => doc.getElementById(`${id}-title`)?.closest("section") || doc.querySelector(`section.${id}, section#${id}`);
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { top: r.top + sy, bottom: r.bottom + sy }; };
  const ev = shown?.event || {};
  if (view === "top") return null;
  if (view === "names") {
    // Los dos nombres juntos. Mientras escriben el primero («M», «Ma»…) se busca sobre todo el
    // segundo, para que la vista no salte a otro texto que también empiece así.
    const [a, b] = ev.couple || [];
    const second = biggestText(doc.body, b, win, 1.6 * base);
    const first = biggestText(doc.body, a, win, 1.6 * base, second?.node);
    const hits = [first, second].filter(Boolean);
    if (!hits.length) { const h1 = box(doc.querySelector("h1")); return h1 && { ...h1, center: true }; }
    const near = hits.length === 2 && Math.abs(hits[0].top - hits[1].top) < 360;
    let both = near ? { top: Math.min(first.top, second.top), bottom: Math.max(first.bottom, second.bottom) } : second || first;
    // Si los nombres van en un titular, el titular entero: así no cambia de tamaño a cada letra.
    const head = layoutBox((second || first).node.parentElement.closest("h1, h2"), win);
    if (head && head.bottom - head.top < 0.8 * base) both = { top: Math.min(both.top, head.top), bottom: Math.max(both.bottom, head.bottom) };
    return { ...both, center: true };
  }
  if (view === "venue") {
    const name = shown?.venue?.name;
    const hit = biggestText(section("details") || doc.body, name, win) || biggestText(doc.body, name, win);
    return hit ? { ...hit, center: true } : box(section("details"));
  }
  if (view === "date") {
    // El año, y un poco por encima: el día suele ir en grande justo encima o en la misma línea.
    const sec = section("details");
    const hit = sec && biggestText(sec, String(ev.date || "").slice(0, 4), win);
    return hit ? { top: Math.max(box(sec).top, hit.top - 110), bottom: hit.bottom, center: true } : box(sec);
  }
  return box(section(view) || section("details"));
}

// El texto más grande de la página (o de una sección) que contiene `word`: los nombres de la
// portada antes que los del menú o la firma. En coordenadas de la página, o null. Se mide sin
// las animaciones de la plantilla (offsetTop no cuenta los transform): los nombres que entran
// desde abajo se encuentran donde se van a quedar, no donde están en ese instante.
function biggestText(root, word, win, below = Infinity, skip = null) {
  const needle = String(word || "").trim().toLocaleLowerCase("es");
  if (!root || needle.length < 2) return null;
  const doc = root.ownerDocument;
  const walk = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let best = null, size = 0;
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (n === skip || !n.nodeValue.toLocaleLowerCase("es").includes(needle)) continue;
    const spot = layoutBox(n, win);
    if (!spot || spot.top > below) continue;
    const px = Number.parseFloat(win.getComputedStyle(n.parentElement).fontSize) || 0;
    if (px > size) { size = px; best = { ...spot, node: n }; }
  }
  return best;
}

// Caja de un texto (o de un elemento) en la página, sin transform. null si no se ve.
function layoutBox(text, win) {
  if (!text) return null;
  const el = text.nodeType === 1 ? text : text.parentElement;
  if (el instanceof win.HTMLElement) {
    if (!el.offsetHeight) return null; // oculto
    let top = 0;
    for (let e = el; e; e = e.offsetParent) top += e.offsetTop + (e.clientTop || 0);
    return { top, bottom: top + el.offsetHeight };
  }
  const range = text.ownerDocument.createRange(); // texto dentro de un SVG
  range.selectNodeContents(text);
  const r = range.getBoundingClientRect();
  return r.height ? { top: r.top + win.scrollY, bottom: r.bottom + win.scrollY } : null;
}

// Muestra el paso i: barra, contador, botones y el foco en su primer campo (o en `focus`, el id
// del campo que tocaron en la portada).
function go(i, focus = "") {
  step = Math.max(0, Math.min(STEPS.length - 1, i));
  // Los pasos que se saltan (los nombres ya puestos en la portada) cuentan como hechos.
  for (let k = 0; k <= step; k++) if (!stepsSeen.has(k)) { stepsSeen.add(k); track("paso_generador", { paso: STEPS[k], numero: k + 1 }); }
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
  const field = focus && current.querySelector(`#${CSS.escape(focus)}`);
  if (field) field.focus({ preventScroll: true });
  else if (first && !(STEPS[step] === "estilo" && matchMedia("(pointer: coarse)").matches)) first.focus({ preventScroll: true });
  // El primer campo del paso manda menos que el paso; el que tocaron en la portada, más.
  previewView = field ? FIELD_VIEW[field.id] || STEP_VIEW[STEPS[step]] : STEP_VIEW[STEPS[step]];
  // Estilos en el móvil: una fila que se desliza de lado; el elegido, a la vista.
  if (STEPS[step] === "estilo" && matchMedia(MOBILE).matches) {
    const row = $("#b-styles"), chip = row.querySelector("input:checked")?.closest(".chip");
    if (chip) requestAnimationFrame(() => {
      const r = row.getBoundingClientRect(), c = chip.getBoundingClientRect();
      row.scrollLeft += c.left - r.left - (r.width - c.width) / 2;
    });
  }
  setTimeout(() => aimPreview(), 60);
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
// focus: "a" o "b", el nombre que tocaron en la portada del móvil (se abre con el teclado en él).
export function openBuilder(styleId, { names, focus } = {}) {
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
  stepsSeen = new Set();
  const d = data();
  const field = { a: "b-name-a", b: "b-name-b" }[focus] || "";
  go(!field && names && d.nameA?.trim() && d.nameB?.trim() ? 1 : 0, field);
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
