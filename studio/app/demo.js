// Fotos de ejemplo (studio/demo/, lista en studio.json > demoPhotos). Son opcionales:
// solo se usan las que existen.
export async function findDemoPhotos({ folder, files } = {}) {
  if (!files?.length) return [];
  const urls = files.map((f) => new URL(folder + f, location.href).href);
  const found = await Promise.all(urls.map(async (url) => {
    try { return (await fetch(url, { method: "HEAD", cache: "no-store" })).ok ? url : null; }
    catch { return null; }
  }));
  return found.filter(Boolean);
}

// Pone las fotos de ejemplo en el config de demo de cada plantilla:
// portada, galería (Clásica) y capítulos de la historia (Editorial).
export function applyDemoPhotos(base, photos) {
  if (!photos.length) return base;
  base.event.photo = photos[0];
  delete base.event.photoFocus;
  base.gallery = photos.slice(1, 3);
  base.story?.chapters?.forEach((c, i) => { if (photos[i + 1]) c.photo = photos[i + 1]; });
  return base;
}

export const pickRandom = (list, n) => [...list].sort(() => Math.random() - 0.5).slice(0, n);
