// «Pedir a Claude»: un texto listo para pegar en el chat del proyecto con todo lo que hace falta para
// hacer los cambios de una boda (o diseñar una a medida) sin preguntar nada: quiénes son, su plan,
// lo que han pedido y el config actual. Claude devuelve el JSON entero para pegarlo en
// «Avanzado: todos los textos (JSON)» › Aplicar, o, si hace falta tocar el diseño, prepara el cambio en el repositorio.
const STATUS = { pendiente: "pendiente", hecho: "hecho", descartado: "descartado" };

export function claudeBrief({ w, config, plan, requests = [], lead = null, publicUrl, previewUrl }) {
  const [a, b] = config.event?.couple || [];
  const pending = requests.filter((r) => r.status === "pendiente");
  const done = requests.filter((r) => r.status !== "pendiente");
  const custom = /medida|atelier/i.test(plan || "");
  const ask = custom
    ? "Es un plan Atelier (a medida). Propón un diseño propio a partir de lo que piden abajo. Si cabe en una plantilla existente con cambios de config, devuélveme el JSON entero; si hace falta una plantilla nueva, prepárala en el repositorio y dime cómo se llama."
    : pending.length
      ? "Haz los cambios pendientes de abajo. Devuélveme el JSON entero, listo para pegar en el editor (Avanzado › JSON › Aplicar). Si alguno no se puede hacer solo con el JSON, dímelo y prepara el cambio en el repositorio."
      : "Revisa esta web antes de publicarla (textos, fechas, erratas) y devuélveme el JSON entero corregido, listo para pegar en el editor.";
  const line = (r) => `- [${r.kind === "cambio" ? "Cambio de diseño" : "Corrección"}${r.proposal_number ? `, propuesta ${r.proposal_number}` : ""}, ${String(r.created_at || "").slice(0, 10)}] ${r.message}${r.reply ? `\n  (Respondimos: ${r.reply})` : ""}`;
  return [
    `Claude, una boda de WeddingWebs para ti.`,
    ``,
    `Pareja: ${[a, b].filter(Boolean).join(" y ") || w.slug}`,
    `Plan: ${plan || "sin pedido"}`,
    `Fecha de la boda: ${w.wedding_date || String(config.event?.date || "").slice(0, 10) || "?"}`,
    `Plantilla: ${w.template} · estilo (theme): ${config.theme || "?"}`,
    `Dirección: ${publicUrl}${previewUrl ? ` · vista previa: ${previewUrl}` : ""}`,
    `Estado: ${w.status}`,
    lead?.message ? `\nLo que escribieron al reservar:\n${lead.message}` : "",
    ``,
    `Qué necesito: ${ask}`,
    ``,
    pending.length ? `Pendiente:\n${pending.map(line).join("\n")}` : "Pendiente: nada.",
    done.length ? `\nYa resuelto (para que tengas el contexto):\n${done.map((r) => `${line(r)} → ${STATUS[r.status] || r.status}`).join("\n")}` : "",
    ``,
    `Config actual (las fotos son enlaces; no las cambies si no lo piden):`,
    "```json",
    JSON.stringify(config, null, 2),
    "```",
  ].filter((x) => x !== "").join("\n").replace(/\n{3,}/g, "\n\n");
}
