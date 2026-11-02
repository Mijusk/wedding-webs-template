#!/usr/bin/env node
// Comprueba que las 25 maquetaciones se ven igual servidas desde la base de datos (/b/<slug>)
// que desde su carpeta (/plantillas/<x>/ con su config.json). Hace una captura de cada una
// en móvil, compara píxel a píxel y revisa que no haya errores ni archivos que no carguen.
//
// Necesita: base de datos con migraciones (supabase start), servidor local (npm run dev) y Playwright.
//   node tests/e2e/plantillas.mjs
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, SITE, playwright, supabase, optionalModule } from "./_util.mjs";

const db = supabase();
const OUT = join(ROOT, "tests/e2e/capturas/plantillas");
mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);
const templates = ["clasica", ...readdirSync(join(ROOT, "plantillas")).sort()].filter((t) => !only.length || only.includes(t));
const urlOf = (t) => (t === "clasica" ? "/index.html" : `/plantillas/${t}/`);
const configOf = (t) => JSON.parse(readFileSync(join(ROOT, t === "clasica" ? "config.json" : `plantillas/${t}/config.json`), "utf8"));

// Las bodas de prueba usan el config de ejemplo de cada plantilla, tal cual.
const created = [];
for (const t of templates) {
  const slug = `prueba-plantilla-${t}`;
  await db.remove(`weddings?slug=eq.${slug}`);
  const [w] = await db.insert("weddings", { slug, template: t, config: configOf(t), notes: "prueba automática" });
  await db.rpc("publish_wedding", { p_wedding_id: w.id });
  created.push(w.id);
}

const { chromium } = await playwright();
const sharp = optionalModule("sharp");
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: "reduce", locale: "es-ES", timezoneId: "Europe/Madrid" });
// Misma hora en las dos cargas: la cuenta atrás y el tono de la página dependen del reloj.
await ctx.addInitScript(() => {
  const fixed = new Date("2026-10-24T12:00:00+02:00").getTime();
  const RealDate = Date;
  globalThis.Date = class extends RealDate {
    constructor(...a) { super(...(a.length ? a : [fixed])); }
    static now() { return fixed; }
  };
  Math.random = () => 0.42;
});

let fails = 0;
const rows = [];
for (const t of templates) {
  const shots = [];
  const problems = [];
  for (const path of [urlOf(t), `/b/prueba-plantilla-${t}`]) {
    const page = await ctx.newPage();
    page.on("pageerror", (e) => problems.push(`${path}: error JS: ${e.message}`));
    page.on("response", (r) => { if (r.status() >= 400 && !r.url().endsWith("favicon.ico")) problems.push(`${path}: ${r.status()} ${r.url()}`); });
    await page.goto(SITE + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(3500); // entradas animadas (sobre de Lacre, carta que se escribe...)
    await page.evaluate(() => document.fonts.ready);
    const text = await page.evaluate(() => document.querySelector("#app, main")?.innerText || document.body.innerText);
    const png = await page.screenshot({ fullPage: false });
    shots.push({ text, png });
    await page.close();
  }
  writeFileSync(join(OUT, `${t}-carpeta.png`), shots[0].png);
  writeFileSync(join(OUT, `${t}-bd.png`), shots[1].png);
  const sameText = shots[0].text.trim() === shots[1].text.trim();
  let diff = null;
  if (sharp) {
    const [a, b] = await Promise.all(shots.map((s) => sharp(s.png).raw().toBuffer()));
    let different = 0;
    for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) different++;
    diff = (different / (a.length / 3)) * 100;
  }
  // Un fallo que también tiene la plantilla en su carpeta no lo causa la base de datos: se avisa aparte.
  const folder = problems.filter((p) => p.startsWith(urlOf(t) + ":")).map((p) => p.slice(p.indexOf(":") + 1));
  const onlyDb = problems.filter((p) => p.startsWith("/b/") && !folder.includes(p.slice(p.indexOf(":") + 1)));
  const ok = sameText && !onlyDb.length && (diff === null || diff < 0.5);
  if (!ok) fails++;
  rows.push(`${ok ? "✓" : "✗"} ${t.padEnd(10)} texto ${sameText ? "igual" : "DISTINTO"} · píxeles distintos ${diff === null ? "?" : diff.toFixed(2) + " %"}`
    + (onlyDb.length ? "\n    " + onlyDb.join("\n    ") : "")
    + (folder.length ? `\n    ⚠ también falla en su carpeta (no es de la base de datos):${folder.join(";")}` : ""));
}
await browser.close();
for (const id of created) await db.remove(`weddings?id=eq.${id}`);
console.log(rows.join("\n"));
console.log(fails ? `\n✗ ${fails} plantilla(s) distintas` : `\n✓ Las ${templates.length} maquetaciones se ven igual desde la base de datos. Capturas en tests/e2e/capturas/plantillas/`);
process.exit(fails ? 1 : 0);

