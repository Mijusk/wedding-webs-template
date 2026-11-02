// PDF de las facturas, sin librerías. Usa las fuentes que trae todo lector de PDF (Helvetica), así
// el archivo pesa unos pocos KB y no hay que incrustar nada.
import { qrMatrix } from "../../lib/qr.js";

// Anchos de Helvetica y Helvetica-Bold (milésimas del tamaño de letra), de sus métricas AFM.
// Las letras con tilde miden lo mismo que sin tilde. Lo que no está aquí, 556.
const W = {
  " ": [278, 278], "!": [278, 333], '"': [355, 474], "#": [556, 556], "$": [556, 556], "%": [889, 889], "&": [667, 722], "'": [191, 238],
  "(": [333, 333], ")": [333, 333], "*": [389, 389], "+": [584, 584], ",": [278, 278], "-": [333, 333], ".": [278, 278], "/": [278, 278],
  ":": [278, 333], ";": [278, 333], "<": [584, 584], "=": [584, 584], ">": [584, 584], "?": [556, 611], "@": [1015, 975],
  A: [667, 722], B: [667, 722], C: [722, 722], D: [722, 722], E: [667, 667], F: [611, 611], G: [778, 778], H: [722, 722], I: [278, 278],
  J: [500, 556], K: [667, 722], L: [556, 611], M: [833, 833], N: [722, 722], O: [778, 778], P: [667, 667], Q: [778, 778], R: [722, 722],
  S: [667, 667], T: [611, 611], U: [722, 722], V: [667, 667], W: [944, 944], X: [667, 667], Y: [667, 667], Z: [611, 611],
  a: [556, 556], b: [556, 611], c: [500, 556], d: [556, 611], e: [556, 556], f: [278, 333], g: [556, 611], h: [556, 611], i: [222, 278],
  j: [222, 278], k: [500, 556], l: [222, 278], m: [833, 889], n: [556, 611], o: [556, 611], p: [556, 611], q: [556, 611], r: [333, 389],
  s: [500, 556], t: [278, 333], u: [556, 611], v: [500, 556], w: [722, 778], x: [500, 556], y: [500, 556], z: [500, 500],
  "[": [278, 333], "]": [278, 333], "_": [556, 556], "|": [260, 280], "·": [278, 278], "«": [556, 556], "»": [556, 556], "–": [556, 556],
  "—": [1000, 1000], "€": [556, 556], "º": [365, 365], "ª": [370, 370], "¿": [611, 611], "¡": [333, 333], "’": [222, 278], "‘": [222, 278],
  "“": [333, 500], "”": [333, 500], "×": [584, 584], "…": [1000, 1000],
};
const BASE = { á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u", à: "a", è: "e", ò: "o", ï: "i", ç: "c", ñ: "n",
  Á: "A", É: "E", Í: "I", Ó: "O", Ú: "U", Ü: "U", À: "A", È: "E", Ò: "O", Ï: "I", Ç: "C", Ñ: "N" };

export function textWidth(s, size, bold = false) {
  let w = 0;
  for (const ch of String(s)) {
    const k = /\d/.test(ch) ? "0" : BASE[ch] || ch;
    w += k === "0" ? 556 : (W[k]?.[bold ? 1 : 0] ?? 556);
  }
  return (w * size) / 1000;
}

// Del texto de JavaScript a la codificación WinAnsi de las fuentes estándar del PDF.
const WIN = { "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97,
  "™": 0x99, "Š": 0x8a, "š": 0x9a, "Œ": 0x8c, "œ": 0x9c, "Ž": 0x8e, "ž": 0x9e, "Ÿ": 0x9f };
function pdfString(s) {
  let out = "";
  for (const ch of String(s).normalize("NFC")) {
    const c = ch.codePointAt(0);
    let code = WIN[ch] ?? (c >= 0x20 && c <= 0x7e ? c : c >= 0xa0 && c <= 0xff ? c : 0x3f);
    if (code === 0x28 || code === 0x29 || code === 0x5c) out += "\\";
    out += String.fromCharCode(code);
  }
  return `(${out})`;
}

