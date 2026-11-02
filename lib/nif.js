// NIF (8 números + letra), NIE (X/Y/Z + 7 números + letra) o CIF de empresa (letra + 7 números + control).
// Lo usan el panel, el escaparate y el servidor.
export function cleanNif(v) {
  return String(v || "").toUpperCase().replace(/[\s.-]/g, "");
}

export function validNif(v) {
  const s = cleanNif(v);
  const letters = "TRWAGMYFPDXBNJZSQVHLCKE";
  if (/^\d{8}[A-Z]$/.test(s)) return letters[Number(s.slice(0, 8)) % 23] === s[8];
  if (/^[XYZ]\d{7}[A-Z]$/.test(s)) return letters[Number("XYZ".indexOf(s[0]) + s.slice(1, 8)) % 23] === s[8];
  return /^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(s);
}
