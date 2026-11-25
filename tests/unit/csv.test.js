import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeCsv, parseCsv, rowsToObjects } from "../../panel/js/csv.js";

test("lee el CSV de la hoja de Google (comillas, comas y saltos de línea dentro)", () => {
  const text = '﻿Fecha,Tipo,Email,Nombres,Fecha boda,Mensaje,Config\r\n'
    + '2026-09-01 10:00:00,prueba,ana@example.com,Ana y Pablo,2027-05-01 18:00,"Hola, ¿qué tal?\nOtra línea","{""a"":1}"\r\n'
    + ',,,,,,\r\n';
  const objs = rowsToObjects(parseCsv(text));
  assert.equal(objs.length, 1);
  assert.equal(objs[0].fecha_boda, "2027-05-01 18:00");
  assert.equal(objs[0].mensaje, "Hola, ¿qué tal?\nOtra línea");
  assert.equal(JSON.parse(objs[0].config).a, 1);
});

test("conserva tildes y eñes en UTF-8 y en el CSV de Excel para Windows", () => {
  const text = "Nombre;Apellidos\r\nJosé;Núñez\r\nMaría;L’Hôte\r\n";
  const cp1252 = Buffer.from(text.replace("’", "'"), "latin1");
  assert.equal(parseCsv(decodeCsv(new TextEncoder().encode(text)))[2][1], "L’Hôte");
  assert.deepEqual(parseCsv(decodeCsv(cp1252))[1], ["José", "Núñez"]);
  assert.deepEqual(parseCsv(decodeCsv(new TextEncoder().encode(`﻿${text}`)))[0], ["Nombre", "Apellidos"]);
});

test("detecta el separador ; (Excel en español)", () => {
  const objs = rowsToObjects(parseCsv("Email;Teléfono\nx@example.com;600 000 000\n"));
  assert.equal(objs[0].telefono, "600 000 000");
});
