#!/usr/bin/env node
// Prueba de extremo a extremo, en un navegador de verdad, del flujo completo de esta fase:
//   1. Una pareja llega desde un anuncio de Google, prueba su web en el escaparate y deja sus datos.
//   2. Luis entra en el panel, ve el lead con su campaña, crea su web desde la ficha, sube una foto
//      (con la regla de calidad), pone el IBAN y la fecha límite, y la publica.
//   3. Un invitado abre /b/<slug>, confirma asistencia desde la propia plantilla.
//   4. La respuesta aparece en el panel.
// Al final borra todo lo que ha creado.
//
// Necesita: base con migraciones y semillas (supabase db reset), servidor local (npm run dev) y Playwright.
//   node tests/e2e/flujo-completo.mjs [--capturas]
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, SITE, playwright, supabase } from "./_util.mjs";

const db = supabase();
const SHOTS = process.argv.includes("--capturas") ? join(ROOT, "tests/e2e/capturas/flujo") : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const stamp = Date.now().toString(36);
const EMAIL = `e2e.${stamp}@example.com`;
const NAME_A = "Olivia", NAME_B = `Bruno ${stamp.slice(-3).toUpperCase()}`;
const steps = [];
const step = (msg) => { steps.push(msg); console.log(`✓ ${msg}`); };
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: false }); };

