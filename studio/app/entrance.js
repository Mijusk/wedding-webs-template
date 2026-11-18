import { $ } from "./util.js";

// Portada del escaparate. La cortina (monograma, nombre y contador) y la aparición de la portada
// las lleva un script dentro de studio/index.html, para que nunca esperen a la red: como mucho
// 1 s, una vez por visita y nunca con «reducir movimiento». Aquí van los extras que pueden llegar
// después: las fotos que se mueven con el ratón y al bajar, el botón magnético, los enlaces
// del menú y los bloques que aparecen al llegar a ellos.
// Los estados viven en clases de <html> (ver studio/entrance.css).
const root = document.documentElement;
let started = false;

export function startEntrance() {
  if (started) return;
  started = true;
  sameTabAnchors();
  if (!root.classList.contains("no-motion")) {
    parallax();
    magnetic();
  }
}

// Si se llegó con un enlace a una sección (#tarifas desde plantillas.html), se baja a ella una
// vez pintado el contenido. Sin #, no se toca nada.
export function scrollToHash() {
  const target = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (!target || target.id === "inicio") return;
  target.scrollIntoView({ block: "start" });
}

// Bloques que aparecen al llegar a ellos. Se puede llamar otra vez tras pintar contenido nuevo.
export function revealOnScroll(selector) {
  if (root.classList.contains("no-motion") || !("IntersectionObserver" in window)) return;
  root.classList.add("reveal-on");
  const io = revealOnScroll.io ||= new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(selector).forEach((el) => {
    if (el.hasAttribute("data-reveal")) return;
    const siblings = [...el.parentElement.children].filter((c) => c.matches(selector));
    el.style.setProperty("--ri", Math.min(siblings.indexOf(el), 5));
    el.setAttribute("data-reveal", "");
    io.observe(el);
  });
}

// ── Piezas ───────────────────────────────────────────────

// Los enlaces del menú bajan suavemente sin dejar #seccion en la dirección, para que al
// recargar se vuelva a empezar arriba.
function sameTabAnchors() {
  document.addEventListener("click", (e) => {
    const a = e.target.closest?.('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const id = a.getAttribute("href").slice(1);
    const target = id === "inicio" ? null : document.getElementById(id);
    if (id && !target && id !== "inicio") return;
    e.preventDefault();
    const behavior = root.classList.contains("no-motion") ? "auto" : "smooth";
    if (target) target.scrollIntoView({ behavior, block: "start" });
    else scrollTo({ top: 0, behavior });
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  });
}


// Fotos de la portada: se desplazan según la posición del ratón y del scroll, cada una a su
// profundidad (--depth), con un poco de inercia.
function parallax() {
  const gallery = $(".hero__gallery");
  if (!gallery) return;
  const fine = matchMedia("(pointer: fine)").matches;
  const aim = { x: 0, y: 0 }, now = { x: 0, y: 0, s: 0 };
  if (fine) addEventListener("pointermove", (e) => {
    aim.x = (e.clientX / innerWidth) * 2 - 1;
    aim.y = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(gallery);
  const loop = () => {
    if (visible) {
      now.x += (aim.x - now.x) * 0.06;
      now.y += (aim.y - now.y) * 0.06;
      now.s += (scrollY - now.s) * 0.12;
      gallery.style.setProperty("--mx", now.x.toFixed(3));
      gallery.style.setProperty("--my", now.y.toFixed(3));
      gallery.style.setProperty("--sy", now.s.toFixed(1));
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function magnetic() {
  if (!matchMedia("(pointer: fine)").matches) return;
  document.querySelectorAll(".btn--magnetic").forEach((btn) => {
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.25, y = (e.clientY - r.top - r.height / 2) * 0.35;
      btn.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    });
    btn.addEventListener("pointerleave", () => { btn.style.transform = ""; });
  });
}

