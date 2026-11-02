-- Pruebas de la fase 5: qué emails tocan (y cuáles no), que no se repitan, bajas y retención.
begin;

-- Todas activas «desde hace un mes» y enlaces de reseñas puestos.
update public.automations set enabled = true;
update public.automations set enabled_at = now() - interval '30 days';
update public.settings set value = '{"google":"https://g.page/r/ejemplo","bodas_net":""}' where key = 'resenas';

-- Leads de prueba: con consentimiento, sin él, dado de baja, antiguo, frío y perdido hace 13 meses.
insert into public.leads (id, names, partner_a, partner_b, email, source, trials, style, wedding_date, venue, city, created_at, status_changed_at, updated_at) values
  ('a1000000-0000-4000-8000-000000000001', 'Ana y Bea', 'Ana', 'Bea', 'ana.bea@example.com', 'prueba', 1, 'verbena', '2027-06-05', 'Masía Can Prat, Sabadell', 'Sabadell', now() - interval '3 days', now() - interval '3 days', now() - interval '3 days'),
  ('a1000000-0000-4000-8000-000000000002', 'Sin permiso', 'Ce', 'De', 'sin.permiso@example.com', 'prueba', 1, 'verbena', '2027-06-05', 'X', null, now() - interval '3 days', now() - interval '3 days', now() - interval '3 days'),
  ('a1000000-0000-4000-8000-000000000003', 'De baja', 'Eu', 'Fe', 'de.baja@example.com', 'prueba', 1, 'verbena', '2027-06-05', 'X', null, now() - interval '3 days', now() - interval '3 days', now() - interval '3 days'),
  ('a1000000-0000-4000-8000-000000000004', 'Antiguos', 'Ge', 'Ha', 'antiguos@example.com', 'prueba', 1, 'verbena', '2027-06-05', 'X', null, now() - interval '40 days', now() - interval '40 days', now() - interval '40 days'),
  ('a1000000-0000-4000-8000-000000000005', 'Recién', 'Ia', 'Jo', 'recien@example.com', 'prueba', 1, 'lacre', '2027-06-05', 'X', null, now(), now(), now()),
  ('a1000000-0000-4000-8000-000000000006', 'Fríos', 'Ka', 'Lu', 'frios@example.com', 'prueba', 1, 'verbena', '2027-06-05', 'X', null, now() - interval '11 days', now() - interval '11 days', now() - interval '11 days');
insert into public.leads (id, names, email, source, status, lost_reason, created_at, status_changed_at, updated_at) values
  ('a1000000-0000-4000-8000-000000000007', 'Perdidos', 'perdidos@example.com', 'prueba', 'perdido', 'Otra web', now() - interval '14 months', now() - interval '13 months', now() - interval '13 months');
insert into public.consents (lead_id, email, purpose, granted, text)
select id, email, 'contacto_comercial', true, 'Acepto que me escribáis' from public.leads
 where id in ('a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003',
              'a1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000006');

-- Boda de Lucía y Martín: plazo de confirmación dentro de 3 días; Familia Ortega (con email) no ha contestado.
update public.wedding_versions set config = jsonb_set(config, '{rsvp,deadline}', to_jsonb(((now() at time zone 'Europe/Madrid')::date + 3)::text))
 where id = (select published_version_id from public.weddings where slug = 'lucia-y-martin');
-- Su web se retira dentro de 10 días (el aviso es 30 días antes) y los datos de Sara y Jon ya caducaron.
update public.weddings set retire_at = (now() at time zone 'Europe/Madrid')::date + 10 where slug = 'lucia-y-martin';
update public.weddings set retire_at = (now() at time zone 'Europe/Madrid')::date - 1,
       guest_data_delete_at = (now() at time zone 'Europe/Madrid')::date - 1 where slug = 'sara-y-jon';
insert into public.guest_groups (wedding_id, name, email) select id, 'Invitados de Sara', 'invitado.sara@example.com' from public.weddings where slug = 'sara-y-jon';
-- El pedido de Marta y Pablo se pagó hace 3 días y su web aún no tiene fotos.
update public.orders set paid_at = now() - interval '3 days' where tracking_code = 'DEMB2345';

