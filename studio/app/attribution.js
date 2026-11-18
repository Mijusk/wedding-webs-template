// Atribución de publicidad: de qué anuncio o web llegó la pareja (utm_*, gclid, fbclid, página de
// entrada y web de origen). Viaja con el lead para saber qué campaña trae bodas.
//
// Es de la categoría «publicidad» del aviso de cookies:
//   · Con permiso: se guarda en el navegador («ww-attribution»): en sessionStorage para la visita y
//     en localStorage 90 días, para que el primer toque sobreviva entre visitas.
//   · Sin permiso (o al retirarlo): no se guarda nada y se borra lo que hubiera. Solo se recuerda en
//     memoria mientras están en esta página, por si dejan sus datos aquí mismo.
import { adsAllowed, onConsentChange } from "./consent.js";

export const KEY = "ww-attribution";
const MAX_AGE_DAYS = 90;
const PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];
let memory = null;

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
  if (!adsAllowed()) return memory || {};
  const kept = fresh(store.get(localStorage));
  const visit = store.get(sessionStorage) || memory;
  // El primer toque de verdad es el más antiguo; el último, el de esta visita si lo hay.
  if (kept && visit) return { first: kept.first, last: visit.last || kept.last };
  return kept || visit || {};
}

function write(a) {
  memory = a;
  if (!adsAllowed()) return;
  store.set(sessionStorage, a);
  store.set(localStorage, a);
}

export function forgetAttribution() {
  store.del(localStorage);
  store.del(sessionStorage);
}

onConsentChange((c) => {
  if (c.publicidad) { if (memory?.first) write(memory); }
  else forgetAttribution();
});

export function captureAttribution() {
  // Sin permiso, que no quede nada de antes (p. ej. de la versión anterior del aviso).
  if (!adsAllowed()) forgetAttribution();
  const q = new URLSearchParams(location.search);
  const touch = Object.fromEntries(PARAMS.filter((p) => q.get(p)).map((p) => [p, q.get(p).slice(0, 300)]));
  let external = false;
  try { external = Boolean(document.referrer) && new URL(document.referrer).origin !== location.origin; } catch { /* sin referrer */ }
  const saved = read();
  if (!Object.keys(touch).length && !external && saved.first) { memory = saved; return; }
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
