import { $, esc, syncScrollLock, priceLabel, phoneProblem } from "./util.js";

// «Me la quedo»: reservar sin salir de su web. Una ventana encima con las tarifas (la recomendada
// ya marcada) y el móvil; el email ya lo dieron al probar. Si falta (llegaron por un enlace de su
// pareja), sale también el email con su casilla. Una tarifa que se paga al momento (Stripe) va al
// formulario de Tarifas de siempre, que es el que sabe cobrar.
let ctx = null;
let opener = null;

export function setupKeep(context) {
  // { studio, getState, known: () => ({ email, phone, consent }), onReserve: async (contact, tier, state) => {}, onCheckout: (tier, state) => {} }
  ctx = context;
  const { tiers, currency, recommended } = ctx.studio.pricing;
  const badge = ctx.studio.pricing.recommendedLabel || "Recomendada";
  const sheet = $("#keep"), form = $("#keep-form"), err = $("#keep-error"), btn = $("#keep-submit");

  $("#keep-tiers").insertAdjacentHTML("beforeend", tiers.map((t) => `
    <label class="keep-tier">
      <input type="radio" name="tier" value="${esc(t.id)}"${t.id === recommended ? " checked" : ""}>
      <span class="keep-tier__dot" aria-hidden="true"></span>
      <span><span class="keep-tier__name">${esc(t.name)}</span>${t.id === recommended ? `<span class="keep-tier__badge">${esc(badge)}</span>` : ""}</span>
      <span class="keep-tier__price" data-price="${esc(t.id)}">${esc(priceLabel(t.price, currency))}</span>
      <span class="keep-tier__summary">${esc(t.summary)}</span>
    </label>`).join(""));

  form.addEventListener("input", () => { err.textContent = ""; });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    if (d.website) return closeKeep(); // campo trampa: un bot
    const tier = tiers.find((t) => t.id === d.tier);
    const phone = String(d.phone || "").trim();
    const email = String(d.email || "").trim() || ctx.known().email || "";
    const bad = phoneProblem(phone);
    if (!tier) { err.textContent = "Elegid una tarifa."; return form.querySelector("input[name=tier]").focus(); }
    if (bad) { err.textContent = bad; return $("#k-phone").focus(); }
    if (!$("#keep-email-field").hidden && email && !/^\S+@\S+\.\S+$/.test(email)) { err.textContent = "Revisad el email, o dejadlo en blanco."; return $("#k-email").focus(); }
    if (!$("#keep-consent").hidden && !d.consent) { err.textContent = "Marcad la casilla para que podamos escribiros."; return $("#k-consent").focus(); }
    err.textContent = "";
    const state = ctx.getState();
    if (tier.checkout) { closeKeep(); return ctx.onCheckout(tier, state, { phone, email }); }
    btn.disabled = true; btn.textContent = "Reservando…";
    try {
      await ctx.onReserve({ phone, email: email || undefined }, tier, state);
      form.hidden = true;
      const thanks = $("#keep-thanks");
      thanks.innerHTML = `<h3>¡Reservada!</h3>
        <p>Apuntada la tarifa ${esc(tier.name)} (${esc(priceLabel(tier.price, currency))}). Os escribimos por WhatsApp al <strong>${esc(phone)}</strong> para cerrar los detalles y el pago. No se ha cobrado nada.</p>
        <button class="btn btn--small" type="button" data-close-keep>Seguir mirando nuestra web</button>`;
      thanks.hidden = false;
      thanks.querySelector("[data-close-keep]").addEventListener("click", closeKeep);
      thanks.querySelector("[data-close-keep]").focus();
      $("#stage-keep").textContent = "Reservada ✓";
      $("#stage-keep").disabled = true;
      // Ya tenemos su móvil: «Guardarla» sobra (la web les llega con el mensaje de la reserva).
      $("#stage-save").textContent = "Guardada ✓";
      $("#stage-save").disabled = true;
      $("#save-nudge").hidden = true;
    } catch (e) {
      console.error("[WeddingWebs] reserva:", e);
      err.textContent = "No hemos podido enviar la reserva. Revisad la conexión y volved a intentarlo.";
    } finally {
      btn.disabled = false; btn.textContent = "Reservarla · 0 € ahora";
    }
  });

  sheet.querySelector("[data-close]").addEventListener("click", closeKeep);
  sheet.addEventListener("click", (e) => { if (e.target === sheet) closeKeep(); });
}

// Precios de la base de datos: llegan después de pintar.
export function refreshKeepPrices() {
  const { tiers, currency } = ctx.studio.pricing;
  for (const t of tiers) {
    const el = $(`#keep-tiers [data-price="${CSS.escape(t.id)}"]`);
    if (el) el.textContent = priceLabel(t.price, currency);
  }
}

export function openKeep() {
  opener = document.activeElement;
  const known = ctx.known();
  const state = ctx.getState();
  const couple = state?.config?.event?.couple || [];
  $("#keep-names").textContent = couple.filter(Boolean).length === 2 ? `${couple[0]} & ${couple[1]}` : "Vuestra web";
  $("#keep-error").textContent = "";
  if (known.phone && !$("#k-phone").value) $("#k-phone").value = known.phone;
  $("#keep-email-field").hidden = Boolean(known.email);
  $("#keep-consent").hidden = Boolean(known.consent);
  $("#keep").hidden = false;
  syncScrollLock();
  const thanks = $("#keep-thanks");
  if (!thanks.hidden) return thanks.querySelector("button")?.focus();
  // En el móvil, sin abrir el teclado de golpe: que vean antes las tarifas.
  if (!matchMedia("(pointer: coarse)").matches) $(known.phone ? "#keep-submit" : "#k-phone").focus();
  else $("#keep .sheet").focus?.();
}

export function closeKeep() {
  if ($("#keep").hidden) return;
  $("#keep").hidden = true;
  syncScrollLock();
  if (opener?.isConnected) opener.focus();
}

export const keepOpen = () => !$("#keep").hidden;
