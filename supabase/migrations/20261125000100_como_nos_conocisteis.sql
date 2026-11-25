-- WeddingWebs · «¿Cómo nos conocisteis?»
--
-- Si ya instalaste la base de datos antes: pega SOLO este archivo en el editor SQL.
--
-- El escaparate pregunta (opcional, de un toque) cómo nos conocieron, al guardar la web y al
-- reservar. Es el respaldo de la atribución por enlace (utm, gclid, fbclid), que no ve el boca a
-- boca, los enlaces abiertos desde WhatsApp o Instagram sin utm, ni a quien vuelve otro día sin
-- haber aceptado las cookies de publicidad.
--
-- leads.heard_from: lo que contestó la pareja (o lo que apuntéis en el panel). Es aparte de
-- leads.source, que dice por dónde entró el lead (prueba, reserva, a mano…).
-- api_submit_lead: igual que en 20261118000300_lead_movil.sql, más heardFrom. Una respuesta nueva
-- sustituye a la anterior; si no contestan, se queda la que hubiera.

alter table public.leads add column if not exists heard_from text;
alter table public.leads drop constraint if exists leads_heard_from;
alter table public.leads add constraint leads_heard_from check (heard_from in (
  'instagram', 'facebook', 'google', 'bodas_net', 'recomendacion', 'otra_boda', 'otro'));

create or replace function public.api_submit_lead(p jsonb, p_ip text default null, p_user_agent text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  em text := nullif(lower(btrim(coalesce(p ->> 'email', ''))), '');
  -- Móvil: se guarda como lo escriben; para encontrar a la misma pareja se comparan sus 9 últimas cifras.
  ph text := left(nullif(btrim(coalesce(p ->> 'phone', '')), ''), 40);
  ph_digits text := regexp_replace(coalesce(p ->> 'phone', ''), '\D', '', 'g');
  typ text := case when p ->> 'type' = 'reserva' then 'reserva' else 'prueba' end;
  wd text := coalesce(p ->> 'weddingDate', '');
  d date;
  t time;
  l public.leads;
  is_new boolean := false;
  v_attr jsonb;
  v_touch text;
  v_ip inet;
  -- «¿Cómo nos conocisteis?»: lo que dice la pareja; un valor fuera de la lista se ignora.
  hf text := case when p ->> 'heardFrom' in ('instagram', 'facebook', 'google', 'bodas_net', 'recomendacion', 'otra_boda', 'otro')
                  then p ->> 'heardFrom' end;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  -- Hace falta un email o un móvil (el escaparate pide el móvil; el email es opcional).
  if em is not null and (em !~ '^\S+@\S+\.\S+$' or length(em) > 200) then
    return jsonb_build_object('ok', false, 'error', 'email');
  end if;
  if ph is not null and length(ph_digits) not between 9 and 15 then
    return jsonb_build_object('ok', false, 'error', 'telefono');
  end if;
  if em is null and ph is null then
    return jsonb_build_object('ok', false, 'error', 'contacto');
  end if;
  begin
    if wd ~ '^\d{4}-\d{2}-\d{2}' then d := left(wd, 10)::date; end if;
    if wd ~ '\d{2}:\d{2}$' then t := right(wd, 5)::time; end if;
  exception when others then d := null; t := null;
  end;
  begin v_ip := nullif(p_ip, '')::inet; exception when others then v_ip := null; end;

  if em is not null then
    select * into l from public.leads
     where lower(email) = em and status not in ('ganado', 'perdido') and anonymized_at is null
     order by created_at desc limit 1;
  end if;
  if l.id is null and ph is not null then
    select * into l from public.leads
     where right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 9) = right(ph_digits, 9)
       and status not in ('ganado', 'perdido') and anonymized_at is null
     order by created_at desc limit 1;
  end if;

  if l.id is null then
    insert into public.leads (names, partner_a, partner_b, email, phone, wedding_date, wedding_time, venue, city,
                              style, tier, sections, trial_config, message, source, heard_from, trials, reserved_at)
    values (left(coalesce(p ->> 'name', ''), 200), left(p ->> 'nameA', 100), left(p ->> 'nameB', 100), em,
            ph, d, t, left(p ->> 'venue', 300), left(p ->> 'city', 200),
            left(p ->> 'style', 60), left(p ->> 'tier', 60), p -> 'sections', p -> 'wedding',
            left(nullif(btrim(p ->> 'message'), ''), 4000), typ, hf,
            case when typ = 'prueba' then 1 else 0 end, case when typ = 'reserva' then now() end)
    returning * into l;
    is_new := true;
  else
    update public.leads set
      names = coalesce(nullif(left(p ->> 'name', 200), ''), names),
      partner_a = coalesce(nullif(left(p ->> 'nameA', 100), ''), partner_a),
      partner_b = coalesce(nullif(left(p ->> 'nameB', 100), ''), partner_b),
      email = coalesce(email, em),
      phone = coalesce(ph, phone),
      wedding_date = coalesce(d, wedding_date),
      wedding_time = coalesce(t, wedding_time),
      venue = coalesce(nullif(left(p ->> 'venue', 300), ''), venue),
      city = coalesce(nullif(left(p ->> 'city', 200), ''), city),
      style = coalesce(nullif(left(p ->> 'style', 60), ''), style),
      tier = coalesce(nullif(left(p ->> 'tier', 60), ''), tier),
      sections = coalesce(p -> 'sections', sections),
      trial_config = coalesce(p -> 'wedding', trial_config),
      message = coalesce(nullif(left(btrim(p ->> 'message'), 4000), ''), message),
      heard_from = coalesce(hf, heard_from),
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
revoke execute on function public.api_submit_lead(jsonb, text, text) from public, anon, authenticated;
grant execute on function public.api_submit_lead(jsonb, text, text) to service_role;
