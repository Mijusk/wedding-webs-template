import { $, syncScrollLock } from "./util.js";
import { showInFrame, fitScaled } from "./preview.js";
import { track } from "./analytics.js";

// Primer paso del «Probar»: solo los dos nombres, con su web cambiando al lado según escriben.
// Después eligen estilo en la cuadrícula (picker.js) y ven la web con datos de ejemplo; fecha,
// lugar y fotos se cambian luego encima de la propia web (edit.js), si quieren.
let opener = null;
let ctx = null;
let styleId = ""; // el estilo que ya habían elegido (tarjeta de la portada), o "" para elegirlo después

export function setupBuilder(context) {
  ctx = context; // { studio, previewFor, onNames(names, styleId, { sample }) }
  const sheet = $("#builder"), form = $("#builder-form"), err = $("#b-error");
  fitScaled($(".wizard__phone .scaled"));
  // En el móvil la ventana de la vista previa crece y encoge con el teclado: se vuelve a apuntar.
  let boxH = 0;
  new ResizeObserver(([e]) => {
    const h = Math.round(e.contentRect.height);
    if (h && Math.abs(h - boxH) > 2 && !sheet.hidden) { boxH = h; aimPreview("auto"); }
  }).observe($(".wizard__phone .scaled"));

  // Para probar rápido: una pareja inventada, y a elegir estilo.
  $("#b-sample").addEventListener("click", () => {
    form.elements.nameA.value = "Ana"; form.elements.nameB.value = "Pablo";
    finish(true);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (validNames()) finish(false);
  });
  // Enter (o «Siguiente» en el teclado del móvil) en el primer nombre pasa al segundo.
  form.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.target.id !== "b-name-a" || !e.target.value.trim()) return;
    e.preventDefault();
    $("#b-name-b").focus();
  });
  form.addEventListener("input", () => { err.textContent = ""; livePreview(380); });

  sheet.querySelector("[data-close]").addEventListener("click", closeBuilder);
  sheet.addEventListener("click", (e) => { if (e.target === sheet) closeBuilder(); });
}

const names = () => {
  const f = $("#builder-form").elements;
  return [f.nameA.value.trim(), f.nameB.value.trim()];
};

function finish(sample) {
  if ($("#builder-form").elements.website.value) return closeBuilder(); // campo trampa: un bot
  track("paso_generador", { paso: "nombres", numero: 1 });
  closeBuilder();
  ctx.onNames(names(), styleId, { sample });
}

function chosenStyle() {
  const available = ctx.studio.styles.filter((s) => s.status === "available");
  return available.find((s) => s.id === styleId) || available[0];
}

let previewTimer = 0;
let shown = null; // el último config enviado a la vista previa (para encontrar en ella los nombres)
function livePreview(delay = 180) {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(async () => {
    const style = chosenStyle();
    try {
      const config = await ctx.previewFor(style, { couple: names() });
      const frame = $("#w-frame"), url = ctx.studio.templates[style.template].url;
      const reload = frame.dataset.src !== new URL(url, location.href).href.replace(/#.*$/, "") + "#preview" || !frame.dataset.ready;
      shown = config;
      await showInFrame(frame, url, config);
      // Recién cargada, se espera también a sus tipografías (mueven los nombres de sitio).
      if (reload) {
        setTimeout(() => aimPreview("auto"), 120);
        frame.contentDocument?.fonts?.ready.then(() => setTimeout(() => aimPreview("keep"), 60)).catch(() => {});
      } else setTimeout(() => aimPreview("keep"), 50);
    } catch (e) { console.error("[WeddingWebs] vista previa en vivo:", e); }
  }, delay);
}

function validNames() {
  const [a, b] = names(), err = $("#b-error");
  const fail = (id) => { err.textContent = "Escribid los dos nombres."; $(`#${id}`).focus(); return false; };
  if (!a) return fail("b-name-a");
  if (!b) return fail("b-name-b");
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

// id: el estilo ya elegido (si vienen de una tarjeta), o nada para elegirlo en la cuadrícula.
// names: los que ya hubieran escrito. focus: "a" o "b", el nombre que tocaron en la portada del
// móvil (se abre con el teclado en él).
export function openBuilder(id = "", { names: given, focus } = {}) {
  opener = document.activeElement;
  styleId = id || "";
  const form = $("#builder-form");
  if (given?.[0]) form.elements.nameA.value = given[0];
  if (given?.[1]) form.elements.nameB.value = given[1];
  $("#w-next").innerHTML = styleId ? "Ver nuestra web" : "Elegir estilo <span aria-hidden=\"true\">→</span>";
  $("#b-error").textContent = "";
  $("#nudge").hidden = true;
  $("#builder").hidden = false;
  syncScrollLock();
  const [a, b] = names();
  const field = $(`#${{ a: "b-name-a", b: "b-name-b" }[focus] || (!a ? "b-name-a" : !b ? "b-name-b" : "b-name-a")}`);
  // En el móvil, sin abrir el teclado si ya están los dos (salvo que hayan tocado uno).
  if (focus || !(a && b) || !matchMedia("(pointer: coarse)").matches) field.focus({ preventScroll: true });
  previewView = "names";
  livePreview(0);
}

export function closeBuilder() {
  if ($("#builder").hidden) return;
  $("#builder").hidden = true;
  syncScrollLock();
  if (opener?.isConnected && $("#stage").hidden && $("#picker").hidden) opener.focus();
}

// Reduce la foto (File o Blob) a 2000 px de lado mayor en JPEG de calidad alta: la pareja tiene
// que ver sus fotos bien en la prueba. Cabe en un postMessage y no sale del navegador.
export function shrink(file, maxSide = 2000) {
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

