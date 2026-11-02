// Piezas de los cobros sin base de datos: firma de los avisos de Stripe, formato de su API,
// el PDF de las facturas y el NIF.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formEncode, verifySignature, signatureHeader, formatCode } from "../../api/_lib/stripe.js";
import { invoicePdf, textWidth, wrap } from "../../api/_lib/pdf.js";
import { validNif, cleanNif } from "../../lib/nif.js";

test("formato de la API de Stripe: objetos y listas anidados", () => {
  const s = formEncode({ mode: "payment", line_items: [{ quantity: 1, price_data: { unit_amount: 7900, product_data: { name: "Web · Tal cual" } } }], x: undefined, y: null });
  assert.equal(decodeURIComponent(s.toString()).replace(/\+/g, " "),
    "mode=payment&line_items[0][quantity]=1&line_items[0][price_data][unit_amount]=7900&line_items[0][price_data][product_data][name]=Web · Tal cual");
});

test("firma de los avisos: válida, alterada, caducada o con secreto equivocado", () => {
  const raw = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
  const header = signatureHeader(raw, "whsec_x");
  assert.ok(verifySignature(raw, header, "whsec_x"));
  assert.ok(verifySignature(Buffer.from(raw), header, "whsec_x"), "también con el cuerpo en bytes");
  assert.ok(!verifySignature(raw.replace("evt_1", "evt_2"), header, "whsec_x"), "cuerpo cambiado");
  assert.ok(!verifySignature(raw, header, "whsec_otro"), "otro secreto");
  assert.ok(!verifySignature(raw, signatureHeader(raw, "whsec_x", Math.floor(Date.now() / 1000) - 3600), "whsec_x"), "de hace una hora");
  assert.ok(!verifySignature(raw, "", "whsec_x") && !verifySignature(raw, "t=1", "whsec_x"));
  // Stripe puede mandar dos firmas (cuando se cambia el secreto): vale si una coincide.
  const two = `${header},v1=${"0".repeat(64)}`;
  assert.ok(verifySignature(raw, two, "whsec_x"));
});

test("código de seguimiento con guion", () => {
  assert.equal(formatCode("K7M3Q9TX"), "K7M3-Q9TX");
});

test("NIF, NIE y CIF", () => {
  assert.ok(validNif("12345678Z") && validNif("12.345.678-z") && validNif("X1234567L") && validNif("B12345678"));
  assert.ok(!validNif("12345678A") && !validNif("X1234567A") && !validNif(""));
  assert.equal(cleanNif(" 12.345.678-z "), "12345678Z");
});

const DOC = {
  full_number: "WW-2026-0007", kind: "ordinaria", status: "emitida", issued_at: "2026-10-26T09:00:00Z",
  issuer: { nombre: "Luis Ejemplo", nif: "12345678Z", direccion: "Calle (Mayor) 1", ciudad: "Sant Cugat" },
  recipient: { nombre: "Carmen Ibáñez", nif: "00000001R", direccion: "Calle Ñandú 2" },
  total_cents: 13900, lines: [{ description: "Web de boda · Con cambios", quantity: 1, base_cents: 11488, vat_cents: 2412, vat_rate_bp: 2100, line_total_cents: 13900 }],
  payments: [{ provider: "stripe", paid_at: "2026-10-25T18:00:00Z", amount_cents: 13900 }],
};

test("PDF de la factura: estructura válida, acentos y € en WinAnsi, paréntesis escapados", () => {
  const pdf = invoicePdf(DOC);
  const s = pdf.toString("latin1");
  assert.ok(s.startsWith("%PDF-1.4") && s.trimEnd().endsWith("%%EOF"));
  // La tabla xref apunta al principio de cada objeto.
  const xref = s.slice(s.lastIndexOf("\nxref\n") + 1).split("\n").slice(3, 10).map((l) => Number(l.slice(0, 10)));
  xref.forEach((off, i) => assert.equal(s.slice(off, off + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`));
  assert.ok(s.includes("(Carmen Ib\xe1\xf1ez)"), "acentos en WinAnsi");
  assert.ok(s.includes("139,00 \x80"), "el euro es el código 0x80");
  assert.ok(s.includes("(Calle \\(Mayor\\) 1)"), "paréntesis escapados");
  assert.ok(!s.includes("VERI*FACTU"), "sin registrar en Hacienda no lleva leyenda");
  assert.ok(invoicePdf({ ...DOC, qr_payload: "https://aeat.example/qr", legend: "VERI*FACTU" }).toString("latin1").includes("VERI*FACTU"));
});

test("medidas del texto para alinear importes y partir líneas", () => {
  assert.equal(textWidth("139,00 €", 10), textWidth("888,88 €", 10));
  assert.ok(wrap("una descripción bastante larga que no cabe en una línea", 100, 10).length > 1);
});
