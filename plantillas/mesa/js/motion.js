// Todo lo que se mueve al bajar en «La mesa». Un solo listener de scroll (con
// requestAnimationFrame) y solo transform/opacity, para que vaya fino también en móviles normales.
//
// - Portada: la invitación ocupa la pantalla; al bajar, la cámara se aleja y se pone la mesa
//   alrededor (plato, servilleta, cubiertos, copas) y la tarjeta del sitio se escribe sola.
//   La mesa se dibuja al tamaño de cerca y se reduce al alejarse: así las letras siempre salen nítidas.
// - Lo esencial: las dos tarjetas llegan desde los lados.
// - Historia: la sección se queda quieta y cada capítulo cae sobre el montón de fotos.
// - Programa: el menú se posa en la mesa y cada momento se imprime al llegar a él.
// - Galería: las fotos llegan deslizándose sobre el mantel, cada una desde su lado.
//
// Con «reducir movimiento» del sistema no se mueve nada: la mesa sale ya puesta.

const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => 1 - (1 - t) ** 3;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

let S = null;
let bound = false;
let queued = false;

// Borde de la mesa puesta, en unidades: de la copa de agua (arriba) al plato (abajo).
const BOX = { w: 96, h: 86, cy: -7 };
const CARD = { w: 32, h: 44, cy: 4 };

const absTop = (el) => el.getBoundingClientRect().top + scrollY;
// Posición sin contar transformaciones (las piezas que se mueven no se miden movidas).
function offsetIn(el, root) {
  let y = 0;
  for (let n = el; n && n !== root; n = n.offsetParent) y += n.offsetTop;
  return y;
}

function measure() {
  if (!S) return;
  const vw = document.documentElement.clientWidth;
  const vh = innerHeight;
  S.vw = vw; S.vh = vh;
  const moving = !still.matches;

  if (S.hero) {
    const H = S.hero;
    const sh = H.stage.clientHeight || vh;
    // Tamaño de la mesa puesta (unidad final) y cuánto más cerca empieza la cámara.
    const uF = Math.min((vw * 0.92) / BOX.w, (sh * 0.6) / BOX.h);
    const Z = moving ? clamp(Math.min((vw * 0.84) / (CARD.w * uF), (sh * 0.8) / (CARD.h * uF)), 1.2, 3.2) : 1;
    // En vertical sobra alto: la mesa baja un poco y deja sitio al texto de debajo.
    H.endY = sh > vw * 1.3 ? 0.45 : 0.4;
    H.uF = uF; H.Z = Z; H.sh = sh;
    H.setting.style.setProperty("--u", `${(uF * Z).toFixed(3)}px`);
    H.top = absTop(H.el); H.h = H.el.offsetHeight;
    // El texto de abajo, justo debajo del plato.
    H.after.style.top = `${Math.round(sh * H.endY + (BOX.h / 2 + BOX.cy + 4) * uF + 18)}px`;
  }
  if (S.cards) S.cards.top = absTop(S.cards.el);

  if (S.pile) {
    const P = S.pile;
    const pinned = moving;
    P.box.classList.toggle("is-pinned", pinned);
    P.box.style.height = pinned ? `${Math.round(vh * (1 + 0.8 * P.items.length))}px` : "";
    P.top = absTop(P.box); P.h = P.box.offsetHeight;
    P.L = (P.h - vh) / Math.max(1, P.items.length);
  }
  if (S.menu) {
    const M = S.menu;
    M.top = absTop(M.table) + M.card.offsetTop;
    M.items.forEach((it) => { it.top = M.top + offsetIn(it.el, M.card); });
  }
  if (S.spread) {
    const top = absTop(S.spread.box);
    S.spread.items.forEach((it) => { it.top = top + offsetIn(it.el, S.spread.box); });
  }
  frame(true);
}

