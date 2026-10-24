// Prepara las fotos de una boda sin perder calidad:
// - JPG/WebP que ya caben (≤ 2560 px) y están derechos: se guardan tal cual, byte a byte; a los
//   JPG solo se les quitan los bloques de metadatos (EXIF con el GPS, XMP, IPTC), sin recomprimir.
// - Lo demás (más grandes, giradas por EXIF, PNG): se dibuja a ≤ 2560 px y se guarda en JPG al 92 %.
// La portada se encuadra pulsando sobre la foto, viendo la web real en móvil y ordenador.
import { fillWebSelect, esc, writeFile } from "./webs.js";
import { prepare } from "../lib/fotos.js";

const $ = (s) => document.querySelector(s);

let photos = []; // { name, blob, url, width, height, kept, note, level }
let focus = { x: 50, y: 50 };
let base = null; // config.json de la web elegida

async function init() {
  const found = await fillWebSelect($("#web"));
  if (!found) return status("No encuentro ninguna web con config.json. Abre esta página desde el servidor de la web (npx serve .).", "error");
  $("#web").addEventListener("change", loadWeb);
  $("#files").addEventListener("change", () => { add([...$("#files").files]); $("#files").value = ""; });
  const drop = $("#drop");
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("is-over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("is-over"); add([...e.dataTransfer.files]); });
  $("#list").addEventListener("click", onListClick);
  setupFocus();
  $("#save").addEventListener("click", save);
  $("#dl").addEventListener("click", download);
  if (!("showDirectoryPicker" in window)) { $("#save").hidden = true; $("#dl").classList.remove("ghost"); }
  for (const box of document.querySelectorAll(".preview__box")) {
    const { w, h, scale } = box.dataset;
    Object.assign(box.style, { width: `${w * scale}px`, height: `${h * scale}px` });
    Object.assign(box.querySelector("iframe").style, { width: `${w}px`, height: `${h}px`, transform: `scale(${scale})` });
  }
  addEventListener("message", (e) => {
    if (e.origin === location.origin && e.data?.type === "wedding:ready") sendPreview(e.source);
  });
  await loadWeb();
}

async function loadWeb() {
  const webUrl = new URL($("#web").value, location.href).href;
  base = await (await fetch(webUrl + "config.json", { cache: "no-store" })).json();
  const [x, y] = String(base.event.photoFocus || "50% 50%").split(/\s+/).map(parseFloat);
  focus = { x: x || 50, y: y || 50 };
  for (const box of document.querySelectorAll(".preview__box iframe")) box.src = `${webUrl}#preview`;
  refresh();
}

// ── Preparar cada foto ─────────────────────────────────────────

async function add(files) {
  status("Preparando fotos…");
  if (!usable().length) focus = { x: 50, y: 50 }; // el encuadre del config era de la foto de ejemplo
  for (const file of files) {
    try { photos.push(await prepare(file)); }
    catch (e) { photos.push({ name: file.name, error: e.message }); }
    refresh();
  }
  status("");
}

// ── Lista, portada y vista previa ─────────────────────────────

const usable = () => photos.filter((p) => !p.error);
const fileName = (p, i) => (i === 0 ? `portada.${p.ext}` : `foto-${i + 1}.${p.ext}`);
const kb = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

function refresh() {
  const ok = usable();
  $("#list").innerHTML = photos.map((p, i) => p.error ? `
    <li class="photo-item"><span></span><div><h3>${esc(p.name)}</h3><p class="bad">${esc(p.error)}</p></div>
      <div class="photo-actions"><button class="ghost" type="button" data-act="remove" data-i="${i}" aria-label="Quitar">✕</button></div></li>` : `
    <li class="photo-item">
      <img src="${p.url}" alt="">
      <div>
        <h3>${esc(p.name)}${ok[0] === p ? '<span class="tag-cover">Portada</span>' : ""}</h3>
        <p class="muted">${p.width}×${p.height} px · ${kb(p.blob.size)} · se guarda como ${esc(fileName(p, ok.indexOf(p)))}</p>
        <p class="${p.level}">${esc(p.note)}</p>
      </div>
      <div class="photo-actions">
        ${ok[0] !== p ? `<button class="ghost" type="button" data-act="cover" data-i="${i}">Portada</button>` : ""}
        <button class="ghost" type="button" data-act="up" data-i="${i}" aria-label="Subir" ${i === 0 ? "disabled" : ""}>↑</button>
        <button class="ghost" type="button" data-act="remove" data-i="${i}" aria-label="Quitar">✕</button>
      </div>
    </li>`).join("");
  $("#cover-panel").hidden = !ok.length;
  $("#save").disabled = $("#dl").disabled = !ok.length;
  if (ok.length && $("#focus-img").src !== ok[0].url) $("#focus-img").src = ok[0].url;
  placeDot();
  $("#block").value = ok.length ? JSON.stringify(patch(structuredClone(base || {}), ok.map((p, i) => `assets/${fileName(p, i)}`)), null, 2) : "";
  document.querySelectorAll(".preview__box iframe").forEach((f) => sendPreview(f.contentWindow));
}

function onListClick(e) {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const i = Number(btn.dataset.i);
  if (btn.dataset.act === "remove") { const [p] = photos.splice(i, 1); if (p.url) URL.revokeObjectURL(p.url); }
  if (btn.dataset.act === "up" && i > 0) [photos[i - 1], photos[i]] = [photos[i], photos[i - 1]];
  if (btn.dataset.act === "cover") { photos.unshift(...photos.splice(i, 1)); focus = { x: 50, y: 50 }; }
  refresh();
}

function setupFocus() {
  const box = $("#focus");
  let down = false;
  const set = (e) => {
    const r = $("#focus-img").getBoundingClientRect();
    focus = {
      x: Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100))),
      y: Math.round(Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100))),
    };
    placeDot();
    $("#block").value = JSON.stringify(patch(structuredClone(base), usable().map((p, i) => `assets/${fileName(p, i)}`)), null, 2);
    document.querySelectorAll(".preview__box iframe").forEach((f) => sendPreview(f.contentWindow));
  };
  box.addEventListener("pointerdown", (e) => { down = true; box.setPointerCapture(e.pointerId); set(e); });
  box.addEventListener("pointermove", (e) => { if (down) set(e); });
  box.addEventListener("pointerup", () => { down = false; });
}

