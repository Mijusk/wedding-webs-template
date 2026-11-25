// Fotos de ejemplo (studio/demo/, lista en studio.json > demoPhotos). Están en el propio
// repositorio, así que no se comprueba una a una por la red: se usan las de la lista.
export function demoPhotoUrls({ folder, files } = {}) {
  if (!files?.length) return [];
  return files.map((f) => new URL(folder + f, location.href).href);
}

// Pone las fotos de ejemplo en el config de demo de cada plantilla:
// portada, galería (Clásica) y capítulos de la historia (Editorial). La galería lleva al menos
// dos fotos, o tantas como traiga el ejemplo de la plantilla (las fotos en capas de «Del día a la
// noche» necesitan más para lucir).
export function applyDemoPhotos(base, photos) {
  if (!photos.length) return base;
  base.event.photo = photos[0];
  delete base.event.photoFocus;
  base.gallery = photos.slice(1, 1 + Math.max(2, base.gallery?.length || 0));
  base.story?.chapters?.forEach((c, i) => { if (photos[i + 1]) c.photo = photos[i + 1]; });
  return base;
}

export const pickRandom = (list, n) => [...list].sort(() => Math.random() - 0.5).slice(0, n);
