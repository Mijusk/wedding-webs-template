#!/usr/bin/env node
// Fase 3 de punta a punta, en navegador: «una pareja de prueba puede invitar a 150 personas,
// recibir respuestas y exportar la lista para el catering».
//   1. Luis da acceso a la pareja y genera su enlace mágico desde el editor de la boda.
//   2. La pareja entra sin contraseña, importa un Excel de 150 invitados (52 grupos) y cambia datos.
//   3. Los invitados abren su enlace personal y confirman (en el navegador y por la API).
//   4. La pareja ve los totales, los pendientes, imprime los QR y descarga el Excel del catering.
// Al final borra todo lo que ha creado.
//   node tests/e2e/pareja.mjs [--capturas]
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, SITE, playwright, supabase } from "./_util.mjs";

const db = supabase();
const SHOTS = process.argv.includes("--capturas") ? join(ROOT, "tests/e2e/capturas/pareja") : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true }); };
const stamp = Date.now().toString(36);
const SLUG = `e2e-pareja-${stamp}`;
const EMAIL = `pareja.${stamp}@example.com`;
let steps = 0;
const ok = (m) => { steps++; console.log(`✓ ${m}`); };
const csvRows = (text) => text.replace(/^﻿/, "").trim().split(/\r?\n/).map((l) => l.split(";"));

const cfg = JSON.parse(readFileSync(join(ROOT, "plantillas/editorial/config.json"), "utf8"));
cfg.theme = "editorial";
cfg.event.couple = ["Olga", "Teo"];
const d = new Date(); d.setMonth(d.getMonth() + 8);
cfg.event.date = `${d.toISOString().slice(0, 10)}T18:00:00+02:00`;
cfg.event.end = `${d.toISOString().slice(0, 10)}T23:59:00+02:00`;
d.setMonth(d.getMonth() - 1);
cfg.rsvp.deadline = d.toISOString().slice(0, 10);

