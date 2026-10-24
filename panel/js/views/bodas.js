// Bodas: todas las webs, con su estado y su fecha.
import { db } from "../supa.js";
import { html, render, $, WEDDING_STATUSES, statusChip, fmtDateLong, untilDate, downloadCsv } from "../ui.js";
import { catalog } from "../catalogo.js";

export default async function bodas({ el, query, go }) {
  const estado = query.get("estado") || "";
  const [rows, studio] = await Promise.all([
    db.select("weddings", { select: "id,slug,status,template,wedding_date,config->event->couple,config->venue->name,config->theme,published_at,updated_at,client:client_id(display_name)", order: "wedding_date.asc.nullslast", limit: 1000, status: estado ? `eq.${estado}` : undefined }),
    catalog(),
  ]);
  const styleName = (w) => studio.styles.find((s) => s.template === w.template && s.theme === w.theme)?.name || studio.templates[w.template]?.name || w.template;
  const upcoming = rows.filter((w) => !w.wedding_date || untilDate(w.wedding_date).startsWith("en") || untilDate(w.wedding_date) === "hoy");
  const past = rows.filter((w) => !upcoming.includes(w));

  const cardOf = (w) => html`<a class="wcard" href="#/bodas/${w.id}">
    <div class="wcard__top"><span class="wcard__names">${(w.couple || []).join(" y ") || w.slug}</span>${statusChip(w.status)}</div>
    <div class="wcard__meta">
      <span>${w.wedding_date ? html`${fmtDateLong(w.wedding_date)} (${untilDate(w.wedding_date)})` : "Sin fecha"}</span>
      <span>${w.name || ""}</span>
      <span>/b/${w.slug}, estilo ${styleName(w)}</span>
    </div></a>`;

  render(el, html`
    <div class="page-head">
      <div><h1>Bodas</h1><p>${rows.length} webs${estado ? ` en estado ${WEDDING_STATUSES.find(([s]) => s === estado)?.[1].toLowerCase()}` : ""}.</p></div>
      <div class="page-actions">
        <select data-estado aria-label="Estado" style="width:auto"><option value="">Todas</option>${WEDDING_STATUSES.map(([v, l]) => html`<option value="${v}" ${estado === v ? "selected" : ""}>${l}</option>`)}</select>
        <button class="btn" type="button" data-export>Exportar</button>
        <a class="btn btn--primary" href="#/bodas/nueva">Nueva boda</a>
      </div>
    </div>
    ${rows.length ? html`
      ${upcoming.length ? html`<div class="weddings">${upcoming.map(cardOf)}</div>` : ""}
      ${past.length ? html`<h2 class="group-title" style="margin-top:28px">Ya celebradas</h2><div class="weddings">${past.map(cardOf)}</div>` : ""}`
    : html`<p class="empty"><strong>${estado ? "Ninguna boda en este estado." : "Aún no hay ninguna boda."}</strong>${estado ? "" : "Crea la primera con «Nueva boda»: tarda unos minutos y no hay que tocar código."}</p>`}`);

  $("[data-estado]", el).addEventListener("change", (e) => go(`/bodas${e.target.value ? `?estado=${e.target.value}` : ""}`));
  $("[data-export]", el).addEventListener("click", () => downloadCsv("bodas.csv", rows, [
    [(w) => (w.couple || []).join(" y "), "Pareja"], ["slug", "Dirección"], ["status", "Estado"], ["wedding_date", "Fecha"],
    ["name", "Lugar"], [styleName, "Estilo"], [(w) => w.client?.display_name || "", "Cliente"], ["published_at", "Publicada"],
  ]));
}
