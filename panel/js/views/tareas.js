// Tareas: recordatorios de Luis, agrupados por cuándo tocan.
import { db } from "../supa.js";
import { html, render, $, $$, fmtDateTime, todayMadrid, toast, fail, downloadCsv } from "../ui.js";
import { toLocalInput } from "./lead.js";

export default async function tareas(ctx) {
  const { el, query, go } = ctx;
  const showDone = query.get("hechas") === "1";
  const tasks = await db.select("tasks", {
    select: "*,lead:lead_id(id,names),client:client_id(id,display_name),wedding:wedding_id(id,slug)",
    status: showDone ? "in.(hecha,cancelada)" : "eq.pendiente",
    order: showDone ? "done_at.desc.nullslast" : "due_at.asc.nullslast",
    limit: 500,
  });
  const today = todayMadrid();
  const day = (t) => (t.due_at ? new Date(t.due_at).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }) : null);
  const groups = showDone ? [["Hechas", tasks]] : [
    ["Vencidas", tasks.filter((t) => day(t) && day(t) < today), true],
    ["Hoy", tasks.filter((t) => day(t) === today)],
    ["Próximas", tasks.filter((t) => day(t) && day(t) > today)],
    ["Sin fecha", tasks.filter((t) => !day(t))],
  ];

  render(el, html`
    <div class="page-head">
      <div><h1>Tareas</h1><p>${showDone ? "Lo que ya está hecho." : `${tasks.length} pendientes.`}</p></div>
      <div class="page-actions">
        <div class="seg"><a href="#/tareas" aria-current="${!showDone}">Pendientes</a><a href="#/tareas?hechas=1" aria-current="${showDone}">Hechas</a></div>
        <button class="btn" type="button" data-export>Exportar</button>
      </div>
    </div>
    ${showDone ? "" : html`<form class="task-add" data-add>
      <input name="title" placeholder="Nueva tarea: pedir fotos a Marta y Pablo…" aria-label="Nueva tarea" required>
      <input name="due_at" type="datetime-local" aria-label="Para cuándo" value="${toLocalInput(new Date(Date.now() + 3600e3).toISOString())}">
      <button class="btn btn--primary" type="submit">Añadir</button>
    </form>`}
    <section class="panel-block">
      ${tasks.length ? groups.filter(([, list]) => list.length).map(([title, list, late]) => html`
        <h2 class="group-title ${late ? "is-late" : ""}">${title} (${list.length})</h2>
        ${list.map((t) => html`<div class="task ${t.status !== "pendiente" ? "is-done" : ""}">
          <input type="checkbox" data-toggle="${t.id}" ${t.status === "hecha" ? "checked" : ""} aria-label="Hecha: ${t.title}">
          <div>
            <div class="task__title">${t.title}</div>
            <div class="task__sub">
              ${t.due_at ? html`<span class="task__due ${late ? "is-late" : ""}">${fmtDateTime(t.due_at)}</span>` : "Sin fecha"}
              ${t.lead ? html` · <a href="#/leads/${t.lead.id}">${t.lead.names}</a>` : ""}
              ${t.client ? html` · <a href="#/clientes/${t.client.id}">${t.client.display_name}</a>` : ""}
              ${t.wedding ? html` · <a href="#/bodas/${t.wedding.id}">/b/${t.wedding.slug}</a>` : ""}
            </div>
          </div>
          <button class="btn btn--quiet btn--small" type="button" data-cancel="${t.id}" title="Ya no hace falta">${t.status === "pendiente" ? "Descartar" : ""}</button>
        </div>`)}`)
      : html`<p class="empty"><strong>${showDone ? "Aún no has terminado ninguna tarea." : "No tienes tareas pendientes."}</strong>${showDone ? "" : "Apunta aquí lo que no quieras olvidar; también puedes crearlas desde la ficha de cada lead."}</p>`}
    </section>`);

  $("[data-add]", el)?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    if (!d.title.trim()) return;
    try { await db.insert("tasks", { title: d.title.trim(), due_at: d.due_at ? new Date(d.due_at).toISOString() : null }); tareas(ctx); }
    catch (ex) { fail(ex); }
  });
  $$("[data-toggle]", el).forEach((box) => box.addEventListener("change", async () => {
    try {
      await db.update("tasks", { id: `eq.${box.dataset.toggle}` }, { status: box.checked ? "hecha" : "pendiente" });
      box.closest(".task").classList.toggle("is-done", box.checked);
      if (box.checked) toast("Tarea hecha.");
    } catch (e) { box.checked = !box.checked; fail(e); }
  }));
  $$("[data-cancel]", el).forEach((b) => b.addEventListener("click", async () => {
    if (!b.textContent.trim()) return;
    try { await db.update("tasks", { id: `eq.${b.dataset.cancel}` }, { status: "cancelada" }); tareas(ctx); } catch (e) { fail(e); }
  }));
  $("[data-export]", el).addEventListener("click", () => downloadCsv("tareas.csv", tasks, [
    ["title", "Tarea"], ["status", "Estado"], ["due_at", "Para"], ["done_at", "Hecha"], [(t) => t.lead?.names || t.client?.display_name || t.wedding?.slug || "", "Sobre"],
  ]));
  void go;
}