function placeDot() {
  Object.assign($("#focus-dot").style, { left: `${focus.x}%`, top: `${focus.y}%` });
}

// Pone las fotos en el config igual que el generador del escaparate: portada, galería y, en
// Editorial, una foto por capítulo de la historia.
function patch(config, srcs) {
  if (!srcs.length) return config;
  config.event = { ...config.event, photo: srcs[0], photoFocus: `${focus.x}% ${focus.y}%` };
  if ("gallery" in config || srcs.length > 1) config.gallery = srcs.slice(1);
  config.story?.chapters?.forEach((c, i) => { if (srcs[i + 1]) { c.photo = srcs[i + 1]; delete c.photoFocus; } });
  return config;
}

function sendPreview(win) {
  if (!win || !base) return;
  const ok = usable();
  const config = ok.length ? patch(structuredClone(base), ok.map((p) => p.url)) : base;
  win.postMessage({ type: "wedding:config", config }, location.origin);
}

// ── Guardar ───────────────────────────────────────────────────

async function save() {
  const ok = usable();
  try {
    const dir = await showDirectoryPicker({ id: "web-boda", mode: "readwrite" });
    let cfgText;
    try { cfgText = await (await (await dir.getFileHandle("config.json")).getFile()).text(); }
    catch { return status("En esa carpeta no hay config.json. Elige la carpeta de la web.", "error"); }
    const cfg = JSON.parse(cfgText);
    if (cfg.event?.couple?.join() !== base.event.couple.join()) return status("El config.json de esa carpeta es de otra pareja. Elige la carpeta de esta web.", "error");
    const assets = await dir.getDirectoryHandle("assets", { create: true });
    const names = ok.map((p, i) => fileName(p, i));
    for (const [i, p] of ok.entries()) await writeFile(assets, names[i], p.blob);
    await writeFile(dir, "config.json", `${JSON.stringify(patch(cfg, names.map((n) => `assets/${n}`)), null, 2)}\n`);
    status(`Guardadas ${ok.length} fotos y actualizado el config.json. Ahora rehaz la tarjeta en Compartir.`, "ok");
  } catch (e) {
    if (e.name !== "AbortError") status(`No se ha podido guardar: ${e.message}`, "error");
  }
}

function download() {
  usable().forEach((p, i) => Object.assign(document.createElement("a"), { href: p.url, download: fileName(p, i) }).click());
  status("Descargadas. Ponlas en la carpeta assets/ de la web y copia los cambios de abajo en su config.json.", "ok");
  $("details").open = true;
}

function status(text, kind = "") {
  $("#status").textContent = text;
  $("#status").className = `status ${kind}`;
}

init();
