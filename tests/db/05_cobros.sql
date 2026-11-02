-- Pruebas de la fase 4: pagar desde el escaparate, pagos, facturas desde el pedido, devoluciones
-- con rectificativa, página de seguimiento, propuestas, rondas de cambios y permisos.
begin;

-- Datos fiscales de ejemplo (sin ellos no se puede facturar: se comprueba también).
update public.settings set value = value || '{"nombre":"Luis Demo","nif":"12345678Z","direccion":"Calle Falsa 1, Sant Cugat","email":"hola@example.com","telefono":"600000000"}'::jsonb
 where key = 'vendedor';

set local role service_role;
do $$
declare
  r jsonb; t jsonb; oid uuid; code text; o public.orders; inv public.invoices;
  y text := extract(year from now() at time zone 'Europe/Madrid')::text;
  base jsonb := '{"email":"nuria@example.com","name":"Nuria y Álex","phone":"600111222","tier":"tal-cual","style":"editorial",
                  "weddingDate":"2027-06-12 18:00","startNow":true,
                  "startNowText":"Queremos que empecéis ya. Sabemos que, una vez entregada la web, perdemos el derecho de desistimiento."}';
begin
  -- Días laborables: viernes + 3 = miércoles; el puente de diciembre no cuenta.
  assert app.business_days_after('2026-10-23', 3) = '2026-10-28', 'FALLO: días laborables (fin de semana)';
  assert app.business_days_after('2026-12-04', 3) = '2026-12-10', 'FALLO: días laborables (festivos)';
  raise notice 'OK entrega en días laborables, sin fines de semana ni festivos nacionales';

  -- Escaparate: A medida no se paga al momento; sin aceptar «empezar ya», tampoco.
  assert public.api_checkout_start(base || '{"tier":"a-medida"}') ->> 'error' = 'tarifa', 'FALLO: A medida con pago al momento';
  assert public.api_checkout_start(base || '{"startNow":false}') ->> 'error' = 'empezar_ya', 'FALLO: sin consentimiento de empezar ya';
  assert public.api_checkout_start(base || '{"billing":{"nif":"12345678Z"}}') ->> 'error' = 'factura', 'FALLO: factura a nombre sin dirección';

  r := public.api_checkout_start(base, '203.0.113.7', 'prueba');
  assert (r ->> 'ok')::boolean, 'FALLO: checkout ' || r::text;
  oid := (r ->> 'order_id')::uuid; code := r ->> 'tracking_code';
  assert code ~ '^[2-9A-HJKMNP-Z]{8}$', 'FALLO: código de seguimiento ' || code;
  assert (r ->> 'total_cents')::int = 7900, 'FALLO: precio de Tal cual';
  select * into o from public.orders where id = oid;
  assert o.status = 'pendiente_pago' and o.source = 'escaparate' and o.start_now_at is not null, 'FALLO: pedido pendiente';
  assert (select status from public.leads where id = o.lead_id) = 'esperando_pago', 'FALLO: el lead no pasa a esperando pago';
  assert exists (select 1 from public.consents where lead_id = o.lead_id and purpose = 'inicio_inmediato'), 'FALLO: consentimiento no guardado';
  -- Si vuelven atrás y pagan otra vez, mismo pedido.
  assert public.api_checkout_start(base) ->> 'order_id' = oid::text, 'FALLO: segundo intento crea otro pedido';
  raise notice 'OK escaparate: pedido % pendiente con código %', o.number, code;

  -- Cobrar: lo que se enseña antes de pagar.
  t := public.api_order_for_payment(lower(left(code, 4) || '-' || right(code, 4)));
  assert (t ->> 'payable')::boolean and (t ->> 'due_cents')::int = 7900, 'FALLO: datos para cobrar ' || coalesce(t::text, 'null');
  perform public.api_checkout_session(oid, 'cs_test_1', 'https://checkout.stripe.com/c/pay/cs_test_1', now() + interval '23 hours');

  -- Pago (webhook de Stripe): pagado, entrega en 3 días laborables, tarea y factura simplificada.
  r := public.api_payment_succeeded(jsonb_build_object('order_id', oid, 'external_id', 'pi_test_1', 'amount_cents', 7900));
  assert (r ->> 'became_paid')::boolean and r ->> 'status' = 'pagado', 'FALLO: pago ' || r::text;
  assert (r -> 'invoice' ->> 'ok')::boolean and r -> 'invoice' ->> 'number' = 'WS-' || y || '-0001', 'FALLO: factura ' || r::text;
  assert (r ->> 'promised_delivery_at')::date = app.business_days_after((now() at time zone 'Europe/Madrid')::date, 3), 'FALLO: fecha de entrega';
  assert exists (select 1 from public.tasks where auto_key = 'preparar:' || oid and status = 'pendiente'), 'FALLO: tarea de preparar';
  assert (select status from public.leads where id = o.lead_id) = 'ganado', 'FALLO: el lead no pasa a ganado';
  select * into inv from public.invoices where order_id = oid;
  assert inv.kind = 'simplificada' and inv.total_cents = 7900 and inv.base_cents = 6529, 'FALLO: importes de la simplificada';
  -- El mismo aviso dos veces no cobra dos veces.
  assert (public.api_payment_succeeded(jsonb_build_object('order_id', oid, 'external_id', 'pi_test_1', 'amount_cents', 7900)) ->> 'repetido')::boolean,
    'FALLO: pago repetido';
  assert (select count(*) from public.payments where order_id = oid) = 1, 'FALLO: pago duplicado';
  raise notice 'OK pago: pedido pagado, entrega el %, factura %', r ->> 'promised_delivery_at', r -> 'invoice' ->> 'number';

  -- Devolución parcial: rectificativa por la diferencia; luego el resto.
  r := public.api_payment_refunded('{"external_id":"pi_test_1","refunded_cents":2000,"reason":"Descuento acordado"}');
  assert (r -> 'corrective' ->> 'ok')::boolean and r -> 'corrective' ->> 'number' = 'R-' || y || '-0001', 'FALLO: rectificativa ' || r::text;
  assert (select total_cents from public.invoices where full_number = 'R-' || y || '-0001') = -2000, 'FALLO: importe rectificativa';
  assert (select paid_cents from public.orders where id = oid) = 5900, 'FALLO: pagado tras devolución parcial';
  assert (public.api_payment_refunded('{"external_id":"pi_test_1","refunded_cents":2000}') ->> 'nada')::boolean, 'FALLO: devolución repetida';
  r := public.api_payment_refunded('{"external_id":"pi_test_1","refunded_cents":7900,"reason":"Desistimiento"}');
  assert (select total_cents from public.invoices where full_number = 'R-' || y || '-0002') = -5900, 'FALLO: segunda rectificativa';
  assert (select status from public.orders where id = oid) = 'reembolsado', 'FALLO: pedido reembolsado';
  raise notice 'OK devoluciones: rectificativas de -20,00 € y -59,00 €; pedido reembolsado';

  -- Factura completa si piden factura a su nombre.
  r := public.api_checkout_start(base || '{"email":"carmen@example.com","name":"Carmen y Luis","tier":"con-cambios",
           "billing":{"nombre":"Carmen Ruiz","nif":"00000001R","direccion":"Calle Mayor 2","codigo_postal":"28001","ciudad":"Madrid"}}');
  r := public.api_payment_succeeded(jsonb_build_object('order_id', r ->> 'order_id', 'external_id', 'pi_test_2', 'amount_cents', 13900));
  assert r -> 'invoice' ->> 'number' = 'WW-' || y || '-0001', 'FALLO: factura completa ' || r::text;
  assert (select recipient ->> 'nif' from public.invoices where full_number = 'WW-' || y || '-0001') = '00000001R', 'FALLO: NIF en la factura';
  raise notice 'OK factura completa con NIF: %', r -> 'invoice' ->> 'number';

  -- Seguimiento de la boda de ejemplo: propuesta 1 y un cambio pedido.
  t := public.api_tracking('dema-2345');
  assert t ->> 'number' = 'P-2026-0001' and jsonb_array_length(t -> 'proposals') = 1 and jsonb_array_length(t -> 'requests') = 1,
    'FALLO: seguimiento ' || coalesce(t::text, 'null');
  assert t -> 'plan' ->> 'code' = 'con-cambios' and t -> 'rounds' ->> 'included' is null and (t -> 'rounds' ->> 'used')::int = 1, 'FALLO: rondas';
  assert public.api_tracking('ZZZZ-ZZZZ') is null, 'FALLO: código inexistente';
  assert (public.api_public_proposal('DEMA2345', 1) ->> 'proposal')::int = 1, 'FALLO: ver la propuesta';
  assert public.api_public_proposal('DEMB2345', 1) is null, 'FALLO: propuesta de otra boda';
  raise notice 'OK seguimiento con código, sin contraseña';

  -- Tal cual: 0 rondas de diseño, pero corregir datos siempre.
  insert into public.wedding_proposals (wedding_id, order_id, number, template, config)
  select wedding_id, id, 1, 'clasica', '{}'::jsonb from public.orders where tracking_code = 'DEMB2345';
  r := public.api_tracking_request('DEMB2345', 'cambio', 'Otro color de fondo, por favor');
  assert r ->> 'error' = 'sin_rondas', 'FALLO: cambio de diseño en Tal cual ' || r::text;
  r := public.api_tracking_request('DEMB2345', 'correccion', 'La boda es a las 18:30, no a las 18:00');
  assert (r ->> 'ok')::boolean, 'FALLO: corrección ' || r::text;
  assert exists (select 1 from public.tasks where auto_key = 'cambios:' || (select id from public.orders where tracking_code = 'DEMB2345')),
    'FALLO: tarea de cambios';
  assert public.api_tracking_request('DEMB2345', 'cambio', 'x') ->> 'error' = 'mensaje', 'FALLO: mensaje vacío';
  raise notice 'OK rondas: Tal cual no admite cambios de diseño; las correcciones, siempre';
