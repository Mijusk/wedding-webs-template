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
