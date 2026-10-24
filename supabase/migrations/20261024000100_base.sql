-- WeddingWebs · 1/9 · Cimientos: esquema interno, utilidades, equipo y ajustes.
--
-- Convenciones de todas las tablas:
--   id uuid, created_at y updated_at (con disparador), importes en céntimos (integer),
--   fechas con zona horaria. La zona del negocio es Europe/Madrid.
-- El esquema "app" guarda funciones internas: no se publica en la API REST.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists app;
grant usage on schema app to anon, authenticated, service_role;

-- updated_at automático
create or replace function app.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Texto sin tildes, en minúsculas y con espacios simples (para buscar y comparar nombres).
create or replace function app.normalize(p text) returns text
language sql immutable as $$
  select btrim(regexp_replace(
    translate(lower(coalesce(p, '')),
      'áàäâãåéèëêíìïîóòöôõúùüûñçœæ',
      'aaaaaaeeeeiiiiooooouuuuncoa'),
    '\s+', ' ', 'g'))
$$;

-- Convierte un texto en un trozo de URL: "Lucía y Martín" -> "lucia-y-martin".
create or replace function app.slugify(p text) returns text
language sql immutable as $$
  select btrim(regexp_replace(app.normalize(p), '[^a-z0-9]+', '-', 'g'), '-')
$$;

-- Token aleatorio apto para URL (192 bits).
create or replace function app.random_token() returns text
language sql volatile as $$
  select translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_')
$$;

-- ── Equipo ─────────────────────────────────────────────────────

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  email text not null check (email ~ '^\S+@\S+\.\S+$'),
  name text not null default '',
  role text not null default 'editor' check (role in ('owner', 'admin', 'editor')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index staff_email_key on public.staff (lower(email));
create trigger staff_updated_at before update on public.staff
  for each row execute function app.set_updated_at();
comment on table public.staff is 'Usuarios internos (Luis y futuros ayudantes). owner y admin lo ven todo; editor no toca ajustes, equipo ni facturas.';

-- Rol del usuario conectado, si es del equipo y está activo. SECURITY DEFINER para que las
-- políticas de RLS puedan consultarlo sin pasar por la RLS de staff (evita recursión).
create or replace function app.staff_role() returns text
language sql stable security definer set search_path = '' as $$
  select s.role from public.staff s where s.user_id = auth.uid() and s.active
$$;

create or replace function app.staff_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select s.id from public.staff s where s.user_id = auth.uid() and s.active
$$;

create or replace function app.is_staff() returns boolean
language sql stable as $$ select app.staff_role() is not null $$;

create or replace function app.is_admin() returns boolean
language sql stable as $$ select coalesce(app.staff_role() in ('owner', 'admin'), false) $$;

-- Llamadas hechas desde nuestras funciones de servidor (clave secreta de Supabase).
-- Ojo: dentro de una función SECURITY DEFINER current_user es el dueño de la función; por eso se
-- mira el rol de la sesión (SET ROLE, que es lo que hace PostgREST) y el rol del JWT.
create or replace function app.is_service() returns boolean
language sql stable as $$
  select current_setting('role', true) = 'service_role'
      or coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role'
$$;

grant execute on all functions in schema app to anon, authenticated, service_role;

-- Primer paso tras crear el proyecto: hacer dueño a Luis (se ejecuta en el editor SQL de Supabase).
--   select app.make_owner('tu-email@ejemplo.com', 'Luis');
create or replace function app.make_owner(p_email text, p_name text default '') returns public.staff
language plpgsql security definer set search_path = '' as $$
declare
  r public.staff;
begin
  insert into public.staff (email, name, role, user_id)
  values (lower(btrim(p_email)), coalesce(p_name, ''), 'owner',
          (select u.id from auth.users u where lower(u.email) = lower(btrim(p_email)) limit 1))
  on conflict (lower(email)) do update
    set role = 'owner', active = true,
        name = coalesce(nullif(excluded.name, ''), public.staff.name),
        user_id = coalesce(excluded.user_id, public.staff.user_id)
  returning * into r;
  return r;
end $$;
revoke execute on function app.make_owner(text, text) from public, anon, authenticated;

-- ── Ajustes ────────────────────────────────────────────────────

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z_]+$'),
  value jsonb not null default '{}'::jsonb,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.staff(id) on delete set null
);
create trigger settings_updated_at before update on public.settings
  for each row execute function app.set_updated_at();

insert into public.settings (key, value, description) values
  ('vendedor', jsonb_build_object(
      'nombre', '', 'nif', '', 'direccion', '', 'codigo_postal', '', 'ciudad', '', 'provincia', '',
      'pais', 'ES', 'email', '', 'tipo', null, 'regimen_iva', null),
   'Datos fiscales de WeddingWebs para la página legal y las facturas. Si faltan, la facturación real queda bloqueada. tipo: autonomo | sociedad.'),
  ('plazos', jsonb_build_object(
      'entrega_dias', 3, 'web_meses_tras_boda', 12, 'invitados_meses_tras_boda', 6,
      'leads_perdidos_anonimizar_meses', 24),
   'Plazos del negocio: entrega, retirada de la web y borrado de datos de invitados.'),
  ('sitio', jsonb_build_object('url', null, 'bodas_en', 'ruta'),
   'Dirección pública de la web (para enlaces y tarjetas de WhatsApp) y si las bodas van en ruta (/b/slug) o en subdominio.')
on conflict (key) do nothing;

create or replace function app.setting(p_key text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select s.value from public.settings s where s.key = p_key
$$;
grant execute on function app.setting(text) to anon, authenticated, service_role;

-- Contadores por año (números de pedido P-2026-0001). Las facturas tienen su propia serie.
create table public.counters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  year integer not null,
  value integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, year)
);
create trigger counters_updated_at before update on public.counters
  for each row execute function app.set_updated_at();

create or replace function app.next_counter(p_name text, p_year integer) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v integer;
begin
  insert into public.counters (name, year, value) values (p_name, p_year, 1)
  on conflict (name, year) do update set value = public.counters.value + 1
  returning value into v;
  return v;
end $$;
