// GET /api/panel-config  ·  lo que el panel necesita para hablar con Supabase desde el navegador:
// la URL del proyecto y la clave PUBLICABLE (pensada para estar en el navegador; los datos los
// protege la seguridad por filas). La clave secreta nunca sale de aquí.
import { config } from "./_lib/supabase.js";
import { sendJson, origin } from "./_lib/http.js";

export default async function handler(req, res) {
  const { url, anonKey } = config();
  if (!url || !anonKey) return sendJson(res, 503, { ok: false, error: "no_configurado" });
  // Qué está conectado (sin dar ninguna clave): para avisar en el panel de lo que aún es simulado.
  const emails = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  const pagos = Boolean(process.env.STRIPE_SECRET_KEY);
  return sendJson(res, 200, { ok: true, supabaseUrl: url, supabaseKey: anonKey, siteUrl: origin(req), emails, pagos },
    { "Cache-Control": "public, max-age=60" });
}
