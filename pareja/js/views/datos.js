// Datos prácticos que la pareja puede cambiar sola: horario, dirección, regalo, confirmación y
// secciones visibles. El diseño, los textos y las fotos, no (eso se lo piden a WeddingWebs).
// Al guardar se publica: los invitados lo ven en menos de un minuto.
import { db } from "/panel/js/supa.js";
import { html, raw, render, $, $$, toast, fail, icons } from "/panel/js/ui.js";
import { baseConfig, sectionInfo } from "/panel/js/catalogo.js";
import { formatIban, ibanOk, isSampleIban } from "/lib/iban.js";

export default async function datos(ctx) {
  const { el, data, weddingId, setLeaveGuard, reload } = ctx;
  const p = structuredClone(data.practico);
  const ext = Boolean(data.features?.rsvp_ampliado);
  const [base, info] = await Promise.all([baseConfig(data.wedding.template).catch(() => ({ sections: p.sections })), sectionInfo()]);
  const available = [...new Set([...(base.sections || []), ...(p.sections || [])])];
  const fixed = (s) => info[s]?.fixed || ["hero", "card", "details", "closing"].includes(s);
  p.schedule ||= [];
  p.venue ||= {};
  p.gifts ||= {};
  p.rsvp ||= {};
  let dirty = false;
  setLeaveGuard((silent) => !dirty || (!silent && confirm("Tenéis cambios sin guardar. ¿Salir sin guardar?")));

  render(el, html`
    <div class="page-head"><div><h1>Datos de la boda</h1>
      <p>Lo que cambiéis aquí se publica al guardar: los invitados lo ven en menos de un minuto.</p></div></div>
    <form class="stack" data-form novalidate autocomplete="off">
      <section class="panel-block stack">
        <h2>Horario del día</h2>
        <div class="repeat" data-schedule></div>
        <div><button class="btn btn--small" type="button" data-add>Añadir momento</button></div>
      </section>

      <section class="panel-block stack">
        <h2>Cómo llegar</h2>
        <p class="small muted">El lugar es ${p.venue.name || "el que nos disteis"}. Si cambia, escribidnos.</p>
        <div class="field"><label for="d-addr">Dirección</label><input id="d-addr" name="address" value="${p.venue.address || ""}"></div>
        <div class="field"><label for="d-map">Enlace de Google Maps</label>
          <div class="link-box"><input id="d-map" name="mapsUrl" type="url" value="${p.venue.mapsUrl || ""}"><button class="btn btn--small" type="button" data-maps>Crear desde la dirección</button></div>
          <span class="hint">En Google Maps: buscad el sitio › Compartir › Copiar enlace.</span></div>
      </section>

      ${available.includes("gifts") ? html`<section class="panel-block stack">
        <h2>Regalo</h2>
        <div class="field"><label for="d-holder">Titular de la cuenta</label><input id="d-holder" name="holder" value="${p.gifts.holder || ""}"></div>
        <div class="field"><label for="d-iban">IBAN</label><input id="d-iban" name="iban" value="${p.gifts.iban || ""}" autocapitalize="characters" spellcheck="false" inputmode="text">
          <span class="hint" data-iban-hint></span></div>
      </section>` : ""}

      <section class="panel-block stack">
        <h2>Confirmación de asistencia</h2>
        <div class="field"><label for="d-deadline">Fecha límite para confirmar (incluida)</label>
          <input id="d-deadline" name="deadline" type="date" value="${p.rsvp.deadline || ""}" max="${data.wedding.wedding_date || ""}" style="max-width:220px">
          <span class="hint">Después de ese día el formulario se cierra solo. Los caterings suelen pedir la lista 2 o 3 semanas antes.</span></div>
        ${ext ? html`<label class="check"><input type="checkbox" name="dietary" ${p.rsvp.dietary !== false ? "checked" : ""}> Preguntar por alergias e intolerancias</label>
          <label class="check"><input type="checkbox" name="bus" ${p.rsvp.bus ? "checked" : ""}> Preguntar si necesitan autobús</label>` : ""}
      </section>

      <section class="panel-block stack">
        <h2>Qué se ve en la web</h2>
        <div class="toggles">${available.map((s) => html`<label class="${fixed(s) ? "is-fixed" : ""}">
          <input type="checkbox" name="section" value="${s}" ${(p.sections || []).includes(s) ? "checked" : ""} ${fixed(s) ? "disabled" : ""}>${info[s]?.name || s}</label>`)}</div>
      </section>

      <p class="error" data-err role="alert"></p>
      <div class="btn-row"><button class="btn btn--primary" type="submit">Guardar y publicar</button>
        <span class="small muted" data-state></span></div>
    </form>`);

  const form = $("[data-form]", el);
  const state = $("[data-state]", el);
  const touch = () => { dirty = true; state.textContent = "Cambios sin guardar"; };

  // Horario
  const box = $("[data-schedule]", el);
  const paint = () => render(box, html`${p.schedule.map((s, i) => html`<div class="repeat__row" data-i="${i}">
    <input type="time" value="${s.time}" data-k="time" aria-label="Hora" required>
    <input value="${s.label}" data-k="label" placeholder="Ceremonia" aria-label="Qué" maxlength="80">
    <input value="${s.place || ""}" data-k="place" placeholder="Dónde (opcional)" aria-label="Dónde" maxlength="120">
    <button class="icon-btn" type="button" data-del="${i}" aria-label="Quitar">${raw(icons.trash)}</button></div>`)}
    ${p.schedule.length ? "" : html`<p class="muted small">Sin horario. Añadid la ceremonia, el cóctel, la cena…</p>`}`);
  paint();
  box.addEventListener("input", (e) => {
    const row = e.target.closest("[data-i]");
    if (!row) return;
    const item = p.schedule[row.dataset.i];
    if (e.target.dataset.k === "place" && !e.target.value.trim()) delete item.place;
    else item[e.target.dataset.k] = e.target.value;
    touch();
  });
  box.addEventListener("change", (e) => {
    if (e.target.dataset.k !== "time") return;
    const late = (t) => (t < "06:00" ? `3${t}` : t); // la fiesta de madrugada va al final
    p.schedule.sort((a, b) => late(a.time).localeCompare(late(b.time)));
    paint();
  });
  box.addEventListener("click", (e) => {
    const b = e.target.closest("[data-del]");
    if (!b) return;
    p.schedule.splice(Number(b.dataset.del), 1);
    paint(); touch();
  });
  $("[data-add]", el).addEventListener("click", () => {
    const last = p.schedule.at(-1)?.time || "17:00";
    const [h, m] = last.split(":").map(Number);
    p.schedule.push({ time: `${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`, label: "" });
    paint(); touch();
    box.querySelector(".repeat__row:last-child [data-k=label]").focus();
  });

  // Mapa e IBAN
  $("[data-maps]", el).addEventListener("click", () => {
    const q = [p.venue.name, form.address.value, p.venue.city].filter(Boolean).join(", ");
    form.mapsUrl.value = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
    touch();
  });
  const ibanHint = () => {
    const v = form.iban?.value.replace(/\s/g, "");
    const h = $("[data-iban-hint]", el);
    if (!h) return;
    h.textContent = !v ? "" : isSampleIban(form.iban.value) ? "Es la cuenta de ejemplo: poned la vuestra." : ibanOk(v) ? "IBAN correcto." : "Este IBAN no es válido: revisad los números.";
  };
  ibanHint();
  form.addEventListener("input", (e) => { if (!e.target.closest("[data-schedule]")) touch(); if (e.target.name === "iban") ibanHint(); });
  form.iban?.addEventListener("change", () => { form.iban.value = formatIban(form.iban.value); ibanHint(); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("[data-err]", el);
    err.textContent = "";
    const bad = p.schedule.find((s) => !/^\d{2}:\d{2}$/.test(s.time || "") || !String(s.label || "").trim());
    if (bad) { err.textContent = "Cada momento del horario necesita su hora y un nombre."; return; }
    const iban = form.iban ? formatIban(form.iban.value) : null;
    if (iban && !isSampleIban(iban) && !ibanOk(iban)) { err.textContent = "El IBAN no es válido. Revisad los números."; return form.iban.focus(); }
    const patch = {
      schedule: p.schedule.map((s) => ({ time: s.time, label: s.label.trim(), ...(s.place?.trim() ? { place: s.place.trim() } : {}), ...(s.tone ? { tone: s.tone } : {}) })),
      venue: { address: form.address.value.trim(), ...(form.mapsUrl.value.trim() ? { mapsUrl: form.mapsUrl.value.trim() } : {}) },
      rsvp: { deadline: form.deadline.value || "", ...(ext ? { dietary: form.dietary.checked, bus: form.bus.checked } : {}) },
      sections: available.filter((s) => fixed(s) ? (p.sections || []).includes(s) : form.querySelector(`[name=section][value="${s}"]`)?.checked),
    };
    if (form.iban) patch.gifts = { holder: form.holder.value.trim(), ...(iban && !isSampleIban(iban) ? { iban } : {}) };
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true; btn.textContent = "Guardando…";
    try {
      const r = await db.rpc("pareja_guardar", { p_wedding_id: weddingId, p_patch: patch, p_expected_updated_at: data.wedding.updated_at });
      dirty = false;
      setLeaveGuard(null);
      toast(r.published ? "Guardado y publicado: los invitados lo verán en menos de un minuto." : "Guardado. Se verá cuando la web esté publicada.");
      await reload();
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false; btn.textContent = "Guardar y publicar";
    }
  });
  void $$; void fail;
}
