// Convierte las filas de un Excel o CSV de invitados en grupos con sus personas.
// Columnas que entiende (en cualquier orden y con o sin tildes):
//   Grupo / Familia / Mesa · Nombre · Apellidos · Niño (sí/no, x, edad) · Email · Teléfono / Móvil / WhatsApp
// Sin columna de grupo, cada fila es su propio grupo. Con solo "Nombre", vale el nombre completo.

const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

const COLUMNS = {
  group: ["grupo", "familia", "group", "unidad familiar", "invitacion"],
  first: ["nombre", "name", "nombre y apellidos", "invitado", "invitada"],
  last: ["apellidos", "apellido", "surname", "last name"],
  child: ["nino", "nina", "ninos", "menor", "nino a", "infantil", "child", "edad"],
  email: ["email", "e mail", "correo", "correo electronico", "mail"],
  phone: ["telefono", "movil", "whatsapp", "tel", "phone", "celular"],
};

function findColumns(header) {
  const h = header.map(norm);
  const pick = (names) => h.findIndex((x) => names.includes(x));
  const cols = Object.fromEntries(Object.entries(COLUMNS).map(([k, names]) => [k, pick(names)]));
  if (cols.first < 0) cols.first = h.findIndex((x) => x.startsWith("nombre"));
  return cols;
}

const isChild = (v) => {
  const s = norm(v);
  if (!s) return false;
  if (/^\d+$/.test(s)) return Number(s) < 14;
  return ["si", "s", "x", "yes", "y", "1", "verdadero", "true", "nino", "nina"].includes(s);
};

export function parseGuestRows(rows) {
  if (!rows.length) return { groups: [], errors: ["El archivo está vacío."] };
  const cols = findColumns(rows[0]);
  if (cols.first < 0) return { groups: [], errors: ["No encuentro la columna «Nombre». La primera fila tiene que ser la cabecera (Grupo, Nombre, Apellidos…)."] };
  const groups = new Map();
  const errors = [];
  rows.slice(1).forEach((r, i) => {
    const cell = (k) => (cols[k] >= 0 ? String(r[cols[k]] ?? "").trim() : "");
    const first = cell("first");
    if (!first) { if (r.some((x) => String(x).trim())) errors.push(`Fila ${i + 2}: falta el nombre.`); return; }
    const last = cell("last");
    const full = [first, last].filter(Boolean).join(" ");
    const groupName = (cell("group") || full).slice(0, 120);
    const key = norm(groupName);
    if (!groups.has(key)) groups.set(key, { name: groupName, guests: [], email: "", phone: "" });
    const g = groups.get(key);
    const email = cell("email"), phone = cell("phone");
    if (!g.email && /^\S+@\S+\.\S+$/.test(email)) g.email = email.toLowerCase();
    if (!g.phone && phone) g.phone = phone;
    g.guests.push({ first_name: first.slice(0, 80), last_name: last.slice(0, 120) || null, is_child: isChild(cell("child")), email: email || null, phone: phone || null });
  });
  return { groups: [...groups.values()], errors };
}

// Plantilla para que las parejas sepan cómo preparar su lista.
export const TEMPLATE_ROWS = [
  ["Grupo", "Nombre", "Apellidos", "Niño", "Email", "Teléfono"],
  ["Familia Ortega", "Carmen", "Ortega", "", "carmen@ejemplo.com", "600 000 000"],
  ["Familia Ortega", "Luis", "Ortega", "", "", ""],
  ["Familia Ortega", "Inés", "Ortega", "sí", "", ""],
  ["Amigos de la uni", "Pablo", "Gil", "", "", "611 000 000"],
];
