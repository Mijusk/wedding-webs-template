// Ficha de un lead: estado, contacto (WhatsApp, email, llamada), próxima acción, línea de tiempo,
// tareas, datos de la boda, publicidad y consentimiento.
import { db } from "../supa.js";
import { html, raw, render, $, $$, LEAD_STATUSES, SOURCES, STATUS_COLOR, statusChip, fmtDate, fmtDateLong, fmtDateTime, timeAgo, untilDate,
  formDialog, confirmDialog, showDialog, toast, fail, waLink, mailLink, icons } from "../ui.js";
import { MENSAJES, fillMessage } from "../mensajes.js";
import { styles, withSamplePhotos, livePreview } from "../catalogo.js";

export async function askLostReason() {
  const data = await formDialog({
    title: "¿Por qué se ha perdido?",
    text: "Sirve para saber qué falla: precio, plazos, competencia…",
    submit: "Marcar como perdido",
    danger: true,
    body: html`<div class="field"><label for="lost">Motivo</label>
      <input id="lost" name="reason" list="lost-reasons" required>
      <datalist id="lost-reasons"><option>No contesta</option><option>Precio</option><option>Ya tienen web</option><option>Se lo hace la wedding planner</option><option>Se han ido con otra empresa</option><option>Boda cancelada</option></datalist></div>`,
  });
  return data ? String(data.get("reason")).trim() : null;
}

const KIND_ICON = { nota: icons.note, estado: icons.flag, prueba: icons.spark, reserva: icons.spark, pago: icons.euro, boda: icons.globe, tarea: icons.check,
  whatsapp: icons.whatsapp, email: icons.mail, llamada: icons.phone, sistema: icons.spark };

