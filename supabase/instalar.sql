-- WeddingWebs: instalación completa de la base de datos en un proyecto de Supabase NUEVO.
-- Generado por scripts/unir-migraciones.mjs a partir de supabase/migrations: no lo edites a mano.
-- Cómo usarlo: Supabase > SQL Editor > New query > pega todo este archivo > Run. Ver docs/SUPABASE.md.

-- ════════════════ 20261024000100_base.sql ════════════════

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

-- ════════════════ 20261024000200_crm.sql ════════════════

-- WeddingWebs · 2/9 · Captación y CRM: clientes, leads, atribución de publicidad y consentimientos.

-- La pareja como cliente (datos de facturación). Un lead ganado se convierte en cliente.
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(btrim(display_name)) > 0),
  email text,
  phone text,
  billing_name text,
  tax_id text,
  billing_address text,
  postal_code text,
  city text,
  province text,
  country text not null default 'ES' check (country ~ '^[A-Z]{2}$'),
  language text not null default 'es' check (language in ('es', 'en', 'ca')),
  notes text,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_email_idx on public.clients (lower(email));
create index clients_tax_id_idx on public.clients (upper(tax_id));
create trigger clients_updated_at before update on public.clients
  for each row execute function app.set_updated_at();

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  names text not null default '',
  partner_a text,
  partner_b text,
  email text,
  phone text,
  wedding_date date,
  wedding_time time,
  venue text,
  city text,
  style text,
  tier text,
  sections jsonb,
  trial_config jsonb,
  message text,
  source text not null default 'manual' check (source in (
    'prueba', 'reserva', 'importado', 'manual', 'whatsapp', 'email', 'telefono',
    'bodas_net', 'instagram', 'recomendacion', 'otro')),
  status text not null default 'nuevo' check (status in (
    'nuevo', 'contactado', 'propuesta', 'esperando_pago', 'ganado', 'perdido')),
  status_changed_at timestamptz not null default now(),
  lost_reason text,
  owner_id uuid references public.staff(id) on delete set null,
  next_action text,
  next_action_at timestamptz,
  last_contacted_at timestamptz,
  trials integer not null default 0,
  reserved_at timestamptz,
  client_id uuid references public.clients(id) on delete set null,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_contact check (email is not null or phone is not null or anonymized_at is not null),
  constraint leads_lost_reason check (status <> 'perdido' or lost_reason is not null)
);
create index leads_status_idx on public.leads (status, created_at desc);
create index leads_email_idx on public.leads (lower(email));
create index leads_next_action_idx on public.leads (next_action_at) where status not in ('ganado', 'perdido');
create trigger leads_updated_at before update on public.leads
  for each row execute function app.set_updated_at();

comment on column public.leads.status is 'nuevo → contactado → propuesta → esperando_pago → ganado | perdido';
comment on column public.leads.trial_config is 'Config de la vista previa que probó la pareja en el escaparate (sin fotos).';

-- Cambios de estado: fecha del cambio y "último contacto".
create or replace function app.leads_status_dates() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.status_changed_at := now();
    if old.status = 'nuevo' and new.status <> 'perdido' then
      new.last_contacted_at := coalesce(new.last_contacted_at, now());
    end if;
    if new.status <> 'perdido' then new.lost_reason := null; end if;
  end if;
  new.email := nullif(lower(btrim(new.email)), '');
  new.phone := nullif(btrim(new.phone), '');
  if coalesce(btrim(new.names), '') = '' then
    new.names := concat_ws(' y ', nullif(btrim(new.partner_a), ''), nullif(btrim(new.partner_b), ''));
  end if;
  return new;
end $$;
create trigger leads_status_dates before insert or update on public.leads
  for each row execute function app.leads_status_dates();

-- Atribución de publicidad: primer y último toque antes de dejar los datos.
create table public.lead_attribution (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  touch text not null check (touch in ('primero', 'ultimo')),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  gclid text,
  fbclid text,
  landing_page text,
  referrer text,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, touch)
);
create index lead_attribution_campaign_idx on public.lead_attribution (utm_source, utm_campaign);
create trigger lead_attribution_updated_at before update on public.lead_attribution
  for each row execute function app.set_updated_at();

-- Consentimientos: texto exacto aceptado, fecha e IP. Solo se añaden filas (es una prueba).
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  email text,
  purpose text not null check (purpose in (
    'contacto_comercial', 'cookies_publicidad', 'cookies_analitica', 'tratamiento_invitados')),
  granted boolean not null default true,
  text text not null,
  source text,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index consents_lead_idx on public.consents (lead_id);
create index consents_email_idx on public.consents (lower(email));

-- ════════════════ 20261024000300_bodas.sql ════════════════

-- WeddingWebs · 3/9 · Productos, bodas, pedidos, pagos, actividad y tareas.

-- ── Productos (planes y extras). Los precios viven aquí, no en el código. ──

create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9-]+$'),
  name text not null,
  description text,
  kind text not null default 'plan' check (kind in ('plan', 'extra')),
  price_cents integer not null check (price_cents >= 0),
  price_is_from boolean not null default false,
  vat_rate_bp integer not null default 2100 check (vat_rate_bp between 0 and 10000),
  features jsonb not null default '{}'::jsonb,
  includes jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger products_updated_at before update on public.products
  for each row execute function app.set_updated_at();
comment on column public.products.price_cents is 'Precio final con IVA incluido, en céntimos.';
comment on column public.products.vat_rate_bp is 'Tipo de IVA en puntos básicos: 2100 = 21 %.';
comment on column public.products.features is 'Lo que activa el plan, p. ej. {"rsvp_ampliado": true, "dominio_propio": true}.';

insert into public.products (code, name, description, kind, price_cents, price_is_from, features, includes, sort) values
  ('tal-cual', 'Tal cual', 'Os quedáis con el estilo que habéis probado, con vuestros datos y fotos.', 'plan', 7900, false,
   '{"rsvp_ampliado": false, "dominio_propio": false}',
   '["Vuestros datos, fotos y programa del día", "Confirmaciones de asistencia", "Publicada y lista para compartir"]', 1),
  ('con-cambios', 'Con cambios', 'Partimos de una plantilla y la ajustamos a vuestro gusto.', 'plan', 13900, false,
   '{"rsvp_ampliado": false, "dominio_propio": false}',
   '["Todo lo de Tal cual", "Colores, tipografías y textos a medida", "Secciones extra: galería, regalos, alojamiento"]', 2),
  ('a-medida', 'A medida', 'Un diseño propio, hecho desde cero para vuestra boda.', 'plan', 24900, true,
   '{"rsvp_ampliado": false, "dominio_propio": true}',
   '["Todo lo de Con cambios", "Diseño único, sin plantilla de partida", "Hasta 3 rondas de revisiones"]', 3)
on conflict (code) do nothing;

-- ── Bodas: cada boda es una fila ──────────────────────────────

