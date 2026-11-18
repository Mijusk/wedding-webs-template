// Empareja las respuestas que llegan sin enlace personal (enlace general de la web) con la lista
// de invitados de la pareja. Sin dependencias: lo usan el panel y las pruebas (tests/unit).
//
//   · «seguro»: casi seguro que es ese grupo. El panel lo une solo y enseña los dos nombres al lado.
//   · «sugerencia»: se parece. La pareja confirma o descarta con un toque.
//   · Nunca se une solo si el grupo ya había contestado (puede ser un duplicado) ni si hay dos
//     grupos parecidos: entonces se sugiere.

const STOP = new Set(["y", "e", "de", "del", "la", "las", "los", "el", "familia", "fam", "flia", "sr", "sra", "srta", "don", "dona", "tios", "tio", "tia", "tias", "primos", "primo", "prima", "abuelos", "amigos", "amigas", "hijos", "hijas", "ninos", "con", "and", "the", "mr", "mrs"]);

// Diminutivos más comunes en España: se tratan como el mismo nombre.
const APODOS = [
  ["jose", "pepe", "pepito", "jose maria", "chema", "josemi"], ["francisco", "paco", "curro", "fran", "quico", "kiko", "pancho"],
  ["dolores", "lola", "loli"], ["manuel", "manolo", "manu", "lolo"], ["maria", "mari"], ["mercedes", "merche"],
  ["concepcion", "concha", "conchi", "conchita"], ["ignacio", "nacho", "inaki"], ["guillermo", "guille", "willy"],
  ["antonio", "toni", "tony", "anton"], ["alejandro", "alex", "alejo", "jandro"], ["alejandra", "alex", "ale"],
  ["roberto", "rober", "beto"], ["rafael", "rafa"], ["fernando", "fer", "nando"], ["federico", "fede"],
  ["jesus", "chus", "chuchi"], ["rosario", "charo", "chari"], ["enrique", "quique"], ["santiago", "santi"],
  ["sebastian", "sebas"], ["cristina", "cris"], ["cristian", "cris"], ["daniel", "dani"], ["daniela", "dani"],
  ["isabel", "isa", "chabeli"], ["elisabet", "eli", "isabel"], ["teresa", "tere"], ["josefa", "pepa", "pepi"],
  ["juan", "juanito", "juanjo"], ["pilar", "pili"], ["carmen", "mamen", "menchu"], ["purificacion", "puri"],
  ["inmaculada", "inma"], ["encarnacion", "encarna"], ["asuncion", "asun"], ["victoria", "vicky"],
  ["beatriz", "bea"], ["patricia", "patri"], ["natalia", "nati"], ["gabriel", "gabi"], ["gabriela", "gabi"],
  ["miguel", "migue"], ["jorge", "jorgito"], ["pablo", "pablito"], ["luis", "luisito"], ["javier", "javi"],
  ["joaquin", "quino", "ximo"], ["vicente", "vicen", "tente"], ["ramon", "moncho"], ["ricardo", "richi"],
  ["susana", "susi"], ["margarita", "marga"], ["montserrat", "montse"], ["esperanza", "espe"],
];
const APODO = new Map();
APODOS.forEach((list, i) => list.forEach((n) => APODO.set(n, [...(APODO.get(n) || []), i])));
const sameNick = (a, b) => (APODO.get(a) || []).some((i) => (APODO.get(b) || []).includes(i));

export const normalize = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9ñ\s-]/g, " ").replace(/-/g, " ").replace(/\s+/g, " ").trim();

// La misma clave que la base de datos (app.normalize): minúsculas, sin tildes, espacios simples.
export const nameKey = (s) => String(s || "").toLowerCase()
  .replace(/[áàäâãå]/g, "a").replace(/[éèëê]/g, "e").replace(/[íìïî]/g, "i").replace(/[óòöôõ]/g, "o")
  .replace(/[úùüû]/g, "u").replace(/ñ/g, "n").replace(/ç/g, "c").replace(/œ/g, "o").replace(/æ/g, "a")
  .replace(/\s+/g, " ").trim();

const tokens = (s) => normalize(s).split(" ").filter((t) => t && !STOP.has(t));