export default async function lead(ctx) {
  const { el, params, staff, go, setTitle, refreshCounts } = ctx;
  const id = params.id;
  const [l, activities, tasks, weddings] = await Promise.all([
    db.one("leads", { select: "*,lead_attribution(*),consents(*)", id: `eq.${id}` }),
    db.select("activities", { select: "*,staff:actor_id(name)", lead_id: `eq.${id}`, order: "created_at.desc", limit: 200 }),
    db.select("tasks", { select: "*", lead_id: `eq.${id}`, status: "eq.pendiente", order: "due_at.asc.nullslast" }),
    db.select("weddings", { select: "id,slug,status,template", lead_id: `eq.${id}` }),
  ]);
  if (!l) return render(el, html`<p class="empty"><strong>Este lead no existe o se ha borrado.</strong><a href="#/leads">Volver a los leads</a></p>`);
  setTitle(l.names || l.email);
  const reload = () => lead(ctx);
  const isAdmin = ["owner", "admin"].includes(staff.role);
  const order = LEAD_STATUSES.map(([s]) => s).filter((s) => s !== "perdido");
  const pos = order.indexOf(l.status);
  const first = l.lead_attribution?.find((a) => a.touch === "primero");
  const last = l.lead_attribution?.find((a) => a.touch === "ultimo");

  render(el, html`
    <a class="back" href="#/leads">← Leads</a>
    <div class="page-head who">
      <div>
        <h1>${l.names || l.email || l.phone}</h1>
        <div class="who__contact">
          ${l.email ? html`<a href="mailto:${l.email}">${l.email}</a>` : ""}
          ${l.phone ? html`<a href="tel:${l.phone}">${l.phone}</a>` : ""}
          <span>${SOURCES[l.source] || l.source}, ${timeAgo(l.created_at)}</span>
        </div>
      </div>
      <div class="page-actions">
        <button class="btn" type="button" data-edit>Editar datos</button>
        ${isAdmin ? html`<button class="btn btn--quiet btn--danger" type="button" data-delete>Borrar</button>` : ""}
      </div>
    </div>

    <div class="pipeline" role="group" aria-label="Estado">
      ${order.map((s, i) => html`<button type="button" data-status="${s}" style="--c:${STATUS_COLOR[s]}" aria-pressed="${l.status === s}" class="${i < pos ? "is-past" : ""}">${LEAD_STATUSES.find(([x]) => x === s)[1]}</button>`)}
      <button type="button" class="btn btn--small pipeline-lost ${l.status === "perdido" ? "" : "btn--quiet"}" data-status="perdido" aria-pressed="${l.status === "perdido"}">${l.status === "perdido" ? `Perdido: ${l.lost_reason}` : "Marcar como perdido"}</button>
    </div>

    <div class="actions">
      ${l.phone ? html`<button class="btn" type="button" data-contact="whatsapp">${raw(icons.whatsapp)} WhatsApp</button>` : ""}
      ${l.email ? html`<button class="btn" type="button" data-contact="email">${raw(icons.mail)} Email</button>` : ""}
      ${l.phone ? html`<button class="btn" type="button" data-contact="llamada">${raw(icons.phone)} Apuntar llamada</button>` : ""}
      ${weddings.length ? weddings.map((w) => html`<a class="btn" href="#/bodas/${w.id}">Ver su web /b/${w.slug}</a>`)
        : html`<a class="btn btn--primary" href="#/bodas/nueva?lead=${l.id}">Crear su web</a>`}
      ${l.client_id ? html`<a class="btn" href="#/clientes/${l.client_id}">Ver cliente</a>`
        : html`<button class="btn" type="button" data-convert>Convertir en cliente</button>`}
    </div>

    <div class="cols" style="margin-top:18px">
      <div class="stack">
        <section class="panel-block">
          <h2>Próxima acción</h2>
          <form class="next-action" data-next>
            <div class="field"><label for="na-text">Qué hay que hacer</label><input id="na-text" name="next_action" value="${l.next_action || ""}" placeholder="Llamar para resolver dudas"></div>
            <div class="field"><label for="na-when">Cuándo</label><input id="na-when" name="next_action_at" type="datetime-local" value="${toLocalInput(l.next_action_at)}"></div>
            <button class="btn" type="submit">Guardar</button>
          </form>
        </section>

        <section class="panel-block">
          <h2>Historial</h2>
          <form class="note-form" data-note>
            <label class="sr-only" for="note">Nota</label>
            <textarea id="note" name="body" placeholder="Apunta algo: qué te han dicho, qué quieren cambiar…"></textarea>
            <div><button class="btn btn--small" type="submit">Añadir nota</button></div>
          </form>
          <div class="timeline">${activities.map((a) => html`<div class="tl" data-kind="${a.kind}">
            <span class="tl__icon">${raw(KIND_ICON[a.kind] || icons.spark)}</span>
            <div>
              <div class="tl__title">${a.title}</div>
              ${a.body ? html`<div class="tl__body">${a.body}</div>` : ""}
              <div class="tl__when">${fmtDateTime(a.created_at)}${a.staff?.name ? `, ${a.staff.name}` : ""}
                ${a.kind === "nota" && (a.actor_id === staff.id || isAdmin) ? html` · <button class="btn--quiet" style="border:0;background:none;padding:0;color:inherit;text-decoration:underline;cursor:pointer" data-del-note="${a.id}" type="button">borrar</button>` : ""}</div>
            </div></div>`)}</div>
        </section>
      </div>

      <div class="stack">
        <section class="panel-block">
          <h2>La boda</h2>
          <dl class="facts">
            <dt>Fecha</dt><dd>${l.wedding_date ? html`${fmtDateLong(l.wedding_date)}${l.wedding_time ? `, ${l.wedding_time.slice(0, 5)}` : ""} <span class="muted">(${untilDate(l.wedding_date)})</span>` : "—"}</dd>
            <dt>Lugar</dt><dd>${[l.venue, l.city && !String(l.venue || "").includes(l.city) ? l.city : ""].filter(Boolean).join(", ") || "—"}</dd>
            <dt>Estilo</dt><dd>${l.style || "—"}</dd>
            <dt>Tarifa</dt><dd>${l.tier || "—"}${l.reserved_at ? html` <span class="tag tag--accent">reservó ${timeAgo(l.reserved_at)}</span>` : ""}</dd>
            <dt>Pruebas</dt><dd>${l.trials ? `${l.trials} en el escaparate` : "—"}</dd>
            ${l.message ? html`<dt>Mensaje</dt><dd>${l.message}</dd>` : ""}
          </dl>
          ${l.trial_config ? html`<p style="margin-top:12px"><button class="btn btn--small" type="button" data-trial>Ver la web que probaron</button></p>` : ""}
        </section>

        <section class="panel-block">
          <h2 class="block-title">Tareas <a href="#/tareas">Todas</a></h2>
          <form class="form" data-task style="margin-bottom:8px">
            <div class="grid-2"><input name="title" placeholder="Nueva tarea" aria-label="Nueva tarea"><input name="due_at" type="datetime-local" aria-label="Para cuándo"></div>
            <div><button class="btn btn--small" type="submit">Añadir tarea</button></div>
          </form>
          ${tasks.map((t) => html`<div class="task"><input type="checkbox" data-done="${t.id}" aria-label="Hecha">
            <div><div class="task__title">${t.title}</div><div class="task__sub">${t.due_at ? fmtDateTime(t.due_at) : "Sin fecha"}</div></div><span></span></div>`)}
        </section>

        <section class="panel-block">
          <h2>De dónde vino</h2>
          ${first || last ? html`<dl class="facts">
            ${[["Primer toque", first], ["Último toque", last]].filter(([, a]) => a).map(([label, a]) => html`
              <dt>${label}</dt><dd>${[a.utm_source, a.utm_medium, a.utm_campaign].filter(Boolean).join(" / ") || "Directo"}
                ${a.gclid ? html`<div class="small muted">Google Ads (gclid)</div>` : ""}${a.fbclid ? html`<div class="small muted">Meta (fbclid)</div>` : ""}
                ${a.referrer ? html`<div class="small muted">Desde ${a.referrer}</div>` : ""}
                ${a.landing_page ? html`<div class="small muted">Entró por ${a.landing_page}</div>` : ""}</dd>`)}
          </dl>` : html`<p class="muted small">Sin datos de publicidad (llegó directamente o se creó a mano).</p>`}
        </section>

        <section class="panel-block">
          <h2>Consentimiento</h2>
          ${l.consents?.length ? l.consents.map((c) => html`<p class="small">Aceptó el ${fmtDateTime(c.created_at)}${c.ip ? `, desde la IP ${c.ip}` : ""}:</p>
            <p class="small muted" style="margin-top:4px">«${c.text}»</p>`)
          : html`<p class="muted small">${l.source === "reserva" ? "Pidió presupuesto (reserva): se le puede escribir para cerrar la contratación." : "No hay consentimiento guardado para comunicaciones comerciales."}</p>`}
        </section>
      </div>
    </div>`);

  // Estado
  $$("[data-status]", el).forEach((b) => b.addEventListener("click", async () => {
    const to = b.dataset.status;
    if (to === l.status) return;
    const patch = { status: to };
    if (to === "perdido") {
      const reason = await askLostReason();
      if (!reason) return;
      patch.lost_reason = reason;
    }
    try { await db.update("leads", { id: `eq.${id}` }, patch); refreshCounts(); reload(); }
    catch (e) { fail(e); }
  }));

  // Contacto
  $$("[data-contact]", el).forEach((b) => b.addEventListener("click", () => contact(b.dataset.contact, l, staff, reload)));

  $("[data-convert]", el)?.addEventListener("click", async () => {
    if (!(await confirmDialog("¿Convertir en cliente?", "Se crea su ficha de cliente con estos datos y el lead pasa a Ganado.", "Convertir"))) return;
    try { const cid = await db.rpc("convert_lead_to_client", { p_lead_id: id }); toast("Ya es cliente."); go(`/clientes/${cid}`); }
    catch (e) { fail(e); }
  });

  $("[data-edit]", el).addEventListener("click", () => editLead(l, reload));
  $("[data-delete]", el)?.addEventListener("click", async () => {
    if (!(await confirmDialog("¿Borrar este lead?", "Se borra con su historial y sus tareas. Hazlo si la pareja te pide que borres sus datos. No se puede deshacer.", "Borrar", true))) return;
    try { await db.remove("leads", { id: `eq.${id}` }); toast("Lead borrado."); go("/leads"); }
    catch (e) { fail(e); }
  });

  $("[data-next]", el).addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    try {
      await db.update("leads", { id: `eq.${id}` }, { next_action: d.next_action.trim() || null, next_action_at: d.next_action_at ? new Date(d.next_action_at).toISOString() : null });
      toast("Próxima acción guardada.");
    } catch (ex) { fail(ex); }
  });

  $("[data-note]", el).addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = e.target.body.value.trim();
    if (!body) return;
    try { await db.insert("activities", { lead_id: id, client_id: l.client_id, kind: "nota", title: "Nota", body, actor_id: staff.id }); reload(); }
    catch (ex) { fail(ex); }
  });
  $$("[data-del-note]", el).forEach((b) => b.addEventListener("click", async () => {
    try { await db.remove("activities", { id: `eq.${b.dataset.delNote}` }); reload(); } catch (e) { fail(e); }
  }));

  $("[data-task]", el).addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    if (!d.title.trim()) return;
    try { await db.insert("tasks", { title: d.title.trim(), due_at: d.due_at ? new Date(d.due_at).toISOString() : null, lead_id: id }); reload(); }
    catch (ex) { fail(ex); }
  });
  $$("[data-done]", el).forEach((box) => box.addEventListener("change", async () => {
    try { await db.update("tasks", { id: `eq.${box.dataset.done}` }, { status: "hecha" }); reload(); } catch (e) { fail(e); }
  }));

  $("[data-trial]", el)?.addEventListener("click", () => showTrial(l));
}

