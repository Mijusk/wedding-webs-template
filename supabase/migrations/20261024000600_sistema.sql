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
