// Guardado de reservas. Igual que el RSVP de la plantilla (js/storage.js): si
// studio.json tiene contact.endpoint (un Apps Script), se envía ahí; si no, se simula.
const KEY = "studio-leads-demo";

export async function saveLead(lead, contactConfig = {}) {
  const payload = { ...lead, sentAt: new Date().toISOString() };

  if (contactConfig.endpoint) {
    await fetch(contactConfig.endpoint, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    return { payload, simulated: false };
  }

  console.info("[Reserva simulada] guardada:", payload);
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || "[]");
    all.push(payload);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* almacenamiento bloqueado: la simulación sigue funcionando */ }
  await new Promise((r) => setTimeout(r, 500));
  return { payload, simulated: true };
}
