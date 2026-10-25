-- Pruebas de la fase 3: panel de la pareja y RSVP ampliado.
begin;

-- ── La pareja cambia datos prácticos ──
set local role authenticated;
set local request.jwt.claims to '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
do $$
declare
  r jsonb; v_before int; t timestamptz;
begin
  r := public.pareja_resumen();
  assert r #>> '{wedding,slug}' = 'lucia-y-martin', 'FALLO: resumen';
  assert (r #>> '{features,rsvp_ampliado}')::boolean, 'FALLO: el RSVP ampliado regalado no aparece';
  assert (r #>> '{stats,grupos}')::int = 3 and (r #>> '{stats,pendientes}')::int = 2, 'FALLO: totales ' || (r -> 'stats')::text;
  assert r #>> '{me,digest}' = 'semanal', 'FALLO: aviso por defecto';
  t := (r #>> '{wedding,updated_at}')::timestamptz;

  -- Diseño y textos: no.
  begin
    perform public.pareja_guardar('b0000000-0000-4000-8000-000000000001', '{"theme":"verbena"}');
    raise exception 'FALLO: la pareja ha cambiado el estilo';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if;
  end;
  begin
    perform public.pareja_guardar('b0000000-0000-4000-8000-000000000001', '{"venue":{"name":"Otro sitio","address":"Calle 1"}}');
  end;
  assert (select config #>> '{venue,name}' from public.wedding_versions where wedding_id = 'b0000000-0000-4000-8000-000000000001' order by version desc limit 1) = 'Finca El Olivar',
    'FALLO: la pareja ha cambiado el nombre del lugar (no está permitido)';
  -- IBAN mal escrito: no.
  begin
    perform public.pareja_guardar('b0000000-0000-4000-8000-000000000001', '{"gifts":{"iban":"ES91 2100 0418 4502 0005 1333"}}');
    raise exception 'FALLO: IBAN incorrecto aceptado';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if;
  end;
  -- Fecha límite después de la boda: no.
  begin
    perform public.pareja_guardar('b0000000-0000-4000-8000-000000000001', '{"rsvp":{"deadline":"2027-07-01"}}');
    raise exception 'FALLO: fecha límite posterior a la boda';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if;
  end;
  -- Quitar la portada: no.
  begin
    perform public.pareja_guardar('b0000000-0000-4000-8000-000000000001', '{"sections":["details","schedule","rsvp","closing"]}');
    raise exception 'FALLO: se ha quitado una sección fija';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if;
  end;

  select count(*) into v_before from public.wedding_versions where wedding_id = 'b0000000-0000-4000-8000-000000000001';
  r := public.pareja_guardar('b0000000-0000-4000-8000-000000000001',
    '{"schedule":[{"time":"17:30","label":"Ceremonia","place":"Jardín"},{"time":"19:00","label":"Cóctel"}],
      "gifts":{"holder":"Lucía y Martín","iban":"ES91 2100 0418 4502 0005 1332"},
      "rsvp":{"deadline":"2027-05-15","bus":true,"dietary":true},
      "sections":["hero","details","schedule","gifts","closing","rsvp"]}', null);
  assert (r ->> 'published')::boolean, 'FALLO: el cambio no se ha publicado';
  assert (select count(*) from public.wedding_versions where wedding_id = 'b0000000-0000-4000-8000-000000000001') = v_before + 1, 'FALLO: no hay versión nueva';
  raise notice 'OK la pareja cambia horario, IBAN, fecha límite y secciones; se publica solo; diseño y textos no';

  -- Conflicto: si alguien cambió la boda mientras tanto, avisa.
  begin
    perform public.pareja_guardar('b0000000-0000-4000-8000-000000000001', '{"rsvp":{"bus":false}}', t);
    raise exception 'FALLO: no ha detectado el conflicto';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if;
  end;
  raise notice 'OK detecta cambios simultáneos';

  perform public.pareja_avisos('diario');
  assert public.pareja_resumen() #>> '{me,digest}' = 'diario', 'FALLO: avisos';

  -- Invitados: la pareja crea grupos, pero no con una clave corta (adivinable).
  begin
    insert into public.guest_groups (wedding_id, name, token) values ('b0000000-0000-4000-8000-000000000001', 'X', 'corta');
    raise exception 'FALLO: clave de invitación corta aceptada';
  exception when check_violation then null;
  end;
  insert into public.guest_groups (wedding_id, name, seats) values ('b0000000-0000-4000-8000-000000000001', 'Vecinos', 2);
  begin
    insert into public.guest_groups (wedding_id, name) values ('b0000000-0000-4000-8000-000000000002', 'Intruso');
    raise exception 'FALLO: la pareja ha creado invitados en otra boda';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK invitados: solo en su boda y con claves largas';
end $$;
reset role;

-- El borrador de Luis no se publica por un cambio de la pareja.
do $$ begin
  assert (select config #>> '{event,tagline}' from public.wedding_versions
           where id = (select published_version_id from public.weddings where slug = 'lucia-y-martin'))
       = (select config #>> '{event,tagline}' from public.wedding_versions
           where wedding_id = 'b0000000-0000-4000-8000-000000000001' and version = 1), 'FALLO: ha cambiado la frase publicada';
  assert (select config #>> '{schedule,0,time}' from public.weddings where slug = 'lucia-y-martin') = '17:30', 'FALLO: el borrador no tiene el cambio';
  assert exists (select 1 from public.activities where wedding_id = 'b0000000-0000-4000-8000-000000000001' and title like 'La pareja ha cambiado:%'),
    'FALLO: Luis no ve el cambio en el historial';
  raise notice 'OK el cambio queda en el historial de Luis y no publica su borrador';
end $$;

-- ── RSVP ampliado desde la web ──
set local role service_role;
do $$
declare
  r jsonb; ortega jsonb; ids text[];
begin
  r := public.api_public_wedding('lucia-y-martin', null, null, 'demo-familia-ortega-0000000001');
  assert r #>> '{invite,name}' = 'Familia Ortega', 'FALLO: enlace personal';
  assert jsonb_array_length(r #> '{invite,guests}') = 4, 'FALLO: invitados del grupo';
  assert (r #>> '{features,rsvp_ampliado}')::boolean, 'FALLO: features';
  r := public.api_public_wedding('lucia-y-martin', null, null, 'clave-que-no-existe-000000000');
  assert r -> 'invite' = 'null'::jsonb and (r ->> 'invite_invalid')::boolean, 'FALLO: clave falsa';
  r := public.api_public_wedding('marta-y-pablo', null, null, 'demo-familia-ortega-0000000001');
  assert r is null, 'FALLO: borrador visible con un enlace de invitado';

  select array_agg(e ->> 'id' order by (e ->> 'child')::boolean, e ->> 'name') into ids
    from jsonb_array_elements(public.api_public_wedding('lucia-y-martin', null, null, 'demo-familia-ortega-0000000001') #> '{invite,guests}') e;
  -- Vienen los dos adultos y una niña; ella es celíaca. Nombres falsos en el formulario se ignoran.
  r := public.api_submit_rsvp('lucia-y-martin', jsonb_build_object('invite', 'demo-familia-ortega-0000000001', 'attending', 'si',
        'name', 'Otro nombre', 'bus', 'si', 'song', 'Despacito', 'message', '¡Qué ganas!',
        'guests', jsonb_build_array(
          jsonb_build_object('id', ids[1], 'attending', true), jsonb_build_object('id', ids[2], 'attending', true),
          jsonb_build_object('id', ids[3], 'attending', true, 'dietary', 'Celíaca', 'name', 'Hacker'),
          jsonb_build_object('id', ids[4], 'attending', false))));
  assert (r ->> 'ok')::boolean and (r ->> 'adults')::int = 2 and (r ->> 'children')::int = 1, 'FALLO: respuesta del grupo ' || r::text;
  select to_jsonb(x) into ortega from public.rsvp_current x where group_id = 'f0000000-0000-4000-8000-000000000001';
  assert ortega ->> 'name' = 'Familia Ortega' and (ortega ->> 'bus')::boolean, 'FALLO: guardado ' || ortega::text;
  assert not (ortega::text like '%Hacker%'), 'FALLO: se ha guardado un nombre enviado desde fuera';
  raise notice 'OK enlace personal: uno a uno, con alergias y autobús; los nombres salen de la lista';

  -- Grupo con lista: «vienen» sin marcar a nadie no vale (y el número de adultos que manden se ignora).
  r := public.api_submit_rsvp('lucia-y-martin', '{"invite":"demo-tios-martin-0000000000003","attending":"si","adults":3}');
  assert r ->> 'error' = 'nadie', 'FALLO: grupo con lista sin nadie marcado ' || r::text;
  -- Grupo sin lista de nombres: no más plazas de las que tiene.
  r := public.api_submit_rsvp('lucia-y-martin', '{"invite":"demo-amigos-uni-00000000000002","attending":"si","adults":7}');
  assert r ->> 'error' = 'plazas', 'FALLO: más plazas de las invitadas ' || r::text;
  r := public.api_submit_rsvp('lucia-y-martin', '{"invite":"demo-amigos-uni-00000000000002","attending":"si","adults":4,"children":2}');
  assert (r ->> 'ok')::boolean, 'FALLO: 6 plazas de 6 ' || r::text;
  r := public.api_submit_rsvp('lucia-y-martin', '{"invite":"demo-amigos-uni-00000000000002","attending":"si","adults":0}');
  assert r ->> 'error' = 'nadie', 'FALLO: confirma que viene pero nadie';
  r := public.api_submit_rsvp('lucia-y-martin', '{"invite":"no-existe-000000000000000000","attending":"si"}');
  assert r ->> 'error' = 'invitacion', 'FALLO: invitación falsa';
  -- Enlace general (sin invitación) con acompañantes.
  r := public.api_submit_rsvp('lucia-y-martin', '{"name":"Prima Lejana","attending":"si","adults":2,"children":1}');
  assert (r ->> 'ok')::boolean, 'FALLO: enlace general ampliado';
  raise notice 'OK plazas limitadas, invitaciones falsas rechazadas y enlace general con acompañantes';

  r := app.rsvp_stats('b0000000-0000-4000-8000-000000000001');
  -- Pendientes: Tíos de Martín y Vecinos (el grupo que creó la pareja arriba).
  assert (r ->> 'pendientes')::int = 2, 'FALLO: pendientes ' || r::text;
  assert (r ->> 'ninos')::int = 4, 'FALLO: niños ' || r::text;
  assert (r ->> 'alergias')::int = 1, 'FALLO: alergias ' || r::text;
  raise notice 'OK totales: % personas, % niños, % pendientes', r ->> 'personas', r ->> 'ninos', r ->> 'pendientes';

  assert jsonb_array_length(public.api_pending_groups('b0000000-0000-4000-8000-000000000001')) = 2, 'FALLO: grupos pendientes';
  assert public.api_couple_access('LUCIA@example.com') ->> 'email' = 'lucia@example.com', 'FALLO: acceso de la pareja';
  assert public.api_couple_access('nadie@example.com') is null, 'FALLO: acceso de un desconocido';
  raise notice 'OK funciones del servidor para acceso y recordatorios';
end $$;
reset role;

-- Sin el módulo: el RSVP de siempre (aunque manden campos ampliados).
update public.weddings set features = '{}' where slug = 'lucia-y-martin';
set local role service_role;
do $$
declare r jsonb;
begin
  r := public.api_submit_rsvp('lucia-y-martin', '{"name":"Sin Modulo","attending":"si","adults":5}');
  assert (r ->> 'ok')::boolean, 'FALLO: ' || r::text;
  assert (select adults is null from public.rsvp_responses where name = 'Sin Modulo'), 'FALLO: guarda acompañantes sin el módulo';
  raise notice 'OK sin el módulo, el RSVP sencillo de siempre';
end $$;
reset role;

-- Resúmenes por email
update public.couple_users set digest = 'diario', last_digest_at = now() - interval '2 days';
set local role service_role;
do $$
declare d jsonb;
begin
  d := public.api_digests_due();
  assert jsonb_array_length(d) = 1 and jsonb_array_length(d -> 0 -> 'nuevas') >= 1, 'FALLO: resumen diario ' || d::text;
  perform public.api_digest_sent(array[(d -> 0 ->> 'couple_user_id')::uuid]);
  assert jsonb_array_length(public.api_digests_due()) = 0, 'FALLO: el resumen se repetiría';
  raise notice 'OK resumen diario de respuestas (y no se repite)';
end $$;
reset role;

-- Un usuario del equipo puede abrir el panel de la pareja (para ayudar).
set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
do $$ begin
  assert public.pareja_resumen('b0000000-0000-4000-8000-000000000002') #>> '{wedding,slug}' = 'marta-y-pablo', 'FALLO: equipo';
  assert public.soy_del_equipo(), 'FALLO: soy_del_equipo';
  raise notice 'OK el equipo puede ver el panel de cualquier pareja';
end $$;
reset role;

rollback;
