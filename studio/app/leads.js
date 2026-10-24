import { postToSheet } from "../../js/storage.js";
import { attribution } from "./attribution.js";

// Guardado de contactos (pruebas del generador y reservas). Si studio.json tiene
// contact.endpoint (/api/lead: nuestra base de datos), se envía ahí y se espera a que confirme.
// Si eso falla y hay contact.fallbackEndpoint (el Apps Script de la hoja de Google de siempre),
// se manda ahí: así no se pierde ningún contacto durante el cambio. Sin ninguno, se simula.
const KEY = "studio-leads-demo";

export async function saveLead(lead, contactConfig = {}) {
  const payload = { ...lead, attribution: attribution(), page: location.pathname, sentAt: new Date().toISOString() };

  if (contactConfig.endpoint) {
    try {
      await postToSheet(contactConfig.endpoint, payload);
      return { payload, simulated: false };
    } catch (e) {
      if (!contactConfig.fallbackEndpoint) throw e;
    }
  }
  if (contactConfig.fallbackEndpoint) {
    await postToSheet(contactConfig.fallbackEndpoint, payload);
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
