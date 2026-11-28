// Tipos de estilo para filtrar (studio.json > categories, app/filters.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const studio = JSON.parse(readFileSync(join(ROOT, "studio/studio.json"), "utf8"));
const ids = new Set(studio.styles.map((s) => s.id));
// Estilos de PR todavía sin publicar que ya tienen su tipo: «Del día a la noche» y «La mesa».
const PENDING = new Set(["jornada", "mesa"]);

test("cada tipo tiene id, nombre y estilos que existen", () => {
  assert.ok(studio.categories.length >= 4);
  assert.equal(new Set(studio.categories.map((c) => c.id)).size, studio.categories.length, "ids de tipo repetidos");
  for (const c of studio.categories) {
    assert.match(c.id, /^[a-z]+$/, c.id);
    assert.ok(c.name?.trim(), `${c.id} sin nombre`);
    assert.equal(new Set(c.styles).size, c.styles.length, `${c.id}: estilos repetidos`);
    for (const id of c.styles) assert.ok(ids.has(id) || PENDING.has(id), `${c.id}: no existe el estilo «${id}»`);
    assert.ok(c.styles.filter((id) => ids.has(id)).length >= 3, `${c.id}: pocos estilos para un filtro`);
  }
});

test("todos los estilos disponibles tienen al menos un tipo", () => {
  const tagged = new Set(studio.categories.flatMap((c) => c.styles));
  const missing = studio.styles.filter((s) => s.status === "available" && !tagged.has(s.id)).map((s) => s.id);
  assert.deepEqual(missing, [], `sin tipo: ${missing.join(", ")} (añadidlos en studio.json > categories)`);
});
