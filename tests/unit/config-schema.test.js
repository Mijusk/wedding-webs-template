import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validate } from "../../lib/config-schema.js";

const schema = JSON.parse(readFileSync(new URL("../../schema/wedding-config.schema.json", import.meta.url), "utf8"));
const base = JSON.parse(readFileSync(new URL("../../plantillas/editorial/config.json", import.meta.url), "utf8"));
const clone = () => structuredClone(base);

test("el config de ejemplo es válido", () => {
  assert.deepEqual(validate(schema, base), []);
});

test("detecta una fecha sin zona horaria", () => {
  const c = clone();
  c.event.date = "2027-06-12T18:00:00";
  assert.deepEqual(validate(schema, c).map((e) => e.path), ["event.date"]);
});

test("exige los dos nombres de la pareja", () => {
  const c = clone();
  c.event.couple = ["Lucía"];
  assert.equal(validate(schema, c)[0].path, "event.couple");
});

test("no deja guardar fotos como data: (solo URLs)", () => {
  const c = clone();
  c.event.photo = "data:image/jpeg;base64,AAAA";
  assert.equal(validate(schema, c)[0].path, "event.photo");
});

test("rechaza secciones desconocidas o repetidas", () => {
  const c = clone();
  c.sections = ["hero", "hero", "piscina"];
  const paths = validate(schema, c).map((e) => e.path);
  assert.ok(paths.includes("sections[1]"));
  assert.ok(paths.includes("sections[2]"));
});

test("horas del programa en formato HH:MM", () => {
  const c = clone();
  c.schedule[0].time = "25:00";
  assert.equal(validate(schema, c)[0].path, "schedule[0].time");
});

test("avisa de campos desconocidos (erratas)", () => {
  const c = clone();
  c.event.fecha = "2027-06-12";
  assert.equal(validate(schema, c)[0].message, "campo desconocido");
});
