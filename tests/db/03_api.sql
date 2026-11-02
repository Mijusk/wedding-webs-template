-- Pruebas de las funciones que usa la web pública (api_*) y el panel.
begin;

set local role service_role;
do $$
declare
  r jsonb; r2 jsonb; lid uuid;
begin
  -- Web pública: la publicada sale de su versión; los borradores no se ven.
  r := public.api_public_wedding('lucia-y-martin');
  assert r ->> 'template' = 'editorial' and (r ->> 'version')::int = 1, 'FALLO: boda publicada';
  assert public.api_public_wedding('marta-y-pablo') is null, 'FALLO: un borrador se ve en público';
  assert public.api_public_wedding('no-existe') is null, 'FALLO: slug inexistente';
  assert (public.api_public_wedding('marta-y-pablo', (select preview_token from public.weddings where slug = 'marta-y-pablo')) ->> 'draft')::boolean,
    'FALLO: vista previa del borrador con su clave';
  assert public.api_public_wedding('marta-y-pablo', 'clave-equivocada-1234567890') is null, 'FALLO: vista previa con clave falsa';
  assert public.api_public_wedding('LUCIA-Y-MARTIN') ->> 'slug' = 'lucia-y-martin', 'FALLO: mayúsculas en el slug';
  raise notice 'OK web pública: publicada sí, borrador solo con vista previa';

  -- RSVP
  r := public.api_submit_rsvp('lucia-y-martin', '{"name":"  Ana   Pérez ","attending":"si","song":"Bailando"}', 'hash', 'test');
  assert (r ->> 'ok')::boolean, 'FALLO: RSVP válido rechazado: ' || r::text;
  assert exists (select 1 from public.rsvp_responses where name = 'Ana Pérez' and name_key = 'ana perez' and attending),
    'FALLO: RSVP no guardado o nombre sin limpiar';
  r := public.api_submit_rsvp('lucia-y-martin', '{"name":"Ana","attending":"quizas"}');
  assert r ->> 'error' = 'asistencia', 'FALLO: asistencia no válida aceptada';
  r := public.api_submit_rsvp('lucia-y-martin', '{"name":"A","attending":"si"}');
  assert r ->> 'error' = 'nombre', 'FALLO: nombre corto aceptado';
  r := public.api_submit_rsvp('sara-y-jon', '{"name":"Ana Pérez","attending":"si"}');
  assert r ->> 'error' = 'cerrado', 'FALLO: RSVP de una boda pasada aceptado';
  r := public.api_submit_rsvp('marta-y-pablo', '{"name":"Ana Pérez","attending":"si"}');
  assert r ->> 'error' = 'no_existe', 'FALLO: RSVP en un borrador aceptado';
  raise notice 'OK RSVP: guarda, valida y respeta el cierre';

  -- Leads del escaparate: nuevo, repetición y atribución.
  r := public.api_submit_lead('{"type":"prueba","email":" Nueva.Pareja@Example.com ","name":"Bea y Leo","nameA":"Bea","nameB":"Leo",
    "weddingDate":"2027-06-05 18:30","venue":"Finca Prueba","city":"Toledo","style":"minimal","photos":2,
    "consent":true,"consentText":"Acepto que me escribáis sobre mi web.","page":"/studio/",
    "attribution":{"first":{"utm_source":"google","utm_campaign":"otono","gclid":"abc","landing_page":"/studio/?utm_source=google"},
                   "last":{"utm_source":"google","utm_campaign":"otono"}}}', '203.0.113.5', 'test');
  assert (r ->> 'ok')::boolean and (r ->> 'is_new')::boolean, 'FALLO: lead nuevo ' || r::text;
  lid := (r ->> 'lead_id')::uuid;
  assert (select email from public.leads where id = lid) = 'nueva.pareja@example.com', 'FALLO: email sin normalizar';
  assert (select wedding_date = '2027-06-05' and wedding_time = '18:30' from public.leads where id = lid), 'FALLO: fecha de boda';
  assert (select count(*) from public.consents where lead_id = lid and ip = '203.0.113.5') = 1, 'FALLO: consentimiento';
  r2 := public.api_submit_lead('{"type":"prueba","email":"nueva.pareja@example.com","name":"Bea y Leo","style":"verbena",
    "attribution":{"first":{"utm_source":"meta"},"last":{"utm_source":"meta","utm_campaign":"reels"}}}');
  assert (r2 ->> 'lead_id')::uuid = lid and not (r2 ->> 'is_new')::boolean, 'FALLO: la repetición ha creado otro lead';
  assert (select trials from public.leads where id = lid) = 2 and (select style from public.leads where id = lid) = 'verbena',
    'FALLO: la repetición no actualiza el lead';
  assert (select utm_source from public.lead_attribution where lead_id = lid and touch = 'primero') = 'google', 'FALLO: primer toque sobrescrito';
  assert (select utm_campaign from public.lead_attribution where lead_id = lid and touch = 'ultimo') = 'reels', 'FALLO: último toque';
  r2 := public.api_submit_lead('{"type":"reserva","email":"nueva.pareja@example.com","name":"Bea y Leo","tier":"con-cambios","phone":"600 111 222","message":"¿Podéis en verde?"}');
  assert (select tier = 'con-cambios' and reserved_at is not null and phone = '600 111 222' from public.leads where id = lid), 'FALLO: reserva';
  assert (select count(*) from public.activities where lead_id = lid) = 3, 'FALLO: línea de tiempo del lead';
  assert public.api_submit_lead('{"email":"sin-arroba"}') ->> 'error' = 'email', 'FALLO: email no válido aceptado';
  raise notice 'OK leads: nuevo, repetición sin duplicar, reserva y atribución primer/último toque';

  -- Límite de peticiones
  assert public.api_hit_rate_limit('prueba:ip1', 2, 60), 'FALLO: 1.ª petición';
  assert public.api_hit_rate_limit('prueba:ip1', 2, 60), 'FALLO: 2.ª petición';
  assert not public.api_hit_rate_limit('prueba:ip1', 2, 60), 'FALLO: la 3.ª debería bloquearse';
  raise notice 'OK límite de peticiones';

  assert jsonb_array_length(public.api_products()) = 3, 'FALLO: tarifas';
  assert (public.api_products() -> 0 ->> 'price_cents')::int = 7900, 'FALLO: precio de Tal cual';
  raise notice 'OK tarifas desde la base de datos';
