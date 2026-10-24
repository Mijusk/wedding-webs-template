// Acceso del servidor a Supabase con la clave secreta. Solo se usa en las funciones de /api:
// esta clave nunca llega al navegador.
//
// Variables de entorno (Vercel > Settings > Environment Variables):
//   SUPABASE_URL                 https://<proyecto>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    la clave secreta (sb_secret_... o la antigua service_role eyJ...)
//   SUPABASE_ANON_KEY            la clave publicable (sb_publishable_... o la antigua anon eyJ...)

export const config = () => ({
  url: (process.env.SUPABASE_URL || "").replace(/\/+$/, ""),
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "",
  anonKey: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "",
});

export const isConfigured = () => {
  const c = config();
  return Boolean(c.url && c.serviceKey);
};

// Las claves nuevas (sb_secret_...) van solo en "apikey"; las antiguas (JWT) también como Bearer.
function headers(key, extra = {}) {
  const h = { apikey: key, "Content-Type": "application/json", ...extra };
  if (key.startsWith("eyJ")) h.Authorization = `Bearer ${key}`;
  return h;
}

export class SupabaseError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request(path, { method = "GET", body, prefer, timeoutMs = 8000 } = {}) {
  const { url, serviceKey } = config();
  if (!url || !serviceKey) throw new SupabaseError("Supabase no está configurado (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).", 503);
  const res = await fetch(`${url}${path}`, {
    method,
    headers: headers(serviceKey, prefer ? { Prefer: prefer } : {}),
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new SupabaseError(data?.message || `Supabase respondió ${res.status}`, res.status, data);
  return data;
}

// Llama a una función de la base de datos: rpc("api_submit_rsvp", { p_slug: "..." })
export const rpc = (name, args = {}) => request(`/rest/v1/rpc/${name}`, { method: "POST", body: args });

// Inserta filas en una tabla (p. ej. email_log). Devuelve las filas creadas.
export const insert = (table, rows) =>
  request(`/rest/v1/${table}`, { method: "POST", body: rows, prefer: "return=representation" });
