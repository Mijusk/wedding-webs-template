import { test } from "node:test";
import assert from "node:assert/strict";
import { sniff, exifOrientation, stripJpegMetadata } from "../../lib/fotos.js";

// JPG mínimo: inicio, bloque EXIF (con orientación 6 y "GPS"), perfil de color (APP2), tabla, imagen y fin.
function fakeJpeg(orientation = 6) {
  const tiff = [0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // big-endian, IFD en 8
    0x00, 0x01, // 1 entrada
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00, // Orientation
    0x00, 0x00, 0x00, 0x00, ...Buffer.from("GPS")];
  const exif = [...Buffer.from("Exif\0\0"), ...tiff];
  const seg = (marker, data) => [0xff, marker, ((data.length + 2) >> 8) & 0xff, (data.length + 2) & 0xff, ...data];
  return new Uint8Array([0xff, 0xd8, ...seg(0xe1, exif), ...seg(0xe2, [...Buffer.from("ICC_PROFILE\0"), 1, 2, 3]),
    ...seg(0xdb, [0, 1, 2, 3]), 0xff, 0xda, 0x00, 0x04, 0x01, 0x02, 0x10, 0x20, 0x30, 0xff, 0xd9]);
}

test("reconoce el tipo de foto por sus primeros bytes", () => {
  assert.equal(sniff(fakeJpeg()), "jpeg");
  assert.equal(sniff(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])), "png");
  assert.equal(sniff(new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")])), "webp");
  assert.equal(sniff(new Uint8Array([0, 0, 0, 0x18, ...Buffer.from("ftypheic")])), "heic");
});

test("lee la orientación EXIF", () => {
  assert.equal(exifOrientation(fakeJpeg(6)), 6);
  assert.equal(exifOrientation(fakeJpeg(1)), 1);
});

test("quita EXIF (con el GPS) sin tocar la imagen ni el perfil de color", async () => {
  const original = fakeJpeg();
  const clean = new Uint8Array(await stripJpegMetadata(original).arrayBuffer());
  assert.ok(!Buffer.from(clean).includes(Buffer.from("Exif")), "sigue teniendo EXIF");
  assert.ok(!Buffer.from(clean).includes(Buffer.from("GPS")), "sigue teniendo GPS");
  assert.ok(Buffer.from(clean).includes(Buffer.from("ICC_PROFILE")), "ha perdido el perfil de color");
  const tail = (b) => Buffer.from(b.slice(b.indexOf(0xda) - 1));
  assert.deepEqual(tail(clean), tail(original), "los datos de la imagen han cambiado");
});
