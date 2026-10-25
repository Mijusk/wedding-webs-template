#!/usr/bin/env node
// Valida los config.json de ejemplo de las 25 maquetaciones (y cualquier otro que se pase)
// contra schema/wedding-config.schema.json.
//   node scripts/validar-configs.mjs                 -> todas las plantillas
//   node scripts/validar-configs.mjs ruta/config.json -> solo ese archivo
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validate, describe } from "../lib/config-schema.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schema = JSON.parse(readFileSync(join(root, "schema/wedding-config.schema.json"), "utf8"));

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["config.json", ...readdirSync(join(root, "plantillas")).sort().map((t) => `plantillas/${t}/config.json`)]
      .map((f) => join(root, f)).filter(existsSync);

let bad = 0;
for (const file of files) {
  let config;
  try { config = JSON.parse(readFileSync(file, "utf8")); }
  catch (e) { console.log(`✗ ${file}: no es JSON válido (${e.message})`); bad++; continue; }
  const errors = validate(schema, config);
  if (errors.length) {
    bad++;
    console.log(`✗ ${file.replace(root + "/", "")}\n${describe(errors).replace(/^/gm, "    ")}`);
  } else {
    console.log(`✓ ${file.replace(root + "/", "")}`);
  }
}
console.log(bad ? `\n${bad} config(s) con errores` : `\nLos ${files.length} configs cumplen el esquema.`);
process.exit(bad ? 1 : 0);
