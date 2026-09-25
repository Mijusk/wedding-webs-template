import { esc } from "../format.js";

// El IBAN se muestra en grupos de 4 y se copia sin espacios.
export function gifts({ gifts, copy = {} }) {
  if (!gifts?.iban) return "";
  const t = copy.gifts || {};
  const raw = gifts.iban.replace(/\s+/g, "").toUpperCase();
  const grouped = raw.match(/.{1,4}/g).join(" ");
  return `
  <section class="section gifts" data-tone="night" aria-labelledby="gifts-title">
    <div class="wrap split">
      <p class="eyebrow">${esc(t.eyebrow)}</p>
      <div class="gifts__body reveal">
        <h2 class="gifts__title" id="gifts-title">${esc(t.title)}</h2>
        ${t.text ? `<p class="gifts__text">${esc(t.text)}</p>` : ""}
        <div class="iban">
          ${gifts.holder ? `<div class="iban__row"><p class="label">${esc(t.holderLabel)}</p><p>${esc(gifts.holder)}</p></div>` : ""}
          <div class="iban__row">
            <p class="label">${esc(t.ibanLabel)}</p>
            <p class="iban__num" id="iban-value">${esc(grouped)}</p>
          </div>
          <button class="link iban__copy" type="button" data-copy="${esc(raw)}" data-done="${esc(t.copied)}" aria-controls="iban-value">
            <span data-label aria-live="polite">${esc(t.copy)}</span>
          </button>
        </div>
      </div>
    </div>
  </section>`;
}
