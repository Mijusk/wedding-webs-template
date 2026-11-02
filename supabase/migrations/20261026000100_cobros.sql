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
