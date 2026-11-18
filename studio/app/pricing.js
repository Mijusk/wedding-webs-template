import { $, esc, priceLabel, fill, roundsLine, CONTACT_EMAIL } from "./util.js";
import { saveLead } from "./leads.js";
import { attribution } from "./attribution.js";
import { conversion } from "./ads.js";
import { validNif } from "../../lib/nif.js";

const writeUs = (studio) => `escribidnos a ${studio.legal?.email || CONTACT_EMAIL}`;
let chosen = null; // { config, style } de la web generada, si la hay

export function setupPricing({ studio, templateUrl }) {
  const { tiers, currency, recommended, roundsText } = studio.pricing;
  const badge = studio.pricing.recommendedLabel || "Recomendada";
  // La recomendada (studio.json > pricing.recommended) lleva distintivo. La elegida en el
  // formulario se marca aparte (.is-selected), y solo cuando la pareja elige.
  $("#tiers").innerHTML = tiers.map((t) => {
    const rec = t.id === recommended;
    const items = [...t.includes, roundsLine(t.rounds, roundsText)].filter(Boolean);
    return `
    <article class="tier${rec ? " tier--recommended" : ""}" data-tier="${esc(t.id)}">
      ${rec ? `<p class="tier__badge">${esc(badge)}</p>` : ""}
      <h3>${esc(t.name)}</h3>
      <p class="tier__price">${esc(priceLabel(t.price, currency))}</p>
      <p class="tier__summary">${esc(t.summary)}</p>
      <ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
      <button class="btn${rec ? "" : " btn--ghost"}" type="button" data-pick="${esc(t.id)}" aria-pressed="false">Elegir ${esc(t.name)}</button>
    </article>`;
  }).join("");
  const g = studio.guarantee;
  if (g?.enabled && g.title) $("#tiers").insertAdjacentHTML("afterend", `<p class="tiers__guarantee">${esc(g.title)}. <a href="legal.html#garantia">Condiciones de la garantía</a></p>`);
  if (studio.pricing.note) $("#tiers").insertAdjacentHTML("afterend", `<p class="fineprint tiers__note">${esc(fill(studio.pricing.note, studio.legal))}</p>`);

  const tierSel = $("#c-tier"), styleSel = $("#c-style");
  tierSel.innerHTML = tiers.map((t) => `<option value="${esc(t.id)}">${esc(t.name)} · ${esc(priceLabel(t.price, currency))}</option>`).join("");
  styleSel.innerHTML = studio.styles.filter((s) => s.status === "available")
    .map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")
    + `<option value="a-medida">Aún no lo sé / a medida</option>`;

  // Tarifas que se pagan al momento (Stripe configurado y precio cerrado): el formulario cambia.
  const FINE_RESERVE = $("#c-fine").innerHTML;
  const tierOf = () => tiers.find((t) => t.id === tierSel.value);
  const syncCheckout = () => {
    const t = tierOf();
    const pay = Boolean(t?.checkout);
    $("#c-checkout").hidden = !pay;
    $("#c-submit").textContent = pay ? `Pagar ${priceLabel(t.price, currency)} y reservar` : "Enviar reserva";
    $("#c-fine").innerHTML = pay
      ? 'Pagáis con tarjeta o Bizum en la página segura de Stripe. Al terminar veréis vuestro pedido con un código, sin contraseña, y os llega la factura por email. Ver <a href="legal.html#condiciones" target="_blank">condiciones</a>.'
      : FINE_RESERVE;
  };
  $("#c-invoice").addEventListener("change", (e) => { $("#c-billing").hidden = !e.target.checked; });
  let picked = false; // hasta que eligen una, ninguna tarjeta sale marcada
  const markTier = () => {
    document.querySelectorAll(".tier").forEach((el) => {
      const on = picked && el.dataset.tier === tierSel.value;
      const btn = el.querySelector("[data-pick]");
      el.classList.toggle("is-selected", on);
      btn.setAttribute("aria-pressed", String(on));
      btn.textContent = on ? "Elegida ✓" : `Elegir ${tiers.find((t) => t.id === el.dataset.tier).name}`;
    });
    syncCheckout();
  };
  tierSel.addEventListener("change", () => { picked = true; markTier(); });
  $("#tiers").addEventListener("click", (e) => {
    const id = e.target.closest("[data-pick]")?.dataset.pick;
    if (!id) return;
    picked = true;
    tierSel.value = id;
    if (id === "a-medida") styleSel.value = "a-medida";
    markTier();
    $("#contacto").scrollIntoView({ behavior: "smooth", block: "start" });
    $("#c-name").focus({ preventScroll: true });
  });
  markTier();

  // Los precios de la base de datos llegan después de pintar la página: se cambian en su sitio.
  setupPricing.refresh = () => {
    for (const t of tiers) {
      const price = $(`.tier[data-tier="${CSS.escape(t.id)}"] .tier__price`);
      if (price) price.textContent = priceLabel(t.price, currency);
      const opt = tierSel.querySelector(`option[value="${CSS.escape(t.id)}"]`);
      if (opt) opt.textContent = `${t.name} · ${priceLabel(t.price, currency)}`;
    }
    syncCheckout();
  };

  const form = $("#contact-form"), err = $("#c-error");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    if ((d.name || "").trim().length < 2) { err.textContent = "Escribid vuestros nombres."; return $("#c-name").focus(); }
    if (!/^\S+@\S+\.\S+$/.test(d.email || "")) { err.textContent = "Revisad el email: lo necesitamos para escribiros."; return $("#c-email").focus(); }
    err.textContent = "";
    if (d.website) { form.hidden = true; return; } // campo trampa: un bot
    delete d.website;
    const btn = $("#c-submit");
    if (tierOf()?.checkout) return pay(d, btn);
    btn.disabled = true; btn.textContent = "Enviando…";
    try {
      const { simulated } = await saveLead({ type: "reserva", ...d, wedding: chosen ? withoutPhotos(chosen.config) : null }, studio.contact);
      const tier = tiers.find((t) => t.id === d.tier);
      conversion("reserva", { tarifa: tier.id, estilo: d.style, valor: tier.price[0] });
      form.hidden = true;
      $("#contact-thanks").innerHTML = `
        <h3>Recibido, gracias</h3>
        <p>Hemos apuntado la tarifa ${esc(tier.name)} (${esc(priceLabel(tier.price, currency))}). Os escribimos a ${esc(d.email)} para cerrar los detalles y el pago.</p>
        ${simulated ? '<p class="note">Esto es una demo: la reserva se ha guardado solo en este navegador y no se ha cobrado nada.</p>' : ""}`;
      $("#contact-thanks").hidden = false;
    } catch (e) {
      console.error("[WeddingWebs] reserva:", e);
      err.textContent = `No se ha podido enviar la reserva. Revisad la conexión y volved a intentarlo; si sigue fallando, ${writeUs(studio)} y lo vemos.`;
      btn.disabled = false; btn.textContent = "Enviar reserva";
    }
  });

  // Pagar al momento: se crea el pedido y se va a la página de pago de Stripe.
  async function pay(d, btn) {
    if (!$("#c-start").checked) { err.textContent = "Para pagar, marcad la casilla «Queremos que empecéis ya»."; return $("#c-start").focus(); }
    let billing;
    if ($("#c-invoice").checked) {
      billing = { nombre: d.bname?.trim(), nif: d.nif?.trim(), direccion: d.addr?.trim(), codigo_postal: d.cp?.trim(), ciudad: d.bcity?.trim(), pais: "ES" };
      if (!billing.nombre || !billing.direccion) { err.textContent = "Para la factura necesitamos el nombre y la dirección."; return $("#c-bname").focus(); }
      if (!validNif(billing.nif)) { err.textContent = "El NIF o NIE no parece correcto (revisad la letra)."; return $("#c-nif").focus(); }
    }
    const c = chosen?.config;
    const [a, b] = c?.event?.couple || [];
    const body = {
      accion: "reservar", email: d.email.trim(), name: d.name.trim(), phone: d.phone?.trim() || undefined,
      tier: d.tier, style: d.style, message: d.message?.trim() || undefined, billing,
      nameA: a, nameB: b, weddingDate: c?.event?.date ? `${c.event.date.slice(0, 10)} ${c.event.date.slice(11, 16)}` : undefined,
      venue: c?.venue?.name, city: c?.venue?.city, wedding: chosen ? withoutPhotos(c) : undefined,
      startNow: true, startNowText: $("#c-start-text").textContent.replace(/\s+/g, " ").trim(),
      attribution: attribution(), page: location.pathname,
    };
    btn.disabled = true; btn.textContent = "Preparando el pago…";
    try {
      const res = await fetch("/api/pedido", { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
      const r = await res.json().catch(() => ({}));
      if (r.ok && r.url) {
        const t = tierOf();
        conversion("reserva", { tarifa: t?.id, estilo: d.style, valor: t?.price[0] });
        await new Promise((ok) => setTimeout(ok, 300)); // que salgan los avisos antes de ir a Stripe
        location.href = r.url;
        return;
      }
      err.textContent = {
        nif: "El NIF o NIE no parece correcto (revisad la letra).",
        email: "Revisad el email: lo necesitamos para escribiros.",
        demasiadas: "Demasiados intentos seguidos. Esperad unos minutos.",
        sin_pagos: "Ahora mismo no podemos cobrar en la web. Elegid otra vez la tarifa y enviad la reserva: os escribimos.",
      }[r.error] || `No se ha podido preparar el pago. Volved a intentarlo; si sigue fallando, ${writeUs(studio)}.`;
      if (r.error === "sin_pagos") tiers.forEach((t) => { t.checkout = false; });
    } catch (e) {
      console.error("[WeddingWebs] pago:", e);
      err.textContent = `No se ha podido preparar el pago. Revisad la conexión y volved a intentarlo; si sigue fallando, ${writeUs(studio)}.`;
    }
    btn.disabled = false;
    syncCheckout();
  }

  // Lo que ya escribieron en el generador no se vuelve a pedir.
  setupPricing.prefill = (w) => {
    if (!$("#c-email").value) $("#c-email").value = w.email;
    if (!$("#c-name").value) $("#c-name").value = w.couple.join(" y ");
  };

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
