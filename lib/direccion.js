// Dirección pública de cada web de boda. Un solo sitio para todo: panel, panel de la pareja, emails y la web.
//
//   · Con el subdominio activado (variable WEDDING_DOMAIN=weddingwebstudio.es en Vercel):
//       https://maria-y-pablo.weddingwebstudio.es
//   · Sin activar (o en local y en las vistas previas de Vercel), como siempre:
//       https://www.weddingwebstudio.es/b/maria-y-pablo
//
// /b/<slug> sigue funcionando siempre: los enlaces ya mandados no se rompen nunca.
// Cómo se activa: docs/DOMINIOS.md.

export const DOMINIO = "weddingwebstudio.es";
const SLUG = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/;
const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

// El dominio de las webs si está activado y bien escrito; si no, null.
export const cleanDomain = (d) => {
  const s = String(d || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^\*\./, "").replace(/\/+$/, "");
  return DOMAIN.test(s) ? s : null;
};

// site: la web principal (p. ej. https://www.weddingwebstudio.es); domain: el de las webs, o null.
export function weddingUrl(slug, { site = "", domain = null } = {}) {
  const d = cleanDomain(domain);
  return d && SLUG.test(slug) ? `https://${slug}.${d}` : `${String(site).replace(/\/+$/, "")}/b/${slug}`;
}

// Enlace personal de un grupo de invitados.
export const inviteUrl = (slug, token, opts) => `${weddingUrl(slug, opts)}?i=${encodeURIComponent(token)}`;

// ¿Este host es el subdominio de una boda? Devuelve su slug, o null (www, la web principal, otros dominios…).
export function slugFromHost(host, domains = [DOMINIO]) {
  const h = String(host || "").toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  for (const raw of domains) {
    const d = cleanDomain(raw);
    if (!d || !h.endsWith(`.${d}`)) continue;
    const sub = h.slice(0, -(d.length + 1));
    return sub !== "www" && SLUG.test(sub) ? sub : null;
  }
  return null;
}
