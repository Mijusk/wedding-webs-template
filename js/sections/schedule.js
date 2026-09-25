import { esc } from "../format.js";

export function schedule({ schedule = [] }) {
  if (!schedule.length) return "";
  return `
  <section class="schedule">
    <p class="eyebrow">El día</p>
    <h2>Programa</h2>
    <ol>
      ${schedule.map((s) => `
        <li><time>${esc(s.time)}</time>
          <div><span class="what">${esc(s.label)}</span><span class="where">${esc(s.place ?? "")}</span></div>
        </li>`).join("")}
    </ol>
  </section>`;
}
