// Ficha de cliente: datos de facturación, pedidos y pagos, su web y su historial.
import { db } from "../supa.js";
import { html, raw, render, $, $$, ORDER_STATUSES, statusChip, fmtDate, fmtDateTime, fmtMoney, formDialog, confirmDialog, toast, fail, icons } from "../ui.js";

export default async function cliente(ctx) {
  const { el, params, staff, setTitle, go } = ctx;
  const id = params.id;
  const [c, orders, products, activities] = await Promise.all([
    db.one("clients", { select: "*,weddings(id,slug,status,wedding_date,template),leads(id,names,status)", id: `eq.${id}` }),
    db.select("orders", { select: "*,order_lines(*),payments(*)", client_id: `eq.${id}`, order: "created_at.desc" }),
    db.select("products", { select: "*", active: "is.true", order: "sort" }),
    db.select("activities", { select: "*", client_id: `eq.${id}`, order: "created_at.desc", limit: 100 }),
  ]);
  if (!c) return render(el, html`<p class="empty"><strong>Este cliente no existe.</strong><a href="#/clientes">Volver</a></p>`);
  setTitle(c.display_name);
  const reload = () => cliente(ctx);
  const isAdmin = ["owner", "admin"].includes(staff.role);

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
        ${c.weddings?.length ? "" : html`<a class="btn" href="#/bodas/nueva?cliente=${c.id}">Crear su web</a>`}
        <button class="btn btn--primary" type="button" data-new-order>Nuevo pedido</button>
      </div>
    </div>

    <div class="cols">
      <div class="stack">
        <section class="panel-block">
          <h2>Pedidos</h2>
          ${orders.length ? orders.map((o) => html`<div class="panel-block" style="margin-top:10px;background:var(--surface-2)">
            <div class="block-title"><span>Pedido ${o.number} ${statusChip(o.status)}</span><b>${fmtMoney(o.total_cents)}</b></div>
            <div class="rows">${o.order_lines.map((li) => html`<div class="row"><span class="row__title" style="font-weight:500">${li.description}${li.quantity > 1 ? ` × ${li.quantity}` : ""}</span><span class="row__side">${fmtMoney(li.total_cents)}</span></div>`)}</div>
            <p class="small muted" style="margin:8px 0">
              Pagado ${fmtMoney(o.payments.filter((p) => p.status === "pagado").reduce((a, p) => a + p.amount_cents - p.refunded_cents, 0))} de ${fmtMoney(o.total_cents)}
              ${o.promised_delivery_at ? ` · entrega prometida el ${fmtDate(o.promised_delivery_at)}` : ""}
              ${o.delivered_at ? ` · entregado el ${fmtDate(o.delivered_at)}` : ""}
            </p>
            ${o.payments.length ? html`<div class="rows small">${o.payments.map((p) => html`<div class="row"><span>${p.provider} · ${fmtDateTime(p.paid_at || p.created_at)}</span><span class="row__side">${statusChip(p.status)} ${fmtMoney(p.amount_cents)}</span></div>`)}</div>` : ""}
            ${o.payment_link_url ? html`<p class="small" style="margin-top:8px">Enlace de pago: <a href="${o.payment_link_url}" target="_blank" rel="noopener">${o.payment_link_url}</a></p>` : ""}
            <div class="btn-row" style="margin-top:12px">
              <select data-order-status="${o.id}" aria-label="Estado del pedido" style="width:auto">${ORDER_STATUSES.map(([v, l]) => html`<option value="${v}" ${o.status === v ? "selected" : ""}>${l}</option>`)}</select>
              <button class="btn btn--small" type="button" data-pay="${o.id}">Apuntar un pago</button>
              <button class="btn btn--small" type="button" data-link="${o.id}">Enlace de pago</button>
              ${o.status !== "entregado" ? html`<button class="btn btn--small" type="button" data-deliver="${o.id}">Marcar entregado</button>` : ""}
            </div>
          </div>`) : html`<p class="empty"><strong>Sin pedidos.</strong>Crea uno con «Nuevo pedido» cuando confirmen la tarifa.</p>`}
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
      toast(`Pedido ${o.number} creado.`);
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
  $$("[data-link]", el).forEach((b) => b.addEventListener("click", async () => {
    const o = orders.find((x) => x.id === b.dataset.link);
    const data = await formDialog({
      title: "Enlace de pago", submit: "Guardar enlace",
      text: "Cuando conectemos Stripe (fase 4) el enlace se creará solo. Mientras tanto, pega aquí el que generes en Stripe o tu banco.",
      body: html`<div class="field"><label for="pl">Enlace</label><input id="pl" name="url" type="url" value="${o.payment_link_url || ""}" placeholder="https://buy.stripe.com/…"></div>`,
    });
    if (!data) return;
    try { await db.update("orders", { id: `eq.${o.id}` }, { payment_link_url: String(data.get("url")).trim() || null }); reload(); }
    catch (e) { fail(e); }
  }));
  $$("[data-pay]", el).forEach((b) => b.addEventListener("click", async () => {
    const o = orders.find((x) => x.id === b.dataset.pay);
    const paid = o.payments.filter((p) => p.status === "pagado").reduce((a, p) => a + p.amount_cents, 0);
    const data = await formDialog({
      title: "Apuntar un pago", submit: "Apuntar pago",
      body: html`<div class="form">
        <div class="grid-2"><div class="field"><label for="p-amt">Importe (€)</label><input id="p-amt" name="amount" inputmode="decimal" value="${((o.total_cents - paid) / 100).toFixed(2).replace(".", ",")}" required></div>
          <div class="field"><label for="p-how">Cómo</label><select id="p-how" name="provider"><option value="bizum">Bizum</option><option value="transferencia">Transferencia</option><option value="stripe">Tarjeta (Stripe)</option><option value="efectivo">Efectivo</option><option value="otro">Otro</option></select></div></div>
        <div class="field"><label for="p-date">Fecha</label><input id="p-date" name="paid_at" type="datetime-local" value="${new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16)}"></div>
      </div>`,
    });
    if (!data) return;
    const cents = Math.round(Number(String(data.get("amount")).replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents <= 0) return toast("El importe no es válido.", { error: true });
    try {
      await db.insert("payments", { order_id: o.id, provider: data.get("provider"), amount_cents: cents, status: "pagado", paid_at: new Date(data.get("paid_at")).toISOString() });
      const total = paid + cents;
      const patch = { paid_cents: total };
      if (total >= o.total_cents && ["borrador", "pendiente_pago"].includes(o.status)) {
        patch.status = "pagado";
        patch.paid_at = new Date().toISOString();
        if (!o.promised_delivery_at) patch.promised_delivery_at = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
      }
      await db.update("orders", { id: `eq.${o.id}` }, patch);
      await db.insert("activities", { client_id: id, order_id: o.id, kind: "pago", title: `Pago de ${fmtMoney(cents)} (${data.get("provider")})`, actor_id: staff.id });
      toast(patch.status === "pagado" ? "Pago apuntado: pedido pagado. Entrega en 3 días." : "Pago apuntado.");
      reload();
    } catch (e) { fail(e); }
  }));
}

// NIF (8 números + letra), NIE (X/Y/Z + 7 números + letra) o CIF de empresa (letra + 7 números + control).
export function validNif(v) {
  const s = String(v || "").toUpperCase();
  const letters = "TRWAGMYFPDXBNJZSQVHLCKE";
  if (/^\d{8}[A-Z]$/.test(s)) return letters[Number(s.slice(0, 8)) % 23] === s[8];
  if (/^[XYZ]\d{7}[A-Z]$/.test(s)) return letters[Number("XYZ".indexOf(s[0]) + s.slice(1, 8)) % 23] === s[8];
  return /^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(s);
}
