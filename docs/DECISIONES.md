# Decisiones

Cada decisión con su fecha y su motivo. Las técnicas las toma el ingeniero y se explican en una frase; las de negocio, Luis.

## 2026-10-24 · Fases 0, 1 y el panel de la fase 2

### Panel sin Next.js: HTML y JavaScript sin compilar, en `/panel/` del mismo proyecto
El documento recomendaba Next.js. Se ha hecho igual que el resto de la web (sin paso de compilación) por cuatro motivos:
1. **Vista previa en vivo de verdad.** Al estar en el mismo dominio que las plantillas, el editor usa el modo `#preview` que ya tenían: se ve la plantilla real mientras se escribe, sin copiar nada.
2. **Un solo proyecto en Vercel**, sin un segundo despliegue ni dominios cruzados.
3. **Sin dependencias que actualizar.** Un negocio de una persona no puede estar persiguiendo versiones de frameworks.
4. En el entorno de trabajo de esta fase no se podían instalar paquetes de npm, así que así además se ha podido **probar todo de verdad**.
La seguridad no depende de esto: lo que cada usuario ve o cambia lo decide la RLS de la base de datos.

### Sin dependencias ni CDNs de terceros
Ni el panel ni las funciones de `/api` cargan librerías. El cliente de Supabase del panel (`panel/js/supa.js`) es mínimo y propio. Motivo: privacidad (el visitante no se conecta a terceros, igual que con las fuentes), menos mantenimiento y nada que se rompa por una actualización ajena.

### Las bodas se sirven con una función que reutiliza el `index.html` de cada plantilla
`/b/<slug>` → `api/boda.js` lee el `index.html` de la plantilla, le añade `<base>` (para que sus CSS, JS y fuentes carguen de su carpeta), mete el config de la boda en la página y pone las etiquetas de WhatsApp de esa pareja. Las plantillas solo han cambiado 3 líneas de `js/config.js` (idénticas en las 25), y se ve igual píxel a píxel (`tests/e2e/plantillas.mjs`).

### Caché: 60 segundos en el borde de Vercel, sin invalidación manual
`s-maxage=60, stale-while-revalidate=86400`: las webs se sirven desde la caché de Vercel y un cambio publicado tarda como mucho un minuto en verse. Más sencillo y fiable que purgar la caché al publicar.

### Vista previa del borrador con una clave por boda
`/b/<slug>?vista=<clave>` enseña lo último guardado (no publicado). La clave vive en `weddings.preview_token` y se puede cambiar desde el panel para invalidar enlaces viejos. Las respuestas enviadas desde la vista previa no se guardan.

### Fotos: cubo público con rutas imposibles de adivinar
El documento pedía cubo privado con URLs firmadas o CDN. Las URLs firmadas caducan y romperían la caché y las tarjetas de WhatsApp. Como la web de la boda ya es pública para quien tiene el enlace, las fotos se guardan en un cubo público con rutas aleatorias (`weddings/<id>/<uuid>.jpg`): mismo nivel de privacidad que la propia web. Solo el equipo puede subir o borrar.

### La calidad de foto se trata en el navegador, con el mismo código que `herramientas/fotos.html`
Ahora está en `lib/fotos.js` y lo usan los dos. Las fotos que ya caben (≤ 2560 px) se suben byte a byte sin EXIF ni GPS; las demás se pasan a JPG al 92 %.

### Seguridad por filas (RLS) en todas las tablas
El rol anónimo no tiene acceso a nada. Lo público (webs, RSVP, leads, tarifas) pasa por funciones `api_*` que solo puede llamar nuestro servidor con la clave secreta, con validación y límite de peticiones. Ajustes, equipo y facturas: solo dueño y administradores. La pareja: solo su boda. Probado en `tests/db/01_rls.sql`.

### Facturación: las reglas legales ya están en la base de datos
Aunque los cobros son la fase 4, el modelo ya cumple desde hoy: numeración sin huecos por serie y año, facturas emitidas inmutables (por disparadores, no solo en pantalla), rectificativas en serie R y registros encadenados con la huella SHA-256 del formato de la AEAT. Sin datos fiscales del vendedor no se puede emitir. Falta (fase 4) conectar el proveedor certificado.

### Precios con IVA incluido
Se guardan en céntimos con IVA incluido (`products.price_cents`). En las facturas, base y cuota se calculan desde el total de cada línea, para que el total sea siempre el precio anunciado (79,00 € = 65,29 + 13,71).

### Atribución de publicidad sin cookies (de momento)
UTM, gclid y fbclid se guardan en `sessionStorage` (se borra al cerrar la pestaña) y viajan con el lead. Guardar el primer toque entre visitas necesita el consentimiento de cookies de publicidad: llegará con el banner (fase 6).

### Los leads no se pierden durante el cambio
El escaparate manda a `/api/lead`; si falla, manda a la hoja de Google de siempre (`studio.json > contact.fallbackEndpoint`). Además, con `LEADS_SHEET_ENDPOINT` cada lead se copia en la hoja mientras Luis quiera.

### Instalación sin terminal
`supabase/instalar.sql` junta todas las migraciones en un archivo para pegar en el editor SQL de Supabase. Se regenera con `npm run migraciones` y las pruebas avisan si no está al día.

### Bodas en ruta `/b/<slug>`
Es lo único que funciona sin decidir el dominio. La base ya tiene `custom_domain` y `api/boda.js` acepta `?host=`; el subdominio o el dominio propio se activan cuando Luis decida (pendiente 5).

### Región de las funciones: Fráncfort (`fra1`)
La misma zona que la base de datos: menos espera en cada petición.

### Claves nuevas de Supabase
El código acepta las claves nuevas (`sb_publishable_…`, `sb_secret_…`) y las antiguas (`anon`, `service_role`). Supabase retira las antiguas a finales de 2026.

## Problemas encontrados que ya estaban en `main`

- **La plantilla Clásica no se pinta** (estilos Olivar, Atardecer y Noche): `js/sections/hero.js` importa `longDate`, que no existe en `js/format.js`; además usa `t` sin definir y `js/main.js` no registra `story`, `gifts` ni `closing`. Parece un cambio a medias. No se ha tocado: hay que decidir cómo debía quedar.

## Pendiente de Luis

1. ¿El RSVP ampliado (grupos, acompañantes, alergias, autobús) entra en el plan de 139 € o solo en el de 249 €? (antes de la fase 3)
2. ¿Autónomo o sociedad? Cambia la fecha de Verifactu y los datos de las facturas. Se rellena en Panel › Ajustes.
3. Proveedor de facturación (te traeré 3 opciones en la fase 4).
4. Dominio definitivo, y si las bodas van en ruta (`/b/…`) o en subdominio.
5. Datos fiscales del vendedor (Panel › Ajustes) para la página legal y las facturas.
6. Qué hacer con la Clásica.
