// Ajustes (solo dueño y administradores): datos fiscales, tarifas, plazos y equipo.
import { db } from "../supa.js";
import { html, render, $, $$, fmtMoney, toast, fail, statusChip } from "../ui.js";
import { validNif } from "./cliente.js";

export default async function ajustes(ctx) {
  const { el, staff } = ctx;
  if (!["owner", "admin"].includes(staff.role)) return render(el, html`<p class="empty"><strong>Solo el dueño o un administrador pueden cambiar los ajustes.</strong></p>`);
  const [settings, products, team] = await Promise.all([
    db.select("settings", { select: "key,value" }),
    db.select("products", { select: "*", order: "sort" }),
    db.select("staff", { select: "*", order: "created_at" }),
  ]);
  const get = (k) => settings.find((s) => s.key === k)?.value || {};
  const v = get("vendedor"), p = get("plazos");
  const sellerDone = v.nombre && v.nif && v.direccion;

  render(el, html`
    <div class="page-head"><div><h1>Ajustes</h1><p>Datos del negocio que usan la página legal, las facturas y las automatizaciones.</p></div></div>
    <div class="cols">
      <div class="stack">
        <section class="panel-block">
          <h2>Datos fiscales de WeddingWebs</h2>
          ${sellerDone ? "" : html`<p class="notice" style="margin-bottom:12px">Faltan datos: mientras estén vacíos, no se puede emitir ninguna factura real.</p>`}
          <form class="form" data-seller>
            <div class="field"><label for="s-n">Nombre y apellidos o razón social</label><input id="s-n" name="nombre" value="${v.nombre || ""}"></div>
            <div class="grid-2">
              <div class="field"><label for="s-nif">NIF</label><input id="s-nif" name="nif" value="${v.nif || ""}" autocapitalize="characters"></div>
              <div class="field"><label for="s-t">Eres</label><select id="s-t" name="tipo"><option value="">Sin decidir</option>
                <option value="autonomo" ${v.tipo === "autonomo" ? "selected" : ""}>Autónomo</option><option value="sociedad" ${v.tipo === "sociedad" ? "selected" : ""}>Sociedad (SL)</option></select></div>
            </div>
            <div class="field"><label for="s-d">Dirección fiscal</label><input id="s-d" name="direccion" value="${v.direccion || ""}"></div>
            <div class="grid-3">
              <div class="field"><label for="s-cp">CP</label><input id="s-cp" name="codigo_postal" value="${v.codigo_postal || ""}"></div>
              <div class="field"><label for="s-c">Ciudad</label><input id="s-c" name="ciudad" value="${v.ciudad || ""}"></div>
              <div class="field"><label for="s-p">Provincia</label><input id="s-p" name="provincia" value="${v.provincia || ""}"></div>
            </div>
            <div class="grid-2">
              <div class="field"><label for="s-e">Email de contacto</label><input id="s-e" name="email" type="email" value="${v.email || ""}"></div>
              <div class="field"><label for="s-r">Régimen de IVA</label><select id="s-r" name="regimen_iva"><option value="">Sin decidir</option>
                <option value="general" ${v.regimen_iva === "general" ? "selected" : ""}>General (21 %)</option></select>
                <span class="hint">Confírmalo con tu gestoría.</span></div>
            </div>
            <p class="error" data-err></p>
            <div><button class="btn btn--primary" type="submit">Guardar datos fiscales</button></div>
          </form>
        </section>

        <section class="panel-block">
          <h2>Tarifas</h2>
          <p class="small muted" style="margin-bottom:10px">Precio final con IVA. El escaparate las lee de aquí (si no responde, usa las de studio.json).</p>
          <form class="form" data-products>
            ${products.map((pr) => html`<div class="grid-3" data-product="${pr.id}" style="align-items:end">
              <div class="field"><label>Nombre</label><input name="name" value="${pr.name}"></div>
              <div class="field"><label>Precio con IVA (€)</label><input name="price" inputmode="decimal" value="${(pr.price_cents / 100).toFixed(2).replace(".", ",")}"></div>
              <div class="btn-row" style="padding-bottom:8px">
                <label class="check"><input type="checkbox" name="from" ${pr.price_is_from ? "checked" : ""}> «desde»</label>
                <label class="check"><input type="checkbox" name="active" ${pr.active ? "checked" : ""}> activa</label></div>
            </div>`)}
            <div><button class="btn btn--primary" type="submit">Guardar tarifas</button></div>
          </form>
        </section>
      </div>

      <div class="stack">
        <section class="panel-block">
          <h2>Plazos</h2>
          <form class="form" data-plazos>
            <div class="field"><label for="p-e">Días para entregar una web</label><input id="p-e" name="entrega_dias" type="number" min="1" value="${p.entrega_dias ?? 3}"></div>
            <div class="field"><label for="p-w">Meses online después de la boda</label><input id="p-w" name="web_meses_tras_boda" type="number" min="1" value="${p.web_meses_tras_boda ?? 12}"></div>
            <div class="field"><label for="p-i">Meses hasta borrar los datos de invitados</label><input id="p-i" name="invitados_meses_tras_boda" type="number" min="1" value="${p.invitados_meses_tras_boda ?? 6}"></div>
            <div class="field"><label for="p-l">Meses hasta anonimizar leads perdidos</label><input id="p-l" name="leads_perdidos_anonimizar_meses" type="number" min="1" value="${p.leads_perdidos_anonimizar_meses ?? 24}"></div>
            <div><button class="btn" type="submit">Guardar plazos</button></div>
          </form>
        </section>

        <section class="panel-block">
          <h2>Equipo</h2>
          <div class="rows">${team.map((m) => html`<div class="row"><span class="row__title">${m.name || m.email}</span>
            <span class="row__side">${statusChip(m.active ? m.role : "cancelada")}</span>
            <span class="row__sub">${m.email}${m.user_id ? "" : " · aún no ha entrado"}</span></div>`)}</div>
          ${staff.role === "owner" ? html`<form class="form" data-team style="margin-top:12px">
            <div class="grid-2"><input name="email" type="email" placeholder="Email" aria-label="Email"><input name="name" placeholder="Nombre" aria-label="Nombre"></div>
            <div class="btn-row"><select name="role" style="width:auto" aria-label="Rol"><option value="editor">Editor (sin ajustes ni facturas)</option><option value="admin">Administrador</option></select>
              <button class="btn" type="submit">Añadir al equipo</button></div>
            <p class="hint">Después, crea su usuario en Supabase (Authentication › Users › Add user) con el mismo email. Ver docs/SUPABASE.md.</p>
          </form>` : ""}
        </section>
      </div>
    </div>`);

  const saveSetting = (key, value) => db.update("settings", { key: `eq.${key}` }, { value, updated_by: staff.id });

  $("[data-seller]", el).addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries([...new FormData(e.target)].map(([k, x]) => [k, String(x).trim() || null]));
    if (d.nif) d.nif = d.nif.toUpperCase().replace(/[\s-]/g, "");
    if (d.nif && !validNif(d.nif)) { $("[data-err]", el).textContent = "El NIF no parece correcto (revisa la letra)."; return; }
    try { await saveSetting("vendedor", { ...v, ...d, pais: "ES" }); toast("Datos fiscales guardados."); ajustes(ctx); } catch (ex) { fail(ex); }
  });
  $("[data-plazos]", el).addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries([...new FormData(e.target)].map(([k, x]) => [k, Number(x)]));
    try { await saveSetting("plazos", { ...p, ...d }); toast("Plazos guardados. Se aplican a las bodas nuevas o cuando cambie su fecha."); } catch (ex) { fail(ex); }
  });
  $("[data-products]", el).addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      for (const row of $$("[data-product]", el)) {
        const cents = Math.round(Number(row.querySelector("[name=price]").value.replace(",", ".")) * 100);
        if (!Number.isFinite(cents) || cents < 0) throw new Error("Algún precio no es un número válido.");
        await db.update("products", { id: `eq.${row.dataset.product}` }, {
          name: row.querySelector("[name=name]").value.trim(), price_cents: cents,
          price_is_from: row.querySelector("[name=from]").checked, active: row.querySelector("[name=active]").checked,
        });
      }
      toast("Tarifas guardadas. El escaparate las mostrará en unos minutos.");
      ajustes(ctx);
    } catch (ex) { fail(ex); }
  });
  $("[data-team]", el)?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    if (!/^\S+@\S+\.\S+$/.test(d.email)) return toast("Escribe un email válido.", { error: true });
    try { await db.insert("staff", { email: d.email.trim().toLowerCase(), name: d.name.trim(), role: d.role }); toast("Añadido. Ahora crea su usuario en Supabase."); ajustes(ctx); }
    catch (ex) { fail(ex); }
  });
  void fmtMoney;
}
