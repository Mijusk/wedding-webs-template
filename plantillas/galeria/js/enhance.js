// Galería: la sala está en penumbra y se encienden los focos.
// 1. Portada: al cargar, el foco del retrato se enciende (con un parpadeo de halógeno) y luego
//    sube la luz de la sala. Es una animación CSS que activa la clase .is-intro (~2,3 s).
// 2. Los demás cuadros que aún no se ven quedan apagados (.is-off) y se encienden (.is-on)
//    al llegar con el scroll; si ya se ven al cargar, esperan a que acabe la portada.
// Solo ocurre la primera vez: en la vista previa del escaparate main.js vuelve a pintar todo
// con cada cambio y entonces los cuadros salen ya iluminados. Sin movimiento reducido, todo
// iluminado desde el principio. Un único observer, que se desconecta en cada llamada.
const INTRO = 2300; // duración de la entrada de la portada (coincide con style.css)

let played = false;
let io = null;

export function enhance(main) {
  io?.disconnect();
  io = null;
  if (played) return;
  played = true;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;

  const start = performance.now();
  const hero = main.querySelector(".hero");
  const intro = Boolean(hero?.querySelector(".work--hero"));
  if (intro) {
    hero.classList.add("is-intro");
    setTimeout(() => hero.classList.remove("is-intro"), INTRO + 150);
  }

  const works = [...main.querySelectorAll(".work:not(.work--hero)")];
  if (!works.length) return;
  let queue = 0; // escalona los que se encienden a la vez
  const light = (el) => {
    el.classList.remove("is-off");
    el.classList.add("is-on");
    setTimeout(() => el.classList.remove("is-on"), 1400);
  };
  const obs = io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      obs.unobserve(e.target);
      const wait = intro ? Math.max(0, INTRO - 400 - (performance.now() - start)) : 0;
      const delay = wait + (queue++ % 3) * 260;
      setTimeout(() => light(e.target), delay);
      setTimeout(() => { queue = Math.max(0, queue - 1); }, delay);
    }
  }, { rootMargin: "0px 0px -22% 0px", threshold: 0.15 });
  for (const w of works) {
    w.classList.add("is-off");
    obs.observe(w);
  }
}
