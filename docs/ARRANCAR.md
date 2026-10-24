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

Usuarios de ejemplo del panel: `luis@example.com` / `demo-luis-1234` (dueño) y `ayudante@example.com` / `demo-ayudante-1234` (editor). Pareja: `lucia@example.com` / `demo-pareja-1234` (no entra en el panel).

## Pruebas

```bash
npm test             # validador del config, fotos, CSV y que instalar.sql esté al día (sin base de datos)
npm run test:db      # seguridad por filas, facturas y funciones de la base (necesita supabase db reset)
npm run test:api     # funciones de /api contra el servidor local (npm run dev)
npm run test:e2e     # navegador real: flujo completo, panel y las 25 plantillas (necesita Playwright)
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