function frame(force) {
  queued = false;
  if (!S) return;
  const y = scrollY, vh = S.vh, vw = S.vw;
  const moving = !still.matches;

  // Portada: de la invitación a la mesa puesta.
  if (S.hero && (force || y < S.hero.top + S.hero.h)) {
    const H = S.hero;
    const p = moving ? clamp((y - H.top) / Math.max(1, H.h - H.sh)) : 1;
    const e = ease(clamp(p / 0.6));
    const s = H.Z ** -e;
    const uZ = H.uF * H.Z;
    const focus = lerp(CARD.cy, BOX.cy, e);
    const ty = lerp(H.sh * 0.5, H.sh * H.endY, e) - s * focus * uZ;
    H.setting.style.transform = `translate3d(0, ${ty.toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
    H.invite.style.transform = `rotate(${(-2 * e).toFixed(2)}deg)`;
    H.props.forEach((it) => {
      const q = ease(clamp((p - 0.04 - it.delay) / 0.36));
      const k = 1 - q;
      it.el.style.transform = `translate3d(${(it.dx * k * uZ).toFixed(1)}px, ${(it.dy * k * uZ).toFixed(1)}px, 0) rotate(${(it.rot * k).toFixed(2)}deg)${it.drop ? ` scale(${(1 + it.drop * k).toFixed(3)})` : ""}`;
      it.el.style.opacity = clamp(q * 2.4).toFixed(3);
    });
    if (H.name) {
      const w = smooth(0.6, 0.84, p);
      H.name.style.clipPath = w >= 1 ? "" : `inset(-30% ${((1 - w) * 100).toFixed(1)}% -30% -4%)`;
    }
    const after = smooth(0.7, 0.9, p);
    H.after.style.opacity = after.toFixed(3);
    H.after.style.transform = `translate3d(0, ${((1 - after) * 18).toFixed(1)}px, 0)`;
    if (H.hint) H.hint.style.opacity = (1 - smooth(0, 0.06, p)).toFixed(3);
  }

  if (moving && S.cards && y + vh > S.cards.top - vh * 0.2 && y < S.cards.top + vh * 1.5) {
    S.cards.items.forEach((c, i) => {
      const q = ease(clamp((y + vh - S.cards.top - i * vh * 0.08) / (vh * 0.7)));
      const side = i % 2 ? 1 : -1, k = 1 - q;
      c.style.transform = `translate3d(${(side * 0.42 * vw * k).toFixed(1)}px, ${(0.12 * vh * k).toFixed(1)}px, 0) rotate(${(side * 14 * k).toFixed(2)}deg)`;
    });
  }

  // Historia: cada foto cae desde arriba (más grande y transparente) y se posa en el montón.
  if (S.pile && (force || (y + vh > S.pile.top && y < S.pile.top + S.pile.h))) {
    const P = S.pile;
    const t = moving ? (y - P.top + vh * 0.45) / P.L : P.items.length;
    let now = 0;
    P.items.forEach((it, i) => {
      if (!moving) { it.print.style.transform = it.print.style.opacity = it.text.style.opacity = it.text.style.transform = ""; return; }
      const q = ease(clamp((t - i) / 0.6));
      const k = 1 - q;
      it.print.style.transform = `translate3d(0, ${(-0.1 * vh * k).toFixed(1)}px, 0) rotate(${(9 * k * (i % 2 ? -1 : 1)).toFixed(2)}deg) scale(${(1 + 0.55 * k).toFixed(3)})`;
      it.print.style.opacity = clamp(q * 2.2).toFixed(3);
      const last = i === P.items.length - 1;
      const o = smooth(i + 0.3, i + 0.6, t) * (last ? 1 : 1 - smooth(i + 1.1, i + 1.3, t));
      it.text.style.opacity = o.toFixed(3);
      it.text.style.transform = `translate3d(0, ${((1 - o) * 14).toFixed(1)}px, 0)`;
      if (t >= i + 0.6) now = i;
    });
    if (P.now && P.nowIdx !== now) { P.nowIdx = now; P.now.textContent = String(now + 1).padStart(2, "0"); }
  }

  if (moving && S.menu && y + vh > S.menu.top - 40 && y < S.menu.items.at(-1).top + vh) {
    const M = S.menu;
    const q = ease(clamp((y + vh - M.top) / (vh * 0.75)));
    M.card.style.transform = `translate3d(0, ${(0.1 * vh * (1 - q)).toFixed(1)}px, 0) rotate(${(-0.8 + 3.8 * (1 - q)).toFixed(2)}deg)`;
    M.items.forEach((it) => {
      const c = ease(clamp((y + vh * 0.9 - it.top) / (vh * 0.28)));
      it.el.style.opacity = c.toFixed(3);
      it.el.style.transform = `translate3d(0, ${((1 - c) * 16).toFixed(1)}px, 0)`;
    });
  }

  if (moving && S.spread) {
    S.spread.items.forEach((it) => {
      if (y + vh * 1.2 < it.top || y > it.top + vh) return;
      const q = ease(clamp((y + vh * 1.02 - it.top) / (vh * 0.55)));
      const k = 1 - q;
      it.el.style.transform = `translate3d(${(it.side * 0.6 * vw * k).toFixed(1)}px, ${(50 * k).toFixed(1)}px, 0) rotate(${(it.side * 16 * k).toFixed(2)}deg)`;
      it.el.style.opacity = clamp(q * 1.8).toFixed(3);
    });
  }
}

const request = () => { if (!queued) { queued = true; requestAnimationFrame(() => frame(false)); } };
let measureQueued = false;
const remeasure = () => {
  if (measureQueued) return;
  measureQueued = true;
  requestAnimationFrame(() => { measureQueued = false; measure(); });
};

export function startMotion(main) {
  document.documentElement.classList.toggle("is-still", still.matches);
  const q = (sel) => main.querySelector(sel);
  const hero = q(".hero");
  const cards = q(".details .cards");
  const pile = q(".story .pile");
  const menu = q(".schedule .menu-table");
  const spread = q(".gallery .spread");
  S = {
    hero: hero && {
      el: hero, stage: hero.querySelector(".hero__stage"), setting: hero.querySelector(".setting"),
      invite: hero.querySelector(".invite"), name: hero.querySelector(".seat__name"),
      after: hero.querySelector(".hero__after"), hint: hero.querySelector(".hero__hint"),
      props: [...hero.querySelectorAll("[data-from]")].map((el) => {
        const [dx = 0, dy = 0, rot = 0, delay = 0, drop = 0] = el.dataset.from.split(",").map(Number);
        return { el, dx, dy, rot, delay, drop };
      }),
    },
    cards: cards && { el: cards, items: [...cards.querySelectorAll(".card")] },
    pile: pile && {
      box: pile, now: pile.querySelector(".pile__now"), nowIdx: -1,
      items: [...pile.querySelectorAll(".pile__item")].map((el) => ({ el, print: el.querySelector(".print"), text: el.querySelector(".pile__text") })),
    },
    menu: menu && { table: menu, card: menu.querySelector(".menu"), items: [...menu.querySelectorAll(".course")].map((el) => ({ el })) },
    spread: spread && {
      box: spread,
      items: [...spread.querySelectorAll(".spread__item")].map((el) => ({ el, side: Number(el.dataset.side) || 1 })),
    },
    vh: innerHeight, vw: document.documentElement.clientWidth,
  };
  if (S.menu && !S.menu.items.length) S.menu = null;
  measure();
  // Las fotos y las letras cambian el alto de la página al cargar: se vuelve a medir.
  main.querySelectorAll("img").forEach((img) => { if (!img.complete) img.addEventListener("load", remeasure, { once: true }); });
  document.fonts?.ready.then(remeasure);

  if (bound) return;
  bound = true;
  addEventListener("scroll", request, { passive: true });
  addEventListener("resize", remeasure);
  still.addEventListener?.("change", () => {
    document.documentElement.classList.toggle("is-still", still.matches);
    if (still.matches) document.querySelectorAll("#app [style*='transform'], #app [style*='opacity']").forEach((el) => {
      if (el.matches(".setting")) return;
      el.style.transform = ""; el.style.opacity = "";
    });
    remeasure();
  });
  if ("ResizeObserver" in window) new ResizeObserver(remeasure).observe(document.getElementById("app"));
}