const n2 = (v) => (Math.round(v * 100) / 100).toString();

// Página A4 con texto, líneas, rectángulos y un QR. Coordenadas desde arriba a la izquierda.
class Page {
  constructor() { this.ops = []; this.h = 841.89; this.w = 595.28; }
  text(x, y, s, { size = 10, bold = false, color = [0.12, 0.1, 0.14], align = "left" } = {}) {
    const width = textWidth(s, size, bold);
    const left = align === "right" ? x - width : align === "center" ? x - width / 2 : x;
    this.ops.push(`${color.map(n2).join(" ")} rg BT /${bold ? "F2" : "F1"} ${size} Tf ${n2(left)} ${n2(this.h - y)} Td ${pdfString(s)} Tj ET`);
    return width;
  }
  // Varias líneas que no pasan de maxWidth. Devuelve la y de debajo.
  para(x, y, s, maxWidth, opts = {}) {
    const size = opts.size || 10, lh = opts.lineHeight || size * 1.35;
    for (const line of wrap(s, maxWidth, size, opts.bold)) { this.text(x, y, line, opts); y += lh; }
    return y;
  }
  line(x1, y1, x2, y2, { width = 0.6, color = [0.82, 0.8, 0.84] } = {}) {
    this.ops.push(`${color.map(n2).join(" ")} RG ${n2(width)} w ${n2(x1)} ${n2(this.h - y1)} m ${n2(x2)} ${n2(this.h - y2)} l S`);
  }
  rect(x, y, w, h, { fill = [0.96, 0.95, 0.97] } = {}) {
    this.ops.push(`${fill.map(n2).join(" ")} rg ${n2(x)} ${n2(this.h - y - h)} ${n2(w)} ${n2(h)} re f`);
  }
  qr(x, y, size, text) {
    const m = qrMatrix(text, { ecc: "M" });
    const cell = size / m.length;
    const ops = ["0 0 0 rg"];
    m.forEach((row, r) => row.forEach((dark, c) => {
      if (dark) ops.push(`${n2(x + c * cell)} ${n2(this.h - y - (r + 1) * cell)} ${n2(cell + 0.01)} ${n2(cell + 0.01)} re`);
    }));
    ops.push("f");
    this.ops.push(ops.join("\n"));
  }
}

export function wrap(s, maxWidth, size, bold) {
  const lines = [];
  for (const paragraph of String(s ?? "").split(/\n/)) {
    let cur = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = cur ? `${cur} ${word}` : word;
      if (cur && textWidth(next, size, bold) > maxWidth) { lines.push(cur); cur = word; }
      else cur = next;
    }
    lines.push(cur);
  }
  return lines;
}

function buildPdf(page, { title }) {
  const content = Buffer.from(page.ops.join("\n"), "latin1");
  const now = new Date();
  const d = `D:${now.toISOString().replace(/[-:T]/g, "").slice(0, 14)}Z`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    null, // contenido
    `<< /Title ${pdfString(title)} /Producer (WeddingWebs) /CreationDate (${d}) >>`,
  ];
  const parts = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")];
  const offsets = [];
  let length = parts[0].length;
  objs.forEach((o, i) => {
    offsets.push(length);
    const body = o === null
      ? Buffer.concat([Buffer.from(`${i + 1} 0 obj\n<< /Length ${content.length} >>\nstream\n`, "latin1"), content, Buffer.from("\nendstream\nendobj\n", "latin1")])
      : Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, "latin1");
    parts.push(body);
    length += body.length;
  });
  const xref = [`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`, ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)].join("");
  parts.push(Buffer.from(`${xref}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${length}\n%%EOF\n`, "latin1"));
  return Buffer.concat(parts);
}

// ── La factura ────────────────────────────────────────────────