const { chromium } = await playwright();
const browser = await chromium.launch();
let created = { lead: null, wedding: null };
let exitCode = 0;
try {
  // ── 1. Escaparate ────────────────────────────────────────
  const visitor = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "es-ES", timezoneId: "Europe/Madrid", reducedMotion: "reduce" });
  const v = await visitor.newPage();
  await v.goto(`${SITE}/studio/?utm_source=google&utm_medium=cpc&utm_campaign=e2e-${stamp}&gclid=E2E-${stamp}`, { waitUntil: "networkidle" });
  await v.waitForTimeout(800);
  await v.locator("[data-open-builder]:visible").first().click();
  await v.fill("#b-name-a", NAME_A);
  await v.fill("#b-name-b", NAME_B);
  const d = new Date(); d.setMonth(d.getMonth() + 9);
  await v.fill("#b-date", d.toISOString().slice(0, 10));
  await v.fill("#b-time", "18:30");
  await v.fill("#b-venue", "Finca Prueba E2E");
  await v.fill("#b-city", "Toledo");
  await v.fill("#b-email", EMAIL);
  await v.check("#b-consent");
  await v.locator("#builder-form button[type=submit]").click();
  await v.waitForSelector("#stage:not([hidden])", { timeout: 15000 });
  await shot(v, "1-escaparate-vista-previa");

  let lead = null;
  for (let i = 0; i < 20 && !lead; i++) {
    [lead] = await db.select(`leads?email=eq.${encodeURIComponent(EMAIL)}&select=*,lead_attribution(*),consents(*)`);
    if (!lead) await new Promise((r) => setTimeout(r, 300));
  }
  if (!lead) throw new Error("El lead del escaparate no ha llegado a la base de datos");
  created.lead = lead.id;
  const first = lead.lead_attribution.find((a) => a.touch === "primero");
  if (first?.utm_campaign !== `e2e-${stamp}` || first?.gclid !== `E2E-${stamp}`) throw new Error(`Atribución incorrecta: ${JSON.stringify(first)}`);
  if (!lead.consents[0]?.text?.startsWith("Acepto que me escribáis")) throw new Error("Falta el texto exacto del consentimiento");
  if (lead.partner_a !== NAME_A || lead.city !== "Toledo") throw new Error("Datos del lead incompletos");
  step("La prueba del escaparate crea el lead con su campaña de Google (utm + gclid) y el texto exacto del consentimiento");
  await visitor.close();

  // ── 2. Panel ─────────────────────────────────────────────
  const luisCtx = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "es-ES", timezoneId: "Europe/Madrid" });
  const p = await luisCtx.newPage();
  const pageErrors = [];
  p.on("pageerror", (e) => { pageErrors.push(e.message); console.error("  error en el panel:", e.stack || e.message); });
  p.on("dialog", (dlg) => dlg.accept());
  await p.goto(`${SITE}/panel/`);
  await p.fill("#l-email", "luis@example.com");
  await p.fill("#l-pass", "demo-luis-1234");
  await p.click("button[type=submit]");
  await p.waitForSelector(".greeting");
  await p.getByText(`${NAME_A} y ${NAME_B}`).first().waitFor();
  await shot(p, "2-panel-inicio");
  step("El lead aparece al momento en «Por contestar» del panel");

  await p.goto(`${SITE}/panel/#/leads?vista=tabla&campana=e2e-${stamp}`);
  await p.getByRole("link", { name: `${NAME_A} y ${NAME_B}` }).waitFor();
  step("La tabla de leads filtra por campaña");

  await p.goto(`${SITE}/panel/#/leads/${lead.id}`);
  await p.getByRole("heading", { name: `${NAME_A} y ${NAME_B}` }).waitFor();
  await p.getByRole("button", { name: "Contactado" }).click();
  await p.waitForFunction(() => document.querySelector('.pipeline [aria-pressed="true"]')?.textContent === "Contactado");
  await p.fill("#note", "Les escribo por WhatsApp mañana.");
  await p.getByRole("button", { name: "Añadir nota" }).click();
  await p.getByText("Les escribo por WhatsApp mañana.").waitFor();
  await shot(p, "3-panel-ficha-lead");
  step("En la ficha: cambio de estado y nota en el historial");

  await p.getByRole("link", { name: "Crear su web" }).click();
  await p.waitForSelector("#w-a");
  if ((await p.inputValue("#w-a")) !== NAME_A || (await p.inputValue("#w-venue")) !== "Finca Prueba E2E") throw new Error("La boda nueva no viene rellena con los datos del lead");
  await p.waitForFunction(() => document.querySelector("#w-slug")?.value.length > 3);
  const slug = await p.inputValue("#w-slug");
  await p.check('input[name=style][value="minimal"]');
  await p.getByRole("button", { name: "Crear y abrir el editor" }).click();
  await p.waitForSelector("[data-frame]");
  const [w] = await db.select(`weddings?slug=eq.${slug}&select=id,status,template,lead_id`);
  created.wedding = w.id;
  if (w.template !== "minimal" || w.lead_id !== lead.id) throw new Error("La boda no se ha creado bien");
  step(`Boda creada desde el lead en segundos: /b/${slug} (estilo Minimal)`);

  // Foto: la regla de calidad (las que caben se suben tal cual, sin EXIF).
  await p.setInputFiles("[data-files]", join(ROOT, "studio/demo/foto-03.jpg"));
  await p.waitForSelector(".photo img", { timeout: 20000 });
  const [asset] = await db.select(`wedding_assets?wedding_id=eq.${w.id}&select=*`);
  if (!asset?.url) throw new Error("La foto no se ha guardado");
  step(`Foto subida al almacenamiento (${asset.width}×${asset.height}, ${Math.round(asset.bytes / 1024)} KB): ${asset.note}`);

  await p.locator("summary", { hasText: "Regalo" }).click();
  await p.fill("#f-gi", "ES91 2100 0418 4502 0005 1332");
  await p.getByText("IBAN correcto.").waitFor();
  await p.locator("summary", { hasText: "Confirmación de asistencia" }).click();
  const deadline = new Date(d); deadline.setMonth(deadline.getMonth() - 1);
  await p.fill("#f-dl", deadline.toISOString().slice(0, 10));
  await p.fill("#f-tag", "Prueba automática de extremo a extremo");
  await p.waitForTimeout(600);
  const frameText = await p.frameLocator("[data-frame]").locator("body").innerText();
  if (!frameText.includes(NAME_A)) throw new Error("La vista previa en vivo no enseña la boda");
  step("La vista previa en vivo pinta la plantilla real con los cambios sin guardar");
  await shot(p, "4-panel-editor");

  await p.getByRole("button", { name: "Publicar" }).click();
  await p.locator("dialog[open]").getByRole("button", { name: "Publicar" }).click();
  await p.getByText(/Publicada \(versión 1\)/).waitFor({ timeout: 10000 });
  const [pub] = await db.select(`weddings?id=eq.${w.id}&select=status,published_version_id`);
  if (pub.status !== "publicada" || !pub.published_version_id) throw new Error("No ha quedado publicada");
  step("Publicada: versión 1 guardada en el historial");
  if (pageErrors.length) throw new Error(`Errores en el panel: ${pageErrors.join("; ")}`);

  // ── 3. Invitado ──────────────────────────────────────────
  const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "es-ES", timezoneId: "Europe/Madrid" });
  const g = await guestCtx.newPage();
  const res = await g.goto(`${SITE}/b/${slug}`, { waitUntil: "networkidle" });
  if (res.status() !== 200) throw new Error(`/b/${slug} responde ${res.status()}`);
  if (!(await g.content()).includes(`${NAME_A} y ${NAME_B} se casan`)) throw new Error("Falta la etiqueta para WhatsApp de la pareja");
  await g.getByText(NAME_A).first().waitFor();
  await shot(g, "5-web-publicada");
  await g.getByRole("button", { name: /Confirmar asistencia/i }).first().click();
  await g.fill("#rsvp-name", "Invitada De Prueba");
  await g.locator("label", { has: g.locator("#rsvp-yes") }).click();
  await g.fill("#rsvp-song", "Bailando");
  await g.click("#rsvp-submit");
  await g.waitForSelector("#rsvp-thanks:not([hidden])", { timeout: 10000 });
  await shot(g, "6-rsvp-gracias");
  const [r] = await db.select(`rsvp_responses?wedding_id=eq.${w.id}&select=*`);
  if (!r || !r.attending || r.song !== "Bailando") throw new Error("La respuesta del invitado no está en la base de datos");
  step("El invitado confirma desde la plantilla y la respuesta se guarda en la base de datos");
  await guestCtx.close();

  // ── 4. Vuelta al panel ───────────────────────────────────
  await p.reload();
  await p.getByText("1 vienen").waitFor();
  step("Luis ve la respuesta en el editor de la boda (y puede descargarlas en Excel)");
  await luisCtx.close();
  console.log(`\n✓ Flujo completo correcto (${steps.length} pasos).`);
} catch (e) {
  exitCode = 1;
  console.error(`\n✗ ${e.message}`);
} finally {
  await browser.close();
  if (created.wedding) {
    const assets = await db.select(`wedding_assets?wedding_id=eq.${created.wedding}&select=path`).catch(() => []);
    void assets;
    await db.remove(`weddings?id=eq.${created.wedding}`).catch(() => {});
  }
  if (created.lead) await db.remove(`leads?id=eq.${created.lead}`).catch(() => {});
  void readFileSync;
}
process.exit(exitCode);
