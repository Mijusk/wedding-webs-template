// Avisos a Luis y emails transaccionales. Todo es opcional: sin claves, no se envía nada y se apunta
// como "simulado" en email_log, sin romper la petición.
//
//   RESEND_API_KEY   clave de Resend (o el proveedor que se elija; el resto del código no cambia)
//   EMAIL_FROM       remitente verificado, p. ej. "WeddingWebs <hola@tudominio.es>"
//   NOTIFY_EMAIL     a quién avisar de leads nuevos (Luis)
//   TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID   aviso instantáneo al móvil por Telegram (opcional)
import { insert } from "./supabase.js";

// attachments: [{ filename, content: Buffer }] (p. ej. la factura en PDF). meta: datos para el registro.
// replyTo: a quién van las respuestas (p. ej. el email de Luis). headers: cabeceras extra (baja en un clic).
export async function sendEmail({ to, subject, text, html, template, leadId, clientId, weddingId, attachments, meta, replyTo, headers }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  let status = "simulado", providerId = null, error = null;
  if (key && from && to) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from, to: [to], subject, text, html,
          ...(replyTo ? { reply_to: replyTo } : {}),
          ...(headers ? { headers } : {}),
          ...(attachments?.length ? { attachments: attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64") })) } : {}),
        }),
        signal: AbortSignal.timeout(attachments?.length ? 10000 : 5000),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { status = "enviado"; providerId = data.id || null; }
      else { status = "fallido"; error = data.message || `HTTP ${res.status}`; }
    } catch (e) {
      status = "fallido"; error = e.message;
    }
  }
  try {
    await insert("email_log", {
      to_email: to || "(sin destinatario)", template, subject, provider: key ? "resend" : null, provider_id: providerId,
      status, error, lead_id: leadId || null, client_id: clientId || null, wedding_id: weddingId || null,
      meta: { ...(meta || {}), ...(attachments?.length ? { adjuntos: attachments.map((a) => a.filename) } : {}) },
    });
  } catch (e) {
    console.error("email_log", e.message);
  }
  return { ok: status === "enviado", status, error };
}

export async function telegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const fecha = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

// Aviso de lead nuevo o reserva, en menos de un minuto.
export async function notifyLead({ lead, payload, panelUrl }) {
  const names = lead.names || payload.name || payload.email;
  const subject = lead.type === "reserva"
    ? `Reserva: ${names}${payload.tier ? ` (${payload.tier})` : ""}`
    : `Nueva prueba: ${names}${payload.weddingDate ? `, boda el ${fecha(payload.weddingDate)}` : ""}`;
  const details = [
    subject,
    `Email: ${payload.email}`,
    payload.phone && `Teléfono: ${payload.phone}`,
    payload.venue && `Lugar: ${payload.venue}`,
    payload.style && `Estilo: ${payload.style}`,
    payload.message && `Mensaje: ${payload.message}`,
  ].filter(Boolean);
  const text = `${details.join("\n")}\n\nFicha en el panel: ${panelUrl}`;
  const to = process.env.NOTIFY_EMAIL;
  const [mail, tg] = await Promise.all([
    to ? sendEmail({ to, subject, text, template: "aviso_lead", leadId: lead.lead_id }) : Promise.resolve(null),
    telegram(text),
  ]);
  return { email: mail?.status || "sin_configurar", telegram: tg };
}

// Aviso a Luis (email y Telegram) de algo que ha pasado sin él: un pago, cambios pedidos…
export async function notifyLuis({ subject, lines = [], panelUrl }) {
  const text = [subject, ...lines.filter(Boolean), panelUrl ? `\nEn el panel: ${panelUrl}` : ""].filter(Boolean).join("\n");
  const to = process.env.NOTIFY_EMAIL;
  const [mail, tg] = await Promise.all([
    to ? sendEmail({ to, subject, text, template: "aviso_luis" }) : Promise.resolve(null),
    telegram(text),
  ]);
  return { email: mail?.status || "sin_configurar", telegram: tg };
}
