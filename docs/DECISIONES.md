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

## 2026-10-25 · Fase 3: panel de la pareja y RSVP ampliado

### Hecha antes de tener Supabase en la nube
Luis lo pidió así. Todo está probado en una copia local de Supabase; la prueba de punta a punta (`tests/e2e/pareja.mjs`) cumple el «hecho cuando» del documento: una pareja importa 150 invitados, recibe respuestas y descarga el Excel del catering.

### Enlace mágico que apunta a nuestra web, no a Supabase
El enlace es `/pareja/#acceso=<clave>` y el navegador canjea la clave por la sesión. Ventajas sobre el enlace estándar de Supabase:
- no hay que configurar las «Redirect URLs» de Supabase para cada dominio y cada vista previa;
- WhatsApp y los correos abren los enlaces para hacer la vista previa; como la clave va detrás de «#», no llega a ningún servidor y no se gasta antes de que la pareja lo abra;
- el email lo mandamos nosotros (Resend), con nuestro texto en español, sin depender del correo de Supabase.
Luis puede generar el enlace desde el panel y mandarlo por WhatsApp (sin emails configurados también funciona).

### La pareja no lee la tabla de bodas
Tiene las notas internas de Luis. Ve su boda con `pareja_resumen()` y cambia solo lo permitido con `pareja_guardar()`.

### Lo que cambia la pareja se publica solo
Sobre la versión publicada, no sobre el borrador de Luis: si Luis tiene cambios a medias, no salen. El cambio queda en el historial de la boda y como versión nueva. Si Luis estaba editando la misma boda, al guardar se le avisa en vez de pisar los cambios de la pareja.

### RSVP ampliado: módulo del plan, decidido con una casilla
Pendiente de Luis si entra en el plan de 139 € o solo en el de 249 €. Mientras, no bloquea: en Panel › Ajustes › Tarifas hay una casilla «RSVP ampliado» por tarifa (la de 249 € ya la tiene, porque entra en las dos opciones), y en cada boda se puede activar o quitar como excepción. Sin el módulo, la web sigue con su RSVP sencillo de siempre.

### El formulario ampliado vive fuera de las plantillas
`lib/rsvp-ampliado.js`, cargado solo si el plan lo incluye. Usa las mismas clases que el formulario de cada plantilla, así se ve con su estilo (comprobado en Editorial, Verbena, Postal y Editorial Negro). Las 24 copias de `rsvp.js` solo cambian para cargarlo. La Clásica no lo tiene (su RSVP es distinto y está rota en `main`).

### Los nombres de quien viene salen de la lista, nunca del formulario
Con enlace personal, el servidor ignora los nombres que mande el navegador y guarda los de la lista de la pareja. Y no se pueden confirmar más plazas de las invitadas.

### «En tiempo real» = se actualiza cada 30 segundos
Más simple y robusto que una conexión permanente, y de sobra para respuestas de boda. Avisa cuando llega una nueva.

### Excel: se lee .xlsx y se exporta CSV
El lector de Excel es propio (`lib/xlsx.js`, sin dependencias) y está probado con archivos de Excel, LibreOffice y con cadenas en línea. Para descargar se usa CSV con «;», que Excel en español abre directamente.

### Códigos QR propios
`lib/qr.js`, sin dependencias. Comprobado leyendo 300 enlaces personales con el lector de OpenCV: los 300 se leen.

### Resumen de respuestas por email
Diario o los lunes (cada pareja elige; por defecto, semanal). Solo se manda si hay respuestas nuevas, y solo se marca como enviado si ha salido de verdad. Protegido contra ejecuciones dobles de Vercel.

### Menos funciones de Vercel
`/api/pareja` agrupa acceso, enlace y recordatorio. En total hay 7 funciones; el plan Hobby permite 12.

## 2026-10-26 · Fase 4: cobros, facturas y página de seguimiento