end $$;
reset role;

-- Panel (como el dueño)
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
do $$
declare
  r jsonb; cid uuid; v1 uuid;
begin
  r := public.publish_wedding('b0000000-0000-4000-8000-000000000002', 'Primera versión');
  assert (r ->> 'version')::int = 1, 'FALLO: publicar';
  assert (select status from public.weddings where slug = 'marta-y-pablo') = 'publicada', 'FALLO: estado tras publicar';
  v1 := (r ->> 'version_id')::uuid;
  update public.weddings set config = jsonb_set(config, '{event,tagline}', '"Cambio sin publicar"') where slug = 'marta-y-pablo';
  r := public.publish_wedding('b0000000-0000-4000-8000-000000000002');
  assert (r ->> 'version')::int = 2, 'FALLO: segunda versión';
  perform public.restore_wedding_version(v1);
  assert (select config #>> '{event,tagline}' from public.weddings where slug = 'marta-y-pablo')
       = (select config #>> '{event,tagline}' from public.wedding_versions where id = v1), 'FALLO: restaurar versión';
  perform public.unpublish_wedding('b0000000-0000-4000-8000-000000000002');
  assert (select status from public.weddings where slug = 'marta-y-pablo') = 'borrador', 'FALLO: despublicar';
  raise notice 'OK publicar, historial, volver a una versión y despublicar';

  cid := public.convert_lead_to_client('a0000000-0000-4000-8000-000000000005');
  assert (select status = 'ganado' and client_id = cid from public.leads where id = 'a0000000-0000-4000-8000-000000000005'), 'FALLO: convertir';
  assert (select display_name from public.clients where id = cid) = 'Paula y Marc', 'FALLO: datos del cliente';
  assert exists (select 1 from public.activities where lead_id = 'a0000000-0000-4000-8000-000000000005' and title like 'Estado:%Ganado'),
    'FALLO: el cambio de estado no está en la línea de tiempo';
  raise notice 'OK lead → cliente sin volver a teclear';

  assert public.suggest_slug('Lucía y Martín') = 'lucia-y-martin-2', 'FALLO: dirección sugerida ' || public.suggest_slug('Lucía y Martín');
  assert public.suggest_slug('Ñandú & Çelia') = 'nandu-celia', 'FALLO: slug con caracteres raros';
  assert (select count(*) from public.global_search('lucía')) >= 2, 'FALLO: buscador';
  assert exists (select 1 from public.global_search('00000000T') where kind = 'cliente'), 'FALLO: buscar por NIF';
  raise notice 'OK direcciones sugeridas y buscador global';

  r := public.import_leads('[{"fecha":"2026-09-01T10:00:00Z","tipo":"prueba","email":"hoja1@example.com","nombres":"Hoja y Uno","fecha_boda":"2027-05-01 18:00","estado":"Contactado"},
                            {"fecha":"01/09/2026 10:00:00","tipo":"reserva","email":"lucia@example.com","nombres":"Repetida"},
                            {"email":"mal"}]');
  assert (r ->> 'importados')::int = 1 and (r ->> 'repetidos')::int = 1 and jsonb_array_length(r -> 'errores') = 1,
    'FALLO: importador ' || r::text;
  assert (select status from public.leads where email = 'hoja1@example.com') = 'contactado', 'FALLO: estado importado';
  raise notice 'OK importador de la hoja de Google (sin duplicar)';

  r := public.dashboard_summary();
  assert (r ->> 'leads_nuevos_total')::int >= 2, 'FALLO: resumen de inicio';
  assert jsonb_array_length(r -> 'tareas') >= 2, 'FALLO: tareas de hoy en el resumen';
  raise notice 'OK resumen del inicio';
end $$;
reset role;

rollback;
