// Etiqueta: todo el movimiento (marco que se dibuja, nombres y brillo) es CSS y respeta
// prefers-reduced-motion. Aquí solo se pinta la barra del navegador móvil de azul noche,
// para que la web parezca a sangre. Es idempotente: se puede llamar en cada repintado.
export function enhance() {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
  }
  meta.content = "#0f1b2d";
}