create table public.weddings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$'),
  template text not null check (template ~ '^[a-z0-9-]+$'),
  config jsonb not null,
  status text not null default 'borrador' check (status in (
    'borrador', 'vista_previa', 'publicada', 'archivada', 'retirada')),
  client_id uuid references public.clients(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  custom_domain text unique check (custom_domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  wedding_date date,
  retire_at date,
  guest_data_delete_at date,
  published_version_id uuid,
  published_at timestamptz,
  rsvp_sheet_endpoint text check (rsvp_sheet_endpoint ~ '^https://script\.google\.com/'),
  preview_token text not null default app.random_token(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weddings_config_object check (jsonb_typeof(config) = 'object')
);
create index weddings_date_idx on public.weddings (wedding_date);
create index weddings_status_idx on public.weddings (status);
create trigger weddings_updated_at before update on public.weddings
  for each row execute function app.set_updated_at();

comment on column public.weddings.config is 'El mismo config.json de las plantillas (schema/wedding-config.schema.json). Es el borrador: lo público sale de la versión publicada.';
comment on column public.weddings.preview_token is 'Clave del enlace de vista previa del borrador (/b/<slug>?vista=<clave>). Se puede regenerar para invalidar enlaces antiguos.';
comment on column public.weddings.status is 'borrador y vista_previa: no son públicas (solo con enlace de vista previa). publicada y archivada: online. retirada: fuera de línea.';

-- Fecha de la boda y plazos de retirada calculados desde config.event.date.
create or replace function app.weddings_dates() returns trigger
language plpgsql as $$
declare
  p jsonb := coalesce(app.setting('plazos'), '{}'::jsonb);
  d date;
begin
  begin
    d := ((new.config #>> '{event,date}')::timestamptz at time zone 'Europe/Madrid')::date;
  exception when others then
    d := null;
  end;
  if tg_op = 'INSERT' or d is distinct from old.wedding_date then
    new.wedding_date := d;
    new.retire_at := d + make_interval(months => coalesce((p ->> 'web_meses_tras_boda')::int, 12));
    new.guest_data_delete_at := d + make_interval(months => coalesce((p ->> 'invitados_meses_tras_boda')::int, 6));
  end if;
  return new;
end $$;
create trigger weddings_dates before insert or update of config on public.weddings
  for each row execute function app.weddings_dates();

create table public.wedding_versions (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  version integer not null check (version > 0),
  template text not null,
  config jsonb not null,
  note text,
  published_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (wedding_id, version)
);
create trigger wedding_versions_updated_at before update on public.wedding_versions
  for each row execute function app.set_updated_at();

alter table public.weddings
  add constraint weddings_published_version_fk foreign key (published_version_id)
  references public.wedding_versions(id) on delete set null;

-- Fotos de la pareja (Supabase Storage). Nunca fotos de invitados.
create table public.wedding_assets (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  bucket text not null default 'wedding-assets',
  path text not null,
  url text not null,
  kind text not null default 'foto' check (kind in ('foto', 'compartir', 'icono', 'otro')),
  width integer,
  height integer,
  bytes integer,
  mime text,
  focus_x numeric(5, 2) check (focus_x between 0 and 100),
  focus_y numeric(5, 2) check (focus_y between 0 and 100),
  sort integer not null default 0,
  original_name text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket, path)
);
create index wedding_assets_wedding_idx on public.wedding_assets (wedding_id, sort);
create trigger wedding_assets_updated_at before update on public.wedding_assets
  for each row execute function app.set_updated_at();

-- Usuarios de la pareja (los dos pueden tener acceso a su panel).
create table public.couple_users (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null check (email ~ '^\S+@\S+\.\S+$'),
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index couple_users_wedding_email_key on public.couple_users (wedding_id, lower(email));
create index couple_users_user_idx on public.couple_users (user_id);
create trigger couple_users_updated_at before update on public.couple_users
  for each row execute function app.set_updated_at();

create or replace function app.couple_wedding_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select c.wedding_id from public.couple_users c where c.user_id = auth.uid()
$$;

-- Al crear un usuario de acceso, se enlaza con su ficha de equipo o de pareja por email.
create or replace function app.link_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.staff set user_id = new.id where lower(email) = lower(new.email) and user_id is null;
  update public.couple_users set user_id = new.id where lower(email) = lower(new.email) and user_id is null;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.link_new_user();

-- Y al revés: si el usuario de acceso ya existía cuando se le da de alta en el equipo o en una boda.
create or replace function app.link_existing_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id is null then
    select u.id into new.user_id from auth.users u where lower(u.email) = lower(new.email) limit 1;
  end if;
  return new;
end $$;
create trigger staff_link_user before insert or update of email on public.staff
  for each row execute function app.link_existing_user();
create trigger couple_users_link_user before insert or update of email on public.couple_users
  for each row execute function app.link_existing_user();

-- ── Pedidos y pagos ───────────────────────────────────────────

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number text unique,
  client_id uuid references public.clients(id) on delete restrict,
  wedding_id uuid references public.weddings(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  status text not null default 'borrador' check (status in (
    'borrador', 'pendiente_pago', 'pagado', 'en_produccion', 'entregado', 'cancelado', 'reembolsado')),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  total_cents integer not null default 0,
  paid_cents integer not null default 0,
  promised_delivery_at date,
  paid_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  payment_link_url text,
  payment_provider_ref text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_status_idx on public.orders (status);
create trigger orders_updated_at before update on public.orders
  for each row execute function app.set_updated_at();

create or replace function app.orders_number() returns trigger
language plpgsql as $$
declare
  y integer := extract(year from now() at time zone 'Europe/Madrid')::int;
begin
  if new.number is null then
    new.number := 'P-' || y || '-' || lpad(app.next_counter('pedido', y)::text, 4, '0');
  end if;
  return new;
end $$;
create trigger orders_number before insert on public.orders
  for each row execute function app.orders_number();

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  position integer not null default 0,
  description text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_cents integer not null,
  vat_rate_bp integer not null default 2100,
  total_cents integer generated always as (quantity * unit_price_cents) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index order_lines_order_idx on public.order_lines (order_id, position);
create trigger order_lines_updated_at before update on public.order_lines
  for each row execute function app.set_updated_at();

create or replace function app.order_total() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  oid uuid := coalesce(new.order_id, old.order_id);
begin
  update public.orders o
     set total_cents = coalesce((select sum(l.total_cents) from public.order_lines l where l.order_id = oid), 0)
   where o.id = oid;
  return null;
end $$;
create trigger order_lines_total after insert or update or delete on public.order_lines
  for each row execute function app.order_total();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null check (provider in ('stripe', 'transferencia', 'bizum', 'efectivo', 'otro')),
  external_id text,
  amount_cents integer not null,
  refunded_cents integer not null default 0 check (refunded_cents >= 0),
  status text not null default 'pendiente' check (status in (
    'pendiente', 'pagado', 'fallido', 'reembolsado', 'reembolso_parcial')),
  paid_at timestamptz,
  raw jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id)
);
create index payments_order_idx on public.payments (order_id);
create trigger payments_updated_at before update on public.payments
  for each row execute function app.set_updated_at();

-- ── Actividad (línea de tiempo) y tareas ──────────────────────

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  wedding_id uuid references public.weddings(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  kind text not null check (kind in (
    'nota', 'email', 'llamada', 'whatsapp', 'estado', 'prueba', 'reserva', 'pago', 'boda', 'tarea', 'sistema')),
  title text not null,
  body text,
  meta jsonb not null default '{}'::jsonb,
  actor_id uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activities_subject check (num_nonnulls(lead_id, client_id, wedding_id, order_id) > 0)
);
create index activities_lead_idx on public.activities (lead_id, created_at desc);
create index activities_client_idx on public.activities (client_id, created_at desc);
create index activities_wedding_idx on public.activities (wedding_id, created_at desc);
create trigger activities_updated_at before update on public.activities
  for each row execute function app.set_updated_at();

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) > 0),
  notes text,
  due_at timestamptz,
  status text not null default 'pendiente' check (status in ('pendiente', 'hecha', 'cancelada')),
  done_at timestamptz,
  lead_id uuid references public.leads(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  wedding_id uuid references public.weddings(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  assignee_id uuid references public.staff(id) on delete set null,
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_open_idx on public.tasks (due_at) where status = 'pendiente';
create trigger tasks_updated_at before update on public.tasks
  for each row execute function app.set_updated_at();

create or replace function app.tasks_done() returns trigger
language plpgsql as $$
begin
  if new.status = 'hecha' and (tg_op = 'INSERT' or old.status <> 'hecha') then new.done_at := now(); end if;
  if new.status <> 'hecha' then new.done_at := null; end if;
  if tg_op = 'INSERT' and new.created_by is null then new.created_by := app.staff_id(); end if;
  return new;
end $$;
create trigger tasks_done before insert or update on public.tasks
  for each row execute function app.tasks_done();

-- La línea de tiempo se escribe sola.
create or replace function app.log_activity(
  p_kind text, p_title text, p_body text default null, p_meta jsonb default '{}'::jsonb,
  p_lead uuid default null, p_client uuid default null, p_wedding uuid default null, p_order uuid default null
) returns void
language sql security definer set search_path = '' as $$
  insert into public.activities (kind, title, body, meta, lead_id, client_id, wedding_id, order_id, actor_id)
  values (p_kind, p_title, p_body, coalesce(p_meta, '{}'::jsonb), p_lead, p_client, p_wedding, p_order, app.staff_id())
$$;

create or replace function app.status_label(p text) returns text
language sql immutable as $$
  select case p
    when 'nuevo' then 'Nuevo' when 'contactado' then 'Contactado' when 'propuesta' then 'Propuesta'
    when 'esperando_pago' then 'Esperando pago' when 'ganado' then 'Ganado' when 'perdido' then 'Perdido'
    when 'borrador' then 'Borrador' when 'vista_previa' then 'Vista previa' when 'publicada' then 'Publicada'
    when 'archivada' then 'Archivada' when 'retirada' then 'Retirada'
    else p end
$$;

create or replace function app.leads_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform app.log_activity(
      case new.source when 'prueba' then 'prueba' when 'reserva' then 'reserva' else 'sistema' end,
      case new.source
        when 'prueba' then 'Ha probado su web en el escaparate'
        when 'reserva' then 'Ha enviado una reserva'
        when 'importado' then 'Importado de la hoja de Google'
        else 'Lead creado' end,
      null,
      jsonb_strip_nulls(jsonb_build_object('estilo', new.style, 'tarifa', new.tier)),
      new.id);
  elsif new.status is distinct from old.status then
    perform app.log_activity('estado',
      'Estado: ' || app.status_label(old.status) || ' → ' || app.status_label(new.status),
      case when new.status = 'perdido' then new.lost_reason end,
      jsonb_build_object('de', old.status, 'a', new.status), new.id, new.client_id);
  end if;
  return null;
end $$;
create trigger leads_activity after insert or update of status on public.leads
  for each row execute function app.leads_activity();

create or replace function app.weddings_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform app.log_activity('boda', 'Web creada: /b/' || new.slug, null,
      jsonb_build_object('plantilla', new.template), new.lead_id, new.client_id, new.id);
  elsif new.status is distinct from old.status then
    perform app.log_activity('boda', 'Web ' || lower(app.status_label(new.status)) || ': /b/' || new.slug, null,
      jsonb_build_object('de', old.status, 'a', new.status), new.lead_id, new.client_id, new.id);
  end if;
  return null;
end $$;
create trigger weddings_activity after insert or update of status on public.weddings
  for each row execute function app.weddings_activity();

create or replace function app.tasks_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'hecha' and old.status <> 'hecha'
     and num_nonnulls(new.lead_id, new.client_id, new.wedding_id, new.order_id) > 0 then
    perform app.log_activity('tarea', 'Tarea hecha: ' || new.title, null, '{}'::jsonb,
      new.lead_id, new.client_id, new.wedding_id, new.order_id);
  end if;
  return null;
end $$;
create trigger tasks_activity after update of status on public.tasks
  for each row execute function app.tasks_activity();

-- ════════════════ 20261024000400_invitados.sql ════════════════

-- WeddingWebs · 4/9 · Invitados y confirmaciones (RSVP).
-- El RSVP sencillo de las plantillas (nombre, asistencia, canción) se guarda en rsvp_responses.
-- Grupos con enlace personal, acompañantes, alergias y autobús son el módulo opcional
-- "RSVP ampliado" (products.features.rsvp_ampliado), que se usa en la fase 3.

create table public.guest_groups (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  token text not null unique default app.random_token(),
  token_revoked_at timestamptz,
  seats integer not null default 1 check (seats between 1 and 50),
  children_seats integer not null default 0 check (children_seats between 0 and 50),
  notes text,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guest_groups_wedding_idx on public.guest_groups (wedding_id, sort);
create trigger guest_groups_updated_at before update on public.guest_groups
  for each row execute function app.set_updated_at();

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  group_id uuid references public.guest_groups(id) on delete cascade,
  first_name text not null check (length(btrim(first_name)) > 0),
  last_name text,
  is_child boolean not null default false,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guests_wedding_idx on public.guests (wedding_id);
create index guests_group_idx on public.guests (group_id);
create trigger guests_updated_at before update on public.guests
  for each row execute function app.set_updated_at();

-- Cada envío es una fila nueva (queda la fecha de cada cambio). Vale la última de cada persona
-- o grupo: ver la vista rsvp_latest.
create table public.rsvp_responses (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  group_id uuid references public.guest_groups(id) on delete set null,
  name text not null check (length(btrim(name)) between 2 and 120),
  name_key text not null default '',
  attending boolean not null,
  adults integer check (adults between 0 and 50),
  children integer check (children between 0 and 50),
  companions jsonb not null default '[]'::jsonb,
  dietary text,
  bus boolean,
  song text,
  message text,
  payload jsonb not null default '{}'::jsonb,
  source text not null default 'web' check (source in ('web', 'panel', 'importado')),
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rsvp_responses_wedding_idx on public.rsvp_responses (wedding_id, name_key, created_at desc);
create trigger rsvp_responses_updated_at before update on public.rsvp_responses
  for each row execute function app.set_updated_at();

create or replace function app.rsvp_name_key() returns trigger
language plpgsql as $$
begin
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  new.name_key := app.normalize(new.name);
  return new;
end $$;
create trigger rsvp_responses_name_key before insert or update of name on public.rsvp_responses
  for each row execute function app.rsvp_name_key();

-- La respuesta vigente de cada persona (o grupo) y cuántas veces ha contestado.
create view public.rsvp_current with (security_invoker = true) as
select x.*
from (
  select r.*,
         count(*) over (partition by r.wedding_id, coalesce(r.group_id::text, r.name_key)) as times_answered,
         row_number() over (partition by r.wedding_id, coalesce(r.group_id::text, r.name_key)
                            order by r.created_at desc, r.id desc) as rn
  from public.rsvp_responses r
) x
where x.rn = 1;

comment on view public.rsvp_current is 'Una fila por invitado (o grupo): su última respuesta, con times_answered.';

-- ════════════════ 20261024000500_facturacion.sql ════════════════

-- WeddingWebs · 5/9 · Facturación preparada para Verifactu.
--
-- Reglas que se cumplen aquí, en la base de datos, y no solo en la pantalla:
--   · Numeración correlativa sin huecos por serie y año (WW-2026-0001), asignada al emitir,
--     dentro de una transacción y con la fila de la serie bloqueada.
--   · Una factura emitida no se puede cambiar ni borrar. Para corregirla: factura rectificativa
--     (serie R) que apunta a la original, o un registro de anulación.
--   · Cada emisión y cada anulación deja un registro de facturación encadenado con una huella
--     SHA-256 (formato de la AEAT). Aunque luego lo calcule el proveedor, aquí queda guardado.
-- El envío a la AEAT lo hará un proveedor certificado (capa InvoicingProvider, fase 4).
-- Mientras tanto, las facturas quedan "pendientes de registrar" (proveedor 'manual').

create table public.invoice_series (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[A-Z]{1,5}$'),
  year integer not null check (year between 2024 and 2100),
  kind text not null check (kind in ('ordinaria', 'rectificativa', 'simplificada')),
  next_number integer not null default 1 check (next_number > 0),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code, year)
);
create trigger invoice_series_updated_at before update on public.invoice_series
  for each row execute function app.set_updated_at();

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  series_id uuid references public.invoice_series(id) on delete restrict,
  series_code text not null default 'WW' check (series_code ~ '^[A-Z]{1,5}$'),
  number integer,
  full_number text unique,
  kind text not null default 'ordinaria' check (kind in ('ordinaria', 'rectificativa', 'simplificada')),
  status text not null default 'borrador' check (status in ('borrador', 'emitida', 'anulada')),
  issued_at timestamptz,
  operation_date date,
  client_id uuid references public.clients(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  corrects_invoice_id uuid references public.invoices(id) on delete restrict,
  correction_reason text,
  issuer jsonb,
  recipient jsonb not null default '{}'::jsonb,
  language text not null default 'es' check (language in ('es', 'en')),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  base_cents integer not null default 0,
  vat_cents integer not null default 0,
  total_cents integer not null default 0,
  provider text not null default 'manual',
  provider_ref text,
  provider_status text,
  qr_payload text,
  legend text,
  pdf_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_corrective check (kind <> 'rectificativa' or (corrects_invoice_id is not null and correction_reason is not null)),
  constraint invoices_issued check (status = 'borrador' or (number is not null and full_number is not null and issued_at is not null and issuer is not null))
);
create index invoices_issued_idx on public.invoices (issued_at);
create index invoices_client_idx on public.invoices (client_id);
create trigger invoices_updated_at before update on public.invoices
  for each row execute function app.set_updated_at();

comment on column public.invoices.recipient is 'Copia de los datos del cliente al emitir: {nombre, nif, direccion, codigo_postal, ciudad, provincia, pais}.';
comment on column public.invoices.provider is 'manual = pendiente de registrar; o el proveedor certificado que la registró (fase 4).';

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  position integer not null default 0,
  description text not null check (length(btrim(description)) > 0),
  quantity integer not null default 1 check (quantity <> 0),
  unit_total_cents integer not null,
  vat_rate_bp integer not null default 2100 check (vat_rate_bp between 0 and 10000),
  line_total_cents integer not null default 0,
  base_cents integer not null default 0,
  vat_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invoice_lines_invoice_idx on public.invoice_lines (invoice_id, position);
create trigger invoice_lines_updated_at before update on public.invoice_lines
  for each row execute function app.set_updated_at();
comment on column public.invoice_lines.unit_total_cents is 'Precio unitario con IVA incluido. La base y la cuota se calculan desde aquí, para que el total sea exactamente el precio anunciado.';

create table public.invoicing_records (
  id uuid primary key default gen_random_uuid(),
  chain_seq bigint generated always as identity unique,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  record_type text not null check (record_type in ('alta', 'anulacion')),
  hash text not null,
  previous_hash text,
  hash_input text not null,
  generated_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  response jsonb,
  status text not null default 'pendiente' check (status in ('pendiente', 'aceptado', 'aceptado_con_errores', 'rechazado')),
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invoicing_records_pending_idx on public.invoicing_records (next_attempt_at) where status = 'pendiente';
create trigger invoicing_records_updated_at before update on public.invoicing_records
  for each row execute function app.set_updated_at();

-- ── Inmutabilidad ─────────────────────────────────────────────

create or replace function app.invoices_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'borrador' then
      raise exception 'Una factura emitida no se puede borrar. Para corregirla, haz una factura rectificativa.'
        using errcode = 'P0001', hint = 'factura_inmutable';
    end if;
    return old;
  end if;
  if old.status = 'borrador' then return new; end if;
  if (new.series_id, new.series_code, new.number, new.full_number, new.kind, new.issued_at, new.operation_date,
      new.client_id, new.order_id, new.corrects_invoice_id, new.correction_reason, new.issuer, new.recipient,
      new.language, new.currency, new.base_cents, new.vat_cents, new.total_cents, new.notes)
     is distinct from
     (old.series_id, old.series_code, old.number, old.full_number, old.kind, old.issued_at, old.operation_date,
      old.client_id, old.order_id, old.corrects_invoice_id, old.correction_reason, old.issuer, old.recipient,
      old.language, old.currency, old.base_cents, old.vat_cents, old.total_cents, old.notes) then
    raise exception 'Una factura emitida no se puede modificar. Para corregirla, haz una factura rectificativa.'
      using errcode = 'P0001', hint = 'factura_inmutable';
  end if;
  if new.status is distinct from old.status and not (old.status = 'emitida' and new.status = 'anulada') then
    raise exception 'Cambio de estado no permitido en una factura emitida (% → %).', old.status, new.status
      using errcode = 'P0001', hint = 'factura_inmutable';
  end if;
  return new;
end $$;
create trigger invoices_guard before update or delete on public.invoices
  for each row execute function app.invoices_guard();

create or replace function app.invoice_lines_guard() returns trigger
language plpgsql as $$
declare
  st text;
  iid uuid := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
begin
  select status into st from public.invoices where id = iid;
  if st is not null and st <> 'borrador' then
    raise exception 'Las líneas de una factura emitida no se pueden cambiar.'
      using errcode = 'P0001', hint = 'factura_inmutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.line_total_cents := new.quantity * new.unit_total_cents;
  new.base_cents := round(new.line_total_cents * 10000.0 / (10000 + new.vat_rate_bp))::int;
  new.vat_cents := new.line_total_cents - new.base_cents;
  return new;
end $$;
create trigger invoice_lines_guard before insert or update or delete on public.invoice_lines
  for each row execute function app.invoice_lines_guard();

create or replace function app.invoice_totals() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  iid uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  update public.invoices i set
    base_cents = coalesce((select sum(l.base_cents) from public.invoice_lines l where l.invoice_id = iid), 0),
    vat_cents = coalesce((select sum(l.vat_cents) from public.invoice_lines l where l.invoice_id = iid), 0),
    total_cents = coalesce((select sum(l.line_total_cents) from public.invoice_lines l where l.invoice_id = iid), 0)
  where i.id = iid and i.status = 'borrador';
  return null;
end $$;
create trigger invoice_lines_totals after insert or update or delete on public.invoice_lines
  for each row execute function app.invoice_totals();

create or replace function app.invoicing_records_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Los registros de facturación no se pueden borrar.' using errcode = 'P0001', hint = 'registro_inmutable';
  end if;
  if (new.invoice_id, new.record_type, new.hash, new.previous_hash, new.hash_input, new.generated_at, new.payload, new.chain_seq)
     is distinct from
     (old.invoice_id, old.record_type, old.hash, old.previous_hash, old.hash_input, old.generated_at, old.payload, old.chain_seq) then
    raise exception 'Un registro de facturación no se puede modificar (solo su estado de envío).'
      using errcode = 'P0001', hint = 'registro_inmutable';
  end if;
  return new;
end $$;
create trigger invoicing_records_guard before update or delete on public.invoicing_records
  for each row execute function app.invoicing_records_guard();

-- ── Huella (formato de la AEAT para VERI*FACTU) ───────────────

-- 2026-10-24T19:20:30+02:00 en hora de Madrid.
create or replace function app.iso_madrid(p timestamptz) returns text
language sql stable as $$
  select to_char(p at time zone 'Europe/Madrid', 'YYYY-MM-DD"T"HH24:MI:SS')
    || case when off >= 0 then '+' else '-' end
    || lpad((abs(off) / 3600)::text, 2, '0') || ':' || lpad(((abs(off) % 3600) / 60)::text, 2, '0')
  from (select extract(epoch from (p at time zone 'Europe/Madrid') - (p at time zone 'UTC'))::int as off) o
$$;

create or replace function app.money(p_cents integer) returns text
language sql immutable as $$ select to_char(p_cents / 100.0, 'FM9999999990.00') $$;

create or replace function app.invoice_type_code(p public.invoices) returns text
language sql stable as $$
  select case p.kind
    when 'ordinaria' then 'F1'
    when 'simplificada' then 'F2'
    else case when (select o.kind from public.invoices o where o.id = p.corrects_invoice_id) = 'simplificada'
              then 'R5' else 'R1' end
  end
$$;

-- Añade un registro (alta o anulación) al final de la cadena. Bloquea la cadena entera mientras.
create or replace function app.append_invoicing_record(p_invoice public.invoices, p_type text) returns public.invoicing_records
language plpgsql security definer set search_path = '' as $$
declare
  prev text;
  ts timestamptz := clock_timestamp();
  nif text := upper(coalesce(p_invoice.issuer ->> 'nif', ''));
  input text;
  r public.invoicing_records;
begin
  perform pg_advisory_xact_lock(hashtext('wedding-webs:cadena-facturacion'));
  select hash into prev from public.invoicing_records order by chain_seq desc limit 1;
  if p_type = 'alta' then
    input := 'IDEmisorFactura=' || nif
      || '&NumSerieFactura=' || p_invoice.full_number
      || '&FechaExpedicionFactura=' || to_char(p_invoice.issued_at at time zone 'Europe/Madrid', 'DD-MM-YYYY')
      || '&TipoFactura=' || app.invoice_type_code(p_invoice)
      || '&CuotaTotal=' || app.money(p_invoice.vat_cents)
      || '&ImporteTotal=' || app.money(p_invoice.total_cents)
      || '&Huella=' || coalesce(prev, '')
      || '&FechaHoraHusoGenRegistro=' || app.iso_madrid(ts);
  else
    input := 'IDEmisorFacturaAnulada=' || nif
      || '&NumSerieFacturaAnulada=' || p_invoice.full_number
      || '&FechaExpedicionFacturaAnulada=' || to_char(p_invoice.issued_at at time zone 'Europe/Madrid', 'DD-MM-YYYY')
      || '&Huella=' || coalesce(prev, '')
      || '&FechaHoraHusoGenRegistro=' || app.iso_madrid(ts);
  end if;
  insert into public.invoicing_records (invoice_id, record_type, hash, previous_hash, hash_input, generated_at, payload)
  values (p_invoice.id, p_type, upper(encode(extensions.digest(input, 'sha256'), 'hex')), prev, input, ts,
          jsonb_build_object('tipo_factura', app.invoice_type_code(p_invoice), 'numero', p_invoice.full_number,
                             'total_cents', p_invoice.total_cents, 'iva_cents', p_invoice.vat_cents))
  returning * into r;
  return r;
end $$;

-- ── Emitir, anular y rectificar ───────────────────────────────

create or replace function public.issue_invoice(p_invoice_id uuid) returns public.invoices
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invoices;
  seller jsonb := coalesce(app.setting('vendedor'), '{}'::jsonb);
  y integer := extract(year from now() at time zone 'Europe/Madrid')::int;
  s public.invoice_series;
  n integer;
begin
  if not (app.is_admin() or app.is_service()) then
    raise exception 'Solo el dueño o un administrador pueden emitir facturas.' using errcode = '42501';
  end if;
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'Factura no encontrada.'; end if;
  if inv.status <> 'borrador' then raise exception 'La factura % ya está emitida.', inv.full_number; end if;
  if coalesce(seller ->> 'nombre', '') = '' or coalesce(seller ->> 'nif', '') = '' or coalesce(seller ->> 'direccion', '') = '' then
    raise exception 'Faltan los datos fiscales de WeddingWebs (nombre, NIF y dirección). Rellénalos en Ajustes antes de facturar.'
      using hint = 'faltan_datos_vendedor';
  end if;
  if not exists (select 1 from public.invoice_lines where invoice_id = inv.id) then
    raise exception 'La factura no tiene líneas.';
  end if;
  if inv.kind <> 'simplificada' and (coalesce(inv.recipient ->> 'nombre', '') = '' or coalesce(inv.recipient ->> 'nif', '') = '') then
    raise exception 'Una factura completa necesita el nombre y el NIF/NIE del cliente.';
  end if;

  insert into public.invoice_series (code, year, kind) values (inv.series_code, y, inv.kind)
  on conflict (code, year) do nothing;
  select * into s from public.invoice_series where code = inv.series_code and year = y for update;
  if s.kind <> inv.kind then
    raise exception 'La serie % es de facturas de tipo %; esta factura es %.', s.code, s.kind, inv.kind;
  end if;
  n := s.next_number;
  update public.invoice_series set next_number = n + 1 where id = s.id;

  update public.invoices set
    series_id = s.id,
    number = n,
    full_number = s.code || '-' || y || '-' || lpad(n::text, 4, '0'),
    status = 'emitida',
    issued_at = now(),
    operation_date = coalesce(operation_date, (now() at time zone 'Europe/Madrid')::date),
    issuer = seller
  where id = inv.id
  returning * into inv;

  perform app.append_invoicing_record(inv, 'alta');
  return inv;
end $$;

create or replace function public.cancel_invoice(p_invoice_id uuid, p_reason text) returns public.invoices
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invoices;
begin
  if not (app.is_admin() or app.is_service()) then
    raise exception 'Solo el dueño o un administrador pueden anular facturas.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'Indica el motivo de la anulación.'; end if;
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found or inv.status <> 'emitida' then raise exception 'Solo se puede anular una factura emitida.'; end if;
  perform app.append_invoicing_record(inv, 'anulacion');
  update public.invoices set status = 'anulada' where id = inv.id returning * into inv;
  insert into public.activities (kind, title, body, client_id, order_id, actor_id)
  select 'sistema', 'Factura anulada: ' || inv.full_number, p_reason, inv.client_id, inv.order_id, app.staff_id()
  where inv.client_id is not null or inv.order_id is not null;
  return inv;
end $$;

-- Crea el borrador de una rectificativa (serie R) con las líneas en negativo. Luego se emite.
create or replace function public.create_corrective_invoice(p_invoice_id uuid, p_reason text) returns public.invoices
language plpgsql security definer set search_path = '' as $$
declare
  orig public.invoices;
  inv public.invoices;
begin
  if not (app.is_admin() or app.is_service()) then
    raise exception 'Solo el dueño o un administrador pueden rectificar facturas.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'Indica el motivo de la rectificación.'; end if;
  select * into orig from public.invoices where id = p_invoice_id;
  if not found or orig.status <> 'emitida' then raise exception 'Solo se puede rectificar una factura emitida.'; end if;
  insert into public.invoices (series_code, kind, client_id, order_id, corrects_invoice_id, correction_reason,
                               recipient, language, currency, operation_date)
  values ('R', 'rectificativa', orig.client_id, orig.order_id, orig.id, p_reason,
          orig.recipient, orig.language, orig.currency, orig.operation_date)
  returning * into inv;
  insert into public.invoice_lines (invoice_id, position, description, quantity, unit_total_cents, vat_rate_bp)
  select inv.id, l.position, l.description, -l.quantity, l.unit_total_cents, l.vat_rate_bp
  from public.invoice_lines l where l.invoice_id = orig.id;
  select * into inv from public.invoices where id = inv.id;
  return inv;
end $$;

revoke execute on function public.issue_invoice(uuid) from public, anon;
revoke execute on function public.cancel_invoice(uuid, text) from public, anon;
revoke execute on function public.create_corrective_invoice(uuid, text) from public, anon;
grant execute on function public.issue_invoice(uuid) to authenticated, service_role;
grant execute on function public.cancel_invoice(uuid, text) to authenticated, service_role;
grant execute on function public.create_corrective_invoice(uuid, text) to authenticated, service_role;

-- ════════════════ 20261024000600_sistema.sql ════════════════

-- WeddingWebs · 6/9 · Sistema: emails enviados, webhooks, registro de cambios y límite de peticiones.

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  template text,
  subject text,
  provider text,
  provider_id text,
  status text not null default 'pendiente' check (status in (
    'pendiente', 'enviado', 'entregado', 'rebotado', 'fallido', 'simulado')),
  error text,
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  wedding_id uuid references public.weddings(id) on delete set null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index email_log_created_idx on public.email_log (created_at desc);
create trigger email_log_updated_at before update on public.email_log
  for each row execute function app.set_updated_at();

-- Todo webhook entrante se guarda tal cual. (provider, event_id) único: si llega dos veces, se ignora.
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  type text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, event_id)
);
create trigger webhook_events_updated_at before update on public.webhook_events
  for each row execute function app.set_updated_at();

-- Quién cambió qué.
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  row_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  actor_user_id uuid,
  actor_staff_id uuid,
  actor_role text,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index audit_log_row_idx on public.audit_log (table_name, row_id, created_at desc);

create or replace function app.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  o jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  n jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  diff jsonb := '{}'::jsonb;
  k text;
begin
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(n) loop
      continue when k in ('updated_at');
      if (o -> k) is distinct from (n -> k) then
        -- El config de una boda puede ser grande: se apunta el cambio, el detalle está en wedding_versions.
        diff := diff || jsonb_build_object(k, case when k in ('config', 'trial_config', 'raw', 'payload')
          then jsonb_build_object('cambiado', true)
          else jsonb_build_object('antes', o -> k, 'despues', n -> k) end);
      end if;
    end loop;
    if diff = '{}'::jsonb then return null; end if;
  elsif tg_op = 'INSERT' then
    diff := n - 'config' - 'trial_config' - 'raw' - 'payload';
  else
    diff := o - 'config' - 'trial_config' - 'raw' - 'payload';
  end if;
  insert into public.audit_log (table_name, row_id, action, actor_user_id, actor_staff_id, actor_role, changes)
  values (tg_table_name, coalesce((n ->> 'id'), (o ->> 'id'))::uuid, lower(tg_op), auth.uid(), app.staff_id(),
          coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', current_user), diff);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['staff', 'settings', 'products', 'clients', 'leads', 'weddings', 'orders', 'payments',
                           'invoices', 'couple_users']
  loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function app.audit()',
                   t || '_audit', t);
  end loop;
end $$;

-- Límite de peticiones de los formularios públicos (por IP con huella, nunca la IP en claro).
create table public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (key, window_start)
);

-- ════════════════ 20261024000700_rls.sql ════════════════

-- WeddingWebs · 7/9 · Seguridad por filas (RLS) en TODAS las tablas.
--
-- Quién ve qué:
--   · anon (cualquiera sin sesión): nada. Lo público (webs de boda, RSVP, leads) pasa por
--     nuestras funciones de servidor con la clave secreta y por las funciones api_* de 8/9.
--   · equipo (staff): el CRM, las bodas y los invitados. Ajustes, equipo y facturas: solo owner/admin.
--   · pareja (couple_users): solo su boda, sus invitados y sus respuestas.
--   · service_role (nuestras funciones de servidor): se salta la RLS, como en todo Supabase.

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Defensa extra: el rol anónimo no toca ninguna tabla ni vista directamente.
revoke all on all tables in schema public from anon;

-- ── Equipo y ajustes ──────────────────────────────────────────
create policy staff_select on public.staff for select to authenticated using (app.is_staff());
create policy staff_write on public.staff for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy settings_select on public.settings for select to authenticated using (app.is_staff());
create policy settings_write on public.settings for all to authenticated using (app.is_admin()) with check (app.is_admin());

-- counters y rate_limits: sin políticas (solo funciones internas y service_role).

-- ── CRM ───────────────────────────────────────────────────────
create policy clients_select on public.clients for select to authenticated using (app.is_staff());
create policy clients_insert on public.clients for insert to authenticated with check (app.is_staff());
create policy clients_update on public.clients for update to authenticated using (app.is_staff()) with check (app.is_staff());
create policy clients_delete on public.clients for delete to authenticated using (app.is_admin());

create policy leads_select on public.leads for select to authenticated using (app.is_staff());
create policy leads_insert on public.leads for insert to authenticated with check (app.is_staff());
create policy leads_update on public.leads for update to authenticated using (app.is_staff()) with check (app.is_staff());
create policy leads_delete on public.leads for delete to authenticated using (app.is_admin());

create policy lead_attribution_select on public.lead_attribution for select to authenticated using (app.is_staff());
create policy lead_attribution_write on public.lead_attribution for all to authenticated using (app.is_admin()) with check (app.is_staff());

create policy consents_select on public.consents for select to authenticated using (app.is_staff());
create policy consents_insert on public.consents for insert to authenticated with check (app.is_staff());

create policy activities_select on public.activities for select to authenticated using (app.is_staff());
create policy activities_insert on public.activities for insert to authenticated with check (app.is_staff());
create policy activities_update on public.activities for update to authenticated
  using (app.is_admin() or (kind = 'nota' and actor_id = app.staff_id()))
  with check (app.is_admin() or (kind = 'nota' and actor_id = app.staff_id()));
create policy activities_delete on public.activities for delete to authenticated
  using (app.is_admin() or (kind = 'nota' and actor_id = app.staff_id()));

create policy tasks_all on public.tasks for all to authenticated using (app.is_staff()) with check (app.is_staff());

-- ── Productos, pedidos y pagos ────────────────────────────────
create policy products_select on public.products for select to authenticated using (app.is_staff());
create policy products_write on public.products for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy orders_select on public.orders for select to authenticated using (app.is_staff());
create policy orders_insert on public.orders for insert to authenticated with check (app.is_staff());
create policy orders_update on public.orders for update to authenticated using (app.is_staff()) with check (app.is_staff());
create policy orders_delete on public.orders for delete to authenticated using (app.is_admin());

create policy order_lines_all on public.order_lines for all to authenticated using (app.is_staff()) with check (app.is_staff());

create policy payments_select on public.payments for select to authenticated using (app.is_staff());
create policy payments_insert on public.payments for insert to authenticated with check (app.is_staff());
create policy payments_update on public.payments for update to authenticated using (app.is_staff()) with check (app.is_staff());
create policy payments_delete on public.payments for delete to authenticated using (app.is_admin());

-- ── Bodas ─────────────────────────────────────────────────────
create policy weddings_select on public.weddings for select to authenticated
  using (app.is_staff() or id in (select app.couple_wedding_ids()));
create policy weddings_insert on public.weddings for insert to authenticated with check (app.is_staff());
create policy weddings_update on public.weddings for update to authenticated using (app.is_staff()) with check (app.is_staff());
create policy weddings_delete on public.weddings for delete to authenticated using (app.is_admin());

create policy wedding_versions_select on public.wedding_versions for select to authenticated
  using (app.is_staff() or wedding_id in (select app.couple_wedding_ids()));
create policy wedding_versions_insert on public.wedding_versions for insert to authenticated with check (app.is_staff());
create policy wedding_versions_delete on public.wedding_versions for delete to authenticated using (app.is_admin());

create policy wedding_assets_select on public.wedding_assets for select to authenticated
  using (app.is_staff() or wedding_id in (select app.couple_wedding_ids()));
create policy wedding_assets_write on public.wedding_assets for all to authenticated using (app.is_staff()) with check (app.is_staff());

create policy couple_users_select on public.couple_users for select to authenticated
  using (app.is_staff() or wedding_id in (select app.couple_wedding_ids()));
create policy couple_users_write on public.couple_users for all to authenticated using (app.is_staff()) with check (app.is_staff());

-- ── Invitados ─────────────────────────────────────────────────
create policy guest_groups_all on public.guest_groups for all to authenticated
  using (app.is_staff() or wedding_id in (select app.couple_wedding_ids()))
  with check (app.is_staff() or wedding_id in (select app.couple_wedding_ids()));
create policy guests_all on public.guests for all to authenticated
  using (app.is_staff() or wedding_id in (select app.couple_wedding_ids()))
  with check (app.is_staff() or wedding_id in (select app.couple_wedding_ids()));

create policy rsvp_responses_select on public.rsvp_responses for select to authenticated
  using (app.is_staff() or wedding_id in (select app.couple_wedding_ids()));
create policy rsvp_responses_insert on public.rsvp_responses for insert to authenticated
  with check ((app.is_staff() or wedding_id in (select app.couple_wedding_ids())) and source = 'panel');
create policy rsvp_responses_delete on public.rsvp_responses for delete to authenticated using (app.is_admin());

-- ── Facturación: solo owner/admin. Las reglas de inmutabilidad están en los disparadores. ──
create policy invoice_series_all on public.invoice_series for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy invoices_all on public.invoices for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy invoice_lines_all on public.invoice_lines for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy invoicing_records_select on public.invoicing_records for select to authenticated using (app.is_admin());

-- ── Sistema ───────────────────────────────────────────────────
create policy email_log_select on public.email_log for select to authenticated using (app.is_staff());
create policy webhook_events_select on public.webhook_events for select to authenticated using (app.is_admin());
create policy audit_log_select on public.audit_log for select to authenticated using (app.is_admin());

-- ════════════════ 20261024000800_api.sql ════════════════

-- WeddingWebs · 8/9 · Funciones que usan la web pública (api_*) y el panel.
--
-- api_*: solo las puede llamar nuestro servidor (service_role). Nunca el navegador.
-- El resto: el panel, con la sesión del usuario; comprueban que sea del equipo.

-- ── Web pública de una boda ───────────────────────────────────

create or replace function public.api_public_wedding(p_slug text, p_preview_token text default null, p_host text default null)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  w public.weddings;
  v public.wedding_versions;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  if p_host is not null then
    select * into w from public.weddings where custom_domain = lower(p_host);
  end if;
  if w.id is null then
    select * into w from public.weddings where slug = lower(coalesce(p_slug, ''));
  end if;
  if w.id is null then return null; end if;

  -- Vista previa del borrador con su clave (la que comparte Luis con la pareja).
  if p_preview_token is not null then
    if length(p_preview_token) < 20 or p_preview_token is distinct from w.preview_token then return null; end if;
    return jsonb_build_object('id', w.id, 'slug', w.slug, 'status', w.status, 'template', w.template,
      'config', w.config, 'version', null, 'draft', true, 'updated_at', w.updated_at);
  end if;
  if w.status = 'retirada' then
    return jsonb_build_object('slug', w.slug, 'status', 'retirada');
  end if;
  if w.status not in ('publicada', 'archivada') or w.published_version_id is null then
    return null;
  end if;
  select * into v from public.wedding_versions where id = w.published_version_id;
  return jsonb_build_object('id', w.id, 'slug', w.slug, 'status', w.status, 'template', v.template,
    'config', v.config, 'version', v.version, 'draft', false, 'updated_at', v.created_at);
end $$;

-- ── RSVP sencillo de las plantillas ───────────────────────────

create or replace function public.api_submit_rsvp(p_slug text, p_payload jsonb, p_ip_hash text default null, p_user_agent text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  w public.weddings;
  cfg jsonb;
  deadline date;
  today date := (now() at time zone 'Europe/Madrid')::date;
  nm text := btrim(regexp_replace(coalesce(p_payload ->> 'name', ''), '\s+', ' ', 'g'));
  att text := coalesce(p_payload ->> 'attending', '');
  song text := nullif(btrim(coalesce(p_payload ->> 'song', '')), '');
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  select * into w from public.weddings where slug = lower(coalesce(p_slug, ''));
  if w.id is null or w.status not in ('publicada', 'archivada') or w.published_version_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_existe');
  end if;
  select v.config into cfg from public.wedding_versions v where v.id = w.published_version_id;
  if not coalesce(cfg -> 'sections' ? 'rsvp', false) then
    return jsonb_build_object('ok', false, 'error', 'sin_rsvp');
  end if;
  begin
    deadline := nullif(cfg #>> '{rsvp,deadline}', '')::date;
  exception when others then deadline := null;
  end;
  -- Un día de margen por las zonas horarias de los invitados (la web cierra el formulario sola).
  if (deadline is not null and today > deadline + 1) or (w.wedding_date is not null and today > w.wedding_date) then
    return jsonb_build_object('ok', false, 'error', 'cerrado');
  end if;
  if length(nm) < 2 or length(nm) > 120 then return jsonb_build_object('ok', false, 'error', 'nombre'); end if;
  if att not in ('si', 'no') then return jsonb_build_object('ok', false, 'error', 'asistencia'); end if;
  if song is not null and length(song) > 300 then song := left(song, 300); end if;

  insert into public.rsvp_responses (wedding_id, name, attending, song, payload, source, ip_hash, user_agent)
  values (w.id, nm, att = 'si', song, p_payload - 'website', 'web', p_ip_hash, left(p_user_agent, 300));

  return jsonb_build_object('ok', true, 'sheet', w.rsvp_sheet_endpoint);
end $$;

-- ── Leads del escaparate ──────────────────────────────────────

create or replace function app.parse_attr(p jsonb) returns jsonb
language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'utm_source', left(p ->> 'utm_source', 200), 'utm_medium', left(p ->> 'utm_medium', 200),
    'utm_campaign', left(p ->> 'utm_campaign', 200), 'utm_term', left(p ->> 'utm_term', 200),
    'utm_content', left(p ->> 'utm_content', 200), 'gclid', left(p ->> 'gclid', 300),
    'fbclid', left(p ->> 'fbclid', 300), 'landing_page', left(p ->> 'landing_page', 500),
    'referrer', left(p ->> 'referrer', 500), 'captured_at', p ->> 'captured_at'))
$$;

create or replace function public.api_submit_lead(p jsonb, p_ip text default null, p_user_agent text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  em text := nullif(lower(btrim(coalesce(p ->> 'email', ''))), '');
  typ text := case when p ->> 'type' = 'reserva' then 'reserva' else 'prueba' end;
  wd text := coalesce(p ->> 'weddingDate', '');
  d date;
  t time;
  l public.leads;
  is_new boolean := false;
  v_attr jsonb;
  v_touch text;
  v_ip inet;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  if em is null or em !~ '^\S+@\S+\.\S+$' or length(em) > 200 then
    return jsonb_build_object('ok', false, 'error', 'email');
  end if;
  begin
    if wd ~ '^\d{4}-\d{2}-\d{2}' then d := left(wd, 10)::date; end if;
    if wd ~ '\d{2}:\d{2}$' then t := right(wd, 5)::time; end if;
  exception when others then d := null; t := null;
  end;
  begin v_ip := nullif(p_ip, '')::inet; exception when others then v_ip := null; end;

  select * into l from public.leads
   where lower(email) = em and status not in ('ganado', 'perdido') and anonymized_at is null
   order by created_at desc limit 1;

  if l.id is null then
    insert into public.leads (names, partner_a, partner_b, email, phone, wedding_date, wedding_time, venue, city,
                              style, tier, sections, trial_config, message, source, trials, reserved_at)
    values (left(coalesce(p ->> 'name', ''), 200), left(p ->> 'nameA', 100), left(p ->> 'nameB', 100), em,
            left(nullif(btrim(p ->> 'phone'), ''), 40), d, t, left(p ->> 'venue', 300), left(p ->> 'city', 200),
            left(p ->> 'style', 60), left(p ->> 'tier', 60), p -> 'sections', p -> 'wedding',
            left(nullif(btrim(p ->> 'message'), ''), 4000), typ,
            case when typ = 'prueba' then 1 else 0 end, case when typ = 'reserva' then now() end)
    returning * into l;
    is_new := true;
  else
    update public.leads set
      names = coalesce(nullif(left(p ->> 'name', 200), ''), names),
      partner_a = coalesce(nullif(left(p ->> 'nameA', 100), ''), partner_a),
      partner_b = coalesce(nullif(left(p ->> 'nameB', 100), ''), partner_b),
      phone = coalesce(nullif(left(btrim(p ->> 'phone'), 40), ''), phone),
      wedding_date = coalesce(d, wedding_date),
      wedding_time = coalesce(t, wedding_time),
      venue = coalesce(nullif(left(p ->> 'venue', 300), ''), venue),
      city = coalesce(nullif(left(p ->> 'city', 200), ''), city),
      style = coalesce(nullif(left(p ->> 'style', 60), ''), style),
      tier = coalesce(nullif(left(p ->> 'tier', 60), ''), tier),
      sections = coalesce(p -> 'sections', sections),
      trial_config = coalesce(p -> 'wedding', trial_config),
      message = coalesce(nullif(left(btrim(p ->> 'message'), 4000), ''), message),
      trials = trials + case when typ = 'prueba' then 1 else 0 end,
      reserved_at = case when typ = 'reserva' then now() else reserved_at end
    where id = l.id
    returning * into l;
    perform app.log_activity(typ,
      case when typ = 'prueba' then 'Ha vuelto a probar su web' else 'Ha enviado una reserva' end,
      nullif(left(btrim(p ->> 'message'), 4000), ''),
      jsonb_strip_nulls(jsonb_build_object('estilo', p ->> 'style', 'tarifa', p ->> 'tier')), l.id);
  end if;

  -- Atribución: el primer toque no se sobrescribe; el último, sí.
  for v_touch, v_attr in select e.k, e.v from jsonb_each(coalesce(p -> 'attribution', '{}'::jsonb)) as e(k, v)
                          where e.k in ('first', 'last') and jsonb_typeof(e.v) = 'object' loop
    v_attr := app.parse_attr(v_attr);
    continue when v_attr = '{}'::jsonb;
    if v_touch = 'first' then
      insert into public.lead_attribution as la (lead_id, touch, utm_source, utm_medium, utm_campaign, utm_term,
                                                 utm_content, gclid, fbclid, landing_page, referrer, captured_at)
      values (l.id, 'primero', v_attr ->> 'utm_source', v_attr ->> 'utm_medium', v_attr ->> 'utm_campaign',
              v_attr ->> 'utm_term', v_attr ->> 'utm_content', v_attr ->> 'gclid', v_attr ->> 'fbclid',
              v_attr ->> 'landing_page', v_attr ->> 'referrer', coalesce((v_attr ->> 'captured_at')::timestamptz, now()))
      on conflict on constraint lead_attribution_lead_id_touch_key do nothing;
    else
      insert into public.lead_attribution as la (lead_id, touch, utm_source, utm_medium, utm_campaign, utm_term,
                                                 utm_content, gclid, fbclid, landing_page, referrer, captured_at)
      values (l.id, 'ultimo', v_attr ->> 'utm_source', v_attr ->> 'utm_medium', v_attr ->> 'utm_campaign',
              v_attr ->> 'utm_term', v_attr ->> 'utm_content', v_attr ->> 'gclid', v_attr ->> 'fbclid',
              v_attr ->> 'landing_page', v_attr ->> 'referrer', coalesce((v_attr ->> 'captured_at')::timestamptz, now()))
      on conflict on constraint lead_attribution_lead_id_touch_key do update set
        utm_source = excluded.utm_source, utm_medium = excluded.utm_medium, utm_campaign = excluded.utm_campaign,
        utm_term = excluded.utm_term, utm_content = excluded.utm_content, gclid = excluded.gclid,
        fbclid = excluded.fbclid, landing_page = excluded.landing_page, referrer = excluded.referrer,
        captured_at = excluded.captured_at;
    end if;
  end loop;

  if coalesce((p ->> 'consent')::boolean, false) and nullif(btrim(p ->> 'consentText'), '') is not null then
    insert into public.consents (lead_id, email, purpose, granted, text, source, ip, user_agent)
    values (l.id, em, 'contacto_comercial', true, left(p ->> 'consentText', 2000),
            left(coalesce(p ->> 'page', 'escaparate'), 300), v_ip, left(p_user_agent, 300));
  end if;

  return jsonb_build_object('ok', true, 'lead_id', l.id, 'is_new', is_new, 'type', typ,
    'names', l.names, 'status', l.status, 'trials', l.trials);
end $$;

-- ── Límite de peticiones ──────────────────────────────────────

create or replace function public.api_hit_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  ws timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  h integer;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  insert into public.rate_limits (key, window_start, hits) values (left(p_key, 200), ws, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into h;
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return h <= p_max;
end $$;

-- Tarifas activas para el escaparate.
create or replace function public.api_products() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', p.code, 'name', p.name, 'description', p.description, 'price_cents', p.price_cents,
    'price_is_from', p.price_is_from, 'includes', p.includes, 'kind', p.kind) order by p.sort), '[]'::jsonb)
  from public.products p where p.active and app.is_service()
