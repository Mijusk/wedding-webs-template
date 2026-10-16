// Webs de boda que pueden estar en esta rama, relativas a herramientas/. Solo se ofrecen las
// que tienen config.json (en la rama de una boda normalmente hay una sola).
const WEBS = [
  ["../", "Clásica"],
  ["../plantillas/editorial/", "Editorial"],
  ["../plantillas/minimal/", "Minimal"],
  ["../plantillas/verbena/", "Verbena"],
  ["../plantillas/postal/", "Postal"],
  ["../plantillas/villa/", "Villa"],
  ["../plantillas/etiqueta/", "Etiqueta"],
  ["../plantillas/lacre/", "Lacre"],
  ["../plantillas/acuarela/", "Acuarela"],
  ["../plantillas/monograma/", "Monograma"],
  ["../plantillas/negro/", "Editorial Negro"],
  ["../plantillas/toile/", "Toile"],
  ["../plantillas/palacio/", "Palacio"],
  ["../plantillas/jardin/", "Jardín Inglés"],
  ["../plantillas/lino/", "Lino y Piedra"],
  ["../plantillas/azulejo/", "Azulejo"],
  ["../plantillas/carrete/", "Carrete"],
  ["../plantillas/carta/", "Carta de amor"],
  ["../plantillas/vegetal/", "Papel vegetal"],
  ["../plantillas/capilla/", "Capilla"],
];

export async function fillWebSelect(select) {
  const found = [];
  for (const [path, name] of WEBS) {
    try { if ((await fetch(new URL(path + "config.json", location.href), { method: "HEAD", cache: "no-store" })).ok) found.push([path, name]); }
    catch { /* no está en esta rama */ }
  }
  select.innerHTML = found.map(([p, n]) => `<option value="${esc(p)}">${esc(n)} · ${esc(p.replace("../", "/"))}</option>`).join("");
  const wanted = new URLSearchParams(location.search).get("web");
  if (wanted && found.some(([p]) => p === wanted)) select.value = wanted;
  return found.length;
}

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Escribe un archivo en una carpeta elegida con showDirectoryPicker.
export async function writeFile(dir, name, data) {
  const file = await (await dir.getFileHandle(name, { create: true })).createWritable();
  await file.write(data);
  await file.close();
}
