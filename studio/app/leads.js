import { postToSheet } from "../../js/storage.js";

// Guardado de contactos (pruebas del generador y reservas). Si studio.json tiene
// contact.endpoint (un Apps Script, ver integrations/leads.gs), se envía ahí y se espera
// a que la hoja confirme; si no, se simula en el navegador.
const KEY = "studio-leads-demo";

export async function saveLead(lead, contactConfig = {}) {
  const payload = { ...lead, sentAt: new Date().toISOString() };

  if (contactConfig.endpoint) {
    await postToSheet(contactConfig.endpoint, payload);
    return { payload, simulated: false };
  }

  console.info("[Contacto simulado] guardado:", payload);
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || "[]");
    all.push(payload);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* almacenamiento bloqueado: la simulación sigue funcionando */ }
  await new Promise((r) => setTimeout(r, 500));
  return { payload, simulated: true };
}