export const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

async function contact(kind, l, staff, reload) {
  if (kind === "llamada") {
    const data = await formDialog({
      title: "Apuntar llamada", submit: "Guardar",
      body: html`<p><a class="btn" href="tel:${l.phone}">${raw(icons.phone)} Llamar al ${l.phone}</a></p>
        <div class="field"><label for="call">Qué habéis hablado</label><textarea id="call" name="body"></textarea></div>`,
    });
    if (!data) return;
    await log("llamada", "Llamada", String(data.get("body")).trim());
    return;
  }
  const options = MENSAJES;
  const pick = l.reserved_at ? "reserva" : l.status === "nuevo" ? "prueba" : "seguimiento";
  const data = await formDialog({
    title: kind === "whatsapp" ? "Escribir por WhatsApp" : "Escribir un email",
    submit: kind === "whatsapp" ? "Abrir WhatsApp" : "Abrir el email",
    body: html`<div class="form">
      <div class="field"><label for="m-tpl">Mensaje</label><select id="m-tpl" name="tpl">${options.map((m) => html`<option value="${m.id}" ${m.id === pick ? "selected" : ""}>${m.label}</option>`)}</select></div>
      ${kind === "email" ? html`<div class="field"><label for="m-subj">Asunto</label><input id="m-subj" name="subject"></div>` : ""}
      <div class="field"><label for="m-text">Texto</label><textarea id="m-text" name="text" rows="7"></textarea><span class="hint">Puedes cambiarlo antes de enviar.</span></div>
    </div>`,
    onOpen: (form) => {
      const fill = () => {
        const m = MENSAJES.find((x) => x.id === form.tpl.value);
        form.text.value = fillMessage(m, l);
        if (form.subject) form.subject.value = m.subject;
      };
      form.tpl.addEventListener("change", fill);
      fill();
    },
  });
  if (!data) return;
  const text = String(data.get("text")).trim();
  if (kind === "whatsapp") window.open(waLink(l.phone, text), "_blank", "noopener");
  else location.href = mailLink(l.email, String(data.get("subject") || ""), text);
  await log(kind, kind === "whatsapp" ? "WhatsApp enviado" : `Email: ${data.get("subject") || "(sin asunto)"}`, text);

  async function log(k, title, body) {
    try {
      await db.insert("activities", { lead_id: l.id, client_id: l.client_id, kind: k, title, body: body || null, actor_id: staff.id });
      await db.update("leads", { id: `eq.${l.id}` }, { last_contacted_at: new Date().toISOString() });
      if (l.status === "nuevo") {
        toast("Apuntado en el historial.", { action: "Marcar como contactado", onAction: async () => {
          try { await db.update("leads", { id: `eq.${l.id}` }, { status: "contactado" }); reload(); } catch (e) { fail(e); }
        } });
      }
      reload();
    } catch (e) { fail(e); }
  }
}

