// Mensajes de WhatsApp y email para los leads. {nombre} es el primer nombre de la pareja.
// Se pueden retocar antes de enviar; si cambias el texto de base, cámbialo aquí.

export const MENSAJES = [
  {
    id: "prueba",
    label: "Primer contacto tras la prueba",
    subject: "Vuestra web de boda",
    text: "¡Hola, {nombre}! Soy Luis, de WeddingWebs. He visto que habéis probado vuestra web de boda{estilo}. ¿Qué os ha parecido? Si os gusta, os la dejo lista con vuestros datos y fotos en 3 días, con las confirmaciones de los invitados incluidas.",
  },
  {
    id: "reserva",
    label: "Reserva recibida",
    subject: "Vuestra reserva en WeddingWebs",
    text: "¡Hola, {nombre}! Gracias por reservar vuestra web de boda{tarifa}. Para empezar necesito tres cosas: vuestras fotos (las originales, mejor en JPG), el programa del día y hasta qué fecha pueden confirmar los invitados. ¿Os mando por aquí el enlace de pago?",
  },
  {
    id: "seguimiento",
    label: "Seguimiento",
    subject: "¿Seguimos con vuestra web?",
    text: "¡Hola, {nombre}! ¿Pudisteis pensar lo de la web de boda? Si tenéis cualquier duda sobre estilos, plazos o precio, os la resuelvo por aquí.",
  },
  {
    id: "fotos",
    label: "Pedir fotos y datos",
    subject: "Fotos y datos para vuestra web",
    text: "¡Hola, {nombre}! Ya estoy con vuestra web. Me faltan las fotos (las originales, sin pasar por WhatsApp, que las comprime) y el programa del día. Podéis mandármelas por email o con un enlace de Google Drive o WeTransfer.",
  },
  { id: "libre", label: "Mensaje libre", subject: "", text: "¡Hola, {nombre}! " },
];

export function fillMessage(m, lead) {
  const first = (lead.partner_a || lead.names || "").split(/\s+y\s+|\s/)[0] || "";
  return m.text
    .replace("{nombre}", first)
    .replace("{estilo}", lead.style ? ` con el estilo ${lead.style}` : "")
    .replace("{tarifa}", lead.tier ? ` (${lead.tier})` : "");
}
