// Emails: el diseño común y los textos con huecos ({nombres}, {enlace}…) que Luis edita en el panel.
// Lo usan el servidor (para mandarlos) y el panel (para la vista previa): se ven igual en los dos.

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Diseño sencillo que se ve bien en cualquier programa de correo. paragraphs: HTML ya escapado.
export function emailHtml(paragraphs, button, footer = "") {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f6f4f1;padding:24px 12px;font:16px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f1a24">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px">
${paragraphs.map((p) => `<p style="margin:0 0 14px">${p}</p>`).join("\n")}
${button ? `<p style="margin:22px 0"><a href="${esc(button.url)}" style="display:inline-block;background:#7d2a4b;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">${esc(button.label)}</a></p>
<p style="margin:0;font-size:13px;color:#675f6d">Si el botón no funciona, copia este enlace: ${esc(button.url)}</p>` : ""}
</div>
<p style="text-align:center;font-size:12px;color:#958d99;margin-top:16px">WeddingWebs${footer ? `<br>${footer}` : ""}</p>
</body></html>`;
}

// Rellena los huecos. Los que no existen se quedan vacíos (y el panel avisa al guardar).
export const fill = (text, vars = {}) => String(text ?? "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? "" : String(vars[k])));

// Huecos de un texto, para avisar de los mal escritos.
export const placeholders = (text) => [...new Set([...String(text ?? "").matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)»])/g;

// Texto con huecos -> email listo: asunto, texto plano y HTML. Párrafos separados por una línea en blanco.
export function renderTemplate({ subject, body, button_label: buttonLabel }, vars = {}, { link, unsubscribe } = {}) {
  const text = fill(body, vars).trim();
  const paragraphs = text.split(/\n\s*\n/).map((p) => esc(p).replace(URL_RE, '<a href="$1" style="color:#7d2a4b">$1</a>').replace(/\n/g, "<br>"));
  const button = link && buttonLabel ? { url: link, label: fill(buttonLabel, vars) } : null;
  const footer = unsubscribe
    ? `Si no queréis recibir más emails nuestros, <a href="${esc(unsubscribe)}" style="color:#958d99">daos de baja aquí</a>.`
    : "";
  return {
    subject: fill(subject, vars).replace(/\s+/g, " ").trim(),
    text: `${text}${button ? `\n\n${button.label}: ${button.url}` : ""}\n\nWeddingWebs${unsubscribe ? `\n\nPara no recibir más emails nuestros: ${unsubscribe}` : ""}`,
    html: emailHtml(paragraphs, button, footer),
  };
}
