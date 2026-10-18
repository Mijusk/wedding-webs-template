# Wedding Webs · template

Web de boda configurable desde un único `config.json`. HTML, CSS y JS sin framework ni paso de build.

## Probar en local

```bash
npx serve .          # o: python3 -m http.server 8000
# plantilla: http://localhost:3000/   escaparate: http://localhost:3000/studio/
```

No hay `npm run dev`: no hay paso de build.

(Hace falta un servidor: `fetch("config.json")` no funciona abriendo el archivo directamente.)

## Estructura

| Ruta | Qué es |
| --- | --- |
| `config.json` | Datos de la boda: pareja, fecha, lugar, programa, RSVP y secciones visibles |
| `css/theme.css` | Colores y tipografías (lo único de estilo que debería cambiar por cliente) |
| `css/base.css`, `css/rsvp.css` | Maquetación y formulario |
| `js/main.js` | Carga el config y pinta las secciones de `config.sections` |
| `js/sections/*.js` | Una sección por archivo (hero, detalles, programa) |
| `js/rsvp.js` | Formulario flotante de confirmación |
| `js/storage.js` | Guardado del RSVP: Google Sheets si hay `rsvp.endpoint`, si no, simulado en localStorage |
| `css/themes/*.css` | Estilos alternativos (`config.theme`): sobrescriben los tokens de `theme.css` |
| `studio/` | Escaparate comercial con el generador de vista previa (ver abajo) |
| `plantillas/editorial/` | Segunda plantilla (portada a pantalla completa, historia en capítulos, la página atardece). Autocontenida |
| `plantillas/minimal/` | Minimalista: blanco y negro, nombres enormes, secciones numeradas con líneas finas, fotos en gris. Autocontenida |
| `plantillas/verbena/` | Exagerada: fiesta de pueblo con banderines, pegatinas, cinta que corre, cuenta atrás grande y fotos tipo polaroid. Autocontenida |
| `plantillas/postal/` | Sencilla: una sola tarjeta de invitación de papel con todo lo esencial, más el regalo. Autocontenida |
| `plantillas/villa/` | Elegante, "lujo tranquilo": escudo de olivo con las iniciales, foto que se abre como contraventanas, código de vestimenta con paleta. Autocontenida |
| `plantillas/etiqueta/` | Gala: azul marino y oro, marco grabado, código de vestimenta obligatorio. Autocontenida |
| `plantillas/lacre/` | Sobre cerrado con sello de lacre que se abre al tocarlo (o solo a los 3 s); dentro, invitación de papel. Autocontenida |
| `plantillas/acuarela/` | Manchas de acuarela generadas por pareja, fotos con borde pintado, iconos a línea en el programa. Autocontenida |
| `plantillas/monograma/` | Sin foto de portada: iniciales entrelazadas en SVG, crema y burdeos. Autocontenida |
| `plantillas/negro/` | Editorial Negro: portada de revista, foto en blanco y negro que gana color al bajar, historia como entrevista, programa como sumario. Autocontenida |
| `plantillas/toile/` | Toile de Jouy azul dibujado en SVG, entrada con lazo que se deshace, paralaje suave. Autocontenida |
| `plantillas/palacio/` | Art Déco: puertas doradas de entrada, abanicos, esmeralda y negro, código de vestimenta años 20. Autocontenida |
| `plantillas/jardin/` | Jardín Inglés: flores prensadas en SVG que caen y se mueven con el ratón. Autocontenida |
| `plantillas/lino/` | Lino y Piedra: minimal cálido, fundidos lentos, mucho aire. Autocontenida |
| `plantillas/azulejo/` | Azulejo cobalto generado en SVG con las iniciales, marco que se coloca pieza a pieza. Autocontenida |
| `plantillas/carrete/` | Película de 35 mm: la portada se revela de negativo a positivo, fecha naranja de cámara, historia como hoja de contactos. Autocontenida |
| `plantillas/carta/` | Carta manuscrita (`copy.letter`) que se escribe sola, con botón Saltar. Autocontenida |
| `plantillas/vegetal/` | Hoja de papel vegetal translúcida sobre la foto que se levanta al bajar. Autocontenida |
| `plantillas/capilla/` | Arcos, rosetón con iniciales, entrada de luz; sección opcional `liturgy` (lecturas y música). Autocontenida |
| `plantillas/botanica/` | Láminas de herbario en SVG que se dibujan y colorean; la planta de portada depende de la estación de la boda. Autocontenida |
| `plantillas/costa/` | Horizonte y ola; hora real de la puesta de sol (NOAA) si `venue.lat`/`venue.lon`; sección `travel` (cómo llegar). Autocontenida |
| `plantillas/estrellas/` | Mapa del cielo real de esa noche (catálogo de 411 estrellas, Luna) con `venue.lat`/`venue.lon`; sin ellas usa Madrid. Autocontenida |
| `plantillas/galeria/` | Museo: marcos dorados, focos que se encienden, cartelas en `copy.gallery.labels`. Autocontenida |
| `plantillas/ciudades/` | Pasaporte y sello; `cities` (dos ciudades con tz y lat/lon) para relojes y mapa; ES/EN con `copy_en`; sección `travel`. Autocontenida |
| `integrations/leads.gs` | Apps Script para los contactos del escaparate: guarda pruebas y reservas en una hoja y te avisa por email |
| `integrations/google-sheets.gs` | Apps Script que recibe las respuestas en la hoja de la pareja |
| `fonts/`, `plantillas/*/fonts/`, `studio/fonts/` | Fuentes alojadas en la propia web (sin conectar con Google, por privacidad) |
| `studio/legal.html` | Aviso legal, privacidad y condiciones. Los datos del titular y los plazos salen de `studio.json > legal` |
| `vercel.json`, `_headers` | Cabeceras para Vercel y Netlify: ninguna otra web puede incrustar estas páginas |

