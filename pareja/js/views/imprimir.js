// Hoja para imprimir: una tarjeta por grupo con su código QR personal (2 columnas en A4).
// Sirve para meterla en el sobre de la invitación de papel.
import { html, raw, render, $ } from "/panel/js/ui.js";
import { qrSvg } from "/lib/qr.js";
import { loadGuests, inviteUrl, noModule } from "../comun.js";

export default async function imprimir({ el, data, weddingId, query, go }) {
  if (!data.features?.rsvp_ampliado) return render(el, noModule(data));
  const solo = query.get("solo") === "pendientes";
  const { groups } = await loadGuests(weddingId);
  const list = groups.filter((g) => !g.token_revoked_at && (!solo || !g.answer));
  const couple = (data.wedding.couple || []).join(" & ");

  render(el, html`
    <div class="page-head no-print">
      <div><h1>Códigos QR</h1><p>Una tarjeta por grupo: al escanearla, abren la web con su enlace personal.</p></div>
      <div class="page-actions">
        <label class="check"><input type="checkbox" data-solo ${solo ? "checked" : ""}> Solo los que no han contestado</label>
        <a class="btn" href="#/invitados">Volver</a>
        <button class="btn btn--primary" type="button" data-print ${list.length ? "" : "disabled"}>Imprimir ${list.length} tarjetas</button>
      </div>
    </div>
    ${list.length ? html`<div class="print-sheet">${list.map((g) => html`<article class="qr-card">
      <span class="qr-card__couple">${couple}</span>
      <span class="qr-card__group">${g.name}</span>
      ${raw(qrSvg(inviteUrl(data.wedding.slug, g.token), { margin: 2, color: "#1f1a24" }))}
      <span class="qr-card__hint">Escanead para ver la web y confirmar asistencia</span>
    </article>`)}</div>` : html`<p class="empty"><strong>No hay grupos que imprimir.</strong><a href="#/invitados">Añadid invitados</a></p>`}`);

  $("[data-print]", el)?.addEventListener("click", () => print());
  $("[data-solo]", el).addEventListener("change", (e) => go(`/imprimir${e.target.checked ? "?solo=pendientes" : ""}`));
}
