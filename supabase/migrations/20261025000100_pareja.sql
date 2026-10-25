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
