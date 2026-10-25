// Ficha de cliente: datos de facturación, pedidos y pagos, su web y su historial.
import { db, api, download, siteUrl } from "../supa.js";
import { html, raw, render, $, $$, ORDER_STATUSES, statusChip, fmtDate, fmtDateTime, fmtMoney, formDialog, confirmDialog, showDialog, toast, fail, icons, waLink } from "../ui.js";
import { validNif } from "/lib/nif.js";

export { validNif };
const pretty = (c) => (c ? `${c.slice(0, 4)}-${c.slice(4)}` : "");
const PAY_LABEL = { stripe: "Tarjeta o Bizum (Stripe)", bizum: "Bizum", transferencia: "Transferencia", efectivo: "Efectivo", otro: "Otro" };

export default async function cliente(ctx) {
  const { el, params, staff, setTitle, go } = ctx;
  const id = params.id;
  const [c, orders, invoices, products, activities] = await Promise.all([
    db.one("clients", { select: "*,weddings(id,slug,status,wedding_date,template),leads(id,names,status)", id: `eq.${id}` }),
    db.select("orders", { select: "*,order_lines(*),payments(*)", client_id: `eq.${id}`, order: "created_at.desc" }),
    db.select("invoices", { select: "id,full_number,kind,status,total_cents,issued_at,order_id,provider,corrects_invoice_id", client_id: `eq.${id}`, order: "created_at.asc" }).catch(() => []),
    db.select("products", { select: "*", active: "is.true", order: "sort" }),
    db.select("activities", { select: "*", client_id: `eq.${id}`, order: "created_at.desc", limit: 100 }),
  ]);
  if (!c) return render(el, html`<p class="empty"><strong>Este cliente no existe.</strong><a href="#/clientes">Volver</a></p>`);
  setTitle(c.display_name);
  const reload = () => cliente(ctx);
  const isAdmin = ["owner", "admin"].includes(staff.role);
  // El pedido al que se enlaza la web nueva («Crear su web»): el más reciente sin web.
  const openOrder = orders.find((o) => !o.wedding_id && !["cancelado", "reembolsado"].includes(o.status));
  const paidOf = (o) => o.payments.filter((p) => ["pagado", "reembolso_parcial"].includes(p.status)).reduce((a, p) => a + p.amount_cents - p.refunded_cents, 0);

  const orderCard = (o) => {
    const invs = invoices.filter((i) => i.order_id === o.id);
    const main = invs.find((i) => i.kind !== "rectificativa" && i.status === "emitida");
    const paid = paidOf(o);
    return html`<div class="panel-block order" style="margin-top:10px;background:var(--surface-2)" data-order-card="${o.id}">
      <div class="block-title"><span>Pedido ${o.number} ${statusChip(o.status)}</span><b>${fmtMoney(o.total_cents)}</b></div>
      <div class="rows">${o.order_lines.map((li) => html`<div class="row"><span class="row__title" style="font-weight:500">${li.description}${li.quantity > 1 ? ` × ${li.quantity}` : ""}</span><span class="row__side">${fmtMoney(li.total_cents)}</span></div>`)}</div>
      <p class="small muted" style="margin:8px 0">
        Pagado ${fmtMoney(paid)} de ${fmtMoney(o.total_cents)}
        ${o.promised_delivery_at ? ` · entrega prometida el ${fmtDate(o.promised_delivery_at)}` : ""}
        ${o.delivered_at ? ` · entregado el ${fmtDate(o.delivered_at)}` : ""}
        ${o.source === "escaparate" ? " · pagado desde la web" : ""}
      </p>
      ${o.payments.length ? html`<div class="rows small">${o.payments.map((p) => html`<div class="row"><span>${PAY_LABEL[p.provider] || p.provider} · ${fmtDateTime(p.paid_at || p.created_at)}${p.refunded_cents ? html` · <b>devuelto ${fmtMoney(p.refunded_cents)}</b>` : ""}</span>
        <span class="row__side">${statusChip(p.status)} ${fmtMoney(p.amount_cents)}
          ${isAdmin && p.provider !== "stripe" && p.amount_cents > p.refunded_cents ? html`<button class="btn btn--small btn--quiet" type="button" data-refund="${p.id}">Devolver</button>` : ""}</span></div>`)}</div>` : ""}
      ${isAdmin && invs.length ? html`<div class="rows small" style="margin-top:8px">${invs.map((i) => html`<div class="row">
        <span>Factura <b>${i.full_number || "borrador"}</b> · ${i.kind}${i.status === "anulada" ? " · anulada" : ""}${i.issued_at ? ` · ${fmtDate(i.issued_at)}` : ""}</span>
        <span class="row__side">${fmtMoney(i.total_cents)}
          ${i.status !== "borrador" ? html`<button class="btn btn--small" type="button" data-pdf="${i.id}" data-name="${i.full_number}">PDF</button>` : ""}
          ${i.status === "emitida" && i.kind !== "rectificativa" ? html`<button class="btn btn--small btn--quiet" type="button" data-rectify="${i.id}" data-number="${i.full_number}" data-total="${i.total_cents}">Rectificar</button>` : ""}</span></div>`)}</div>` : ""}
      <div class="btn-row" style="margin-top:12px">
        <select data-order-status="${o.id}" aria-label="Estado del pedido" style="width:auto">${ORDER_STATUSES.map(([v, l]) => html`<option value="${v}" ${o.status === v ? "selected" : ""}>${l}</option>`)}</select>
        <button class="btn btn--small" type="button" data-track="${o.id}">Enlace para la pareja</button>
        ${paid < o.total_cents ? html`<button class="btn btn--small" type="button" data-pay="${o.id}">Apuntar un pago</button>` : ""}
        ${isAdmin && paid > 0 && !main ? html`<button class="btn btn--small" type="button" data-invoice="${o.id}">Hacer la factura</button>` : ""}
        ${o.wedding_id ? html`<a class="btn btn--small btn--quiet" href="#/bodas/${o.wedding_id}">Su web</a>`
          : c.weddings?.length ? html`<button class="btn btn--small" type="button" data-link-wedding="${o.id}">Enlazar con su web</button>` : ""}
        ${!["entregado", "cancelado", "reembolsado"].includes(o.status) ? html`<button class="btn btn--small btn--quiet" type="button" data-deliver="${o.id}">Marcar entregado</button>` : ""}
      </div>
    </div>`;
  };

  render(el, html`
    <a class="back" href="#/clientes">← Clientes</a>
    <div class="page-head who">
      <div>
        <h1>${c.display_name}</h1>
        <div class="who__contact">
          ${c.email ? html`<a href="mailto:${c.email}">${c.email}</a>` : ""}${c.phone ? html`<a href="tel:${c.phone}">${c.phone}</a>` : ""}
          ${c.leads?.map((l) => html`<a href="#/leads/${l.id}">Ver su lead</a>`)}
        </div>
      </div>
      <div class="page-actions">
        ${c.weddings?.length ? "" : html`<a class="btn" href="#/bodas/nueva?cliente=${c.id}${openOrder ? `&pedido=${openOrder.id}` : ""}">Crear su web</a>`}
        <button class="btn btn--primary" type="button" data-new-order>Nuevo pedido</button>
      </div>
    </div>

    <div class="cols">
      <div class="stack">
        <section class="panel-block">
          <h2>Pedidos</h2>
          ${orders.length ? orders.map((o) => orderCard(o)) : ""}
          ${orders.length ? "" : html`<p class="empty"><strong>Sin pedidos.</strong>Crea uno con «Nuevo pedido» cuando confirmen la tarifa.</p>`}
        </section>

        <section class="panel-block">
          <h2>Historial</h2>
          <div class="timeline">${activities.length ? activities.map((a) => html`<div class="tl" data-kind="${a.kind}"><span class="tl__icon">${raw(icons.spark)}</span>
            <div><div class="tl__title">${a.title}</div>${a.body ? html`<div class="tl__body">${a.body}</div>` : ""}<div class="tl__when">${fmtDateTime(a.created_at)}</div></div></div>`)
            : html`<p class="muted small">Sin movimientos.</p>`}</div>
        </section>
      </div>

      <div class="stack">
        <section class="panel-block">
          <h2>Su web</h2>
          ${c.weddings?.length ? html`<div class="rows">${c.weddings.map((w) => html`<a class="row" href="#/bodas/${w.id}"><span class="row__title">/b/${w.slug}</span><span class="row__side">${statusChip(w.status)}</span><span class="row__sub">${fmtDate(w.wedding_date)}</span></a>`)}</div>`
            : html`<p class="muted small">Aún no tiene web.</p>`}
        </section>
        <section class="panel-block">
          <h2>Datos de facturación</h2>
          <form class="form" data-billing>
            <div class="field"><label for="b-dn">Cómo los llamamos</label><input id="b-dn" name="display_name" value="${c.display_name}" required></div>
            <div class="grid-2"><div class="field"><label for="b-email">Email</label><input id="b-email" name="email" type="email" value="${c.email || ""}"></div>
              <div class="field"><label for="b-phone">Teléfono</label><input id="b-phone" name="phone" value="${c.phone || ""}"></div></div>
            <div class="field"><label for="b-name">Nombre o razón social (factura)</label><input id="b-name" name="billing_name" value="${c.billing_name || ""}"></div>
            <div class="field"><label for="b-nif">NIF / NIE</label><input id="b-nif" name="tax_id" value="${c.tax_id || ""}" autocapitalize="characters"></div>
            <div class="field"><label for="b-addr">Dirección</label><input id="b-addr" name="billing_address" value="${c.billing_address || ""}"></div>
            <div class="grid-3"><div class="field"><label for="b-cp">CP</label><input id="b-cp" name="postal_code" value="${c.postal_code || ""}"></div>
              <div class="field"><label for="b-city">Ciudad</label><input id="b-city" name="city" value="${c.city || ""}"></div>
              <div class="field"><label for="b-prov">Provincia</label><input id="b-prov" name="province" value="${c.province || ""}"></div></div>
            <div class="field"><label for="b-country">País (código de 2 letras)</label><input id="b-country" name="country" value="${c.country}" maxlength="2" style="max-width:90px" autocapitalize="characters"></div>
            <div class="field"><label for="b-notes">Notas</label><textarea id="b-notes" name="notes">${c.notes || ""}</textarea></div>
            <p class="error" data-err></p>
            <div class="btn-row"><button class="btn btn--primary" type="submit">Guardar datos</button>
              ${isAdmin ? html`<button class="btn btn--quiet btn--danger" type="button" data-delete>Borrar cliente</button>` : ""}</div>
          </form>
        </section>
      </div>
    </div>`);

  $("[data-billing]", el).addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries([...new FormData(e.target)].map(([k, v]) => [k, String(v).trim() || null]));
    d.country = (d.country || "ES").toUpperCase();
    if (d.tax_id) d.tax_id = d.tax_id.toUpperCase().replace(/[\s-]/g, "");
    if (d.tax_id && !validNif(d.tax_id) && d.country === "ES") { $("[data-err]", el).textContent = "El NIF/NIE no parece correcto (revisa la letra)."; return; }
    try { await db.update("clients", { id: `eq.${id}` }, d); toast("Datos guardados."); reload(); }
    catch (ex) { fail(ex); }
  });
  $("[data-delete]", el)?.addEventListener("click", async () => {
    if (!(await confirmDialog("¿Borrar este cliente?", "Solo se puede si no tiene pedidos ni facturas.", "Borrar", true))) return;
    try { await db.remove("clients", { id: `eq.${id}` }); go("/clientes"); } catch (e) { fail(e); }
  });

  $("[data-new-order]", el).addEventListener("click", async () => {
    const data = await formDialog({
      title: "Nuevo pedido", submit: "Crear pedido",
      body: html`<div class="form">
        <div class="field"><label for="o-prod">Tarifa</label><select id="o-prod" name="product">${products.map((p) => html`<option value="${p.id}">${p.name} · ${fmtMoney(p.price_cents)}${p.price_is_from ? " (desde)" : ""}</option>`)}</select></div>
        <div class="field"><label for="o-price">Precio final con IVA (€)</label><input id="o-price" name="price" inputmode="decimal" placeholder="Vacío = precio de la tarifa"><span class="hint">Para «A medida», pon aquí el precio acordado.</span></div>
        <div class="field"><label for="o-wed">Boda</label><select id="o-wed" name="wedding"><option value="">—</option>${(c.weddings || []).map((w) => html`<option value="${w.id}">/b/${w.slug}</option>`)}</select></div>
      </div>`,
    });
    if (!data) return;
    const p = products.find((x) => x.id === data.get("product"));
    const price = String(data.get("price")).trim() ? Math.round(Number(String(data.get("price")).replace(",", ".")) * 100) : p.price_cents;
    if (!Number.isFinite(price) || price < 0) return toast("El precio no es un número válido.", { error: true });
    try {
      const [o] = await db.insert("orders", { client_id: id, wedding_id: data.get("wedding") || null, lead_id: c.leads?.[0]?.id || null, status: "pendiente_pago" });
      await db.insert("order_lines", { order_id: o.id, product_id: p.id, description: `Web de boda · ${p.name}`, unit_price_cents: price, vat_rate_bp: p.vat_rate_bp });
      toast(`Pedido ${o.number} creado. Con «Enlace para la pareja» les mandas dónde pagar y ver cómo va.`, { timeout: 7000 });
      reload();
    } catch (e) { fail(e); }
  });

  $$("[data-order-status]", el).forEach((s) => s.addEventListener("change", async () => {
    try { await db.update("orders", { id: `eq.${s.dataset.orderStatus}` }, { status: s.value }); toast("Pedido actualizado."); reload(); }
    catch (e) { fail(e); }
  }));
  $$("[data-deliver]", el).forEach((b) => b.addEventListener("click", async () => {
    try { await db.update("orders", { id: `eq.${b.dataset.deliver}` }, { status: "entregado", delivered_at: new Date().toISOString() }); reload(); }
    catch (e) { fail(e); }
  }));
  $$("[data-track]", el).forEach((b) => b.addEventListener("click", () => {
    const o = orders.find((x) => x.id === b.dataset.track);
    const url = `${siteUrl()}/seguimiento/${pretty(o.tracking_code)}`;
    const due = o.total_cents - paidOf(o);
    const msg = due > 0 && o.status === "pendiente_pago"
      ? `¡Hola! Aquí podéis pagar vuestra web de boda (${fmtMoney(due)}) y ver cómo va, sin contraseña: ${url}`
      : `¡Hola! Aquí veis cómo va vuestra web de boda, las propuestas y podéis pedirnos cambios, sin contraseña: ${url}`;
    const dlg = showDialog(html`<div class="dlg"><h2>Enlace para la pareja</h2>
      <p class="muted">Su página de seguimiento: ven el pedido${due > 0 ? ", pueden pagar" : ""}, las propuestas que les mandes, y piden cambios o aprueban. Código <b>${pretty(o.tracking_code)}</b>.</p>
      <div class="link-box"><input readonly value="${url}"><button class="btn btn--small" type="button" data-copy>Copiar</button></div>
      <div class="btn-row"><a class="btn btn--small btn--primary" href="${waLink(c.phone, msg) || `https://wa.me/?text=${encodeURIComponent(msg)}`}" target="_blank" rel="noopener">${raw(icons.whatsapp)} Mandar por WhatsApp</a>
        <a class="btn btn--small" href="${url}" target="_blank" rel="noopener">Abrir</a></div>
      ${due > 0 && o.status !== "pendiente_pago" ? html`<p class="small muted">Para que puedan pagar desde ahí, el pedido tiene que estar «Pendiente de pago».</p>` : ""}
      <div class="dlg__actions"><button class="btn" type="button" data-close>Cerrar</button></div></div>`);
    dlg.addEventListener("click", async (e) => {
      if (e.target.closest("[data-copy]")) { await navigator.clipboard?.writeText(url).catch(() => {}); toast("Enlace copiado."); }
    });
  }));

  $$("[data-pay]", el).forEach((b) => b.addEventListener("click", async () => {
    const o = orders.find((x) => x.id === b.dataset.pay);
    const data = await formDialog({
      title: "Apuntar un pago", submit: "Apuntar pago",
      text: "Si con este pago queda pagado, la pareja recibe la confirmación con la factura y su enlace de seguimiento.",
      body: html`<div class="form">
        <div class="grid-2"><div class="field"><label for="p-amt">Importe (€)</label><input id="p-amt" name="amount" inputmode="decimal" value="${((o.total_cents - paidOf(o)) / 100).toFixed(2).replace(".", ",")}" required></div>
          <div class="field"><label for="p-how">Cómo</label><select id="p-how" name="provider"><option value="bizum">Bizum</option><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="otro">Otro</option></select></div></div>
        <div class="field"><label for="p-date">Fecha</label><input id="p-date" name="paid_at" type="datetime-local" value="${new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16)}"></div>
      </div>`,
    });
    if (!data) return;
    const cents = Math.round(Number(String(data.get("amount")).replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents <= 0) return toast("El importe no es válido.", { error: true });
    try {
      const r = await api("/api/pedido", { accion: "pago", order_id: o.id, importe: cents, forma: data.get("provider"), fecha: new Date(data.get("paid_at")).toISOString() });
      toast(r.became_paid
        ? `Pago apuntado: pedido pagado, entrega el ${fmtDate(r.promised)}.${r.invoice?.ok ? ` Factura ${r.invoice.number}.` : r.invoice ? " La factura no se ha podido hacer: mira tus tareas." : ""}`
        : "Pago apuntado.", { timeout: 7000 });
      reload();
    } catch (e) { fail(new Error(e.data?.message || e.message)); }
  }));

  $$("[data-invoice]", el).forEach((b) => b.addEventListener("click", async () => {
    b.disabled = true;
    try { const inv = await db.rpc("invoice_order", { p_order_id: b.dataset.invoice }); toast(`Factura ${inv.full_number} emitida.`); reload(); }
    catch (e) { b.disabled = false; fail(e); }
  }));

  $$("[data-pdf]", el).forEach((b) => b.addEventListener("click", async () => {
    try { await download(`/api/factura?id=${b.dataset.pdf}&descargar=1`, `Factura ${b.dataset.name}.pdf`); } catch (e) { fail(e); }
  }));

  $$("[data-rectify]", el).forEach((b) => b.addEventListener("click", async () => {
    const data = await formDialog({
      title: `Rectificar ${b.dataset.number}`, submit: "Hacer la rectificativa", danger: true,
      text: "Se emite una factura rectificativa (serie R) en negativo. La original no cambia. Si la devolución es con Stripe, no hace falta: se hace sola al devolver el dinero en Stripe.",
      body: html`<div class="form">
        <div class="field"><label for="r-amt">Importe a rectificar (€)</label><input id="r-amt" name="amount" inputmode="decimal" value="${(Number(b.dataset.total) / 100).toFixed(2).replace(".", ",")}" required></div>
        <div class="field"><label for="r-why">Motivo</label><input id="r-why" name="reason" placeholder="Desistimiento, descuento acordado, error en el precio…" required></div></div>`,
    });
    if (!data) return;
    const cents = Math.round(Number(String(data.get("amount")).replace(",", ".")) * 100);
    const reason = String(data.get("reason")).trim();
    if (!Number.isFinite(cents) || cents <= 0) return toast("El importe no es válido.", { error: true });
    if (!reason) return toast("Escribe el motivo.", { error: true });
    try {
      const draft = await db.rpc("create_corrective_invoice", { p_invoice_id: b.dataset.rectify, p_reason: reason, p_amount_cents: cents });
      const inv = await db.rpc("issue_invoice", { p_invoice_id: draft.id });
      toast(`Rectificativa ${inv.full_number} emitida.`);
      reload();
    } catch (e) { fail(e); }
  }));

  $$("[data-refund]", el).forEach((b) => b.addEventListener("click", async () => {
    const p = orders.flatMap((o) => o.payments).find((x) => x.id === b.dataset.refund);
    const data = await formDialog({
      title: "Apuntar una devolución", submit: "Apuntar devolución", danger: true,
      text: "Para pagos por Bizum, transferencia o efectivo: primero devuelve el dinero y luego apúntalo aquí. Se hace sola la factura rectificativa.",
      body: html`<div class="form">
        <div class="field"><label for="d-amt">Importe devuelto (€)</label><input id="d-amt" name="amount" inputmode="decimal" value="${((p.amount_cents - p.refunded_cents) / 100).toFixed(2).replace(".", ",")}" required></div>
        <div class="field"><label for="d-why">Motivo</label><input id="d-why" name="reason" placeholder="Desistimiento" required></div></div>`,
    });
    if (!data) return;
    const cents = Math.round(Number(String(data.get("amount")).replace(",", ".")) * 100);
    try {
      const r = await db.rpc("refund_payment", { p_payment_id: p.id, p_amount_cents: cents, p_reason: String(data.get("reason")).trim() || "Devolución" });
      toast(r.corrective?.ok ? `Devolución apuntada. Rectificativa ${r.corrective.number}.` : "Devolución apuntada.");
      reload();
    } catch (e) { fail(e); }
  }));

  $$("[data-link-wedding]", el).forEach((b) => b.addEventListener("click", async () => {
    const data = await formDialog({
      title: "Enlazar el pedido con su web", submit: "Enlazar",
      body: html`<div class="field"><label for="lw">Web</label><select id="lw" name="wedding">${c.weddings.map((w) => html`<option value="${w.id}">/b/${w.slug}</option>`)}</select></div>`,
    });
    if (!data) return;
    try { await db.update("orders", { id: `eq.${b.dataset.linkWedding}` }, { wedding_id: data.get("wedding") }); toast("Enlazado. Ya puedes mandarles propuestas desde su web."); reload(); }
    catch (e) { fail(e); }
  }));
}
