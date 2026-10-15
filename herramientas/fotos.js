// Prepara las fotos de una boda sin perder calidad:
// - JPG/WebP que ya caben (≤ 2560 px) y están derechos: se guardan tal cual, byte a byte; a los
//   JPG solo se les quitan los bloques de metadatos (EXIF con el GPS, XMP, IPTC), sin recomprimir.
// - Lo demás (más grandes, giradas por EXIF, PNG): se dibuja a ≤ 2560 px y se guarda en JPG al 92 %.
// La portada se encuadra pulsando sobre la foto, viendo la web real en móvil y ordenador.
import { fillWebSelect, esc, writeFile } from "./webs.js";

const $ = (s) => document.querySelector(s);
const MAX_SIDE = 2560;
const QUALITY = 0.92;
const SMALL = 1600; // por debajo, en pantallas grandes se nota blanda

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

async function prepare(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniff(bytes);
  if (type === "heic") throw new Error("Es una foto HEIC de iPhone y el navegador no la abre. Pídela en JPG (o en el iPhone: Ajustes > Cámara > Formatos > Más compatible).");
  if (!type) throw new Error("No es una foto JPG, PNG ni WebP.");

  const bitmap = await createImageBitmap(new Blob([bytes], { type: `image/${type}` }), { imageOrientation: "from-image" });
  const { width, height } = bitmap;
  const orientation = type === "jpeg" ? exifOrientation(bytes) : 1;
  const fits = Math.max(width, height) <= MAX_SIDE;

  let blob, note, kept = false;
  if (fits && type === "jpeg" && orientation === 1) {
    blob = new Blob([stripJpegMetadata(bytes)], { type: "image/jpeg" });
    note = "Se queda tal cual: misma calidad, sin datos internos.";
    kept = true;
  } else if (fits && type === "webp") {
    blob = new Blob([bytes], { type: "image/webp" });
    note = "Se queda tal cual.";
    kept = true;
  } else {
    const k = Math.min(1, MAX_SIDE / Math.max(width, height));
    const canvas = resize(bitmap, Math.round(width * k), Math.round(height * k));
    blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", QUALITY));
    note = k < 1 ? `Reducida a ${canvas.width}×${canvas.height} px, calidad ${QUALITY * 100} %.`
      : type === "png" ? `Pasada a JPG al ${QUALITY * 100} % (el PNG pesa demasiado para una foto).`
      : `Enderezada y guardada al ${QUALITY * 100} %.`;
  }
  bitmap.close();
  const small = Math.max(width, height) < SMALL;
  return {
    name: file.name, blob, url: URL.createObjectURL(blob), width, height, kept,
    note: small ? `${note} Es pequeña (${width}×${height} px): en pantallas grandes se verá algo blanda; si la pareja la tiene en más resolución, mejor.` : note,
    level: small ? "warn" : "good",
    ext: blob.type === "image/webp" ? "webp" : "jpg",
  };
}

function sniff(b) {
  if (b[0] === 0xff && b[1] === 0xd8) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  const ascii = (i, n) => String.fromCharCode(...b.slice(i, i + n));
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "webp";
  if (ascii(4, 4) === "ftyp" && /hei|mif|avi/.test(ascii(8, 4))) return "heic";
  return "";
}

// Recorre los bloques de cabecera de un JPG hasta el inicio de la imagen (SOS).
function* jpegSegments(b) {
  let i = 2;
  while (i + 4 <= b.length && b[i] === 0xff) {
    const marker = b[i + 1];
    if (marker === 0xda) return yield { marker, start: i, end: b.length, rest: true };
    const len = (b[i + 2] << 8) | b[i + 3];
    yield { marker, start: i, end: i + 2 + len };
    i += 2 + len;
  }
}

function exifOrientation(b) {
  for (const s of jpegSegments(b)) {
    if (s.marker !== 0xe1 || String.fromCharCode(...b.slice(s.start + 4, s.start + 8)) !== "Exif") continue;
    const t = s.start + 10, le = b[t] === 0x49;
    const u16 = (o) => le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1];
    const u32 = (o) => le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
    const ifd = t + u32(t + 4);
    for (let n = u16(ifd), e = ifd + 2; n > 0; n--, e += 12) if (u16(e) === 0x0112) return u16(e + 8) || 1;
  }
  return 1;
}

// Quita EXIF/XMP (APP1), IPTC (APP13) y comentarios sin tocar la imagen. Se queda el perfil de
// color (APP2) para que los colores no cambien.
function stripJpegMetadata(b) {
  const parts = [b.slice(0, 2)];
  let complete = false;
  for (const s of jpegSegments(b)) {
    complete = Boolean(s.rest);
    if (s.marker === 0xe1 || s.marker === 0xed || s.marker === 0xfe) continue;
    parts.push(b.slice(s.start, s.end));
  }
  return complete ? new Blob(parts) : new Blob([b]); // cabecera rara: mejor no tocarla
}

// Reducción en pasos de la mitad: más nítida que un solo salto grande.
function resize(bitmap, w, h) {
  let src = bitmap, sw = bitmap.width, sh = bitmap.height;
  while (sw / 2 >= w) {
    const c = new OffscreenCanvas(Math.round(sw / 2), Math.round(sh / 2));
    const g = c.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.drawImage(src, 0, 0, c.width, c.height);
    src = c; sw = c.width; sh = c.height;
  }
  const out = document.createElement("canvas");
  out.width = w; out.height = h;
  const g = out.getContext("2d");
  g.imageSmoothingQuality = "high";
  g.drawImage(src, 0, 0, w, h);
  return out;
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
