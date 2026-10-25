// Atribución de publicidad: de qué anuncio o web llegó la pareja (utm_*, gclid, fbclid, página de
// entrada y web de origen). Viaja con el lead para saber qué campaña trae bodas.
//
// Solo se guarda en sessionStorage (se borra al cerrar la pestaña) para no perderlo al pasar de
// plantillas.html a la portada. Guardarlo entre visitas (primer toque de verdad) necesita el
// consentimiento de cookies de publicidad: llegará con el banner de cookies (fase 6).
const KEY = "ww-attribution";
const PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];

function read() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || "{}"); } catch { return {}; }
}

export function captureAttribution() {
  const q = new URLSearchParams(location.search);
  const touch = Object.fromEntries(PARAMS.filter((p) => q.get(p)).map((p) => [p, q.get(p).slice(0, 300)]));
  let external = false;
  try { external = Boolean(document.referrer) && new URL(document.referrer).origin !== location.origin; } catch { /* sin referrer */ }
  const saved = read();
  if (!Object.keys(touch).length && !external && saved.first) return;
  const now = {
    ...touch,
    landing_page: (location.pathname + location.search).slice(0, 500),
    referrer: external ? document.referrer.slice(0, 500) : undefined,
    captured_at: new Date().toISOString(),
  };
  const next = { first: saved.first || now, last: now };
  try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch { /* sin almacenamiento */ }
}

export const attribution = () => {
  const a = read();
  return a.first ? a : undefined;
};
