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
