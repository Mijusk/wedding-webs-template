// Marca la portada como vertical si la foto es más alta que ancha,
// para que en escritorio no se recorte a lo ancho (ver .hero--portrait en css/sections.css).
export function heroShape(root) {
  const hero = root.querySelector(".hero");
  const img = hero?.querySelector(".hero__photo");
  if (!img) return;
  const apply = () => hero.classList.toggle("hero--portrait", img.naturalHeight > img.naturalWidth);
  if (img.complete && img.naturalWidth) apply();
  else img.addEventListener("load", apply, { once: true });
}
