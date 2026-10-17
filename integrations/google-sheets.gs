// Google Apps Script: pégalo en Extensiones > Apps Script de la hoja de la pareja,
// despliega como "Aplicación web" (acceso: cualquiera) y copia la URL en config.rsvp.endpoint.
// Si ya estaba desplegado: Implementar > Gestionar implementaciones > editar > Nueva versión.
//
// Si la misma persona vuelve a contestar (mismo nombre, sin contar mayúsculas ni tildes),
// se actualiza su fila: vale la última respuesta. Los envíos de bots (campo trampa) se ignoran.
const COLUMNAS = ["Fecha", "Nombre", "Asiste", "Canción", "Veces que ha contestado"];

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return respuesta(false); }
  if (d.website) return respuesta(true);
  const nombre = String(d.name || "").trim();
  if (nombre.length < 2 || !["si", "no"].includes(d.attending)) return respuesta(false);

  const cerrojo = LockService.getScriptLock();
  cerrojo.waitLock(10000);
  try {
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = libro.getSheetByName("RSVP") || libro.insertSheet("RSVP");
    if (hoja.getLastRow() === 0) hoja.appendRow(COLUMNAS);

    const previa = buscar(hoja, nombre);
    const veces = previa ? Number(hoja.getRange(previa, 5).getValue() || 1) + 1 : 1;
    const fila = [new Date(), celda(nombre), d.attending === "si" ? "Sí" : "No", celda(d.song), veces];
    if (previa) hoja.getRange(previa, 1, 1, fila.length).setValues([fila]);
    else hoja.appendRow(fila);
  } finally {
    cerrojo.releaseLock();
  }
  return respuesta(true);
}

const normal = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

function buscar(hoja, nombre) {
  const n = hoja.getLastRow() - 1;
  if (n < 1) return 0;
  const buscado = normal(nombre);
  const nombres = hoja.getRange(2, 2, n, 1).getValues();
  for (let i = 0; i < nombres.length; i++) if (normal(nombres[i][0]) === buscado) return i + 2;
  return 0;
}

// Recorta y evita que "=", "+", "-" o "@" al principio se lean como fórmula.
function celda(v) {
  const s = String(v == null ? "" : v).slice(0, 300);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function respuesta(ok) {
  return ContentService.createTextOutput(JSON.stringify({ ok })).setMimeType(ContentService.MimeType.JSON);
}
