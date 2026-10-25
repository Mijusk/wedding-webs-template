# Arrancar todo en local y pasar las pruebas

Para quien programe (Luis no lo necesita para usar el panel).

## Lo que hay

| Parte | Dónde | Cómo funciona |
| --- | --- | --- |
| Escaparate | `studio/` | Estático, como siempre. |
| Plantillas | raíz y `plantillas/` | Estáticas. Leen el config de la página (bodas de la base de datos) o de su `config.json`. |
| Webs de boda | `/b/<slug>` → `api/boda.js` | Función de Vercel que pinta la plantilla con el config de la base de datos. |
| API pública | `api/rsvp.js`, `api/lead.js`, `api/productos.js` | Funciones de Vercel. Hablan con Supabase con la clave secreta. |
| Panel | `panel/` | Estático. Habla con Supabase desde el navegador con la clave publicable; la RLS decide qué ve cada uno. |
| Panel de la pareja | `pareja/` | Estático, como el panel. Entra con `/pareja/#acceso=<clave>` (lo genera `api/pareja.js`). |
| Seguimiento del pedido | `seguimiento/` + `api/pedido.js` | Estático. `/seguimiento/<código>` habla con `/api/pedido` (sin sesión: el código es la llave). |
| Cobros | `api/pedido.js`, `api/stripe.js` | Página de pago de Stripe y sus avisos firmados. `/pagar/<código>` lleva directo a pagar. |
| Facturas en PDF | `api/factura.js` | PDF propio (`api/_lib/pdf.js`), para el panel (con sesión) o la pareja (con su código). |
| Base de datos | `supabase/migrations/` | Postgres en Supabase, con RLS en todas las tablas. |

Nada necesita compilación ni `npm install`: solo Node 20 o superior.

## Con la CLI de Supabase (necesita Docker Desktop)

```bash
npm i -g supabase          # o: brew install supabase/tap/supabase
supabase start             # Postgres, Auth y Storage en local
supabase db reset          # aplica las migraciones y los datos de ejemplo (supabase/seed.sql)
supabase status            # copia "API URL", "publishable/anon key" y "secret/service_role key"
cp .env.example .env.local # y pega ahí esas tres claves
npm run dev                # http://localhost:3000/studio/ · panel: http://localhost:3000/panel/
```

Usuarios de ejemplo del panel: `luis@example.com` / `demo-luis-1234` (dueño) y `ayudante@example.com` / `demo-ayudante-1234` (editor). Pareja: `lucia@example.com` (entra en `/pareja/` con el enlace que genera el panel; no entra en `/panel/`). Enlace personal de invitados de ejemplo: `/b/lucia-y-martin?i=demo-familia-ortega-0000000001`.

## Cobros en local, sin Stripe

```bash
node tests/stripe-falso.mjs   # un Stripe de mentira en http://127.0.0.1:12111
```

Y en `.env.local` (reinicia `npm run dev` después):

```
STRIPE_SECRET_KEY=sk_test_local
STRIPE_WEBHOOK_SECRET=whsec_local
STRIPE_API_BASE=http://127.0.0.1:12111
```

Al pagar en el escaparate se abre su página «Pagar / Cancelar», que manda el aviso firmado a `/api/stripe` como lo haría Stripe. Pedido de ejemplo con propuesta y un cambio pedido: `/seguimiento/DEMA-2345`.

## Pruebas

```bash
npm test             # validador del config, fotos, CSV y que instalar.sql esté al día (sin base de datos)
npm run test:db      # seguridad por filas, facturas y funciones de la base (necesita supabase db reset)
npm run test:api     # funciones de /api contra el servidor local (npm run dev), cobros incluidos
npm run test:e2e     # navegador real: flujo completo, panel, panel de la pareja, cobros y las 25 plantillas (necesita Playwright)
```

Las de navegador usan Playwright (`npm i -g playwright && npx playwright install chromium`). `npm run test:e2e` deja capturas en `tests/e2e/capturas/`. Si `test:e2e` falla tras otras pruebas, vuelve a cargar los datos con `supabase db reset`.

## Cambiar la base de datos

1. Crea un archivo nuevo en `supabase/migrations/` con fecha delante (`20261101000100_lo-que-sea.sql`). No edites los ya aplicados en producción.
2. Si creas una tabla: `enable row level security` y sus políticas, y `revoke all on <tabla> from anon`.
3. `npm run migraciones` para regenerar `supabase/instalar.sql`.
4. Si cambian los datos de ejemplo: `npm run semillas`.

## Otras cosas útiles

- `npm run validar`: comprueba las configs de las plantillas contra el esquema.
- `npm run importar-boda -- --rama <rama> [--publicar]`: pasa a la base una boda de una rama antigua.
- Las bodas importadas o creadas con la Clásica no se verán bien hasta arreglarla (ver DECISIONES.md).
