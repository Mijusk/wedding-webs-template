// Carga config.json: la única fuente de verdad de cada boda.
export async function loadConfig(url = "config.json") {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
  return res.json();
}
