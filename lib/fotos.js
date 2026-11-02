// Preparación de fotos sin perder calidad (regla de negocio 2). La usan herramientas/fotos.html y
// el editor de bodas del panel, así las dos hacen exactamente lo mismo:
// - JPG/WebP que ya caben (≤ 2560 px) y están derechos: se guardan tal cual, byte a byte; a los
//   JPG solo se les quitan los bloques de metadatos (EXIF con el GPS, XMP, IPTC), sin recomprimir.
// - Lo demás (más grandes, giradas por EXIF, PNG): se dibuja a ≤ 2560 px y se guarda en JPG al 92 %.
export const MAX_SIDE = 2560;
export const QUALITY = 0.92;
export const SMALL = 1600; // por debajo, en pantallas grandes se nota blanda

export async function prepare(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniff(bytes);
  if (type === "heic") throw new Error("Es una foto HEIC de iPhone y el navegador no la abre. Pídela en JPG (o en el iPhone: Ajustes > Cámara > Formatos > Más compatible).");
  if (!type) throw new Error("No es una foto JPG, PNG ni WebP.");

  const bitmap = await createImageBitmap(new Blob([bytes], { type: `image/${type}` }), { imageOrientation: "from-image" });
  const { width, height } = bitmap;
  const orientation = type === "jpeg" ? exifOrientation(bytes) : 1;
  const fits = Math.max(width, height) <= MAX_SIDE;

  let blob, note, kept = false;
  if (fits && type === "jpeg" && orientation === 1) {
    blob = new Blob([stripJpegMetadata(bytes)], { type: "image/jpeg" });
    note = "Se queda tal cual: misma calidad, sin datos internos.";
    kept = true;
  } else if (fits && type === "webp") {
    blob = new Blob([bytes], { type: "image/webp" });
    note = "Se queda tal cual.";
    kept = true;
  } else {
    const k = Math.min(1, MAX_SIDE / Math.max(width, height));
    const canvas = resize(bitmap, Math.round(width * k), Math.round(height * k));
    blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", QUALITY));
    note = k < 1 ? `Reducida a ${canvas.width}×${canvas.height} px, calidad ${QUALITY * 100} %.`
      : type === "png" ? `Pasada a JPG al ${QUALITY * 100} % (el PNG pesa demasiado para una foto).`
      : `Enderezada y guardada al ${QUALITY * 100} %.`;
  }
  bitmap.close();
  const small = Math.max(width, height) < SMALL;
  return {
    name: file.name, blob, url: URL.createObjectURL(blob), width, height, kept,
    note: small ? `${note} Es pequeña (${width}×${height} px): en pantallas grandes se verá algo blanda; si la pareja la tiene en más resolución, mejor.` : note,
    level: small ? "warn" : "good",
    ext: blob.type === "image/webp" ? "webp" : "jpg",
  };
}

export function sniff(b) {
  if (b[0] === 0xff && b[1] === 0xd8) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  const ascii = (i, n) => String.fromCharCode(...b.slice(i, i + n));
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "webp";
  if (ascii(4, 4) === "ftyp" && /hei|mif|avi/.test(ascii(8, 4))) return "heic";
  return "";
}

// Recorre los bloques de cabecera de un JPG hasta el inicio de la imagen (SOS).
export function* jpegSegments(b) {
  let i = 2;
  while (i + 4 <= b.length && b[i] === 0xff) {
    const marker = b[i + 1];
    if (marker === 0xda) return yield { marker, start: i, end: b.length, rest: true };
    const len = (b[i + 2] << 8) | b[i + 3];
    yield { marker, start: i, end: i + 2 + len };
    i += 2 + len;
  }
}

export function exifOrientation(b) {
  for (const s of jpegSegments(b)) {
    if (s.marker !== 0xe1 || String.fromCharCode(...b.slice(s.start + 4, s.start + 8)) !== "Exif") continue;
    const t = s.start + 10, le = b[t] === 0x49;
    const u16 = (o) => le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1];
    const u32 = (o) => le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
    const ifd = t + u32(t + 4);
    for (let n = u16(ifd), e = ifd + 2; n > 0; n--, e += 12) if (u16(e) === 0x0112) return u16(e + 8) || 1;
  }
  return 1;
}

// Quita EXIF/XMP (APP1), IPTC (APP13) y comentarios sin tocar la imagen. Se queda el perfil de
// color (APP2) para que los colores no cambien.
export function stripJpegMetadata(b) {
  const parts = [b.slice(0, 2)];
  let complete = false;
  for (const s of jpegSegments(b)) {
    complete = Boolean(s.rest);
    if (s.marker === 0xe1 || s.marker === 0xed || s.marker === 0xfe) continue;
    parts.push(b.slice(s.start, s.end));
  }
  return complete ? new Blob(parts) : new Blob([b]); // cabecera rara: mejor no tocarla
}

// Reducción en pasos de la mitad: más nítida que un solo salto grande.
export function resize(bitmap, w, h) {
  let src = bitmap, sw = bitmap.width, sh = bitmap.height;
  while (sw / 2 >= w) {
    const c = new OffscreenCanvas(Math.round(sw / 2), Math.round(sh / 2));
    const g = c.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.drawImage(src, 0, 0, c.width, c.height);
    src = c; sw = c.width; sh = c.height;
  }
  const out = document.createElement("canvas");
  out.width = w; out.height = h;
  const g = out.getContext("2d");
  g.imageSmoothingQuality = "high";
  g.drawImage(src, 0, 0, w, h);
  return out;
}
