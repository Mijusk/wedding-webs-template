// Importador único de la hoja de Google "Contactos" (la de integrations/leads.gs) a los leads.
import { db } from "../supa.js";
import { html, render, $, toast, fail } from "../ui.js";
import { parseCsv, rowsToObjects } from "../csv.js";

export default async function importar({ el, go }) {
  render(el, html`
    <div class="page-head"><div><h1>Importar de la hoja de Google</h1>
      <p>Pasa al panel los contactos que ya tienes en la pestaña «Contactos». Solo hay que hacerlo una vez.</p></div></div>
    <section class="panel-block stack" style="max-width:760px">
      <ol class="stack" style="margin:0;padding-left:20px;gap:6px">
        <li>Abre tu hoja de Google y ve a la pestaña <b>Contactos</b>.</li>
        <li>Menú <b>Archivo › Descargar › Valores separados por comas (.csv)</b>.</li>
        <li>Elige aquí ese archivo. Antes de importar verás cuántos hay.</li>
      </ol>
      <label class="drop"><input type="file" accept=".csv,text/csv" hidden data-file>
        <strong>Elegir el archivo .csv</strong><span class="small">Las parejas que ya estén en el panel (mismo email) no se duplican.</span></label>
      <div data-preview></div>
    </section>`);

  let rows = [];
  $("[data-file]", el).addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      rows = rowsToObjects(parseCsv(await file.text())).filter((r) => r.email);
    } catch (ex) { return fail(new Error(`No se ha podido leer el archivo: ${ex.message}`)); }
    if (!rows.length) {
      return render($("[data-preview]", el), html`<p class="problems">No encuentro ninguna fila con la columna «Email». ¿Es la pestaña «Contactos»?</p>`);
    }
    const types = rows.reduce((a, r) => ({ ...a, [r.tipo || "otro"]: (a[r.tipo || "otro"] || 0) + 1 }), {});
    render($("[data-preview]", el), html`
      <p><b>${rows.length} contactos</b> en el archivo: ${Object.entries(types).map(([k, n]) => `${n} ${k === "prueba" ? "pruebas" : k === "reserva" ? "reservas" : k}`).join(", ")}.</p>
      <div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Nombres</th><th>Email</th><th>Boda</th><th>Estado</th></tr></thead>
        <tbody>${rows.slice(0, 6).map((r) => html`<tr><td>${r.fecha}</td><td>${r.nombres}</td><td>${r.email}</td><td>${r.fecha_boda}</td><td>${r.estado}</td></tr>`)}</tbody></table></div>
      ${rows.length > 6 ? html`<p class="small muted">…y ${rows.length - 6} más.</p>` : ""}
      <div class="btn-row"><button class="btn btn--primary" type="button" data-go>Importar ${rows.length} contactos</button></div>
      <div data-result></div>`);
    $("[data-go]", el).addEventListener("click", async (ev) => {
      ev.target.disabled = true;
      ev.target.textContent = "Importando…";
      const total = { importados: 0, repetidos: 0, errores: [] };
      try {
        for (let i = 0; i < rows.length; i += 200) {
          const r = await db.rpc("import_leads", { p_rows: rows.slice(i, i + 200) });
          total.importados += r.importados;
          total.repetidos += r.repetidos;
          total.errores.push(...r.errores.map((x) => ({ ...x, fila: x.fila + i })));
        }
        render($("[data-result]", el), html`<div class="notice notice--ok" style="margin-top:12px">
          <strong>Hecho.</strong> ${total.importados} importados, ${total.repetidos} ya estaban en el panel${total.errores.length ? `, ${total.errores.length} con errores (filas ${total.errores.map((x) => x.fila + 1).join(", ")}: email no válido)` : ""}.
          <p style="margin-top:8px"><a href="#/leads">Ver los leads</a></p></div>`);
        ev.target.textContent = "Importado";
        toast(`${total.importados} contactos importados.`);
      } catch (ex) {
        ev.target.disabled = false;
        ev.target.textContent = "Reintentar";
        fail(ex);
      }
    });
  });
  void go;
}