### Se paga al momento solo en las tarifas de precio cerrado
Tal cual y Con cambios se pagan desde el escaparate. A medida no, porque su precio es «desde»: Luis pone el precio en el pedido y le manda a la pareja el enlace de seguimiento, que tiene el botón de pagar. Se puede cambiar por tarifa en Panel › Ajustes › Tarifas («pago en la web»). Si Stripe no está configurado, el escaparate reserva sin pagar, como antes.

### Pago del 100 % por adelantado (pendiente de confirmar por Luis)
Es lo que hay programado. El pedido admite varios pagos (lo que falta por pagar sale siempre en el enlace), así que una señal se puede añadir sin rehacer nada.

### Página de seguimiento con código, sin contraseña (idea de Luis)
`/seguimiento/K7M3-Q9TX`, o escribir el código en `/seguimiento/`. La pareja ve:
- en qué paso está su web;
- el plan, el estilo y las secciones;
- cada propuesta, tal como se mandó;
- la factura.

Desde ahí también puede pagar, pedir cambios y aprobar.
- **El código:** 8 letras y números, sin 0, O, 1, I ni L para que se pueda dictar. Hay 850.000 millones de combinaciones y un límite de intentos por conexión.
- **Protección de la página:** no la indexan los buscadores y no pasa la dirección a otras webs al salir.
- **La lista de invitados no se abre con el código:** tiene alergias (datos de salud) y nombres de otras personas, y un código se reenvía fácilmente. Desde el seguimiento, un botón manda el enlace de acceso al email de la pareja, sin contraseña.

### Propuestas = foto fija del borrador
«Mandar propuesta» guarda una copia del borrador tal como está y avisa a la pareja por email. Así la pareja ve exactamente lo que se le mandó, aunque Luis siga trabajando en la web. Las propuestas se abren con el código del pedido, nunca con la clave de vista previa del borrador.

### Rondas de cambios: las de las condiciones de contratación
Tal cual 0, Con cambios «las acordadas» (sin contador) y A medida 3. Corregir datos y erratas siempre está incluido y no cuenta. Una ronda es una propuesta sobre la que piden cambios de diseño: varios mensajes sobre la misma propuesta cuentan como una. Antes de la primera propuesta pueden contar lo que quieran sin gastar ronda. Se cambia por tarifa en Ajustes.

### Entrega en días laborables
Lo dicen las condiciones («3 días laborables»). Se saltan sábados, domingos y los festivos nacionales de fecha fija. No los autonómicos ni locales, ni Viernes Santo: si hace falta, Luis cambia la fecha en el pedido.

### La web no se crea sola al pagar
Hace falta su dirección (`/b/…`) y, sobre todo, sus fotos, que en la prueba del escaparate no salen del navegador de la pareja. Al pagar le sale a Luis la tarea «Preparar la web». «Crear su web» desde la ficha del cliente la crea con lo que probaron y la deja enlazada al pedido. Al enlazarla, el email del cliente recibe acceso al panel de la pareja.

### Publicar es entregar
Al publicar la web, sus pedidos pagados pasan a «Entregado» y se cierran solas las tareas de preparar y publicar.

### Tareas automáticas que se cierran solas
Preparar la web, cambios pedidos, publicar tras la aprobación, hacer una factura que falló y revisar un pago de más. Hay una tarea abierta como mucho por motivo y pedido, y se cierra sola cuando se hace lo que pide.

### Facturas
- **Simplificada para particulares:** si no piden factura a nombre de alguien y no pasa de 400 € (serie WS). Si dan NIF y dirección o pasa de 400 €, completa (serie WW).
- **Rectificativas por diferencias:** serie R, también por devoluciones parciales. La rectificativa de una simplificada (R5) no necesita el NIF del cliente.
- **Fecha de operación:** la del pago.
- **Sin Stripe Invoicing ni Stripe Tax:** las facturas salen de nuestra base de datos, que es la que cumple las reglas de numeración y Verifactu.
- **PDF propio, sin librerías:** se genera siempre desde los datos guardados, que no cambian, así que es idéntico cada vez.
- **Proveedor de Hacienda:** de momento «manual» (no se envía nada; legal hasta que Verifactu sea obligatorio). Ver [FACTURACION.md](FACTURACION.md).

