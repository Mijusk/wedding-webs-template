// Webs de boda en su subdominio: maria-y-pablo.weddingwebstudio.es/ enseña la boda maria-y-pablo.
//
// Solo actúa en la raíz «/» de un subdominio de boda. Todo lo demás (estilos, fotos, /api/rsvp…) son los
// mismos archivos que en www, así que no hace falta tocarlo. En www y en cualquier otro dominio no hace nada.
// Va aquí y no en vercel.json porque Vercel sirve antes un archivo que exista (el index.html de la raíz,
// que es la plantilla Clásica) que sus reglas de vercel.json; esto se ejecuta antes que los archivos.
// La dirección y los enlaces: lib/direccion.js. Cómo se activa: docs/DOMINIOS.md.
import { DOMINIO, slugFromHost } from "./lib/direccion.js";

export const config = { matcher: "/" };

export default function middleware(request) {
  const url = new URL(request.url);
  const slug = slugFromHost(url.hostname, [process.env.WEDDING_DOMAIN, DOMINIO].filter(Boolean));
  if (!slug) return; // no es una boda: sigue como siempre
  const to = new URL("/api/boda", url);
  for (const [k, v] of url.searchParams) to.searchParams.set(k, v); // ?i= (invitados) y ?vista= (borrador)
  to.searchParams.set("slug", slug);
  to.searchParams.delete("host");
  // Lo mismo que rewrite() de @vercel/functions, sin tener que instalar nada.
  return new Response(null, { headers: { "x-middleware-rewrite": to.href } });
}
