import { $, esc, sleep, syncScrollLock } from "./util.js";

// Formulario "Contadnos lo mínimo": recoge los datos de la pareja (ver wedding.js).
let photos = []; // data URLs ya reducidas
let opener = null;

export function setupBuilder({ studio, onGenerate }) {
  const sheet = $("#builder"), form = $("#builder-form"), err = $("#b-error");
  const available = studio.styles.filter((s) => s.status === "available");

  $("#b-styles").innerHTML = studio.styles.map((s) => `
    <label class="chip">
      <input type="radio" name="style" value="${esc(s.id)}" ${s.status !== "available" ? "disabled" : ""}>
      <span class="swatch" style="--sw-a:${esc(s.swatch[0])};--sw-b:${esc(s.swatch[1])}"></span>
      ${esc(s.name)}${s.status !== "available" ? ' <span class="opt">pronto</span>' : ""}
    </label>`).join("");
  form.style.value = available[0].id;

  const max = studio.generator.maxPhotos;
  const input = $("#b-photo-input");
  input.addEventListener("change", async () => {
    const files = [...input.files].slice(0, max - photos.length);
    input.value = "";
    err.textContent = "";
    $("#b-photos").classList.add("is-busy");
    for (const file of files) {
      try { photos.push(await shrink(file)); }
      catch { err.textContent = `No se pudo leer «${file.name}». Prueba con una foto JPG o PNG.`; }
    }
    $("#b-photos").classList.remove("is-busy");
    renderPhotos(max);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const missing = [["nameA", "b-name-a", "Escribid los dos nombres."], ["nameB", "b-name-b", "Escribid los dos nombres."],
      ["date", "b-date", "Falta la fecha de la boda."], ["time", "b-time", "Falta la hora de la ceremonia."],
      ["venue", "b-venue", "Falta el lugar de la boda."]].find(([k]) => !String(d[k] || "").trim());
    if (missing) { err.textContent = missing[2]; return $(`#${missing[1]}`).focus(); }
    err.textContent = "";
    const style = studio.styles.find((s) => s.id === d.style) || available[0];
    closeBuilder();
    onGenerate({
      couple: [d.nameA.trim(), d.nameB.trim()],
      date: d.date, time: d.time,
      venue: d.venue.trim(), city: (d.city || "").trim(),
      photos: [...photos],
    }, style);
  });

  sheet.querySelector("[data-close]").addEventListener("click", closeBuilder);
  sheet.addEventListener("click", (e) => { if (e.target === sheet) closeBuilder(); });
}

export function openBuilder(styleId) {
  opener = document.activeElement;
  const form = $("#builder-form");
  const radio = styleId && form.querySelector(`input[name="style"][value="${CSS.escape(styleId)}"]:not(:disabled)`);
  if (radio) radio.checked = true;
  $("#nudge").hidden = true;
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

// Reduce la foto a 1400 px de lado mayor en JPEG: cabe de sobra en un postMessage
// y en la vista previa, y no sale del navegador.
function shrink(file, maxSide = 1400) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.82));
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
