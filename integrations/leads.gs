// Google Apps Script para los contactos del escaparate (studio/).
// 1. Crea una hoja de Google, ve a Extensiones > Apps Script y pega este archivo.
// 2. Cambia AVISAR_A por tu email.
// 3. Implementar > Nueva implementación > Aplicación web, con acceso "Cualquier usuario".
// 4. Copia la URL en studio/studio.json > contact.endpoint.
//
// Cada prueba del generador y cada reserva añade una fila en la pestaña "Contactos"
// y te llega un email al momento, para que puedas escribir a la pareja en minutos.

const AVISAR_A = "tu-email@ejemplo.com";
const RESPUESTA_AUTOMATICA = false; // true: la pareja recibe al momento el email de abajo

const COLUMNAS = ["Fecha", "Tipo", "Email", "Nombres", "Fecha boda", "Lugar", "Estilo", "Fotos",
  "Tarifa", "Teléfono", "Mensaje", "Estado", "Config"];

function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = libro.getSheetByName("Contactos") || libro.insertSheet("Contactos");
  if (hoja.getLastRow() === 0) hoja.appendRow(COLUMNAS);

  hoja.appendRow([
    new Date(d.sentAt), d.type || "", d.email || "", d.name || "", d.weddingDate || "",
    d.venue || "", d.style || "", d.photos ?? "", d.tier || "", d.phone || "", d.message || "",
    "Nuevo", d.wedding ? JSON.stringify(d.wedding) : "",
  ]);

  const asunto = d.type === "reserva"
    ? `Reserva: ${d.name} (${d.tier})`
    : `Nueva prueba: ${d.name}, boda el ${d.weddingDate}`;
  MailApp.sendEmail({
    to: AVISAR_A,
    subject: asunto,
    body: `${asunto}\nEmail: ${d.email}\nLugar: ${d.venue || "-"}\nEstilo: ${d.style || "-"}\n\n${libro.getUrl()}`,
  });

  if (RESPUESTA_AUTOMATICA && d.type === "prueba" && d.email) {
    MailApp.sendEmail({
      to: d.email,
      subject: "Vuestra web de boda",
      body: `¡Hola, ${d.name}!\n\nHemos visto que habéis probado vuestra web de boda. ` +
        "Si os gusta, podemos tenerla publicada en unos días, con las confirmaciones de los invitados en vuestra propia hoja de Google.\n\n" +
        "Respondednos a este email con cualquier duda o con lo que querríais cambiar.\n\nUn abrazo,\nWeddingWebs",
    });
  }
  return ContentService.createTextOutput("ok");
}
