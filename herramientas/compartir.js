// Prepara una web de boda para compartirla: dibuja la imagen de la tarjeta de WhatsApp
// (1200×630) y el icono con las iniciales usando las fuentes y colores de su propia
// plantilla, y escribe la cabecera del index.html (título, og:*, icono).
// WhatsApp no ejecuta JavaScript: todo esto tiene que estar escrito en el HTML publicado.
import { fillWebSelect, esc, writeFile as write } from "./webs.js";

const $ = (s) => document.querySelector(s);
const W = 1200, H = 630, ICON = 192;
const START = /<!-- compartir:start[\s\S]*?<!-- compartir:end -->/;

let current = null; // { config, webUrl, shot: Blob, icon: Blob }

const remember = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
const recall = (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } };

async function init() {
  const found = await fillWebSelect($("#web"));
  $("#web").addEventListener("change", load);
  $("#url").addEventListener("input", () => { remember(`compartir:${$("#web").value}`, $("#url").value.trim()); paint(); });
  $("#save").addEventListener("click", save);
  $("#dl").addEventListener("click", download);
  if (!("showDirectoryPicker" in window)) {
    $("#save").hidden = true;
    $("#dl").classList.remove("ghost");
  }
  if (found) load();
  else status("No encuentro ninguna web con config.json. Abre esta página desde el servidor de la web (npx serve .).", "error");
}

// Abre la web tal cual se publicará, en un iframe escondido, para dibujar con sus fuentes y colores.
async function load() {
  current = null;
  $("#save").disabled = $("#dl").disabled = true;
  status("Preparando…");
  const webUrl = new URL($("#web").value, location.href).href;
  $("#url").value = recall(`compartir:${$("#web").value}`);
  try {
    const config = await (await fetch(webUrl + "config.json", { cache: "no-store" })).json();
    const doc = await renderWeb(webUrl);
    const look = lookOf(doc);
    await Promise.all([look.display, look.names, look.body].map((f) => doc.fonts.load(`64px ${f}`).catch(() => {})));
    const photo = config.event.photo ? await loadImage(doc, new URL(config.event.photo, webUrl).href).catch(() => null) : null;
    const shot = await toBlob(drawShot(doc, config, look, photo), "image/jpeg");
    const icon = await toBlob(drawIcon(doc, config, look), "image/png");
    current = { config, webUrl, shot, icon, look };
    $("#shot").src = $("#wa-img").src = URL.createObjectURL(shot);
    $("#icon").src = URL.createObjectURL(icon);
    $("#save").disabled = $("#dl").disabled = false;
    status("");
    paint();
  } catch (e) {
    status(`No se ha podido preparar: ${e.message}`, "error");
  }
}

function renderWeb(webUrl) {
  document.querySelector("iframe.offstage")?.remove();
  const frame = Object.assign(document.createElement("iframe"), { className: "offstage", src: webUrl, title: "web" });
  document.body.append(frame);
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const check = async () => {
      const doc = frame.contentDocument;
      const ready = doc?.readyState === "complete" && doc.querySelector("#app")?.children.length;
      if (ready) {
        await doc.fonts.ready;
        await new Promise((r) => setTimeout(r, 400)); // tema de color (Clásica) y fuentes rezagadas
        return resolve(doc);
      }
      if (Date.now() - t0 > 10000) return reject(new Error("la web no termina de cargar"));
      setTimeout(check, 100);
    };
    frame.addEventListener("load", check, { once: true });
  });
}

// Colores y fuentes de la plantilla, leídos de sus propios tokens CSS.
function lookOf(doc) {
  const css = getComputedStyle(doc.body);
  const v = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const display = v("--font-display", "Georgia, serif");
  return {
    paper: v("--paper", "#faf8f4"),
    ink: v("--ink", "#222"),
    muted: v("--muted", "#777"),
    accent: v("--accent", "#8b5a3c"),
    line: v("--line", "#ddd"),
    display,
    names: v("--font-script", display), // Postal escribe los nombres a pluma
    body: v("--font-body", "system-ui, sans-serif"),
  };
}

function loadImage(doc, src) {
  return new Promise((resolve, reject) => {
    const img = doc.createElement("img");
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("no se pudo leer la foto"));
    img.src = src;
  });
}

