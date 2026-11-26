// «Textos de la web» del editor de bodas: todos los textos de la plantilla (config.copy, y config.copy_en en
// las bilingües) como campos con nombre en castellano, agrupados por sección. Así se cambia cualquier texto
// sin tocar el JSON. Sirve para las 45 plantillas porque sale de los textos que tenga cada web.

const LABELS = {
  eyebrow: "Texto pequeño de encima", title: "Título", text: "Texto", body: "Texto", intro: "Introducción",
  name: "Nombre", label: "Etiqueta", labels: "Etiqueta", note: "Nota", notes: "Nota", hint: "Pista", caption: "Pie de foto",
  greeting: "Saludo", thanks: "Agradecimiento", invite: "Invitación", credit: "Crédito", alt: "Descripción de la imagen",
  date: "Fecha", time: "Hora", place: "Lugar", end: "Final",
  when: "Encabezado «cuándo»", where: "Encabezado «dónde»", map: "Botón del mapa", timeSuffix: "Detrás de la hora",
  countdown: "Cuenta atrás", countdownOne: "Cuenta atrás cuando falta 1 día", countdownToday: "Cuenta atrás el mismo día",
  calendar: "Botón «añadir al calendario»", calendarTitle: "Título del evento en el calendario",
  after: "Texto cuando la boda ya ha pasado", today: "Texto el día de la boda",
  holderLabel: "Encabezado del titular", ibanLabel: "Encabezado del IBAN", copy: "Botón «copiar»", copied: "Aviso al copiar",
  reveal: "Botón para ver la cuenta",
  deadlineNote: "Aviso de la fecha límite", attending: "Pregunta «¿venís?»", yes: "Respuesta «sí»", no: "Respuesta «no»",
  song: "Pregunta de la canción", songPlaceholder: "Ejemplo dentro de la casilla de la canción", submit: "Botón «enviar»",
  sending: "Mientras se envía", errorName: "Error si falta el nombre", errorAttending: "Error si no dicen si vienen",
  errorNetwork: "Error si no hay conexión", closedText: "Texto cuando ya no se puede confirmar",
  thanksYesTitle: "Gracias si vienen: título", thanksYesText: "Gracias si vienen: texto", thanksSong: "Gracias por la canción",
  thanksNoTitle: "Gracias si no vienen: título", thanksNoText: "Gracias si no vienen: texto", close: "Botón «cerrar»",
};

const SECTIONS = {
  hero: "Portada", details: "Fecha y lugar", story: "Vuestra historia", schedule: "Programa del día", gallery: "Fotos",
  gifts: "Regalo", closing: "Cierre", rsvp: "Confirmación de asistencia", dresscode: "Vestimenta", liturgy: "Ceremonia",
  travel: "Viaje y cómo llegar", cities: "Las dos ciudades", card: "Tarjeta", letter: "Carta", envelope: "Sobre",
  museum: "Museo", film: "Película", marquee: "Cartel", plates: "Láminas", lang: "Idioma",
};

const isIndex = (k) => /^\d+$/.test(k);
const words = (k) => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
const nameOf = (k) => LABELS[k] || `Texto «${words(k)}»`;

// Nombre de un campo a partir de su ruta dentro de la sección: ["title"], ["labels", "0"], ["notes", "cena", "text"]…
export function labelFor(rest) {
  const keys = rest.filter((k) => !isIndex(k));
  const last = keys.at(-1);
  let label = last ? nameOf(last) : "Texto";
  const parents = keys.slice(0, -1).map((k) => (LABELS[k] ? LABELS[k] : words(k)));
  if (parents.length) label = `${parents.join(" › ")} › ${label}`;
  const idx = rest.findLast(isIndex);
  return idx !== undefined ? `${label} ${Number(idx) + 1}` : label;
}

// Grupos { id, name, hidden, fields: [{ path, label, value, long }] }, primero las secciones que se ven.
export function textGroups(config, info = {}) {
  const visible = new Set(config.sections || []);
  const groups = [];
  for (const root of ["copy", "copy_en"]) {
    for (const [section, value] of Object.entries(config[root] || {})) {
      const fields = [];
      walk(value, [], (rest, v) => fields.push({
        path: [root, section, ...rest].join("."), label: labelFor(rest), value: v, long: v.length > 70 || v.includes("\n"),
      }));
      if (!fields.length) continue;
      const name = info[section]?.name || SECTIONS[section] || words(section);
      groups.push({ id: `${root}.${section}`, name: root === "copy_en" ? `${name} (en inglés)` : name,
        hidden: Boolean(info[section]) && !visible.has(section), fields });
    }
  }
  return groups.sort((a, b) => Number(a.hidden) - Number(b.hidden));
}

function walk(v, rest, add) {
  if (typeof v === "string") return add(rest, v);
  if (Array.isArray(v)) return v.forEach((x, i) => walk(x, [...rest, String(i)], add));
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, [...rest, k], add);
}

// Cambia un texto sin borrar la clave aunque quede vacío (la plantilla espera encontrarla).
export function setText(config, path, value) {
  const keys = path.split(".");
  let cur = config;
  for (const k of keys.slice(0, -1)) {
    if (cur[k] == null || typeof cur[k] !== "object") return false;
    cur = cur[k];
  }
  if (typeof cur[keys.at(-1)] !== "string") return false;
  cur[keys.at(-1)] = value;
  return true;
}

// Para el buscador: sin tildes ni mayúsculas.
export const plain = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
