// Respuestas: totales, quién viene y quién no, quién falta, exportar para el catering.
// Se actualiza sola cada 30 segundos mientras está abierta.
import { db, api } from "/panel/js/supa.js";
import { html, raw, render, $, $$, formDialog, toast, fail, downloadCsv, icons, fmtDateTime, timeAgo } from "/panel/js/ui.js";
import { loadGuests, peopleOf, whatsapp, reminderMessage, inviteUrl, copy, fullName } from "../comun.js";

let timer = null;

export default async function respuestas(ctx) {
  clearInterval(timer);
  const { el, data, weddingId, query, go, refreshData } = ctx;
  const ext = Boolean(data.features?.rsvp_ampliado);
  const filter = query.get("ver") || "todas";
  const { groups, loose, answers } = await loadGuests(weddingId);
  const s = data.stats;
  const pending = groups.filter((g) => !g.answer && !g.token_revoked_at);
  const rows = [
    ...groups.filter((g) => g.answer).map((g) => ({ ...g.answer, group: g })),
    ...loose.map((a) => ({ ...a, group: null })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const shown = rows.filter((r) => filter === "todas" || (filter === "si" ? r.attending : filter === "no" ? !r.attending : false));
  const withEmail = pending.filter((g) => g.email).length;

  render(el, html`
    <div class="page-head">
      <div><h1>Respuestas</h1><p><span class="live">Se actualiza sola</span></p></div>
      <div class="page-actions">
        ${ext ? html`<button class="btn" type="button" data-catering>Excel para el catering</button>` : ""}
        <button class="btn" type="button" data-export>Descargar todas</button>
        <button class="btn btn--primary" type="button" data-manual>Apuntar una respuesta</button>
      </div>
    </div>
    <div class="figures" style="margin:0 0 18px">
      <div><b>${s.personas}</b><span>personas vienen</span></div>
      ${ext ? html`<div><b>${s.adultos}</b><span>adultos</span></div><div><b>${s.ninos}</b><span>niños</span></div>` : ""}
      <div><b>${s.no}</b><span>no vienen</span></div>
      ${ext && s.grupos ? html`<div><b>${s.pendientes}</b><span>grupos sin contestar</span></div>` : ""}
      ${ext ? html`<div><b>${s.alergias}</b><span>alergias</span></div><div><b>${s.autobus}</b><span>autobús</span></div>` : ""}
    </div>
    <div class="seg" role="group" aria-label="Filtrar" style="margin-bottom:14px">
      ${[["todas", `Todas (${rows.length})`], ["si", `Vienen (${rows.filter((r) => r.attending).length})`], ["no", `No vienen (${rows.filter((r) => !r.attending).length})`], ...(ext && groups.length ? [["pendientes", `Sin contestar (${pending.length})`]] : [])]
        .map(([v, l]) => html`<a href="#/respuestas${v === "todas" ? "" : `?ver=${v}`}" aria-current="${filter === v}">${l}</a>`)}
    </div>

    ${filter === "pendientes" ? html`<section class="panel-block">
        <div class="block-title"><span>Les falta contestar</span>
          ${withEmail ? html`<button class="btn btn--small" type="button" data-remind>Recordar por email a ${withEmail}</button>` : ""}</div>
        ${pending.length ? html`<p class="small muted" style="margin-bottom:8px">Mandadles un recordatorio por WhatsApp con su enlace (se abre ya escrito).</p>
          <div class="rows">${pending.map((g) => html`<div class="row">
            <span class="row__title">${g.name}</span>
            <span class="row__side">
              <a class="btn btn--small" href="${whatsapp(g.phone, reminderMessage(data, g))}" target="_blank" rel="noopener">${raw(icons.whatsapp)} Recordar</a>
              <button class="btn btn--small btn--quiet" type="button" data-copy="${g.id}">Copiar enlace</button></span>
            <span class="row__sub">${g.guests.length ? g.guests.map(fullName).join(", ") : `${g.seats} plazas`}${g.phone ? ` · ${g.phone}` : ""}</span>
          </div>`)}</div>` : html`<p class="empty"><strong>Han contestado todos.</strong></p>`}
      </section>`
    : html`<section class="panel-block">
        ${shown.length ? shown.map((r) => answerRow(r, ext)) : html`<p class="empty"><strong>${rows.length ? "Ninguna respuesta con este filtro." : "Aún no ha contestado nadie."}</strong>${rows.length ? "" : "Las respuestas aparecen aquí al momento en cuanto alguien confirma en vuestra web."}</p>`}
      </section>`}`);

  // Exportar
  $("[data-export]", el).addEventListener("click", () => downloadCsv(`respuestas-${data.wedding.slug}.csv`, rows, [
    [(r) => r.name, ext ? "Grupo o nombre" : "Nombre"], [(r) => (r.attending ? "Sí" : "No"), "Viene"],
    ...(ext ? [[(r) => r.adults ?? (r.attending ? 1 : 0), "Adultos"], [(r) => r.children ?? 0, "Niños"],
      [(r) => (r.companions || []).filter((c) => c.attending).map((c) => c.name).join(", "), "Quiénes"],
      [(r) => allergies(r), "Alergias o intolerancias"], [(r) => (r.bus == null ? "" : r.bus ? "Sí" : "No"), "Autobús"]] : []),
    [(r) => r.song || "", "Canción"], ...(ext ? [[(r) => r.message || "", "Mensaje"]] : []),
    [(r) => fmtDateTime(r.created_at), "Fecha"], [(r) => r.times_answered, "Veces que ha contestado"],
  ]));
  $("[data-catering]", el)?.addEventListener("click", () => {
    // Una fila por persona que viene, con su menú: lo que pide un catering.
    const ppl = [];
    for (const r of rows.filter((x) => x.attending)) {
      const listed = (r.companions || []).filter((c) => c.attending);
      if (listed.length) listed.forEach((c) => ppl.push({ grupo: r.name, nombre: c.name, tipo: c.child ? "Niño/a" : "Adulto", alergias: c.dietary || "", grupoAlergias: r.dietary || "", bus: r.bus }));
      else {
        for (let i = 0; i < (r.adults ?? 1); i++) ppl.push({ grupo: r.name, nombre: i === 0 && !r.group ? r.name : `${r.name} (adulto ${i + 1})`, tipo: "Adulto", alergias: "", grupoAlergias: r.dietary || "", bus: r.bus });
        for (let i = 0; i < (r.children ?? 0); i++) ppl.push({ grupo: r.name, nombre: `${r.name} (niño/a ${i + 1})`, tipo: "Niño/a", alergias: "", grupoAlergias: r.dietary || "", bus: r.bus });
      }
    }
    downloadCsv(`catering-${data.wedding.slug}.csv`, ppl, [
      ["grupo", "Grupo"], ["nombre", "Nombre"], ["tipo", "Adulto o niño"], ["alergias", "Alergias (de la persona)"],
      ["grupoAlergias", "Alergias (del grupo)"], [(p) => (p.bus == null ? "" : p.bus ? "Sí" : "No"), "Autobús"],
    ]);
    toast(`${ppl.length} personas en el Excel para el catering.`);
  });

  // Recordatorios
  $$("[data-copy]", el).forEach((b) => b.addEventListener("click", async () => {
    const g = groups.find((x) => x.id === b.dataset.copy);
    toast((await copy(inviteUrl(data.wedding.slug, g.token))) ? `Enlace de ${g.name} copiado.` : inviteUrl(data.wedding.slug, g.token));
  }));
  $("[data-remind]", el)?.addEventListener("click", async (e) => {
    e.target.disabled = true;
    try {
      const r = await api("/api/pareja", { accion: "recordatorio", wedding_id: weddingId });
      if (r.enviados) toast(`Recordatorio enviado a ${r.enviados} ${r.enviados === 1 ? "grupo" : "grupos"} por email.`);
      else if (r.simulados) toast("El envío de emails aún no está activado. Usad WhatsApp mientras tanto.", { timeout: 8000 });
      else toast("No se ha podido enviar ningún email.", { error: true });
    } catch (ex) {
      fail(new Error(ex.code === "ya_enviado" ? "Ya mandasteis un recordatorio hace poco. Podéis volver a hacerlo dentro de unas horas." : ex.code === "no_publicada" ? "La web aún no está publicada." : ex.message));
    }
    e.target.disabled = false;
  });

  $("[data-manual]", el).addEventListener("click", () => manual(ctx, groups));

  // Actualizar sola cada 30 s mientras se ve la página (y no hay un diálogo abierto).
  const stamp = answers[0]?.created_at || "";
  timer = setInterval(async () => {
    if (!el.isConnected) return clearInterval(timer);
    if (document.hidden || document.querySelector("dialog[open]")) return;
    try {
      const [latest] = await db.select("rsvp_responses", { select: "created_at", wedding_id: `eq.${weddingId}`, order: "created_at.desc", limit: 1 });
      if ((latest?.created_at || "") !== stamp) { await refreshData(); respuestas(ctx); toast("Ha llegado una respuesta nueva."); }
    } catch { /* sin conexión: se reintenta en el siguiente ciclo */ }
  }, 30000);
  void go;
}

const allergies = (r) => [r.dietary, ...(r.companions || []).filter((c) => c.attending && c.dietary).map((c) => `${c.name}: ${c.dietary}`)].filter(Boolean).join("; ");

function answerRow(r, ext) {
  const who = (r.companions || []).filter((c) => c.attending).map((c) => c.name);
  const details = [
    r.attending && ext ? (who.length ? who.join(", ") : `${peopleOf(r)} ${peopleOf(r) === 1 ? "persona" : "personas"}${r.children ? ` (${r.children} niño${r.children === 1 ? "" : "s"})` : ""}`) : "",
    allergies(r) && `Alergias: ${allergies(r)}`,
    r.bus === true ? "Autobús: sí" : r.bus === false ? "Autobús: no" : "",
    r.song && `Canción: «${r.song}»`,
  ].filter(Boolean);
  return html`<div class="answer">
    <span class="answer__who">${r.name}</span>
    <span><span class="status" data-s="${r.attending ? "ganado" : "perdido"}">${r.attending ? (ext ? `Vienen ${peopleOf(r)}` : "Viene") : "No viene"}</span></span>
    ${details.length ? html`<span class="answer__detail">${details.join(" · ")}</span>` : ""}
    ${r.message ? html`<span class="answer__detail"><q>${r.message}</q></span>` : ""}
    <span class="answer__detail small">${timeAgo(r.created_at)}${r.times_answered > 1 ? ` · ha cambiado su respuesta ${r.times_answered - 1} ${r.times_answered === 2 ? "vez" : "veces"}` : ""}${r.source === "panel" ? " · apuntada a mano" : ""}</span>
  </div>`;
}

async function manual(ctx, groups) {
  const { weddingId, data } = ctx;
  const ext = Boolean(data.features?.rsvp_ampliado);
  const f = await formDialog({
    title: "Apuntar una respuesta",
    text: "Para quien os ha contestado por teléfono o en persona.",
    submit: "Apuntar",
    body: html`<div class="form">
      ${ext && groups.length ? html`<div class="field"><label for="m-g">Grupo</label><select id="m-g" name="group"><option value="">— Nadie de la lista —</option>
        ${groups.map((g) => html`<option value="${g.id}">${g.name}${g.answer ? " (ya contestó)" : ""}</option>`)}</select></div>` : ""}
      <div class="field"><label for="m-n">Nombre</label><input id="m-n" name="name" placeholder="Si es de la lista, se usa el nombre del grupo"></div>
      <div class="field"><span class="label">¿Viene?</span><div class="btn-row">
        <label class="check"><input type="radio" name="attending" value="si" checked> Sí</label>
        <label class="check"><input type="radio" name="attending" value="no"> No</label></div></div>
      ${ext ? html`<div class="grid-2"><div class="field"><label for="m-a">Adultos</label><input id="m-a" name="adults" type="number" min="0" max="50" value="1"></div>
        <div class="field"><label for="m-c">Niños</label><input id="m-c" name="children" type="number" min="0" max="50" value="0"></div></div>
        <div class="field"><label for="m-d">Alergias o intolerancias</label><input id="m-d" name="dietary"></div>` : ""}
    </div>`,
  });
  if (!f) return;
  const group = groups.find((g) => g.id === f.get("group"));
  const name = (group?.name || String(f.get("name") || "")).trim();
  if (name.length < 2) return toast("Escribe el nombre o elige un grupo.", { error: true });
  const yes = f.get("attending") === "si";
  try {
    await db.insert("rsvp_responses", {
      wedding_id: weddingId, group_id: group?.id || null, name, attending: yes, source: "panel",
      ...(ext ? { adults: yes ? Number(f.get("adults")) || 0 : 0, children: yes ? Number(f.get("children")) || 0 : 0, dietary: String(f.get("dietary") || "").trim() || null } : {}),
    });
    toast("Respuesta apuntada.");
    await ctx.refreshData();
    respuestas(ctx);
  } catch (e) { fail(e); }
}
