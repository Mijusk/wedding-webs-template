// Editor de una boda: formulario a la izquierda y la web de verdad a la derecha, al momento.
// Guardar = borrador (no cambia lo que ven los invitados). Publicar = versión nueva online.
import { db, storage, siteUrl, api } from "../supa.js";
import { html, raw, render, $, $$, statusChip, fmtDate, fmtDateTime, formDialog, confirmDialog, toast, fail, debounce, downloadCsv, icons } from "../ui.js";
import { styles, baseConfig, sectionInfo, livePreview, toConfig, utcOffset } from "../catalogo.js";
import { validate } from "/lib/config-schema.js";
import { prepare } from "/lib/fotos.js";
import { loadSchema } from "./nueva-boda.js";
import { formatIban, ibanOk } from "/lib/iban.js";

const BUCKET = "wedding-assets";
const TZS = [["Europe/Madrid", "Península y Baleares"], ["Atlantic/Canary", "Canarias"], ["Europe/Lisbon", "Portugal"], ["Europe/London", "Reino Unido"], ["Europe/Paris", "Francia, Italia, Alemania…"], ["America/Mexico_City", "México"], ["America/New_York", "Nueva York"]];

const getPath = (o, path) => path.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
function setPath(o, path, value) {
  const keys = path.split(".");
  let cur = o;
  keys.slice(0, -1).forEach((k, i) => { if (cur[k] == null || typeof cur[k] !== "object") cur[k] = /^\d+$/.test(keys[i + 1]) ? [] : {}; cur = cur[k]; });
  const last = keys.at(-1);
  if (value === undefined || value === "") delete cur[last]; else cur[last] = value;
}

