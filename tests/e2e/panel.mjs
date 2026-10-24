#!/usr/bin/env node
// Pruebas del panel en un navegador: tablero (arrastrar), perdido con motivo, mensajes de WhatsApp,
// buscador, importador de la hoja de Google, tareas, ajustes y que un editor no ve los ajustes.
// Necesita la base con semillas recién cargadas (supabase db reset) y el servidor local.
//   node tests/e2e/panel.mjs
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SITE, playwright, supabase } from "./_util.mjs";

const db = supabase();
const { chromium } = await playwright();
const browser = await chromium.launch();
let fails = 0;
const ok = (m) => console.log(`✓ ${m}`);
async function check(name, fn) {
  try { await fn(); ok(name); } catch (e) { fails++; console.log(`✗ ${name}\n    ${e.message.split("\n")[0]}`); }
}

async function login(email, password) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "es-ES", timezoneId: "Europe/Madrid" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => { fails++; console.log(`✗ error en la página: ${e.message}`); });
  await page.goto(`${SITE}/panel/`);
  await page.fill("#l-email", email);
  await page.fill("#l-pass", password);
  await page.click("button[type=submit]");
  await page.waitForSelector(".greeting");
  return { ctx, page };
}

const ELENA = "a0000000-0000-4000-8000-000000000001";
const LAURA = "a0000000-0000-4000-8000-000000000009";
const { page: p, ctx } = await login("luis@example.com", "demo-luis-1234");

await check("Login con contraseña incorrecta da un error claro", async () => {
  const c = await browser.newContext();
  const q = await c.newPage();
  await q.goto(`${SITE}/panel/`);
  await q.fill("#l-email", "luis@example.com");
  await q.fill("#l-pass", "mal");
  await q.click("button[type=submit]");
  await q.getByText("Email o contraseña incorrectos.").waitFor();
  await c.close();
});

await check("Tablero: arrastrar una pareja a «Propuesta» cambia su estado", async () => {
  await p.goto(`${SITE}/panel/#/leads`);
  await p.locator(`.card[data-id="${ELENA}"]`).dragTo(p.locator('.col[data-col="propuesta"]'));
  await p.getByText("Elena y David: Propuesta.").waitFor();
  const [l] = await db.select(`leads?id=eq.${ELENA}&select=status`);
  if (l.status !== "propuesta") throw new Error(`estado ${l.status}`);
  const [a] = await db.select(`activities?lead_id=eq.${ELENA}&kind=eq.estado&select=title`);
  if (!a?.title.includes("Propuesta")) throw new Error("no está en el historial");
});

await check("Marcar como perdido pide el motivo y lo guarda", async () => {
  await p.goto(`${SITE}/panel/#/leads/${LAURA}`);
  await p.getByRole("button", { name: "Marcar como perdido" }).click();
  await p.fill("#lost", "Precio");
  await p.getByRole("button", { name: "Marcar como perdido" }).last().click();
  await p.getByRole("button", { name: "Perdido: Precio" }).waitFor();
});

await check("WhatsApp: el mensaje sale relleno con el nombre y queda en el historial", async () => {
  await p.goto(`${SITE}/panel/#/leads/a0000000-0000-4000-8000-000000000002`);
  await p.getByRole("button", { name: "WhatsApp" }).click();
  const text = await p.inputValue("#m-text");
  if (!text.startsWith("¡Hola, Irene!") || !text.includes("(con-cambios)")) throw new Error(text);
  let opened = "";
  await ctx.route("https://wa.me/**", (r) => { opened = r.request().url(); return r.fulfill({ body: "WhatsApp" }); });
  const [popup] = await Promise.all([p.waitForEvent("popup"), p.getByRole("button", { name: "Abrir WhatsApp" }).click()]);
  await popup.waitForLoadState();
  if (!opened.startsWith("https://wa.me/34611000002?text=%C2%A1Hola%2C%20Irene")) throw new Error(opened);
  await popup.close();
  await p.getByText("WhatsApp enviado").waitFor();
});

