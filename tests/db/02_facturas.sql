-- Pruebas de facturación: importes, numeración sin huecos, inmutabilidad y cadena de huellas.
begin;

set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

do $$
declare
  inv1 uuid; inv2 uuid; inv3 uuid; r public.invoices; rect public.invoices;
  y text := extract(year from now() at time zone 'Europe/Madrid')::text;
  h1 text; h2 text;
begin
  -- Borrador con una línea de 79 € IVA incluido: base 65,29 + IVA 13,71.
  insert into public.invoices (client_id, recipient)
  values ('c0000000-0000-4000-8000-000000000001',
          '{"nombre":"Lucía Ortega Sanz","nif":"00000000T","direccion":"Calle Ejemplo 1","codigo_postal":"28300","ciudad":"Aranjuez","pais":"ES"}')
  returning id into inv1;
  insert into public.invoice_lines (invoice_id, description, unit_total_cents) values (inv1, 'Web de boda · Tal cual', 7900);
  select * into r from public.invoices where id = inv1;
  assert r.total_cents = 7900 and r.base_cents = 6529 and r.vat_cents = 1371,
    format('FALLO: importes %s/%s/%s', r.base_cents, r.vat_cents, r.total_cents);
  raise notice 'OK importes: 79,00 € = 65,29 + 13,71 de IVA';

  -- Sin datos fiscales del vendedor no se puede emitir.
  begin
    perform public.issue_invoice(inv1);
    raise exception 'FALLO: se ha emitido sin datos del vendedor';
  exception when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
  end;
  update public.settings set value = value || '{"nombre":"Luis Demo","nif":"12345678Z","direccion":"Calle Falsa 1, Sant Cugat"}'::jsonb
   where key = 'vendedor';

  -- Emitir: WW-<año>-0001
  r := public.issue_invoice(inv1);
  assert r.full_number = 'WW-' || y || '-0001', 'FALLO: número ' || r.full_number;
  assert r.status = 'emitida' and r.issuer ->> 'nif' = '12345678Z', 'FALLO: no ha copiado el emisor';
  raise notice 'OK emitida %', r.full_number;

  -- Un intento fallido (factura completa sin NIF del cliente) no gasta número.
  insert into public.invoices (client_id, recipient) values ('c0000000-0000-4000-8000-000000000003', '{"nombre":"Marta"}')
  returning id into inv2;
  insert into public.invoice_lines (invoice_id, description, unit_total_cents) values (inv2, 'Web de boda', 13900);
  begin
    perform public.issue_invoice(inv2);
    raise exception 'FALLO: se ha emitido una completa sin NIF';
  exception when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
  end;
  update public.invoices set recipient = recipient || '{"nif":"00000002W","direccion":"Calle Ejemplo 3"}'::jsonb where id = inv2;
  r := public.issue_invoice(inv2);
  assert r.full_number = 'WW-' || y || '-0002', 'FALLO: hay un hueco en la numeración: ' || r.full_number;
  raise notice 'OK sin huecos: el intento fallido no gastó número (%).', r.full_number;

  -- Inmutable: ni cambiar, ni borrar, ni tocar líneas.
  begin
    update public.invoices set total_cents = 1 where id = inv1;
    raise exception 'FALLO: se ha cambiado una factura emitida';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if;
  end;
  begin
    delete from public.invoices where id = inv1;
    raise exception 'FALLO: se ha borrado una factura emitida';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if;
  end;
  begin
    update public.invoice_lines set unit_total_cents = 1 where invoice_id = inv1;
    raise exception 'FALLO: se ha cambiado una línea emitida';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if;
  end;
  raise notice 'OK inmutable: factura, líneas y registros no se pueden cambiar ni borrar';

  -- Cadena de huellas: cada registro apunta al anterior.
  select hash into h1 from public.invoicing_records where invoice_id = inv1 and record_type = 'alta';
  select previous_hash, hash into h2 from public.invoicing_records where invoice_id = inv2 and record_type = 'alta';
  assert h2 = h1, 'FALLO: el segundo registro no encadena con el primero';
  assert (select previous_hash from public.invoicing_records where invoice_id = inv1) is null, 'FALLO: el primero no debería tener anterior';
  assert (select hash_input from public.invoicing_records where invoice_id = inv1)
         like 'IDEmisorFactura=12345678Z&NumSerieFactura=WW-' || y || '-0001&FechaExpedicionFactura=%&TipoFactura=F1&CuotaTotal=13.71&ImporteTotal=79.00&Huella=&FechaHoraHusoGenRegistro=%',
         'FALLO: formato de la huella';
  assert (select hash from public.invoicing_records where invoice_id = inv1) ~ '^[0-9A-F]{64}$', 'FALLO: la huella no es SHA-256 en hexadecimal';
  raise notice 'OK cadena de huellas SHA-256 con el formato de la AEAT';

  -- Rectificativa (serie R) con importes en negativo, también encadenada.
  rect := public.create_corrective_invoice(inv1, 'Reembolso: la pareja canceló la boda');
  assert rect.total_cents = -7900 and rect.status = 'borrador', 'FALLO: borrador de rectificativa ' || rect.total_cents;
  rect := public.issue_invoice(rect.id);
  assert rect.full_number = 'R-' || y || '-0001', 'FALLO: número de rectificativa ' || rect.full_number;
  assert (select hash_input from public.invoicing_records where invoice_id = rect.id) like '%TipoFactura=R1&CuotaTotal=-13.71&ImporteTotal=-79.00%',
    'FALLO: huella de la rectificativa';
  raise notice 'OK rectificativa % de -79,00 €', rect.full_number;

  -- Anulación: registro de anulación encadenado y la factura queda anulada.
  r := public.cancel_invoice(inv2, 'Emitida por error');
  assert r.status = 'anulada', 'FALLO: no ha quedado anulada';
  assert (select count(*) from public.invoicing_records) = 4, 'FALLO: faltan registros';
  assert (select previous_hash from public.invoicing_records where record_type = 'anulacion')
       = (select hash from public.invoicing_records where invoice_id = rect.id), 'FALLO: la anulación no encadena';
  raise notice 'OK anulación encadenada';
end $$;
reset role;

-- Ni siquiera el servidor (que se salta la RLS) puede borrar o cambiar registros de facturación.
set local role service_role;
do $$ begin
  begin
    delete from public.invoicing_records;
    raise exception 'FALLO: se han borrado registros de facturación';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if;
  end;
  begin
    update public.invoicing_records set hash = 'x';
    raise exception 'FALLO: se ha cambiado una huella';
  exception when raise_exception then if sqlerrm like 'FALLO%' then raise; end if;
  end;
  update public.invoicing_records set status = 'aceptado', attempts = 1;
  assert (select bool_and(status = 'aceptado') from public.invoicing_records), 'FALLO: no se puede apuntar el estado de envío';
  raise notice 'OK registros: solo cambia el estado de envío';
end $$;
reset role;

-- Un editor no puede emitir.
set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
do $$ begin
  begin
    perform public.issue_invoice(gen_random_uuid());
    raise exception 'FALLO: un editor ha podido emitir';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK editor no emite facturas';
end $$;
reset role;

rollback;
