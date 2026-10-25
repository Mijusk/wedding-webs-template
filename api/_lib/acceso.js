// Acceso de las parejas: enlaces mágicos sin contraseña.
//
// El enlace apunta a NUESTRA web (/pareja/#acceso=<clave>), no a Supabase. Así:
//  - no hay que configurar "Redirect URLs" en Supabase para cada dominio;
//  - los robots que abren los enlaces de WhatsApp o del correo para hacer la vista previa no lo
//    gastan: la clave va detrás de "#", no llega a ningún servidor, y solo se usa cuando la pareja
//    abre la página (el navegador la canjea por una sesión).
import { authAdmin, rpcAs, SupabaseError } from "./supabase.js";
import { config } from "./supabase.js";

export async function magicLink(email, origin) {
  // Crea el usuario si no existe (aunque el registro público esté cerrado) y genera el enlace.
  try {
    await authAdmin("users", { email, email_confirm: true });
  } catch (e) {
    if (!(e instanceof SupabaseError) || ![409, 422].includes(e.status)) throw e; // ya existía: perfecto
  }
  const r = await authAdmin("generate_link", { type: "magiclink", email });
  const hashed = r.hashed_token || r.properties?.hashed_token;
  if (!hashed) throw new Error("Supabase no ha devuelto el enlace de acceso.");
  return `${origin}/pareja/#acceso=${encodeURIComponent(hashed)}`;
}

// Quién llama (por su token de sesión). Devuelve el token si es válido, o null.
export async function callerToken(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || token.split(".").length !== 3) return null;
  const { url, anonKey } = config();
  try {
    const res = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) });
    return res.ok ? token : null;
  } catch {
    return null;
  }
}

export const isStaff = async (token) => (await rpcAs(token, "soy_del_equipo")) === true;
export const canManage = async (token, weddingId) => (await rpcAs(token, "puedo_gestionar_boda", { p_wedding_id: weddingId })) === true;
