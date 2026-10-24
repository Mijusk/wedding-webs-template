// Leads: tablero por estados (arrastrar para cambiar) y tabla con filtros.
import { db } from "../supa.js";
import { html, render, $, $$, LEAD_STATUSES, SOURCES, STATUS_COLOR, statusChip, stamp, timeAgo, fmtDate, fmtDateTime, untilDate, formDialog, toast, fail, downloadCsv, debounce } from "../ui.js";
import { askLostReason } from "./lead.js";

export default async function leads({ el, query, go, refreshCounts }) {
  const view = query.get("vista") === "tabla" ? "tabla" : "tablero";
  const f = {
    q: query.get("q") || "", estado: query.get("estado") || "", origen: query.get("origen") || "",
    campana: query.get("campana") || "", desde: query.get("desde") || "", hasta: query.get("hasta") || "",
  };

  const params = { select: "*,lead_attribution(touch,utm_source,utm_medium,utm_campaign)", order: "created_at.desc", limit: 2000 };
  if (f.estado && view === "tabla") params.status = `eq.${f.estado}`;
  if (f.origen) params.source = `eq.${f.origen}`;
  if (f.desde || f.hasta) params.and = `(${[f.desde && `wedding_date.gte.${f.desde}`, f.hasta && `wedding_date.lte.${f.hasta}`].filter(Boolean).join(",")})`;
  if (f.q) {
    const q = f.q.replace(/[(),*]/g, " ").trim();
    params.or = `(names.ilike.*${q}*,email.ilike.*${q}*,phone.ilike.*${q}*,venue.ilike.*${q}*,city.ilike.*${q}*)`;
  }
  let rows = await db.select("leads", params);
  const campaign = (l) => (l.lead_attribution || []).find((a) => a.touch === "ultimo")?.utm_campaign || (l.lead_attribution || []).find((a) => a.touch === "primero")?.utm_campaign || "";
  const campaigns = [...new Set(rows.map(campaign).filter(Boolean))].sort();
  if (f.campana) rows = rows.filter((l) => campaign(l) === f.campana);

  const setQuery = (patch) => {
    const q = new URLSearchParams({ vista: view, ...f, ...patch });
    [...q.keys()].forEach((k) => { if (!q.get(k)) q.delete(k); });
    go(`/leads?${q}`);
  };

  render(el, html`
    <div class="page-head">
      <div><h1>Leads</h1><p>${rows.length} ${rows.length === 1 ? "pareja" : "parejas"}${f.q || f.origen || f.campana || f.desde || f.hasta || (view === "tabla" && f.estado) ? " con estos filtros" : ""}.</p></div>
      <div class="page-actions">
        <div class="seg" role="group" aria-label="Vista">
          <a href="#/leads?${new URLSearchParams({ ...f, vista: "tablero" })}" aria-current="${view === "tablero"}">Tablero</a>
          <a href="#/leads?${new URLSearchParams({ ...f, vista: "tabla" })}" aria-current="${view === "tabla"}">Tabla</a>
        </div>
        <button class="btn" type="button" data-export>Exportar</button>
        <button class="btn btn--primary" type="button" data-new>Nuevo lead</button>
      </div>
    </div>
    <form class="toolbar" data-filters>
      <input type="search" name="q" value="${f.q}" placeholder="Buscar por nombre, email, teléfono o lugar" aria-label="Buscar">
      ${view === "tabla" ? html`<select name="estado" aria-label="Estado"><option value="">Todos los estados</option>${LEAD_STATUSES.map(([v, l]) => html`<option value="${v}" ${f.estado === v ? "selected" : ""}>${l}</option>`)}</select>` : ""}
      <select name="origen" aria-label="Origen"><option value="">Todos los orígenes</option>${Object.entries(SOURCES).map(([v, l]) => html`<option value="${v}" ${f.origen === v ? "selected" : ""}>${l}</option>`)}</select>
      <select name="campana" aria-label="Campaña"><option value="">Todas las campañas</option>${campaigns.map((c) => html`<option ${f.campana === c ? "selected" : ""}>${c}</option>`)}</select>
      <label class="small muted" for="f-desde">Boda entre</label>
      <input id="f-desde" type="date" name="desde" value="${f.desde}" style="flex:0 1 150px">
      <input type="date" name="hasta" value="${f.hasta}" aria-label="y" style="flex:0 1 150px">
      ${Object.values(f).some(Boolean) ? html`<a class="btn btn--quiet btn--small" href="#/leads?vista=${view}">Quitar filtros</a>` : ""}
    </form>
    <div data-list></div>`);

  const list = $("[data-list]", el);
  if (view === "tablero") board(list, rows, { refreshCounts });
  else table(list, rows, campaign);

  const form = $("[data-filters]", el);
  const apply = () => setQuery(Object.fromEntries(new FormData(form)));
  form.addEventListener("change", apply);
  form.querySelector("[name=q]").addEventListener("input", debounce(apply, 500));
  form.addEventListener("submit", (e) => { e.preventDefault(); apply(); });
  // Mantener el foco en el buscador al redibujar.
  if (document.activeElement === document.body && f.q) { const i = form.querySelector("[name=q]"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }

  $("[data-new]", el).addEventListener("click", () => newLead(go));
  $("[data-export]", el).addEventListener("click", () => downloadCsv(`leads-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
    ["names", "Pareja"], ["email", "Email"], ["phone", "Teléfono"], [(l) => LEAD_STATUSES.find(([s]) => s === l.status)?.[1], "Estado"],
    ["wedding_date", "Fecha boda"], ["venue", "Lugar"], ["city", "Ciudad"], ["style", "Estilo"], ["tier", "Tarifa"],
    [(l) => SOURCES[l.source] || l.source, "Origen"], [campaign, "Campaña"], ["created_at", "Entró"], ["next_action", "Próxima acción"],
    ["next_action_at", "Fecha próxima acción"], ["lost_reason", "Motivo de pérdida"],
  ]));
}

function card(l) {
  return html`<a class="card" href="#/leads/${l.id}" draggable="true" data-id="${l.id}" data-status="${l.status}">
    <span class="card__names">${l.names || l.email || l.phone}</span>
    ${stamp(l.wedding_date)}
    <span class="card__meta"><span>${SOURCES[l.source] || l.source}</span><span>${timeAgo(l.created_at)}</span></span>
    ${l.reserved_at || l.trials > 1 || l.next_action_at || l.style ? html`<span class="card__tags">
      ${l.reserved_at ? html`<span class="tag tag--accent">Reserva${l.tier ? `: ${l.tier}` : ""}</span>` : ""}
      ${l.trials > 1 ? html`<span class="tag">probó ${l.trials} veces</span>` : ""}
      ${l.style ? html`<span class="tag">${l.style}</span>` : ""}
      ${l.next_action_at && !["ganado", "perdido"].includes(l.status) ? html`<span class="tag" title="${l.next_action}" style="${new Date(l.next_action_at) < new Date() ? "color:var(--danger);border-color:var(--danger)" : ""}">${fmtDateTime(l.next_action_at)}</span>` : ""}
    </span>` : ""}
  </a>`;
}

function board(list, rows, { refreshCounts }) {
  render(list, html`<div class="board">${LEAD_STATUSES.map(([s, label]) => {
    const items = rows.filter((l) => l.status === s);
    return html`<section class="col" data-col="${s}" style="--c:${STATUS_COLOR[s]}" aria-label="${label}">
      <header class="col__head">${statusChip(s)}<span class="col__count">${items.length}</span></header>
      ${items.slice(0, 60).map(card)}
      ${items.length > 60 ? html`<a class="small muted" href="#/leads?vista=tabla&estado=${s}">Ver los ${items.length} en la tabla</a>` : ""}
      ${items.length ? "" : html`<p class="col__empty">Arrastra aquí una pareja.</p>`}
    </section>`;
  })}</div>`);

  let dragged = null;
  list.addEventListener("dragstart", (e) => {
    const c = e.target.closest(".card");
    if (!c) return;
    dragged = c;
    c.classList.add("is-dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", c.dataset.id);
  });
  list.addEventListener("dragend", () => { dragged?.classList.remove("is-dragging"); $$(".col", list).forEach((c) => c.classList.remove("is-over")); });
  $$(".col", list).forEach((col) => {
    col.addEventListener("dragover", (e) => { if (dragged) { e.preventDefault(); col.classList.add("is-over"); } });
    col.addEventListener("dragleave", (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove("is-over"); });
    col.addEventListener("drop", async (e) => {
      e.preventDefault();
      col.classList.remove("is-over");
      const c = dragged;
      const to = col.dataset.col;
      if (!c || c.dataset.status === to) return;
      const patch = { status: to };
      if (to === "perdido") {
        const reason = await askLostReason();
        if (!reason) return;
        patch.lost_reason = reason;
      }
      const from = c.closest(".col");
      col.querySelector(".col__empty")?.remove();
      col.querySelector(".col__head").after(c);
      try {
        await db.update("leads", { id: `eq.${c.dataset.id}` }, patch);
        c.dataset.status = to;
        recount(list);
        refreshCounts();
        toast(`${c.querySelector(".card__names").textContent}: ${LEAD_STATUSES.find(([s]) => s === to)[1]}.`);
      } catch (err) {
        from.querySelector(".col__head").after(c);
        recount(list);
        fail(err);
      }
    });
  });
}

function recount(list) {
  $$(".col", list).forEach((col) => { col.querySelector(".col__count").textContent = col.querySelectorAll(".card").length; });
}

function table(list, rows, campaign) {
  render(list, rows.length ? html`<div class="table-wrap"><table class="table">
    <thead><tr><th>Pareja</th><th>Estado</th><th>Boda</th><th>Origen</th><th>Campaña</th><th>Entró</th><th>Próxima acción</th></tr></thead>
    <tbody>${rows.map((l) => html`<tr>
      <td><a href="#/leads/${l.id}">${l.names || l.email || l.phone}</a><div class="small muted">${l.email || l.phone || ""}</div></td>
      <td>${statusChip(l.status)}</td>
      <td class="nowrap">${l.wedding_date ? html`${fmtDate(l.wedding_date)}<div class="small muted">${untilDate(l.wedding_date)}</div>` : html`<span class="muted">—</span>`}</td>
      <td>${SOURCES[l.source] || l.source}</td>
      <td>${campaign(l) || html`<span class="muted">—</span>`}</td>
      <td class="nowrap">${timeAgo(l.created_at)}</td>
      <td>${l.next_action ? html`${l.next_action}<div class="small muted">${fmtDateTime(l.next_action_at)}</div>` : html`<span class="muted">—</span>`}</td>
    </tr>`)}</tbody></table></div>`
    : html`<p class="empty"><strong>Ningún lead con estos filtros.</strong>Prueba a quitar alguno.</p>`);
}

async function newLead(go) {
  const data = await formDialog({
    title: "Nuevo lead",
    submit: "Crear lead",
    body: html`<div class="form">
      <div class="grid-2">
        <div class="field"><label for="n-a">Nombre 1</label><input id="n-a" name="partner_a" required></div>
        <div class="field"><label for="n-b">Nombre 2</label><input id="n-b" name="partner_b"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label for="n-email">Email</label><input id="n-email" name="email" type="email"></div>
        <div class="field"><label for="n-phone">Teléfono</label><input id="n-phone" name="phone" type="tel"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label for="n-date">Fecha de la boda</label><input id="n-date" name="wedding_date" type="date"></div>
        <div class="field"><label for="n-src">Cómo llegó</label><select id="n-src" name="source">
          ${Object.entries(SOURCES).filter(([v]) => !["prueba", "reserva", "importado"].includes(v)).map(([v, l]) => html`<option value="${v}">${l}</option>`)}</select></div>
      </div>
      <div class="field"><label for="n-venue">Lugar</label><input id="n-venue" name="venue"></div>
      <div class="field"><label for="n-msg">Notas</label><textarea id="n-msg" name="message"></textarea></div>
    </div>`,
  });
  if (!data) return;
  const row = Object.fromEntries([...data].map(([k, v]) => [k, String(v).trim() || null]));
  if (!row.email && !row.phone) return toast("Pon al menos un email o un teléfono.", { error: true });
  try {
    const [l] = await db.insert("leads", row);
    go(`/leads/${l.id}`);
  } catch (e) { fail(e); }
}
