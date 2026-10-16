// La carta se escribe sola: cada letra aparece con tinta húmeda que se seca, con el ritmo
// de una pluma (pausas en comas y puntos) y la firma al final.
// · El texto completo está en el DOM desde el principio: lo visible letra a letra va en una
//   copia aria-hidden y el lector de pantalla lee una copia .sr-only del mismo párrafo.
// · Al terminar (o al pulsar "Saltar", o al bajar y dejar atrás la portada) se devuelve el
//   texto plano a cada párrafo: queda exactamente igual, sin miles de <span>.
// · Solo se escribe una vez por carga: en la vista previa main.js vuelve a pintar todo con
//   cada cambio y entonces la carta sale ya escrita. Sin animación con reduced-motion.

const WRITE_MS = 4000;   // lo que tarda la pluma en el cuerpo de la carta (sin contar la firma)
const START_MS = 650;    // la hoja se posa antes de empezar a escribir
const SIGN_MS = 1300;    // duración del trazo de la firma (coincide con style.css)
const PARA_MS = 220;     // pausa al cambiar de párrafo
const PAUSES = { ",": 90, ";": 140, ":": 160, ".": 210, "!": 210, "?": 210, "…": 260 };

let played = false;
let run = null;

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function enhance(main) {
  run?.cancel();
  run = null;
  const letter = main.querySelector(".letter");
  if (!letter) return;
  if (played || reduced()) {
    letter.classList.add("is-written");
    played = true;
    return;
  }
  played = true;
  run = write(letter, main.querySelector(".hero"), main.querySelector(".skip"));
}

function write(letter, hero, skip) {
  const nodes = [...letter.querySelectorAll("[data-ink]")];
  const texts = nodes.map((n) => n.textContent.replace(/\s+/g, " ").trim());

  // Ritmo: un tiempo base por letra más las pausas de la puntuación, ajustado al total.
  const chars = texts.reduce((s, t) => s + t.replace(/ /g, "").length, 0);
  const pauses = texts.reduce((s, t) => s + [...t].reduce((p, c) => p + (PAUSES[c] || 0), 0), 0) + PARA_MS * (texts.length - 1);
  const step = Math.min(42, Math.max(6, (WRITE_MS - pauses) / Math.max(chars, 1)));

  let t = 0;
  nodes.forEach((node, i) => {
    const text = texts[i];
    const sr = Object.assign(document.createElement("span"), { className: "sr-only", textContent: text });
    const ink = Object.assign(document.createElement("span"), { className: "ink" });
    ink.setAttribute("aria-hidden", "true");
    for (const part of text.split(/( )/)) {
      if (part === " ") { ink.append(" "); continue; }
      if (!part) continue;
      const word = Object.assign(document.createElement("span"), { className: "w" });
      for (const c of part) {
        const ch = Object.assign(document.createElement("span"), { className: "ch", textContent: c });
        ch.style.setProperty("--d", `${Math.round(t)}ms`);
        word.append(ch);
        t += step + (PAUSES[c] || 0);
      }
      ink.append(word);
    }
    node.replaceChildren(sr, ink);
    t += PARA_MS;
  });
  letter.style.setProperty("--sign-d", `${Math.round(t + 120)}ms`);
  letter.classList.add("is-ink");

  const timers = [];
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    clear();
    const hadFocus = skip && document.activeElement === skip;
    nodes.forEach((node, i) => { node.textContent = texts[i]; });
    letter.classList.remove("is-ink", "is-writing");
    letter.classList.add("is-written");
    letter.style.removeProperty("--sign-d");
    if (skip) skip.hidden = true;
    if (hadFocus) letter.focus({ preventScroll: true });
  };

  const clear = () => {
    timers.forEach(clearTimeout);
    io?.disconnect();
  };

  const begin = () => {
    if (done || letter.classList.contains("is-writing")) return;
    letter.classList.add("is-writing");
    timers.push(setTimeout(finish, t + SIGN_MS + 500));
  };

  // Se empieza cuando la letra manuscrita ya está cargada (o, como mucho, al segundo y medio),
  // para que no se escriba con la letra de sustitución y luego cambie.
  const fontsReady = document.fonts?.load ? document.fonts.load(`1em ${getComputedStyle(nodes[0] || letter).fontFamily}`).catch(() => {}) : Promise.resolve();
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1500))]).then(() => {
    timers.push(setTimeout(begin, START_MS));
  });

  if (skip) {
    skip.hidden = false;
    skip.addEventListener("click", finish);
  }

  // Quien baja sin esperar encuentra la carta ya escrita si vuelve a subir.
  let io = null;
  if (hero && "IntersectionObserver" in window) {
    io = new IntersectionObserver(([e]) => { if (!e.isIntersecting) finish(); });
    io.observe(hero);
  }

  return { cancel: () => { done = true; clear(); } };
}
