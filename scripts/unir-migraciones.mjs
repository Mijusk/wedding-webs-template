#!/usr/bin/env node
// Junta todas las migraciones en supabase/instalar.sql: un solo archivo para pegar en el
// editor SQL de Supabase (sin terminal). Vuelve a ejecutarlo si cambias una migración.
//   node scripts/unir-migraciones.mjs           -> escribe el archivo
//   node scripts/unir-migraciones.mjs --comprobar -> falla si no está al día (lo usan las pruebas)
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(ROOT, "supabase/migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const out = [
  "-- WeddingWebs: instalación completa de la base de datos en un proyecto de Supabase NUEVO.",
  "-- Generado por scripts/unir-migraciones.mjs a partir de supabase/migrations: no lo edites a mano.",
  "-- Cómo usarlo: Supabase > SQL Editor > New query > pega todo este archivo > Run. Ver docs/SUPABASE.md.",
  "",
  ...files.map((f) => `-- ════════════════ ${f} ════════════════\n\n${readFileSync(join(dir, f), "utf8").trim()}\n`),
].join("\n");
const target = join(ROOT, "supabase/instalar.sql");
if (process.argv.includes("--comprobar")) {
  if (!existsSync(target) || readFileSync(target, "utf8") !== out) {
    console.error("supabase/instalar.sql no está al día: ejecuta node scripts/unir-migraciones.mjs");
    process.exit(1);
  }
  console.log("supabase/instalar.sql está al día.");
} else {
  writeFileSync(target, out);
  console.log(`supabase/instalar.sql: ${files.length} migraciones.`);
}
