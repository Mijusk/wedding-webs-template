// Inicio: lo importante del día en una pantalla.
import { db } from "../supa.js";
import { html, render, $$, fmtDate, fmtDateLong, fmtDateTime, fmtMoney, timeAgo, untilDate, todayMadrid, stamp, SOURCES, LEAD_STATUSES, STATUS_COLOR, statusChip, fail, toast } from "../ui.js";

export default async function inicio({ el, staff, refreshCounts }) {
  render(el, html`<p class="muted">Cargando…</p>`);
  const d = await db.rpc("dashboard_summary");
  const hour = Number(new Date().toLocaleString("es-ES", { hour: "numeric", hour12: false, timeZone: "Europe/Madrid" }));
  const hello = hour < 14 ? "Buenos días" : hour < 21 ? "Buenas tardes" : "Buenas noches";
  const first = (staff.name || "").split(/\s|\(/)[0];
  const today = todayMadrid();
  const late = (t) => t.due_at && t.due_at.slice(0, 10) < today && new Date(t.due_at) < new Date();
  const total = Object.values(d.embudo || {}).reduce((a, b) => a + b, 0);

  render(el, html`
    <div class="page-head">
      <div>
        <h1 class="greeting">${hello}${first ? `, ${first}` : ""}</h1>
        <p>${fmtDateLong(today)}</p>
      </div>
      <div class="page-actions">
        <a class="btn" href="#/leads">Ver todos los leads</a>
        <a class="btn btn--primary" href="#/bodas/nueva">Nueva boda</a>
      </div>
    </div>

    <div class="today">
      <section class="panel-block">
        <h2 class="block-title">Por contestar <a href="#/leads?estado=nuevo">${d.leads_nuevos_total} en total</a></h2>
        ${d.leads_nuevos.length ? html`<div class="rows">${d.leads_nuevos.map((l) => html`
          <a class="row" href="#/leads/${l.id}">
            <span class="row__title serif" style="font-size:18px">${l.names || l.email}</span>
            <span class="row__side">${l.trials > 1 ? html`<span class="tag">probó ${l.trials} veces</span>` : ""}${l.source === "reserva" || l.tier ? html`<span class="tag tag--accent">Reserva</span>` : ""}</span>
            <span class="row__sub">${SOURCES[l.source] || l.source} · ${timeAgo(l.created_at)}${l.wedding_date ? ` · boda ${untilDate(l.wedding_date)}` : ""}</span>
          </a>`)}</div>`
          : html`<p class="empty"><strong>Nadie esperando respuesta.</strong>Cuando una pareja pruebe su web en el escaparate, aparecerá aquí al momento.</p>`}
      </section>

      <section class="panel-block">
        <h2 class="block-title">Para hoy <a href="#/tareas">Todas las tareas</a></h2>
        <div data-tasks>
        ${d.tareas.length || d.proximas_acciones.length ? html`
          ${d.tareas.map((t) => html`<div class="task">
            <input type="checkbox" data-done="${t.id}" aria-label="Hecha: ${t.title}">
            <div><div class="task__title">${t.title}</div>
              <div class="task__sub">${t.due_at ? html`<span class="task__due ${late(t) ? "is-late" : ""}">${late(t) ? "Vencida · " : ""}${fmtDateTime(t.due_at)}</span>` : "Sin fecha"}${t.about ? html` · ${link(t)}` : ""}</div></div>
            <span></span></div>`)}
          ${d.proximas_acciones.map((l) => html`<div class="task">
            <span aria-hidden="true"></span>
            <div><div class="task__title">${l.next_action}</div>
              <div class="task__sub"><span class="task__due ${new Date(l.next_action_at) < new Date() ? "is-late" : ""}">${fmtDateTime(l.next_action_at)}</span> · <a href="#/leads/${l.id}">${l.names}</a></div></div>
            ${statusChip(l.status)}</div>`)}`
          : html`<p class="empty"><strong>Nada pendiente para hoy.</strong>Las tareas y próximas acciones de cada lead aparecen aquí el día que tocan.</p>`}
        </div>
      </section>

      <section class="panel-block">
        <h2 class="block-title">Webs por entregar</h2>
        ${d.bodas_por_entregar.length ? html`<div class="rows">${d.bodas_por_entregar.map((o) => html`
          <a class="row" href="${o.wedding_id ? `#/bodas/${o.wedding_id}` : "#/clientes"}">
            <span class="row__title">${o.display_name || o.number}</span>
            <span class="row__side">${statusChip(o.status)}</span>
            <span class="row__sub">Pedido ${o.number}${o.promised_delivery_at ? ` · entregar ${untilDate(o.promised_delivery_at)} (${fmtDate(o.promised_delivery_at)})` : ""}</span>
          </a>`)}</div>`
          : html`<p class="empty"><strong>Ninguna web pendiente de entregar.</strong>Los pedidos pagados aparecen aquí con su fecha de entrega.</p>`}
      </section>

      <section class="panel-block">
        <h2 class="block-title">Bodas de esta semana</h2>
        ${d.bodas_semana.length ? html`<div class="rows">${d.bodas_semana.map((w) => html`
          <a class="row" href="#/bodas/${w.id}" style="grid-template-columns:auto minmax(0,1fr)">
            ${stamp(w.wedding_date)}
            <span><span class="row__title serif" style="font-size:18px;display:block">${(w.couple || []).join(" y ")}</span>
            <span class="row__sub">${w.venue || ""} · ${untilDate(w.wedding_date)}</span></span>
          </a>`)}</div>`
          : html`<p class="empty">No hay bodas en los próximos 7 días.</p>`}
      </section>

      <section class="panel-block">
        <h2 class="block-title">Pagos de los últimos 14 días</h2>
        ${d.pagos_recientes.length ? html`<div class="rows">${d.pagos_recientes.map((p) => html`
          <div class="row"><span class="row__title">${p.display_name || p.number}</span>
            <span class="row__side"><b>${fmtMoney(p.amount_cents)}</b></span>
            <span class="row__sub">${p.provider} · ${fmtDateTime(p.paid_at)} · pedido ${p.number}</span></div>`)}</div>`
          : html`<p class="empty">Sin pagos recientes.</p>`}
      </section>

      <section class="panel-block">
        <h2 class="block-title">Embudo <a href="#/leads">${total} leads</a></h2>
        <div class="funnel" role="img" aria-label="Leads por estado">
          ${LEAD_STATUSES.map(([s]) => (d.embudo[s] ? html`<span style="width:${(d.embudo[s] / total) * 100}%;background:${STATUS_COLOR[s]}"></span>` : ""))}
        </div>
        <div class="funnel-legend">${LEAD_STATUSES.map(([s, label]) => html`<span><i class="dot" style="background:${STATUS_COLOR[s]}"></i>${label} <b>${d.embudo[s] || 0}</b></span>`)}</div>
        <p class="small muted" style="margin-top:12px">${d.respuestas_semana} respuestas de invitados esta semana en todas las webs.</p>
      </section>
    </div>`);

  $$("[data-done]", el).forEach((box) => box.addEventListener("change", async () => {
    box.disabled = true;
    try {
      await db.update("tasks", { id: `eq.${box.dataset.done}` }, { status: "hecha" });
      box.closest(".task").classList.add("is-done");
      toast("Tarea hecha.", { action: "Deshacer", onAction: async () => {
        await db.update("tasks", { id: `eq.${box.dataset.done}` }, { status: "pendiente" });
        box.checked = false; box.disabled = false; box.closest(".task").classList.remove("is-done");
      } });
    } catch (e) { box.checked = false; box.disabled = false; fail(e); }
  }));
  refreshCounts();
}

function link(t) {
  const href = t.lead_id ? `#/leads/${t.lead_id}` : t.wedding_id ? `#/bodas/${t.wedding_id}` : t.client_id ? `#/clientes/${t.client_id}` : "";
  return href ? html`<a href="${href}">${t.about}</a>` : t.about;
}
