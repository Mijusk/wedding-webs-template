import { $, sleep, syncScrollLock, fill } from "./util.js";

// Barra de progreso la primera vez que ven su web. La web se prepara a la vez, de verdad; esto es
// la espera corta que hace que se sienta «hecha para ellos». Mensajes con {estilo}: studio.json >
// generator.quickMessages.
export async function playLoading(wedding, { ms, messages, vars = {} }) {
  messages = messages.map((m) => fill(m, vars));
  const firstRunMs = ms;
  const [a, b] = wedding.couple;
  $("#loading-names").textContent = `${a} & ${b}`;
  const bar = $("#loading-bar"), msg = $("#loading-msg");
  $("#loading").hidden = false;
  syncScrollLock();
  const t0 = performance.now();
  await new Promise((done) => {
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / firstRunMs);
      const eased = 1 - Math.pow(1 - p, 2.2);
      bar.style.width = `${(eased * 100).toFixed(1)}%`;
      const text = messages[Math.min(messages.length - 1, Math.floor(eased * messages.length))];
      if (msg.textContent !== text) msg.textContent = text;
      p < 1 ? requestAnimationFrame(tick) : done();
    };
    requestAnimationFrame(tick);
  });
  await sleep(250);
  $("#loading").hidden = true;
  syncScrollLock();
}
