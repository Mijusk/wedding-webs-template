import { $, esc, syncScrollLock } from "./util.js";

// «¿Os la guardamos?»: el email se pide cuando ya han visto su web, no antes. Se abre desde
// «Guardarla» en la barra y desde el aviso que sale un rato después de abrirla (una vez).
let ctx = null;
let opener = null;
let nudgeTimer = 0;
let nudged = false;

export function setupSend(context) {
  ctx = context; // { getState: () => ({ wedding, style }), onSave: async (email, state) => {} }
  const sheet = $("#send"), form = $("#send-form"), err = $("#send-error"), btn = $("#send-submit");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const phone = String(d.phone || "").trim(), email = String(d.email || "").trim();
    const digits = phone.replace(/\D/g, "");
    if (!phone) { err.textContent = "Dejadnos vuestro móvil: os mandamos ahí el enlace de vuestra web."; return $("#b-phone").focus(); }
    if (digits.length < 9 || digits.length > 15 || /[^\d\s+().-]/.test(phone)) { err.textContent = "Revisad el móvil: parece que le falta o le sobra algún número."; return $("#b-phone").focus(); }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) { err.textContent = "Revisad el email, o dejadlo en blanco."; return $("#b-email").focus(); }
    if (!d.consent) { err.textContent = "Marcad la casilla para que podamos escribiros."; return $("#b-consent").focus(); }
    if (d.website) return closeSend(); // campo trampa: un bot
    err.textContent = "";
    btn.disabled = true; btn.textContent = "Guardando…";
    try {
      await ctx.onSave({ phone, email }, ctx.getState());
      form.hidden = true;
      const thanks = $("#send-thanks");
      thanks.innerHTML = `<h3>¡Guardada!</h3>
        <p>Os mandamos el enlace de vuestra web por WhatsApp al <strong>${esc(phone)}</strong>${email ? ` y por email a <strong>${esc(email)}</strong>` : ""}. Mientras, podéis seguir probando estilos.</p>
        <button class="btn btn--small" type="button" data-close-send>Seguir mirando</button>`;
      thanks.hidden = false;
      thanks.querySelector("[data-close-send]").addEventListener("click", closeSend);
      thanks.querySelector("[data-close-send]").focus();
      $("#stage-save").textContent = "Guardada ✓";
      $("#stage-save").disabled = true;
      hideNudge(true);
    } catch {
      err.textContent = "No hemos podido guardarla. Revisad la conexión y volved a intentarlo.";
    } finally {
      btn.disabled = false; btn.textContent = "Guardadla y mandadme el enlace";
    }
  });

  sheet.querySelector("[data-close]").addEventListener("click", closeSend);
  sheet.addEventListener("click", (e) => { if (e.target === sheet) closeSend(); });
  $("#stage-save").addEventListener("click", () => openSend("barra"));
  $("#save-nudge-yes").addEventListener("click", () => { hideNudge(true); openSend("aviso"); });
  $("#save-nudge-no").addEventListener("click", () => hideNudge(true));
}

export function openSend(from = "barra") {
  opener = document.activeElement;
  ctx.onOpen?.(from);
  $("#send-error").textContent = "";
  $("#send").hidden = false;
  syncScrollLock();
  const thanks = $("#send-thanks");
  // En el móvil, sin abrir el teclado de golpe: primero que vean la hoja entera.
  if (!thanks.hidden) thanks.querySelector("button")?.focus();
  else if (matchMedia("(pointer: coarse)").matches) $("#send [data-close]").focus({ preventScroll: true });
  else $("#b-phone").focus();
}

export function closeSend() {
  if ($("#send").hidden) return;
  $("#send").hidden = true;
  syncScrollLock();
  if (opener?.isConnected) opener.focus();
}

export const sendOpen = () => !$("#send").hidden;

// Cuando ven su propia web (no un ejemplo): pasado un rato, una vez por visita, el aviso pequeño.
export function scheduleSaveNudge(ms = 20000) {
  clearTimeout(nudgeTimer);
  if (nudged || $("#stage-save").disabled) return;
  nudgeTimer = setTimeout(() => {
    if ($("#stage").hidden || $("#stage-save").hidden || sendOpen()) return;
    $("#save-nudge").hidden = false;
    nudged = true;
  }, ms);
}

export function hideNudge(forGood = false) {
  clearTimeout(nudgeTimer);
  $("#save-nudge").hidden = true;
  if (forGood) nudged = true;
}