$$;

revoke execute on function public.api_public_wedding(text, text, text) from public, anon, authenticated;
revoke execute on function public.api_submit_rsvp(text, jsonb, text, text) from public, anon, authenticated;
revoke execute on function public.api_submit_lead(jsonb, text, text) from public, anon, authenticated;
revoke execute on function public.api_hit_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.api_products() from public, anon, authenticated;
grant execute on function public.api_public_wedding(text, text, text) to service_role;
grant execute on function public.api_submit_rsvp(text, jsonb, text, text) to service_role;
grant execute on function public.api_submit_lead(jsonb, text, text) to service_role;
grant execute on function public.api_hit_rate_limit(text, integer, integer) to service_role;
grant execute on function public.api_products() to service_role;

-- ── Panel ─────────────────────────────────────────────────────

create or replace function app.require_staff() returns void
language plpgsql stable as $$
begin
  if not (app.is_staff() or app.is_service()) then
    raise exception 'No tienes acceso al panel.' using errcode = '42501';
  end if;
end $$;

-- Publica el borrador actual como una versión nueva (queda el historial para volver atrás).
create or replace function public.publish_wedding(p_wedding_id uuid, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  w public.weddings;
  n integer;
  v public.wedding_versions;
begin
  perform app.require_staff();
  select * into w from public.weddings where id = p_wedding_id for update;
  if w.id is null then raise exception 'Boda no encontrada.'; end if;
  if jsonb_array_length(coalesce(w.config #> '{event,couple}', '[]'::jsonb)) <> 2 then
    raise exception 'Faltan los nombres de la pareja.';
  end if;
  if w.wedding_date is null then raise exception 'Falta la fecha de la boda (con su hora y zona).'; end if;
  select coalesce(max(version), 0) + 1 into n from public.wedding_versions where wedding_id = w.id;
  insert into public.wedding_versions (wedding_id, version, template, config, note, published_by)
  values (w.id, n, w.template, w.config, p_note, app.staff_id())
  returning * into v;
  update public.weddings set published_version_id = v.id, published_at = now(),
         status = case when status in ('publicada', 'archivada') then status else 'publicada' end
   where id = w.id;
  return jsonb_build_object('version', v.version, 'version_id', v.id, 'published_at', now());
end $$;

-- Quita la web de internet: vuelve a borrador (se puede volver a publicar) o queda retirada.
create or replace function public.unpublish_wedding(p_wedding_id uuid, p_status text default 'borrador') returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_staff();
  if p_status not in ('borrador', 'vista_previa', 'retirada') then raise exception 'Estado no válido.'; end if;
  update public.weddings set status = p_status where id = p_wedding_id;
  if not found then raise exception 'Boda no encontrada.'; end if;
end $$;

-- Copia una versión publicada al borrador (no publica: hay que pulsar Publicar).
create or replace function public.restore_wedding_version(p_version_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.wedding_versions;
begin
  perform app.require_staff();
  select * into v from public.wedding_versions where id = p_version_id;
  if v.id is null then raise exception 'Versión no encontrada.'; end if;
  update public.weddings set config = v.config, template = v.template where id = v.wedding_id;
  perform app.log_activity('boda', 'Borrador restaurado a la versión ' || v.version, null, '{}'::jsonb,
    null, null, v.wedding_id);
end $$;

-- Lead ganado -> cliente, sin volver a teclear nada.
create or replace function public.convert_lead_to_client(p_lead_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  l public.leads;
  cid uuid;
begin
  perform app.require_staff();
  select * into l from public.leads where id = p_lead_id for update;
  if l.id is null then raise exception 'Lead no encontrado.'; end if;
  cid := l.client_id;
  if cid is null then
    insert into public.clients (display_name, email, phone)
    values (coalesce(nullif(l.names, ''), l.email, l.phone), l.email, l.phone)
    returning id into cid;
    perform app.log_activity('sistema', 'Convertido en cliente', null, '{}'::jsonb, l.id, cid);
  end if;
  update public.leads set client_id = cid, status = 'ganado' where id = l.id;
  update public.weddings set client_id = cid where lead_id = l.id and client_id is null;
  return cid;
end $$;

-- Una dirección libre para una boda nueva: "lucia-y-martin", "lucia-y-martin-2"...
create or replace function public.suggest_slug(p_text text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  base text := left(app.slugify(p_text), 50);
  s text;
  i integer := 1;
begin
  perform app.require_staff();
  if length(base) < 3 then base := 'boda-' || to_char(now(), 'YYMMDD'); end if;
  s := base;
  while exists (select 1 from public.weddings where slug = s) or s in ('admin', 'panel', 'api', 'studio', 'b') loop
    i := i + 1;
    s := base || '-' || i;
  end loop;
  return s;
end $$;

-- Buscador global del panel (nombre, email, teléfono, dirección de la web, NIF).
create or replace function public.global_search(p_q text) returns table (kind text, id uuid, title text, subtitle text)
language plpgsql stable security invoker set search_path = '' as $$
declare
  q text := app.normalize(p_q);
  like_q text := '%' || replace(replace(app.normalize(p_q), '%', ''), '_', '') || '%';
begin
  perform app.require_staff();
  if length(q) < 2 then return; end if;
  return query
  (select 'lead'::text, l.id, coalesce(nullif(l.names, ''), l.email, l.phone),
          concat_ws(' · ', app.status_label(l.status), l.email, l.phone, to_char(l.wedding_date, 'DD/MM/YYYY'))
     from public.leads l
    where app.normalize(concat_ws(' ', l.names, l.email, l.phone, l.venue, l.city)) like like_q
    order by l.created_at desc limit 8)
  union all
  (select 'cliente'::text, c.id, c.display_name, concat_ws(' · ', c.email, c.phone, c.tax_id)
     from public.clients c
    where app.normalize(concat_ws(' ', c.display_name, c.email, c.phone, c.tax_id, c.billing_name)) like like_q
    order by c.created_at desc limit 8)
  union all
  (select 'boda'::text, w.id, coalesce(w.config #>> '{event,couple,0}', '') || ' y ' || coalesce(w.config #>> '{event,couple,1}', ''),
          concat_ws(' · ', '/b/' || w.slug, app.status_label(w.status), to_char(w.wedding_date, 'DD/MM/YYYY'))
     from public.weddings w
    where app.normalize(concat_ws(' ', w.slug, w.config #>> '{event,couple,0}', w.config #>> '{event,couple,1}',
                                  w.config #>> '{venue,name}', w.custom_domain)) like like_q
    order by w.wedding_date nulls last limit 8);
end $$;

-- Importador único de la hoja "Contactos" de Google (CSV). Si el email ya existe, no lo duplica.
create or replace function public.import_leads(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
  em text;
  st text;
  wd text;
  d date;
  t time;
  created timestamptz;
  imported integer := 0;
  repeated integer := 0;
  bad jsonb := '[]'::jsonb;
  i integer := 0;
begin
  perform app.require_staff();
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    i := i + 1;
    em := nullif(lower(btrim(coalesce(r ->> 'email', ''))), '');
    if em is null or em !~ '^\S+@\S+\.\S+$' then
      bad := bad || jsonb_build_object('fila', i, 'motivo', 'email no válido');
      continue;
    end if;
    if exists (select 1 from public.leads where lower(email) = em) then
      repeated := repeated + 1;
      continue;
    end if;
    st := case app.normalize(r ->> 'estado')
      when 'contactado' then 'contactado' when 'propuesta' then 'propuesta'
      when 'esperando pago' then 'esperando_pago' when 'pagado' then 'ganado' when 'ganado' then 'ganado'
      when 'cliente' then 'ganado' when 'perdido' then 'perdido' when 'descartado' then 'perdido'
      else 'nuevo' end;
    wd := coalesce(r ->> 'fecha_boda', '');
    d := null; t := null; created := null;
    begin
      if wd ~ '^\d{4}-\d{2}-\d{2}' then d := left(wd, 10)::date;
      elsif wd ~ '^\d{1,2}/\d{1,2}/\d{4}' then d := to_date(substring(wd from '^\d{1,2}/\d{1,2}/\d{4}'), 'DD/MM/YYYY');
      end if;
      if wd ~ '\d{1,2}:\d{2}(:\d{2})?$' then t := substring(wd from '\d{1,2}:\d{2}(?::\d{2})?$')::time; end if;
    exception when others then d := null; t := null;
    end;
    begin
      created := coalesce(nullif(r ->> 'fecha', ''), now()::text)::timestamptz;
    exception when others then
      begin created := to_timestamp(r ->> 'fecha', 'DD/MM/YYYY HH24:MI:SS');
      exception when others then created := now(); end;
    end;
    insert into public.leads (names, email, phone, wedding_date, wedding_time, venue, style, tier, message,
                              trial_config, source, status, lost_reason, trials, reserved_at, created_at, status_changed_at)
    values (left(coalesce(r ->> 'nombres', ''), 200), em, nullif(left(btrim(r ->> 'telefono'), 40), ''), d, t,
            nullif(left(r ->> 'lugar', 300), ''), nullif(left(r ->> 'estilo', 60), ''), nullif(left(r ->> 'tarifa', 60), ''),
            nullif(left(r ->> 'mensaje', 4000), ''),
            case when coalesce(r ->> 'config', '') like '{%' then (r ->> 'config')::jsonb end,
            'importado', st, case when st = 'perdido' then 'Importado como perdido' end,
            case when r ->> 'tipo' = 'prueba' then 1 else 0 end,
            case when r ->> 'tipo' = 'reserva' then created end, created, created);
    imported := imported + 1;
  end loop;
  return jsonb_build_object('importados', imported, 'repetidos', repeated, 'errores', bad);
end $$;

-- Lo importante del día para la pantalla de inicio (en una sola llamada).
create or replace function public.dashboard_summary() returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  today date := (now() at time zone 'Europe/Madrid')::date;
begin
  perform app.require_staff();
  return jsonb_build_object(
    'leads_nuevos', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select l.id, l.names, l.email, l.phone, l.source, l.style, l.tier, l.wedding_date, l.created_at, l.trials
          from public.leads l where l.status = 'nuevo' order by l.created_at desc limit 20) x),
    'leads_nuevos_total', (select count(*) from public.leads where status = 'nuevo'),
    'proximas_acciones', (select coalesce(jsonb_agg(x order by x.next_action_at), '[]'::jsonb) from (
        select l.id, l.names, l.status, l.next_action, l.next_action_at from public.leads l
         where l.status not in ('ganado', 'perdido') and l.next_action_at is not null
           and (l.next_action_at at time zone 'Europe/Madrid')::date <= today + 1
         order by l.next_action_at limit 20) x),
    'tareas', (select coalesce(jsonb_agg(x order by x.due_at nulls last), '[]'::jsonb) from (
        select t.id, t.title, t.due_at, t.lead_id, t.client_id, t.wedding_id,
               coalesce(l.names, c.display_name, w.slug) as about
          from public.tasks t
          left join public.leads l on l.id = t.lead_id
          left join public.clients c on c.id = t.client_id
          left join public.weddings w on w.id = t.wedding_id
         where t.status = 'pendiente' and (t.due_at is null or (t.due_at at time zone 'Europe/Madrid')::date <= today)
         order by t.due_at nulls last limit 30) x),
    'bodas_por_entregar', (select coalesce(jsonb_agg(x order by x.promised_delivery_at nulls last), '[]'::jsonb) from (
        select o.id, o.number, o.status, o.promised_delivery_at, o.wedding_id, c.display_name
          from public.orders o left join public.clients c on c.id = o.client_id
         where o.status in ('pagado', 'en_produccion') order by o.promised_delivery_at nulls last limit 20) x),
    'pagos_recientes', (select coalesce(jsonb_agg(x order by x.paid_at desc), '[]'::jsonb) from (
        select p.id, p.amount_cents, p.provider, p.paid_at, o.number, c.display_name
          from public.payments p join public.orders o on o.id = p.order_id
          left join public.clients c on c.id = o.client_id
         where p.status = 'pagado' and p.paid_at > now() - interval '14 days' order by p.paid_at desc limit 10) x),
    'bodas_semana', (select coalesce(jsonb_agg(x order by x.wedding_date), '[]'::jsonb) from (
        select w.id, w.slug, w.status, w.wedding_date, w.config #> '{event,couple}' as couple, w.config #>> '{venue,name}' as venue
          from public.weddings w where w.wedding_date between today and today + 7 order by w.wedding_date) x),
    'embudo', (select coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb) from (
        select l.status, count(*) as n from public.leads l group by l.status) s),
    'respuestas_semana', (select count(*) from public.rsvp_responses r where r.created_at > now() - interval '7 days')
  );
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.publish_wedding(uuid, text)', 'public.unpublish_wedding(uuid, text)',
    'public.restore_wedding_version(uuid)', 'public.convert_lead_to_client(uuid)', 'public.suggest_slug(text)',
    'public.global_search(text)', 'public.import_leads(jsonb)', 'public.dashboard_summary()']
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

-- ════════════════ 20261024000900_almacenamiento.sql ════════════════

-- WeddingWebs · 9/9 · Fotos de las parejas en Supabase Storage.
--
-- Cubo "wedding-assets" de lectura pública con rutas imposibles de adivinar
-- (weddings/<id de la boda>/<uuid>.jpg): la foto es tan privada como la propia web de la boda,
-- que también es pública para quien tenga el enlace. Así las webs cargan rápido y se pueden
-- cachear, sin URLs firmadas que caducan. Solo el equipo puede subir, cambiar o borrar.
-- Nunca se guardan aquí fotos de invitados (regla de negocio 1).

do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    raise notice 'Sin esquema storage (base local sin Supabase Storage): se omite.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('wedding-assets', 'wedding-assets', true, 26214400, array['image/jpeg', 'image/webp', 'image/png'])
  on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
                                 allowed_mime_types = excluded.allowed_mime_types;

  execute $p$drop policy if exists wedding_assets_staff_select on storage.objects$p$;
  execute $p$drop policy if exists wedding_assets_staff_insert on storage.objects$p$;
  execute $p$drop policy if exists wedding_assets_staff_update on storage.objects$p$;
  execute $p$drop policy if exists wedding_assets_staff_delete on storage.objects$p$;
  execute $p$create policy wedding_assets_staff_select on storage.objects for select to authenticated
            using (bucket_id = 'wedding-assets' and app.is_staff())$p$;
  execute $p$create policy wedding_assets_staff_insert on storage.objects for insert to authenticated
            with check (bucket_id = 'wedding-assets' and app.is_staff())$p$;
  execute $p$create policy wedding_assets_staff_update on storage.objects for update to authenticated
            using (bucket_id = 'wedding-assets' and app.is_staff())
            with check (bucket_id = 'wedding-assets' and app.is_staff())$p$;
  execute $p$create policy wedding_assets_staff_delete on storage.objects for delete to authenticated
            using (bucket_id = 'wedding-assets' and app.is_staff())$p$;
end $$;

-- ════════════════ 20261025000100_pareja.sql ════════════════

-- WeddingWebs · 10 · Fase 3: panel de la pareja y RSVP ampliado.
--
-- · La pareja entra por enlace mágico y ve SU boda. Puede cambiar datos prácticos (horario,
--   dirección, fecha límite, IBAN, secciones, preguntas del RSVP), nunca el diseño ni los textos.
--   Lo que cambia se publica solo, sin arrastrar los cambios a medias que tenga Luis en el borrador.
-- · RSVP ampliado (módulo opcional por plan): grupos con enlace personal, acompañantes, niños,
--   alergias, autobús y mensaje. Sin el módulo, cada plantilla sigue con su RSVP sencillo.

-- ── Qué incluye cada boda ─────────────────────────────────────

alter table public.weddings add column features jsonb not null default '{}'::jsonb
  check (jsonb_typeof(features) = 'object');
comment on column public.weddings.features is 'Excepciones de esta boda sobre lo que incluye su plan, p. ej. {"rsvp_ampliado": true} para regalarlo.';

-- Las dos opciones pendientes de decidir (139 € o 249 €) incluyen el plan de 249 €: ese ya lo trae.
-- El de 139 € se activa con una casilla en Panel › Ajustes › Tarifas.
update public.products set features = features || '{"rsvp_ampliado": true}'::jsonb where code = 'a-medida';

-- Funciones del plan de la boda (pedidos no cancelados) + excepciones de la boda.
create or replace function app.wedding_features(p_wedding_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with plan as (
    select f.key, bool_or(f.value = 'true'::jsonb) as enabled
    from public.orders o
    join public.order_lines l on l.order_id = o.id
    join public.products p on p.id = l.product_id
    cross join lateral jsonb_each(p.features) f
    where o.wedding_id = p_wedding_id and o.status not in ('cancelado', 'reembolsado')
    group by f.key
  )
  select coalesce((select jsonb_object_agg(plan.key, plan.enabled) from plan), '{}'::jsonb)
      || coalesce((select w.features from public.weddings w where w.id = p_wedding_id), '{}'::jsonb)
$$;

-- ── Pareja ────────────────────────────────────────────────────

alter table public.couple_users
  add column digest text not null default 'semanal' check (digest in ('nunca', 'diario', 'semanal')),
  add column last_digest_at timestamptz,
  add column last_link_at timestamptz;
comment on column public.couple_users.digest is 'Resumen de respuestas por email: nunca, diario o semanal (los lunes).';

alter table public.guest_groups
  add column email text,
  add column phone text,
  add constraint guest_groups_token_format check (token ~ '^[A-Za-z0-9_-]{24,}$');

create or replace function app.can_manage_wedding(p_wedding_id uuid) returns boolean
language sql stable as $$
  select app.is_staff() or p_wedding_id in (select app.couple_wedding_ids())
$$;

-- La pareja ya no lee la tabla de bodas directamente (tiene notas internas de Luis):
-- usa pareja_resumen(), que devuelve solo lo suyo.
drop policy weddings_select on public.weddings;
create policy weddings_select on public.weddings for select to authenticated using (app.is_staff());

-- Puede borrar las respuestas que apuntó ella a mano (las de la web, no).
create policy rsvp_responses_couple_delete on public.rsvp_responses for delete to authenticated
  using (source = 'panel' and wedding_id in (select app.couple_wedding_ids()));

-- ── Totales de respuestas ─────────────────────────────────────

create or replace function app.rsvp_stats(p_wedding_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with g as (
    select gg.id, greatest(gg.seats, (select count(*) from public.guests x where x.group_id = gg.id)) as people
    from public.guest_groups gg where gg.wedding_id = p_wedding_id
  ),
  r as (select * from public.rsvp_current where wedding_id = p_wedding_id),
  ppl as (
    select r.id,
           case when not r.attending then 0 else coalesce(r.adults, case when r.children is null then 1 else 0 end) end as adults,
           case when not r.attending then 0 else coalesce(r.children, 0) end as children
    from r
  ),
  diet as (
    select count(*) as n from r
    cross join lateral (
      select 1 where r.attending and coalesce(btrim(r.dietary), '') <> ''
      union all
      select 1 from jsonb_array_elements(r.companions) c
      where r.attending and coalesce((c ->> 'attending')::boolean, false) and coalesce(btrim(c ->> 'dietary'), '') <> ''
    ) d
  )
  select jsonb_build_object(
    'grupos', (select count(*) from g),
    'invitados', coalesce((select sum(people) from g), 0),
    'respondidos', (select count(*) from r where r.group_id is not null),
    'grupos_si', (select count(*) from r where r.group_id is not null and r.attending),
    'grupos_no', (select count(*) from r where r.group_id is not null and not r.attending),
    'pendientes', (select count(*) from g where g.id not in (select r.group_id from r where r.group_id is not null)),
    'si', (select count(*) from r where r.attending),
    'no', (select count(*) from r where not r.attending),
    'adultos', coalesce((select sum(adults) from ppl), 0),
    'ninos', coalesce((select sum(children) from ppl), 0),
    'personas', coalesce((select sum(adults + children) from ppl), 0),
    'alergias', (select n from diet),
    'autobus', coalesce((select sum(p.adults + p.children) from ppl p join r on r.id = p.id where r.bus), 0),
    'sin_grupo', (select count(*) from r where r.group_id is null),
    'ultimas_24h', (select count(*) from public.rsvp_responses x where x.wedding_id = p_wedding_id and x.created_at > now() - interval '24 hours')
  )
$$;

-- ── Resumen para el panel de la pareja ────────────────────────

create or replace function public.pareja_resumen(p_wedding_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  wid uuid := p_wedding_id;
  w public.weddings;
  me public.couple_users;
begin
  if wid is null then
    select c.wedding_id into wid from public.couple_users c join public.weddings x on x.id = c.wedding_id
     where c.user_id = auth.uid() order by x.wedding_date nulls last limit 1;
  end if;
  if wid is null or not app.can_manage_wedding(wid) then
    raise exception 'No tienes acceso a esta boda.' using errcode = '42501';
  end if;
  select * into w from public.weddings where id = wid;
  select * into me from public.couple_users where wedding_id = wid and user_id = auth.uid();
  return jsonb_build_object(
    'wedding', jsonb_build_object(
      'id', w.id, 'slug', w.slug, 'status', w.status, 'template', w.template, 'theme', w.config ->> 'theme',
      'wedding_date', w.wedding_date, 'date', w.config #>> '{event,date}', 'couple', w.config #> '{event,couple}',
      'published_at', w.published_at, 'retire_at', w.retire_at, 'guest_data_delete_at', w.guest_data_delete_at,
      'custom_domain', w.custom_domain, 'updated_at', w.updated_at),
    'practico', jsonb_strip_nulls(jsonb_build_object(
      'schedule', coalesce(w.config -> 'schedule', '[]'::jsonb),
      'venue', w.config -> 'venue',
      'rsvp', jsonb_build_object('deadline', w.config #> '{rsvp,deadline}', 'bus', coalesce(w.config #> '{rsvp,bus}', 'false'),
                                 'dietary', coalesce(w.config #> '{rsvp,dietary}', 'true')),
      'gifts', w.config -> 'gifts',
      'sections', w.config -> 'sections')),
    'features', app.wedding_features(w.id),
    'stats', app.rsvp_stats(w.id),
    'me', case when me.id is null then null else jsonb_build_object('email', me.email, 'name', me.name, 'digest', me.digest) end,
    'staff', app.is_staff(),
    'contacto', jsonb_strip_nulls(jsonb_build_object('email', nullif(app.setting('vendedor') ->> 'email', ''),
                                                     'telefono', nullif(app.setting('vendedor') ->> 'telefono', ''))),
    'weddings', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'couple', x.config #> '{event,couple}', 'wedding_date', x.wedding_date)
                                           order by x.wedding_date), '[]'::jsonb)
                   from public.weddings x where x.id in (select app.couple_wedding_ids()))
  );
end $$;

-- ── La pareja cambia datos prácticos ──────────────────────────

create or replace function app.iban_ok(p text) returns boolean
language plpgsql immutable as $$
declare
  s text := upper(regexp_replace(coalesce(p, ''), '\s', '', 'g'));
  moved text;
  rest bigint := 0;
  ch text;
begin
  if s !~ '^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$' or (s like 'ES%' and length(s) <> 24) then return false; end if;
  moved := substr(s, 5) || substr(s, 1, 4);
  foreach ch in array regexp_split_to_array(moved, '') loop
    if ch ~ '[A-Z]' then
      rest := (rest * 100 + (ascii(ch) - 55)) % 97;
    else
      rest := (rest * 10 + ch::int) % 97;
    end if;
  end loop;
  return rest = 1;
end $$;

-- Solo estas claves; el resto del config (diseño, textos, fotos) no lo toca la pareja.
create or replace function app.couple_patch(p_config jsonb, p jsonb) returns jsonb
language plpgsql immutable as $$
declare
  c jsonb := p_config;
begin
  if p ? 'schedule' then c := jsonb_set(c, '{schedule}', p -> 'schedule'); end if;
  if p ? 'sections' then c := jsonb_set(c, '{sections}', p -> 'sections'); end if;
  if p ? 'venue' then
    c := jsonb_set(c, '{venue}', coalesce(c -> 'venue', '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'address', p #> '{venue,address}', 'mapsUrl', p #> '{venue,mapsUrl}')));
  end if;
  if p ? 'gifts' then
    c := jsonb_set(c, '{gifts}', coalesce(c -> 'gifts', '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'holder', p #> '{gifts,holder}', 'iban', p #> '{gifts,iban}')));
  end if;
  if p ? 'rsvp' then
    c := jsonb_set(c, '{rsvp}', coalesce(c -> 'rsvp', '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'deadline', p #> '{rsvp,deadline}', 'bus', p #> '{rsvp,bus}', 'dietary', p #> '{rsvp,dietary}')));
  end if;
  return c;
end $$;

create or replace function public.pareja_guardar(p_wedding_id uuid, p_patch jsonb, p_expected_updated_at timestamptz default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  w public.weddings;
  v public.wedding_versions;
  item jsonb;
  s text;
  changed text[] := '{}';
  fixed text[] := array['hero', 'card', 'details', 'closing'];
  allowed text[] := array['hero', 'card', 'details', 'travel', 'story', 'liturgy', 'gallery', 'schedule', 'dresscode', 'gifts', 'closing', 'rsvp'];
  dl date;
  n integer;
  new_published jsonb;
  label text;
begin
  if not app.can_manage_wedding(p_wedding_id) then
    raise exception 'No tienes acceso a esta boda.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_patch) <> 'object' then raise exception 'Datos no válidos.'; end if;
  if exists (select 1 from jsonb_object_keys(p_patch) k where k not in ('schedule', 'venue', 'gifts', 'rsvp', 'sections')) then
    raise exception 'Solo se pueden cambiar el horario, la dirección, el regalo, la confirmación y las secciones.';
  end if;
  select * into w from public.weddings where id = p_wedding_id for update;
  if p_expected_updated_at is not null and w.updated_at is distinct from p_expected_updated_at then
    raise exception 'Alguien ha cambiado esta boda mientras la editabas. Recarga la página y vuelve a hacer el cambio.'
      using hint = 'conflicto';
  end if;

  -- Horario
  if p_patch ? 'schedule' then
    if jsonb_typeof(p_patch -> 'schedule') <> 'array' or jsonb_array_length(p_patch -> 'schedule') > 20 then
      raise exception 'El horario tiene que ser una lista de como mucho 20 momentos.';
    end if;
    for item in select * from jsonb_array_elements(p_patch -> 'schedule') loop
      if coalesce(item ->> 'time', '') !~ '^([01]\d|2[0-3]):[0-5]\d$' then raise exception 'Revisa las horas del horario (formato 18:30).'; end if;
      if length(btrim(coalesce(item ->> 'label', ''))) not between 1 and 80 then raise exception 'Cada momento del horario necesita un nombre (como mucho 80 letras).'; end if;
      if length(coalesce(item ->> 'place', '')) > 120 then raise exception 'El lugar de un momento es demasiado largo.'; end if;
      if exists (select 1 from jsonb_object_keys(item) k where k not in ('time', 'label', 'place', 'tone')) then raise exception 'Datos del horario no válidos.'; end if;
    end loop;
    changed := array_append(changed, 'horario');
  end if;
  -- Dirección
  if p_patch ? 'venue' then
    if length(coalesce(p_patch #>> '{venue,address}', '')) > 300 then raise exception 'La dirección es demasiado larga.'; end if;
    if coalesce(p_patch #>> '{venue,mapsUrl}', 'https://') !~ '^https://' then raise exception 'El enlace del mapa tiene que empezar por https://'; end if;
    changed := array_append(changed, 'dirección');
  end if;
  -- Regalo
  if p_patch ? 'gifts' then
    if coalesce(p_patch #>> '{gifts,iban}', '') <> '' and not app.iban_ok(p_patch #>> '{gifts,iban}') then
      raise exception 'El IBAN no es válido. Revisa los números.';
    end if;
    if length(coalesce(p_patch #>> '{gifts,holder}', '')) > 120 then raise exception 'El nombre del titular es demasiado largo.'; end if;
    changed := array_append(changed, 'regalo');
  end if;
  -- Confirmación
  if p_patch ? 'rsvp' then
    if coalesce(p_patch #>> '{rsvp,deadline}', '') <> '' then
      begin dl := (p_patch #>> '{rsvp,deadline}')::date;
      exception when others then raise exception 'La fecha límite no es una fecha válida.';
      end;
      if w.wedding_date is not null and dl > w.wedding_date then raise exception 'La fecha límite no puede ser después de la boda.'; end if;
    end if;
    if p_patch #> '{rsvp,bus}' is not null and jsonb_typeof(p_patch #> '{rsvp,bus}') <> 'boolean' then raise exception 'Datos no válidos.'; end if;
    if p_patch #> '{rsvp,dietary}' is not null and jsonb_typeof(p_patch #> '{rsvp,dietary}') <> 'boolean' then raise exception 'Datos no válidos.'; end if;
    changed := array_append(changed, 'confirmación');
  end if;
  -- Secciones: solo se encienden o apagan; las fijas no se quitan.
  if p_patch ? 'sections' then
    if jsonb_typeof(p_patch -> 'sections') <> 'array' then raise exception 'Datos no válidos.'; end if;
    for s in select jsonb_array_elements_text(p_patch -> 'sections') loop
      if not s = any (allowed) then raise exception 'Sección desconocida: %', s; end if;
    end loop;
    for s in select jsonb_array_elements_text(w.config -> 'sections') loop
      if s = any (fixed) and not (p_patch -> 'sections') ? s then raise exception 'La sección % no se puede quitar.', s; end if;
    end loop;
    if (select count(*) from jsonb_array_elements_text(p_patch -> 'sections')) <> (select count(distinct x) from jsonb_array_elements_text(p_patch -> 'sections') x) then
      raise exception 'Hay secciones repetidas.';
    end if;
    changed := array_append(changed, 'secciones');
  end if;

  update public.weddings set config = app.couple_patch(config, p_patch) where id = w.id returning * into w;

  -- Si ya está publicada, se publica el cambio sobre la versión publicada (no sobre el borrador de Luis).
  if w.published_version_id is not null and w.status in ('publicada', 'archivada') then
    select * into v from public.wedding_versions where id = w.published_version_id;
    new_published := app.couple_patch(v.config, p_patch);
    if new_published is distinct from v.config then
      select coalesce(max(version), 0) + 1 into n from public.wedding_versions where wedding_id = w.id;
      insert into public.wedding_versions (wedding_id, version, template, config, note, published_by)
      values (w.id, n, v.template, new_published, 'Cambiado por la pareja: ' || array_to_string(changed, ', '), app.staff_id())
      returning * into v;
      update public.weddings set published_version_id = v.id, published_at = now() where id = w.id returning * into w;
    end if;
  end if;

  label := case when app.is_staff() then 'Datos prácticos cambiados desde el panel de la pareja: ' else 'La pareja ha cambiado: ' end;
  perform app.log_activity('boda', label || array_to_string(changed, ', '), null, '{}'::jsonb, null, w.client_id, w.id);
  return jsonb_build_object('ok', true, 'updated_at', w.updated_at, 'published', v.id is not null, 'version', v.version);
end $$;

create or replace function public.pareja_avisos(p_digest text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_digest not in ('nunca', 'diario', 'semanal') then raise exception 'Opción no válida.'; end if;
  update public.couple_users set digest = p_digest where user_id = auth.uid();
end $$;

-- ── Web pública: enlace personal de cada grupo ────────────────

drop function public.api_public_wedding(text, text, text);
create function public.api_public_wedding(p_slug text, p_preview_token text default null, p_host text default null, p_invite text default null)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  w public.weddings;
  v public.wedding_versions;
  g public.guest_groups;
  out jsonb;
  inv jsonb := null;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  if p_host is not null then
    select * into w from public.weddings where custom_domain = lower(p_host);
  end if;
  if w.id is null then
    select * into w from public.weddings where slug = lower(coalesce(p_slug, ''));
  end if;
  if w.id is null then return null; end if;

  if p_preview_token is not null then
    if length(p_preview_token) < 20 or p_preview_token is distinct from w.preview_token then return null; end if;
    out := jsonb_build_object('id', w.id, 'slug', w.slug, 'status', w.status, 'template', w.template,
      'config', w.config, 'version', null, 'draft', true, 'updated_at', w.updated_at);
  elsif w.status = 'retirada' then
    return jsonb_build_object('slug', w.slug, 'status', 'retirada');
  elsif w.status not in ('publicada', 'archivada') or w.published_version_id is null then
    return null;
  else
    select * into v from public.wedding_versions where id = w.published_version_id;
    out := jsonb_build_object('id', w.id, 'slug', w.slug, 'status', w.status, 'template', v.template,
      'config', v.config, 'version', v.version, 'draft', false, 'updated_at', v.created_at);
  end if;

  if p_invite is not null and length(p_invite) >= 24 then
    select * into g from public.guest_groups where token = p_invite and wedding_id = w.id and token_revoked_at is null;
    if g.id is not null then
      inv := jsonb_build_object(
        'token', g.token, 'name', g.name, 'seats', g.seats, 'children_seats', g.children_seats,
        'guests', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', btrim(x.first_name || ' ' || coalesce(x.last_name, '')), 'child', x.is_child)
                                              order by x.is_child, x.created_at), '[]'::jsonb)
                   from public.guests x where x.group_id = g.id),
        'answer', (select jsonb_build_object('attending', r.attending, 'adults', r.adults, 'children', r.children,
                                             'guests', r.companions, 'dietary', r.dietary, 'bus', r.bus, 'song', r.song,
                                             'message', r.message, 'at', r.created_at)
                   from public.rsvp_responses r where r.group_id = g.id order by r.created_at desc limit 1));
    end if;
  end if;
  return out || jsonb_build_object('features', app.wedding_features(w.id), 'invite', inv,
                                   'invite_invalid', p_invite is not null and inv is null);
end $$;
revoke execute on function public.api_public_wedding(text, text, text, text) from public, anon, authenticated;
grant execute on function public.api_public_wedding(text, text, text, text) to service_role;

-- ── RSVP sencillo y ampliado ──────────────────────────────────

create or replace function public.api_submit_rsvp(p_slug text, p_payload jsonb, p_ip_hash text default null, p_user_agent text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  w public.weddings;
  cfg jsonb;
  deadline date;
  today date := (now() at time zone 'Europe/Madrid')::date;
  nm text := btrim(regexp_replace(coalesce(p_payload ->> 'name', ''), '\s+', ' ', 'g'));
  att text := coalesce(p_payload ->> 'attending', '');
  song text := nullif(left(btrim(coalesce(p_payload ->> 'song', '')), 300), '');
  ext boolean;
  grp public.guest_groups;
  n_adults integer;
  n_children integer;
  comp jsonb := '[]'::jsonb;
  gx record;
  sent jsonb;
  diet text := nullif(left(btrim(coalesce(p_payload ->> 'dietary', '')), 500), '');
  msg text := nullif(left(btrim(coalesce(p_payload ->> 'message', '')), 1000), '');
  bus boolean := null;
  safe_int integer;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  select * into w from public.weddings where slug = lower(coalesce(p_slug, ''));
  if w.id is null or w.status not in ('publicada', 'archivada') or w.published_version_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_existe');
  end if;
  select v.config into cfg from public.wedding_versions v where v.id = w.published_version_id;
  if not coalesce(cfg -> 'sections' ? 'rsvp', false) then
    return jsonb_build_object('ok', false, 'error', 'sin_rsvp');
  end if;
  begin
    deadline := nullif(cfg #>> '{rsvp,deadline}', '')::date;
  exception when others then deadline := null;
  end;
  -- Un día de margen por las zonas horarias de los invitados (la web cierra el formulario sola).
  if (deadline is not null and today > deadline + 1) or (w.wedding_date is not null and today > w.wedding_date) then
    return jsonb_build_object('ok', false, 'error', 'cerrado');
  end if;
  if att not in ('si', 'no') then return jsonb_build_object('ok', false, 'error', 'asistencia'); end if;
  ext := coalesce((app.wedding_features(w.id) ->> 'rsvp_ampliado')::boolean, false);

  if not ext then
    -- RSVP sencillo de siempre: nombre, asistencia y canción.
    if length(nm) < 2 or length(nm) > 120 then return jsonb_build_object('ok', false, 'error', 'nombre'); end if;
    insert into public.rsvp_responses (wedding_id, name, attending, song, payload, source, ip_hash, user_agent)
    values (w.id, nm, att = 'si', song, jsonb_strip_nulls(jsonb_build_object('sentAt', left(p_payload ->> 'sentAt', 40))), 'web', p_ip_hash, left(p_user_agent, 300));
    return jsonb_build_object('ok', true, 'sheet', w.rsvp_sheet_endpoint);
  end if;

  if coalesce((cfg #>> '{rsvp,bus}')::boolean, false) then
    bus := case p_payload ->> 'bus' when 'si' then true when 'no' then false end;
  end if;
  if not coalesce((cfg #>> '{rsvp,dietary}')::boolean, true) then diet := null; end if;

  if coalesce(p_payload ->> 'invite', '') <> '' then
    select * into grp from public.guest_groups
     where token = p_payload ->> 'invite' and wedding_id = w.id and token_revoked_at is null;
    if grp.id is null then return jsonb_build_object('ok', false, 'error', 'invitacion'); end if;
    nm := grp.name;
    if exists (select 1 from public.guests where group_id = grp.id) then
      -- Uno a uno: quién viene y sus alergias. Los nombres salen de la lista, no del formulario.
      n_adults := 0; n_children := 0;
      for gx in select * from public.guests where group_id = grp.id order by is_child, created_at loop
        select e into sent from jsonb_array_elements(coalesce(p_payload -> 'guests', '[]'::jsonb)) e where e ->> 'id' = gx.id::text limit 1;
        comp := comp || jsonb_build_object(
          'id', gx.id, 'name', btrim(gx.first_name || ' ' || coalesce(gx.last_name, '')), 'child', gx.is_child,
          'attending', att = 'si' and coalesce((sent ->> 'attending')::boolean, false),
          'dietary', case when coalesce((cfg #>> '{rsvp,dietary}')::boolean, true)
                          then nullif(left(btrim(coalesce(sent ->> 'dietary', '')), 300), '') end);
        if att = 'si' and coalesce((sent ->> 'attending')::boolean, false) then
          if gx.is_child then n_children := n_children + 1; else n_adults := n_adults + 1; end if;
        end if;
      end loop;
    else
      begin safe_int := (p_payload ->> 'adults')::int; exception when others then safe_int := null; end;
      n_adults := coalesce(safe_int, 0);
      begin safe_int := (p_payload ->> 'children')::int; exception when others then safe_int := null; end;
      n_children := coalesce(safe_int, 0);
      if att = 'no' then n_adults := 0; n_children := 0; end if;
      if n_adults < 0 or n_children < 0 or n_adults + n_children > grp.seats then
        return jsonb_build_object('ok', false, 'error', 'plazas', 'seats', grp.seats);
      end if;
    end if;
  else
    if length(nm) < 2 or length(nm) > 120 then return jsonb_build_object('ok', false, 'error', 'nombre'); end if;
    begin safe_int := (p_payload ->> 'adults')::int; exception when others then safe_int := null; end;
    n_adults := coalesce(safe_int, 1);
    begin safe_int := (p_payload ->> 'children')::int; exception when others then safe_int := null; end;
    n_children := coalesce(safe_int, 0);
    if att = 'no' then n_adults := 0; n_children := 0; end if;
    if n_adults < 0 or n_children < 0 or n_adults > 10 or n_children > 10 then
      return jsonb_build_object('ok', false, 'error', 'plazas', 'seats', 10);
    end if;
  end if;
  if att = 'si' and n_adults + n_children = 0 then return jsonb_build_object('ok', false, 'error', 'nadie'); end if;

  insert into public.rsvp_responses (wedding_id, group_id, name, attending, adults, children, companions, dietary, bus,
                                     song, message, payload, source, ip_hash, user_agent)
  values (w.id, grp.id, nm, att = 'si', n_adults, n_children, comp, diet, bus, song, msg,
          jsonb_strip_nulls(jsonb_build_object('sentAt', left(p_payload ->> 'sentAt', 40))), 'web', p_ip_hash, left(p_user_agent, 300));
  return jsonb_build_object('ok', true, 'sheet', w.rsvp_sheet_endpoint, 'name', nm, 'adults', n_adults, 'children', n_children);
end $$;

-- ── Para las funciones del servidor ───────────────────────────

-- ¿Este email es de una pareja con una boda activa? (para el email de acceso)
create or replace function public.api_couple_access(p_email text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c record;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  select cu.id, cu.email, cu.name, cu.user_id, w.config #> '{event,couple}' as couple
    into c
    from public.couple_users cu join public.weddings w on w.id = cu.wedding_id
   where lower(cu.email) = lower(btrim(p_email)) and w.status <> 'retirada'
   order by w.wedding_date nulls last limit 1;
  if c.id is null then return null; end if;
  update public.couple_users set last_link_at = now() where lower(email) = lower(btrim(p_email));
  return jsonb_build_object('email', c.email, 'name', c.name, 'user_id', c.user_id, 'couple', c.couple);
end $$;

-- Grupos que aún no han contestado, con su email (recordatorio por email), y los datos de la boda.
create or replace function public.api_pending_groups(p_wedding_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'slug', w.slug, 'status', w.status, 'couple', w.config #> '{event,couple}', 'deadline', w.config #>> '{rsvp,deadline}',
    'groups', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'email', g.email, 'token', g.token)
                                         order by g.sort, g.name), '[]'::jsonb)
               from public.guest_groups g
               where g.wedding_id = w.id and g.token_revoked_at is null
                 and not exists (select 1 from public.rsvp_responses r where r.group_id = g.id)))
  from public.weddings w
  where w.id = p_wedding_id and app.is_service()
$$;

create or replace function public.puedo_gestionar_boda(p_wedding_id uuid) returns boolean
language sql stable as $$ select app.can_manage_wedding(p_wedding_id) $$;

create or replace function public.soy_del_equipo() returns boolean
language sql stable as $$ select app.is_staff() $$;

-- Resúmenes de respuestas que tocan ahora (diario, o semanal los lunes), con lo nuevo desde el último.
create or replace function public.api_digests_due() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  monday boolean := extract(isodow from now() at time zone 'Europe/Madrid') = 1;
  out jsonb;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into out from (
    select jsonb_build_object(
      'couple_user_id', cu.id, 'email', cu.email, 'name', cu.name, 'digest', cu.digest,
      'wedding_id', w.id, 'slug', w.slug, 'couple', w.config #> '{event,couple}',
      'stats', app.rsvp_stats(w.id),
      'nuevas', (select coalesce(jsonb_agg(jsonb_build_object('name', r.name, 'attending', r.attending,
                     'adults', r.adults, 'children', r.children, 'at', r.created_at) order by r.created_at), '[]'::jsonb)
                 from public.rsvp_responses r
                 where r.wedding_id = w.id and r.created_at > coalesce(cu.last_digest_at, cu.created_at))) as x
    from public.couple_users cu join public.weddings w on w.id = cu.wedding_id
    where cu.digest <> 'nunca' and w.status = 'publicada'
      and (w.wedding_date is null or w.wedding_date >= (now() at time zone 'Europe/Madrid')::date - 1)
      and ((cu.digest = 'diario' and (cu.last_digest_at is null or cu.last_digest_at < now() - interval '20 hours'))
        or (cu.digest = 'semanal' and monday and (cu.last_digest_at is null or cu.last_digest_at < now() - interval '6 days')))
      and exists (select 1 from public.rsvp_responses r where r.wedding_id = w.id and r.created_at > coalesce(cu.last_digest_at, cu.created_at))
  ) t;
  return out;
end $$;

create or replace function public.api_digest_sent(p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  update public.couple_users set last_digest_at = now() where id = any (p_ids);
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.api_couple_access(text)', 'public.api_pending_groups(uuid)', 'public.api_digests_due()', 'public.api_digest_sent(uuid[])'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
  foreach f in array array['public.pareja_resumen(uuid)', 'public.pareja_guardar(uuid, jsonb, timestamptz)', 'public.pareja_avisos(text)',
                           'public.puedo_gestionar_boda(uuid)', 'public.soy_del_equipo()'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

-- ════════════════ 20261026000100_cobros.sql ════════════════

-- WeddingWebs · Fase 4 · Cobros, facturas desde los pedidos, seguimiento sin contraseña,
-- propuestas a la pareja y peticiones de cambio.
--
-- Si ya instalaste la base de datos antes de la fase 4: pega SOLO este archivo en el editor SQL.
--
--   · Cada pedido tiene un código de seguimiento (K7M3-Q9TX). Con él, la pareja ve su pedido,
--     sus propuestas, pide cambios, aprueba y paga, sin cuenta ni contraseña.
--   · Pagos (Stripe, Bizum, transferencia…) entran por app.apply_payment: un solo sitio que marca
--     el pedido como pagado, fija la entrega en días laborables, crea la tarea y emite la factura.
--   · Devoluciones: factura rectificativa por la diferencia (también parcial).
--   · La pareja nunca lee estas tablas: todo pasa por funciones api_* que solo llama el servidor.

-- ── Tarifas: rondas de cambios y pago en el escaparate ────────

alter table public.products
  add column revision_rounds integer check (revision_rounds between 0 and 20),
  add column online_checkout boolean not null default false,
  add constraint products_checkout_price check (not (online_checkout and price_is_from));
comment on column public.products.revision_rounds is 'Rondas de cambios de diseño incluidas. Vacío = las que se acuerden (sin contador). Corregir erratas y datos siempre está incluido y no cuenta.';
comment on column public.products.online_checkout is 'Se puede pagar al momento desde el escaparate. Nunca en precios «desde».';

-- Lo que ya dicen las condiciones de contratación: ninguno en Tal cual, los acordados en Con
-- cambios y hasta 3 rondas en A medida.
update public.products set revision_rounds = 0, online_checkout = true where code = 'tal-cual';
update public.products set revision_rounds = null, online_checkout = true where code = 'con-cambios';
update public.products set revision_rounds = 3, online_checkout = false where code = 'a-medida';

-- ── Pedidos: código de seguimiento y datos del pago ───────────

alter table public.orders
  add column tracking_code text unique check (tracking_code ~ '^[2-9A-HJKMNP-Z]{8}$'),
  add column source text not null default 'panel' check (source in ('panel', 'escaparate')),
  add column checkout_session_id text,
  add column checkout_url text,
  add column checkout_expires_at timestamptz,
  add column start_now_at timestamptz,
  add column start_now_text text,
  add column approved_at timestamptz;
comment on column public.orders.tracking_code is 'Código de la página de seguimiento (/seguimiento/K7M3-Q9TX). Sin 0, O, 1, I ni L, para dictarlo sin errores.';
comment on column public.orders.start_now_at is 'Cuándo pidió la pareja que empezáramos ya (pierde el desistimiento al entregar la web; art. 103 TRLGDCU).';

-- 8 caracteres de 31 posibles: 850.000 millones de códigos. Con el límite de intentos por IP,
-- imposible de adivinar.
create or replace function app.tracking_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  b bytea;
  s text;
  v integer;
begin
  loop
    s := '';
    b := extensions.gen_random_bytes(24);
    for i in 0..23 loop
      v := get_byte(b, i);
      continue when v >= 248; -- 248 = 31 × 8: así todas las letras salen igual de a menudo
      s := s || substr(alphabet, v % 31 + 1, 1);
      exit when length(s) = 8;
    end loop;
    continue when length(s) < 8;
    exit when not exists (select 1 from public.orders where tracking_code = s);
  end loop;
  return s;
end $$;

create or replace function app.norm_code(p text) returns text
language sql immutable as $$ select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g')) $$;

create or replace function app.orders_tracking() returns trigger
language plpgsql as $$
begin
  if new.tracking_code is null then new.tracking_code := app.tracking_code(); end if;
  return new;
end $$;
create trigger orders_tracking before insert on public.orders
  for each row execute function app.orders_tracking();
update public.orders set tracking_code = app.tracking_code() where tracking_code is null;

-- Días laborables (lunes a viernes, sin los festivos nacionales de fecha fija).
create or replace function app.business_days_after(p_from date, p_days integer) returns date
language plpgsql immutable as $$
declare
  d date := p_from;
  n integer := 0;
begin
  while n < greatest(coalesce(p_days, 0), 0) loop
    d := d + 1;
    if extract(isodow from d) < 6
       and to_char(d, 'MM-DD') not in ('01-01', '01-06', '05-01', '08-15', '10-12', '11-01', '12-06', '12-08', '12-25') then
      n := n + 1;
    end if;
  end loop;
  return d;
end $$;

create or replace function app.eur(p_cents integer) returns text
language sql immutable as $$ select replace(app.money(p_cents), '.', ',') || ' €' $$;

-- Nombres de los estados de pedido en la línea de tiempo.
create or replace function app.status_label(p text) returns text
language sql immutable as $$
  select case p
    when 'nuevo' then 'Nuevo' when 'contactado' then 'Contactado' when 'propuesta' then 'Propuesta'
    when 'esperando_pago' then 'Esperando pago' when 'ganado' then 'Ganado' when 'perdido' then 'Perdido'
    when 'borrador' then 'Borrador' when 'vista_previa' then 'Vista previa' when 'publicada' then 'Publicada'
    when 'archivada' then 'Archivada' when 'retirada' then 'Retirada'
    when 'pendiente_pago' then 'Pendiente de pago' when 'pagado' then 'Pagado' when 'en_produccion' then 'En producción'
    when 'entregado' then 'Entregado' when 'cancelado' then 'Cancelado' when 'reembolsado' then 'Reembolsado'
    else p end
$$;

create or replace function app.orders_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    perform app.log_activity('estado',
      'Pedido ' || new.number || ': ' || app.status_label(old.status) || ' → ' || app.status_label(new.status),
      null, jsonb_build_object('de', old.status, 'a', new.status), new.lead_id, new.client_id, new.wedding_id, new.id);
  end if;
  return null;
end $$;
create trigger orders_activity after update of status on public.orders
  for each row execute function app.orders_activity();

-- Al enlazar un pedido con su boda, el email del cliente recibe acceso al panel de la pareja.
create or replace function app.orders_couple_access() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  c public.clients;
begin
  if new.wedding_id is null or (tg_op = 'UPDATE' and new.wedding_id is not distinct from old.wedding_id) then return null; end if;
  select * into c from public.clients where id = new.client_id;
  if c.email ~ '^\S+@\S+\.\S+$' and c.anonymized_at is null then
    insert into public.couple_users (wedding_id, email, name)
    values (new.wedding_id, lower(c.email), c.display_name)
    on conflict (wedding_id, (lower(email))) do nothing;
  end if;
  return null;
end $$;
create trigger orders_couple_access after insert or update of wedding_id on public.orders
  for each row execute function app.orders_couple_access();

-- Publicar la web es entregar el pedido.
create or replace function app.weddings_deliver_orders() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'publicada' and old.status is distinct from 'publicada' then
    update public.orders set status = 'entregado', delivered_at = coalesce(delivered_at, now())
     where wedding_id = new.id and status in ('pagado', 'en_produccion');
    perform app.close_auto_task('publicar:' || o.id) from public.orders o where o.wedding_id = new.id;
    perform app.close_auto_task('preparar:' || o.id) from public.orders o where o.wedding_id = new.id;
  end if;
  return null;
end $$;

-- ── Tareas automáticas (una por motivo y pedido; se cierran solas) ──

alter table public.tasks add column auto_key text;
create unique index tasks_auto_key_open on public.tasks (auto_key) where status = 'pendiente';
comment on column public.tasks.auto_key is 'Tareas que crea el sistema (preparar:<pedido>, cambios:<pedido>…). Una abierta por clave; se cierran solas al hacerse.';

create or replace function app.auto_task(p_key text, p_title text, p_notes text, p_due timestamptz,
  p_lead uuid default null, p_client uuid default null, p_wedding uuid default null, p_order uuid default null)
returns void
language sql security definer set search_path = '' as $$
  insert into public.tasks (auto_key, title, notes, due_at, lead_id, client_id, wedding_id, order_id)
  values (p_key, left(p_title, 300), p_notes, p_due, p_lead, p_client, p_wedding, p_order)
  on conflict (auto_key) where status = 'pendiente'
  do update set title = excluded.title, notes = excluded.notes,
                due_at = least(public.tasks.due_at, excluded.due_at)
$$;

create or replace function app.close_auto_task(p_key text) returns void
language sql security definer set search_path = '' as $$
  update public.tasks set status = 'hecha' where auto_key = p_key and status = 'pendiente'
$$;

create trigger weddings_deliver_orders after update of status on public.weddings
  for each row execute function app.weddings_deliver_orders();

-- ── Propuestas que ve la pareja y cambios que pide ────────────

create table public.wedding_proposals (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  number integer not null check (number > 0),
  template text not null,
  config jsonb not null,
  note text,
  sent_by uuid references public.staff(id) on delete set null,
  sent_at timestamptz not null default now(),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (wedding_id, number)
);
create trigger wedding_proposals_updated_at before update on public.wedding_proposals
  for each row execute function app.set_updated_at();
comment on table public.wedding_proposals is 'Foto fija del borrador que Luis manda a la pareja («Propuesta 1, 2…»). La pareja la ve en su página de seguimiento.';

create table public.change_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  wedding_id uuid references public.weddings(id) on delete set null,
  proposal_id uuid references public.wedding_proposals(id) on delete set null,
  kind text not null check (kind in ('correccion', 'cambio')),
  message text not null check (length(btrim(message)) between 1 and 4000),
  status text not null default 'pendiente' check (status in ('pendiente', 'hecho', 'descartado')),
  source text not null default 'pareja' check (source in ('pareja', 'equipo')),
  reply text,
  resolved_at timestamptz,
  resolved_by uuid references public.staff(id) on delete set null,
  resolved_in_proposal_id uuid references public.wedding_proposals(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index change_requests_order_idx on public.change_requests (order_id, created_at);
create index change_requests_open_idx on public.change_requests (created_at) where status = 'pendiente';
create trigger change_requests_updated_at before update on public.change_requests
  for each row execute function app.set_updated_at();
comment on column public.change_requests.kind is 'correccion: erratas y datos (siempre incluido). cambio: de diseño (cuenta como ronda).';

alter table public.wedding_proposals enable row level security;
alter table public.change_requests enable row level security;
revoke all on public.wedding_proposals from anon;
revoke all on public.change_requests from anon;
create policy wedding_proposals_select on public.wedding_proposals for select to authenticated using (app.is_staff());
create policy wedding_proposals_update on public.wedding_proposals for update to authenticated using (app.is_staff()) with check (app.is_staff());
create policy wedding_proposals_delete on public.wedding_proposals for delete to authenticated using (app.is_admin());
create policy change_requests_select on public.change_requests for select to authenticated using (app.is_staff());
create policy change_requests_insert on public.change_requests for insert to authenticated with check (app.is_staff());
create policy change_requests_update on public.change_requests for update to authenticated using (app.is_staff()) with check (app.is_staff());
create policy change_requests_delete on public.change_requests for delete to authenticated using (app.is_admin());

-- Consentimiento de empezar ya (pierde el desistimiento al entregar).
alter table public.consents drop constraint if exists consents_purpose_check;
alter table public.consents add constraint consents_purpose_check check (purpose in (
  'contacto_comercial', 'cookies_publicidad', 'cookies_analitica', 'tratamiento_invitados', 'inicio_inmediato'));

-- ── Facturas desde un pedido ──────────────────────────────────

-- Igual que antes, salvo una cosa: la rectificativa de una factura simplificada (R5) no necesita
-- el NIF del cliente, como la original.
create or replace function public.issue_invoice(p_invoice_id uuid) returns public.invoices
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invoices;
  seller jsonb := coalesce(app.setting('vendedor'), '{}'::jsonb);
  y integer := extract(year from now() at time zone 'Europe/Madrid')::int;
  s public.invoice_series;
  n integer;
  needs_recipient boolean;
begin
  if not (app.is_admin() or app.is_service()) then
    raise exception 'Solo el dueño o un administrador pueden emitir facturas.' using errcode = '42501';
  end if;
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'Factura no encontrada.'; end if;
  if inv.status <> 'borrador' then raise exception 'La factura % ya está emitida.', inv.full_number; end if;
  if coalesce(seller ->> 'nombre', '') = '' or coalesce(seller ->> 'nif', '') = '' or coalesce(seller ->> 'direccion', '') = '' then
    raise exception 'Faltan los datos fiscales de WeddingWebs (nombre, NIF y dirección). Rellénalos en Ajustes antes de facturar.'
      using hint = 'faltan_datos_vendedor';
  end if;
  if not exists (select 1 from public.invoice_lines where invoice_id = inv.id) then
    raise exception 'La factura no tiene líneas.';
  end if;
  needs_recipient := inv.kind = 'ordinaria' or (inv.kind = 'rectificativa' and coalesce(
    (select o.kind from public.invoices o where o.id = inv.corrects_invoice_id), 'ordinaria') <> 'simplificada');
  if needs_recipient and (coalesce(inv.recipient ->> 'nombre', '') = '' or coalesce(inv.recipient ->> 'nif', '') = '') then
    raise exception 'Una factura completa necesita el nombre y el NIF/NIE del cliente.';
  end if;

  insert into public.invoice_series (code, year, kind) values (inv.series_code, y, inv.kind)
  on conflict (code, year) do nothing;
  select * into s from public.invoice_series where code = inv.series_code and year = y for update;
  if s.kind <> inv.kind then
    raise exception 'La serie % es de facturas de tipo %; esta factura es %.', s.code, s.kind, inv.kind;
  end if;
  n := s.next_number;
  update public.invoice_series set next_number = n + 1 where id = s.id;

  update public.invoices set
    series_id = s.id,
    number = n,
    full_number = s.code || '-' || y || '-' || lpad(n::text, 4, '0'),
    status = 'emitida',
    issued_at = now(),
    operation_date = coalesce(operation_date, (now() at time zone 'Europe/Madrid')::date),
    issuer = seller
  where id = inv.id
  returning * into inv;

  perform app.append_invoicing_record(inv, 'alta');
  return inv;
end $$;

-- Simplificada (sin datos del cliente) si no ha pedido factura a su nombre y no pasa de 400 €;
-- si no, completa (necesita nombre, NIF y dirección del cliente).
create or replace function app.order_invoice_draft(p_order_id uuid) returns public.invoices
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  c public.clients;
  inv public.invoices;
  full_data boolean;
  k text;
begin
  select * into o from public.orders where id = p_order_id;
  if o.id is null then raise exception 'Pedido no encontrado.'; end if;
  select * into inv from public.invoices
   where order_id = o.id and kind <> 'rectificativa' and status in ('borrador', 'emitida')
   order by created_at desc limit 1;
  if inv.id is not null then return inv; end if;
  if not exists (select 1 from public.order_lines where order_id = o.id) then
    raise exception 'El pedido % no tiene líneas.', o.number;
  end if;
  select * into c from public.clients where id = o.client_id;
  full_data := coalesce(c.tax_id, '') <> '' and coalesce(c.billing_address, '') <> '';
  k := case when full_data or o.total_cents > 40000 then 'ordinaria' else 'simplificada' end;
  insert into public.invoices (series_code, kind, client_id, order_id, recipient, operation_date, language)
  values (case k when 'ordinaria' then 'WW' else 'WS' end, k, o.client_id, o.id,
          case when c.id is null then '{}'::jsonb else jsonb_strip_nulls(jsonb_build_object(
            'nombre', coalesce(nullif(btrim(c.billing_name), ''), c.display_name),
            'nif', nullif(upper(c.tax_id), ''), 'direccion', nullif(c.billing_address, ''),
            'codigo_postal', nullif(c.postal_code, ''), 'ciudad', nullif(c.city, ''),
            'provincia', nullif(c.province, ''), 'pais', c.country, 'email', c.email)) end,
          coalesce((o.paid_at at time zone 'Europe/Madrid')::date, (now() at time zone 'Europe/Madrid')::date),
          case when c.language = 'en' then 'en' else 'es' end)
  returning * into inv;
  insert into public.invoice_lines (invoice_id, position, description, quantity, unit_total_cents, vat_rate_bp)
  select inv.id, l.position, l.description, l.quantity, l.unit_price_cents, l.vat_rate_bp
  from public.order_lines l where l.order_id = o.id order by l.position, l.created_at;
  select * into inv from public.invoices where id = inv.id;
  return inv;
end $$;

-- Emite sin romper lo de alrededor: si falla (faltan datos fiscales…), devuelve el motivo.
create or replace function app.try_issue(p_invoice_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invoices;
begin
  begin
    inv := public.issue_invoice(p_invoice_id);
    return jsonb_build_object('ok', true, 'id', inv.id, 'number', inv.full_number, 'kind', inv.kind, 'total_cents', inv.total_cents);
  exception when others then
    return jsonb_build_object('ok', false, 'id', p_invoice_id, 'error', sqlerrm);
  end;
end $$;

-- Panel: hacer (o rehacer el intento de) la factura de un pedido pagado.
create or replace function public.invoice_order(p_order_id uuid) returns public.invoices
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invoices;
  o public.orders;
begin
  if not (app.is_admin() or app.is_service()) then
    raise exception 'Solo el dueño o un administrador pueden facturar.' using errcode = '42501';
  end if;
  select * into o from public.orders where id = p_order_id;
  if o.id is null then raise exception 'Pedido no encontrado.'; end if;
  if o.paid_cents <= 0 then raise exception 'El pedido % aún no tiene pagos.', o.number; end if;
  inv := app.order_invoice_draft(p_order_id);
  if inv.status = 'borrador' then
    -- Si el cliente ha completado sus datos desde el borrador, se actualizan antes de emitir.
    update public.invoices i set recipient = coalesce((
        select jsonb_strip_nulls(jsonb_build_object(
          'nombre', coalesce(nullif(btrim(c.billing_name), ''), c.display_name), 'nif', nullif(upper(c.tax_id), ''),
          'direccion', nullif(c.billing_address, ''), 'codigo_postal', nullif(c.postal_code, ''), 'ciudad', nullif(c.city, ''),
          'provincia', nullif(c.province, ''), 'pais', c.country, 'email', c.email))
        from public.clients c where c.id = o.client_id), i.recipient),
      kind = case when i.kind = 'simplificada' and exists (
                    select 1 from public.clients c where c.id = o.client_id
                      and coalesce(c.tax_id, '') <> '' and coalesce(c.billing_address, '') <> '')
                  then 'ordinaria' else i.kind end
     where i.id = inv.id;
    update public.invoices set series_code = case kind when 'ordinaria' then 'WW' else 'WS' end where id = inv.id;
    inv := public.issue_invoice(inv.id);
    perform app.close_auto_task('factura:' || o.id);
  end if;
  return inv;
end $$;

-- Rectificativa por un importe (devolución parcial). Sin importe, o por todo lo que queda: todas
-- las líneas en negativo.
create or replace function public.create_corrective_invoice(p_invoice_id uuid, p_reason text, p_amount_cents integer)
returns public.invoices
language plpgsql security definer set search_path = '' as $$
declare
  orig public.invoices;
  inv public.invoices;
  prev integer;
  remaining integer;
begin
  if not (app.is_admin() or app.is_service()) then
    raise exception 'Solo el dueño o un administrador pueden rectificar facturas.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'Indica el motivo de la rectificación.'; end if;
  select * into orig from public.invoices where id = p_invoice_id;
  if not found or orig.status <> 'emitida' or orig.kind = 'rectificativa' then
    raise exception 'Solo se puede rectificar una factura emitida.';
  end if;
  select coalesce(sum(total_cents), 0) into prev from public.invoices
   where corrects_invoice_id = orig.id and status = 'emitida';
  remaining := orig.total_cents + prev; -- las rectificativas van en negativo
  if remaining <= 0 then raise exception 'La factura % ya está rectificada por completo.', orig.full_number; end if;
  if p_amount_cents is null or (p_amount_cents >= remaining and prev = 0) then
    return public.create_corrective_invoice(orig.id, p_reason);
  end if;
  if p_amount_cents <= 0 or p_amount_cents > remaining then
    raise exception 'El importe (%) no puede ser mayor que lo que queda por rectificar de la factura % (%).',
      app.eur(p_amount_cents), orig.full_number, app.eur(remaining);
  end if;
  insert into public.invoices (series_code, kind, client_id, order_id, corrects_invoice_id, correction_reason,
                               recipient, language, currency, operation_date)
  values ('R', 'rectificativa', orig.client_id, orig.order_id, orig.id, p_reason,
          orig.recipient, orig.language, orig.currency, (now() at time zone 'Europe/Madrid')::date)
  returning * into inv;
  insert into public.invoice_lines (invoice_id, position, description, quantity, unit_total_cents, vat_rate_bp)
  select inv.id, 0, 'Devolución: ' || l.description, -1, p_amount_cents, l.vat_rate_bp
  from public.invoice_lines l where l.invoice_id = orig.id order by l.position limit 1;
  select * into inv from public.invoices where id = inv.id;
  return inv;
end $$;

-- ── Pagos y devoluciones (un solo camino para Stripe y para lo que apunta Luis) ──

create or replace function app.order_names(o public.orders) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select nullif(array_to_string(array(select jsonb_array_elements_text(w.config #> '{event,couple}')), ' y '), '')
       from public.weddings w where w.id = o.wedding_id),
    (select c.display_name from public.clients c where c.id = o.client_id),
    (select nullif(l.names, '') from public.leads l where l.id = o.lead_id),
    o.number)
$$;

create or replace function app.apply_payment(p_order_id uuid, p_provider text, p_external_id text, p_amount_cents integer,
  p_paid_at timestamptz default null, p_raw jsonb default null, p_notes text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  c public.clients;
  before_paid integer;
  now_paid integer;
  became_paid boolean := false;
  repeated boolean;
  days integer := coalesce((app.setting('plazos') ->> 'entrega_dias')::int, 3);
  today date := (now() at time zone 'Europe/Madrid')::date;
  inv public.invoices;
  issued jsonb := null;
  nm text;
  how text := case p_provider when 'stripe' then 'con tarjeta o Bizum (Stripe)' when 'bizum' then 'por Bizum'
                when 'transferencia' then 'por transferencia' when 'efectivo' then 'en efectivo' else '' end;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then return jsonb_build_object('ok', false, 'error', 'importe'); end if;
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then return jsonb_build_object('ok', false, 'error', 'pedido'); end if;
  if p_external_id is not null and exists (
       select 1 from public.payments where provider = p_provider and external_id = p_external_id) then
    return jsonb_build_object('ok', true, 'repetido', true, 'order_id', o.id);
  end if;
  nm := app.order_names(o);
  before_paid := o.paid_cents;
  repeated := o.total_cents > 0 and before_paid >= o.total_cents;

  insert into public.payments (order_id, provider, external_id, amount_cents, status, paid_at, raw, notes)
  values (o.id, p_provider, p_external_id, p_amount_cents, 'pagado', coalesce(p_paid_at, now()), p_raw, p_notes);
  select coalesce(sum(amount_cents - refunded_cents), 0) into now_paid
    from public.payments where order_id = o.id and status in ('pagado', 'reembolso_parcial');
  became_paid := now_paid >= o.total_cents and o.status in ('borrador', 'pendiente_pago');

  update public.orders set
    paid_cents = now_paid,
    status = case when became_paid then 'pagado' else status end,
    paid_at = case when became_paid then coalesce(paid_at, now()) else paid_at end,
    promised_delivery_at = case when became_paid then coalesce(promised_delivery_at, app.business_days_after(today, days))
                                else promised_delivery_at end
  where id = o.id returning * into o;

  perform app.log_activity('pago', 'Pago de ' || app.eur(p_amount_cents) || ' ' || how, p_notes,
    jsonb_build_object('proveedor', p_provider, 'referencia', p_external_id), o.lead_id, o.client_id, o.wedding_id, o.id);

  if repeated or o.status in ('cancelado', 'reembolsado') then
    perform app.auto_task('repetido:' || o.id, 'Revisa un pago de más en el pedido ' || o.number || ' (' || nm || ')',
      'Ha llegado un pago de ' || app.eur(p_amount_cents) || ' y el pedido ya estaba pagado o cancelado. Si es un error, devuélvelo.',
      now(), o.lead_id, o.client_id, o.wedding_id, o.id);
  end if;

  if became_paid then
    update public.leads set status = 'ganado', client_id = coalesce(client_id, o.client_id)
     where id = o.lead_id and status <> 'ganado';
    perform app.auto_task('preparar:' || o.id,
      'Preparar la web de ' || nm || ' (entrega el ' || to_char(o.promised_delivery_at, 'DD/MM') || ')',
      case when o.wedding_id is null then 'Créala desde la ficha del cliente («Crear su web»): ya lleva lo que probaron en el escaparate.' end,
      (o.promised_delivery_at + time '10:00') at time zone 'Europe/Madrid', o.lead_id, o.client_id, o.wedding_id, o.id);
    inv := app.order_invoice_draft(o.id);
    if inv.status = 'borrador' then
      issued := app.try_issue(inv.id);
      if not (issued ->> 'ok')::boolean then
        perform app.auto_task('factura:' || o.id, 'Hacer la factura del pedido ' || o.number || ' (' || nm || ')',
          issued ->> 'error', now(), o.lead_id, o.client_id, o.wedding_id, o.id);
      end if;
    else
      issued := jsonb_build_object('ok', true, 'id', inv.id, 'number', inv.full_number, 'kind', inv.kind, 'total_cents', inv.total_cents);
    end if;
  end if;

  select * into c from public.clients where id = o.client_id;
  return jsonb_build_object('ok', true, 'order_id', o.id, 'number', o.number, 'tracking_code', o.tracking_code,
    'status', o.status, 'total_cents', o.total_cents, 'paid_cents', o.paid_cents, 'became_paid', became_paid,
    'repeated', repeated, 'promised_delivery_at', o.promised_delivery_at, 'names', nm, 'email', c.email,
    'client_id', o.client_id, 'wedding_id', o.wedding_id, 'invoice', issued,
    'plan', (select p.name from public.order_lines l join public.products p on p.id = l.product_id
              where l.order_id = o.id order by l.position limit 1));
end $$;

create or replace function app.apply_refund(p_payment_id uuid, p_refunded_total integer, p_reason text, p_raw jsonb default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  pay public.payments;
  o public.orders;
  c public.clients;
  delta integer;
  now_paid integer;
  orig public.invoices;
  corr public.invoices;
  issued jsonb := null;
  nm text;
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if pay.id is null then return jsonb_build_object('ok', false, 'error', 'pago'); end if;
  select * into o from public.orders where id = pay.order_id for update;
  delta := least(p_refunded_total, pay.amount_cents) - pay.refunded_cents;
  if delta <= 0 then return jsonb_build_object('ok', true, 'nada', true, 'order_id', o.id); end if;
  nm := app.order_names(o);

  update public.payments set refunded_cents = refunded_cents + delta,
    status = case when refunded_cents + delta >= amount_cents then 'reembolsado' else 'reembolso_parcial' end,
    raw = coalesce(p_raw, raw)
  where id = pay.id;
  select coalesce(sum(amount_cents - refunded_cents), 0) into now_paid
    from public.payments where order_id = o.id and status in ('pagado', 'reembolso_parcial');
  update public.orders set paid_cents = now_paid,
    status = case when now_paid <= 0 and status not in ('cancelado', 'borrador') then 'reembolsado' else status end
  where id = o.id returning * into o;

  perform app.log_activity('pago', 'Devolución de ' || app.eur(delta), p_reason,
    jsonb_build_object('proveedor', pay.provider), o.lead_id, o.client_id, o.wedding_id, o.id);

  select * into orig from public.invoices
   where order_id = o.id and kind <> 'rectificativa' and status = 'emitida' order by issued_at desc limit 1;
  if orig.id is not null then
    begin
      corr := public.create_corrective_invoice(orig.id, coalesce(nullif(btrim(p_reason), ''), 'Devolución del importe'), delta);
      issued := app.try_issue(corr.id);
    exception when others then
      issued := jsonb_build_object('ok', false, 'error', sqlerrm);
    end;
    if not (issued ->> 'ok')::boolean then
      perform app.auto_task('rectificar:' || o.id, 'Hacer la factura rectificativa del pedido ' || o.number || ' (' || nm || ')',
        'Devolución de ' || app.eur(delta) || '. ' || coalesce(issued ->> 'error', ''), now(),
        o.lead_id, o.client_id, o.wedding_id, o.id);
    end if;
  elsif now_paid <= 0 then
    delete from public.invoices where order_id = o.id and status = 'borrador';
    perform app.close_auto_task('factura:' || o.id);
  end if;

  select * into c from public.clients where id = o.client_id;
  return jsonb_build_object('ok', true, 'order_id', o.id, 'number', o.number, 'delta_cents', delta,
    'paid_cents', o.paid_cents, 'status', o.status, 'names', nm, 'email', c.email, 'corrective', issued);
end $$;

-- Panel: apuntar un pago (Bizum, transferencia…) o una devolución.
create or replace function public.record_payment(p_order_id uuid, p_amount_cents integer, p_provider text,
  p_paid_at timestamptz default null, p_notes text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_staff();
  if p_provider not in ('transferencia', 'bizum', 'efectivo', 'stripe', 'otro') then raise exception 'Forma de pago no válida.'; end if;
  return app.apply_payment(p_order_id, p_provider, null, p_amount_cents, p_paid_at, null, nullif(btrim(coalesce(p_notes, '')), ''));
end $$;

create or replace function public.refund_payment(p_payment_id uuid, p_amount_cents integer, p_reason text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  pay public.payments;
begin
  if not app.is_admin() then raise exception 'Solo el dueño o un administrador pueden apuntar devoluciones.' using errcode = '42501'; end if;
  select * into pay from public.payments where id = p_payment_id;
  if pay.id is null then raise exception 'Pago no encontrado.'; end if;
  if pay.provider = 'stripe' and pay.external_id is not null then
    raise exception 'Los pagos con Stripe se devuelven desde Stripe (Pagos › el pago › Reembolsar). La devolución y su factura rectificativa se apuntan solas.';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > pay.amount_cents - pay.refunded_cents then
    raise exception 'El importe no es válido: se pueden devolver como mucho %.', app.eur(pay.amount_cents - pay.refunded_cents);
  end if;
  return app.apply_refund(pay.id, pay.refunded_cents + p_amount_cents, p_reason);
end $$;

-- Servidor (webhook de Stripe).
create or replace function public.api_payment_succeeded(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  oid uuid;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  begin oid := (p ->> 'order_id')::uuid; exception when others then oid := null; end;
  if oid is null then return jsonb_build_object('ok', false, 'error', 'pedido'); end if;
  return app.apply_payment(oid, coalesce(p ->> 'provider', 'stripe'), nullif(p ->> 'external_id', ''),
    (p ->> 'amount_cents')::int, coalesce((p ->> 'paid_at')::timestamptz, now()), p -> 'raw', p ->> 'notes');
end $$;

create or replace function public.api_payment_refunded(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  pay public.payments;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  select * into pay from public.payments
   where provider = coalesce(p ->> 'provider', 'stripe') and external_id = p ->> 'external_id';
  if pay.id is null then return jsonb_build_object('ok', false, 'error', 'pago'); end if;
  return app.apply_refund(pay.id, (p ->> 'refunded_cents')::int, coalesce(p ->> 'reason', 'Devolución'), p -> 'raw');
end $$;

-- ── Pagar desde el escaparate ─────────────────────────────────

create or replace function public.api_checkout_start(p jsonb, p_ip text default null, p_user_agent text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  prod public.products;
  res jsonb;
  l public.leads;
  c public.clients;
  o public.orders;
  em text := lower(btrim(coalesce(p ->> 'email', '')));
  nm text := left(btrim(regexp_replace(coalesce(p ->> 'name', ''), '\s+', ' ', 'g')), 200);
  b jsonb := case when jsonb_typeof(p -> 'billing') = 'object' then p -> 'billing' else '{}'::jsonb end;
  nif text;
  v_ip inet;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  nif := nullif(upper(regexp_replace(coalesce(b ->> 'nif', ''), '[\s.-]', '', 'g')), '');
  select * into prod from public.products where code = p ->> 'tier' and active and kind = 'plan';
  if prod.id is null or not prod.online_checkout then return jsonb_build_object('ok', false, 'error', 'tarifa'); end if;
  if length(nm) < 2 then return jsonb_build_object('ok', false, 'error', 'nombre'); end if;
  if not coalesce((p ->> 'startNow')::boolean, false) or coalesce(btrim(p ->> 'startNowText'), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'empezar_ya');
  end if;
  if nif is not null and (length(nif) not between 8 and 12 or coalesce(btrim(b ->> 'nombre'), '') = ''
                          or coalesce(btrim(b ->> 'direccion'), '') = '') then
    return jsonb_build_object('ok', false, 'error', 'factura');
  end if;

  res := public.api_submit_lead(p || '{"type": "reserva"}'::jsonb, p_ip, p_user_agent);
  if not coalesce((res ->> 'ok')::boolean, false) then return res; end if;
  select * into l from public.leads where id = (res ->> 'lead_id')::uuid for update;

  if l.client_id is not null then select * into c from public.clients where id = l.client_id; end if;
  if c.id is null then
    select * into c from public.clients where lower(email) = em and anonymized_at is null order by created_at desc limit 1;
  end if;
  if c.id is null then
    insert into public.clients (display_name, email, phone)
    values (nm, em, nullif(left(btrim(coalesce(p ->> 'phone', '')), 40), ''))
    returning * into c;
  end if;
  if nif is not null then
    update public.clients set billing_name = left(btrim(b ->> 'nombre'), 200), tax_id = nif,
      billing_address = left(btrim(b ->> 'direccion'), 300),
      postal_code = nullif(left(btrim(coalesce(b ->> 'codigo_postal', '')), 20), ''),
      city = nullif(left(btrim(coalesce(b ->> 'ciudad', '')), 120), ''),
      province = nullif(left(btrim(coalesce(b ->> 'provincia', '')), 120), ''),
      country = coalesce(nullif(upper(left(btrim(coalesce(b ->> 'pais', '')), 2)), ''), 'ES')
    where id = c.id returning * into c;
  end if;
  update public.leads set client_id = c.id,
    status = case when status = 'ganado' then status else 'esperando_pago' end
  where id = l.id;

  -- Si vuelven atrás y lo intentan otra vez, se reutiliza su pedido pendiente.
  select o2.* into o from public.orders o2
   where o2.lead_id = l.id and o2.status = 'pendiente_pago' and o2.source = 'escaparate'
     and o2.created_at > now() - interval '7 days'
     and exists (select 1 from public.order_lines ol where ol.order_id = o2.id and ol.product_id = prod.id)
   order by o2.created_at desc limit 1;
  if o.id is null then
    insert into public.orders (client_id, lead_id, status, source, start_now_at, start_now_text)
    values (c.id, l.id, 'pendiente_pago', 'escaparate', now(), left(p ->> 'startNowText', 1000))
    returning * into o;
    insert into public.order_lines (order_id, product_id, description, unit_price_cents, vat_rate_bp)
    values (o.id, prod.id, 'Web de boda · ' || prod.name, prod.price_cents, prod.vat_rate_bp);
  else
    update public.orders set start_now_at = now(), start_now_text = left(p ->> 'startNowText', 1000) where id = o.id;
  end if;
  select * into o from public.orders where id = o.id;

  begin v_ip := nullif(p_ip, '')::inet; exception when others then v_ip := null; end;
  insert into public.consents (lead_id, client_id, email, purpose, granted, text, source, ip, user_agent)
  values (l.id, c.id, em, 'inicio_inmediato', true, left(p ->> 'startNowText', 2000), 'pago ' || o.number, v_ip, left(p_user_agent, 300));
  perform app.log_activity('reserva', 'Ha ido a pagar ' || prod.name || ' (' || app.eur(o.total_cents) || ')', null,
    jsonb_build_object('pedido', o.number), l.id, c.id, null, o.id);

  return jsonb_build_object('ok', true, 'order_id', o.id, 'number', o.number, 'tracking_code', o.tracking_code,
    'total_cents', o.total_cents, 'due_cents', o.total_cents - o.paid_cents, 'email', em, 'names', nm,
    'description', 'Web de boda · ' || prod.name);
end $$;

-- Lo que hace falta para cobrar un pedido (escaparate o enlace que manda Luis).
create or replace function public.api_order_for_payment(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  o public.orders;
  c public.clients;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  select * into o from public.orders where tracking_code = app.norm_code(p_code);
  if o.id is null then return null; end if;
  select * into c from public.clients where id = o.client_id;
  return jsonb_build_object('order_id', o.id, 'number', o.number, 'status', o.status, 'tracking_code', o.tracking_code,
    'total_cents', o.total_cents, 'paid_cents', o.paid_cents, 'due_cents', greatest(o.total_cents - o.paid_cents, 0),
    'payable', o.status = 'pendiente_pago' and o.total_cents > o.paid_cents,
    'email', c.email, 'names', app.order_names(o),
    'description', (select string_agg(l.description || case when l.quantity > 1 then ' × ' || l.quantity else '' end, ', ' order by l.position)
                      from public.order_lines l where l.order_id = o.id),
    'checkout_session_id', o.checkout_session_id, 'checkout_url', o.checkout_url, 'checkout_expires_at', o.checkout_expires_at);
end $$;

create or replace function public.api_checkout_session(p_order_id uuid, p_session_id text, p_url text, p_expires_at timestamptz)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  update public.orders set checkout_session_id = p_session_id, checkout_url = p_url, checkout_expires_at = p_expires_at,
         payment_provider_ref = p_session_id
   where id = p_order_id;
end $$;

-- ── Página de seguimiento (con el código, sin contraseña) ─────

create or replace function app.order_by_code(p_code text) returns public.orders
language sql stable security definer set search_path = '' as $$
  select o.* from public.orders o where o.tracking_code = app.norm_code(p_code) and o.status <> 'borrador'
$$;

create or replace function public.api_tracking(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  o public.orders;
  l public.leads;
  w public.weddings;
  p public.products;
  seller jsonb := coalesce(app.setting('vendedor'), '{}'::jsonb);
  used integer;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  o := app.order_by_code(p_code);
  if o.id is null then return null; end if;
  select * into l from public.leads where id = o.lead_id;
  select * into w from public.weddings where id = o.wedding_id;
  select pr.* into p from public.order_lines ol join public.products pr on pr.id = ol.product_id
   where ol.order_id = o.id and pr.kind = 'plan' order by ol.position limit 1;
  select count(distinct proposal_id) into used from public.change_requests
   where order_id = o.id and kind = 'cambio' and proposal_id is not null and status <> 'descartado';

  return jsonb_build_object(
    'code', o.tracking_code, 'number', o.number, 'status', o.status, 'created_at', o.created_at,
    'paid_at', o.paid_at, 'promised_delivery_at', o.promised_delivery_at, 'delivered_at', o.delivered_at,
    'approved_at', o.approved_at, 'total_cents', o.total_cents, 'paid_cents', o.paid_cents,
    'payable', o.status = 'pendiente_pago' and o.total_cents > o.paid_cents,
    'names', app.order_names(o),
    'plan', case when p.id is null then null else jsonb_build_object('code', p.code, 'name', p.name, 'includes', p.includes) end,
    'lines', (select coalesce(jsonb_agg(jsonb_build_object('description', x.description, 'quantity', x.quantity,
                                                           'total_cents', x.total_cents) order by x.position), '[]'::jsonb)
                from public.order_lines x where x.order_id = o.id),
    'style', l.style, 'template', coalesce(w.template, l.trial_config ->> 'template'),
    'theme', coalesce(w.config ->> 'theme', l.trial_config ->> 'theme'),
    'sections', coalesce(w.config -> 'sections', l.trial_config -> 'sections', l.sections, '[]'::jsonb),
    'wedding_date', coalesce(w.wedding_date, l.wedding_date),
    'web', case when w.id is null then null else jsonb_build_object('slug', w.slug, 'status', w.status,
              'published', w.status in ('publicada', 'archivada') and w.published_version_id is not null) end,
    'proposals', (select coalesce(jsonb_agg(jsonb_build_object('number', x.number, 'sent_at', x.sent_at, 'note', x.note,
                                                               'approved_at', x.approved_at) order by x.number), '[]'::jsonb)
                    from public.wedding_proposals x where x.wedding_id = o.wedding_id),
    'requests', (select coalesce(jsonb_agg(jsonb_build_object('created_at', r.created_at, 'kind', r.kind, 'message', r.message,
                                                              'status', r.status, 'reply', r.reply,
                                                              'proposal', (select x.number from public.wedding_proposals x where x.id = r.proposal_id))
                                           order by r.created_at), '[]'::jsonb)
                   from public.change_requests r where r.order_id = o.id),
    'rounds', jsonb_build_object('included', p.revision_rounds, 'used', used),
    'invoices', (select coalesce(jsonb_agg(jsonb_build_object('number', i.full_number, 'issued_at', i.issued_at,
                                                              'total_cents', i.total_cents, 'kind', i.kind, 'status', i.status)
                                           order by i.issued_at), '[]'::jsonb)
                   from public.invoices i where i.order_id = o.id and i.status <> 'borrador'),
    'couple_panel', exists (select 1 from public.couple_users cu where cu.wedding_id = o.wedding_id)
                    and coalesce(w.status in ('publicada', 'archivada'), false),
    'contact', jsonb_strip_nulls(jsonb_build_object('nombre', nullif(seller ->> 'nombre', ''), 'email', nullif(seller ->> 'email', ''),
                                                    'telefono', nullif(seller ->> 'telefono', '')))
  );
end $$;

create or replace function public.api_tracking_request(p_code text, p_kind text, p_message text, p_proposal integer default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  pr public.wedding_proposals;
  rounds integer;
  used integer;
  msg text := btrim(coalesce(p_message, ''));
  r public.change_requests;
  nm text;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  o := app.order_by_code(p_code);
  if o.id is null then return jsonb_build_object('ok', false, 'error', 'no_existe'); end if;
  if o.status not in ('pagado', 'en_produccion', 'entregado') then return jsonb_build_object('ok', false, 'error', 'no_pagado'); end if;
  if p_kind not in ('correccion', 'cambio') then return jsonb_build_object('ok', false, 'error', 'tipo'); end if;
  if length(msg) < 3 or length(msg) > 4000 then return jsonb_build_object('ok', false, 'error', 'mensaje'); end if;

  if p_proposal is not null then
    select * into pr from public.wedding_proposals where wedding_id = o.wedding_id and number = p_proposal;
    if pr.id is null then return jsonb_build_object('ok', false, 'error', 'propuesta'); end if;
  else
    select * into pr from public.wedding_proposals where wedding_id = o.wedding_id order by number desc limit 1;
  end if;

  if p_kind = 'cambio' and pr.id is not null then
    select pp.revision_rounds into rounds from public.order_lines ol join public.products pp on pp.id = ol.product_id
     where ol.order_id = o.id and pp.kind = 'plan' order by ol.position limit 1;
    select count(distinct proposal_id) into used from public.change_requests
     where order_id = o.id and kind = 'cambio' and proposal_id is not null and status <> 'descartado';
    -- Varios mensajes sobre la misma propuesta son la misma ronda.
    if rounds is not null and used >= rounds and not exists (
         select 1 from public.change_requests where order_id = o.id and proposal_id = pr.id and kind = 'cambio' and status <> 'descartado') then
      return jsonb_build_object('ok', false, 'error', 'sin_rondas', 'rounds', rounds, 'used', used);
    end if;
  end if;

  insert into public.change_requests (order_id, wedding_id, proposal_id, kind, message)
  values (o.id, o.wedding_id, pr.id, p_kind, msg) returning * into r;
  nm := app.order_names(o);
  perform app.log_activity('nota', case p_kind when 'cambio' then 'Han pedido cambios' else 'Han pedido una corrección' end
    || case when pr.id is not null then ' (propuesta ' || pr.number || ')' else '' end, left(msg, 1000), '{}'::jsonb,
    o.lead_id, o.client_id, o.wedding_id, o.id);
  perform app.auto_task('cambios:' || o.id, 'Cambios pedidos por ' || nm, 'Están en su boda › Propuestas y cambios.',
    now(), o.lead_id, o.client_id, o.wedding_id, o.id);
  return jsonb_build_object('ok', true, 'id', r.id, 'kind', r.kind, 'number', o.number, 'names', nm,
    'proposal', pr.number, 'wedding_id', o.wedding_id, 'client_id', o.client_id);
end $$;

create or replace function public.api_tracking_approve(p_code text, p_proposal integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  pr public.wedding_proposals;
  nm text;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  o := app.order_by_code(p_code);
  if o.id is null then return jsonb_build_object('ok', false, 'error', 'no_existe'); end if;
  select * into pr from public.wedding_proposals where wedding_id = o.wedding_id order by number desc limit 1;
  if pr.id is null or pr.number <> p_proposal then return jsonb_build_object('ok', false, 'error', 'propuesta'); end if;
  if pr.approved_at is not null then return jsonb_build_object('ok', true, 'repetido', true, 'proposal', pr.number); end if;
  update public.wedding_proposals set approved_at = now() where id = pr.id;
  update public.orders set approved_at = now() where id = o.id;
  nm := app.order_names(o);
  perform app.log_activity('boda', 'Han aprobado la propuesta ' || pr.number, null, '{}'::jsonb,
    o.lead_id, o.client_id, o.wedding_id, o.id);
  perform app.close_auto_task('cambios:' || o.id);
  perform app.auto_task('publicar:' || o.id, 'Publicar la web de ' || nm || ': han aprobado la propuesta ' || pr.number,
    'Revisa que el borrador sea el de la propuesta aprobada y pulsa Publicar.', now(),
    o.lead_id, o.client_id, o.wedding_id, o.id);
  return jsonb_build_object('ok', true, 'proposal', pr.number, 'number', o.number, 'names', nm,
    'wedding_id', o.wedding_id, 'client_id', o.client_id);
end $$;

-- Emails de la pareja para mandarle el enlace a su panel (no se enseñan en la página).
create or replace function public.api_tracking_couple(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  o public.orders;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  o := app.order_by_code(p_code);
  if o.id is null or o.wedding_id is null then return null; end if;
  return jsonb_build_object('wedding_id', o.wedding_id, 'names', app.order_names(o),
    'emails', (select coalesce(jsonb_agg(distinct lower(cu.email)), '[]'::jsonb) from public.couple_users cu where cu.wedding_id = o.wedding_id));
end $$;

-- Una propuesta tal como se mandó, para pintarla en /b/<slug>?propuesta=<n>&c=<código>.
create or replace function public.api_public_proposal(p_code text, p_number integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  o public.orders;
  w public.weddings;
  pr public.wedding_proposals;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  o := app.order_by_code(p_code);
  if o.id is null or o.wedding_id is null then return null; end if;
  select * into pr from public.wedding_proposals where wedding_id = o.wedding_id and number = p_number;
  if pr.id is null then return null; end if;
  select * into w from public.weddings where id = o.wedding_id;
  return jsonb_build_object('id', w.id, 'slug', w.slug, 'status', w.status, 'template', pr.template, 'config', pr.config,
    'version', null, 'draft', true, 'proposal', pr.number, 'updated_at', pr.sent_at,
    'features', app.wedding_features(w.id), 'invite', null, 'invite_invalid', false);
end $$;

-- ── Panel: mandar una propuesta ───────────────────────────────

create or replace function public.send_proposal(p_wedding_id uuid, p_note text default null, p_resolve boolean default true)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  w public.weddings;
  o public.orders;
  n integer;
  pr public.wedding_proposals;
  resolved integer := 0;
begin
  perform app.require_staff();
  select * into w from public.weddings where id = p_wedding_id for update;
  if w.id is null then raise exception 'Boda no encontrada.'; end if;
  select * into o from public.orders where wedding_id = w.id and status not in ('cancelado', 'reembolsado', 'borrador')
   order by created_at desc limit 1;
  if o.id is null then
    raise exception 'Esta boda no está enlazada a ningún pedido. Enlázala desde la ficha del cliente (pedido › Boda) para mandar propuestas.'
      using hint = 'sin_pedido';
  end if;
  select coalesce(max(number), 0) + 1 into n from public.wedding_proposals where wedding_id = w.id;
  insert into public.wedding_proposals (wedding_id, order_id, number, template, config, note, sent_by)
  values (w.id, o.id, n, w.template, w.config, nullif(left(btrim(coalesce(p_note, '')), 2000), ''), app.staff_id())
  returning * into pr;
  if p_resolve then
    update public.change_requests set status = 'hecho', resolved_at = now(), resolved_by = app.staff_id(),
           resolved_in_proposal_id = pr.id
     where order_id = o.id and status = 'pendiente';
    get diagnostics resolved = row_count;
    perform app.close_auto_task('cambios:' || o.id);
  end if;
  perform app.close_auto_task('preparar:' || o.id);
  if o.status = 'pagado' then update public.orders set status = 'en_produccion' where id = o.id; end if;
  if w.status = 'borrador' then update public.weddings set status = 'vista_previa' where id = w.id; end if;
  perform app.log_activity('boda', 'Propuesta ' || n || ' enviada a la pareja', pr.note, '{}'::jsonb,
    o.lead_id, o.client_id, w.id, o.id);
  return jsonb_build_object('id', pr.id, 'number', n, 'order_id', o.id, 'order_number', o.number,
    'tracking_code', o.tracking_code, 'resolved', resolved, 'names', app.order_names(o), 'note', pr.note,
    'emails', (select coalesce(jsonb_agg(distinct e), '[]'::jsonb) from (
        select lower(c.email) as e from public.clients c where c.id = o.client_id and c.email ~ '^\S+@\S+\.\S+$'
        union select lower(cu.email) from public.couple_users cu where cu.wedding_id = w.id) x));
end $$;

-- ── Facturas para el PDF y avisos de Stripe ───────────────────

create or replace function public.invoice_document(p_invoice_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  inv public.invoices;
  o public.orders;
  orig public.invoices;
begin
  if not (app.is_admin() or app.is_service()) then
    raise exception 'Solo el dueño o un administrador pueden ver facturas.' using errcode = '42501';
  end if;
  select * into inv from public.invoices where id = p_invoice_id;
  if inv.id is null or inv.status = 'borrador' then return null; end if;
  select * into o from public.orders where id = inv.order_id;
  select * into orig from public.invoices where id = inv.corrects_invoice_id;
  return to_jsonb(inv) || jsonb_build_object(
    'lines', (select coalesce(jsonb_agg(to_jsonb(l) order by l.position, l.created_at), '[]'::jsonb)
                from public.invoice_lines l where l.invoice_id = inv.id),
    'order_number', o.number,
    'type_code', app.invoice_type_code(inv),
    'corrects', case when orig.id is null then null
                     else jsonb_build_object('number', orig.full_number, 'issued_at', orig.issued_at) end,
    'payments', (select coalesce(jsonb_agg(jsonb_build_object('provider', p.provider, 'paid_at', p.paid_at,
                                                              'amount_cents', p.amount_cents) order by p.paid_at), '[]'::jsonb)
                   from public.payments p where p.order_id = o.id and p.status <> 'fallido'));
end $$;

create or replace function public.api_tracking_invoice(p_code text, p_number text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  o public.orders;
  iid uuid;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  o := app.order_by_code(p_code);
  if o.id is null then return null; end if;
  select id into iid from public.invoices
   where order_id = o.id and full_number = upper(btrim(coalesce(p_number, ''))) and status <> 'borrador';
  if iid is null then return null; end if;
  return public.invoice_document(iid);
end $$;

-- Cada aviso de Stripe se guarda una vez (si llega repetido, se dice que ya está hecho).
create or replace function public.api_webhook_received(p_provider text, p_event_id text, p_type text, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  ev public.webhook_events;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  insert into public.webhook_events as e (provider, event_id, type, payload, attempts)
  values (p_provider, p_event_id, p_type, p_payload, 1)
  on conflict (provider, event_id) do update set attempts = e.attempts + 1
  returning * into ev;
  return jsonb_build_object('id', ev.id, 'processed', ev.processed_at is not null);
end $$;

create or replace function public.api_webhook_done(p_id uuid, p_error text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  update public.webhook_events set processed_at = case when p_error is null then now() end, error = left(p_error, 2000)
   where id = p_id;
end $$;

-- Tarea suelta creada por el servidor (p. ej. una reclamación de un pago).
-- El pedido se busca por su id o por la referencia del pago (p. ej. el payment_intent de Stripe).
create or replace function public.api_auto_task(p_key text, p_title text, p_notes text,
  p_order_id uuid default null, p_payment_ref text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  select * into o from public.orders
   where id = coalesce(p_order_id, (select p.order_id from public.payments p where p.external_id = p_payment_ref limit 1));
  if o.id is null then return; end if;
  perform app.auto_task(p_key, p_title, p_notes, now(), o.lead_id, o.client_id, o.wedding_id, o.id);
end $$;

-- ── Tarifas para el escaparate (con pago al momento y rondas) ──

create or replace function public.api_products() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', p.code, 'name', p.name, 'description', p.description, 'price_cents', p.price_cents,
    'price_is_from', p.price_is_from, 'includes', p.includes, 'kind', p.kind,
    'online_checkout', p.online_checkout and not p.price_is_from, 'revision_rounds', p.revision_rounds) order by p.sort), '[]'::jsonb)
  from public.products p where p.active and app.is_service()
$$;

-- ── Permisos ──────────────────────────────────────────────────

do $$
declare f text;
begin
  foreach f in array array[
    'public.api_payment_succeeded(jsonb)', 'public.api_payment_refunded(jsonb)',
    'public.api_checkout_start(jsonb, text, text)', 'public.api_order_for_payment(text)',
    'public.api_checkout_session(uuid, text, text, timestamptz)', 'public.api_tracking(text)',
    'public.api_tracking_request(text, text, text, integer)', 'public.api_tracking_approve(text, integer)',
    'public.api_tracking_couple(text)', 'public.api_public_proposal(text, integer)',
    'public.api_tracking_invoice(text, text)', 'public.api_webhook_received(text, text, text, jsonb)',
    'public.api_webhook_done(uuid, text)', 'public.api_auto_task(text, text, text, uuid, text)']
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
  foreach f in array array[
    'public.invoice_order(uuid)', 'public.create_corrective_invoice(uuid, text, integer)',
    'public.record_payment(uuid, integer, text, timestamptz, text)', 'public.refund_payment(uuid, integer, text)',
    'public.send_proposal(uuid, text, boolean)', 'public.invoice_document(uuid)']
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;
