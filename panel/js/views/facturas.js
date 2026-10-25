// Facturas: lista por trimestre, PDF, borradores pendientes de emitir, resumen de IVA y el libro de
// facturas emitidas para la gestoría. Solo dueño y administradores (lo impone la base de datos).
import { db, download } from "../supa.js";
import { html, render, $, $$, fmtDate, fmtMoney, toast, fail, downloadCsv } from "../ui.js";

const KIND = { ordinaria: "Completa", simplificada: "Simplificada", rectificativa: "Rectificativa" };
const TYPE = (i) => (i.kind === "ordinaria" ? "F1" : i.kind === "simplificada" ? "F2" : i.corrects?.kind === "simplificada" ? "R5" : "R1");
const madridDate = (iso) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
const num = (cents) => (cents / 100).toFixed(2).replace(".", ",");

export default async function facturas(ctx) {
  const { el, staff, query, setTitle } = ctx;
  setTitle("Facturas");
  if (!["owner", "admin"].includes(staff.role)) {
    return render(el, html`<p class="empty"><strong>Solo el dueño y los administradores ven las facturas.</strong></p>`);
  }
  const now = new Date();
  const year = Number(query.get("anio")) || now.getFullYear();
  const q = query.has("t") ? Number(query.get("t")) : Math.floor(now.getMonth() / 3) + 1; // 0 = todo el año
  const from = q ? `${year}-${String((q - 1) * 3 + 1).padStart(2, "0")}-01` : `${year}-01-01`;
  const to = q ? (q === 4 ? `${year + 1}-01-01` : `${year}-${String(q * 3 + 1).padStart(2, "0")}-01`) : `${year + 1}-01-01`;

  // Se piden con un día de margen y se filtran por la fecha en hora de Madrid (el trimestre fiscal).
  const shift = (d, days) => new Date(Date.parse(`${d}T00:00:00Z`) + days * 864e5).toISOString().slice(0, 10);
  const [all, drafts, vendor] = await Promise.all([
    db.select("invoices", {
      select: "*,invoice_lines(vat_rate_bp,base_cents,vat_cents,line_total_cents),corrects:corrects_invoice_id(full_number,kind),orders(number)",
      status: "neq.borrador", and: `(issued_at.gte.${shift(from, -1)},issued_at.lt.${shift(to, 1)})`, order: "issued_at.asc",
    }),
    db.select("invoices", { select: "id,kind,total_cents,created_at,recipient,orders(number),clients(display_name)", status: "eq.borrador", order: "created_at.asc" }),
    db.one("settings", { select: "value", key: "eq.vendedor" }).then((r) => r?.value || {}),
  ]);
  const list = all.filter((i) => { const d = madridDate(i.issued_at); return d >= from && d < to; });
  const valid = list.filter((i) => i.status === "emitida");
  const sum = (k) => valid.reduce((a, i) => a + i[k], 0);
  const byRate = new Map();
  for (const i of valid) for (const l of i.invoice_lines) {
    const r = byRate.get(l.vat_rate_bp) || { base: 0, vat: 0 };
    r.base += l.base_cents; r.vat += l.vat_cents;
    byRate.set(l.vat_rate_bp, r);
  }
  const period = q ? `${q}.º trimestre de ${year}` : `${year}`;
  const missingSeller = !vendor.nombre || !vendor.nif || !vendor.direccion;
  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  render(el, html`
    <div class="page-head"><div><h1>Facturas</h1>
      <p>Emitidas en el ${period}. ${missingSeller ? "" : html`Emisor: ${vendor.nombre} (${vendor.nif}).`}</p></div>
      <div class="page-actions">
        <select data-year aria-label="Año" style="width:auto">${years.map((y) => html`<option value="${y}" ${y === year ? "selected" : ""}>${y}</option>`)}</select>
        <div class="seg" role="group" aria-label="Trimestre">${[1, 2, 3, 4, 0].map((t) => html`<a href="#/facturas?anio=${year}&amp;t=${t}" aria-current="${t === q}">${t ? `T${t}` : "Año"}</a>`)}</div>
      </div></div>

    ${missingSeller ? html`<p class="notice" style="margin-bottom:16px">Faltan tus datos fiscales (nombre, NIF y dirección): sin ellos no se puede emitir ninguna factura. Rellénalos en <a href="#/ajustes">Ajustes</a>.</p>` : ""}

    ${drafts.length ? html`<section class="panel-block" style="margin-bottom:16px">
      <h2>Pendientes de emitir <span class="tag">${drafts.length}</span></h2>
      <div class="rows">${drafts.map((d) => html`<div class="row">
        <span class="row__title">${d.clients?.display_name || d.recipient?.nombre || "Sin cliente"} · ${KIND[d.kind]}</span>
        <span class="row__side">${fmtMoney(d.total_cents)} <button class="btn btn--small btn--primary" type="button" data-issue="${d.id}">Emitir</button></span>
        <span class="row__sub">${d.orders?.number ? `Pedido ${d.orders.number} · ` : ""}creada el ${fmtDate(d.created_at)}</span></div>`)}</div>
    </section>` : ""}

    <div class="cols">
      <section class="panel-block">
        <h2>${valid.length} factura${valid.length === 1 ? "" : "s"} <span class="small muted" style="font-weight:400">${list.length - valid.length ? `(y ${list.length - valid.length} anulada${list.length - valid.length === 1 ? "" : "s"})` : ""}</span></h2>
        ${list.length ? html`<div class="table-wrap"><table class="table">
          <thead><tr><th>Número</th><th>Fecha</th><th>Cliente</th><th class="num">Base</th><th class="num">IVA</th><th class="num">Total</th><th></th></tr></thead>
          <tbody>${list.map((i) => html`<tr class="${i.status === "anulada" ? "is-muted" : ""}">
            <td><b>${i.full_number}</b><br><span class="small muted">${KIND[i.kind]}${i.corrects ? ` de ${i.corrects.full_number}` : ""}${i.status === "anulada" ? " · anulada" : ""}</span></td>
            <td>${fmtDate(i.issued_at)}</td>
            <td>${i.recipient?.nombre || html`<span class="muted">—</span>`}${i.orders?.number ? html`<br><span class="small muted">${i.orders.number}</span>` : ""}</td>
            <td class="num">${fmtMoney(i.base_cents)}</td><td class="num">${fmtMoney(i.vat_cents)}</td><td class="num"><b>${fmtMoney(i.total_cents)}</b></td>
            <td><button class="btn btn--small" type="button" data-pdf="${i.id}" data-name="${i.full_number}">PDF</button></td></tr>`)}</tbody>
        </table></div>` : html`<p class="empty"><strong>No hay facturas en este periodo.</strong>Se hacen solas cuando una pareja paga.</p>`}
      </section>

      <aside class="stack">
        <section class="panel-block">
          <h2>Resumen del ${q ? "trimestre" : "año"}</h2>
          <dl class="facts">
            <dt>Facturado</dt><dd><b>${fmtMoney(sum("total_cents"))}</b></dd>
            ${[...byRate].map(([bp, r]) => html`<dt>Base al ${bp / 100} %</dt><dd>${fmtMoney(r.base)}</dd><dt>IVA al ${bp / 100} %</dt><dd>${fmtMoney(r.vat)}</dd>`)}
          </dl>
          <p class="small muted" style="margin-top:12px">Es el IVA devengado (repercutido) de tus facturas, ya restadas las rectificativas: lo que va al modelo 303 de este trimestre. Las anuladas no cuentan.</p>
        </section>
        <section class="panel-block">
          <h2>Para la gestoría</h2>
          <div class="btn-row">
            <button class="btn btn--small" type="button" data-book ${list.length ? "" : "disabled"}>Libro de facturas emitidas (Excel)</button>
          </div>
          <p class="small muted" style="margin-top:10px">Una fila por factura y tipo de IVA, con fecha, número, tipo (F1, F2, R1, R5), NIF y nombre del cliente, base, cuota y total. Los PDF se descargan uno a uno.</p>
        </section>
        <section class="panel-block">
          <h2>Hacienda (Verifactu)</h2>
          <p class="small">Ahora mismo las facturas <b>no se envían a Hacienda</b>: todavía no es obligatorio. Cuando elijas proveedor, se enviarán solas y llevarán su código QR.</p>
        </section>
      </aside>
    </div>`);

  $("[data-year]", el).addEventListener("change", (e) => { location.hash = `#/facturas?anio=${e.target.value}&t=${q}`; });
  $$("[data-pdf]", el).forEach((b) => b.addEventListener("click", async () => {
    try { await download(`/api/factura?id=${b.dataset.pdf}&descargar=1`, `Factura ${b.dataset.name}.pdf`); } catch (e) { fail(e); }
  }));
  $$("[data-issue]", el).forEach((b) => b.addEventListener("click", async () => {
    b.disabled = true;
    try { const inv = await db.rpc("issue_invoice", { p_invoice_id: b.dataset.issue }); toast(`Factura ${inv.full_number} emitida.`); facturas(ctx); }
    catch (e) { b.disabled = false; fail(e); }
  }));
  $("[data-book]", el)?.addEventListener("click", () => {
    const rows = list.flatMap((i) => {
      const rates = new Map();
      for (const l of i.invoice_lines) {
        const r = rates.get(l.vat_rate_bp) || { base: 0, vat: 0, total: 0 };
        r.base += l.base_cents; r.vat += l.vat_cents; r.total += l.line_total_cents;
        rates.set(l.vat_rate_bp, r);
      }
      return [...rates].map(([bp, r]) => ({ i, bp, ...r }));
    });
    downloadCsv(`facturas-emitidas-${year}${q ? `-T${q}` : ""}.csv`, rows, [
      [(r) => madridDate(r.i.issued_at), "Fecha de expedición"],
      [(r) => r.i.operation_date || "", "Fecha de operación"],
      [(r) => r.i.series_code, "Serie"],
      [(r) => r.i.full_number, "Número"],
      [(r) => TYPE(r.i), "Tipo"],
      [(r) => r.i.recipient?.nif || "", "NIF del cliente"],
      [(r) => r.i.recipient?.nombre || "", "Nombre del cliente"],
      [(r) => num(r.base), "Base imponible"],
      [(r) => String(r.bp / 100).replace(".", ","), "Tipo de IVA (%)"],
      [(r) => num(r.vat), "Cuota de IVA"],
      [(r) => num(r.total), "Total"],
      [(r) => r.i.corrects?.full_number || "", "Factura rectificada"],
      [(r) => r.i.correction_reason || "", "Motivo de la rectificación"],
      [(r) => (r.i.status === "anulada" ? "Anulada" : "Emitida"), "Estado"],
      [(r) => (r.i.provider === "manual" ? "No enviada" : r.i.provider_status || r.i.provider), "Verifactu"],
    ]);
  });
}