function lev(a, b) {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

// Parecido entre dos palabras, de 0 a 1.
function wordSim(a, b) {
  if (a === b) return 1;
  if (sameNick(a, b)) return 0.75; // «Pepe» / «José»: probable, pero que lo confirme la pareja
  if (a.length === 1 || b.length === 1) return a[0] === b[0] ? 0.8 : 0; // inicial: «J. García»
  const d = lev(a, b);
  const min = Math.min(a.length, b.length);
  if (min <= 3) return d === 1 && a.length !== b.length ? 0.9 : 0; // «Gil» / «Gill» sí; «Ana» / «Eva» no
  if (d === 1) return 0.9;              // una letra: «Jose» / «Josè», «Marta» / «Martha»
  if (d === 2 && min >= 6) return 0.82; // «Guillermo» / «Guilermo»
  return 0;
}

// Parecido entre lo que escribió el invitado y una persona de la lista (nombre + apellidos).
// El nombre de pila tiene que encajar; los apellidos que escriba, también.
export function personScore(written, first, last) {
  const w = tokens(written);
  const f = tokens(first);
  const l = tokens(last);
  if (!w.length || !f.length) return 0;
  const all = [...f, ...l];
  // Nombres compuestos que el invitado junta o abrevia («José María» / «Chema»).
  const fJoined = f.join(" ");
  const firstSim = Math.max(...f.map((t) => wordSim(w[0], t)), sameNick(w[0], fJoined) ? 0.75 : 0);
  if (!firstSim) return 0;
  const rest = w.slice(1);
  let sum = 0;
  let matched = 0;
  for (const t of rest) {
    const best = Math.max(0, ...all.map((x) => wordSim(t, x)));
    if (!best) return 0; // escribió un apellido que esa persona no tiene
    sum += best;
    matched++;
  }
  if (!matched) {
    // Solo el nombre de pila: nunca es seguro (hay muchas Martas).
    return l.length ? Math.min(0.7, firstSim * 0.7) : firstSim * 0.8;
  }
  return Math.min(1, (firstSim + sum) / (matched + 1));
}

// Parte «Marta y Pablo García», «Marta, Pablo» en personas sueltas.
export function splitNames(written) {
  const parts = String(written || "").split(/\s*(?:,|;|\/|&|\+|\by\b|\be\b|\band\b)\s*/i).map((p) => p.trim()).filter((p) => normalize(p));
  if (parts.length < 2) return [String(written || "").trim()];
  // El apellido del último se comparte: «Marta y Pablo García» → «Marta García», «Pablo García».
  const lastTokens = parts[parts.length - 1].split(/\s+/);
  const surname = lastTokens.length > 1 ? lastTokens.slice(1).join(" ") : "";
  return parts.map((p, i) => (i < parts.length - 1 && surname && normalize(p).split(" ").length === 1 ? `${p} ${surname}` : p));
}

// Lo mejor de un grupo para un nombre escrito: { score, guest } (guest = la persona que encaja).
function groupScore(written, g) {
  const people = splitNames(written);
  let best = { score: 0, guest: null };
  const perPerson = people.map((p) => {
    let b = { score: 0, guest: null };
    for (const x of g.guests || []) {
      const s = personScore(p, x.first_name, x.last_name);
      if (s > b.score) b = { score: s, guest: x };
    }
    if (!(g.guests || []).length) {
      // Grupo sin personas apuntadas: se compara con su nombre («Familia Ortega», «Marta y Pablo»).
      const gt = tokens(g.name);
      const wt = tokens(p);
      if (gt.length && wt.length) {
        const hits = wt.filter((t) => gt.some((x) => wordSim(t, x) >= 0.9)).length;
        const s = hits === wt.length && wt.length >= 2 ? 0.85 : hits ? 0.6 : 0;
        if (s > b.score) b = { score: s, guest: null };
      }
    }
    return b;
  });
  for (const b of perPerson) if (b.score > best.score) best = b;
  // Varias personas del mismo grupo en una sola respuesta: más seguro.
  if (people.length > 1 && perPerson.filter((b) => b.score >= 0.8).length >= 2) best = { ...best, score: Math.min(1, best.score + 0.08) };
  return best;
}

export const SEGURO = 0.9;
export const SUGERIR = 0.6;

// Para cada respuesta suelta: el grupo que mejor encaja y si se puede unir sola.
// answers: filas de rsvp_current sin group_id. groups: los de loadGuests (con guests y answer).
export function matchAnswers(answers, groups) {
  const out = [];
  for (const a of answers) {
    const discarded = new Set((a.payload?.descartados || []).map(String));
    const ranked = groups
      .filter((g) => !discarded.has(String(g.id)) && !g.token_revoked_at)
      .map((g) => ({ group: g, ...groupScore(a.name, g) }))
      .filter((r) => r.score >= SUGERIR)
      .sort((x, y) => y.score - x.score);
    if (!ranked.length) continue;
    const [top, second] = ranked;
    const clearWinner = !second || second.score < top.score - 0.15;
    const sure = top.score >= SEGURO && clearWinner && !top.group.answer;
    out.push({
      answer: a,
      group: top.group,
      guest: top.guest,
      score: top.score,
      kind: sure ? "seguro" : "sugerencia",
      reason: top.group.answer ? "duplicado" : !clearWinner ? "varios" : top.score >= SEGURO ? "" : "parecido",
      others: ranked.slice(1, 3).map((r) => r.group),
    });
  }
  return out;
}
