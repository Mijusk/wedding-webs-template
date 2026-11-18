import { test } from "node:test";
import assert from "node:assert/strict";
import { matchAnswers, personScore, splitNames, nameKey, SEGURO } from "../../pareja/js/emparejar.js";

const g = (id, name, people, answer = null) => ({
  id, name, answer, token_revoked_at: null,
  guests: people.map(([first_name, last_name = ""]) => ({ first_name, last_name })),
});
const groups = [
  g("g1", "Familia García", [["José", "García López"], ["Carmen", "Ruiz"], ["Lucía", "García Ruiz"]]),
  g("g2", "Amigos uni", [["Marta", "Sánchez"], ["Pablo", "Gil"]]),
  g("g3", "Tíos de Martín", [["Marta", "Ortega"], ["Ignacio", "Ortega"]]),
  g("g4", "Familia Ortiz", []),
  g("g5", "Íñigo y Ane", [["Íñigo", "Etxeberria"], ["Ane", "Arrieta"]], { attending: true }),
];
const one = (name, payload = {}) => matchAnswers([{ name, payload }], groups)[0];

test("nombre y apellido iguales (con o sin tildes, con o sin segundo apellido): se une solo", () => {
  for (const n of ["José García", "jose garcia", "José García López", "JOSE GARCIA LOPEZ"]) {
    const m = one(n);
    assert.equal(m.group.id, "g1", n);
    assert.equal(m.kind, "seguro", n);
    assert.equal(m.guest.first_name, "José");
  }
});

test("una letra mal escrita en el apellido sigue siendo casi seguro", () => {
  assert.equal(one("Pablo Gill").kind, "seguro");
  assert.equal(one("Marta Sanchez").group.id, "g2");
});

test("diminutivos («Pepe», «Nacho») se sugieren, no se unen solos", () => {
  const m = one("Pepe García");
  assert.equal(m.group.id, "g1");
  assert.equal(m.kind, "sugerencia");
  assert.equal(one("Nacho Ortega").group.id, "g3");
  assert.equal(one("Nacho Ortega").kind, "sugerencia");
});

test("solo el nombre de pila: nunca seguro, y si hay dos Martas no se elige ninguna sola", () => {
  const m = one("Marta");
  assert.equal(m.kind, "sugerencia");
  assert.equal(m.reason, "varios");
});

test("un apellido que esa persona no tiene descarta la coincidencia", () => {
  assert.equal(personScore("José Martínez", "José", "García López"), 0);
  assert.equal(one("Ana Torres"), undefined);
});

test("«Ana» y «Eva» no se confunden (nombres cortos)", () => {
  assert.equal(personScore("Eva", "Ana", ""), 0);
});

test("varias personas en una respuesta: «Marta y Pablo» encaja con su grupo", () => {
  assert.deepEqual(splitNames("Marta y Pablo García"), ["Marta García", "Pablo García"]);
  assert.deepEqual(splitNames("Marta, Pablo"), ["Marta", "Pablo"]);
  const m = one("Marta Sánchez y Pablo Gil");
  assert.equal(m.group.id, "g2");
  assert.equal(m.kind, "seguro");
});

test("grupo sin personas: se compara con su nombre y solo se sugiere", () => {
  const m = one("Luis Ortiz");
  assert.equal(m?.group.id, "g4");
  assert.equal(m.kind, "sugerencia");
});

test("si el grupo ya contestó desde su enlace, es un posible duplicado: se sugiere", () => {
  const m = one("Iñigo Etxeberria");
  assert.equal(m.group.id, "g5");
  assert.equal(m.kind, "sugerencia");
  assert.equal(m.reason, "duplicado");
  assert.ok(m.score >= SEGURO);
});

test("lo que la pareja descartó no se vuelve a sugerir", () => {
  assert.equal(one("José García", { descartados: ["g1"] }), undefined);
});

test("la clave del nombre coincide con la de la base de datos", () => {
  assert.equal(nameKey("  José   María Núñez "), "jose maria nunez");
});
