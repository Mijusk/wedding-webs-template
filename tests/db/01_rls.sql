-- Pruebas de seguridad por filas (RLS). Necesitan las semillas (supabase db reset).
-- Ejecutar: tests/db/run.sh   (todo ocurre en una transacción que se deshace al final)
begin;

-- Anónimo: no ve nada ni puede llamar a las funciones del servidor.
set local role anon;
do $$ begin
  begin
    perform 1 from public.leads limit 1;
    raise exception 'FALLO: anon ha podido leer leads';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.api_submit_lead('{"email":"x@example.com"}'::jsonb);
    raise exception 'FALLO: anon ha podido llamar a api_submit_lead';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.weddings limit 1;
    raise exception 'FALLO: anon ha podido leer bodas';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK anon: sin acceso a tablas ni a funciones del servidor';
end $$;
reset role;

-- Pareja (lucia@example.com): solo su boda, nada del CRM.
set local role authenticated;
set local request.jwt.claims to '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
do $$ begin
  assert (select count(*) from public.weddings) = 1, 'FALLO: la pareja debería ver solo su boda';
  assert (select slug from public.weddings) = 'lucia-y-martin', 'FALLO: la pareja ve una boda que no es suya';
  assert (select count(*) from public.leads) = 0, 'FALLO: la pareja ve leads';
  assert (select count(*) from public.clients) = 0, 'FALLO: la pareja ve clientes';
  assert (select count(*) from public.settings) = 0, 'FALLO: la pareja ve ajustes';
  assert (select count(*) from public.rsvp_responses) = 6, 'FALLO: la pareja debería ver sus 6 respuestas';
  assert (select count(*) from public.rsvp_current) = 5, 'FALLO: la vista de respuestas vigentes debería dar 5';
  assert (select count(*) from public.guest_groups) = 2, 'FALLO: la pareja debería ver sus grupos de invitados';
  -- No puede cambiar la boda directamente (eso irá por su panel, con campos limitados).
  update public.weddings set notes = 'hackeo' where slug = 'lucia-y-martin';
  assert (select notes from public.weddings where slug = 'lucia-y-martin') is distinct from 'hackeo', 'FALLO: la pareja ha cambiado su boda';
  begin
    perform public.dashboard_summary();
    raise exception 'FALLO: la pareja ha abierto el resumen del panel';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK pareja: solo ve su boda, sus invitados y sus respuestas';
end $$;
reset role;

-- Otra persona con cuenta pero sin boda ni equipo: nada.
set local role authenticated;
set local request.jwt.claims to '{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}';
do $$ begin
  assert (select count(*) from public.weddings) = 0, 'FALLO: un usuario cualquiera ve bodas';
  assert (select count(*) from public.rsvp_responses) = 0, 'FALLO: un usuario cualquiera ve respuestas';
  assert (select count(*) from public.staff) = 0, 'FALLO: un usuario cualquiera ve el equipo';
  raise notice 'OK usuario sin permisos: no ve nada';
end $$;
reset role;

-- Editor del equipo: CRM sí; ajustes, equipo y facturas no.
set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
do $$ begin
  assert (select count(*) from public.leads) >= 10, 'FALLO: el editor debería ver los leads';
  assert (select count(*) from public.weddings) = 3, 'FALLO: el editor debería ver todas las bodas';
  update public.settings set value = '{}'::jsonb where key = 'plazos';
  assert (select value ->> 'entrega_dias' from public.settings where key = 'plazos') = '3', 'FALLO: el editor ha cambiado ajustes';
  assert (select count(*) from public.invoices) = 0, 'FALLO: el editor ve facturas';
  begin
    delete from public.leads where id = 'a0000000-0000-4000-8000-000000000007';
    assert (select count(*) from public.leads where id = 'a0000000-0000-4000-8000-000000000007') = 1, 'FALLO: el editor ha borrado un lead';
  end;
  insert into public.tasks (title) values ('Tarea del editor');
  assert exists (select 1 from public.tasks where title = 'Tarea del editor' and created_by is not null), 'FALLO: la tarea no apunta quién la creó';
  raise notice 'OK editor: CRM sí; ajustes, borrados y facturas no';
end $$;
reset role;

-- Dueño: todo.
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
do $$ begin
  update public.settings set value = value || '{"entrega_dias": 4}'::jsonb where key = 'plazos';
  assert (select value ->> 'entrega_dias' from public.settings where key = 'plazos') = '4', 'FALLO: el dueño no puede cambiar ajustes';
  assert (select count(*) from public.audit_log where table_name = 'settings') >= 1, 'FALLO: el cambio no ha quedado en el registro';
  raise notice 'OK dueño: puede cambiar ajustes y queda registrado';
end $$;
reset role;

rollback;
