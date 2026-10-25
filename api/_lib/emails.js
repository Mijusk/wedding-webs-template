// Textos de los emails que manda la web a las parejas y a sus invitados.
// Texto plano + un HTML sencillo (se ve bien en cualquier cliente de correo).
import { esc } from "./http.js";

const html = (paragraphs, button) => `<!doctype html><html lang="es"><body style="margin:0;background:#f6f4f1;padding:24px 12px;font:16px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f1a24">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px">
${paragraphs.map((p) => `<p style="margin:0 0 14px">${p}</p>`).join("\n")}
${button ? `<p style="margin:22px 0"><a href="${esc(button.url)}" style="display:inline-block;background:#7d2a4b;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">${esc(button.label)}</a></p>
<p style="margin:0;font-size:13px;color:#675f6d">Si el botón no funciona, copia este enlace: ${esc(button.url)}</p>` : ""}
</div>
<p style="text-align:center;font-size:12px;color:#958d99;margin-top:16px">WeddingWebs</p>
</body></html>`;

const names = (couple) => (Array.isArray(couple) ? couple.filter(Boolean).join(" y ") : "");

export function accessEmail({ link, couple }) {
  const who = names(couple);
  const subject = who ? `Entrad en la web de ${who}` : "Entrad en vuestra web de boda";
  const lines = [
    "¡Hola!",
    "Con este enlace entráis en el panel de vuestra web de boda: invitados, respuestas, horario y regalo.",
    "El enlace sirve una sola vez y caduca en unas horas. Después os quedáis dentro en ese móvil u ordenador.",
  ];
  return {
    subject,
    text: `${lines.join("\n\n")}\n\n${link}\n\nSi no lo habéis pedido, ignorad este email.\n\nWeddingWebs`,
    html: html([...lines.map(esc), "Si no lo habéis pedido, ignorad este email."], { url: link, label: "Entrar en nuestro panel" }),
  };
}

export function reminderEmail({ group, link, couple, deadline }) {
  const who = names(couple) || "los novios";
  const when = deadline ? ` antes del ${new Date(`${deadline}T12:00:00Z`).toLocaleDateString("es-ES", { day: "numeric", month: "long", timeZone: "UTC" })}` : "";
  const lines = [
    `¡Hola, ${esc(group)}!`,
    `${esc(who)} os esperan en su boda y aún no sabemos si podréis venir. ¿Nos lo decís${esc(when)}? Es un momento.`,
  ];
  return {
    subject: `${who}: ¿venís a la boda?`,
    text: `¡Hola, ${group}!\n\n${who} os esperan en su boda y aún no sabemos si podréis venir. ¿Nos lo decís${when}? Es un momento:\n\n${link}\n\n${who}`,
    html: html(lines, { url: link, label: "Confirmar asistencia" }),
  };
}

export function digestEmail({ couple, nuevas, stats, link }) {
  const who = names(couple);
  const n = nuevas.length;
  const line = (r) => `${r.name}: ${r.attending ? `sí${r.adults || r.children ? ` (${[r.adults && `${r.adults} adulto${r.adults === 1 ? "" : "s"}`, r.children && `${r.children} niño${r.children === 1 ? "" : "s"}`].filter(Boolean).join(", ")})` : ""}` : "no"}`;
  const totals = `En total: ${stats.personas} personas confirmadas (${stats.adultos} adultos y ${stats.ninos} niños), ${stats.no} que no vienen` +
    (stats.grupos ? ` y ${stats.pendientes} grupos sin contestar.` : ".");
  const subject = `${n === 1 ? "Una respuesta nueva" : `${n} respuestas nuevas`} en vuestra web de boda`;
  return {
    subject,
    text: `¡Hola, ${who}!\n\n${n === 1 ? "Ha llegado una respuesta nueva" : `Han llegado ${n} respuestas nuevas`}:\n\n${nuevas.slice(0, 30).map((r) => `· ${line(r)}`).join("\n")}${n > 30 ? `\n· …y ${n - 30} más` : ""}\n\n${totals}\n\nVer todas: ${link}\n\nPara dejar de recibir este resumen, cambiadlo en vuestro panel (Avisos).`,
    html: html([
      `¡Hola, ${esc(who)}!`,
      n === 1 ? "Ha llegado una respuesta nueva:" : `Han llegado ${n} respuestas nuevas:`,
      nuevas.slice(0, 30).map((r) => `· ${esc(line(r))}`).join("<br>") + (n > 30 ? `<br>· …y ${n - 30} más` : ""),
      esc(totals),
      `<span style="font-size:13px;color:#675f6d">Para dejar de recibir este resumen, cambiadlo en vuestro panel (Avisos).</span>`,
    ], { url: link, label: "Ver todas las respuestas" }),
  };
}
