// Fotos del enlace para la pareja (#boda=…): al compartir se suben a /api/compartir (privadas,
// se borran solas a los 30 días) y quien abre el enlace las descarga. Viajan tal cual, sin
// volver a comprimirlas: son las mismas que ya veían en su prueba.
const memo = new Map(); // huella de las fotos -> id ya subido (no se suben dos veces las mismas)

async function fingerprint(photos) {
  const text = photos.join("|");
  try {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return btoa(String.fromCharCode(...new Uint8Array(hash)));
  } catch { return `${text.length}:${photos.map((p) => p.slice(-64)).join("")}`; }
}

const post = async (url, body, timeoutMs) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

// Sube las fotos y devuelve el id para el enlace. onProgress(subidas, total).
export async function uploadSharePhotos(photos, onProgress = () => {}) {
  const key = await fingerprint(photos);
  if (memo.has(key)) return memo.get(key);
  const { id } = await post("/api/compartir", { fotos: photos.length }, 10000);
  onProgress(0, photos.length);
  for (const [n, foto] of photos.entries()) {
    // Un reintento por foto: en el móvil, un corte de cobertura es lo normal.
    try { await post(`/api/compartir?id=${id}&n=${n}`, { foto }, 30000); }
    catch { await post(`/api/compartir?id=${id}&n=${n}`, { foto }, 30000); }
    onProgress(n + 1, photos.length);
  }
  memo.set(key, id);
  return id;
}

// Las fotos de un enlace compartido, como las tenía su pareja (data URLs). [] si ya no están.
export async function loadSharePhotos(id, timeoutMs = 12000) {
  const res = await fetch(`/api/compartir?id=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) return { photos: [], gone: res.status === 410 || res.status === 404 };
  const { fotos = [] } = await res.json();
  const photos = [];
  for (const url of fotos) {
    try {
      const blob = await (await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })).blob();
      photos.push(await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob.type === "image/jpeg" ? blob : new Blob([blob], { type: "image/jpeg" }));
      }));
    } catch { /* una que no baja: se salta */ }
  }
  if (photos.length) memo.set(await fingerprint(photos), id); // si la vuelven a compartir, mismo enlace
  return { photos, gone: false };
}
