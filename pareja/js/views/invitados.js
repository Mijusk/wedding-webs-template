// Lista de invitados: grupos (familias) con sus personas y su enlace personal.
import { db } from "/panel/js/supa.js";
import { html, raw, str, render, $, $$, formDialog, confirmDialog, toast, fail, debounce, downloadCsv, icons } from "/panel/js/ui.js";
import { readXlsx } from "/lib/xlsx.js";
import { parseCsv } from "/panel/js/csv.js";
import { parseGuestRows, TEMPLATE_ROWS } from "../lista.js";
import { loadGuests, inviteUrl, inviteMessage, statusOf, whatsapp, copy, fullName, noModule } from "../comun.js";

export default async function invitados(ctx) {
  const { el, data, weddingId, query, go } = ctx;
  if (!data.features?.rsvp_ampliado) return render(el, noModule(data));
  const { groups } = await loadGuests(weddingId);
  const q = (query.get("q") || "").toLowerCase();
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const list = q ? groups.filter((g) => norm([g.name, g.email, g.phone, ...g.guests.map(fullName)].join(" ")).includes(norm(q))) : groups;
  const people = groups.reduce((n, g) => n + Math.max(g.seats, g.guests.length), 0);
  const published = ["publicada", "archivada"].includes(data.wedding.status);

  render(el, html`
    <div class="page-head">
      <div><h1>Invitados</h1><p>${groups.length ? `${people} personas en ${groups.length} grupos.` : "Aún no hay nadie en la lista."}</p></div>
      <div class="page-actions">
        <label class="btn">Importar Excel<input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden data-import></label>
        <button class="btn btn--primary" type="button" data-add>Añadir grupo</button>
      </div>
    </div>
    ${published ? "" : html`<p class="notice" style="margin-bottom:14px">Podéis ir preparando la lista. Los enlaces funcionarán cuando la web esté publicada.</p>`}
    ${groups.length ? html`
      <div class="toolbar">
        <input type="search" data-q value="${query.get("q") || ""}" placeholder="Buscar un nombre, email o teléfono" aria-label="Buscar">
        <a class="btn btn--small" href="#/imprimir">Imprimir códigos QR</a>
        <button class="btn btn--small" type="button" data-export>Descargar la lista (Excel)</button>
      </div>
      <div class="groups">${list.map((g) => {
        const st = statusOf(g);
        const goes = new Set((g.answer?.companions || []).filter((c) => c.attending).map((c) => c.id));
        return html`<article class="group" data-id="${g.id}">
          <div class="group__name">${g.name}</div>
          <div class="group__side"><span class="status" data-s="${st.s}">${st.label}</span></div>
          <div class="group__people">${g.guests.length
            ? g.guests.map((p, i) => html`${i ? ", " : ""}<span class="${g.answer ? (goes.has(p.id) ? "is-yes" : g.answer.companions?.length ? "is-no" : "") : ""}">${fullName(p)}${p.is_child ? " (niño/a)" : ""}</span>`)
            : html`${g.seats} ${g.seats === 1 ? "plaza" : "plazas"}`}</div>
          ${g.answer && (g.answer.dietary || g.answer.message) ? html`<div class="group__extra">${g.answer.dietary ? `Alergias: ${g.answer.dietary}. ` : ""}${g.answer.message ? html`<q>${g.answer.message}</q>` : ""}</div>` : ""}
          <div class="group__actions">
            <a class="btn btn--small" href="${whatsapp(g.phone, inviteMessage(data, g))}" target="_blank" rel="noopener" data-sent="${g.id}">${raw(icons.whatsapp)} Enviar invitación</a>
            <button class="btn btn--small" type="button" data-copy="${g.id}">Copiar enlace</button>
            <button class="btn btn--small btn--quiet" type="button" data-edit="${g.id}">Editar</button>
          </div>
        </article>`;
      })}</div>
      ${list.length ? "" : html`<p class="empty">Nadie coincide con «${query.get("q")}».</p>`}`
    : html`<section class="panel-block stack">
        <p><strong>Dos formas de empezar:</strong></p>
        <ol class="stack" style="margin:0;padding-left:20px;gap:6px">
          <li><b>Importar vuestro Excel</b> con columnas <i>Grupo, Nombre, Apellidos, Niño, Email, Teléfono</i>. Cada grupo (una familia, una pareja de amigos) recibe un enlace personal.
            <button class="btn btn--small btn--quiet" type="button" data-template style="display:inline-flex;margin-left:4px">Descargar la plantilla</button></li>
          <li><b>Añadir grupos a mano</b> con el botón «Añadir grupo».</li>
        </ol>
        <p class="small muted">Cada grupo recibe su enlace: la web les saluda por su nombre, sabe cuántos son y marcan quién viene, alergias y autobús.</p>
      </section>`}`);

  const byId = (id) => groups.find((g) => g.id === id);
  $("[data-add]", el).addEventListener("click", () => editGroup(ctx, null));
  $$("[data-edit]", el).forEach((b) => b.addEventListener("click", () => editGroup(ctx, byId(b.dataset.edit))));
  $$("[data-copy]", el).forEach((b) => b.addEventListener("click", async () => {
    const g = byId(b.dataset.copy);
    toast((await copy(inviteUrl(data.wedding.slug, g.token))) ? `Enlace de ${g.name} copiado.` : inviteUrl(data.wedding.slug, g.token));
  }));
  $("[data-template]", el)?.addEventListener("click", () => downloadCsv("lista-de-invitados.csv", TEMPLATE_ROWS.slice(1), TEMPLATE_ROWS[0].map((h, i) => [(r) => r[i], h])));
  $("[data-export]", el)?.addEventListener("click", () => {
    const rows = groups.flatMap((g) => (g.guests.length ? g.guests : [{ first_name: "", last_name: "" }]).map((p) => ({ g, p })));
    downloadCsv(`invitados-${data.wedding.slug}.csv`, rows, [
      [(r) => r.g.name, "Grupo"], [(r) => r.p.first_name, "Nombre"], [(r) => r.p.last_name || "", "Apellidos"], [(r) => (r.p.is_child ? "sí" : ""), "Niño"],
      [(r) => r.g.email || "", "Email"], [(r) => r.g.phone || "", "Teléfono"], [(r) => statusOf(r.g).label, "Estado"], [(r) => inviteUrl(data.wedding.slug, r.g.token), "Enlace personal"],
    ]);
  });
  $("[data-q]", el)?.addEventListener("input", debounce((e) => go(`/invitados${e.target.value ? `?q=${encodeURIComponent(e.target.value)}` : ""}`), 400));
  if (query.get("q")) { const i = $("[data-q]", el); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  $("[data-import]", el).addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) importFile(ctx, f, groups); });
}

