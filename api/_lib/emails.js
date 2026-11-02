// Textos de los emails que manda la web a las parejas y a sus invitados.
// Texto plano + un HTML sencillo (se ve bien en cualquier cliente de correo).
import { esc, emailHtml, fill } from "../../lib/email.js";

const html = (paragraphs, button) => emailHtml(paragraphs, button);

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

const eur = (cents) => `${(cents / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const longDate = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) : "");

// Confirmación del pago (es el «soporte duradero» de la contratación: lleva lo esencial y las condiciones).
// extra: el bloque «Qué necesitamos» de Panel › Automatizaciones, si está activo.
export function paymentEmail({ names, number, plan, amountCents, promised, trackingUrl, code, conditionsUrl, invoiceNumber, extra }) {
  const extraParagraphs = extra ? fill(extra, { nombres: names, pedido: number }).trim().split(/\n\s*\n/) : [];
  const lines = [
    `¡Hola${names ? `, ${names}` : ""}!`,
    `Hemos recibido vuestro pago de ${eur(amountCents)}${plan ? ` por la web de boda «${plan}»` : ""}. Pedido ${number}.`,
    promised ? `Os la entregamos como tarde el ${longDate(promised)} (cuenta desde que tenemos vuestros datos y fotos).` : "",
    `En vuestra página de seguimiento veréis cómo va, las propuestas que os mandemos y podréis pedir cambios. Vuestro código es ${code}; no hace falta contraseña.`,
    ...extraParagraphs,
    invoiceNumber ? `Os adjuntamos la factura ${invoiceNumber}.` : "La factura os llegará en un email aparte.",
    `Las condiciones de contratación, por si las queréis guardar: ${conditionsUrl}`,
  ].filter(Boolean);
  return {
    subject: `Pago recibido · pedido ${number}`,
    text: `${lines.join("\n\n")}\n\nSeguimiento: ${trackingUrl}\n\nWeddingWebs`,
    html: html(lines.map((l) => esc(l).replace(/\n/g, "<br>")), { url: trackingUrl, label: "Ver cómo va nuestra web" }),
  };
}

export function proposalEmail({ names, number, note, trackingUrl }) {
  const lines = [
    `¡Hola${names ? `, ${names}` : ""}!`,
    `Ya tenéis la propuesta ${number} de vuestra web. Miradla con calma, en el móvil y en el ordenador.`,
    note ? `Nuestra nota: «${note}»` : "",
    "Si os encanta, pulsad «¡Nos encanta, publicadla!». Si queréis cambiar algo, escribidlo en «Pedir cambios».",
  ].filter(Boolean);
  return {
    subject: `Vuestra web: propuesta ${number} lista`,
    text: `${lines.join("\n\n")}\n\n${trackingUrl}\n\nWeddingWebs`,
    html: html(lines.map(esc), { url: trackingUrl, label: `Ver la propuesta ${number}` }),
  };
}

export function refundEmail({ names, number, amountCents, invoiceNumber, trackingUrl }) {
  const lines = [
    `¡Hola${names ? `, ${names}` : ""}!`,
    `Os hemos devuelto ${eur(amountCents)} del pedido ${number}. Según vuestro banco, puede tardar unos días en verse.`,
    invoiceNumber ? `Os adjuntamos la factura rectificativa ${invoiceNumber}.` : "",
  ].filter(Boolean);
  return {
    subject: `Devolución de ${eur(amountCents)} · pedido ${number}`,
    text: `${lines.join("\n\n")}\n\n${trackingUrl}\n\nWeddingWebs`,
    html: html(lines.map(esc), trackingUrl ? { url: trackingUrl, label: "Ver el pedido" } : null),
  };
}
