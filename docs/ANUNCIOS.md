# Medir los anuncios de Meta y Google

El escaparate (`/studio/`) ya está preparado para el píxel de Meta (Instagram y Facebook) y la
etiqueta de Google Ads. Está **apagado**: mientras los identificadores estén vacíos no se carga
nada. Solo hay que pegarlos en `studio/studio.json` y publicar.

## Qué hace

- Solo se carga si la persona acepta **«Publicidad y medición de anuncios»** en el aviso de
  cookies. Si rechaza o no contesta, no se carga nada. Si después retira el permiso, se deja de
  enviar y se borran las cookies de Meta y Google de la web.
- Envía dos conversiones, sin nombres ni emails (solo tarifa, estilo y precio):
  - **lead**: cuando envían el formulario «Probar con vuestra boda» (con un email de verdad, no
    el del botón de ejemplo). En Meta es el evento `Lead`.
  - **reserva**: cuando envían una reserva o pasan a pagarla. En Meta es `SubmitApplication`.
- Las dos conversiones salen de un único sitio, `conversion()` en `studio/app/ads.js`, que también
  las manda a Umami (`lead_prueba` y `reserva_enviada`, como hasta ahora).
- En Google Ads, la personalización de anuncios (remarketing) va denegada, porque el aviso de
  cookies no la pide.
- No se carga en `localhost`: se prueba en la vista previa de Vercel o en la web publicada.

## 1. Pegar los identificadores

En `studio/studio.json`, bloque `ads`:

```json
"ads": {
  "metaPixelId": "123456789012345",
  "googleAdsId": "AW-1234567890",
  "events": {
    "lead":    { "umami": "lead_prueba",     "meta": "Lead",              "googleLabel": "AbCdEfGhIjk" },
    "reserva": { "umami": "reserva_enviada", "meta": "SubmitApplication", "googleLabel": "LmNoPqRsTuv" }
  }
}
```

- **metaPixelId**: Meta Business Suite › Administrador de eventos › tu píxel › el número del
  identificador (solo números).
- **googleAdsId**: Google Ads › Objetivos › Conversiones › crea una conversión de tipo «Sitio
  web» › «Configurar manualmente» › «Usar Google tag». Es el `AW-…` de `send_to`.
- **googleLabel**: la parte de después de la barra en `send_to: 'AW-1234567890/AbCdEfGhIjk'`.
  Crea una conversión para «lead» y otra para «reserva», y pega cada etiqueta en su sitio.
  Si una etiqueta está vacía, esa conversión no se manda a Google.

Se puede poner solo uno de los dos (solo Meta o solo Google).

Antes de activar Meta, acepta en el Administrador de eventos las condiciones de las herramientas para
empresas de Meta: incluyen el acuerdo de corresponsabilidad que cita la página legal («Meta,
corresponsable»).

Haz commit, súbelo y espera a la vista previa de Vercel.

## 2. Comprobar que funciona

1. Abre la vista previa en una ventana de incógnito (para que salga el aviso de cookies).
2. **Sin aceptar** (pulsa «Rechazar todo»): en Chrome, F12 › pestaña Red › filtra por
   `facebook` y por `googletagmanager`. No tiene que aparecer nada.
3. Abre «Configurar cookies» al pie y activa **Publicidad**. Ahora sí tienen que aparecer
   `fbevents.js` y `gtag/js`.
4. **Meta**: Administrador de eventos › tu píxel › «Probar eventos». Pega la dirección de la vista
   previa, abre la web desde ahí y acepta la publicidad. Deben llegar `PageView`; prueba el
   generador con un email real tuyo (llega `Lead`) y envía una reserva de prueba (llega
   `SubmitApplication`). La extensión «Meta Pixel Helper» de Chrome también lo enseña.
5. **Google**: con la extensión «Tag Assistant» (tagassistant.google.com) conectada a la vista
   previa, acepta la publicidad y repite el generador y la reserva: deben salir los eventos
   `conversion` con tu `send_to`. En Google Ads, las conversiones pueden tardar unas horas en
   aparecer como «Registrando conversiones».
6. Vuelve a «Configurar cookies», apaga la publicidad y comprueba en F12 › Aplicación › Cookies que
   desaparecen `_fbp`, `_fbc`, `_gcl_au` y `_gcl_aw`.

## 3. API de conversiones de Meta (desde el servidor)