end $$;
reset role;

-- El panel manda una propuesta nueva: los cambios pedidos quedan hechos y la pareja aprueba.
set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
do $$
declare r jsonb;
begin
  r := public.send_proposal('b0000000-0000-4000-8000-000000000001', 'Programa antes que el lugar y titular más grande.');
  assert (r ->> 'number')::int = 2 and (r ->> 'resolved')::int = 1 and r ->> 'tracking_code' = 'DEMA2345', 'FALLO: mandar propuesta ' || r::text;
  assert r -> 'emails' ? 'lucia@example.com', 'FALLO: emails de la pareja';
  assert (select status from public.change_requests where order_id = 'e0000000-0000-4000-8000-000000000001' limit 1) = 'hecho', 'FALLO: cambio resuelto';
  raise notice 'OK propuesta 2 mandada (el editor también puede); el cambio pedido queda hecho';
  begin
    perform public.invoice_order('e0000000-0000-4000-8000-000000000001');
    raise exception 'FALLO: un editor ha facturado';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set local role service_role;
do $$
declare r jsonb;
begin
  assert public.api_tracking_approve('DEMA2345', 1) ->> 'error' = 'propuesta', 'FALLO: aprobar una propuesta antigua';
  r := public.api_tracking_approve('DEMA2345', 2);
  assert (r ->> 'ok')::boolean and exists (select 1 from public.tasks where auto_key = 'publicar:e0000000-0000-4000-8000-000000000001' and status = 'pendiente'),
    'FALLO: aprobar ' || r::text;
  raise notice 'OK la pareja aprueba la propuesta 2 y a Luis le sale la tarea de publicar';
