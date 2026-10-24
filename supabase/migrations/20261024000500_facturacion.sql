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
