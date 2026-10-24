// Nueva boda: lo mínimo (pareja, fecha, lugar y estilo) y al editor. Si viene de un lead, ya está relleno.
import { db } from "../supa.js";
import { html, render, $, debounce } from "../ui.js";
import { styles, newWeddingConfig, utcOffset } from "../catalogo.js";
import { validate, describe } from "/lib/config-schema.js";

let schema = null;
export const loadSchema = async () => (schema ||= await fetch("/schema/wedding-config.schema.json").then((r) => r.json()));

export default async function nuevaBoda({ el, query, go }) {
  const [sts, lead, client] = await Promise.all([
    styles(),
    query.get("lead") ? db.one("leads", { select: "*", id: `eq.${query.get("lead")}` }) : null,
    query.get("cliente") ? db.one("clients", { select: "*", id: `eq.${query.get("cliente")}` }) : null,
  ]);
  const [a, b] = lead?.partner_a ? [lead.partner_a, lead.partner_b || ""] : String(lead?.names || client?.display_name || "").split(/\s+y\s+/);
  const style = sts.find((s) => s.id === lead?.style) || sts[0];

  render(el, html`
    <a class="back" href="#/bodas">← Bodas</a>
    <div class="page-head"><div><h1>Nueva boda</h1>
      <p>${lead ? `Con los datos de ${lead.names || lead.email}.` : client ? `Para ${client.display_name}.` : "Lo mínimo para empezar. Todo lo demás se completa en el editor."}</p></div></div>
    <form class="form panel-block" style="max-width:860px" data-form novalidate>
      <div class="grid-2">
        <div class="field"><label for="w-a">Nombre 1</label><input id="w-a" name="a" value="${a || ""}" required></div>
        <div class="field"><label for="w-b">Nombre 2</label><input id="w-b" name="b" value="${b || ""}" required></div>
      </div>
      <div class="grid-3">
        <div class="field"><label for="w-date">Fecha</label><input id="w-date" name="date" type="date" value="${lead?.wedding_date || ""}" required></div>
        <div class="field"><label for="w-time">Hora de la ceremonia</label><input id="w-time" name="time" type="time" value="${(lead?.wedding_time || "18:00").slice(0, 5)}" required></div>
        <div class="field"><label for="w-tz">Zona horaria</label><select id="w-tz" name="tz">
          <option value="Europe/Madrid">Península y Baleares</option><option value="Atlantic/Canary">Canarias</option>
          <option value="Europe/Lisbon">Portugal</option><option value="Europe/London">Reino Unido</option><option value="Europe/Paris">Francia o Italia</option></select></div>
      </div>
      <div class="grid-2">
        <div class="field"><label for="w-venue">Lugar</label><input id="w-venue" name="venue" value="${String(lead?.venue || "").split(",")[0]}" required></div>
        <div class="field"><label for="w-city">Ciudad</label><input id="w-city" name="city" value="${lead?.city || ""}"></div>
      </div>
      <fieldset class="field" style="border:0;padding:0;margin:0">
        <legend class="label" style="margin-bottom:6px">Estilo</legend>
        <div class="style-pick">${sts.map((s) => html`<label><input type="radio" name="style" value="${s.id}" ${s.id === style.id ? "checked" : ""}>
          <span class="swatch" style="--a:${s.swatch?.[0]};--b:${s.swatch?.[1]}"></span>${s.name}</label>`)}</div>
      </fieldset>
      <div class="field">
        <label for="w-slug">Dirección de la web</label>
        <div class="link-box"><span class="muted">${location.origin}/b/</span><input id="w-slug" name="slug" pattern="[a-z0-9][a-z0-9-]{1,58}[a-z0-9]" required></div>
        <span class="hint">Solo minúsculas, números y guiones. Es lo que verán los invitados en el enlace.</span>
      </div>
      <p class="error" data-err></p>
      <div class="btn-row"><button class="btn btn--primary" type="submit">Crear y abrir el editor</button><a class="btn" href="#/bodas">Cancelar</a></div>
    </form>`);

  const form = $("[data-form]", el), err = $("[data-err]", el), slug = form.slug;
  let touched = false;
  slug.addEventListener("input", () => { touched = true; });
  const suggest = debounce(async () => {
    if (touched || !form.a.value.trim()) return;
    try { slug.value = await db.rpc("suggest_slug", { p_text: `${form.a.value} y ${form.b.value}` }); } catch { /* se puede escribir a mano */ }
  }, 300);
  [form.a, form.b].forEach((i) => i.addEventListener("input", suggest));
  suggest();
  if (/canari|tenerife|lanzarote|fuerteventura|la palma|gomera|hierro|las palmas/i.test(`${lead?.venue} ${lead?.city}`)) form.tz.value = "Atlantic/Canary";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.textContent = "";
    const d = Object.fromEntries(new FormData(form));
    const missing = [...form.querySelectorAll("[required]")].find((i) => !String(i.value).trim());
    if (missing) { err.textContent = `Falta: ${missing.closest(".field").querySelector("label").textContent}.`; return missing.focus(); }
    if (!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(d.slug)) { err.textContent = "La dirección solo puede llevar minúsculas, números y guiones (mínimo 3)."; return slug.focus(); }
    const st = sts.find((s) => s.id === d.style);
    const config = await newWeddingConfig(st, {
      couple: [d.a.trim(), d.b.trim()], date: d.date, time: d.time, venue: d.venue.trim(), city: d.city.trim(),
    });
    if (d.tz !== "Europe/Madrid") {
      const fix = (iso) => iso.replace(/([+-]\d{2}:\d{2}|Z)$/, utcOffset(iso.slice(0, 10), iso.slice(11, 16), d.tz));
      config.event.date = fix(config.event.date);
      config.event.end = fix(config.event.end);
      config.timeZone = d.tz;
    }
    if (lead?.trial_config?.sections && lead.trial_config.theme === st.theme) config.sections = lead.trial_config.sections;
    const problems = validate(await loadSchema(), config);
    if (problems.length) { err.textContent = describe(problems); return; }
    try {
      const [w] = await db.insert("weddings", {
        slug: d.slug, template: st.template, config, lead_id: lead?.id || null, client_id: client?.id || lead?.client_id || null,
      });
      go(`/bodas/${w.id}`);
    } catch (ex) {
      err.textContent = ex.code === "23505" ? "Esa dirección ya la tiene otra boda. Elige otra." : ex.message;
    }
  });
}