async function editLead(l, reload) {
  const sts = await styles();
  const data = await formDialog({
    title: "Editar datos", submit: "Guardar",
    body: html`<div class="form">
      <div class="field"><label for="e-names">Cómo se llaman (como aparecerá en el panel)</label><input id="e-names" name="names" value="${l.names}"></div>
      <div class="grid-2">
        <div class="field"><label for="e-a">Nombre 1</label><input id="e-a" name="partner_a" value="${l.partner_a || ""}"></div>
        <div class="field"><label for="e-b">Nombre 2</label><input id="e-b" name="partner_b" value="${l.partner_b || ""}"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label for="e-email">Email</label><input id="e-email" name="email" type="email" value="${l.email || ""}"></div>
        <div class="field"><label for="e-phone">Teléfono</label><input id="e-phone" name="phone" value="${l.phone || ""}"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label for="e-date">Fecha de la boda</label><input id="e-date" name="wedding_date" type="date" value="${l.wedding_date || ""}"></div>
        <div class="field"><label for="e-time">Hora</label><input id="e-time" name="wedding_time" type="time" value="${(l.wedding_time || "").slice(0, 5)}"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label for="e-venue">Lugar</label><input id="e-venue" name="venue" value="${l.venue || ""}"></div>
        <div class="field"><label for="e-city">Ciudad</label><input id="e-city" name="city" value="${l.city || ""}"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label for="e-style">Estilo</label><select id="e-style" name="style"><option value="">—</option>${sts.map((s) => html`<option value="${s.id}" ${l.style === s.id ? "selected" : ""}>${s.name}</option>`)}</select></div>
        <div class="field"><label for="e-tier">Tarifa</label><select id="e-tier" name="tier"><option value="">—</option>${["tal-cual", "con-cambios", "a-medida"].map((t) => html`<option ${l.tier === t ? "selected" : ""}>${t}</option>`)}</select></div>
      </div>
      <div class="field"><label for="e-src">Cómo llegó</label><select id="e-src" name="source">${Object.entries(SOURCES).map(([v, label]) => html`<option value="${v}" ${l.source === v ? "selected" : ""}>${label}</option>`)}</select></div>
      <div class="field"><label for="e-msg">Mensaje o notas</label><textarea id="e-msg" name="message">${l.message || ""}</textarea></div>
    </div>`,
  });
  if (!data) return;
  const patch = Object.fromEntries([...data].map(([k, v]) => [k, String(v).trim() || null]));
  if (!patch.email && !patch.phone) return toast("Deja al menos un email o un teléfono.", { error: true });
  try { await db.update("leads", { id: `eq.${l.id}` }, patch); toast("Datos guardados."); reload(); }
  catch (e) { fail(e); }
}

async function showTrial(l) {
  const style = (await styles()).find((s) => s.id === l.style || s.theme === l.trial_config?.theme) || (await styles())[0];
  const config = await withSamplePhotos({ ...l.trial_config, theme: l.trial_config.theme || style.theme }, style.template);
  const dlg = showDialog(html`<div class="dlg" style="justify-items:center">
    <h2 style="justify-self:start">La web que probaron</h2>
    <p class="muted small" style="justify-self:start">Estilo ${style.name}. Sus fotos no se guardan: salen las de ejemplo.</p>
    <div class="device" style="height:min(680px,70vh)"><iframe title="Vista previa" data-frame></iframe></div>
    <div class="dlg__actions" style="justify-self:stretch"><a class="btn btn--primary" href="#/bodas/nueva?lead=${l.id}" data-close>Crear su web con estos datos</a><button class="btn" type="button" data-close>Cerrar</button></div>
  </div>`);
  const prev = livePreview(dlg.querySelector("[data-frame]"), style.template);
  prev.update(config);
  dlg.addEventListener("close", () => prev.destroy());
}
