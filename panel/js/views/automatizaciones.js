// Automatizaciones: activar, desactivar y editar los emails que salen solos, y ver a quién se han mandado.
// El texto admite huecos ({nombres}, {enlace}…) que se rellenan con los datos de cada pareja.
import { db, api, connected, siteUrl } from "../supa.js";
import { html, render, $, $$, fmtDateTime, toast, fail, confirmDialog, showDialog } from "../ui.js";
import { GROUPS, INFO, VAR_LABELS, sampleVars } from "/lib/automatizaciones.js";
import { renderTemplate, placeholders } from "/lib/email.js";

const count = (n, kind) => {
  const [one, many] = kind === "sistema" ? ["vez", "veces"] : kind === "tarea" ? ["tarea", "tareas"] : ["envío", "envíos"];
  return `${n >= 400 ? "Más de 400" : n} ${n === 1 ? one : many}`;
};
const STATUS = { enviado: "enviado", simulado: "simulado", fallido: "falló", hecho: "hecho", omitido: "sin enviar" };

export default async function automatizaciones(ctx) {
  const { el, staff, setTitle } = ctx;
  setTitle("Automatizaciones");
  const admin = ["owner", "admin"].includes(staff.role);
  const [autos, runs] = await Promise.all([
    db.select("automations", { select: "*", order: "sort" }),
    db.select("automation_runs", { select: "automation_id,email,status,detail,created_at", order: "created_at.desc", limit: 400 }),
  ]);
  const runsOf = (id) => runs.filter((r) => r.automation_id === id);
  const emailsOn = connected().emails;
  const reload = () => automatizaciones(ctx);

  const card = (a) => {
    const info = INFO[a.code] || {};
    const last = runsOf(a.id);
    const editable = a.kind === "email" || a.kind === "bloque";
    return html`<section class="panel-block auto" data-auto="${a.id}">
      <div class="auto__head">
        <div><h3>${a.name}</h3><p class="small muted">${a.description}</p></div>
        <label class="check auto__toggle"><input type="checkbox" data-toggle ${a.enabled ? "checked" : ""} ${admin ? "" : "disabled"}>
          <span>${a.enabled ? "Activa" : "Apagada"}</span></label>
      </div>
      ${info.delay || editable ? html`<details class="auto__edit"><summary>${editable ? "Editar el texto" : "Cambiar los días"}${info.delay ? ` · ${a.delay_days} días` : ""}</summary>
        <form class="form stack" data-form style="gap:12px;margin-top:12px">
          ${info.delay ? html`<div class="field" style="max-width:280px"><label>${info.delay}</label><input name="delay_days" type="number" min="0" max="400" value="${a.delay_days ?? ""}" ${admin ? "" : "disabled"}></div>` : ""}
          ${a.kind === "email" ? html`<div class="field"><label>Asunto</label><input name="subject" value="${a.subject || ""}" ${admin ? "" : "disabled"}></div>` : ""}
          ${editable ? html`<div class="field"><label>Texto</label><textarea name="body" rows="9" ${admin ? "" : "disabled"}>${a.body || ""}</textarea>
            <span class="hint">Deja una línea en blanco entre párrafos. Pulsa un hueco para ponerlo donde está el cursor.</span></div>
            <div class="chips">${(info.vars || []).map((v) => html`<button class="tag" type="button" data-insert="{${v}}" title="${VAR_LABELS[v] || v}">{${v}}</button>`)}</div>` : ""}
          ${a.kind === "email" && a.button_label != null ? html`<div class="field" style="max-width:320px"><label>Texto del botón</label><input name="button_label" value="${a.button_label}" ${admin ? "" : "disabled"}></div>` : ""}
          <div class="btn-row">${admin ? html`<button class="btn btn--primary btn--small" type="submit">Guardar</button>` : ""}
            ${editable ? html`<button class="btn btn--small" type="button" data-preview>Vista previa</button>` : ""}</div>
        </form>
      </details>` : ""}
      ${last.length ? html`<p class="small muted auto__runs">${count(last.length, a.kind)}. ${last.length > 1 ? "Últimos" : "Fue"}:
        ${last.slice(0, 4).map((r) => html`<span class="auto__run" title="${r.detail || ""}">${fmtDateTime(r.created_at)}${r.email ? ` · ${r.email}` : ""} · ${STATUS[r.status] || r.status}</span>`)}</p>`
        : a.kind === "bloque" ? "" : html`<p class="small muted auto__runs">Aún no se ha usado.</p>`}
    </section>`;
  };

  render(el, html`
    <div class="page-head"><div><h1>Automatizaciones</h1>
      <p>Emails y tareas que salen solos. Todas empiezan apagadas; al activar una, solo cuenta lo que pase desde ese momento (con un día de margen), nunca el histórico.</p></div>
      ${admin ? html`<div class="page-actions"><button class="btn" type="button" data-run>Revisar ahora</button></div>` : ""}</div>
    ${emailsOn ? "" : html`<p class="notice" style="margin-bottom:16px">Los emails aún no salen de verdad: falta conectar Resend (ver docs/EMAILS.md). Mientras, cada envío se apunta como «simulado» y no se repetirá después.</p>`}
    <p class="small muted" style="margin:-6px 0 18px">Se revisan solas cada mañana (solo en la web publicada; en las vistas previas, con «Revisar ahora»).</p>
    ${GROUPS.map(([aud, title, note]) => {
      const list = autos.filter((a) => a.audience === aud);
      return list.length ? html`<h2 class="auto__group">${title}</h2>${note ? html`<p class="small muted" style="margin:-4px 0 10px">${note}</p>` : ""}
        <div class="stack" style="margin-bottom:24px">${list.map(card)}</div>` : "";
    })}`);

  for (const box of $$("[data-auto]", el)) {
    const a = autos.find((x) => x.id === box.dataset.auto);
    const form = $("[data-form]", box);
    const body = form?.querySelector("textarea[name=body]");
    $("[data-toggle]", box).addEventListener("change", async (e) => {
      const on = e.target.checked;
      if (on && a.kind === "sistema" && !(await confirmDialog(`¿Activar «${a.name}»?`,
        "Cada mañana lo hará con todo lo que haya pasado el plazo, también lo antiguo. Borra datos de verdad: no se puede deshacer.", "Activar", true))) {
        e.target.checked = false;
        return;
      }
      try {
        await db.update("automations", { id: `eq.${a.id}` }, { enabled: on });
        toast(on ? (a.kind === "email" && !emailsOn ? "Activada. Hasta conectar los emails, se apuntará como «simulado»." : "Activada.") : "Apagada.");
        reload();
      } catch (ex) { e.target.checked = !on; fail(ex); }
    });
    $$("[data-insert]", box).forEach((b) => b.addEventListener("click", () => {
      if (!body || body.disabled) return;
      const { selectionStart: i, selectionEnd: j, value } = body;
      body.value = value.slice(0, i) + b.dataset.insert + value.slice(j);
      body.focus();
      body.selectionStart = body.selectionEnd = i + b.dataset.insert.length;
    }));
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(form));
      const allowed = INFO[a.code]?.vars || [];
      const wrong = [...placeholders(d.subject), ...placeholders(d.body), ...placeholders(d.button_label)].filter((v) => !allowed.includes(v));
      if (wrong.length) return fail(new Error(`Este texto no puede usar ${wrong.map((v) => `{${v}}`).join(", ")}. Puede usar: ${allowed.map((v) => `{${v}}`).join(", ")}.`));
      const patch = {};
      if ("delay_days" in d) {
        const n = Number(d.delay_days);
        if (!Number.isInteger(n) || n < 0 || n > 400) return fail(new Error("Los días tienen que ser un número entre 0 y 400."));
        patch.delay_days = n;
      }
      if ("subject" in d) { if (!d.subject.trim()) return fail(new Error("Falta el asunto.")); patch.subject = d.subject.trim(); }
      if ("body" in d) { if (!d.body.trim()) return fail(new Error("Falta el texto.")); patch.body = d.body.replace(/\r\n/g, "\n").trim(); }
      if ("button_label" in d) patch.button_label = d.button_label.trim() || null;
      try { await db.update("automations", { id: `eq.${a.id}` }, patch); toast("Guardado."); reload(); } catch (ex) { fail(ex); }
    });
    $("[data-preview]", box)?.addEventListener("click", () => {
      const d = Object.fromEntries(new FormData(form));
      const vars = sampleVars(siteUrl());
      const mail = renderTemplate({ subject: d.subject ?? "", body: d.body, button_label: a.kind === "email" ? d.button_label ?? a.button_label : null },
        vars, { link: vars.enlace, unsubscribe: a.commercial ? `${siteUrl()}/api/lead?baja=…` : null });
      const dlg = showDialog(html`<div class="dlg dlg--wide"><h2>Vista previa</h2>
        ${a.kind === "email" ? html`<p class="small"><b>Asunto:</b> ${mail.subject}</p>` : html`<p class="small muted">Se añade al email de confirmación del pago.</p>`}
        <iframe class="auto__frame" title="Vista previa del email" sandbox></iframe>
        <p class="small muted">Con datos de ejemplo.</p>
        <div class="dlg__actions"><button class="btn" type="button" data-close>Cerrar</button></div></div>`);
      $("iframe", dlg).srcdoc = mail.html;
    });
  }

  $("[data-run]", el)?.addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    try {
      const { automatizaciones: r } = await api("/api/cron?tarea=automatizaciones", {});
      const m = r.emails;
      toast(`Hecho: ${m.enviados} enviados${m.simulados ? `, ${m.simulados} simulados` : ""}${m.fallidos ? `, ${m.fallidos} fallidos` : ""}`
        + `${r.tareas ? `, ${r.tareas} tareas` : ""}${r.webs_retiradas ? `, ${r.webs_retiradas} webs retiradas` : ""}`
        + `${r.invitados_borrados ? `, invitados borrados en ${r.invitados_borrados} bodas` : ""}${r.leads_anonimizados ? `, ${r.leads_anonimizados} contactos anonimizados` : ""}.`, { timeout: 8000 });
      reload();
    } catch (ex) {
      e.currentTarget.disabled = false;
      fail(new Error(ex.status === 429 ? "Espera un minuto antes de volver a revisar." : ex.message));
    }
  });
}
