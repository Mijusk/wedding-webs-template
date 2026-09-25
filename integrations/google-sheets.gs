// Google Apps Script: pégalo en Extensiones > Apps Script de la hoja de la pareja,
// despliega como "Aplicación web" (acceso: cualquiera) y copia la URL en config.rsvp.endpoint.
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("RSVP")
    || SpreadsheetApp.getActiveSpreadsheet().insertSheet("RSVP");
  if (sheet.getLastRow() === 0) sheet.appendRow(["Fecha", "Nombre", "Asiste", "Canción"]);
  const d = JSON.parse(e.postData.contents);
  sheet.appendRow([new Date(d.sentAt), d.name, d.attending, d.song]);
  return ContentService.createTextOutput("ok");
}