const eur = (cents) => `${(cents / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })} €`;
const date = (iso) => (iso ? new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Madrid" }) : "");
const dateOnly = (d) => (d ? date(`${String(d).slice(0, 10)}T12:00:00Z`) : "");
const PAY = { stripe: "tarjeta o Bizum", bizum: "Bizum", transferencia: "transferencia", efectivo: "efectivo", otro: "otro medio" };
const MUTED = [0.4, 0.37, 0.43];
const ACCENT = [0.49, 0.16, 0.29];

export function invoiceFileName(inv) {
  return `Factura ${inv.full_number}.pdf`;
}

// inv: lo que devuelve invoice_document() (factura, líneas, pedido, factura rectificada y pagos).
export function invoicePdf(inv) {
  const p = new Page();
  const L = 50, R = 545;
  const seller = inv.issuer || {};
  const to = inv.recipient || {};
  const title = inv.kind === "rectificativa" ? "Factura rectificativa" : inv.kind === "simplificada" ? "Factura simplificada" : "Factura";

  // Emisor
  let y = 62;
  p.text(L, y, seller.nombre || "WeddingWebs", { size: 15, bold: true });
  y += 18;
  const sellerLines = [
    seller.nif && `NIF ${seller.nif}`,
    seller.direccion,
    [seller.codigo_postal, seller.ciudad, seller.provincia && seller.provincia !== seller.ciudad ? `(${seller.provincia})` : ""].filter(Boolean).join(" "),
    [seller.email, seller.telefono].filter(Boolean).join(" · "),
  ].filter(Boolean);
  for (const s of sellerLines) { p.text(L, y, s, { size: 9.5, color: MUTED }); y += 13; }

  // Título y número
  p.text(R, 62, title.toUpperCase(), { size: 13, bold: true, align: "right", color: ACCENT });
  const meta = [
    ["Número", inv.full_number],
    ["Fecha de expedición", date(inv.issued_at)],
    inv.operation_date && dateOnly(inv.operation_date) !== date(inv.issued_at) ? ["Fecha de la operación", dateOnly(inv.operation_date)] : null,
    inv.order_number ? ["Pedido", inv.order_number] : null,
  ].filter(Boolean);
  let my = 82;
  for (const [k, v] of meta) {
    p.text(R - 120, my, k, { size: 9, color: MUTED, align: "right" });
    p.text(R, my, v, { size: 9.5, bold: true, align: "right" });
    my += 14;
  }
  if (inv.status === "anulada") p.text(R, my + 6, "ANULADA", { size: 14, bold: true, align: "right", color: [0.75, 0.12, 0.12] });

  y = Math.max(y, my) + 22;
  p.line(L, y, R, y);
  y += 20;

  // Cliente
  if (to.nombre || to.nif) {
    p.text(L, y, "Cliente", { size: 9, color: MUTED });
    y += 14;
    p.text(L, y, to.nombre || "", { size: 10.5, bold: true });
    y += 14;
    const toLines = [
      to.nif && `NIF/NIE ${to.nif}`,
      to.direccion,
      [to.codigo_postal, to.ciudad, to.provincia && to.provincia !== to.ciudad ? `(${to.provincia})` : "", to.pais && to.pais !== "ES" ? to.pais : ""].filter(Boolean).join(" "),
    ].filter(Boolean);
    for (const s of toLines) { p.text(L, y, s, { size: 9.5 }); y += 13; }
    y += 14;
  }

  // Rectificativa: a qué factura corrige y por qué
  if (inv.kind === "rectificativa" && inv.corrects) {
    p.rect(L, y - 4, R - L, 40);
    p.text(L + 10, y + 10, `Rectifica la factura ${inv.corrects.number} del ${date(inv.corrects.issued_at)} (rectificación por diferencias).`, { size: 9.5, bold: true });
    p.para(L + 10, y + 24, `Motivo: ${inv.correction_reason || ""}`, R - L - 20, { size: 9.5 });
    y += 54;
  }

  // Líneas
  const cols = { qty: 340, base: 420, vat: 470, total: R };
  p.rect(L, y - 4, R - L, 22);
  p.text(L + 8, y + 10, "Concepto", { size: 9, bold: true });
  p.text(cols.qty, y + 10, "Cant.", { size: 9, bold: true, align: "right" });
  p.text(cols.base, y + 10, "Base", { size: 9, bold: true, align: "right" });
  p.text(cols.vat, y + 10, "IVA", { size: 9, bold: true, align: "right" });
  p.text(cols.total - 8, y + 10, "Total", { size: 9, bold: true, align: "right" });
  y += 34;
  const rates = new Map();
  for (const l of inv.lines || []) {
    const lines = wrap(l.description, cols.qty - L - 50, 10);
    lines.forEach((s, i) => p.text(L + 8, y + i * 13, s, { size: 10 }));
    p.text(cols.qty, y, String(l.quantity), { size: 10, align: "right" });
    p.text(cols.base, y, eur(l.base_cents), { size: 10, align: "right" });
    p.text(cols.vat, y, `${l.vat_rate_bp / 100} %`, { size: 10, align: "right" });
    p.text(cols.total - 8, y, eur(l.line_total_cents), { size: 10, align: "right" });
    const r = rates.get(l.vat_rate_bp) || { base: 0, vat: 0 };
    r.base += l.base_cents; r.vat += l.vat_cents;
    rates.set(l.vat_rate_bp, r);
    y += Math.max(1, lines.length) * 13 + 10;
  }
  p.line(L, y, R, y);
  y += 22;

  // Totales
  const tl = 420;
  for (const [bp, r] of rates) {
    p.text(tl, y, `Base imponible (${bp / 100} %)`, { size: 9.5, color: MUTED, align: "right" });
    p.text(R - 8, y, eur(r.base), { size: 10, align: "right" });
    y += 15;
    p.text(tl, y, `Cuota de IVA (${bp / 100} %)`, { size: 9.5, color: MUTED, align: "right" });
    p.text(R - 8, y, eur(r.vat), { size: 10, align: "right" });
    y += 15;
  }
  y += 4;
  p.rect(tl - 150, y - 8, R - tl + 150, 26, { fill: [0.97, 0.93, 0.95] });
  p.text(tl, y + 9, inv.kind === "simplificada" ? "Total (IVA incluido)" : "Total", { size: 11, bold: true, align: "right" });
  p.text(R - 8, y + 9, eur(inv.total_cents), { size: 12, bold: true, align: "right", color: ACCENT });
  y += 44;

  // Pago
  const paid = (inv.payments || []).filter((x) => x.amount_cents > 0);
  if (paid.length && inv.kind !== "rectificativa") {
    const s = paid.map((x) => `${eur(x.amount_cents)} el ${date(x.paid_at)} (${PAY[x.provider] || x.provider})`).join("; ");
    y = p.para(L, y, `Pagado: ${s}.`, R - L, { size: 9.5, color: MUTED });
  } else if (inv.kind === "rectificativa") {
    y = p.para(L, y, "Importe devuelto por el mismo medio con el que se pagó.", R - L, { size: 9.5, color: MUTED });
  }

  // VERI*FACTU: solo si un proveedor la ha registrado en Hacienda (lleva su QR y la leyenda).
  if (inv.qr_payload) {
    const qy = 841.89 - 50 - 90;
    p.qr(L, qy, 80, inv.qr_payload);
    p.text(L + 95, qy + 18, inv.legend || "VERI*FACTU", { size: 9.5, bold: true });
    p.para(L + 95, qy + 34, "Factura verificable en la sede electrónica de la AEAT.", R - L - 95, { size: 9, color: MUTED });
  }
  p.text(R, 841.89 - 30, `${inv.full_number} · 1/1`, { size: 8, color: MUTED, align: "right" });

  return buildPdf(p, { title: `${title} ${inv.full_number}` });
}