### Un solo camino para todos los pagos
Stripe y lo que apunta Luis a mano (Bizum, transferencia, efectivo) pasan por la misma función de la base de datos. Las dos cosas hacen igual el pedido, la fecha de entrega, la tarea, la factura y el email a la pareja. Las devoluciones de Stripe se hacen en Stripe y llegan solas. Las demás se apuntan en el panel.

### Stripe sin librerías
- **Página de pago:** se usa la de Stripe (Checkout). Sin elegir métodos de pago en el código: salen los que Luis active en su panel de Stripe (tarjeta, Bizum, Apple Pay…).
- **Avisos firmados:** se comprueban con su firma, se guardan una vez cada uno (si Stripe repite un aviso no se cobra dos veces) y, si algo falla, Stripe los reintenta.
- **Función de los avisos:** `api/stripe.js` usa la forma estándar de la web (Request/Response) para recibir el cuerpo exacto que firma Stripe.

### Funciones de Vercel: 10 de 12
Se añaden `pedido.js` (pagar, seguimiento, propuestas y pagos a mano), `stripe.js` (avisos) y `factura.js` (PDF). El plan Hobby permite 12; Pro, más.

### Pruebas sin Stripe ni internet
`tests/stripe-falso.mjs` imita la página de pago y los avisos firmados. Con él se prueba todo de punta a punta en local (`tests/e2e/cobros.mjs`).

### Textos legales actualizados (pendiente de que Luis los revise)
- **Condiciones:** cómo se contrata pagando al momento, formas de pago, factura, página de seguimiento y la casilla «Queremos que empecéis ya». Esa casilla es la que, según el art. 103 de la ley de consumidores, hace perder el desistimiento al entregar la web.
- **Privacidad:** quién trata los datos (Supabase en la UE, Vercel, Resend y Stripe; Google durante la transición), cuánto se guardan las facturas y los datos de invitados alojados por encargo de la pareja.

## 2026-10-25 · Fase 5: automatizaciones y plazos de los datos

### Todas empiezan apagadas y solo cuentan desde que se activan
En Panel › Automatizaciones, cada una se activa o se apaga y se le cambian los días, el asunto y el texto. Al activar una, solo cuenta lo que pase desde ese momento (con un día de margen): encender «recordatorio a los 2 días» no escribe a todos los leads antiguos de golpe. Los avisos «X días antes de algo» (fecha límite de confirmar, retirada de la web) sí se mandan si aún no ha pasado ese algo.

### Cada envío se apunta y nunca se repite
Antes de mandar un email se «reserva» en la base de datos para esa persona y ese motivo. Si dos avisos llegan a la vez, solo uno lo manda. Si los emails aún no están configurados, queda como «simulado» y no se mandará después: así, al conectar Resend no salen de golpe emails atrasados.

### Emails comerciales: consentimiento y baja
Los emails a leads (bienvenida, recordatorios, pago a medias) y la petición de reseña solo van a quien aceptó la casilla del escaparate o nos pidió una reserva, y nunca a quien se dio de baja.
- **Baja:** llevan un enlace para darse de baja, que pide la LSSI. También van con las cabeceras de «darse de baja en un clic» que piden Gmail y Yahoo.
- **El enlace no da de baja solo:** abre una página con un botón. Los antivirus del correo abren todos los enlaces, y no deben dar de baja a nadie.
- **Las bajas se guardan siempre**, aunque el lead se anonimice, para no volver a escribirle.

Los emails del servicio a las parejas que han contratado no son comerciales y no llevan baja.

