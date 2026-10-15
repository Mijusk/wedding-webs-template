// Google Apps Script para los contactos del escaparate (studio/).
// 1. Crea una hoja de Google, ve a Extensiones > Apps Script y pega este archivo.
// 2. Cambia AVISAR_A por tu email.
// 3. Implementar > Nueva implementación > Aplicación web, con acceso "Cualquier usuario".
//    Si ya estaba desplegado: Implementar > Gestionar implementaciones > editar > Nueva versión
//    (así la URL no cambia).
// 4. Copia la URL en studio/studio.json > contact.endpoint.
//
// Cada prueba del generador y cada reserva añade una fila en la pestaña "Contactos"
// y te llega un email al momento, para que puedas escribir a la pareja en minutos.
// Protecciones: la URL es pública, así que se ignoran los envíos de bots (campo trampa),
// una pareja que repite la prueba actualiza su fila en vez de crear otra, como mucho
// llega un aviso por email cada 30 min por pareja y MAX_AVISOS_DIA en total.

const AVISAR_A = "tu-email@ejemplo.com";
const RESPUESTA_AUTOMATICA = false; // true: la pareja recibe al momento el email de abajo
const MAX_AVISOS_DIA = 50; // Gmail gratuito permite unos 100 emails al día

const COLUMNAS = ["Fecha", "Tipo", "Email", "Nombres", "Fecha boda", "Lugar", "Estilo", "Fotos",
  "Tarifa", "Teléfono", "Mensaje", "Estado", "Config"];

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return respuesta(false, "json"); }
  if (d.website) return respuesta(true); // campo trampa relleno: un bot. Se le dice que sí y no se guarda.
  const email = String(d.email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return respuesta(false, "email");

  const cerrojo = LockService.getScriptLock();
  cerrojo.waitLock(10000);
  try {
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = libro.getSheetByName("Contactos") || libro.insertSheet("Contactos");
    if (hoja.getLastRow() === 0) hoja.appendRow(COLUMNAS);

    const fila = [
      new Date(), d.type || "", email, d.name, d.weddingDate, d.venue, d.style, d.photos,
      d.tier, d.phone, d.message, "Nuevo", d.wedding ? JSON.stringify(d.wedding) : "",
    ].map((v, i) => (i === 0 ? v : celda(v, i === 12 ? 45000 : 1000)));

    // Una pareja que vuelve a probar en las últimas 24 h actualiza su fila de prueba
    // (sin tocar el Estado que hayas puesto tú).
    const previa = d.type === "prueba" ? filaDePrueba(hoja, email) : 0;
    if (previa) hoja.getRange(previa, 1, 1, 11).setValues([fila.slice(0, 11)]);
    else hoja.appendRow(fila);

    if (!previa) avisar(libro, d, email);
  } finally {
    cerrojo.releaseLock();
  }
  return respuesta(true);
}

function avisar(libro, d, email) {
  const cache = CacheService.getScriptCache();
  const clave = "aviso:" + email + ":" + (d.type || "");
  if (cache.get(clave)) return;
  const props = PropertiesService.getScriptProperties();
  const hoy = Utilities.formatDate(new Date(), "Europe/Madrid", "yyyy-MM-dd");
  const enviados = props.getProperty("avisos:" + hoy) || "0";
  if (Number(enviados) >= MAX_AVISOS_DIA) return;
  props.setProperty("avisos:" + hoy, String(Number(enviados) + 1));
  cache.put(clave, "1", 1800);

  const asunto = d.type === "reserva"
    ? `Reserva: ${d.name} (${d.tier})`
    : `Nueva prueba: ${d.name}, boda el ${d.weddingDate}`;
  MailApp.sendEmail({
    to: AVISAR_A,
    subject: asunto,
    body: `${asunto}\nEmail: ${email}\nLugar: ${d.venue || "-"}\nEstilo: ${d.style || "-"}\n\n${libro.getUrl()}`,
  });

  if (RESPUESTA_AUTOMATICA && d.type === "prueba") {
    MailApp.sendEmail({
      to: email,
      subject: "Vuestra web de boda",
      body: `¡Hola, ${d.name}!\n\nHemos visto que habéis probado vuestra web de boda. ` +
        "Si os gusta, podemos tenerla publicada en unos días, con las confirmaciones de los invitados en vuestra propia hoja de Google.\n\n" +
        "Respondednos a este email con cualquier duda o con lo que querríais cambiar.\n\nUn abrazo,\nWeddingWebs",
    });
  }
}

// Fila de una prueba del mismo email en las últimas 24 h (0 si no hay).
function filaDePrueba(hoja, email) {
  const n = hoja.getLastRow() - 1;
  if (n < 1) return 0;
  const datos = hoja.getRange(2, 1, n, 3).getValues();
  const limite = Date.now() - 24 * 3600 * 1000;
  for (let i = datos.length - 1; i >= 0; i--) {
    const [fecha, tipo, correo] = datos[i];
    if (tipo === "prueba" && String(correo).toLowerCase() === email && new Date(fecha).getTime() > limite) return i + 2;
  }
  return 0;
}

// Texto seguro para una celda: recortado y sin que "=", "+", "-" o "@" al principio se lean como fórmula.
function celda(v, max) {
  const s = String(v == null ? "" : v).slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function respuesta(ok, error) {
  return ContentService.createTextOutput(JSON.stringify(error ? { ok, error } : { ok }))
    .setMimeType(ContentService.MimeType.JSON);
}
