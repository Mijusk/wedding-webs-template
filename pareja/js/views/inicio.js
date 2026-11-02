// Inicio de la pareja: cuántos vienen, su web y los avisos por email.
import { db } from "/panel/js/supa.js";
import { html, raw, render, $, $$, toast, fail, waLink, icons, fmtDateTime } from "/panel/js/ui.js";
import { webUrl, copy } from "../comun.js";

export default async function inicio(ctx) {
  const { el, data, reload } = ctx;
  const s = data.stats;
  const w = data.wedding;
  const published = ["publicada", "archivada"].includes(w.status);
  const url = webUrl(w.slug);
  const withGroups = data.features?.rsvp_ampliado && s.grupos > 0;
  const responded = withGroups ? s.respondidos : s.si + s.no;
  const total = withGroups ? s.grupos : null;
  const pct = (n) => (total ? Math.max(0, Math.min(100, (n / total) * 100)) : 0);
  const contact = data.contacto || {};
  const digest = data.me?.digest;

  render(el, html`<div class="stack">
    <section class="headcount" aria-label="Recuento de invitados">
      <span class="headcount__big">${s.personas}</span>
      <span class="headcount__label"><b>${s.personas === 1 ? "persona viene" : "personas vienen"}</b>
        ${s.adultos} adultos y ${s.ninos} niños, según las respuestas.</span>
      ${withGroups ? html`
        <div class="headcount__bar" role="img" aria-label="${responded} de ${total} grupos han contestado">
          <span style="width:${pct(s.grupos_si)}%;background:var(--ok)"></span>
          <span style="width:${pct(s.grupos_no)}%;background:var(--st-perdido)"></span>
        </div>
        <div class="headcount__legend">
          <span><i class="dot" style="background:var(--ok)"></i>Grupos que vienen <b>${s.grupos_si}</b></span>
          <span><i class="dot" style="background:var(--st-perdido)"></i>Que no vienen <b>${s.grupos_no}</b></span>
          <span><i class="dot" style="background:var(--line-strong)"></i>Sin contestar <b>${s.pendientes}</b></span>
        </div>` : html`<div class="headcount__legend" style="margin-top:12px"><span>Han contestado <b>${responded}</b>: <b>${s.si}</b> sí y <b>${s.no}</b> no.</span></div>`}
    </section>
    <div class="figures">
      <div><b>${s.no}</b><span>no vienen</span></div>
      ${withGroups ? html`<div><b>${s.pendientes}</b><span>grupos sin contestar</span></div>` : ""}
      ${data.features?.rsvp_ampliado ? html`<div><b>${s.alergias}</b><span>con alergias o intolerancias</span></div>
        <div><b>${s.autobus}</b><span>en autobús</span></div>` : ""}
      <div><b>${s.ultimas_24h}</b><span>respuestas en 24 h</span></div>
    </div>
    <div class="btn-row"><a class="btn btn--primary" href="#/respuestas">Ver las respuestas</a>
      ${data.features?.rsvp_ampliado ? html`<a class="btn" href="#/invitados">${s.grupos ? "Lista de invitados" : "Añadir invitados"}</a>` : ""}</div>

    <section class="panel-block web-card">
      <h2>Vuestra web</h2>
      ${published ? html`
        <p class="muted">Este es el enlace general para mandar a todos. ${data.features?.rsvp_ampliado ? "Si usáis la lista de invitados, mejor mandad a cada grupo su enlace personal: les saluda por su nombre y sabe cuántos son." : ""}</p>
        <div class="link-box"><input readonly value="${url}" aria-label="Enlace de vuestra web"><button class="btn btn--small" type="button" data-copy>Copiar</button></div>
        <div class="btn-row">
          <a class="btn btn--small" href="${url}" target="_blank" rel="noopener">Abrir la web</a>
          <a class="btn btn--small" href="https://wa.me/?text=${encodeURIComponent(`¡Nos casamos! Aquí está toda la información y podéis confirmar asistencia: ${url}`)}" target="_blank" rel="noopener">${raw(icons.whatsapp)} Compartir por WhatsApp</a>
        </div>
        <p class="small muted">Última publicación: ${fmtDateTime(w.published_at)}. Se mantiene online hasta el ${new Date(`${w.retire_at}T12:00:00Z`).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}.</p>`
      : html`<p class="muted">Vuestra web aún no está publicada. Os avisaremos en cuanto esté lista.</p>`}
    </section>

    <section class="panel-block">
      <h2>Avisos por email</h2>
      ${data.me ? html`<p class="muted" style="margin-bottom:12px">Os mandamos un resumen con las respuestas nuevas a ${data.me.email}.</p>
        <div class="seg" role="group" aria-label="Frecuencia del resumen">
          ${[["diario", "Cada día"], ["semanal", "Cada lunes"], ["nunca", "Nunca"]].map(([v, l]) => html`<button type="button" data-digest="${v}" aria-pressed="${digest === v}">${l}</button>`)}
        </div>` : html`<p class="muted small">Cada miembro de la pareja elige sus avisos al entrar con su email.</p>`}
    </section>

    <section class="panel-block">
      <h2>¿Algo más?</h2>
      <p class="muted">Aquí podéis cambiar el horario, la dirección, el regalo y la confirmación (en <a href="#/datos">Datos</a>). Para cambiar el diseño, los textos o las fotos, escribidnos.</p>
      <div class="btn-row" style="margin-top:12px">
        ${contact.telefono ? html`<a class="btn btn--small" href="${waLink(contact.telefono, `Hola, somos ${(w.couple || []).join(" y ")} (web ${w.slug}). `)}" target="_blank" rel="noopener">${raw(icons.whatsapp)} WhatsApp</a>` : ""}
        ${contact.email ? html`<a class="btn btn--small" href="mailto:${contact.email}?subject=${encodeURIComponent(`Nuestra web (${w.slug})`)}">${raw(icons.mail)} ${contact.email}</a>` : ""}
      </div>
    </section>
  </div>`);

  $("[data-copy]", el)?.addEventListener("click", async () => toast((await copy(url)) ? "Enlace copiado." : "Selecciona el enlace y cópialo."));
  $$("[data-digest]", el).forEach((b) => b.addEventListener("click", async () => {
    try {
      await db.rpc("pareja_avisos", { p_digest: b.dataset.digest });
      $$("[data-digest]", el).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      toast(b.dataset.digest === "nunca" ? "No os mandaremos resúmenes." : `Os mandaremos un resumen ${b.dataset.digest === "diario" ? "cada día que haya respuestas nuevas" : "cada lunes si hay respuestas nuevas"}.`);
      data.me.digest = b.dataset.digest;
    } catch (e) { fail(e); }
  }));
  void reload;
}
