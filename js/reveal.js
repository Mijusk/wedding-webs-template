// Entradas suaves al hacer scroll. Lo que ya se ve al cargar no se toca,
// así la primera pantalla nunca aparece vacía.
export function reveal(root) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.remove("is-pending");
      io.unobserve(e.target);
    }
  }, { rootMargin: "0px 0px -10% 0px" });

  for (const el of root.querySelectorAll(".reveal")) {
    if (el.getBoundingClientRect().top < innerHeight) continue;
    el.classList.add("is-pending");
    io.observe(el);
  }
}
