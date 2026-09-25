// Botones [data-copy="texto"]: copian al portapapeles y confirman con data-done.
// Si el navegador no deja copiar, selecciona el texto de aria-controls para copiarlo a mano.
export function bindCopy(root) {
  root.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-copy]");
    if (!btn) return;
    const label = btn.querySelector("[data-label]");
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      const original = label.textContent;
      label.textContent = btn.dataset.done;
      btn.dataset.state = "done";
      clearTimeout(btn._reset);
      btn._reset = setTimeout(() => { label.textContent = original; delete btn.dataset.state; }, 2200);
    } catch {
      const target = document.getElementById(btn.getAttribute("aria-controls"));
      if (!target) return;
      const range = document.createRange();
      range.selectNodeContents(target);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
    }
  });
}
