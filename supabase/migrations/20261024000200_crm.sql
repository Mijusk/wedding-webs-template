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