end $$;
reset role;

-- Publicar = entregar: el pedido pasa a entregado y la tarea se cierra.
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
do $$
declare inv public.invoices;
begin
  update public.weddings set status = 'vista_previa' where id = 'b0000000-0000-4000-8000-000000000001';
  perform public.publish_wedding('b0000000-0000-4000-8000-000000000001', 'Aprobada');
  assert (select status from public.orders where id = 'e0000000-0000-4000-8000-000000000001') = 'entregado', 'FALLO: pedido entregado';
  assert not exists (select 1 from public.tasks where auto_key = 'publicar:e0000000-0000-4000-8000-000000000001' and status = 'pendiente'),
    'FALLO: tarea de publicar sigue abierta';
  raise notice 'OK publicar la web entrega el pedido';

  -- Pago apuntado a mano (Bizum) y factura desde el panel.
  inv := public.invoice_order('e0000000-0000-4000-8000-000000000002');
  assert inv.status = 'emitida' and inv.kind = 'simplificada', 'FALLO: factura desde el panel';
  begin
    perform public.refund_payment((select id from public.payments where external_id = 'pi_test_2'), 100, 'x');
    raise exception 'FALLO: devolver a mano un pago de Stripe';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if;
  end;
  raise notice 'OK factura % desde el panel; los pagos de Stripe se devuelven en Stripe', inv.full_number;
end $$;
reset role;

-- Permisos: la pareja y el público no leen propuestas, cambios ni pedidos.
set local role authenticated;
set local request.jwt.claims to '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
do $$
begin
  assert (select count(*) from public.wedding_proposals) = 0, 'FALLO: la pareja lee propuestas directamente';
  assert (select count(*) from public.change_requests) = 0, 'FALLO: la pareja lee cambios directamente';
  assert (select count(*) from public.orders) = 0, 'FALLO: la pareja lee pedidos (y sus códigos)';
  begin
    perform public.api_tracking('DEMA2345');
    raise exception 'FALLO: la pareja llama a api_tracking';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.send_proposal('b0000000-0000-4000-8000-000000000001');
    raise exception 'FALLO: la pareja manda propuestas';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK permisos: todo pasa por el servidor';
end $$;
reset role;

set local role anon;
do $$
begin
  begin
    perform 1 from public.change_requests limit 1;
    raise exception 'FALLO: anon lee cambios';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.api_checkout_start('{}'::jsonb);
    raise exception 'FALLO: anon empieza un pago';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
