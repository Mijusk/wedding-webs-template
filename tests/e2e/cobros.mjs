#!/usr/bin/env node
// Fase 4 de punta a punta, en navegador: «una pareja paga desde el escaparate y sigue su web con
// un código, sin contraseña».
//   1. La pareja elige Tal cual, paga en Stripe (de pruebas) y vuelve a su página de seguimiento.
//   2. Luis crea su web desde el pedido y le manda la propuesta 1.
//   3. La pareja la ve, pide una corrección (los cambios de diseño no entran en Tal cual) y la aprueba.
//   4. Luis publica: el pedido queda entregado. La factura sale en Facturas y en el libro para la gestoría.
//   node tests/e2e/cobros.mjs [--capturas]
// Necesita el servidor local con el Stripe de pruebas (ver tests/stripe-falso.mjs).
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, SITE, env, playwright, supabase } from "./_util.mjs";
import { startFakeStripe } from "../stripe-falso.mjs";

const E = env();
const db = supabase();
const SHOTS = process.argv.includes("--capturas") ? join(ROOT, "tests/e2e/capturas/cobros") : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true }); };
const stamp = Date.now().toString(36);
const EMAIL = `cobro.${stamp}@example.com`;
let steps = 0;
const ok = (m) => { steps++; console.log(`✓ ${m}`); };

if (!E.STRIPE_API_BASE) {
  console.log("Sin STRIPE_API_BASE en .env.local: se salta la prueba de cobros (ver tests/stripe-falso.mjs).");
  process.exit(0);
}
const STRIPE = E.STRIPE_API_BASE.replace(/\/+$/, "");
const fake = (await fetch(`${STRIPE}/prueba/avisos`).then((r) => r.ok).catch(() => false))
  ? null : await startFakeStripe({ port: Number(new URL(STRIPE).port), webhookUrl: `${SITE}/api/stripe`, secret: E.STRIPE_WEBHOOK_SECRET });
await db.remove("rate_limits?key=like.*");
const [{ value: sellerBefore }] = await db.select("settings?key=eq.vendedor&select=value");
await db.update("settings?key=eq.vendedor", { value: { ...sellerBefore, nombre: "Luis Demo", nif: "12345678Z", direccion: "Calle Falsa 1", email: "hola@example.com", telefono: "600000000" } });

