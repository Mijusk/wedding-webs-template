// Entrada de la portada (css: .hero__paint). Dos detalles:
// 1) Si la foto aún no ha llegado, la pintura espera (pausada) a que cargue, para no
//    "pintar" un hueco vacío con conexiones lentas; como mucho 2,5 s.
// 2) En la vista previa del escaparate main.js vuelve a pintar todo con cada cambio:
//    a partir del segundo render la entrada no se repite.
// Cada render crea nodos nuevos: los listeners van sobre la foto nueva y se van con ella,
// así llamar a enhance varias veces no duplica nada.
export function enhance(main) {
  const repaint = Boolean(main.dataset.painted);
  main.classList.toggle("is-repaint", repaint);
  main.dataset.painted = "1";

  const hero = main.querySelector(".hero");
  const img = hero?.querySelector(".hero__paint img");
  if (repaint || !img || img.complete || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  hero.classList.add("is-waiting");
  const go = () => hero.classList.remove("is-waiting");
  img.addEventListener("load", go, { once: true });
  img.addEventListener("error", go, { once: true });
  setTimeout(go, 2500);
}
