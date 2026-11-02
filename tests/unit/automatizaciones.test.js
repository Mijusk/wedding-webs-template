// Textos de los emails automáticos y enlaces de baja, sin base de datos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTemplate, fill, placeholders } from "../../lib/email.js";
import { INFO, sampleVars } from "../../lib/automatizaciones.js";

process.env.UNSUBSCRIBE_SECRET = "secreto-de-prueba";
const { unsubscribeUrl, unsubscribeEmail } = await import("../../api/_lib/automatizaciones.js");

test("huecos: se rellenan, los que no existen quedan vacíos y se detectan", () => {
  assert.equal(fill("Hola, {nombres}{nada}!", { nombres: "Ana y Bea" }), "Hola, Ana y Bea!");
  assert.deepEqual(placeholders("{a} y {b} y {a}"), ["a", "b"]);
});

test("email: párrafos, enlaces, escape y botón", () => {
  const m = renderTemplate(
    { subject: "Hola,  {nombres}", body: "Uno <b>{nombres}</b>\nsigue\n\nDos: https://ej.es/x.", button_label: "Ver" },
    { nombres: "Ana & Bea" }, { link: "https://ej.es/web" });
  assert.equal(m.subject, "Hola, Ana & Bea");
  assert.match(m.html, /Uno &lt;b&gt;Ana &amp; Bea&lt;\/b&gt;<br>sigue/);
  assert.match(m.html, /<a href="https:\/\/ej\.es\/x" [^>]*>https:\/\/ej\.es\/x<\/a>\./, "el punto final no forma parte del enlace");
  assert.match(m.html, /href="https:\/\/ej\.es\/web"[^>]*>Ver</);
  assert.match(m.text, /Ver: https:\/\/ej\.es\/web/);
  assert.ok(!m.html.includes("baja"), "sin enlace de baja si no es comercial");
});

test("emails comerciales: enlace de baja en el texto y en el HTML", () => {
  const m = renderTemplate({ subject: "x", body: "y" }, {}, { unsubscribe: "https://ej.es/api/lead?baja=a&t=b" });
  assert.match(m.html, /daos de baja aquí/);
  assert.match(m.text, /Para no recibir más emails nuestros: https:\/\/ej\.es\/api\/lead\?baja=a&t=b/);
});

test("enlace de baja: firmado, no se puede cambiar el email", () => {
  const url = new URL(unsubscribeUrl("https://ej.es", "Ana@Example.com"));
  assert.equal(unsubscribeEmail(url.searchParams.get("baja"), url.searchParams.get("t")), "ana@example.com");
  const other = Buffer.from("otra@example.com").toString("base64url");
  assert.equal(unsubscribeEmail(other, url.searchParams.get("t")), null, "otro email con la misma firma");
  assert.equal(unsubscribeEmail(url.searchParams.get("baja"), "falsa"), null);
  assert.equal(unsubscribeEmail("%%%", "x"), null);
});

test("los textos de ejemplo cubren todos los huecos de cada automatización", () => {
  const sample = sampleVars();
  for (const [code, info] of Object.entries(INFO)) {
    for (const v of info.vars || []) assert.ok(v in sample, `${code}: falta {${v}} en el ejemplo`);
  }
});