export default async function boda(ctx) {
  const { el, params, staff, setTitle, setLeaveGuard, go } = ctx;
  const id = params.id;
  const [w, assets, versions, rsvp, sts, schema, info, clients] = await Promise.all([
    db.one("weddings", { select: "*", id: `eq.${id}` }),
    db.select("wedding_assets", { select: "*", wedding_id: `eq.${id}`, order: "sort.asc,created_at.asc" }),
    db.select("wedding_versions", { select: "id,version,note,created_at,template,staff:published_by(name)", wedding_id: `eq.${id}`, order: "version.desc" }),
    db.select("rsvp_current", { select: "name,attending,song,created_at,times_answered", wedding_id: `eq.${id}`, order: "created_at.desc" }),
    styles(), loadSchema(), sectionInfo(),
    db.select("clients", { select: "id,display_name", order: "display_name" }),
  ]);
  const [couples, plan] = await Promise.all([
    db.select("couple_users", { select: "*", wedding_id: `eq.${id}`, order: "created_at" }),
    db.rpc("pareja_resumen", { p_wedding_id: id }).then((r) => r.features).catch(() => ({})),
  ]);
  let version = w?.updated_at; // para avisar si la pareja cambió la boda mientras se editaba aquí
  if (!w) return render(el, html`<p class="empty"><strong>Esta boda no existe.</strong><a href="#/bodas">Volver</a></p>`);

  let config = structuredClone(w.config);
  let template = w.template;
  let base = await baseConfig(template);
  let photos = assets.filter((a) => a.kind === "foto");
  let dirty = false;
  const isAdmin = ["owner", "admin"].includes(staff.role);
  const names = () => (config.event?.couple || []).filter(Boolean).join(" y ") || w.slug;
  setTitle(names());
  el.classList.add("view--wide");

  setLeaveGuard((silent) => !dirty || (!silent && confirm("Tienes cambios sin guardar en esta boda. ¿Salir sin guardar?")));

  const publicUrl = `${siteUrl()}/b/${w.slug}`;
  const previewUrl = `${publicUrl}?vista=${w.preview_token}`;
  const style = () => sts.find((s) => s.template === template && s.theme === config.theme) || sts.find((s) => s.template === template);
  const sectionsAvailable = () => [...new Set([...(base.sections || []), ...(config.sections || [])])];
  const hasStory = () => sectionsAvailable().includes("story");
  const dateOf = () => (config.event?.date || "").slice(0, 10);
  const timeOf = () => (config.event?.date || "").slice(11, 16);
  const endTimeOf = () => (config.event?.end || "").slice(11, 16);
  const tzOf = () => config.timeZone || "Europe/Madrid";
  const yes = rsvp.filter((r) => r.attending).length;

  render(el, html`
    <a class="back" href="#/bodas">← Bodas</a>
    <div class="page-head">
      <div>
        <h1 class="serif" data-names>${names()}</h1>
        <p>${statusChip(w.status)} ${w.wedding_date ? html`<span style="margin-left:8px">${fmtDate(w.wedding_date)}</span>` : ""}
          ${["publicada", "archivada"].includes(w.status) ? html` · <a href="${publicUrl}" target="_blank" rel="noopener">${publicUrl.replace(/^https?:\/\//, "")}</a>` : ""}</p>
      </div>
    </div>
    <div class="editor__bar">
      <span data-state class="saved">${w.published_at ? `Publicada por última vez el ${fmtDateTime(w.published_at)}` : "Sin publicar"}</span>
      <div class="btn-row">
        <button class="btn" type="button" data-share>Enlace de vista previa</button>
        <button class="btn" type="button" data-save>Guardar borrador</button>
        <button class="btn btn--primary" type="button" data-publish>${["publicada", "archivada"].includes(w.status) ? "Publicar cambios" : "Publicar"}</button>
      </div>
    </div>
    <div class="seg editor-tabs" role="tablist" style="margin-bottom:12px">
      <button type="button" data-tab="datos" aria-pressed="true">Datos</button><button type="button" data-tab="vista" aria-pressed="false">Vista previa</button>
    </div>
    <div class="problems" data-problems hidden></div>

    <div class="editor" data-tab="datos">
      <form class="editor__form" data-form novalidate autocomplete="off">
        <details class="sec" open><summary>Pareja y fecha</summary><div class="sec__body">
          <div class="grid-2">
            <div class="field"><label for="f-a">Nombre 1</label><input id="f-a" data-path="event.couple.0" value="${config.event?.couple?.[0] || ""}"></div>
            <div class="field"><label for="f-b">Nombre 2</label><input id="f-b" data-path="event.couple.1" value="${config.event?.couple?.[1] || ""}"></div>
          </div>
          <div class="grid-3">
            <div class="field"><label for="f-date">Fecha</label><input id="f-date" type="date" data-when="date" value="${dateOf()}"></div>
            <div class="field"><label for="f-time">Ceremonia</label><input id="f-time" type="time" data-when="time" value="${timeOf()}"></div>
            <div class="field"><label for="f-end">Fin aproximado</label><input id="f-end" type="time" data-when="end" value="${endTimeOf()}"></div>
          </div>
          <div class="field"><label for="f-tz">Zona horaria del lugar</label><select id="f-tz" data-when="tz">${TZS.map(([v, l]) => html`<option value="${v}" ${tzOf() === v ? "selected" : ""}>${l}</option>`)}</select>
            <span class="hint">Así la cuenta atrás y «Añadir al calendario» salen bien aunque el invitado viva en otro país.</span></div>
          <div class="field"><label for="f-tag">Frase de portada</label><input id="f-tag" data-path="event.tagline" value="${config.event?.tagline || ""}"></div>
        </div></details>

        <details class="sec"><summary>Lugar</summary><div class="sec__body">
          <div class="field"><label for="f-vn">Nombre del lugar</label><input id="f-vn" data-path="venue.name" value="${config.venue?.name || ""}"></div>
          <div class="grid-2">
            <div class="field"><label for="f-va">Dirección</label><input id="f-va" data-path="venue.address" value="${config.venue?.address || ""}"></div>
            <div class="field"><label for="f-vc">Ciudad</label><input id="f-vc" data-path="venue.city" value="${config.venue?.city || ""}"></div>
          </div>
          <div class="field"><label for="f-vm">Enlace a Google Maps</label>
            <div class="link-box"><input id="f-vm" data-path="venue.mapsUrl" value="${config.venue?.mapsUrl || ""}" type="url"><button class="btn btn--small" type="button" data-maps>Crear desde el nombre</button></div></div>
          ${["costa", "estrellas"].includes(template) || config.venue?.lat != null ? html`<div class="grid-2">
            <div class="field"><label for="f-lat">Latitud</label><input id="f-lat" data-path="venue.lat" data-num value="${config.venue?.lat ?? ""}" inputmode="decimal"></div>
            <div class="field"><label for="f-lon">Longitud</label><input id="f-lon" data-path="venue.lon" data-num value="${config.venue?.lon ?? ""}" inputmode="decimal"></div>
          </div><p class="hint">Costa y Noche estrellada las usan para la puesta de sol y el cielo de esa noche. En Google Maps: clic derecho sobre el sitio.</p>` : ""}
        </div></details>

        <details class="sec"><summary>Programa del día <span class="summary-note" data-count-schedule>${(config.schedule || []).length} momentos</span></summary><div class="sec__body">
          <div class="repeat" data-schedule></div>
          <div><button class="btn btn--small" type="button" data-add-schedule>Añadir momento</button></div>
        </div></details>

        ${hasStory() ? html`<details class="sec"><summary>Vuestra historia</summary><div class="sec__body">
          <div class="repeat" data-story></div>
          <div><button class="btn btn--small" type="button" data-add-story>Añadir capítulo</button></div>
          <p class="hint">Las fotos 2, 3… se colocan solas en los capítulos, en orden.</p>
        </div></details>` : ""}

        <details class="sec" ${photos.length ? "" : "open"}><summary>Fotos <span class="summary-note" data-photos-note></span></summary><div class="sec__body">
          <label class="drop" data-drop><input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden data-files>
            <strong>Arrastra aquí las fotos originales o pulsa para elegirlas</strong>
            <span class="small">Las que ya caben se suben tal cual (solo sin datos internos ni GPS). La calidad no se toca.</span></label>
          <p class="small muted" data-upload-status></p>
          <div class="photos" data-photos></div>
          <div data-focus></div>
        </div></details>

        <details class="sec"><summary>Regalo</summary><div class="sec__body">
          <div class="field"><label for="f-gh">Titular de la cuenta</label><input id="f-gh" data-path="gifts.holder" value="${config.gifts?.holder || ""}"></div>
          <div class="field"><label for="f-gi">IBAN</label><input id="f-gi" data-path="gifts.iban" data-iban value="${config.gifts?.iban || ""}" autocapitalize="characters" spellcheck="false">
            <span class="hint" data-iban-check></span></div>
        </div></details>

        <details class="sec"><summary>Confirmación de asistencia <span class="summary-note">${rsvp.length ? `${yes} vienen · ${rsvp.length - yes} no` : "sin respuestas"}</span></summary><div class="sec__body">
          <div class="grid-2">
            <div class="field"><label for="f-dl">Fecha límite (incluida)</label><input id="f-dl" type="date" data-path="rsvp.deadline" value="${config.rsvp?.deadline || ""}"></div>
            <div class="field"><label for="f-bl">Texto del botón</label><input id="f-bl" data-path="rsvp.buttonLabel" value="${config.rsvp?.buttonLabel || ""}"></div>
          </div>
          ${rsvp.length ? html`<div class="rows small">${rsvp.slice(0, 8).map((r) => html`<div class="row"><span class="row__title" style="font-weight:500">${r.name}${r.times_answered > 1 ? html` <span class="tag">cambió ${r.times_answered - 1} vez/veces</span>` : ""}</span><span class="row__side">${r.attending ? "Sí" : "No"}</span>${r.song ? html`<span class="row__sub">${r.song}</span>` : ""}</div>`)}</div>
            <div><button class="btn btn--small" type="button" data-rsvp-export>Descargar las ${rsvp.length} respuestas (Excel)</button></div>` : html`<p class="muted small">Cuando los invitados contesten, sus respuestas aparecen aquí (vale la última de cada persona).</p>`}
        </div></details>

        <details class="sec"><summary>Secciones visibles</summary><div class="sec__body">
          <div class="toggles" data-sections>${sectionsAvailable().map((s) => html`<label class="${info[s]?.fixed ? "is-fixed" : ""}">
            <input type="checkbox" value="${s}" ${(config.sections || []).includes(s) ? "checked" : ""} ${info[s]?.fixed ? "disabled" : ""}>${info[s]?.name || s}</label>`)}</div>
        </div></details>

        <details class="sec"><summary>Estilo <span class="summary-note" data-style-name>${style()?.name || template}</span></summary><div class="sec__body">
          ${sts.filter((s) => s.template === template).length > 1 ? html`<div class="style-pick">${sts.filter((s) => s.template === template).map((s) => html`<label>
            <input type="radio" name="theme" value="${s.theme}" ${s.theme === config.theme ? "checked" : ""} data-theme><span class="swatch" style="--a:${s.swatch?.[0]};--b:${s.swatch?.[1]}"></span>${s.name}</label>`)}</div>` : ""}
          <div><button class="btn btn--small" type="button" data-change-template>Cambiar a otra plantilla</button></div>
          <p class="hint">Al cambiar de plantilla se conservan nombres, fecha, lugar, programa, fotos, regalo y confirmación; los textos vuelven a los de la plantilla nueva.</p>
        </div></details>

        <details class="sec"><summary>Tarjeta para WhatsApp</summary><div class="sec__body">
          <p class="small muted">La imagen que sale al compartir el enlace (1200 × 630). Si no hay, se usa la foto de portada. Puedes hacerla con Herramientas › Compartir y subirla aquí.</p>
          <div class="btn-row">
            <label class="btn btn--small">Subir imagen para compartir<input type="file" accept="image/jpeg,image/png" hidden data-share-file="image"></label>
            <label class="btn btn--small">Subir icono (iniciales)<input type="file" accept="image/png" hidden data-share-file="icon"></label>
          </div>
          <p class="small" data-share-state>${config.share?.image ? html`Imagen: <a href="${config.share.image}" target="_blank" rel="noopener">ver</a>` : "Sin imagen propia."} ${config.share?.icon ? html`Icono: <a href="${config.share.icon}" target="_blank" rel="noopener">ver</a>` : ""}</p>
        </div></details>

        <details class="sec"><summary>Pareja y acceso a su panel <span class="summary-note">${couples.length ? couples.map((c) => c.name || c.email).join(", ") : "sin dar de alta"}</span></summary><div class="sec__body">
          <p class="small muted">La pareja entra en ${siteUrl().replace(/^https?:\/\//, "")}/pareja/ sin contraseña: con un enlace que les llega por email o que les mandas tú por WhatsApp.</p>
          ${couples.length ? html`<div class="rows">${couples.map((c) => html`<div class="row">
            <span class="row__title">${c.name || c.email}</span>
            <span class="row__side"><button class="btn btn--small" type="button" data-access="${c.email}">Enlace de acceso</button>
              <button class="icon-btn" type="button" data-del-couple="${c.id}" aria-label="Quitar acceso">${raw(icons.trash)}</button></span>
            <span class="row__sub">${c.email}${c.last_link_at ? ` · último enlace ${fmtDateTime(c.last_link_at)}` : ""} · resumen: ${c.digest}</span></div>`)}</div>` : ""}
          <div class="grid-2"><input data-couple-email type="email" placeholder="Email de uno de los dos" aria-label="Email"><input data-couple-name placeholder="Nombre" aria-label="Nombre"></div>
          <div class="btn-row"><button class="btn btn--small" type="button" data-add-couple>Dar acceso</button>
            <a class="btn btn--small btn--quiet" href="/pareja/?boda=${id}" target="_blank" rel="noopener">Ver su panel</a></div>
          <div class="field"><label for="f-ext">Lista de invitados y RSVP ampliado</label>
            <select id="f-ext" data-ext style="max-width:420px">
              <option value="" ${w.features?.rsvp_ampliado === undefined ? "selected" : ""}>Según su plan</option>
              <option value="si" ${w.features?.rsvp_ampliado === true ? "selected" : ""}>Activado en esta boda</option>
              <option value="no" ${w.features?.rsvp_ampliado === false ? "selected" : ""}>Desactivado en esta boda</option></select>
            <span class="hint">Ahora mismo: <b data-ext-now>${plan.rsvp_ampliado ? "activado" : "desactivado"}</b>. Enlaces personales por grupo, acompañantes, niños, alergias y autobús. Se aplica al momento, sin publicar.</span></div>
        </div></details>

        <details class="sec"><summary>Datos internos</summary><div class="sec__body">
          <div class="field"><label for="f-client">Cliente</label><select id="f-client" data-row="client_id"><option value="">—</option>${clients.map((c) => html`<option value="${c.id}" ${w.client_id === c.id ? "selected" : ""}>${c.display_name}</option>`)}</select></div>
          <div class="field"><label for="f-notes">Notas</label><textarea id="f-notes" data-row="notes">${w.notes || ""}</textarea></div>
          <div class="field"><label for="f-sheet">Copiar también las respuestas a una hoja de Google</label><input id="f-sheet" data-row="rsvp_sheet_endpoint" value="${w.rsvp_sheet_endpoint || ""}" placeholder="https://script.google.com/macros/s/…/exec">
            <span class="hint">Opcional, para la transición: la URL del Apps Script de la hoja de la pareja.</span></div>
          <div class="field"><label for="f-domain">Dominio propio (plan A medida)</label><input id="f-domain" data-row="custom_domain" value="${w.custom_domain || ""}" placeholder="luciaymartin.com"></div>
          <dl class="facts small"><dt>Se retira</dt><dd>${w.retire_at ? fmtDate(w.retire_at) : "—"} (12 meses después de la boda)</dd>
            <dt>Datos de invitados</dt><dd>se borran el ${w.guest_data_delete_at ? fmtDate(w.guest_data_delete_at) : "—"}</dd></dl>
          <div class="btn-row">
            ${["publicada", "archivada"].includes(w.status) ? html`<button class="btn btn--small" type="button" data-unpublish="borrador">Quitar de internet (vuelve a borrador)</button>` : ""}
            ${w.status !== "retirada" ? html`<button class="btn btn--small" type="button" data-unpublish="retirada">Retirar la web</button>` : ""}
            ${isAdmin ? html`<button class="btn btn--small btn--danger" type="button" data-delete>Borrar boda</button>` : ""}
          </div>
        </div></details>

        <details class="sec"><summary>Versiones publicadas <span class="summary-note">${versions.length}</span></summary><div class="sec__body">
          ${versions.length ? html`<div class="rows versions">${versions.map((v) => html`<div class="row">
            <span class="row__title">Versión ${v.version}${v.id === w.published_version_id ? html` <span class="tag tag--accent">online</span>` : ""}</span>
            <span class="row__side"><button class="btn btn--small" type="button" data-see-version="${v.id}">Ver</button><button class="btn btn--small" type="button" data-restore="${v.id}">Volver a esta</button></span>
            <span class="row__sub">${fmtDateTime(v.created_at)}${v.staff?.name ? `, ${v.staff.name}` : ""}${v.note ? `: ${v.note}` : ""}</span></div>`)}</div>`
            : html`<p class="muted small">Cada vez que publiques se guarda una versión; desde aquí puedes volver a cualquiera.</p>`}
        </div></details>

        <details class="sec"><summary>Avanzado: todos los textos (JSON)</summary><div class="sec__body">
          <p class="small muted">El config completo de la web. Útil para cambiar un texto concreto de la plantilla. Se comprueba antes de aplicarlo.</p>
          <textarea class="code" data-json spellcheck="false"></textarea>
          <div class="btn-row"><button class="btn btn--small" type="button" data-json-apply>Aplicar</button><button class="btn btn--small btn--quiet" type="button" data-json-reset>Deshacer cambios del JSON</button></div>
        </div></details>
      </form>

      <aside class="editor__preview" aria-label="Vista previa">
        <div class="seg" role="group" aria-label="Pantalla"><button type="button" data-device="phone" aria-pressed="true">Móvil</button><button type="button" data-device="desktop" aria-pressed="false">Ordenador</button></div>
        <div class="device" data-device-frame><iframe title="Vista previa de la web" data-frame></iframe></div>
        <p class="small muted" data-preview-note>Así se verá con los cambios de ahora (aún sin guardar).</p>
      </aside>
    </div>`);

  const form = $("[data-form]", el);
  const state = $("[data-state]", el);
  const problemsBox = $("[data-problems]", el);
  const preview = livePreview($("[data-frame]", el), template);
  const refresh = debounce(() => preview.update(config), 200);
  const markDirty = () => {
    dirty = true;
    state.className = "dirty";
    state.textContent = "Cambios sin guardar";
    $("[data-names]", el).textContent = names();
    refresh();
  };
  preview.update(config);

  // ── Campos simples (data-path) ──
  form.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.path) {
      let v = t.value;
      if (t.dataset.num !== undefined) v = v.trim() === "" ? undefined : Number(v.replace(",", "."));
      else if (t.dataset.iban !== undefined) v = formatIban(v);
      else if (typeof v === "string" && t.type !== "date") v = v.replace(/^\s+/, "");
      setPath(config, t.dataset.path, v);
      if (t.dataset.iban !== undefined) ibanHint();
      markDirty();
    } else if (t.dataset.row) {
      markDirty();
    }
  });
  form.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.when) { applyWhen(); markDirty(); }
    if (t.closest("[data-sections]")) {
      const on = new Set($$("[data-sections] input:checked", el).map((i) => i.value));
      $$("[data-sections] input:disabled", el).forEach((i) => on.add(i.value));
      config.sections = sectionsAvailable().filter((s) => on.has(s));
      markDirty();
    }
    if (t.dataset.theme !== undefined) { config.theme = t.value; $("[data-style-name]", el).textContent = style()?.name; markDirty(); }
    if (t.dataset.iban !== undefined) t.value = config.gifts?.iban || "";
  });

  function applyWhen() {
    const date = $("[data-when=date]", el).value, time = $("[data-when=time]", el).value || "18:00";
    const end = $("[data-when=end]", el).value, tz = $("[data-when=tz]", el).value;
    if (!date) return;
    const off = (d, t) => utcOffset(d, t, tz);
    config.event.date = `${date}T${time}:00${off(date, time)}`;
    if (end) {
      let endDate = date;
      if (end <= time) { const n = new Date(`${date}T12:00:00Z`); n.setUTCDate(n.getUTCDate() + 1); endDate = n.toISOString().slice(0, 10); }
      config.event.end = `${endDate}T${end}:00${off(endDate, end)}`;
    } else delete config.event.end;
    if (tz === "Europe/Madrid") delete config.timeZone; else config.timeZone = tz;
  }

  $("[data-maps]", el).addEventListener("click", () => {
    const q = [config.venue?.name, config.venue?.address, config.venue?.city].filter(Boolean).join(", ");
    if (!q) return toast("Escribe primero el nombre del lugar.", { error: true });
    config.venue.mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
    $("#f-vm").value = config.venue.mapsUrl;
    markDirty();
  });

  // ── IBAN ──
  function ibanHint() {
    const v = (config.gifts?.iban || "").replace(/\s/g, "");
    $("[data-iban-check]", el).textContent = !v ? "" : /^ES0{22}$/.test(v) ? "Es la cuenta de ejemplo: pon la de la pareja antes de publicar." : ibanOk(v) ? "IBAN correcto." : "Este IBAN no es válido: revisa los números.";
  }
  ibanHint();

  // ── Programa ──
  const schedBox = $("[data-schedule]", el);
  const paintSchedule = () => {
    render(schedBox, html`${(config.schedule || []).map((s, i) => html`<div class="repeat__row" data-i="${i}">
      <input type="time" value="${s.time}" data-s="time" aria-label="Hora">
      <input value="${s.label}" data-s="label" placeholder="Ceremonia" aria-label="Qué">
      <input value="${s.place || ""}" data-s="place" placeholder="Dónde" aria-label="Dónde">
      <button class="icon-btn" type="button" data-del-s="${i}" aria-label="Quitar">${raw(icons.trash)}</button></div>`)}`);
    $("[data-count-schedule]", el).textContent = `${(config.schedule || []).length} momentos`;
  };
  paintSchedule();
  schedBox.addEventListener("input", (e) => {
    const row = e.target.closest("[data-i]");
    if (!row) return;
    const item = config.schedule[row.dataset.i];
    const v = e.target.value;
    if (v) item[e.target.dataset.s] = v; else if (e.target.dataset.s === "place") delete item.place;
    config.schedule.sort((a, b) => (a.time < "06:00" ? "3" + a.time : a.time).localeCompare(b.time < "06:00" ? "3" + b.time : b.time));
    markDirty();
  });
  schedBox.addEventListener("change", (e) => { if (e.target.dataset.s === "time") paintSchedule(); });
  schedBox.addEventListener("click", (e) => {
    const b = e.target.closest("[data-del-s]");
    if (!b) return;
    config.schedule.splice(Number(b.dataset.delS), 1);
    paintSchedule(); markDirty();
  });
  $("[data-add-schedule]", el).addEventListener("click", () => {
    config.schedule ||= [];
    const last = config.schedule.at(-1)?.time || "18:00";
    const [h, m] = last.split(":").map(Number);
    config.schedule.push({ time: `${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`, label: "Nuevo momento", place: "" });
    paintSchedule(); markDirty();
    schedBox.querySelector(".repeat__row:last-child [data-s=label]").select();
  });

  // ── Historia ──
  const storyBox = $("[data-story]", el);
  const paintStory = () => storyBox && render(storyBox, html`${(config.story?.chapters || []).map((c, i) => html`<div class="repeat__row repeat__row--story" data-i="${i}">
    <div class="form" style="gap:6px"><input value="${c.meta || ""}" data-c="meta" placeholder="Septiembre, orilla del Tajo" aria-label="Título del capítulo">
    <textarea data-c="text" rows="3" aria-label="Texto del capítulo">${c.text || ""}</textarea></div>
    <button class="icon-btn" type="button" data-del-c="${i}" aria-label="Quitar capítulo">${raw(icons.trash)}</button></div>`)}`);
  paintStory();
  storyBox?.addEventListener("input", (e) => {
    const row = e.target.closest("[data-i]");
    if (!row) return;
    config.story.chapters[row.dataset.i][e.target.dataset.c] = e.target.value;
    markDirty();
  });
  storyBox?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-del-c]");
    if (!b) return;
    config.story.chapters.splice(Number(b.dataset.delC), 1);
    applyPhotos(); paintStory(); markDirty();
  });
  $("[data-add-story]", el)?.addEventListener("click", () => {
    config.story ||= { chapters: [] };
    config.story.chapters ||= [];
    config.story.chapters.push({ meta: "", text: "Nuevo capítulo" });
    applyPhotos(); paintStory(); markDirty();
  });

  // ── Fotos ──
  const photosBox = $("[data-photos]", el);
  const uploadStatus = $("[data-upload-status]", el);
  const focusOf = () => {
    const [x, y] = String(config.event?.photoFocus || "50% 50%").split(/\s+/).map(parseFloat);
    return { x: Number.isFinite(x) ? x : 50, y: Number.isFinite(y) ? y : 50 };
  };
  // Igual que herramientas/fotos.js: la 1.ª es la portada; las demás, la galería y los capítulos.
  function applyPhotos() {
    const srcs = photos.map((p) => p.url);
    if (!srcs.length) return;
    const f = focusOf();
    config.event = { ...config.event, photo: srcs[0], photoFocus: `${f.x}% ${f.y}%` };
    if ("gallery" in config || "gallery" in base || srcs.length > 1) config.gallery = srcs.slice(1);
    config.story?.chapters?.forEach((c, i) => { if (srcs[i + 1]) { c.photo = srcs[i + 1]; delete c.photoFocus; } else delete c.photo; });
  }
  const paintPhotos = () => {
    $("[data-photos-note]", el).textContent = photos.length ? `${photos.length} ${photos.length === 1 ? "foto" : "fotos"}` : "sin fotos de la pareja";
    render(photosBox, html`${photos.map((p, i) => html`<div class="photo ${p.width && Math.max(p.width, p.height) < 1600 ? "is-warn" : ""}">
      <img src="${p.url}" alt="${p.original_name || ""}" loading="lazy">
      ${i === 0 ? html`<span class="photo__badge">Portada</span>` : ""}
      <span>${p.width ? `${p.width}×${p.height}` : ""}${p.bytes ? ` · ${Math.round(p.bytes / 1024)} KB` : ""}</span>
      <div class="photo__tools">
        ${i > 0 ? html`<button type="button" data-cover="${p.id}">Portada</button><button type="button" data-left="${p.id}" aria-label="Mover antes">←</button>` : ""}
        <button type="button" data-del-photo="${p.id}" aria-label="Borrar foto">Borrar</button>
      </div></div>`)}`);
    const cover = photos[0];
    render($("[data-focus]", el), cover ? html`<div class="field"><span class="label">Encuadre de la portada: pulsa sobre las caras</span>
      <div class="focus-pick" data-focus-pick><img src="${cover.url}" alt=""><span class="dot-focus" style="left:${focusOf().x}%;top:${focusOf().y}%"></span></div>
      <span class="hint">Mira la vista previa en móvil y en ordenador para comprobar que no se cortan.</span></div>` : "");
  };
  paintPhotos();

  async function upload(files) {
    let n = 0;
    for (const file of files) {
      n++;
      uploadStatus.textContent = `Preparando ${n} de ${files.length}: ${file.name}…`;
      try {
        const p = await prepare(file);
        const path = `weddings/${id}/${crypto.randomUUID()}.${p.ext}`;
        uploadStatus.textContent = `Subiendo ${n} de ${files.length}: ${file.name}…`;
        await storage.upload(BUCKET, path, p.blob);
        const [row] = await db.insert("wedding_assets", {
          wedding_id: id, bucket: BUCKET, path, url: storage.publicUrl(BUCKET, path), kind: "foto",
          width: p.width, height: p.height, bytes: p.blob.size, mime: p.blob.type, sort: photos.length,
          original_name: file.name.slice(0, 200), note: p.note,
        });
        photos.push(row);
        if (p.level === "warn") toast(`${file.name}: ${p.note}`, { timeout: 9000 });
      } catch (e) {
        fail(new Error(`${file.name}: ${e.message}`));
      }
    }
    uploadStatus.textContent = "";
    applyPhotos(); paintPhotos(); markDirty();
  }
  const drop = $("[data-drop]", el);
  $("[data-files]", el).addEventListener("change", (e) => { upload([...e.target.files]); e.target.value = ""; });
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("is-over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("is-over"); upload([...e.dataTransfer.files]); });

  const saveOrder = async () => {
    await Promise.all(photos.map((p, i) => (p.sort === i ? null : db.update("wedding_assets", { id: `eq.${p.id}` }, { sort: i }).then(() => { p.sort = i; }))));
  };
  photosBox.addEventListener("click", async (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    const idx = photos.findIndex((p) => p.id === (t.dataset.cover || t.dataset.left || t.dataset.delPhoto));
    if (idx < 0) return;
    try {
      if (t.dataset.cover) { const [p] = photos.splice(idx, 1); photos.unshift(p); config.event.photoFocus = "50% 50%"; await saveOrder(); }
      else if (t.dataset.left) { [photos[idx - 1], photos[idx]] = [photos[idx], photos[idx - 1]]; await saveOrder(); }
      else if (t.dataset.delPhoto) {
        if (!(await confirmDialog("¿Borrar esta foto?", "Se borra del almacenamiento. Si la web publicada la usa, dejará de verse cuando publiques los cambios.", "Borrar", true))) return;
        await storage.remove(BUCKET, photos[idx].path).catch(() => {});
        await db.remove("wedding_assets", { id: `eq.${photos[idx].id}` });
        photos.splice(idx, 1);
        await saveOrder();
        if (!photos.length) { config.event.photo = base.event.photo; delete config.event.photoFocus; }
      }
      applyPhotos(); paintPhotos(); markDirty();
    } catch (ex) { fail(ex); }
  });
  $("[data-focus]", el).addEventListener("click", (e) => {
    const box = e.target.closest("[data-focus-pick]");
    if (!box) return;
    const r = box.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 100), y = Math.round(((e.clientY - r.top) / r.height) * 100);
    config.event.photoFocus = `${x}% ${y}%`;
    box.querySelector(".dot-focus").style.cssText = `left:${x}%;top:${y}%`;
    markDirty();
  });

  // ── Tarjeta para WhatsApp ──
  $$("[data-share-file]", el).forEach((input) => input.addEventListener("change", async () => {
    const file = input.files[0];
    input.value = "";
    if (!file) return;
    const kind = input.dataset.shareFile;
    try {
      const ext = file.type === "image/png" ? "png" : "jpg";
      const path = `weddings/${id}/${kind === "image" ? "compartir" : "icono"}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      await storage.upload(BUCKET, path, file);
      const url = storage.publicUrl(BUCKET, path);
      await db.insert("wedding_assets", { wedding_id: id, bucket: BUCKET, path, url, kind: kind === "image" ? "compartir" : "icono", bytes: file.size, mime: file.type, original_name: file.name.slice(0, 200) });
      config.share = { ...(config.share || {}), [kind]: url };
      render($("[data-share-state]", el), html`Subida. Se verá al publicar. <a href="${url}" target="_blank" rel="noopener">Ver</a>`);
      markDirty();
    } catch (e) { fail(e); }
  }));

  // ── Plantilla ──
  $("[data-change-template]", el).addEventListener("click", async () => {
    const data = await formDialog({
      title: "Cambiar de plantilla", submit: "Cambiar",
      text: "Se conservan nombres, fecha, lugar, programa, fotos, regalo y confirmación. Los textos de la plantilla vuelven a los de la nueva.",
      body: html`<div class="style-pick">${sts.map((s) => html`<label><input type="radio" name="style" value="${s.id}" ${s === style() ? "checked" : ""}>
        <span class="swatch" style="--a:${s.swatch?.[0]};--b:${s.swatch?.[1]}"></span>${s.name}</label>`)}</div>`,
    });
    if (!data) return;
    const st = sts.find((s) => s.id === data.get("style"));
    if (!st || (st.template === template && st.theme === config.theme)) return;
    const newBase = await baseConfig(st.template);
    const next = toConfig(newBase, null, st);
    next.event = { ...next.event, ...pick(config.event, ["couple", "date", "end", "tagline", "photo", "photoFocus", "photoAlt", "type"]) };
    next.venue = { ...next.venue, ...config.venue };
    for (const k of ["schedule", "gifts", "share", "timeZone"]) if (config[k]) next[k] = structuredClone(config[k]);
    next.rsvp = { ...next.rsvp, ...pick(config.rsvp || {}, ["deadline"]) };
    if (newBase.story && config.story?.chapters?.length) next.story = structuredClone(config.story);
    template = st.template;
    base = newBase;
    config = next;
    applyPhotos();
    dirty = true;
    preview.setTemplate(template);
    await save({ quiet: true });
    boda(ctx);
  });

  // ── Respuestas ──
  $("[data-rsvp-export]", el)?.addEventListener("click", () => downloadCsv(`respuestas-${w.slug}.csv`, rsvp, [
    ["name", "Nombre"], [(r) => (r.attending ? "Sí" : "No"), "Viene"], ["song", "Canción"], ["created_at", "Fecha de la respuesta"], ["times_answered", "Veces que ha contestado"],
  ]));

  // ── Versiones ──
  $$("[data-see-version]", el).forEach((b) => b.addEventListener("click", async () => {
    const v = await db.one("wedding_versions", { select: "config,template,version", id: `eq.${b.dataset.seeVersion}` });
    if (v.template !== template) preview.setTemplate(v.template);
    preview.update(v.config);
    $("[data-preview-note]", el).innerHTML = `Viendo la versión ${v.version}. <button class="btn btn--small" type="button" data-back-draft>Volver al borrador</button>`;
    switchTab("vista");
  }));
  el.addEventListener("click", (e) => {
    if (!e.target.closest("[data-back-draft]")) return;
    preview.setTemplate(template);
    preview.update(config);
    $("[data-preview-note]", el).textContent = "Así se verá con los cambios de ahora (aún sin guardar).";
  });
  $$("[data-restore]", el).forEach((b) => b.addEventListener("click", async () => {
    if (dirty && !(await confirmDialog("Tienes cambios sin guardar", "Si vuelves a otra versión, se pierden.", "Seguir", true))) return;
    try { await db.rpc("restore_wedding_version", { p_version_id: b.dataset.restore }); dirty = false; toast("Borrador restaurado. Pulsa Publicar para ponerlo online."); boda(ctx); }
    catch (e) { fail(e); }
  }));

  // ── JSON ──
  const jsonBox = $("[data-json]", el);
  const fillJson = () => { jsonBox.value = JSON.stringify(config, null, 2); };
  el.querySelector("[data-json]").closest("details").addEventListener("toggle", (e) => { if (e.target.open) fillJson(); });
  $("[data-json-reset]", el).addEventListener("click", fillJson);
  $("[data-json-apply]", el).addEventListener("click", () => {
    let next;
    try { next = JSON.parse(jsonBox.value); } catch (e) { return toast(`El JSON tiene un error: ${e.message}`, { error: true }); }
    const errs = validate(schema, next);
    if (errs.length) return showProblems(errs);
    config = next;
    dirty = true;
    save({ quiet: true }).then(() => boda(ctx));
  });

  // ── Guardar, publicar, estado ──
  function showProblems(errs) {
    problemsBox.hidden = !errs.length;
    render(problemsBox, html`<strong>Hay que corregir esto antes de guardar:</strong><ul>${errs.slice(0, 12).map((e) => html`<li><b>${e.path || "config"}</b>: ${e.message}</li>`)}</ul>`);
    problemsBox.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function save({ quiet = false } = {}) {
    if (config.gifts?.iban) config.gifts.iban = formatIban(config.gifts.iban);
    const errs = validate(schema, config);
    if (errs.length) { showProblems(errs); return false; }
    problemsBox.hidden = true;
    const row = { config, template };
    $$("[data-row]", el).forEach((i) => { row[i.dataset.row] = i.value.trim() || null; });
    if (row.custom_domain) row.custom_domain = row.custom_domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    try {
      const saved = await db.update("weddings", { id: `eq.${id}`, updated_at: `eq.${version}` }, row);
      if (!saved.length) {
        fail(new Error("La pareja ha cambiado datos de esta boda (horario, regalo…) mientras la editabas. Para no borrar sus cambios, copia lo tuyo y recarga la página."));
        return false;
      }
      version = saved[0].updated_at;
      dirty = false;
      state.className = "saved";
      state.textContent = `Borrador guardado a las ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
      if (!quiet) toast("Borrador guardado. Los invitados siguen viendo la versión publicada.");
      return true;
    } catch (e) { fail(e); return false; }
  }
  $("[data-save]", el).addEventListener("click", () => save());

  $("[data-publish]", el).addEventListener("click", async () => {
    const warnings = [];
    if (!photos.length || /^assets\//.test(config.event?.photo || "")) warnings.push("La portada es la foto de ejemplo de la plantilla.");
    if ((config.sections || []).includes("gifts") && /^ES0{2}[\s0]+$/.test(config.gifts?.iban || "")) warnings.push("El IBAN es el de ejemplo.");
    if ((config.sections || []).includes("gifts") && config.gifts?.iban && !ibanOk(config.gifts.iban.replace(/\s/g, "")) && !/^ES0{2}[\s0]+$/.test(config.gifts.iban)) warnings.push("El IBAN no es válido.");
    if ((config.sections || []).includes("rsvp") && !config.rsvp?.deadline) warnings.push("La confirmación de asistencia no tiene fecha límite.");
    if (config.event?.date && config.event.date.slice(0, 10) < new Date().toISOString().slice(0, 10)) warnings.push("La fecha de la boda ya ha pasado.");
    const data = await formDialog({
      title: ["publicada", "archivada"].includes(w.status) ? "Publicar los cambios" : "Publicar la web",
      submit: "Publicar",
      text: `Los invitados verán esta versión en ${publicUrl.replace(/^https?:\/\//, "")} en menos de un minuto.`,
      body: html`${warnings.length ? html`<div class="notice"><strong>Antes de publicar, revisa:</strong><ul style="margin:6px 0 0;padding-left:18px">${warnings.map((x) => html`<li>${x}</li>`)}</ul></div>` : ""}
        <div class="field"><label for="pub-note">Nota de esta versión (opcional)</label><input id="pub-note" name="note" placeholder="Fotos definitivas"></div>`,
    });
    if (!data) return;
    if (!(await save({ quiet: true }))) return;
    try {
      const r = await db.rpc("publish_wedding", { p_wedding_id: id, p_note: String(data.get("note")).trim() || null });
      toast(`Publicada (versión ${r.version}).`, { action: "Abrir la web", onAction: () => window.open(publicUrl, "_blank", "noopener") });
      boda(ctx);
    } catch (e) { fail(e); }
  });

  $("[data-share]", el).addEventListener("click", () => {
    const dlg = document.createElement("dialog");
    render(dlg, html`<div class="dlg"><h2>Enlace de vista previa</h2>
      <p class="muted">Para enseñar el borrador a la pareja antes de publicar. Lo que veas aquí es lo último que has guardado. Las respuestas de prueba no se guardan.</p>
      <div class="link-box"><input readonly value="${previewUrl}" data-link><button class="btn btn--small" type="button" data-copy>Copiar</button></div>
      <div class="btn-row"><a class="btn btn--small" href="${previewUrl}" target="_blank" rel="noopener">Abrir</a>
        <a class="btn btn--small" href="https://wa.me/?text=${encodeURIComponent(`¡Aquí tenéis la vista previa de vuestra web! ${previewUrl}`)}" target="_blank" rel="noopener">Mandar por WhatsApp</a>
        <button class="btn btn--small btn--quiet" type="button" data-rotate>Cambiar el enlace (el anterior deja de funcionar)</button></div>
      <div class="dlg__actions"><button class="btn" type="button" data-close>Cerrar</button></div></div>`);
    document.body.append(dlg);
    dlg.addEventListener("close", () => dlg.remove());
    dlg.addEventListener("click", async (e) => {
      if (e.target.closest("[data-close]")) dlg.close();
      if (e.target.closest("[data-copy]")) { await navigator.clipboard?.writeText(previewUrl).catch(() => {}); toast("Enlace copiado."); }
      if (e.target.closest("[data-rotate]")) {
        try {
          const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
          await db.update("weddings", { id: `eq.${id}` }, { preview_token: token });
          dlg.close(); toast("Enlace cambiado."); boda(ctx);
        } catch (ex) { fail(ex); }
      }
    });
    dlg.showModal();
    if (dirty) toast("Ojo: tienes cambios sin guardar; la vista previa enseña lo último guardado.");
    if (w.status === "borrador") {
      db.update("weddings", { id: `eq.${id}` }, { status: "vista_previa" }).then((r) => { if (r[0]) version = r[0].updated_at; w.status = "vista_previa"; }).catch(() => {});
    }
  });

  $$("[data-unpublish]", el).forEach((b) => b.addEventListener("click", async () => {
    const to = b.dataset.unpublish;
    const ok = await confirmDialog(to === "retirada" ? "¿Retirar la web?" : "¿Quitar la web de internet?",
      to === "retirada" ? "Los invitados verán que ya no está disponible. Se puede volver a publicar." : "Vuelve a borrador: el enlace dejará de funcionar hasta que la publiques de nuevo.",
      to === "retirada" ? "Retirar" : "Quitar", true);
    if (!ok) return;
    try { await db.rpc("unpublish_wedding", { p_wedding_id: id, p_status: to }); boda(ctx); } catch (e) { fail(e); }
  }));
  $("[data-delete]", el)?.addEventListener("click", async () => {
    if (!(await confirmDialog("¿Borrar esta boda?", "Se borran la web, sus versiones, sus fotos y las respuestas de los invitados. No se puede deshacer.", "Borrar para siempre", true))) return;
    try {
      await Promise.all(assets.map((a) => storage.remove(a.bucket, a.path).catch(() => {})));
      await db.remove("weddings", { id: `eq.${id}` });
      dirty = false; go("/bodas");
    } catch (e) { fail(e); }
  });

  // ── Vista previa: móvil/ordenador y pestañas en pantallas pequeñas ──
  $$("[data-device]", el).forEach((b) => b.addEventListener("click", () => {
    $$("[data-device]", el).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    $("[data-device-frame]", el).classList.toggle("device--desktop", b.dataset.device === "desktop");
  }));
  const editor = $(".editor", el);
  const switchTab = (tab) => {
    editor.dataset.tab = tab;
    $$("[data-tab]", el).filter((b) => b.tagName === "BUTTON").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tab === tab)));
  };
  $$(".editor-tabs [data-tab]", el).forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));

  // ── Pareja y acceso ──
  $("[data-add-couple]", el).addEventListener("click", async () => {
    const email = $("[data-couple-email]", el).value.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast("Escribe un email válido.", { error: true });
    try {
      await db.insert("couple_users", { wedding_id: id, email, name: $("[data-couple-name]", el).value.trim() || null });
      toast("Acceso dado. Ahora mándales el enlace."); boda(ctx);
    } catch (e) { fail(e); }
  });
  $$("[data-del-couple]", el).forEach((b) => b.addEventListener("click", async () => {
    if (!(await confirmDialog("¿Quitar el acceso?", "Ya no podrá entrar en el panel de esta boda.", "Quitar", true))) return;
    try { await db.remove("couple_users", { id: `eq.${b.dataset.delCouple}` }); boda(ctx); } catch (e) { fail(e); }
  }));
  $$("[data-access]", el).forEach((b) => b.addEventListener("click", async () => {
    b.disabled = true;
    try {
      const { link } = await api("/api/pareja", { accion: "enlace", wedding_id: id, email: b.dataset.access });
      const c = couples.find((x) => x.email === b.dataset.access);
      const msg = `¡Hola${c?.name ? `, ${c.name}` : ""}! Con este enlace entráis en el panel de vuestra web de boda (invitados, respuestas, horario y regalo). Sirve una vez y caduca en unas horas; después os quedáis dentro en ese móvil: ${link}`;
      const dlg = document.createElement("dialog");
      render(dlg, html`<div class="dlg"><h2>Enlace de acceso</h2>
        <p class="muted">Para ${b.dataset.access}. Sirve una sola vez y caduca en unas horas. Si caduca, genera otro.</p>
        <div class="link-box"><input readonly value="${link}"><button class="btn btn--small" type="button" data-copy-link>Copiar</button></div>
        <div class="btn-row"><a class="btn btn--small btn--primary" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">${raw(icons.whatsapp)} Mandar por WhatsApp</a></div>
        <p class="small muted">No lo abras tú: se gastaría.</p>
        <div class="dlg__actions"><button class="btn" type="button" data-close>Cerrar</button></div></div>`);
      document.body.append(dlg);
      dlg.addEventListener("close", () => dlg.remove());
      dlg.addEventListener("click", async (e) => {
        if (e.target.closest("[data-close]")) dlg.close();
        if (e.target.closest("[data-copy-link]")) { await navigator.clipboard?.writeText(link).catch(() => {}); toast("Enlace copiado."); }
      });
      dlg.showModal();
    } catch (e) { fail(new Error(e.code === "no_es_pareja" ? "Ese email no tiene acceso a ninguna boda activa." : e.message)); }
    b.disabled = false;
  }));
  $("[data-ext]", el).addEventListener("change", async (e) => {
    const features = { ...(w.features || {}) };
    if (e.target.value === "") delete features.rsvp_ampliado; else features.rsvp_ampliado = e.target.value === "si";
    try {
      const r = await db.update("weddings", { id: `eq.${id}` }, { features });
      w.features = features;
      if (r[0]) version = r[0].updated_at;
      const now = await db.rpc("pareja_resumen", { p_wedding_id: id }).then((x) => x.features?.rsvp_ampliado).catch(() => null);
      $("[data-ext-now]", el).textContent = now ? "activado" : "desactivado";
      toast("Hecho. La web lo aplica en menos de un minuto.");
    } catch (ex) { fail(ex); }
  });

  // Guardar con Ctrl/Cmd + S
  el.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(); } });
}

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o?.[k] !== undefined).map((k) => [k, o[k]]));

export { formatIban, ibanOk };
