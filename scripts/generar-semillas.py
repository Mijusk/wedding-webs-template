#!/usr/bin/env python3
"""Genera supabase/seed.sql: datos ficticios para probar en local y en staging.
Nunca se aplica en producción (Supabase solo aplica seed.sql en local con `supabase db reset`).
Uso: python3 scripts/generar-semillas.py
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def cfg(template):
    path = os.path.join(ROOT, 'config.json' if template == 'clasica' else f'plantillas/{template}/config.json')
    with open(path, encoding='utf-8') as f:
        return json.load(f)

def lit(obj):
    return "'" + json.dumps(obj, ensure_ascii=False).replace("'", "''") + "'::jsonb"

# Bodas de ejemplo (las fotos de ejemplo de cada plantilla siguen valiendo: rutas relativas a la plantilla).
lucia = cfg('editorial'); lucia['theme'] = 'editorial'
ana = cfg('clasica'); ana['theme'] = 'olivar'
ana['event'].update({'couple': ['Ana', 'Pablo'], 'date': '2027-09-18T18:30:00+02:00', 'end': '2027-09-19T03:30:00+02:00',
                     'photoAlt': 'Ana y Pablo'})
ana['venue'].update({'name': 'Cortijo Los Almendros', 'address': 'Ronda, Málaga', 'city': 'Ronda',
                     'mapsUrl': 'https://www.google.com/maps/search/?api=1&query=Cortijo%20Los%20Almendros%2C%20Ronda'})
ana['gifts'] = {'holder': 'Ana Ruiz y Pablo Gil', 'iban': 'ES00 0000 0000 0000 0000 0000'}
ana['rsvp']['deadline'] = '2027-08-07'
sara = cfg('costa'); sara['theme'] = 'costa'
sara['event'].update({'couple': ['Sara', 'Jon'], 'date': '2026-09-12T19:00:00+02:00', 'end': '2026-09-13T03:00:00+02:00',
                      'photoAlt': 'Sara y Jon'})
sara['rsvp']['deadline'] = '2026-08-01'

out = f"""-- Datos FICTICIOS para probar (local y staging). Generado por scripts/generar-semillas.py: no editar a mano.
-- Usuario del panel en local: luis@example.com / demo-luis-1234 (dueño) y ayudante@example.com / demo-ayudante-1234 (editor).

-- Usuarios de acceso (solo en local: en Supabase de verdad se crean desde Authentication > Users).
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated',
   'luis@example.com', extensions.crypt('demo-luis-1234', extensions.gen_salt('bf')), now(),
   '{{"provider":"email","providers":["email"]}}', '{{}}', now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated',
   'ayudante@example.com', extensions.crypt('demo-ayudante-1234', extensions.gen_salt('bf')), now(),
   '{{"provider":"email","providers":["email"]}}', '{{}}', now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated',
   'lucia@example.com', extensions.crypt('demo-pareja-1234', extensions.gen_salt('bf')), now(),
   '{{"provider":"email","providers":["email"]}}', '{{}}', now(), now(), '', '', '', '', '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u where u.email like '%@example.com'
on conflict do nothing;

do $$ begin perform app.make_owner('luis@example.com', 'Luis (demo)'); end $$;
insert into public.staff (email, name, role, user_id)
values ('ayudante@example.com', 'Ayudante (demo)', 'editor', '22222222-2222-4222-8222-222222222222')
on conflict do nothing;

-- Clientes
insert into public.clients (id, display_name, email, phone, billing_name, tax_id, billing_address, postal_code, city, province) values
  ('c0000000-0000-4000-8000-000000000001', 'Lucía y Martín', 'lucia@example.com', '600000001', 'Lucía Ortega Sanz', '00000000T', 'Calle Ejemplo 1', '28300', 'Aranjuez', 'Madrid'),
  ('c0000000-0000-4000-8000-000000000002', 'Sara y Jon', 'sara@example.com', '600000002', 'Sara Etxeberria', '00000001R', 'Calle Ejemplo 2', '20001', 'Donostia', 'Gipuzkoa'),
  ('c0000000-0000-4000-8000-000000000003', 'Marta y Pablo', 'marta@example.com', '600000003', null, null, null, null, null, null);