const { chromium } = await playwright();
const browser = await chromium.launch();
let weddingId = null;
let code = 0;
try {
  const [w] = await db.insert("weddings", { slug: SLUG, template: "editorial", config: cfg, features: { rsvp_ampliado: true }, notes: "prueba automática" });
  weddingId = w.id;
  await db.rpc("publish_wedding", { p_wedding_id: w.id });

  // ── 1. Luis da acceso y genera el enlace ──
  const luis = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "es-ES", timezoneId: "Europe/Madrid" });
  const lp = await luis.newPage();
  await lp.goto(`${SITE}/panel/`);
  await lp.fill("#l-email", "luis@example.com");
  await lp.fill("#l-pass", "demo-luis-1234");
  await lp.click("button[type=submit]");
  await lp.waitForSelector(".greeting");
  await lp.goto(`${SITE}/panel/#/bodas/${w.id}`);
  await lp.locator("summary", { hasText: "Pareja y acceso" }).click();
  await lp.fill("[data-couple-email]", EMAIL);
  await lp.fill("[data-couple-name]", "Olga");
  await lp.click("[data-add-couple]");
  await lp.getByText("Acceso dado.").waitFor();
  await lp.locator("summary", { hasText: "Pareja y acceso" }).click();
  await lp.getByRole("button", { name: "Enlace de acceso" }).click();
  const link = await lp.locator("dialog[open] input[readonly]").inputValue();
  if (!link.includes("/pareja/#acceso=")) throw new Error(`Enlace raro: ${link}`);
  await luis.close();
  ok("Luis da acceso a la pareja y genera su enlace para mandarlo por WhatsApp");

  // ── 2. La pareja entra e importa 150 invitados ──
  const pareja = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "es-ES", timezoneId: "Europe/Madrid", acceptDownloads: true });
  const pp = await pareja.newPage();
  const errors = [];
  pp.on("pageerror", (e) => errors.push(e.message));
  await pp.goto(link);
  await pp.getByRole("heading", { name: /Olga & Teo/ }).waitFor();
  ok("La pareja entra sin contraseña con el enlace");
  // Un enlace gastado no vale dos veces.
  const other = await browser.newContext();
  const op = await other.newPage();
  await op.goto(link);
  await op.getByText("Este enlace ya se ha usado o ha caducado").waitFor();
  await other.close();
  ok("El enlace solo sirve una vez");

  await pp.goto(`${SITE}/pareja/#/invitados`);
  await pp.getByText("Dos formas de empezar").waitFor();
  await pp.setInputFiles("[data-import]", join(ROOT, "tests/fixtures/invitados-150.xlsx"));
  await pp.getByText("hay 52 grupos").waitFor();
  await shot(pp, "1-importar");
  await pp.locator("dialog[open]").getByRole("button", { name: "Importar 52 grupos" }).click();
  await pp.getByText("Importados 52 grupos con 150 personas.").waitFor();
  const groups = await db.select(`guest_groups?wedding_id=eq.${w.id}&select=id,name,token,seats,guests(id,is_child)&order=sort`);
  const guestCount = groups.reduce((n, g) => n + g.guests.length, 0);
  if (groups.length !== 52 || guestCount !== 150) throw new Error(`Importados ${groups.length} grupos y ${guestCount} personas`);
  await pp.getByText("150 personas en 52 grupos.").waitFor();
  await shot(pp, "2-lista");
  ok("Importa un Excel de 150 invitados en 52 grupos, cada uno con su enlace personal");

  // Cambia datos prácticos: autobús y horario.
  await pp.goto(`${SITE}/pareja/#/datos`);
  await pp.check("input[name=bus]");
  await pp.locator("[data-schedule] [data-k=label]").first().fill("Ceremonia civil");
  await pp.getByRole("button", { name: "Guardar y publicar" }).click();
  await pp.getByText("Guardado y publicado").waitFor();
  const [pub] = await db.select(`weddings?id=eq.${w.id}&select=published_version_id`);
  const [ver] = await db.select(`wedding_versions?id=eq.${pub.published_version_id}&select=config,version`);
  if (ver.config.rsvp.bus !== true || ver.config.schedule[0].label !== "Ceremonia civil") throw new Error("El cambio no se ha publicado");
  ok(`La pareja cambia el horario y activa la pregunta del autobús: publicado (versión ${ver.version})`);

  // ── 3. Los invitados confirman ──
  const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "es-ES", timezoneId: "Europe/Madrid" });
  const browserGroups = groups.filter((g) => g.guests.length >= 2).slice(0, 6);
  for (const [i, g] of browserGroups.entries()) {
    const gp = await guestCtx.newPage();
    await gp.goto(`${SITE}/b/${SLUG}?i=${g.token}`, { waitUntil: "networkidle" });
    await gp.evaluate(() => document.getElementById("rsvp-dialog").showModal());
    await gp.getByText(`Hola, ${g.name}.`).waitFor();
    const yesButtons = gp.locator(".rsvp-guest .choice label", { hasText: /^Viene$/ });
    const noButtons = gp.locator(".rsvp-guest .choice label", { hasText: "No viene" });
    const n = await yesButtons.count();
    for (let k = 0; k < n; k++) await (i === 0 && k === n - 1 ? noButtons.nth(k) : yesButtons.nth(k)).click();
    await gp.fill("#rsvp-dietary", i === 1 ? "Sin gluten" : "");
    await gp.locator("label", { hasText: /^Sí$/ }).click();
    if (i === 0) await shot(gp, "3-invitado");
    await gp.click("#rsvp-submit");
    await gp.waitForSelector("#rsvp-thanks:not([hidden])");
    await gp.close();
  }
  ok(`${browserGroups.length} grupos confirman desde su enlace personal, uno a uno, con alergias y autobús`);

  // El resto por la API (otros móviles): 30 grupos más, mitad sí y mitad no.
  const apiGroups = groups.filter((g) => !browserGroups.includes(g)).slice(0, 30);
  for (const [i, g] of apiGroups.entries()) {
    const yes = i % 2 === 0;
    const r = await fetch(`${SITE}/api/rsvp?w=${SLUG}`, {
      method: "POST", headers: { "Content-Type": "text/plain", "X-Forwarded-For": `203.0.113.${i + 1}` },
      body: JSON.stringify({ invite: g.token, attending: yes ? "si" : "no", bus: "no", guests: g.guests.map((p) => ({ id: p.id, attending: yes })) }),
    });
    if (!(await r.json()).ok) throw new Error(`Respuesta de ${g.name} rechazada`);
  }
  await guestCtx.close();
  const expectedPeople = (await db.select(`rsvp_current?wedding_id=eq.${w.id}&select=adults,children,attending`)).reduce((n, r) => n + (r.attending ? r.adults + r.children : 0), 0);
  ok(`Y 30 grupos más desde otros móviles: ${expectedPeople} personas confirmadas`);

  // ── 4. La pareja lo ve todo y exporta ──
  await pp.goto(`${SITE}/pareja/#/`);
  await pp.locator(".headcount__big", { hasText: String(expectedPeople) }).waitFor();
  await shot(pp, "4-inicio");
  await pp.goto(`${SITE}/pareja/#/respuestas?ver=pendientes`);
  await pp.getByText(`Sin contestar (${52 - 36})`).waitFor();
  await shot(pp, "5-pendientes");
  ok(`El inicio cuenta ${expectedPeople} personas y «Sin contestar» lista los ${52 - 36} grupos que faltan, con su recordatorio por WhatsApp`);

  await pp.goto(`${SITE}/pareja/#/respuestas`);
  const [download] = await Promise.all([pp.waitForEvent("download"), pp.getByRole("button", { name: "Excel para el catering" }).click()]);
  const catering = csvRows(readFileSync(await download.path(), "utf8"));
  const header = catering.shift();
  if (header.join("|") !== "Grupo|Nombre|Adulto o niño|Alergias (de la persona)|Alergias (del grupo)|Autobús") throw new Error(`Cabecera: ${header}`);
  if (catering.length !== expectedPeople) throw new Error(`El Excel del catering tiene ${catering.length} personas y vienen ${expectedPeople}`);
  if (!catering.some((r) => r[4] === "Sin gluten")) throw new Error("Falta la alergia en el Excel del catering");
  ok(`Excel para el catering: una fila por persona que viene (${catering.length}), con niños, alergias y autobús`);

  await pp.goto(`${SITE}/pareja/#/imprimir?solo=pendientes`);
  await pp.locator(".qr-card svg").first().waitFor();
  const cards = await pp.locator(".qr-card svg").count();
  if (cards !== 16) throw new Error(`Tarjetas QR: ${cards}`);
  await shot(pp, "6-qr");
  ok("Hoja de códigos QR para imprimir (solo los que faltan: 16)");

  // Seguridad: con su sesión no puede ver otra boda.
  await pp.goto(`${SITE}/pareja/?boda=b0000000-0000-4000-8000-000000000002#/`);
  await pp.getByText("No encontramos vuestra boda").waitFor();
  ok("Con su sesión no puede abrir el panel de otra boda");
  if (errors.length) throw new Error(`Errores en el panel de la pareja: ${errors.join("; ")}`);
  await pareja.close();
  console.log(`\n✓ Fase 3 correcta (${steps} pasos).`);
} catch (e) {
  code = 1;
  console.error(`\n✗ ${e.message.split("\n").slice(0, 3).join(" ")}`);
} finally {
  await browser.close();
  if (weddingId) await db.remove(`weddings?id=eq.${weddingId}`).catch(() => {});
  await db.remove(`couple_users?email=eq.${EMAIL}`).catch(() => {});
}
process.exit(code);
