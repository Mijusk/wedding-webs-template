import { $, esc, sleep, session } from "./util.js";
import { phoneError } from "./send.js";

// «¿Dónde os la mandamos?»: la primera vez que ven su web (nombres + estilo), se ve medio segundo
// y se desenfoca detrás de una tarjeta que pide el móvil para mandársela por WhatsApp. Así se les
// puede ayudar a decidirse. Se puede cerrar (la X), y entonces la ven igual; sale una vez por visita.
//
// Prueba A/B (studio.json > phoneGate): a una parte de las visitas les sale y al resto no. Cada
// navegador se queda siempre en su grupo, y todos los eventos de Umami llevan { grupo_movil }.
// Para probarlo a mano: ?ab=tarjeta (sale siempre) o ?ab=sin (no sale nunca).
const KEY = "ww-ab-movil";
let ctx = null;
let group = "sin";
let resolveOpen = null;

export function setupGate(context) {
  ctx = context; // { config: studio.phoneGate, onSave(contact) -> Promise, onEvent(name, data) }
  group = pickGroup(ctx.config);

  const form = $("#gate-form"), err = $("#gate-error"), btn = $("#gate-submit");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const phone = String(d.phone || "").trim();
    const bad = phoneError(phone);
    if (bad) { err.textContent = bad; return $("#g-phone").focus(); }
    if (!d.consent) { err.textContent = "Marcad la casilla para que podamos escribiros."; return $("#g-consent").focus(); }
    if (d.website) return close("bot"); // campo trampa
    err.textContent = "";
    btn.disabled = true;
    btn.textContent = "Un momento…";
    try {
      await ctx.onSave({ phone, email: "", consentText: $("label[for=g-consent] span").textContent.replace(/\s+/g, " ").trim() });
      ctx.onEvent("tarjeta_movil", { accion: "dejado" });
      $("#gate-card").classList.add("is-done");
      $("#gate-done").hidden = false;
      await sleep(matchMedia("(prefers-reduced-motion: reduce)").matches ? 900 : 1500);
      close("dejado");
    } catch {
      err.textContent = "No hemos podido guardarlo. Revisad la conexión y volved a intentarlo, o cerrad y miradla igual.";
    } finally {
      btn.disabled = false;
      btn.textContent = "Verla y recibirla por WhatsApp";
    }
  });
  $("#gate-close").addEventListener("click", () => { ctx.onEvent("tarjeta_movil", { accion: "cerrada" }); close("cerrada"); });
}

// A qué grupo va esta visita: "tarjeta" (le sale) o "sin". Se guarda para que no cambie.
function pickGroup(cfg = {}) {
  const forced = new URLSearchParams(location.search).get("ab");
  if (forced === "tarjeta" || forced === "sin") return forced;
  if (!cfg?.enabled) return "sin";
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "tarjeta" || saved === "sin") return saved;
    const g = Math.random() < (Number(cfg.share) || 0) ? "tarjeta" : "sin";
    localStorage.setItem(KEY, g);
    return g;
  } catch { return "sin"; } // sin almacenamiento, sin tarjeta: que no le salga cada vez
}

export const gateGroup = () => group;

// ¿Toca enseñarla ahora? Solo en su grupo, una vez por visita y si aún no nos han dejado el móvil.
export const gateDue = (wedding) => group === "tarjeta" && !session.get("ww-gate") && !wedding?.sample && !wedding?.shared;

// Enseña la tarjeta sobre su web (que ya se está viendo). Se cumple cuando la cierran o lo dejan.
export async function openGate(wedding) {
  session.set("ww-gate", "1");
  await sleep(matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 600); // medio segundo viéndola
  if ($("#stage").hidden) return;
  const [a, b] = wedding.couple;
  $("#gate-title").innerHTML = `¡Ya está lista, ${esc(a)} y ${esc(b)}!`;
  $("#gate-error").textContent = "";
  $("#gate-done").hidden = true;
  $("#gate-card").classList.remove("is-done");
  $("#stage").classList.add("is-gated");
  $("#gate").hidden = false;
  ctx.onEvent("tarjeta_movil", { accion: "vista" });
  // En el móvil, sin abrir el teclado de golpe: que primero lean la tarjeta.
  if (!matchMedia("(pointer: coarse)").matches) $("#g-phone").focus({ preventScroll: true });
  else $("#gate-close").focus({ preventScroll: true });
  return new Promise((resolve) => { resolveOpen = resolve; });
}

export const gateOpen = () => !$("#gate").hidden;

export function close(how = "cerrada") {
  if ($("#gate").hidden) return;
  $("#gate").hidden = true;
  $("#stage").classList.remove("is-gated");
  resolveOpen?.(how);
  resolveOpen = null;
}