-- Leads (de varios orígenes y estados)
insert into public.leads (id, names, partner_a, partner_b, email, phone, wedding_date, wedding_time, venue, city, style, tier,
                          source, status, lost_reason, trials, reserved_at, next_action, next_action_at, client_id, message, created_at) values
  ('a0000000-0000-4000-8000-000000000001', 'Elena y David', 'Elena', 'David', 'elena.david@example.com', null, '2027-05-22', '12:00', 'Iglesia de San Jerónimo', 'Madrid', 'capilla', null, 'prueba', 'nuevo', null, 1, null, null, null, null, null, now() - interval '2 hours'),
  ('a0000000-0000-4000-8000-000000000002', 'Irene y Sergio', 'Irene', 'Sergio', 'irene.sergio@example.com', '611000002', '2027-07-03', '19:00', 'Masia Can Riera', 'Sant Cugat', 'botanica', 'con-cambios', 'reserva', 'nuevo', null, 2, now() - interval '30 minutes', null, null, null, 'Queremos cambiar los colores a verde oliva.', now() - interval '1 day'),
  ('a0000000-0000-4000-8000-000000000003', 'Nuria y Álex', 'Nuria', 'Álex', 'nuria.alex@example.com', '611000003', '2027-06-19', '18:00', 'Finca La Alquería', 'Valencia', 'verbena', null, 'prueba', 'contactado', null, 1, null, 'Llamar para resolver dudas', now() + interval '3 hours', null, null, now() - interval '3 days'),
  ('a0000000-0000-4000-8000-000000000004', 'Carmen y Luis', 'Carmen', 'Luis', 'carmen.luis@example.com', '611000004', '2027-10-09', '13:00', 'Pazo de Vilane', 'Antas de Ulla', 'villa', 'tal-cual', 'whatsapp', 'propuesta', null, 0, null, 'Enviar propuesta con dos estilos', now() - interval '1 day', null, null, now() - interval '6 days'),
  ('a0000000-0000-4000-8000-000000000005', 'Paula y Marc', 'Paula', 'Marc', 'paula.marc@example.com', '611000005', '2027-04-24', '17:30', 'Hotel Mas Lazuli', 'Girona', 'acuarela', 'tal-cual', 'prueba', 'esperando_pago', null, 3, now() - interval '2 days', 'Recordar el pago', now() + interval '1 day', null, null, now() - interval '9 days'),
  ('a0000000-0000-4000-8000-000000000006', 'Lucía y Martín', 'Lucía', 'Martín', 'lucia@example.com', '600000001', '2027-06-12', '18:00', 'Finca El Olivar', 'Aranjuez', 'editorial', 'con-cambios', 'reserva', 'ganado', null, 2, now() - interval '20 days', null, null, 'c0000000-0000-4000-8000-000000000001', null, now() - interval '25 days'),
  ('a0000000-0000-4000-8000-000000000007', 'Rocío y Javier', 'Rocío', 'Javier', 'rocio.javier@example.com', null, '2027-08-28', '20:00', 'Cortijo El Sotillo', 'San José', 'costa', null, 'prueba', 'perdido', 'Ya tenían web de la wedding planner', 1, null, null, null, null, null, now() - interval '15 days'),
  ('a0000000-0000-4000-8000-000000000008', 'Marta y Pablo', 'Marta', 'Pablo', 'marta@example.com', '600000003', '2027-09-18', '18:30', 'Cortijo Los Almendros', 'Ronda', 'olivar', 'tal-cual', 'instagram', 'ganado', null, 1, now() - interval '5 days', null, null, 'c0000000-0000-4000-8000-000000000003', null, now() - interval '12 days'),
  ('a0000000-0000-4000-8000-000000000009', 'Laura y Daniel', 'Laura', 'Daniel', 'laura.daniel@example.com', null, '2028-05-13', '12:30', 'Monasterio de Piedra', 'Nuévalos', 'lacre', null, 'prueba', 'nuevo', null, 1, null, null, null, null, null, now() - interval '20 hours'),
  ('a0000000-0000-4000-8000-000000000010', 'Andrea y Hugo', 'Andrea', 'Hugo', null, '611000010', null, null, null, 'Bilbao', null, null, 'recomendacion', 'contactado', null, 0, null, 'Mandar ejemplos por WhatsApp', now() + interval '2 days', null, 'Viene recomendada por Sara y Jon.', now() - interval '4 days'),
  ('a0000000-0000-4000-8000-000000000011', 'Sara y Jon', 'Sara', 'Jon', 'sara@example.com', '600000002', '2026-09-12', '19:00', 'Faro de Igueldo', 'Donostia', 'costa', 'tal-cual', 'bodas_net', 'ganado', null, 1, null, null, null, 'c0000000-0000-4000-8000-000000000002', null, now() - interval '200 days');

