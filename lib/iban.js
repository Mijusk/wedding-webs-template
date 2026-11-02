// IBAN: formato en grupos de 4 y comprobación del dígito de control (módulo 97),
// para no publicar una cuenta con una errata. Lo usan el panel de Luis y el de la pareja.
export function formatIban(v) {
  const s = String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.replace(/(.{4})/g, "$1 ").trim();
}

export function ibanOk(raw) {
  const s = String(raw || "").toUpperCase().replace(/\s/g, "");
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  if (s.startsWith("ES") && s.length !== 24) return false;
  const moved = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const ch of moved) rest = (rest * 10 + Number(ch)) % 97;
  return rest === 1;
}

export const isSampleIban = (v) => /^ES0{2}[\s0]+$/.test(String(v || ""));
