import { $, esc, sleep, syncScrollLock } from "./util.js";
import { pickRandom } from "./demo.js";

// Formulario "Contadnos lo mínimo": recoge los datos de la pareja (ver wedding.js).
let photos = []; // data URLs ya reducidas
let opener = null;
export const SAMPLE_EMAIL = "ana.y.pablo@example.com"; // el del botón de ejemplo: nunca se guarda como contacto

export function setupBuilder({ studio, demoPhotos = [], onGenerate }) {
  const sheet = $("#builder"), form = $("#builder-form"), err = $("#b-error");
  const available = studio.styles.filter((s) => s.status === "available");

  $("#b-styles").innerHTML = studio.styles.map((s) => `
    <label class="chip">
      <input type="radio" name="style" value="${esc(s.id)}" ${s.status !== "available" ? "disabled" : ""}>
      <span class="swatch" style="--sw-a:${esc(s.swatch[0])};--sw-b:${esc(s.swatch[1])}"></span>
      ${esc(s.name)}${s.status !== "available" ? ' <span class="opt">pronto</span>' : ""}
    </label>`).join("");
  form.elements.style.value = available[0].id;

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
          : `No se pudo leer «${file.name}». Prueba con una foto JPG o PNG.`;
      }
    }
    $("#b-photos").classList.remove("is-busy");
    renderPhotos(max);
  });

  // Para probar rápido: datos inventados y tres fotos de ejemplo al azar, si las hay.
  $("#b-sample").addEventListener("click", async () => {
    const d = new Date(); d.setMonth(d.getMonth() + 10);
    const f = form.elements;
    f.nameA.value = "Ana"; f.nameB.value = "Pablo";
    f.date.value = d.toISOString().slice(0, 10); f.time.value = "18:30";
    f.venue.value = "Cortijo Los Almendros"; f.city.value = "Ronda, Málaga";
    f.email.value = SAMPLE_EMAIL; f.consent.checked = true;
    err.textContent = "";
    photos = [];
    for (const url of pickRandom(demoPhotos, max)) {
      try { photos.push(await shrink(await (await fetch(url)).blob())); } catch { /* foto ilegible: se salta */ }
    }
    renderPhotos(max);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const missing = [["nameA", "b-name-a", "Escribid los dos nombres."], ["nameB", "b-name-b", "Escribid los dos nombres."],
      ["date", "b-date", "Falta la fecha de la boda."], ["time", "b-time", "Falta la hora de la ceremonia."],
      ["venue", "b-venue", "Falta el lugar de la boda."]].find(([k]) => !String(d[k] || "").trim());
    if (missing) { err.textContent = missing[2]; return $(`#${missing[1]}`).focus(); }
    if (d.date < today()) { err.textContent = "La fecha de la boda ya ha pasado. Revisadla."; return $("#b-date").focus(); }
    if (d.date > inYears(4)) { err.textContent = "Revisad la fecha: ¿seguro que es tan lejos?"; return $("#b-date").focus(); }
    if (!/^\S+@\S+\.\S+$/.test(d.email || "")) { err.textContent = "Revisad el email: os enviamos ahí el enlace de vuestra web."; return $("#b-email").focus(); }
    if (!d.consent) { err.textContent = "Marcad la casilla para que podamos escribiros."; return $("#b-consent").focus(); }
    if (d.website) return closeBuilder(); // campo trampa: lo rellena un bot, no una pareja
    err.textContent = "";
    const style = studio.styles.find((s) => s.id === d.style) || available[0];
    closeBuilder();
    onGenerate({
      couple: [d.nameA.trim(), d.nameB.trim()],
      date: d.date, time: d.time,
      venue: d.venue.trim(), city: (d.city || "").trim(),
      email: d.email.trim(),
      photos: [...photos],
    }, style);
  });

  sheet.querySelector("[data-close]").addEventListener("click", closeBuilder);
  sheet.addEventListener("click", (e) => { if (e.target === sheet) closeBuilder(); });
}

const today = () => new Date().toLocaleDateString("sv-SE"); // AAAA-MM-DD en hora local
const inYears = (n) => { const d = new Date(); d.setFullYear(d.getFullYear() + n); return d.toLocaleDateString("sv-SE"); };

export function openBuilder(styleId) {
  opener = document.activeElement;
  const form = $("#builder-form");
  const radio = styleId && form.querySelector(`input[name="style"][value="${CSS.escape(styleId)}"]:not(:disabled)`);
  if (radio) radio.checked = true;
  $("#nudge").hidden = true;
  $("#b-date").min = today();
  $("#builder").hidden = false;
  syncScrollLock();
  $("#b-name-a").focus();
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
    item.querySelector("button").addEventListener("click", () => { photos.splice(i, 1); renderPhotos(max); });
    box.insertBefore(item, add);
  });
  add.hidden = photos.length >= max;
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