insert into public.lead_attribution (lead_id, touch, utm_source, utm_medium, utm_campaign, landing_page, referrer, gclid, fbclid) values
  ('a0000000-0000-4000-8000-000000000001', 'primero', 'google', 'cpc', 'boda-2027-madrid', '/studio/?utm_source=google', 'https://www.google.com/', 'Cj0KCQ-demo', null),
  ('a0000000-0000-4000-8000-000000000001', 'ultimo', 'google', 'cpc', 'boda-2027-madrid', '/studio/', 'https://www.google.com/', 'Cj0KCQ-demo', null),
  ('a0000000-0000-4000-8000-000000000002', 'primero', 'instagram', 'paid', 'reels-otono', '/studio/', 'https://l.instagram.com/', null, 'IwAR-demo'),
  ('a0000000-0000-4000-8000-000000000005', 'primero', 'meta', 'paid', 'reels-otono', '/studio/plantillas.html', 'https://m.facebook.com/', null, 'IwAR-demo2'),
  ('a0000000-0000-4000-8000-000000000009', 'primero', 'google', 'organic', null, '/studio/', 'https://www.google.com/', null, null);

insert into public.consents (lead_id, email, purpose, text, source, ip) values
  ('a0000000-0000-4000-8000-000000000001', 'elena.david@example.com', 'contacto_comercial',
   'Acepto que me escribáis sobre mi web. Solo usaremos este email para eso, y podéis pedirnos que lo borremos cuando queráis (privacidad).',
   '/studio/', '192.0.2.10');

insert into public.activities (lead_id, kind, title, body, created_at) values
  ('a0000000-0000-4000-8000-000000000003', 'whatsapp', 'WhatsApp enviado', 'Les mando el enlace de su prueba y les pregunto la fecha límite del RSVP.', now() - interval '2 days'),
  ('a0000000-0000-4000-8000-000000000004', 'llamada', 'Llamada', 'Quieren ver Villa y Etiqueta. Les preparo propuesta.', now() - interval '5 days'),
  ('a0000000-0000-4000-8000-000000000005', 'email', 'Email con enlace de pago', null, now() - interval '2 days');

insert into public.tasks (title, due_at, status, lead_id, wedding_id) values
  ('Pedir las fotos a Lucía y Martín', now() - interval '1 day', 'pendiente', 'a0000000-0000-4000-8000-000000000006', null),
  ('Llamar a Nuria y Álex', now() + interval '3 hours', 'pendiente', 'a0000000-0000-4000-8000-000000000003', null),
  ('Preparar propuesta de Carmen y Luis', now() + interval '2 days', 'pendiente', 'a0000000-0000-4000-8000-000000000004', null),
  ('Revisar textos de Sara y Jon', now() - interval '60 days', 'hecha', 'a0000000-0000-4000-8000-000000000011', null);