### La bienvenida lleva su web guardada
El email de bienvenida enlaza a `/studio/?prueba=<clave>`, que vuelve a abrir la web que probaron con sus nombres, fecha, lugar y estilo. Lleva fotos de ejemplo: las suyas nunca salieron de su móvil.

### «Qué necesitamos» va dentro del email del pago
Para no mandar dos emails seguidos, el texto de «Qué necesitamos» (fotos y datos) se añade a la confirmación del pago cuando está activo. La confirmación sale siempre, porque lleva la factura y las condiciones.

### Fotos: se piden por email, de momento
El recordatorio «faltan las fotos» sale si la web aún no tiene fotos suyas. Les pide que contesten con las originales o con un enlace de WeTransfer o Google Drive. Subirlas desde la página de seguimiento sería una mejora para más adelante.

### Retención: cumple la política de privacidad, y se activa a mano
- **Webs:** se retiran cuando llega su fecha (12 meses tras la boda, con aviso antes).
- **Invitados:** sus datos se borran a los 6 meses de la boda, con sus respuestas y las direcciones de los emails que se les mandaron.
- **Contactos que no contratan:** se anonimizan cuando llevan sin moverse el plazo de Ajustes. Se cambia de 24 a **12 meses**, que es lo que dice la política de privacidad publicada. Se conservan las cifras para las estadísticas.
- **Facturas:** no se borran nunca.

Estas tres automatizaciones piden confirmación al activarlas, porque borran datos de verdad. Lo lógico es activarlas en producción.

### Un solo aviso diario
El plan Hobby de Vercel solo permite una tarea programada al día. El aviso de cada mañana hace el resumen de respuestas y todas las automatizaciones. Si hay más de 150 emails, el resto sale al día siguiente. El panel tiene «Revisar ahora» (solo administradores, una vez por minuto) para probarlo en las vistas previas, donde Vercel no lanza tareas programadas.

### Sin funciones nuevas
La baja y la web guardada van en `api/lead.js`, y el email «web publicada» en `api/pedido.js`. Siguen siendo 10 funciones de 12.

## Problemas encontrados que ya estaban en `main`

- **La plantilla Clásica no se pinta** (estilos Olivar, Atardecer y Noche): `js/sections/hero.js` importa `longDate`, que no existe en `js/format.js`; además usa `t` sin definir y `js/main.js` no registra `story`, `gifts` ni `closing`. Parece un cambio a medias. No se ha tocado: hay que decidir cómo debía quedar.

## Pendiente de Luis

1. ¿El RSVP ampliado (grupos, acompañantes, alergias, autobús) entra en el plan de 139 € o solo en el de 249 €? Ya no bloquea: es una casilla en Panel › Ajustes › Tarifas.
2. ¿Autónomo o sociedad? Cambia la fecha de Verifactu y los datos de las facturas. Se rellena en Panel › Ajustes.
3. Proveedor de facturación para Verifactu: tres opciones y mi recomendación en [FACTURACION.md](FACTURACION.md). No corre prisa.
4. Dominio definitivo, y si las bodas van en ruta (`/b/…`) o en subdominio.
5. Datos fiscales del vendedor (Panel › Ajustes) para la página legal y las facturas.
6. Qué hacer con la Clásica.
7. ¿Cobro del 100 % por adelantado en todas las tarifas, o señal en A medida?
8. ¿Valen las rondas de cambios de las condiciones (0 / las acordadas / 3)? Se cambian en Ajustes › Tarifas.
9. Revisar los textos nuevos de condiciones y privacidad (`studio/legal.html`).
10. Crear la cuenta de Stripe en modo de prueba: [STRIPE.md](STRIPE.md).
11. Conectar los emails (Resend y tu dominio): [EMAILS.md](EMAILS.md). Necesita el punto 4.
12. Leer y retocar los textos de los emails automáticos (Panel › Automatizaciones) y decidir cuáles activar.
13. Enlaces de Google y Bodas.net para pedir reseñas (Panel › Ajustes › Reseñas).
