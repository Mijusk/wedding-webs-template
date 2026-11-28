// Guardado de respuestas RSVP.
// Si config.rsvp.endpoint tiene la URL de un Apps Script (ver integrations/google-sheets.gs),
// se envía a Google Sheets y se espera a que la hoja confirme: si no lo hace, el invitado ve
// un error en vez de un "gracias" falso. Si está vacío, se simula guardando en localStorage.
const KEY = "rsvp-demo";

export async function saveRsvp(entry, rsvpConfig = {}) {
  const payload = { ...entry, sentAt: new Date().toISOString() };

  if (rsvpConfig.endpoint) {
    await postToSheet(rsvpConfig.endpoint, payload);
    return payload;
  }

  console.info("[RSVP simulado] guardado:", payload);
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || "[]");
    all.push(payload);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* almacenamiento bloqueado: la simulación sigue funcionando */ }
  await new Promise((r) => setTimeout(r, 400));
  // En la vista previa del escaparate, la respuesta aparece en el «panel» de prueba de al lado.
  try { if (location.hash === "#preview" && window.parent !== window) window.parent.postMessage({ type: "wedding:rsvp", entry: payload }, location.origin); } catch { /* sin escaparate */ }
  return payload;
}

// Apps Script contesta desde script.googleusercontent.com con CORS abierto, así que la respuesta
// se puede leer. Vale {"ok":true} (script actual) y "ok" (scripts desplegados antes).
export async function postToSheet(url, payload, timeoutMs = 15000) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout?.(timeoutMs),
  });
  const text = (await res.text()).trim();
  let ok = text === "ok";
  try { ok ||= JSON.parse(text).ok === true; } catch { /* no es JSON */ }
  if (!res.ok || !ok) throw new Error("La hoja no confirmó el guardado");
}
