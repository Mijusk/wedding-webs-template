import { $, esc, priceLabel } from "./util.js";
import { saveLead } from "./leads.js";

let chosen = null; // { config, style } de la web generada, si la hay

export function setupPricing({ studio, templateUrl }) {
  const { tiers, currency } = studio.pricing;
  $("#tiers").innerHTML = tiers.map((t) => `
    <article class="tier" data-tier="${esc(t.id)}">
      <h3>${esc(t.name)}</h3>
      <p class="tier__price">${esc(priceLabel(t.price, currency))}</p>
      <p class="tier__summary">${esc(t.summary)}</p>
      <ul>${t.includes.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
      <button class="btn btn--ghost" type="button" data-pick="${esc(t.id)}">Elegir ${esc(t.name)}</button>
    </article>`).join("");

  const tierSel = $("#c-tier"), styleSel = $("#c-style");
  tierSel.innerHTML = tiers.map((t) => `<option value="${esc(t.id)}">${esc(t.name)} · ${esc(priceLabel(t.price, currency))}</option>`).join("");
  styleSel.innerHTML = studio.styles.filter((s) => s.status === "available")
    .map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")
    + `<option value="a-medida">Aún no lo sé / a medida</option>`;

  const markTier = () => document.querySelectorAll(".tier").forEach((el) =>
    el.classList.toggle("is-selected", el.dataset.tier === tierSel.value));
  tierSel.addEventListener("change", markTier);
  $("#tiers").addEventListener("click", (e) => {
    const id = e.target.closest("[data-pick]")?.dataset.pick;
    if (!id) return;
    tierSel.value = id;
    if (id === "a-medida") styleSel.value = "a-medida";
    markTier();
    $("#contacto").scrollIntoView({ behavior: "smooth", block: "start" });
    $("#c-name").focus({ preventScroll: true });
  });
  markTier();

  const form = $("#contact-form"), err = $("#c-error");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    if ((d.name || "").trim().length < 2) { err.textContent = "Escribid vuestros nombres."; return $("#c-name").focus(); }
    if (!/^\S+@\S+\.\S+$/.test(d.email || "")) { err.textContent = "Revisad el email: lo necesitamos para escribiros."; return $("#c-email").focus(); }
    err.textContent = "";
    const btn = $("#c-submit");
    btn.disabled = true; btn.textContent = "Enviando…";
    try {
      const { simulated } = await saveLead({ ...d, wedding: chosen ? withoutPhotos(chosen.config) : null }, studio.contact);
      const tier = tiers.find((t) => t.id === d.tier);
      form.hidden = true;
      $("#contact-thanks").innerHTML = `
        <h3>Recibido, gracias</h3>
        <p>Hemos apuntado la tarifa ${esc(tier.name)} (${esc(priceLabel(tier.price, currency))}). Os escribimos a ${esc(d.email)} para cerrar los detalles y el pago.</p>
        ${simulated ? '<p class="note">Esto es una demo: la reserva se ha guardado solo en este navegador y no se ha cobrado nada.</p>' : ""}`;
      $("#contact-thanks").hidden = false;
    } catch {
      err.textContent = "No se pudo enviar. Revisad la conexión y volved a intentarlo.";
      btn.disabled = false; btn.textContent = "Enviar reserva";
    }
  });

  // La web elegida en la vista previa
  setupPricing.choose = ({ config, style }) => {
    chosen = { config, style };
    const [a, b] = config.event.couple;
    const photo = new URL(config.event.photo, templateUrl(style)).href;
    $("#chosen").innerHTML = `<img src="${esc(photo)}" alt=""><p><strong>${esc(a)} & ${esc(b)}</strong>Estilo ${esc(style.name)}, con vuestros datos.</p>`;
    $("#chosen").hidden = false;
    styleSel.value = style.id;
    if (!$("#c-name").value) $("#c-name").value = `${a} y ${b}`;
    $("#tarifas").scrollIntoView({ behavior: "smooth", block: "start" });
  };
}

// Las fotos van como data URLs: demasiado grandes para una celda de Google Sheets.
function withoutPhotos(config) {
  const isData = (s) => String(s).startsWith("data:");
  return {
    ...config,
    event: { ...config.event, photo: isData(config.event.photo) ? "(foto subida por la pareja)" : config.event.photo },
    gallery: (config.gallery || []).map((g) => (isData(g) ? "(foto subida por la pareja)" : g)),
  };
}
