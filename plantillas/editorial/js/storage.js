// Guardado de respuestas RSVP.
// Si config.rsvp.endpoint tiene la URL de un Apps Script (ver integrations/google-sheets.gs),
// se envía a Google Sheets. Si está vacío, se simula guardando en localStorage.
const KEY = "rsvp-demo";

export async function saveRsvp(entry, rsvpConfig = {}) {
  const payload = { ...entry, sentAt: new Date().toISOString() };

  if (rsvpConfig.endpoint) {
    // Apps Script no devuelve cabeceras CORS: no-cors envía pero no deja leer la respuesta.
    await fetch(rsvpConfig.endpoint, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    return payload;
  }

  // TODO: mock hasta tener la hoja de Google de cada pareja.
  console.info("[RSVP mock] guardado:", payload);
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || "[]");
    all.push(payload);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* almacenamiento bloqueado: el mock sigue funcionando */ }
  await new Promise((r) => setTimeout(r, 400));
  return payload;
}
