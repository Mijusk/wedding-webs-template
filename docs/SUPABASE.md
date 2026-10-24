# Poner en marcha Supabase (lo que tienes que hacer tú)

Unos 20 minutos. No hace falta terminal ni saber programar: todo es copiar, pegar y pulsar botones.

Mañana haremos solo el **proyecto de pruebas (staging)**. El de producción, más adelante, con los mismos pasos.

---

## 1. Crear el proyecto de pruebas

1. Entra en [supabase.com](https://supabase.com) y crea una cuenta (puedes entrar con GitHub).
2. Pulsa **New project** y rellena:
   - **Name**: `weddingwebs-staging`
   - **Database password**: pulsa *Generate a password* y **guárdala** en tu gestor de contraseñas. No la vamos a necesitar a diario, pero no se puede recuperar.
   - **Region**: **Central EU (Frankfurt)**. Tiene que ser de la UE por el RGPD.
   - **Plan**: Free. Para pruebas sobra. Ojo: si no se usa en una semana, se pausa; se reactiva con un botón.
3. Espera un par de minutos a que termine de crearse.

## 2. Instalar la base de datos (un solo pegado)

1. En GitHub, abre el archivo [`supabase/instalar.sql`](../supabase/instalar.sql) de la rama `saas/fases-0-1-2`, pulsa **Raw** y copia todo (Ctrl+A, Ctrl+C).
2. En Supabase, menú de la izquierda: **SQL Editor** › **New query**. Pega y pulsa **Run**.
3. Abajo debe salir **Success**. Si sale un error rojo, cópiamelo tal cual.

## 3. (Recomendado) Cargar datos de ejemplo

Así mañana tendrás leads, clientes y bodas inventadas para probar el panel.

1. Haz lo mismo con [`supabase/datos-de-ejemplo.sql`](../supabase/datos-de-ejemplo.sql): **New query**, pegar, **Run**.

Para borrarlos más adelante, pega esto en el SQL Editor y pulsa **Run**:

```sql
delete from payments where order_id::text like 'e0000000%';
delete from orders where id::text like 'e0000000%';
delete from weddings where id::text like 'b0000000%';
delete from leads where id::text like 'a0000000%';
delete from clients where id::text like 'c0000000%';
```

## 4. Crear tu usuario del panel

1. Menú **Authentication** › **Users** › **Add user** › **Create new user**.
2. Pon tu email y una contraseña larga (mínimo 10 caracteres). Marca **Auto Confirm User**. Pulsa **Create user**.
3. Vuelve al **SQL Editor**, pega esto **cambiando el email por el tuyo**, y pulsa **Run**:

```sql
select app.make_owner('tu-email@ejemplo.com', 'Luis');
```

Eso te hace dueño del panel. Sin este paso, el panel te dirá que tu usuario no tiene acceso.

## 5. Cerrar el registro público

Solo deben entrar tú (y, más adelante, las parejas que invites).

1. **Authentication** › **Sign In / Providers** (o **Providers** › **Email**, según la versión).
2. Desactiva **Allow new users to sign up** y guarda.

## 6. Copiar las tres claves

Están en **Project Settings** (la rueda dentada, abajo a la izquierda). Si no las ves, el botón **Connect** de arriba también las enseña.

| Lo que copias | Dónde está | Cómo se llamará en Vercel |
| --- | --- | --- |
| Project URL (`https://xxxx.supabase.co`) | **Data API** o **API** | `SUPABASE_URL` |
| Publishable key (`sb_publishable_…`) | **API Keys** | `SUPABASE_ANON_KEY` |
| Secret key (`sb_secret_…`) | **API Keys** (pulsa el ojo o *Reveal*) | `SUPABASE_SERVICE_ROLE_KEY` |

Si en vez de esas ves claves que empiezan por `eyJ…` llamadas **anon** y **service_role**, también valen (son las antiguas). Supabase dejará de usarlas a finales de 2026, así que mejor las nuevas.

> La **secret key** da acceso a todo. No la pegues en ningún chat, email ni documento: solo en Vercel.

## 7. Ponerlas en Vercel

1. Entra en [vercel.com](https://vercel.com) › tu proyecto de la web › **Settings** › **Environment Variables**.
2. Añade las tres variables de la tabla. En **Environments** marca **solo Preview** (son las de pruebas; las de producción serán otras).
3. A `SUPABASE_SERVICE_ROLE_KEY` márcale además **Sensitive**.
4. Ve a **Deployments**, busca el último de la rama `saas/fases-0-1-2`, pulsa los tres puntos › **Redeploy**. Las variables nuevas solo se aplican al volver a desplegar.

## 8. Probarlo

En el despliegue de vista previa que acabas de rehacer (el botón **Visit**):

- `…/panel/` → entra con tu email y contraseña. Deberías ver el inicio con los datos de ejemplo.
- `…/studio/` → prueba una web con tus datos inventados. El lead aparece en el panel al momento.
- `…/b/lucia-y-martin` → una boda de ejemplo publicada. Confirma asistencia y mira cómo aparece en el panel (Bodas › Lucía y Martín › Confirmación de asistencia).
- En el panel: **Bodas** › **Nueva boda** → crea una, sube una foto, pulsa **Publicar** y ábrela.

Si algo no va, mándame una captura y el texto del error.

---

## Más adelante: producción

No hace falta mañana. Cuando lo hagamos:

1. Otro proyecto de Supabase, `weddingwebs`, en **plan Pro** (los proyectos gratis se pausan y no tienen copias de seguridad diarias). Mismos pasos 2, 4, 5 y 6 (sin datos de ejemplo).
2. En Vercel, las mismas tres variables pero marcando **solo Production**.
3. Opcionales para producción: `NOTIFY_EMAIL` (tu email, para los avisos de leads), `RESEND_API_KEY` y `EMAIL_FROM` (para enviar emails desde tu dominio), `LEADS_SHEET_ENDPOINT` (para seguir copiando los leads en tu hoja durante un tiempo) y `SITE_URL` (tu dominio).
4. En Supabase › **Authentication** › **URL Configuration**: **Site URL** = tu dominio, y en **Redirect URLs** añade `https://tudominio/panel/`. Sirve para el email de "He olvidado la contraseña".
5. Repasa los costes en [COSTES.md](COSTES.md): para uso comercial, Vercel exige el plan Pro.

## Si necesitas a alguien más en el panel

1. Panel › **Ajustes** › **Equipo**: añade su email y su rol. *Editor* no ve ajustes ni facturas; *Administrador* sí.
2. Supabase › **Authentication** › **Users** › **Add user** con ese mismo email. Se enlazan solos.