async function editGroup(ctx, g) {
  const { weddingId } = ctx;
  const people = g ? g.guests.map((p) => ({ ...p })) : [{ first_name: "", last_name: "", is_child: false }];
  let entered = [];
  const row = (p, i) => html`<div class="people-edit__row" data-i="${i}">
    <input name="first" value="${p.first_name || ""}" placeholder="Nombre" aria-label="Nombre">
    <input name="last" value="${p.last_name || ""}" placeholder="Apellidos" aria-label="Apellidos">
    <label class="check small"><input type="checkbox" name="child" ${p.is_child ? "checked" : ""}> Niño/a</label>
    <button class="icon-btn" type="button" data-remove aria-label="Quitar">${raw(icons.trash)}</button></div>`;
  const form = await formDialog({
    title: g ? `Editar ${g.name}` : "Nuevo grupo",
    submit: "Guardar",
    body: html`<div class="form">
      <div class="field"><label for="g-name">Nombre del grupo</label><input id="g-name" name="name" value="${g?.name || ""}" placeholder="Familia Ortega, Tíos de Martín…" required>
        <span class="hint">Así les saluda la web: «Hola, Familia Ortega».</span></div>
      <div class="field"><span class="label">Quiénes son</span><div class="people-edit" data-people>${people.map(row)}</div>
        <div><button class="btn btn--small" type="button" data-more>Añadir persona</button></div>
        <span class="hint">Si no sabéis los nombres (por ejemplo, «y acompañante»), dejadlo vacío y poned cuántas plazas tienen.</span></div>
      <div class="grid-2">
        <div class="field"><label for="g-seats">Plazas</label><input id="g-seats" name="seats" type="number" min="1" max="50" value="${g?.seats || 1}"></div>
        <div class="field"><label for="g-phone">Móvil (para WhatsApp)</label><input id="g-phone" name="phone" type="tel" value="${g?.phone || ""}"></div>
      </div>
      <div class="field"><label for="g-email">Email (para recordatorios)</label><input id="g-email" name="email" type="email" value="${g?.email || ""}"></div>
      ${g ? html`<div class="btn-row"><button class="btn btn--small btn--quiet" type="button" data-rotate>Cambiar el enlace personal</button>
        <button class="btn btn--small btn--quiet btn--danger" type="button" data-delete>Borrar el grupo</button></div>` : ""}
    </div>`,
    onOpen: (f) => {
      const box = f.querySelector("[data-people]");
      // Antes de que se cierre el diálogo: quién es quién (FormData no dice qué casillas van con qué fila).
      f.closest("dialog").addEventListener("submit", () => {
        entered = [...box.querySelectorAll(".people-edit__row")].map((r) => ({
          first: r.querySelector("[name=first]").value.trim(), last: r.querySelector("[name=last]").value.trim(),
          child: r.querySelector("[name=child]").checked,
        })).filter((p) => p.first);
      }, true);
      const sync = () => {
        const n = [...box.querySelectorAll("[name=first]")].filter((i) => i.value.trim()).length;
        if (n && Number(f.seats.value) < n) f.seats.value = n;
      };
      box.addEventListener("input", sync);
      box.addEventListener("click", (e) => { if (e.target.closest("[data-remove]")) { e.target.closest(".people-edit__row").remove(); } });
      f.querySelector("[data-more]").addEventListener("click", () => {
        box.insertAdjacentHTML("beforeend", str(row({ first_name: "", last_name: "", is_child: false }, box.children.length)));
        box.lastElementChild.querySelector("input").focus();
      });
      f.querySelector("[data-rotate]")?.addEventListener("click", async () => {
        if (!(await confirmDialog("¿Cambiar el enlace?", "El enlace que ya les mandasteis dejará de funcionar. Tendréis que mandarles el nuevo.", "Cambiar"))) return;
        try {
          const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), (x) => x.toString(16).padStart(2, "0")).join("");
          await db.update("guest_groups", { id: `eq.${g.id}` }, { token });
          f.closest("dialog").close(); f.closest("dialog").remove();
          toast("Enlace cambiado. Mandadles el nuevo."); ctx.reload();
        } catch (e) { fail(e); }
      });
      f.querySelector("[data-delete]")?.addEventListener("click", async () => {
        if (!(await confirmDialog(`¿Borrar ${g.name}?`, g.answer ? "Su respuesta se conserva en Respuestas, pero sin grupo." : "Se borra el grupo y su enlace deja de funcionar.", "Borrar", true))) return;
        try { await db.remove("guest_groups", { id: `eq.${g.id}` }); f.closest("dialog").close(); f.closest("dialog").remove(); toast("Grupo borrado."); ctx.reload(); }
        catch (e) { fail(e); }
      });
    },
  });
  if (!form) return;
  const seats = Math.max(Number(form.get("seats")) || 1, entered.length || 1);
  const row_ = { name: String(form.get("name")).trim().slice(0, 120), seats, phone: String(form.get("phone")).trim() || null, email: String(form.get("email")).trim().toLowerCase() || null };
  try {
    let id = g?.id;
    if (g) await db.update("guest_groups", { id: `eq.${g.id}` }, row_);
    else id = (await db.insert("guest_groups", { ...row_, wedding_id: weddingId, sort: Date.now() % 2147483647 }))[0].id;
    // Personas: se sustituyen por las del formulario (las que ya estaban conservan su identidad si no cambian).
    const old = g?.guests || [];
    const keep = new Set();
    const inserts = [];
    for (const p of entered) {
      const match = old.find((o) => !keep.has(o.id) && o.first_name === p.first && (o.last_name || "") === p.last);
      if (match) {
        keep.add(match.id);
        if (match.is_child !== p.child) await db.update("guests", { id: `eq.${match.id}` }, { is_child: p.child });
      } else inserts.push({ wedding_id: weddingId, group_id: id, first_name: p.first, last_name: p.last || null, is_child: p.child });
    }
    const gone = old.filter((o) => !keep.has(o.id)).map((o) => o.id);
    if (gone.length) await db.remove("guests", { id: `in.(${gone.join(",")})` });
    if (inserts.length) await db.insert("guests", inserts);
    toast(g ? "Grupo guardado." : `${row_.name} añadido. Ya podéis mandarles su enlace.`);
    ctx.reload();
  } catch (e) { fail(e); }
}

