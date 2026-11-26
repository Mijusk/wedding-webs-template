// «Textos de la web» del editor (panel/js/textos.js) con los configs de las 45 plantillas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { textGroups, setText, labelFor, plain } from "../../panel/js/textos.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const configs = ["config.json", ...readdirSync(join(ROOT, "plantillas")).map((d) => join("plantillas", d, "config.json"))]
  .filter((f) => existsSync(join(ROOT, f)))
  .map((f) => [f, JSON.parse(readFileSync(join(ROOT, f), "utf8"))]);

const get = (o, path) => path.split(".").reduce((a, k) => a?.[k], o);
const strings = (o) => (typeof o === "string" ? 1 : o && typeof o === "object" ? Object.values(o).reduce((n, v) => n + strings(v), 0) : 0);

test("todas las plantillas: cada texto sale una vez, con nombre y en su sitio", () => {
  assert.ok(configs.length >= 45, `solo ${configs.length} configs`);
  for (const [file, c] of configs) {
    const fields = textGroups(c).flatMap((g) => g.fields);
    assert.equal(fields.length, strings(c.copy) + strings(c.copy_en), file);
    assert.equal(new Set(fields.map((f) => f.path)).size, fields.length, `${file}: rutas repetidas`);
    for (const f of fields) {
      assert.equal(get(c, f.path), f.value, `${file}: ${f.path}`);
      assert.ok(f.label && !f.label.includes("undefined"), `${file}: ${f.path} sin nombre`);
    }
  }
});

test("las secciones ocultas van al final y se marcan", () => {
  const c = { sections: ["hero", "rsvp"], copy: { gifts: { title: "Regalo" }, hero: { title: "Hola" }, rsvp: { submit: "Enviar" }, lang: { en: "EN" } } };
  const groups = textGroups(c, { hero: { name: "Portada" }, rsvp: { name: "Confirmación" }, gifts: { name: "Regalo" } });
  assert.deepEqual(groups.map((g) => [g.name, g.hidden]), [["Portada", false], ["Confirmación", false], ["Idioma", false], ["Regalo", true]]);
});

test("nombres en castellano, también en listas y textos anidados", () => {
  assert.equal(labelFor(["thanksYesTitle"]), "Gracias si vienen: título");
  assert.equal(labelFor(["labels", "1"]), "Etiqueta 2");
  assert.equal(labelFor(["notes", "cena", "title"]), "Nota › cena › Título");
  assert.equal(labelFor(["photoCaption"]), "Texto «photo caption»");
});

test("cambiar un texto: aunque quede vacío no se borra, y no inventa campos", () => {
  const c = { copy: { rsvp: { submit: "Enviar", list: ["a", "b"] } } };
  assert.ok(setText(c, "copy.rsvp.submit", ""));
  assert.equal(c.copy.rsvp.submit, "");
  assert.ok(setText(c, "copy.rsvp.list.1", "B"));
  assert.deepEqual(c.copy.rsvp.list, ["a", "B"]);
  assert.equal(setText(c, "copy.rsvp.nuevo", "x"), false);
  assert.equal(setText(c, "copy.otra.title", "x"), false);
  assert.equal(c.copy.otra, undefined);
});

test("el buscador no distingue tildes ni mayúsculas", () => {
  assert.equal(plain("Confirmación de ASISTENCIA"), "confirmacion de asistencia");
});
