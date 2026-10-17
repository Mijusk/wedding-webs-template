// Carga config.json: la única fuente de verdad de cada boda.
export async function loadConfig(url = "config.json") {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
  return res.json();
}

// Modo vista previa (index.html#preview dentro de un iframe): el config no se lee
// del archivo, lo envía la página que contiene el iframe (el generador de studio/).
// Cada mensaje nuevo vuelve a pintar la web, así cambiar de estilo es instantáneo.
// Solo vale si el escaparate está en el mismo dominio: así nadie puede meter la web real
// de una pareja en su página y enseñarla con otros datos (por ejemplo, otro IBAN).
export const isPreview = location.hash === "#preview" && window.parent !== window && sameOriginParent();

function sameOriginParent() {
  try { return window.parent.location.origin === location.origin; } catch { return false; }
}

export function onPreviewConfig(render) {
  addEventListener("message", (e) => {
    if (e.source !== window.parent || e.origin !== location.origin || e.data?.type !== "wedding:config") return;
    render(e.data.config);
  });
  window.parent.postMessage({ type: "wedding:ready" }, location.origin);
}
