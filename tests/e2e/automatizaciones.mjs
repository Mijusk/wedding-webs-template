#!/usr/bin/env node
// Fase 5 en navegador: Luis activa y edita una automatización, ve la vista previa, la retención pide
// confirmación y «Revisar ahora» funciona. Y el enlace del email de bienvenida abre la web que probaron.
//   node tests/e2e/automatizaciones.mjs [--capturas]
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, SITE, playwright, supabase } from "./_util.mjs";

const db = supabase();
const SHOTS = process.argv.includes("--capturas") ? join(ROOT, "tests/e2e/capturas/automatizaciones") : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true }); };
let steps = 0;
const ok = (m) => { steps++; console.log(`✓ ${m}`); };

const saved = await db.select("automations?select=code,enabled,subject,body");
await db.remove("rate_limits?key=like.*");
const { chromium } = await playwright();
const browser = await chromium.launch();
let code = 0;
try {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "es-ES", timezoneId: "Europe/Madrid" });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`${SITE}/panel/`);
  await p.fill("#l-email", "luis@example.com");
  await p.fill("#l-pass", "demo-luis-1234");
  await p.click("button[type=submit]");
  await p.waitForSelector(".greeting");
  await p.locator('a[data-nav="/automatizaciones"]').click();
  await p.getByRole("heading", { name: "Automatizaciones" }).waitFor();

  const card = p.locator(".auto", { hasText: "Primer recordatorio al lead" });
  await card.locator("[data-toggle]").check();
  await p.locator(".auto", { hasText: "Primer recordatorio al lead" }).getByText("Activa", { exact: true }).waitFor();
  let [a] = await db.select("automations?code=eq.lead_recordatorio_1&select=enabled,enabled_at");
  if (!a.enabled || !a.enabled_at) throw new Error("No se ha activado");
  ok("Activar una automatización (queda apuntado desde cuándo)");

  const c2 = p.locator(".auto", { hasText: "Primer recordatorio al lead" });
  await c2.locator("summary").click();
  await c2.locator("input[name=subject]").fill("¿Os ayudamos, ");
  await c2.locator("input[name=subject]").press("End");
  await c2.locator("textarea[name=body]").focus();
  await c2.locator("textarea[name=body]").press("Control+End");
  await c2.locator("[data-insert='{estilo}']").click();
  await c2.locator("input[name=subject]").fill("¿Os ayudamos, {nombres}? {foo}");
  await c2.getByRole("button", { name: "Guardar" }).click();
  await p.getByText("Este texto no puede usar {foo}").waitFor();
  await c2.locator("input[name=subject]").fill("¿Os ayudamos, {nombres}?");
  await c2.getByRole("button", { name: "Guardar" }).click();
  await p.getByText("Guardado.").waitFor();
  [a] = await db.select("automations?code=eq.lead_recordatorio_1&select=subject,body");
  if (a.subject !== "¿Os ayudamos, {nombres}?" || !a.body.endsWith("{estilo}")) throw new Error(`Texto guardado: ${JSON.stringify(a)}`);
  ok("Editar asunto y texto, con huecos; un hueco que no existe no se guarda");

  const c3 = p.locator(".auto", { hasText: "Primer recordatorio al lead" });
  await c3.locator("summary").click();
  await c3.getByRole("button", { name: "Vista previa" }).click();
  await p.locator("dialog[open]").getByText("¿Os ayudamos, Lucía y Martín?").waitFor();
  const frameText = await p.frameLocator("dialog[open] iframe").locator("body").textContent();
  if (!frameText.includes("Editorial") || !frameText.includes("daos de baja")) throw new Error(`Vista previa: ${frameText.slice(0, 200)}`);
  await shot(p, "1-vista-previa");
  await p.locator("dialog[open]").getByRole("button", { name: "Cerrar" }).click();
  ok("Vista previa con datos de ejemplo y enlace de baja");

  const del = p.locator(".auto", { hasText: "Borrar los datos de invitados" });
  await del.locator("[data-toggle]").click();
  await p.locator("dialog[open]").getByText("Borra datos de verdad").waitFor();
  await p.locator("dialog[open]").getByRole("button", { name: "Cancelar" }).click();
  [a] = await db.select("automations?code=eq.borrar_invitados&select=enabled");
  if (a.enabled) throw new Error("Se ha activado sin confirmar");
  ok("Las de borrar datos piden confirmación (y al cancelar siguen apagadas)");

  await p.getByRole("button", { name: "Revisar ahora" }).click();
  await p.getByText(/^Hecho: \d+ enviados/).waitFor();
  await shot(p, "2-automatizaciones");
  ok("«Revisar ahora» lanza lo que toca y lo resume");

  // El enlace del email de bienvenida abre su web.
  const [lead] = await db.select("leads?partner_a=not.is.null&wedding_date=not.is.null&anonymized_at=is.null&select=preview_token,partner_a,partner_b&limit=1");
  const sp = await ctx.newPage();
  sp.on("pageerror", (e) => errors.push(e.message));
  await sp.goto(`${SITE}/studio/?prueba=${lead.preview_token}`);
  await sp.locator("#stage").waitFor({ state: "visible" });
  const title = await sp.locator("#stage-title").textContent();
  if (title !== `${lead.partner_a} & ${lead.partner_b}`) throw new Error(`Título: ${title}`);
  if (sp.url().includes("prueba=")) throw new Error("La clave se queda en la barra de direcciones");
  await shot(sp, "3-web-guardada");
  ok(`El enlace del email abre la web que probaron (${title})`);

  if (errors.length) throw new Error(`Errores en la página: ${errors.join("; ")}`);
  console.log(`\n✓ Fase 5 correcta (${steps} pasos).`);
} catch (e) {
  code = 1;
  console.error(`\n✗ ${e.message.split("\n").slice(0, 3).join(" ")}`);
} finally {
  await browser.close();
  for (const a of saved) await db.update(`automations?code=eq.${a.code}`, { enabled: a.enabled, subject: a.subject, body: a.body }).catch(() => {});
}
process.exit(code);
