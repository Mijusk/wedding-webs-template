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
