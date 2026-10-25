import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readXlsx } from "../../lib/xlsx.js";
import { parseGuestRows } from "../../pareja/js/lista.js";
import { qrMatrix } from "../../lib/qr.js";

const fixture = (name) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url));

test("lee un Excel con cadenas compartidas, tildes, números y celdas vacías (y solo la primera hoja)", async () => {
  const rows = await readXlsx(fixture("invitados-openpyxl.xlsx"));
  assert.deepEqual(rows[0], ["Grupo", "Nombre", "Apellidos", "Niño", "Email", "Teléfono"]);
  assert.equal(rows[2][1], "Íñigo");
  assert.equal(rows[1][5], "600111222");
  assert.equal(rows[3][0], "Amigos & Co.");
  assert.equal(rows[3][1], "Ana <Ana>");
  assert.equal(rows.length, 4);
});

test("lee un Excel con cadenas en línea", async () => {
  const rows = await readXlsx(fixture("invitados-inline.xlsx"));
  assert.deepEqual(rows, [["Familia", "Nombre"], ["Los Gil", "Pablo"], ["Los Gil", "Marta"]]);
});

test("lee un Excel guardado por LibreOffice", async () => {
  const rows = await readXlsx(fixture("invitados-libreoffice.xlsx"));
  assert.equal(rows[2][1], "Íñigo");
});

test("agrupa por familia, detecta niños y saca email y teléfono del grupo", async () => {
  const { groups, errors } = parseGuestRows(await readXlsx(fixture("invitados-openpyxl.xlsx")));
  assert.deepEqual(errors, []);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].name, "Familia Ortega");
  assert.equal(groups[0].guests.length, 2);
  assert.equal(groups[0].guests[1].is_child, true);
  assert.equal(groups[0].email, "carmen@example.com");
  assert.equal(groups[1].phone, "+34 611 22 33 44");
});

test("sin columna de grupo, cada persona es su grupo; con «Familia» también vale", async () => {
  assert.equal(parseGuestRows([["Nombre"], ["Ana"], ["Luis"]]).groups.length, 2);
  assert.equal(parseGuestRows(await readXlsx(fixture("invitados-inline.xlsx"))).groups.length, 1);
  assert.match(parseGuestRows([["Email"], ["x@y.es"]]).errors[0], /Nombre/);
});

test("la lista de 150 invitados", async () => {
  const { groups } = parseGuestRows(await readXlsx(fixture("invitados-150.xlsx")));
  assert.equal(groups.reduce((n, g) => n + g.guests.length, 0), 150);
  assert.equal(groups.length, 52);
});

test("QR: tamaño correcto y patrones de posición en las tres esquinas", () => {
  const m = qrMatrix("https://weddingwebs.es/b/lucia-y-martin?i=demo-familia-ortega-0000000001");
  assert.equal((m.length - 17) % 4, 0);
  for (const [x, y] of [[0, 0], [m.length - 7, 0], [0, m.length - 7]]) {
    assert.ok(m[y][x] && m[y + 6][x + 6] && !m[y + 1][x + 1] && m[y + 3][x + 3], "patrón de posición");
  }
});

import { ibanOk, formatIban } from "../../lib/iban.js";
test("IBAN: comprueba el dígito de control y lo agrupa de 4 en 4", () => {
  assert.equal(ibanOk("ES91 2100 0418 4502 0005 1332"), true);
  assert.equal(ibanOk("ES91 2100 0418 4502 0005 1333"), false);
  assert.equal(ibanOk("ES9121000418450200051332"), true);
  assert.equal(formatIban("es9121000418450200051332"), "ES91 2100 0418 4502 0005 1332");
});