set local role service_role;
do $$
declare
  due jsonb; ev jsonb; r jsonb; k text;
  codes text[];
begin
  perform public.api_optout('De.Baja@example.com', 'prueba');
  assert app.opted_out('de.baja@example.com'), 'FALLO: baja no guardada';
  assert exists (select 1 from public.consents where email = 'de.baja@example.com' and not granted), 'FALLO: la baja no queda en los consentimientos';

  due := public.api_automation_due();
  codes := array(select e ->> 'code' || '|' || (e ->> 'key') from jsonb_array_elements(due) e);

  assert 'lead_recordatorio_1|lead:a1000000-0000-4000-8000-000000000001' = any(codes), 'FALLO: recordatorio a los 2 días ' || due::text;
  assert not exists (select 1 from jsonb_array_elements(due) e where e ->> 'key' = 'lead:a1000000-0000-4000-8000-000000000002'), 'FALLO: lead sin consentimiento';
  assert not exists (select 1 from jsonb_array_elements(due) e where e ->> 'key' = 'lead:a1000000-0000-4000-8000-000000000003'), 'FALLO: lead dado de baja';
  assert not exists (select 1 from jsonb_array_elements(due) e where e ->> 'key' = 'lead:a1000000-0000-4000-8000-000000000004'), 'FALLO: lead de hace 40 días';
  assert not exists (select 1 from jsonb_array_elements(due) e where e ->> 'code' = 'lead_recordatorio_2' and e ->> 'key' = 'lead:a1000000-0000-4000-8000-000000000001'),
    'FALLO: el recordatorio de 7 días a los 3';
  assert 'lead_bienvenida|lead:a1000000-0000-4000-8000-000000000005' = any(codes), 'FALLO: bienvenida al lead recién llegado';
  assert not ('lead_bienvenida|lead:a1000000-0000-4000-8000-000000000001' = any(codes)), 'FALLO: bienvenida con 3 días de retraso';
  raise notice 'OK leads: solo con permiso, sin baja, y nada del histórico';

  r := (select e from jsonb_array_elements(due) e where e ->> 'code' = 'lead_recordatorio_1'
          and e ->> 'key' = 'lead:a1000000-0000-4000-8000-000000000001');
  assert r -> 'vars' ->> 'nombres' = 'Ana y Bea' and r -> 'vars' ->> 'precio_desde' = '79 €' and r -> 'link' ->> 'type' = 'prueba',
    'FALLO: datos del email ' || r::text;

  assert exists (select 1 from jsonb_array_elements(due) e where e ->> 'code' = 'faltan_fotos' and e -> 'link' ->> 'code' = 'DEMB2345'), 'FALLO: faltan fotos';
  assert exists (select 1 from jsonb_array_elements(due) e where e ->> 'code' = 'web_publicada' and e ->> 'email' = 'lucia@example.com'), 'FALLO: web publicada';
  assert exists (select 1 from jsonb_array_elements(due) e where e ->> 'code' = 'rsvp_recordatorio' and e ->> 'email' = 'ortega@example.com'
                 and e -> 'link' ->> 'token' = 'demo-familia-ortega-0000000001'), 'FALLO: recordatorio a invitados';
  assert not exists (select 1 from jsonb_array_elements(due) e where e ->> 'code' = 'rsvp_cerrado'), 'FALLO: plazo cerrado antes de tiempo';
  assert exists (select 1 from jsonb_array_elements(due) e where e ->> 'code' = 'retirada_aviso' and e ->> 'email' = 'lucia@example.com'), 'FALLO: aviso de retirada';
  raise notice 'OK parejas e invitados: faltan fotos, web publicada, recordatorio de RSVP y aviso de retirada';

  -- Reservar el envío: el segundo intento (otro aviso a la vez) no vuelve a mandarlo.
  assert public.api_automation_claim((r ->> 'automation_id')::uuid, r ->> 'key'), 'FALLO: reservar';
  assert not public.api_automation_claim((r ->> 'automation_id')::uuid, r ->> 'key'), 'FALLO: reservado dos veces';
  perform public.api_automation_done(r || '{"status":"simulado"}'::jsonb);
  assert not exists (select 1 from jsonb_array_elements(public.api_automation_due()) e where e ->> 'code' = 'lead_recordatorio_1'
                     and e ->> 'key' = r ->> 'key'), 'FALLO: se repite';
  assert (select status from public.automation_runs where dedupe_key = r ->> 'key' and automation_id = (r ->> 'automation_id')::uuid) = 'simulado', 'FALLO: registro';
  raise notice 'OK cada envío se apunta y no se repite';

  ev := public.api_automation_event('lead_bienvenida', 'a1000000-0000-4000-8000-000000000005');
  assert jsonb_array_length(ev) = 1, 'FALLO: evento de bienvenida ' || ev::text;
  assert jsonb_array_length(public.api_automation_event('lead_bienvenida', 'a1000000-0000-4000-8000-000000000002')) = 0, 'FALLO: evento sin permiso';

  -- Vista previa guardada del lead (sin fotos).
  r := public.api_lead_preview((select preview_token from public.leads where id = 'a1000000-0000-4000-8000-000000000001'));
  assert r ->> 'venue' = 'Masía Can Prat' and r ->> 'city' = 'Sabadell' and r -> 'couple' ->> 0 = 'Ana' and r ->> 'style' = 'verbena',
    'FALLO: vista previa ' || coalesce(r::text, 'null');
  assert public.api_lead_preview('corta') is null, 'FALLO: clave corta';
  raise notice 'OK la web que probaron se puede volver a abrir con su clave';

  -- Apagada = no toca.
  reset role;
  update public.automations set enabled = false where code = 'faltan_fotos';
  set local role service_role;
  assert not exists (select 1 from jsonb_array_elements(public.api_automation_due()) e where e ->> 'code' = 'faltan_fotos'), 'FALLO: apagada';

  -- Tareas y retención.
  r := public.api_automation_sweep();
  assert (r ->> 'tareas')::int >= 1 and exists (select 1 from public.tasks where auto_key = 'frio:a1000000-0000-4000-8000-000000000006'), 'FALLO: lead frío ' || r::text;
  assert (select status from public.weddings where slug = 'sara-y-jon') = 'retirada', 'FALLO: web no retirada';
  assert not exists (select 1 from public.guest_groups g join public.weddings w on w.id = g.wedding_id where w.slug = 'sara-y-jon'), 'FALLO: invitados no borrados';
  assert exists (select 1 from public.guest_groups g join public.weddings w on w.id = g.wedding_id where w.slug = 'lucia-y-martin'), 'FALLO: ha borrado invitados de otra boda';
  assert (select anonymized_at is not null and email is null and names = '' from public.leads where id = 'a1000000-0000-4000-8000-000000000007'), 'FALLO: lead no anonimizado';
  assert (select anonymized_at is null from public.leads where id = 'a1000000-0000-4000-8000-000000000001'), 'FALLO: ha anonimizado un lead reciente';
  assert (select count(*) from public.invoices) = (select count(*) from public.invoices), 'las facturas no se tocan';
  r := public.api_automation_sweep();
  assert (r ->> 'tareas')::int = 0 and (r ->> 'webs_retiradas')::int = 0 and (r ->> 'invitados_borrados')::int = 0 and (r ->> 'leads_anonimizados')::int = 0,
    'FALLO: la segunda pasada repite ' || r::text;
  raise notice 'OK retención: web retirada, invitados borrados y lead anonimizado; la segunda pasada no hace nada';
end $$;
reset role;

-- Permisos: el editor ve pero no cambia; nadie fuera del servidor calcula envíos.
set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
do $$
declare n integer;
begin
  assert (select count(*) from public.automations) = 15, 'FALLO: el editor no ve las automatizaciones';
  update public.automations set enabled = false where code = 'lead_bienvenida';
  get diagnostics n = row_count;
  assert n = 0, 'FALLO: un editor ha cambiado una automatización';
  begin
    perform public.api_automation_due();
    raise exception 'FALLO: el panel calcula envíos';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK permisos: solo el dueño y los administradores cambian las automatizaciones';
end $$;
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
do $$
declare n integer;
begin
  update public.automations set body = body || ' ¡Gracias!' where code = 'lead_bienvenida';
  get diagnostics n = row_count;
  assert n = 1, 'FALLO: el dueño no puede editar';
end $$;
reset role;

rollback;