-- Bodas
insert into public.weddings (id, slug, template, config, status, client_id, lead_id, notes) values
  ('b0000000-0000-4000-8000-000000000001', 'lucia-y-martin', 'editorial', {lit(lucia)}, 'borrador',
   'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006', 'Plan Con cambios. Fotos pendientes.'),
  ('b0000000-0000-4000-8000-000000000002', 'marta-y-pablo', 'clasica', {lit(ana)}, 'borrador',
   'c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000008', null),
  ('b0000000-0000-4000-8000-000000000003', 'sara-y-jon', 'costa', {lit(sara)}, 'borrador',
   'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000011', null);

-- Publicadas: versión 1 de Lucía y Martín y de Sara y Jon (esta ya pasó: archivada).
insert into public.wedding_versions (id, wedding_id, version, template, config, note)
select ('d0000000-0000-4000-8000-00000000000' || right(w.id::text, 1))::uuid, w.id, 1, w.template, w.config, 'Primera publicación'
from public.weddings w where w.slug in ('lucia-y-martin', 'sara-y-jon');
update public.weddings set status = 'publicada', published_at = now() - interval '10 days',
       published_version_id = 'd0000000-0000-4000-8000-000000000001' where slug = 'lucia-y-martin';
update public.weddings set status = 'archivada', published_at = now() - interval '90 days',
       published_version_id = 'd0000000-0000-4000-8000-000000000003' where slug = 'sara-y-jon';

insert into public.couple_users (wedding_id, email, name, user_id) values
  ('b0000000-0000-4000-8000-000000000001', 'lucia@example.com', 'Lucía', '33333333-3333-4333-8333-333333333333');

insert into public.rsvp_responses (wedding_id, name, attending, song, source, created_at) values
  ('b0000000-0000-4000-8000-000000000001', 'Carmen Ortega', true, 'Septiembre - Earth, Wind & Fire', 'web', now() - interval '6 days'),
  ('b0000000-0000-4000-8000-000000000001', 'Tomás Sanz', true, null, 'web', now() - interval '5 days'),
  ('b0000000-0000-4000-8000-000000000001', 'Begoña Ruiz', false, null, 'web', now() - interval '4 days'),
  ('b0000000-0000-4000-8000-000000000001', 'Iñaki Prieto', false, null, 'web', now() - interval '3 days'),
  ('b0000000-0000-4000-8000-000000000001', 'iñaki prieto', true, 'Vivir mi vida', 'web', now() - interval '1 day'),
  ('b0000000-0000-4000-8000-000000000001', 'Rosa Martín', true, null, 'web', now() - interval '2 hours');

insert into public.guest_groups (wedding_id, name, seats, children_seats) values
  ('b0000000-0000-4000-8000-000000000001', 'Familia Ortega', 4, 2),
  ('b0000000-0000-4000-8000-000000000001', 'Amigos de la uni', 6, 0);

-- Pedidos y pagos
insert into public.orders (id, client_id, wedding_id, lead_id, status, promised_delivery_at, paid_at) values
  ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000006', 'en_produccion', current_date + 2, now() - interval '1 day'),
  ('e0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000008', 'pagado', current_date + 3, now() - interval '3 hours');
insert into public.order_lines (order_id, product_id, description, unit_price_cents)
select 'e0000000-0000-4000-8000-000000000001', id, 'Web de boda · ' || name, price_cents from public.products where code = 'con-cambios';
insert into public.order_lines (order_id, product_id, description, unit_price_cents)
select 'e0000000-0000-4000-8000-000000000002', id, 'Web de boda · ' || name, price_cents from public.products where code = 'tal-cual';
insert into public.payments (order_id, provider, external_id, amount_cents, status, paid_at) values
  ('e0000000-0000-4000-8000-000000000001', 'transferencia', 'demo-1', 13900, 'pagado', now() - interval '1 day'),
  ('e0000000-0000-4000-8000-000000000002', 'bizum', 'demo-2', 7900, 'pagado', now() - interval '3 hours');
update public.orders set paid_cents = total_cents;
"""
with open(os.path.join(ROOT, 'supabase/seed.sql'), 'w', encoding='utf-8') as f:
    f.write(out)
print('supabase/seed.sql escrito')