Cuando una pareja guarda su prueba (lead nuevo) o envía una reserva, `api/lead.js` manda también el
evento a Meta desde el servidor (`api/_lib/meta.js`). Meta lo junta con el del píxel gracias al
mismo `eventID` y lo cuenta una sola vez. Sirve para los que tienen bloqueador de anuncios o un
navegador que corta el píxel, y Meta empareja mejor a la persona con el anuncio que vio.

- Solo se manda con el permiso de **Publicidad** del aviso de cookies (el mismo que el píxel).
- Sale: email y teléfono **cifrados** (SHA-256), IP, navegador, cookies `_fbp`/`_fbc`, la página y
  la tarifa. Nunca nombres, fecha ni lugar. Lo explica la página legal.
- Las reservas que pasan directamente a pagar con Stripe (`/api/pedido`) todavía no se mandan
  desde el servidor: solo las ve el píxel.

Para activarla, en Vercel › Settings › Environment Variables (Production y Preview):

| Variable | De dónde sale |
| --- | --- |
| `META_CAPI_TOKEN` | Administrador de eventos › tu píxel › Configuración › API de conversiones › «Generar identificador de acceso». Es secreta: solo en Vercel, nunca en el código ni en chats. |
| `META_PIXEL_ID` | Opcional: si no está, usa `studio.json › ads.metaPixelId`. |
| `META_TEST_EVENT_CODE` | Opcional, solo para probar: el código de «Probar eventos» (p. ej. `TEST12345`). Quítala después. |

Comprobar: con `META_TEST_EVENT_CODE` puesta, abre la web, acepta la publicidad y guarda una
prueba con tu email. En «Probar eventos» tiene que salir `Lead` dos veces (Navegador y Servidor)
marcado como «Desduplicado».

## 4. Dónde abandona la gente (embudo del generador)

Con la analítica aceptada, cada paso del generador manda a Umami el evento `paso_generador` con
`paso` (nombres, fecha, lugar, estilo, fotos) y `numero` (1 a 5), una vez por paso cada vez que
se abre. En Umami › Eventos › `paso_generador`, filtra por `numero`: el salto más grande entre un
número y el siguiente es el paso que hay que mejorar. Después vienen `prueba_generada`,
`guardar_abierto` y `lead_prueba`.

## 5. Pie «Hecha con WeddingWebs» en las webs de boda

Cada web publicada en `/b/<boda>` lleva al final un pie discreto: «Web hecha con WeddingWebs ·
Haced la vuestra», que enlaza al escaparate con `utm_source=web-boda&utm_campaign=<boda>`. En el
CRM se ve qué boda trajo a cada pareja nueva. Para quitarlo en una boda (si una pareja de Atelier
lo pide), pon `"credit": false` en su config.

## 6. «¿Cómo nos habéis conocido?»

La atribución por enlace solo ve los enlaces con `utm`, `gclid` o `fbclid`. No ve el boca a boca
(escriben la dirección a mano), los enlaces abiertos desde WhatsApp o Instagram sin `utm`, ni a
quien vuelve otro día sin haber aceptado las cookies de publicidad. Por eso el escaparate pregunta,
opcional y de un toque, cómo nos conocieron: al guardar la web (botones) y al reservar
(desplegable, que sale ya con la respuesta si la dieron al guardar).

- Opciones: Instagram, Facebook, Google, Bodas.net, Amigos o familia, La web de otra boda, Otro
  (`studio/app/heard.js`; las mismas en `panel/js/ui.js` y en la restricción de la base de datos).
- Se guarda en `leads.heard_from` (migración `20261125000100_como_nos_conocisteis.sql`). Una
  respuesta nueva sustituye a la anterior; si no contestan, se queda la que había.
- En el panel: ficha del lead («De dónde vino»), «Editar datos», tabla de leads (bajo «Origen»),
  filtro «Cómo nos conocieron» (con «No lo dijeron») y la columna en «Exportar».
- Para decidir en qué gastar, mira las dos cosas juntas: la campaña (enlace) y lo que dicen.

## 7. Lo que queda para más adelante

- Mandar también la compra pagada con Stripe (`Purchase`) desde el webhook.
- Si algún día se quiere **remarketing** (enseñar anuncios a quien ya visitó la web), hay que
  añadirlo al texto del aviso de cookies (`studio/app/consent.js`, subiendo `VERSION`) y a la
  página legal antes de activarlo.
