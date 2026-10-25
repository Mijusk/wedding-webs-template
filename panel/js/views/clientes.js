// Clientes: las parejas que ya han contratado (o están en ello).
import { db } from "../supa.js";
import { html, render, $, fmtDate, formDialog, fail, downloadCsv, debounce } from "../ui.js";

export default async function clientes({ el, query, go }) {
  const q = query.get("q") || "";
  const rows = await db.select("clients", {
    select: "*,weddings(id,slug,status,wedding_date),orders(id,status,total_cents)",
    order: "created_at.desc", limit: 2000,
  });
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const list = q ? rows.filter((c) => norm([c.display_name, c.email, c.phone, c.tax_id, c.billing_name].join(" ")).includes(norm(q))) : rows;

  render(el, html`
    <div class="page-head">
      <div><h1>Clientes</h1><p>${rows.length} parejas.</p></div>
      <div class="page-actions">
        <button class="btn" type="button" data-export>Exportar</button>
        <button class="btn btn--primary" type="button" data-new>Nuevo cliente</button>
      </div>
    </div>
    <div class="toolbar"><input type="search" data-q value="${q}" placeholder="Buscar por nombre, email, teléfono o NIF" aria-label="Buscar"></div>
    ${list.length ? html`<div class="table-wrap"><table class="table">
      <thead><tr><th>Pareja</th><th>Contacto</th><th>NIF</th><th>Web</th><th>Pedidos</th><th>Desde</th></tr></thead>
      <tbody>${list.map((c) => html`<tr>
        <td><a href="#/clientes/${c.id}">${c.display_name}</a></td>
        <td>${c.email || ""}<div class="small muted">${c.phone || ""}</div></td>
        <td>${c.tax_id || html`<span class="muted">—</span>`}</td>
        <td>${c.weddings?.length ? c.weddings.map((w) => html`<a href="#/bodas/${w.id}">/b/${w.slug}</a><div class="small muted">${fmtDate(w.wedding_date)}</div>`) : html`<span class="muted">—</span>`}</td>
        <td>${c.orders?.length || 0}</td>
        <td class="nowrap">${fmtDate(c.created_at)}</td>
      </tr>`)}</tbody></table></div>`
    : html`<p class="empty"><strong>${q ? "Nadie coincide con la búsqueda." : "Aún no hay clientes."}</strong>${q ? "" : "Un lead se convierte en cliente desde su ficha, con el botón «Convertir en cliente»."}</p>`}`);

  $("[data-q]", el).addEventListener("input", debounce((e) => go(`/clientes${e.target.value ? `?q=${encodeURIComponent(e.target.value)}` : ""}`), 400));
  if (q) { const i = $("[data-q]", el); i.focus(); i.setSelectionRange(q.length, q.length); }
  $("[data-export]", el).addEventListener("click", () => downloadCsv("clientes.csv", list, [
    ["display_name", "Pareja"], ["email", "Email"], ["phone", "Teléfono"], ["billing_name", "Nombre de facturación"], ["tax_id", "NIF/NIE"],
    ["billing_address", "Dirección"], ["postal_code", "CP"], ["city", "Ciudad"], ["province", "Provincia"], ["country", "País"], ["created_at", "Desde"],
  ]));
  $("[data-new]", el).addEventListener("click", async () => {
    const data = await formDialog({
      title: "Nuevo cliente", submit: "Crear cliente",
      body: html`<div class="form">
        <div class="field"><label for="c-name">Pareja</label><input id="c-name" name="display_name" placeholder="Ana y Pablo" required></div>
        <div class="grid-2"><div class="field"><label for="c-email">Email</label><input id="c-email" name="email" type="email"></div>
        <div class="field"><label for="c-phone">Teléfono</label><input id="c-phone" name="phone"></div></div>
      </div>`,
    });
    if (!data) return;
    try {
      const [c] = await db.insert("clients", Object.fromEntries([...data].map(([k, v]) => [k, String(v).trim() || null])));
      go(`/clientes/${c.id}`);
    } catch (e) { fail(e); }
  });
}
