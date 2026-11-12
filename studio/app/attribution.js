// Atribución de publicidad: de qué anuncio o web llegó la pareja (utm_*, gclid, fbclid, página de
// entrada y web de origen). Viaja con el lead para saber qué campaña trae bodas.
//
// Sin consentimiento solo se guarda en sessionStorage (se borra al cerrar la pestaña), para no
// perderlo al pasar de plantillas.html a la portada. Si aceptan las cookies de publicidad, se
// guarda también en localStorage durante 90 días: así el primer toque sobrevive entre visitas.
// Si las rechazan (o las retiran), se borra lo guardado.
import { adsAllowed, onConsentChange } from "./consent.js";

const KEY = "ww-attribution";
const MAX_AGE_DAYS = 90;
const PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];

const store = {
  get(s) { try { return JSON.parse(s.getItem(KEY) || "null"); } catch { return null; } },
  set(s, v) { try { s.setItem(KEY, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
  del(s) { try { s.removeItem(KEY); } catch { /* sin almacenamiento */ } },
};

function fresh(a) {
  if (!a?.first?.captured_at) return null;
  return Date.now() - Date.parse(a.first.captured_at) < MAX_AGE_DAYS * 864e5 ? a : null;
}

function read() {
  const kept = adsAllowed() ? fresh(store.get(localStorage)) : null;
  const visit = store.get(sessionStorage);
  // El primer toque de verdad es el más antiguo; el último, el de esta visita si lo hay.
  if (kept && visit) return { first: kept.first, last: visit.last || kept.last };
  return kept || visit || {};
}

function write(a) {
  store.set(sessionStorage, a);
  if (adsAllowed()) store.set(localStorage, a);
}

onConsentChange((c) => {
  if (c.ads) { const a = read(); if (a.first) store.set(localStorage, a); }
  else store.del(localStorage);
});

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
  write({ first: saved.first || now, last: now });
}

export const attribution = () => {
  const a = read();
  return a.first ? a : undefined;
};
