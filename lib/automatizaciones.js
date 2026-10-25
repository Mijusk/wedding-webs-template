// Lo que el panel necesita saber de cada automatización para editarla: qué huecos puede usar el
// texto, cómo se llaman sus días y un ejemplo para la vista previa. Los textos en sí están en la
// base de datos (tabla automations) y los edita Luis.

export const GROUPS = [
  ["lead", "Contactos que aún no han contratado", "Solo a quien aceptó que le escribiéramos o nos pidió una reserva. Llevan un enlace para darse de baja."],
  ["pareja", "Parejas", "Emails del servicio, a las parejas que han contratado."],
  ["invitados", "Invitados", "En nombre de la pareja, a los invitados con email en su lista."],
  ["luis", "Para ti", ""],
  ["datos", "Datos (plazos de Ajustes)", "Cumplen lo que dice la política de privacidad. Borran datos de verdad: actívalas cuando estés en producción."],
];

export const VAR_LABELS = {
  nombres: "nombres de la pareja", estilo: "estilo que probaron", precio_desde: "precio más barato", enlace: "enlace del botón",
  plan: "lo que pidieron", importe: "lo que falta por pagar", enlace_web: "su web", enlace_panel: "su panel",
  grupo: "nombre del grupo de invitados", pareja: "nombres de la pareja", fecha_limite: "fecha límite para confirmar",
  resumen: "números de la boda", fecha_retirada: "fecha en que se retira la web", enlaces_resena: "enlaces para la reseña",
};

export const INFO = {
  lead_bienvenida: { vars: ["nombres", "estilo", "precio_desde", "enlace"] },
  lead_recordatorio_1: { vars: ["nombres", "estilo", "precio_desde", "enlace"], delay: "Días después de probar su web" },
  lead_recordatorio_2: { vars: ["nombres", "estilo", "precio_desde", "enlace"], delay: "Días después de probar su web" },
  lead_frio: { delay: "Días sin contestar ni reservar" },
  pago_pendiente: { vars: ["nombres", "plan", "importe", "enlace"], delay: "Días después de empezar a pagar" },
  pago_bienvenida: { vars: ["nombres"] },
  faltan_fotos: { vars: ["nombres", "enlace"], delay: "Días después del pago" },
  web_publicada: { vars: ["nombres", "enlace_web", "enlace_panel", "fecha_retirada"] },
  rsvp_recordatorio: { vars: ["grupo", "pareja", "fecha_limite", "enlace"], delay: "Días antes de la fecha límite" },
  rsvp_cerrado: { vars: ["nombres", "resumen", "enlace_panel"], delay: "Días después de la fecha límite" },
  resena: { vars: ["nombres", "enlaces_resena", "fecha_retirada", "enlace_web"], delay: "Días después de la boda" },
  retirada_aviso: { vars: ["nombres", "fecha_retirada", "enlace_web"], delay: "Días antes de retirarla" },
  retirar_webs: {},
  borrar_invitados: {},
  anonimizar_leads: {},
};

export function sampleVars(site = "https://tudominio.es") {
  return {
    nombres: "Lucía y Martín", estilo: "Editorial", precio_desde: "79 €", enlace: `${site}/studio/?prueba=ejemplo`,
    plan: "Web de boda · Tal cual", importe: "79,00 €", enlace_web: `${site}/b/lucia-y-martin`, enlace_panel: `${site}/pareja/`,
    grupo: "Familia Ortega", pareja: "Lucía y Martín", fecha_limite: "1 de mayo de 2027",
    resumen: "86 personas vienen (78 adultos y 8 niños), 12 no vienen y 3 grupos no han contestado.",
    fecha_retirada: "12 de junio de 2028", enlaces_resena: "Google: https://g.page/r/ejemplo/review",
  };
}
