// Facturación: quién registra las facturas en Hacienda (VERI*FACTU).
//
// La numeración, las reglas (sin huecos, inmutables, rectificativas) y la cadena de huellas
// están en la base de datos (issue_invoice). Un "proveedor" solo añade el registro en la AEAT
// y devuelve el QR y la leyenda que debe llevar el PDF. Todos cumplen esta interfaz:
//
//   name                      "manual" | el proveedor elegido
//   registers                 true si manda los registros a la AEAT
//   issueInvoice(doc)         tras emitirla en la base: la registra   -> { status, ref?, qr?, legend? }
//   issueCorrective(doc)      lo mismo para una rectificativa
//   cancelRecord(doc, motivo) registro de anulación
//   getStatus(doc)            estado del registro en la AEAT
//   getPdf(doc)               el PDF (por defecto, el nuestro: api/_lib/pdf.js)
//   getQr(doc)                contenido del QR, o null si no está registrada
//
// "doc" es lo que devuelve invoice_document() en la base de datos.
//
// INVOICING_PROVIDER (variable de entorno): "manual" mientras Luis elige proveedor.
// Verifactu es obligatorio desde el 1/1/2027 (sociedades) y el 1/7/2027 (autónomos), según el
// RDL 15/2025. Hacienda anunció el 5/10/2026 que lo retrasará a octubre de 2028, pendiente del
// BOE. Antes de esas fechas, facturar sin registrar es legal. Ver docs/FACTURACION.md.
import { invoicePdf } from "./pdf.js";

export const manual = {
  name: "manual",
  registers: false,
  async issueInvoice() { return { status: "sin_registrar" }; },
  async issueCorrective() { return { status: "sin_registrar" }; },
  async cancelRecord() { return { status: "sin_registrar" }; },
  async getStatus() { return { status: "sin_registrar" }; },
  async getPdf(doc) { return invoicePdf(doc); },
  getQr() { return null; },
};

const PROVIDERS = { manual };

export function provider() {
  const name = (process.env.INVOICING_PROVIDER || "manual").toLowerCase();
  const p = PROVIDERS[name];
  if (!p) throw new Error(`Proveedor de facturación desconocido: ${name}. De momento solo existe "manual".`);
  return p;
}
