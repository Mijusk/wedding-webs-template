// Lector mínimo de Excel (.xlsx) sin dependencias: devuelve la primera hoja como filas de texto.
// Un .xlsx es un .zip con XML dentro; se descomprime con DecompressionStream, que traen todos los
// navegadores actuales y Node 20+. Sirve para importar listas de invitados.
//
//   import { readXlsx } from "/lib/xlsx.js";
//   const rows = await readXlsx(await file.arrayBuffer());   // [["Grupo", "Nombre", …], …]

export async function readXlsx(buffer) {
  const zip = await unzip(new Uint8Array(buffer));
  const text = async (name) => (zip.has(name) ? new TextDecoder().decode(await zip.get(name)()) : null);

  // Primera hoja según el libro (no siempre se llama sheet1.xml).
  let sheetPath = "xl/worksheets/sheet1.xml";
  const workbook = await text("xl/workbook.xml");
  const rels = await text("xl/_rels/workbook.xml.rels");
  const firstSheet = workbook?.match(/<sheet\b[^>]*\br:id="([^"]+)"/);
  if (firstSheet && rels) {
    const rel = [...rels.matchAll(/<Relationship\b([^>]*)\/?>/g)].map((m) => attrs(m[1])).find((a) => a.Id === firstSheet[1]);
    if (rel?.Target) sheetPath = rel.Target.startsWith("/") ? rel.Target.slice(1) : `xl/${rel.Target.replace(/^\.\//, "")}`;
  }
  const sheet = await text(sheetPath);
  if (!sheet) throw new Error("El archivo no tiene ninguna hoja.");

  const shared = [];
  const sst = await text("xl/sharedStrings.xml");
  if (sst) for (const si of sst.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) shared.push(runs(si[1]));

  const rows = [];
  for (const row of sheet.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g)) {
    const rAttrs = attrs(row[1] || row[3] || "");
    const index = rAttrs.r ? Number(rAttrs.r) - 1 : rows.length;
    const cells = [];
    for (const c of (row[2] || "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const a = attrs(c[1]);
      const col = a.r ? colIndex(a.r) : cells.length;
      const inner = c[2] || "";
      const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = "";
      if (a.t === "s") value = shared[Number(v)] ?? "";
      else if (a.t === "inlineStr") value = runs(inner);
      else if (a.t === "b") value = v === "1" ? "VERDADERO" : "FALSO";
      else if (v !== undefined) value = decode(v);
      cells[col] = value;
    }
    rows[index] = Array.from(cells, (x) => x ?? "");
  }
  return Array.from(rows, (r) => r ?? []).filter((r) => r.some((x) => String(x).trim() !== ""));
}

const runs = (xml) => [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decode(t[1])).join("");
const attrs = (s) => Object.fromEntries([...s.matchAll(/([\w:]+)="([^"]*)"/g)].map((m) => [m[1], decode(m[2])]));
const colIndex = (ref) => [...ref.replace(/\d+/g, "")].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
const decode = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

// ── zip ──
async function unzip(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("No es un archivo de Excel (.xlsx) válido.");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const files = new Map();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("Archivo .xlsx dañado.");
    const method = dv.getUint16(p + 10, true);
    const size = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const data = b.subarray(start, start + size);
    files.set(name, async () => {
      if (method === 0) return data;
      if (method !== 8) throw new Error("Compresión no soportada en el .xlsx.");
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    });
  }
  return files;
}