const dateLine = ({ event, locale = "es-ES" }) => {
  const s = new Date(`${event.date.slice(0, 10)}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return s;
};

// Imagen 1200×630: la foto a la izquierda, sin tapar caras, y a la derecha los nombres con las
// fuentes y colores de la plantilla. Si WhatsApp la recorta a un cuadrado central, se ven las dos mitades.
function drawShot(doc, config, look, photo) {
  const c = doc.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const split = photo ? W / 2 : 0;
  g.fillStyle = look.paper;
  g.fillRect(0, 0, W, H);
  if (photo) cover(g, photo, 0, 0, split, H, config.event.photoFocus);

  const px = split + 30, pw = W - split - 60;
  g.strokeStyle = look.accent; g.globalAlpha = .45; g.lineWidth = 1.5;
  g.strokeRect(px, 30, pw, H - 60);
  g.globalAlpha = 1;

  const [a, b] = config.event.couple;
  const mid = split + (W - split) / 2;
  const maxW = pw - 90;
  g.textAlign = "center"; g.textBaseline = "alphabetic";

  // Nombres en dos líneas ("Lucía" / "& Martín"), del mismo tamaño, lo más grandes que quepan.
  const size = Math.min(fit(g, a, look.names, 116, maxW), fit(g, `& ${b}`, look.names, 116, maxW));
  const lead = size * 1.02;
  const block = 22 + 40 + lead * 2 + 34 + 40 + 38; // altura aproximada de todo el texto
  let y = (H - block) / 2 + 18;

  g.fillStyle = look.accent;
  g.font = `600 19px ${look.body}`;
  g.letterSpacing = "6px";
  g.fillText("NOS CASAMOS", mid + 3, y);
  g.letterSpacing = "0px";

  y += 26 + lead * 0.82;
  g.fillStyle = look.ink;
  g.font = `400 ${size}px ${look.names}`;
  g.fillText(a, mid, y);
  y += lead;
  g.fillText(`& ${b}`, mid, y);

  y += 44;
  g.fillStyle = look.accent;
  g.fillRect(mid - 30, y, 60, 1.5);
  y += 56;
  g.fillStyle = look.ink;
  g.font = `500 32px ${look.body}`;
  g.fillText(dateLine(config), mid, y);
  const place = config.venue?.city || config.venue?.name || "";
  if (place) {
    g.fillStyle = look.muted;
    g.font = `400 26px ${look.body}`;
    g.fillText(place, mid, y + 40);
  }
  return c;
}

// Icono 192×192: las iniciales en la fuente de la plantilla sobre su color de acento.
function drawIcon(doc, config, look) {
  const c = doc.createElement("canvas");
  c.width = c.height = ICON;
  const g = c.getContext("2d");
  g.fillStyle = look.accent;
  g.beginPath(); g.roundRect(0, 0, ICON, ICON, 40); g.fill();
  const [a, b] = config.event.couple;
  const text = `${a[0]}&${b[0]}`;
  g.fillStyle = look.paper;
  g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `400 ${fit(g, text, look.display, 96, ICON - 44)}px ${look.display}`;
  g.fillText(text, ICON / 2, ICON / 2 + 6);
  return c;
}

function fit(g, text, family, start, maxW) {
  let size = start;
  for (; size > 20; size -= 2) {
    g.font = `400 ${size}px ${family}`;
    if (g.measureText(text).width <= maxW) break;
  }
  return size;
}

// Como object-fit: cover, respetando photoFocus ("50% 30%") si la boda lo tiene.
function cover(g, img, x, y, w, h, focus = "50% 50%") {
  const [fx, fy] = String(focus).split(/\s+/).map((p) => (parseFloat(p) || 50) / 100).concat(0.5).slice(0, 2);
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / s, sh = h / s;
  g.drawImage(img, (img.naturalWidth - sw) * fx, (img.naturalHeight - sh) * fy, sw, sh, x, y, w, h);
}

// JPEG en buena calidad; WhatsApp no muestra imágenes de más de unos 600 KB, así que solo baja
// la calidad si hace falta para quedarse por debajo de 300 KB.
async function toBlob(canvas, type) {
  if (type !== "image/jpeg") return new Promise((r) => canvas.toBlob(r, type));
  for (const q of [0.92, 0.88, 0.84, 0.8]) {
    const blob = await new Promise((r) => canvas.toBlob(r, type, q));
    if (blob.size <= 300 * 1024 || q === 0.8) return blob;
  }
}

function publicUrl() {
  const raw = $("#url").value.trim();
  if (!raw) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!u.pathname.endsWith("/")) u.pathname += "/";
    return u.href;
  } catch { return ""; }
}

function texts(config) {
  const [a, b] = config.event.couple;
  const place = config.venue?.city || config.venue?.name || "";
  return {
    title: `${a} y ${b} se casan`,
    description: `${dateLine(config)}${place ? ` · ${place}` : ""}. Toda la información y la confirmación de asistencia.`,
    pageTitle: `${a} y ${b}`,
  };
}

function headBlock(config, look, url) {
  const t = texts(config);
  const img = url ? `${url}compartir.jpg` : "compartir.jpg";
  return `<!-- compartir:start · lo escribe herramientas/compartir.html; WhatsApp no ejecuta JavaScript -->
<title>${esc(t.pageTitle)}</title>
<!-- Web privada de la pareja: que no salga en Google. -->
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="${esc(t.description)}">
<meta name="theme-color" content="${esc(look.paper)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_ES">
<meta property="og:title" content="${esc(t.title)}">
<meta property="og:description" content="${esc(t.description)}">
${url ? `<meta property="og:url" content="${esc(url)}">\n` : ""}<meta property="og:image" content="${esc(img)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="${W}">
<meta property="og:image:height" content="${H}">
<meta property="og:image:alt" content="${esc(t.pageTitle)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="icono.png">
<link rel="apple-touch-icon" href="icono.png">
<!-- compartir:end -->`;
}

function paint() {
  if (!current) return;
  const url = publicUrl();
  const t = texts(current.config);
  $("#wa-title").textContent = t.title;
  $("#wa-desc").textContent = t.description;
  $("#wa-host").textContent = url ? new URL(url).host : "";
  $("#wa-url").textContent = url || "(falta la dirección)";
  $("#url-note").textContent = url
    ? "WhatsApp guarda la tarjeta la primera vez que alguien manda el enlace: prepárala antes de compartirlo."
    : "Sin la dirección completa WhatsApp no puede mostrar la foto. Puedes guardar igualmente y volver a hacerlo cuando la tengas.";
  $("#block").value = headBlock(current.config, current.look, url);
}

async function save() {
  if (!current) return;
  try {
    const dir = await showDirectoryPicker({ id: "web-boda", mode: "readwrite" });
    const read = async (name) => (await (await dir.getFileHandle(name)).getFile()).text();
    let html, cfg;
    try { [html, cfg] = await Promise.all([read("index.html"), read("config.json")]); }
    catch { return status("En esa carpeta no hay index.html y config.json. Elige la carpeta de la web.", "error"); }
    if (JSON.parse(cfg).event?.couple?.join() !== current.config.event.couple.join()) {
      return status("El config.json de esa carpeta es de otra pareja. Elige la carpeta de esta web.", "error");
    }
    if (!START.test(html)) return status("El index.html no tiene las marcas compartir:start y compartir:end. Pega la cabecera a mano.", "error");
    await write(dir, "compartir.jpg", current.shot);
    await write(dir, "icono.png", current.icon);
    await write(dir, "index.html", html.replace(START, headBlock(current.config, current.look, publicUrl())));
    status(publicUrl() ? "Guardado. Sube los cambios y la tarjeta saldrá al compartir el enlace." : "Guardado, pero sin dirección: vuelve a guardar cuando sepas dónde se publica.", "ok");
  } catch (e) {
    if (e.name !== "AbortError") status(`No se ha podido guardar: ${e.message}`, "error");
  }
}


function download() {
  if (!current) return;
  for (const [name, blob] of [["compartir.jpg", current.shot], ["icono.png", current.icon]]) {
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
    a.click();
  }
  status("Descargados. Ponlos en la carpeta de la web y pega la cabecera de abajo en su index.html.", "ok");
  $("details").open = true;
}

function status(text, kind = "") {
  $("#status").textContent = text;
  $("#status").className = `status ${kind}`;
}

init();
