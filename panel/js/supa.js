// Cliente mínimo de Supabase para el navegador (acceso, datos, funciones y fotos), sin dependencias
// ni CDNs de terceros: el panel no carga nada de fuera, igual que las plantillas.
// Usa la clave PUBLICABLE (la da /api/panel-config). Lo que cada usuario puede ver o cambiar lo decide
// la seguridad por filas de la base de datos, no este archivo.

const SESSION_KEY = "ww-panel-session";
let cfg = null;
let session = null;
let refreshing = null;
const listeners = new Set();

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function init() {
  const res = await fetch("/api/panel-config", { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new ApiError("El panel aún no está conectado a Supabase (faltan las variables en Vercel).", res.status, "no_configurado");
  cfg = data;
  try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { session = null; }
  return cfg;
}

export const siteUrl = () => cfg?.siteUrl || location.origin;
export const currentSession = () => session;
export const onAuthChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

function saveSession(s) {
  session = s && { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600), user: s.user };
  try { session ? localStorage.setItem(SESSION_KEY, JSON.stringify(session)) : localStorage.removeItem(SESSION_KEY); } catch { /* sin almacenamiento */ }
  listeners.forEach((fn) => fn(session));
}

function baseHeaders(extra = {}) {
  const h = { apikey: cfg.supabaseKey, ...extra };
  if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
  else if (cfg.supabaseKey.startsWith("eyJ")) h.Authorization = `Bearer ${cfg.supabaseKey}`;
  return h;
}

async function parse(res) {
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = data?.msg || data?.message || data?.error_description || data?.error || `Error ${res.status}`;
    throw new ApiError(translate(msg, data?.code || data?.error_code), res.status, data?.code || data?.error_code, data);
  }
  return data;
}

function translate(msg, code) {
  if (/invalid login credentials/i.test(msg)) return "Email o contraseña incorrectos.";
  if (/email not confirmed/i.test(msg)) return "Falta confirmar el email.";
  if (code === "42501" || /permission denied|row-level security/i.test(msg)) return "No tienes permiso para hacer esto.";
  if (code === "23505") return "Ya existe otro con ese valor (tiene que ser único).";
  if (/JWT expired/i.test(msg)) return "La sesión ha caducado. Vuelve a entrar.";
  return msg;
}

// ── Acceso ─────────────────────────────────────────────────

async function auth(path, body, { bearer = false } = {}) {
  const res = await fetch(`${cfg.supabaseUrl}/auth/v1/${path}`, {
    method: "POST",
    headers: bearer ? baseHeaders({ "Content-Type": "application/json" }) : { apikey: cfg.supabaseKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parse(res);
}

export async function signIn(email, password) {
  saveSession(await auth("token?grant_type=password", { email, password }));
  return session;
}

export async function signOut() {
  try { if (session) await auth("logout", {}, { bearer: true }); } catch { /* da igual: se borra la sesión local */ }
  saveSession(null);
}

// Email con enlace para elegir contraseña nueva (vuelve a /panel/ con el token en la URL).
export const sendPasswordReset = (email) =>
  auth(`recover?redirect_to=${encodeURIComponent(`${location.origin}/panel/`)}`, { email });

export async function updatePassword(password) {
  const res = await fetch(`${cfg.supabaseUrl}/auth/v1/user`, {
    method: "PUT", headers: baseHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ password }),
  });
  return parse(res);
}

// Al volver del email de recuperación, Supabase deja la sesión en la URL (#access_token=...).
export function consumeUrlSession() {
  const h = new URLSearchParams(location.hash.replace(/^#/, ""));
  if (!h.get("access_token")) return null;
  saveSession({
    access_token: h.get("access_token"), refresh_token: h.get("refresh_token"),
    expires_in: Number(h.get("expires_in") || 3600), user: null,
  });
  history.replaceState(null, "", location.pathname);
  return h.get("type") || "magiclink";
}

async function ensureFresh() {
  if (!session) return;
  if (session.expires_at * 1000 - Date.now() > 60_000) return;
  refreshing ||= auth("token?grant_type=refresh_token", { refresh_token: session.refresh_token })
    .then(saveSession)
    .catch(() => saveSession(null))
    .finally(() => { refreshing = null; });
  await refreshing;
}

// ── Datos (PostgREST) ──────────────────────────────────────

async function rest(path, { method = "GET", body, prefer, count = false } = {}) {
  await ensureFresh();
  const headers = baseHeaders({ "Content-Type": "application/json" });
  const p = [prefer, count && "count=exact"].filter(Boolean).join(",");
  if (p) headers.Prefer = p;
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (res.status === 401) { saveSession(null); }
  const data = await parse(res);
  if (!count) return data;
  const total = Number((res.headers.get("content-range") || "").split("/")[1]);
  return { data, count: Number.isFinite(total) ? total : data?.length || 0 };
}

const qs = (params = {}) => new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();

export const db = {
  // db.select("leads", { select: "*", status: "eq.nuevo", order: "created_at.desc", limit: 50 })
  select: (table, params = {}, opts = {}) => rest(`${table}?${qs(params)}`, opts),
  one: async (table, params = {}) => (await rest(`${table}?${qs({ ...params, limit: 1 })}`))[0] || null,
  insert: (table, rows) => rest(table, { method: "POST", body: rows, prefer: "return=representation" }),
  update: (table, filter, patch) => rest(`${table}?${qs(filter)}`, { method: "PATCH", body: patch, prefer: "return=representation" }),
  remove: (table, filter) => rest(`${table}?${qs(filter)}`, { method: "DELETE", prefer: "return=representation" }),
  rpc: (name, args = {}) => rest(`rpc/${name}`, { method: "POST", body: args }),
};

// ── Fotos (Supabase Storage) ───────────────────────────────

export const storage = {
  async upload(bucket, path, blob) {
    await ensureFresh();
    const res = await fetch(`${cfg.supabaseUrl}/storage/v1/object/${bucket}/${path}`, {
      method: "POST",
      headers: baseHeaders({ "Content-Type": blob.type || "application/octet-stream", "x-upsert": "false", "cache-control": "max-age=31536000" }),
      body: blob,
    });
    return parse(res);
  },
  async remove(bucket, path) {
    await ensureFresh();
    const res = await fetch(`${cfg.supabaseUrl}/storage/v1/object/${bucket}/${path}`, { method: "DELETE", headers: baseHeaders() });
    return parse(res);
  },
  publicUrl: (bucket, path) => `${cfg.supabaseUrl}/storage/v1/object/public/${bucket}/${path}`,
};
