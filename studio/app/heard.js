// «¿Cómo nos conocisteis?» (opcional): al guardar la web (botones de un toque) y al reservar (desplegable).
// Es el respaldo de attribution.js, que solo ve los enlaces con utm, gclid o fbclid: el boca a boca,
// los enlaces abiertos desde WhatsApp o Instagram sin utm y quien vuelve otro día se ven aquí.
// Viaja con el lead como heardFrom y se guarda en leads.heard_from (mismos valores que la base de
// datos y que HEARD_FROM en panel/js/ui.js).
import { $, esc } from "./util.js";

export const HEARD_FROM = [
  ["instagram", "Instagram"], ["facebook", "Facebook"], ["google", "Google"], ["bodas_net", "Bodas.net"],
  ["recomendacion", "Amigos o familia"], ["otra_boda", "La web de otra boda"], ["otro", "Otro"],
];

export function setupHeard() {
  const chips = $("#b-heard-chips");
  if (chips) {
    chips.innerHTML = HEARD_FROM.map(([v, label]) =>
      `<label class="chip"><input type="radio" name="heardFrom" value="${v}">${esc(label)}</label>`).join("");
    // Un segundo toque en el mismo botón lo quita (es opcional).
    chips.addEventListener("click", (e) => {
      const input = e.target.closest(".chip")?.querySelector("input");
      if (!input || e.target === input) return;
      if (input.checked) { e.preventDefault(); input.checked = false; }
    });
  }
  const sel = $("#c-heard");
  if (sel) {
    sel.innerHTML = `<option value="">Prefiero no decirlo</option>` +
      HEARD_FROM.map(([v, label]) => `<option value="${v}">${esc(label)}</option>`).join("");
  }
}

// Si ya lo dijeron al guardar la web, la reserva sale con la misma respuesta.
export function prefillHeard(value) {
  const sel = $("#c-heard");
  if (sel && value && !sel.value) sel.value = value;
}