await check("Buscador global encuentra por NIF y por dirección de la web", async () => {
  await p.fill("#search", "00000000T");
  await p.locator("#search-results a").filter({ hasText: "Lucía y Martín" }).waitFor();
  await p.fill("#search", "sara-y-jon");
  await p.locator("#search-results a").filter({ hasText: "Sara y Jon" }).first().click();
  await p.waitForURL(/#\/bodas\//);
});

await check("Importador: lee el CSV de la hoja y no duplica", async () => {
  const dir = mkdtempSync(join(tmpdir(), "csv-"));
  const file = join(dir, "contactos.csv");
  writeFileSync(file, "Fecha,Tipo,Email,Nombres,Fecha boda,Lugar,Estilo,Fotos,Tarifa,Teléfono,Mensaje,Estado,Config\n"
    + "2026-09-02 11:00:00,prueba,importada.e2e@example.com,Importada y Prueba,2027-05-08 12:00,Finca X,lino,2,,,,Nuevo,\n"
    + "2026-09-03 11:00:00,reserva,lucia@example.com,Repetida,,,,,,,,Nuevo,\n");
  await p.goto(`${SITE}/panel/#/importar`);
  await p.setInputFiles("[data-file]", file);
  await p.getByRole("button", { name: "Importar 2 contactos" }).click();
  await p.getByText("1 importados, 1 ya estaban en el panel").waitFor();
  await db.remove("leads?email=eq.importada.e2e@example.com");
});

await check("Tareas: crear y marcar como hecha", async () => {
  await p.goto(`${SITE}/panel/#/tareas`);
  await p.fill("[data-add] [name=title]", "Tarea e2e");
  await p.click("[data-add] button");
  await p.getByText("Tarea e2e").waitFor();
  await p.locator(".task", { hasText: "Tarea e2e" }).locator("input[type=checkbox]").check();
  await p.getByText("Tarea hecha.").waitFor();
  await db.remove("tasks?title=eq.Tarea%20e2e");
});

await check("Ajustes: un NIF mal escrito no se guarda", async () => {
  await p.goto(`${SITE}/panel/#/ajustes`);
  await p.fill("#s-nif", "12345678A");
  await p.click("[data-seller] button[type=submit]");
  await p.getByText("El NIF no parece correcto").waitFor();
});

await check("Cliente: nuevo pedido y pago apuntado → pagado con entrega en 3 días", async () => {
  await p.goto(`${SITE}/panel/#/clientes/c0000000-0000-4000-8000-000000000002`);
  await p.getByRole("button", { name: "Nuevo pedido" }).click();
  await p.locator("dialog[open]").getByRole("button", { name: "Crear pedido" }).click();
  await p.getByText(/Pedido P-\d{4}-\d{4} creado/).waitFor();
  await p.getByRole("button", { name: "Apuntar un pago" }).first().click();
  await p.locator("dialog[open]").getByRole("button", { name: "Apuntar pago" }).click();
  await p.getByText("Pago apuntado: pedido pagado.").waitFor();
  const orders = await db.select("orders?client_id=eq.c0000000-0000-4000-8000-000000000002&select=id,status,promised_delivery_at&order=created_at.desc");
  if (orders[0].status !== "pagado" || !orders[0].promised_delivery_at) throw new Error(JSON.stringify(orders[0]));
  await db.remove(`payments?order_id=eq.${orders[0].id}`);
  await db.remove(`orders?id=eq.${orders[0].id}`);
});
await ctx.close();

await check("Un editor del equipo no ve Ajustes", async () => {
  const { page, ctx: c } = await login("ayudante@example.com", "demo-ayudante-1234");
  if (await page.locator('a[data-nav="/ajustes"]').count()) throw new Error("ve el enlace a Ajustes");
  await page.goto(`${SITE}/panel/#/ajustes`);
  await page.getByText("Solo el dueño o un administrador").waitFor();
  await c.close();
});

await check("Una pareja con cuenta no entra en el panel", async () => {
  const c = await browser.newContext();
  const q = await c.newPage();
  await q.goto(`${SITE}/panel/`);
  await q.fill("#l-email", "lucia@example.com");
  await q.fill("#l-pass", "demo-pareja-1234");
  await q.click("button[type=submit]");
  await q.getByText("Este usuario no tiene acceso al panel").waitFor();
  await c.close();
});

await browser.close();
console.log(fails ? `\n✗ ${fails} prueba(s) del panel fallan` : "\n✓ Todas las pruebas del panel pasan");
process.exit(fails ? 1 : 0);