const { chromium } = await playwright();
const browser = await chromium.launch();
let code = 0;
try {
  // ── 1. La pareja paga ──
  const couple = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "es-ES", timezoneId: "Europe/Madrid", acceptDownloads: true });
  const cp = await couple.newPage();
  const errors = [];
  cp.on("pageerror", (e) => errors.push(e.message));
  cp.on("dialog", (d) => d.accept());
  await cp.goto(`${SITE}/studio/#tarifas`);
  await cp.locator('[data-pick="tal-cual"]').click();
  await cp.locator("#c-checkout").waitFor();
  const label = await cp.locator("#c-submit").textContent();
  if (!/Pagar 79 €/.test(label)) throw new Error(`Botón: ${label}`);
  await cp.fill("#c-name", "Olga y Teo");
  await cp.fill("#c-email", EMAIL);
  await cp.click("#c-submit");
  await cp.getByText("marcad la casilla").waitFor();
  await cp.check("#c-start");
  await shot(cp, "1-escaparate");
  await cp.click("#c-submit");
  await cp.waitForURL(/127\.0\.0\.1:\d+\/pagar\//);
  ok("Escaparate: «Pagar 79 € y reservar», pide la casilla de empezar ya y lleva a Stripe");

  await cp.getByRole("button", { name: "Pagar" }).click();
  await cp.waitForURL(/\/seguimiento\/[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}/);
  const track = cp.url().replace(/\?.*$/, "");
  const CODE = track.split("/").pop();
  await cp.getByText("¡Pago recibido!").waitFor();
  await cp.getByText("Preparamos vuestra web").waitFor();
  if (!(await cp.locator('a[href*="/api/factura?c="]').count())) throw new Error("No sale la factura en el seguimiento");
  await shot(cp, "2-seguimiento-pagado");
  ok(`Pagado en Stripe y de vuelta en su página de seguimiento (${CODE}), con la factura`);

  const [order] = await db.select(`orders?tracking_code=eq.${CODE.replace("-", "")}&select=id,number,client_id,status,promised_delivery_at`);
  if (order.status !== "pagado" || !order.promised_delivery_at) throw new Error(`Pedido: ${JSON.stringify(order)}`);
  const tasks = await db.select(`tasks?auto_key=eq.preparar:${order.id}&status=eq.pendiente&select=title`);
  if (!tasks.length) throw new Error("Falta la tarea de preparar la web");
  ok(`Pedido ${order.number} pagado, entrega el ${order.promised_delivery_at} y tarea para Luis`);

  // ── 2. Luis crea la web desde el pedido y manda la propuesta ──
  const luis = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "es-ES", timezoneId: "Europe/Madrid", acceptDownloads: true });
  const lp = await luis.newPage();
  lp.on("pageerror", (e) => errors.push(e.message));
  await lp.goto(`${SITE}/panel/`);
  await lp.fill("#l-email", "luis@example.com");
  await lp.fill("#l-pass", "demo-luis-1234");
  await lp.click("button[type=submit]");
  await lp.waitForSelector(".greeting");
  await lp.goto(`${SITE}/panel/#/clientes/${order.client_id}`);
  await lp.getByRole("link", { name: "Crear su web" }).click();
  await lp.locator("#w-a").waitFor();
  if ((await lp.inputValue("#w-a")) !== "Olga" || (await lp.inputValue("#w-b")) !== "Teo") throw new Error("No ha rellenado los nombres desde el pedido");
  const d = new Date(); d.setMonth(d.getMonth() + 10);
  await lp.fill("#w-date", d.toISOString().slice(0, 10));
  await lp.fill("#w-venue", "Masía Can Prat");
  await lp.waitForFunction(() => document.querySelector("#w-slug")?.value.length > 3);
  await lp.getByRole("button", { name: "Crear y abrir el editor" }).click();
  await lp.waitForURL(/#\/bodas\/[0-9a-f-]{36}$/);
  const weddingId = lp.url().split("/").pop();
  await lp.locator("summary", { hasText: "Propuestas y cambios" }).click();
  await lp.getByRole("button", { name: "Mandar la propuesta 1 a la pareja" }).click();
  await lp.fill("dialog[open] textarea[name=note]", "¡Primera versión! Falta poner vuestras fotos.");
  await lp.locator("dialog[open]").getByRole("button", { name: "Mandar" }).click();
  await lp.getByText("Propuesta 1 mandada").waitFor();
  await shot(lp, "3-propuesta-mandada");
  await lp.locator("dialog[open]").getByRole("button", { name: "Cerrar" }).click();
  const [linked] = await db.select(`orders?id=eq.${order.id}&select=wedding_id,status`);
  if (linked.wedding_id !== weddingId || linked.status !== "en_produccion") throw new Error(`Pedido tras la propuesta: ${JSON.stringify(linked)}`);
  const [mail] = await db.select(`email_log?template=eq.propuesta&wedding_id=eq.${weddingId}&select=to_email`);
  if (mail?.to_email !== EMAIL) throw new Error("No se ha mandado el email de la propuesta");
  ok("Luis crea la web desde el pedido (ya enlazada) y manda la propuesta 1: email a la pareja");

  // ── 3. La pareja la ve, pide una corrección y la aprueba ──
  await cp.goto(track);
  await cp.locator(".proposal--current").getByText("Propuesta 1").waitFor();
  const href = await cp.getByRole("link", { name: "Ver la propuesta" }).getAttribute("href");
  const view = await couple.newPage();
  await view.goto(`${SITE}${href}`);
  await view.getByText("Propuesta 1 · aún no es la web publicada").waitFor();
  await view.close();
  if (!(await cp.locator('input[value="cambio"]').isDisabled())) throw new Error("Tal cual permite cambios de diseño");
  await cp.getByRole("button", { name: "Pedir cambios" }).click();
  await cp.fill("#req-msg", "La ceremonia es a las 12:30, no a las 13:00.");
  await cp.getByRole("button", { name: "Enviar" }).click();
  await cp.getByText("La ceremonia es a las 12:30").waitFor();
  ok("La pareja ve la propuesta y pide una corrección (los cambios de diseño no entran en Tal cual)");
  await cp.getByRole("button", { name: "¡Nos encanta, publicadla!" }).click();
  await cp.getByText(/Aprobada el/).waitFor();
  await shot(cp, "4-aprobada");
  const pub = await db.select(`tasks?auto_key=eq.publicar:${order.id}&status=eq.pendiente&select=id`);
  if (!pub.length) throw new Error("Falta la tarea de publicar");
  ok("La aprueba y a Luis le sale la tarea «Publicar»");

  // ── 4. Luis publica; facturas para la gestoría ──
  await lp.goto(`${SITE}/panel/#/bodas/${weddingId}`);
  await lp.locator("[data-publish]").click();
  await lp.locator("dialog[open]").getByRole("button", { name: "Publicar" }).click();
  await lp.getByText(/Publicada \(versión 1\)/).waitFor();
  const [done] = await db.select(`orders?id=eq.${order.id}&select=status,delivered_at`);
  if (done.status !== "entregado") throw new Error(`Pedido tras publicar: ${done.status}`);
  await cp.goto(track);
  await cp.getByRole("link", { name: "Abrir la web" }).waitFor();
  ok("Publicar la web entrega el pedido y la pareja ve el enlace a su web");

  const [inv] = await db.select(`invoices?order_id=eq.${order.id}&select=full_number,kind`);
  await lp.goto(`${SITE}/panel/#/facturas`);
  await lp.getByText(inv.full_number).waitFor();
  const [download] = await Promise.all([lp.waitForEvent("download"), lp.getByRole("button", { name: /Libro de facturas emitidas/ }).click()]);
  const csv = readFileSync(await download.path(), "utf8");
  if (!csv.includes(`${inv.full_number};F2;`) || !csv.includes(";65,29;21;13,71;79,00;")) throw new Error(`Libro de facturas: ${csv.split("\n").find((l) => l.includes(inv.full_number))}`);
  await shot(lp, "5-facturas");
  ok(`Facturas: ${inv.full_number} (simplificada) en el trimestre y en el libro para la gestoría`);

  if (errors.length) throw new Error(`Errores en la página: ${errors.join("; ")}`);
  console.log(`\n✓ Fase 4 correcta (${steps} pasos).`);
} catch (e) {
  code = 1;
  console.error(`\n✗ ${e.message.split("\n").slice(0, 3).join(" ")}`);
} finally {
  await browser.close();
  await db.update("settings?key=eq.vendedor", { value: sellerBefore }).catch(() => {});
  fake?.close();
}
process.exit(code);