async function importFile(ctx, file, existing) {
  const { weddingId } = ctx;
  let rows;
  try {
    rows = /\.csv$/i.test(file.name) ? parseCsv(await file.text()) : await readXlsx(await file.arrayBuffer());
  } catch (e) {
    return fail(new Error(`No se ha podido leer «${file.name}». Guardadlo como Excel (.xlsx) o CSV. (${e.message})`));
  }
  const { groups, errors } = parseGuestRows(rows);
  if (!groups.length) return fail(new Error(errors[0] || "No hay invitados en el archivo."));
  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const have = new Set(existing.map((g) => norm(g.name)));
  const fresh = groups.filter((g) => !have.has(norm(g.name)));
  const repeated = groups.length - fresh.length;
  const people = fresh.reduce((n, g) => n + g.guests.length, 0);
  const ok = await formDialog({
    title: `Importar ${people} personas`,
    submit: fresh.length ? `Importar ${fresh.length} grupos` : "Cerrar",
    body: html`<div class="stack small">
      <p>En «${file.name}» hay <b>${groups.length} grupos</b> con <b>${groups.reduce((n, g) => n + g.guests.length, 0)} personas</b>.</p>
      ${repeated ? html`<p class="notice">${repeated} grupos ya están en vuestra lista (mismo nombre) y no se tocan.</p>` : ""}
      ${errors.length ? html`<p class="notice">${errors.slice(0, 5).join(" ")}${errors.length > 5 ? ` …y ${errors.length - 5} avisos más.` : ""}</p>` : ""}
      <div class="table-wrap" style="max-height:240px;overflow:auto"><table class="table"><thead><tr><th>Grupo</th><th>Personas</th></tr></thead>
        <tbody>${fresh.slice(0, 40).map((g) => html`<tr><td>${g.name}</td><td>${g.guests.map((p) => [p.first_name, p.last_name].filter(Boolean).join(" ") + (p.is_child ? " (niño/a)" : "")).join(", ")}</td></tr>`)}</tbody></table></div>
      ${fresh.length > 40 ? html`<p class="muted">…y ${fresh.length - 40} grupos más.</p>` : ""}
    </div>`,
  });
  if (!ok || !fresh.length) return;
  try {
    const base = Date.now() % 2000000000;
    const groupRows = fresh.map((g, i) => ({ id: crypto.randomUUID(), wedding_id: weddingId, name: g.name, seats: Math.max(1, g.guests.length), email: g.email || null, phone: g.phone || null, sort: base + i }));
    for (let i = 0; i < groupRows.length; i += 200) await db.insert("guest_groups", groupRows.slice(i, i + 200));
    const guestRows = fresh.flatMap((g, i) => g.guests.map((p) => ({ wedding_id: weddingId, group_id: groupRows[i].id, first_name: p.first_name, last_name: p.last_name, is_child: p.is_child, email: p.email, phone: p.phone })));
    for (let i = 0; i < guestRows.length; i += 500) await db.insert("guests", guestRows.slice(i, i + 500));
    toast(`Importados ${fresh.length} grupos con ${guestRows.length} personas.`);
    ctx.reload();
  } catch (e) { fail(e); }
}
