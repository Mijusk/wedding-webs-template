// Verbena: la cinta corre más deprisa (y hacia atrás) según cómo se baje la página, y la
// cuenta atrás sube de 0 a su número al llegar a ella. Sin movimiento si el sistema lo pide.
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
let loop = 0;

export function enhance(root) {
  cancelAnimationFrame(loop);
  if (calm) return;
  marquees(root.querySelectorAll(".marquee__track"));
  root.querySelectorAll("[data-count]").forEach(countUp);
}

function marquees(tracks) {
  if (!tracks.length) return;
  let x = 0, boost = 0, lastY = scrollY;
  const step = () => {
    const dy = scrollY - lastY;
    lastY = scrollY;
    boost += (dy * 0.6 - boost) * 0.1;
    x -= 0.6 + Math.abs(boost);
    tracks.forEach((t, i) => {
      const half = t.scrollWidth / 2 || 1;
      const pos = ((x % half) + half) % half;
      t.style.transform = `translate3d(${i % 2 ? pos - half : -pos}px,0,0)`;
    });
    loop = requestAnimationFrame(step);
  };
  loop = requestAnimationFrame(step);
}

function countUp(el) {
  const target = Number(el.dataset.count);
  if (!target || !("IntersectionObserver" in window)) return;
  el.textContent = "0";
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    const t0 = performance.now(), ms = 1400;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { threshold: 0.6 });
  io.observe(el);
}