## Nueva boda

1. Rama nueva desde `main`.
2. Edita `config.json` y `css/theme.css`.
3. Fotos: con la web arrancada (`npx serve .`), abre `/herramientas/fotos.html`, elige la web y arrastra las fotos originales de la pareja. Las que ya caben (hasta 2560 px) se guardan sin recomprimir, solo sin metadatos (GPS incluido); las más grandes, giradas o en PNG se pasan a JPG al 92 %. Marca la portada y pulsa sobre las caras para el encuadre viendo la web en móvil y ordenador. "Guardar en la carpeta de la web" escribe `assets/portada.jpg`, `assets/foto-2.jpg`… y actualiza `config.json`. Las HEIC de iPhone hay que pedirlas en JPG.
4. Para guardar respuestas en Sheets: pega `integrations/google-sheets.gs` en la hoja (Extensiones > Apps Script), despliega como aplicación web con acceso "Cualquiera" y pon la URL en `rsvp.endpoint`.
5. Después de las fotos, abre `/herramientas/compartir.html`, elige la web, escribe la dirección donde se publicará y pulsa "Guardar en la carpeta de la web" (Chrome o Edge). Crea `compartir.jpg` (la tarjeta de WhatsApp, con la foto y los nombres en las fuentes de la plantilla), `icono.png` (iniciales para la pestaña y el móvil) y reescribe la cabecera del `index.html` entre `compartir:start` y `compartir:end`. Vuelve a hacerlo si cambian los nombres, la fecha, la foto o la dirección.
   WhatsApp guarda la tarjeta la primera vez que alguien manda el enlace: prepárala antes de compartirlo. Si ya se compartió con la tarjeta vieja, manda el enlace con `?v=2` al final.

Guarda la fecha con su zona horaria (`2027-06-12T18:00:00+02:00`): sin ella, "Añadir al calendario" y la cuenta atrás usan la zona del invitado.

### Qué hace la web sola según la fecha

- Hasta `rsvp.deadline` (incluido): formulario abierto.
- Pasada la fecha límite: el formulario se cierra y sale `rsvp.closedText` (Clásica) o `copy.rsvp.closedText` (el resto).
- El día de la boda: "Es hoy". Después: sin cuenta atrás ni botón de confirmar.
- Si la hoja no confirma que ha guardado la respuesta, el invitado ve un error y puede reintentar (nunca un "gracias" falso). Si alguien contesta dos veces con el mismo nombre, vale la última respuesta.

## Añadir una sección

Crea `js/sections/<nombre>.js` exportando una función `(config) => html`, regístrala en `SECTIONS` dentro de `js/main.js` y añade su nombre a `config.sections`.

La fecha y la hora se muestran tal cual están en el config (hora local del lugar), sin convertir a la zona horaria del invitado.

## Escaparate y generador (`studio/`)

`http://localhost:8000/studio/` es la web comercial: estilos con ejemplos en vivo, un formulario mínimo que genera la web de la pareja con su nombre, fecha, lugar y fotos, tarifas y formulario de reserva.

- Entrada: la primera vez en cada visita sale una cortina oscura con el monograma de las dos W dibujándose y un contador; la cortina sube y la portada aparece por capas (titular palabra a palabra, fotos que se abren alrededor de la web de ejemplo). Las fotos se mueven un poco con el ratón y al bajar, y cada bloque aparece al llegar a él. Código en `studio/app/entrance.js` y `studio/entrance.css`; sin animaciones si el sistema pide reducir movimiento.
- Tras cambiar `integrations/leads.gs` o `google-sheets.gs`, vuelve a desplegar en Apps Script: Implementar > Gestionar implementaciones > editar > Versión nueva (la URL no cambia).
- `studio/studio.json` manda: marca, estilos del selector (`status: "available"` o `"soon"`), tiempos de la carga, tarifas y `contact.endpoint` (Apps Script para guardar reservas; vacío = simulado en el navegador).
- La plantilla se pinta en un iframe con `index.html#preview`: en ese modo no lee `config.json`, lo recibe del escaparate por `postMessage`. Cambiar de estilo es reenviar el config con otro `theme`, sin recargar.
- Las fotos se reducen en el navegador y no se suben a ningún sitio.
- En la portada solo salen dos filas de estilos; si hay más, aparece "Ver todas las plantillas", que lleva a `studio/plantillas.html` (los ejemplos se cargan al acercarse). Sus botones vuelven a la portada con `?probar=<estilo>` o `?ver=<estilo>`.
- "Secciones" en la vista previa: la pareja enciende y apaga secciones al momento (historia, fotos, horario, regalo, confirmación); lo apagado se mantiene al cambiar de estilo y viaja en la reserva (`sections`, con la lista completa en `allSections`). Nombres, textos de ayuda y cuáles son fijas en `studio.json > sections`.
- Un estilo nuevo con la misma maquetación = un archivo en `css/themes/` y una entrada en `styles`. Una maquetación nueva = otra carpeta en `plantillas/` con su `index.html` que entienda el modo `#preview`, una entrada en `templates` y, si usa campos propios, su línea en `studio/app/wedding.js` (que traduce los datos del formulario al config de cada plantilla).
