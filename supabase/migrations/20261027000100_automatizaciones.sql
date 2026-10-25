-- WeddingWebs · Fase 5 · Automatizaciones y retención de datos.
--
-- Si ya instalaste la base de datos antes de la fase 5: pega SOLO este archivo en el editor SQL.
--
--   · Cada automatización se activa, desactiva y edita desde el panel. TODAS empiezan apagadas.
--   · Solo cuenta lo que pasa DESPUÉS de activarla (más un día de margen): al encender
--     «recordatorio a los 2 días» no se escribe a todos los leads antiguos de golpe.
--   · Cada envío queda registrado (automation_runs) y nunca se repite para la misma persona y motivo.
--   · Los emails comerciales respetan las bajas (email_optouts) y el consentimiento del lead.
--   · Retención: retirar webs, borrar invitados y anonimizar contactos, según Ajustes › Plazos.
--     Las facturas no se borran nunca.

-- ── Tablas ────────────────────────────────────────────────────

create table public.automations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  description text not null,
  audience text not null check (audience in ('lead', 'pareja', 'invitados', 'luis', 'datos')),
  kind text not null check (kind in ('email', 'tarea', 'sistema', 'bloque')),
  enabled boolean not null default false,
  enabled_at timestamptz,
  delay_days integer check (delay_days between 0 and 400),
  subject text,
  body text,
  button_label text,
  commercial boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger automations_updated_at before update on public.automations
  for each row execute function app.set_updated_at();
comment on column public.automations.kind is 'email: se manda sola · tarea: tarea para Luis · sistema: retención de datos · bloque: texto que se añade a otro email.';
comment on column public.automations.enabled_at is 'Desde cuándo está activa: solo cuenta lo que pasa después (no se escribe a todo el histórico de golpe).';
comment on column public.automations.commercial is 'Email comercial: lleva enlace de baja y no se manda a quien se dio de baja.';

create or replace function app.automations_enabled_at() returns trigger
language plpgsql as $$
begin
  if new.enabled and (tg_op = 'INSERT' or not old.enabled) then new.enabled_at := now(); end if;
  return new;
end $$;
create trigger automations_enabled_at before insert or update of enabled on public.automations
  for each row execute function app.automations_enabled_at();

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  dedupe_key text not null,
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  wedding_id uuid references public.weddings(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  email text,
  status text not null check (status in ('enviado', 'simulado', 'fallido', 'hecho', 'omitido')),
  detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (automation_id, dedupe_key)
);
create index automation_runs_recent_idx on public.automation_runs (automation_id, created_at desc);
create trigger automation_runs_updated_at before update on public.automation_runs
  for each row execute function app.set_updated_at();

create table public.email_optouts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index email_optouts_email_key on public.email_optouts (lower(email));
create trigger email_optouts_updated_at before update on public.email_optouts
  for each row execute function app.set_updated_at();
comment on table public.email_optouts is 'Quien se ha dado de baja de los emails comerciales. Se conserva aunque se anonimice el lead, para no volver a escribirle.';

alter table public.automations enable row level security;
alter table public.automation_runs enable row level security;
alter table public.email_optouts enable row level security;
revoke all on public.automations from anon;
revoke all on public.automation_runs from anon;
revoke all on public.email_optouts from anon;
create policy automations_select on public.automations for select to authenticated using (app.is_staff());
create policy automations_update on public.automations for update to authenticated using (app.is_admin()) with check (app.is_admin());
create policy automation_runs_select on public.automation_runs for select to authenticated using (app.is_staff());
create policy email_optouts_select on public.email_optouts for select to authenticated using (app.is_staff());
create policy email_optouts_insert on public.email_optouts for insert to authenticated with check (app.is_staff());
create policy email_optouts_delete on public.email_optouts for delete to authenticated using (app.is_admin());

-- Enlace a la web que probó cada lead (/studio/?prueba=<clave>).
alter table public.leads add column preview_token text unique default app.random_token();

-- Enlaces para pedir reseñas.
insert into public.settings (key, value, description) values
  ('resenas', jsonb_build_object('google', '', 'bodas_net', ''),
   'Enlaces para pedir una reseña a las parejas el día después de la boda.')
on conflict (key) do nothing;

-- La política de privacidad publicada dice «Los contactos que no contratan se borran a los 12 meses».
update public.settings set value = jsonb_set(value, '{leads_perdidos_anonimizar_meses}', '12')
 where key = 'plazos' and (value ->> 'leads_perdidos_anonimizar_meses') = '24';

-- ── Textos por defecto (Luis los cambia en Panel › Automatizaciones) ──

insert into public.automations (code, name, description, audience, kind, delay_days, subject, body, button_label, commercial, sort) values
('lead_bienvenida', 'Bienvenida al probar una web', 'Al momento, cuando alguien prueba su web en el escaparate y acepta que le escribamos.',
 'lead', 'email', null, 'Vuestra web de boda, {nombres}',
 E'¡Hola, {nombres}!\n\nAquí tenéis la web que habéis probado, en estilo {estilo}. La hemos guardado para que podáis volver a verla y enseñarla (lleva fotos de ejemplo: las vuestras no salen de vuestro móvil).\n\nSi os gusta, la dejamos lista en 3 días laborables, desde {precio_desde}. Podéis reservarla desde la misma página o contestar a este email con cualquier duda.',
 'Ver nuestra web', true, 10),
('lead_recordatorio_1', 'Primer recordatorio al lead', 'Si el lead sigue sin contestar ni reservar pasados estos días desde que probó su web.',
 'lead', 'email', 2, '¿Seguimos con vuestra web, {nombres}?',
 E'¡Hola, {nombres}!\n\nHace un par de días probasteis vuestra web de boda. ¿Qué os pareció?\n\nSi tenéis cualquier duda (precio, plazos, qué se puede cambiar), contestad a este email y os respondemos nosotros, no un robot. Vuestra web sigue guardada aquí:',
 'Ver nuestra web', true, 20),
('lead_recordatorio_2', 'Último recordatorio al lead', 'Si sigue sin contestar ni reservar pasados estos días. Es el último email: después, nada más.',
 'lead', 'email', 7, 'Una última cosa sobre vuestra web',
 E'¡Hola, {nombres}!\n\nNo queremos ser pesados: es el último email. Por si os ayuda a decidir:\n· Un solo pago, sin cuotas: desde {precio_desde}.\n· La tenéis lista en 3 días laborables.\n· Vuestros invitados confirman desde la web y vosotros lo veis todo en vuestro panel.\n\nSi os apetece, aquí sigue:',
 'Ver nuestra web', true, 30),
('lead_frio', 'Tarea: lead frío', 'Te crea una tarea si el lead sigue sin contestar ni reservar pasados estos días, para que decidas si llamarle o darlo por perdido.',
 'luis', 'tarea', 10, null, null, null, false, 40),
('pago_pendiente', 'Empezó a pagar y no terminó', 'Si una pareja empezó a pagar desde el escaparate y no lo terminó pasados estos días.',
 'lead', 'email', 1, '¿Os quedó alguna duda?',
 E'¡Hola, {nombres}!\n\nVimos que empezasteis a reservar vuestra web ({plan}, {importe}), pero el pago no se completó. A veces es el banco y a veces una duda. Las más habituales:\n· ¿Y si nos echamos atrás? Tenéis 14 días para desistir mientras no os la entreguemos.\n· ¿Y si queremos cambiar algo? Corregir datos y erratas siempre está incluido.\n· ¿Cuándo estará? En 3 días laborables desde que tenemos vuestras fotos.\n\nPodéis terminar el pago aquí, o contestar a este email:',
 'Terminar el pago', true, 50),
('pago_bienvenida', 'Qué necesitamos (en el email del pago)', 'Se añade al email de confirmación del pago: lo que necesitamos de la pareja para empezar.',
 'pareja', 'bloque', null, null,
 E'Para empezar necesitamos:\n· Vuestras fotos: de 3 a 10, las originales (las que se mandan por WhatsApp pierden calidad). Contestad a este email con ellas o con un enlace de WeTransfer o Google Drive.\n· Si queréis cambiar algún dato (horario, lugar, textos), decídnoslo en vuestra página de seguimiento.',
 null, false, 60),
('faltan_fotos', 'Recordatorio: faltan las fotos', 'Si pasados estos días desde el pago su web todavía no tiene fotos suyas.',
 'pareja', 'email', 2, 'Nos faltan vuestras fotos',
 E'¡Hola, {nombres}!\n\nPara terminar vuestra web nos faltan vuestras fotos. Mandadnos de 3 a 10, las originales (las de WhatsApp pierden calidad): contestad a este email con ellas o con un enlace de WeTransfer o Google Drive.\n\nEn cuanto las tengamos, os mandamos la propuesta.',
 'Ver cómo va', false, 70),
('web_publicada', 'Web publicada', 'Al publicar su web por primera vez: el enlace para compartir y cómo entrar en su panel de invitados.',
 'pareja', 'email', null, '¡Vuestra web ya está publicada!',
 E'¡Hola, {nombres}!\n\nVuestra web ya está en internet: {enlace_web}\n\nPara compartirla, mandad ese enlace por WhatsApp o ponedlo en la invitación: al pegarlo sale vuestra foto.\n\nEn vuestro panel apuntáis a los invitados, veis quién viene y descargáis el Excel para el catering. Para entrar, poned vuestro email aquí: {enlace_panel}',
 'Ver nuestra web', false, 80),
('rsvp_recordatorio', 'Recordatorio a invitados sin contestar', 'Estos días antes de la fecha límite, a los grupos de invitados que no han contestado y tienen email.',
 'invitados', 'email', 7, '{pareja}: ¿venís a la boda?',
 E'¡Hola, {grupo}!\n\n{pareja} os esperan en su boda y aún no sabemos si podréis venir. ¿Nos lo decís antes del {fecha_limite}? Es un momento.',
 'Confirmar asistencia', false, 90),
('rsvp_cerrado', 'Aviso a la pareja: plazo cerrado', 'El día después de la fecha límite para confirmar: los números finales.',
 'pareja', 'email', 1, 'Se ha cerrado la confirmación de asistencia',
 E'¡Hola, {nombres}!\n\nYa ha terminado el plazo para confirmar. Los números: {resumen}\n\nEn vuestro panel tenéis la lista completa y el Excel para el catering. Si alguien no ha contestado, todavía podéis apuntarlo a mano.',
 'Abrir nuestro panel', false, 100),
('resena', 'Felicitación y reseña', 'Estos días después de la boda: enhorabuena y petición de reseña en Google y Bodas.net. Solo si has puesto los enlaces en Ajustes.',
 'pareja', 'email', 1, '¡Enhorabuena, {nombres}!',
 E'¡Enhorabuena por la boda! Esperamos que fuera un día precioso y que la web os ayudara.\n\nSi os ha gustado trabajar con nosotros, nos ayudaría muchísimo una reseña. Son dos minutos:\n{enlaces_resena}\n\nVuestra web sigue en internet hasta el {fecha_retirada}, por si alguien quiere volver a verla.',
 null, true, 110),
('retirada_aviso', 'Aviso antes de retirar la web', 'Estos días antes de que su web se retire (Ajustes › Plazos: meses después de la boda).',
 'pareja', 'email', 30, 'Vuestra web se retirará el {fecha_retirada}',
 E'¡Hola, {nombres}!\n\nComo os contamos al contratarla, vuestra web de boda se retira un tiempo después de la boda: el {fecha_retirada} dejará de estar en internet. Si queréis guardar algo (textos o fotos), hacedlo antes.\n\nSi queréis mantenerla más tiempo, contestad a este email y lo vemos.',
 'Ver nuestra web', false, 120),
('retirar_webs', 'Retirar las webs', 'Cada día, retira las webs cuya fecha de retirada ya ha llegado (Ajustes › Plazos).',
 'datos', 'sistema', null, null, null, null, false, 130),
('borrar_invitados', 'Borrar los datos de invitados', 'Cada día, borra la lista de invitados y sus respuestas de las bodas que ya pasaron el plazo (Ajustes › Plazos).',
 'datos', 'sistema', null, null, null, null, false, 140),
('anonimizar_leads', 'Anonimizar contactos que no contratan', 'Cada día, borra nombre, email, teléfono y mensajes de los leads sin contratar que llevan sin moverse el plazo de Ajustes › Plazos. Se conservan las cifras para las estadísticas.',
 'datos', 'sistema', null, null, null, null, false, 150)
on conflict (code) do nothing;

-- ── Utilidades ────────────────────────────────────────────────

create or replace function app.opted_out(p_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.email_optouts o where lower(o.email) = lower(btrim(coalesce(p_email, ''))))
$$;

create or replace function app.lead_consents(l public.leads) returns boolean
language sql stable security definer set search_path = '' as $$
  -- Aceptó que le escribamos (casilla del escaparate) o nos pidió una reserva (precontractual).
  select l.source = 'reserva' or exists (
    select 1 from public.consents c where c.lead_id = l.id and c.purpose = 'contacto_comercial' and c.granted)
$$;

create or replace function app.lead_names(l public.leads) returns text
language sql immutable as $$
  select coalesce(nullif(btrim(concat_ws(' y ', nullif(btrim(l.partner_a), ''), nullif(btrim(l.partner_b), ''))), ''),
                  nullif(btrim(l.names), ''), 'pareja')
$$;

create or replace function app.wedding_names(w public.weddings) returns text
language sql immutable as $$
  select coalesce(nullif(array_to_string(array(select jsonb_array_elements_text(w.config #> '{event,couple}')), ' y '), ''), w.slug)
$$;

create or replace function app.fecha_larga(d date) returns text
language sql immutable as $$
  select extract(day from d)::int || ' de ' || (array['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
    'septiembre','octubre','noviembre','diciembre'])[extract(month from d)::int] || ' de ' || extract(year from d)::int
$$;

-- Emails de la pareja de una boda: el del cliente y los que tienen acceso a su panel.
create or replace function app.wedding_emails(w public.weddings) returns setof text
language sql stable security definer set search_path = '' as $$
  select distinct lower(e) from (
    select c.email as e from public.clients c where c.id = w.client_id and c.anonymized_at is null
    union all select cu.email from public.couple_users cu where cu.wedding_id = w.id
  ) x where e ~ '^\S+@\S+\.\S+$'
$$;

-- ¿Le toca? El momento T ya ha llegado, es posterior a la activación (con un día de margen) y no
-- es de hace más de 14 días (por si el aviso diario falló unos días).
create or replace function app.due(a public.automations, t timestamptz) returns boolean
language sql stable as $$
  select t <= now() and t >= greatest(a.enabled_at - interval '1 day', now() - interval '14 days')
$$;

-- Los avisos «X días antes de algo» (fecha límite, retirada) sí se mandan aunque el momento sea
-- anterior a la activación: mientras ese algo no haya pasado, siguen siendo útiles.

-- ── Lo que toca enviar (emails) ───────────────────────────────

create or replace function app.automation_items(p_code text default null, p_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  a public.automations;
  out jsonb := '[]'::jsonb;
  today date := (now() at time zone 'Europe/Madrid')::date;
  seller jsonb := coalesce(app.setting('vendedor'), '{}'::jsonb);
  reviews jsonb := coalesce(app.setting('resenas'), '{}'::jsonb);
  desde text := (select replace(app.eur(min(p.price_cents)), ',00 €', ' €') from public.products p where p.active and p.kind = 'plan');
  item jsonb;
begin
  for a in select * from public.automations x where x.enabled and x.kind = 'email' and (p_code is null or x.code = p_code) order by x.sort loop
    item := jsonb_build_object('automation_id', a.id, 'code', a.code, 'subject', a.subject, 'body', a.body,
      'button_label', a.button_label, 'commercial', a.commercial, 'reply_to', nullif(seller ->> 'email', ''));

    if a.code in ('lead_bienvenida', 'lead_recordatorio_1', 'lead_recordatorio_2') then
      out := out || coalesce((select jsonb_agg(item || jsonb_build_object(
          'key', 'lead:' || l.id, 'email', lower(l.email), 'lead_id', l.id, 'client_id', l.client_id,
          'link', jsonb_build_object('type', 'prueba', 'token', l.preview_token),
          'vars', jsonb_build_object('nombres', app.lead_names(l), 'estilo', l.style, 'precio_desde', desde)))
        from public.leads l
        where l.email ~ '^\S+@\S+\.\S+$' and l.anonymized_at is null and app.lead_consents(l)
          and (p_id is null or l.id = p_id)
          and case a.code when 'lead_bienvenida' then l.source = 'prueba' and l.trials > 0 and l.created_at > now() - interval '2 days'
                          else l.status in ('nuevo', 'contactado') and l.client_id is null end
          and app.due(a, l.created_at + make_interval(days => coalesce(a.delay_days, 0)))
          and not app.opted_out(l.email)
          and not exists (select 1 from public.automation_runs r where r.automation_id = a.id and r.dedupe_key = 'lead:' || l.id)
      ), '[]'::jsonb);

    elsif a.code = 'pago_pendiente' then
      out := out || coalesce((select jsonb_agg(item || jsonb_build_object(
          'key', 'pedido:' || o.id, 'email', lower(c.email), 'lead_id', o.lead_id, 'client_id', o.client_id, 'order_id', o.id,
          'link', jsonb_build_object('type', 'seguimiento', 'code', o.tracking_code),
          'vars', jsonb_build_object('nombres', c.display_name, 'importe', app.eur(o.total_cents - o.paid_cents),
            'plan', (select string_agg(ol.description, ', ' order by ol.position) from public.order_lines ol where ol.order_id = o.id))))
        from public.orders o join public.clients c on c.id = o.client_id
        where o.source = 'escaparate' and o.status = 'pendiente_pago' and o.paid_cents = 0
          and c.email ~ '^\S+@\S+\.\S+$' and c.anonymized_at is null and (p_id is null or o.id = p_id)
          and app.due(a, o.created_at + make_interval(days => coalesce(a.delay_days, 0)))
          and not app.opted_out(c.email)
          and not exists (select 1 from public.automation_runs r where r.automation_id = a.id and r.dedupe_key = 'pedido:' || o.id)
      ), '[]'::jsonb);

    elsif a.code = 'faltan_fotos' then
      out := out || coalesce((select jsonb_agg(item || jsonb_build_object(
          'key', 'pedido:' || o.id, 'email', lower(c.email), 'client_id', o.client_id, 'order_id', o.id, 'wedding_id', o.wedding_id,
          'link', jsonb_build_object('type', 'seguimiento', 'code', o.tracking_code),
          'vars', jsonb_build_object('nombres', app.order_names(o))))
        from public.orders o join public.clients c on c.id = o.client_id
        where o.status in ('pagado', 'en_produccion') and o.paid_at is not null
          and c.email ~ '^\S+@\S+\.\S+$' and c.anonymized_at is null and (p_id is null or o.id = p_id)
          and not exists (select 1 from public.wedding_assets wa where wa.wedding_id = o.wedding_id and wa.kind = 'foto')
          and app.due(a, o.paid_at + make_interval(days => coalesce(a.delay_days, 0)))
          and not exists (select 1 from public.automation_runs r where r.automation_id = a.id and r.dedupe_key = 'pedido:' || o.id)
      ), '[]'::jsonb);

    elsif a.code in ('web_publicada', 'rsvp_cerrado', 'resena', 'retirada_aviso') then
      out := out || coalesce((select jsonb_agg(item || jsonb_build_object(
          'key', 'boda:' || w.id || ':' || e.email, 'email', e.email, 'wedding_id', w.id, 'client_id', w.client_id,
          'link', jsonb_build_object('type', case a.code when 'rsvp_cerrado' then 'panel' else 'web' end, 'slug', w.slug),
          'vars', jsonb_build_object('nombres', app.wedding_names(w), 'fecha_retirada', app.fecha_larga(w.retire_at),
            'resumen', case when a.code = 'rsvp_cerrado' then (
              select (s ->> 'personas') || ' personas vienen (' || (s ->> 'adultos') || ' adultos y ' || (s ->> 'ninos') || ' niños), '
                     || (s ->> 'no') || ' no vienen' || case when (s ->> 'grupos')::int > 0 then ' y ' || (s ->> 'pendientes') || ' grupos no han contestado' else '' end || '.'
              from (select app.rsvp_stats(w.id) as s) st) end,
            'resenas', case when a.code = 'resena' then reviews end)))
        from public.weddings w cross join lateral app.wedding_emails(w) as e(email)
        where (p_id is null or w.id = p_id)
          and (a.code <> 'resena' or not app.opted_out(e.email))
          and case a.code
            -- La primera vez que se publicó (volver a publicar una web antigua no es «ya está publicada»).
            when 'web_publicada' then w.status in ('publicada', 'archivada') and w.published_at is not null
              and app.due(a, (select min(v.created_at) from public.wedding_versions v where v.wedding_id = w.id))
            when 'rsvp_cerrado' then w.status in ('publicada', 'archivada') and w.wedding_date >= today
              and nullif(w.config #>> '{rsvp,deadline}', '') ~ '^\d{4}-\d{2}-\d{2}$'
              and (((w.config #>> '{rsvp,deadline}')::date + coalesce(a.delay_days, 1)) + time '09:00') at time zone 'Europe/Madrid' <= now()
            when 'resena' then w.wedding_date is not null and w.status <> 'retirada'
              and (coalesce(reviews ->> 'google', '') <> '' or coalesce(reviews ->> 'bodas_net', '') <> '')
              and app.due(a, ((w.wedding_date + coalesce(a.delay_days, 1)) + time '10:00') at time zone 'Europe/Madrid')
            else w.status in ('publicada', 'archivada') and w.retire_at > today
              and ((w.retire_at - coalesce(a.delay_days, 30)) + time '09:00') at time zone 'Europe/Madrid' <= now()
          end
          and not exists (select 1 from public.automation_runs r where r.automation_id = a.id and r.dedupe_key = 'boda:' || w.id || ':' || e.email)
      ), '[]'::jsonb);

    elsif a.code = 'rsvp_recordatorio' then
      out := out || coalesce((select jsonb_agg(item || jsonb_build_object(
          'key', 'grupo:' || g.id, 'email', lower(g.email), 'wedding_id', w.id,
          'link', jsonb_build_object('type', 'invitacion', 'slug', w.slug, 'token', g.token),
          'vars', jsonb_build_object('grupo', g.name, 'pareja', app.wedding_names(w),
            'fecha_limite', app.fecha_larga((v.config #>> '{rsvp,deadline}')::date))))
        from public.guest_groups g
        join public.weddings w on w.id = g.wedding_id
        join public.wedding_versions v on v.id = w.published_version_id
        where w.status = 'publicada' and g.token_revoked_at is null and g.email ~ '^\S+@\S+\.\S+$'
          and (p_id is null or w.id = p_id)
          and nullif(v.config #>> '{rsvp,deadline}', '') ~ '^\d{4}-\d{2}-\d{2}$'
          and (v.config #>> '{rsvp,deadline}')::date >= today
          and (((v.config #>> '{rsvp,deadline}')::date - coalesce(a.delay_days, 7)) + time '09:00') at time zone 'Europe/Madrid' <= now()
          and not exists (select 1 from public.rsvp_responses rr where rr.group_id = g.id)
          and not app.opted_out(g.email)
          and not exists (select 1 from public.automation_runs r where r.automation_id = a.id and r.dedupe_key = 'grupo:' || g.id)
      ), '[]'::jsonb);
    end if;
  end loop;
  return out;
end $$;

create or replace function public.api_automation_due() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  return app.automation_items(null, null);
end $$;

-- Lo que toca a una persona o boda concreta ahora mismo (lead nuevo, web recién publicada…).
create or replace function public.api_automation_event(p_code text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  if p_id is null then return '[]'::jsonb; end if;
  return app.automation_items(p_code, p_id);
end $$;

-- Reserva un envío antes de mandarlo (así dos avisos simultáneos no mandan el mismo email dos veces).
create or replace function public.api_automation_claim(p_automation_id uuid, p_key text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  insert into public.automation_runs (automation_id, dedupe_key, status, detail)
  values (p_automation_id, p_key, 'omitido', 'enviando')
  on conflict (automation_id, dedupe_key) do nothing;
  get diagnostics n = row_count;
  return n = 1;
end $$;

create or replace function public.api_automation_done(p_run jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  update public.automation_runs set
    status = p_run ->> 'status', detail = left(p_run ->> 'detail', 500), email = p_run ->> 'email',
    lead_id = nullif(p_run ->> 'lead_id', '')::uuid, client_id = nullif(p_run ->> 'client_id', '')::uuid,
    wedding_id = nullif(p_run ->> 'wedding_id', '')::uuid, order_id = nullif(p_run ->> 'order_id', '')::uuid
  where automation_id = (p_run ->> 'automation_id')::uuid and dedupe_key = p_run ->> 'key';
end $$;

-- Texto de un bloque (p. ej. «Qué necesitamos» en el email del pago), si está activo.
create or replace function public.api_automation_block(p_code text) returns text
language sql stable security definer set search_path = '' as $$
  select a.body from public.automations a where a.code = p_code and a.kind = 'bloque' and a.enabled and app.is_service()
$$;

-- ── Tareas y retención (se hacen en la base de datos) ─────────

create or replace function public.api_automation_sweep() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.automations;
  today date := (now() at time zone 'Europe/Madrid')::date;
  months integer := coalesce((app.setting('plazos') ->> 'leads_perdidos_anonimizar_meses')::int, 12);
  rl public.leads;
  rw public.weddings;
  frio integer := 0; retiradas integer := 0; borradas integer := 0; anonimizados integer := 0;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;

  select * into a from public.automations where code = 'lead_frio' and enabled;
  if found then
    for rl in select l.* from public.leads l
             where l.status in ('nuevo', 'contactado') and l.client_id is null and l.anonymized_at is null
               and app.due(a, l.created_at + make_interval(days => coalesce(a.delay_days, 10)))
               and not exists (select 1 from public.automation_runs x where x.automation_id = a.id and x.dedupe_key = 'lead:' || l.id)
    loop
      perform app.auto_task('frio:' || rl.id, 'Lead frío: ' || app.lead_names(rl) || '. ¿Llamar o darlo por perdido?',
        'Lleva ' || coalesce(a.delay_days, 10) || ' días sin contestar ni reservar.', now(), rl.id);
      insert into public.automation_runs (automation_id, dedupe_key, lead_id, status) values (a.id, 'lead:' || rl.id, rl.id, 'hecho');
      frio := frio + 1;
    end loop;
  end if;

  select * into a from public.automations where code = 'retirar_webs' and enabled;
  if found then
    for rw in select w.* from public.weddings w where w.status in ('publicada', 'archivada') and w.retire_at <= today loop
      update public.weddings set status = 'retirada' where id = rw.id;
      insert into public.automation_runs (automation_id, dedupe_key, wedding_id, client_id, status, detail)
      values (a.id, 'boda:' || rw.id || ':' || today, rw.id, rw.client_id, 'hecho', 'Web retirada el ' || today)
      on conflict do nothing;
      retiradas := retiradas + 1;
    end loop;
  end if;

  select * into a from public.automations where code = 'borrar_invitados' and enabled;
  if found then
    for rw in select w.* from public.weddings w
             where w.guest_data_delete_at <= today
               and (exists (select 1 from public.guest_groups g where g.wedding_id = w.id)
                    or exists (select 1 from public.guests g where g.wedding_id = w.id)
                    or exists (select 1 from public.rsvp_responses x where x.wedding_id = w.id))
    loop
      delete from public.rsvp_responses where wedding_id = rw.id;
      delete from public.guests where wedding_id = rw.id;
      delete from public.guest_groups where wedding_id = rw.id;
      -- Los emails que se mandaron a sus invitados también llevaban sus direcciones.
      update public.email_log set to_email = '(borrado)' where wedding_id = rw.id
         and template in ('recordatorio_rsvp', 'rsvp_recordatorio');
      update public.automation_runs set email = null where wedding_id = rw.id and dedupe_key like 'grupo:%';
      perform app.log_activity('sistema', 'Datos de invitados borrados (plazo de ' ||
        coalesce((app.setting('plazos') ->> 'invitados_meses_tras_boda'), '6') || ' meses tras la boda)', null, '{}'::jsonb,
        null, rw.client_id, rw.id);
      insert into public.automation_runs (automation_id, dedupe_key, wedding_id, client_id, status, detail)
      values (a.id, 'boda:' || rw.id || ':' || today, rw.id, rw.client_id, 'hecho', 'Invitados y respuestas borrados')
      on conflict do nothing;
      borradas := borradas + 1;
    end loop;
  end if;

  select * into a from public.automations where code = 'anonimizar_leads' and enabled;
  if found then
    for rl in select l.* from public.leads l
             where l.anonymized_at is null and l.client_id is null and l.status <> 'ganado'
               and greatest(l.status_changed_at, l.updated_at, l.created_at) < now() - make_interval(months => months)
    loop
      update public.leads set names = '', partner_a = null, partner_b = null, email = null, phone = null,
        venue = null, city = null, message = null, trial_config = null, next_action = null, anonymized_at = now(),
        status = case when status = 'perdido' then status else 'perdido' end,
        lost_reason = coalesce(lost_reason, 'Sin respuesta (anonimizado)')
      where id = rl.id;
      update public.consents set email = null, ip = null, user_agent = null where lead_id = rl.id;
      update public.activities set body = null where lead_id = rl.id;
      update public.email_log set to_email = '(anonimizado)' where lead_id = rl.id;
      update public.automation_runs set email = null where lead_id = rl.id;
      insert into public.automation_runs (automation_id, dedupe_key, lead_id, status, detail)
      values (a.id, 'lead:' || rl.id, rl.id, 'hecho', 'Anonimizado')
      on conflict do nothing;
      anonimizados := anonimizados + 1;
    end loop;
  end if;

  return jsonb_build_object('tareas', frio, 'webs_retiradas', retiradas, 'invitados_borrados', borradas, 'leads_anonimizados', anonimizados);
end $$;

-- ── Bajas y vista previa del lead ─────────────────────────────

create or replace function public.api_optout(p_email text, p_source text default null) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  em text := lower(btrim(coalesce(p_email, '')));
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  if em !~ '^\S+@\S+\.\S+$' then return false; end if;
  insert into public.email_optouts (email, source) values (em, left(p_source, 100))
  on conflict ((lower(email))) do nothing;
  insert into public.consents (lead_id, email, purpose, granted, text, source)
  select l.id, em, 'contacto_comercial', false, 'Baja desde el enlace del email', left(p_source, 100)
  from public.leads l where lower(l.email) = em and l.anonymized_at is null;
  return true;
end $$;

-- Lo justo para volver a pintar la web que probó (sin fotos: nunca salieron de su móvil).
create or replace function public.api_lead_preview(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('couple', jsonb_build_array(coalesce(l.partner_a, ''), coalesce(l.partner_b, '')),
    'date', l.wedding_date, 'time', to_char(coalesce(l.wedding_time, time '18:00'), 'HH24:MI'),
    -- El escaparate guarda el lugar como «Lugar, Ciudad»: se separa otra vez.
    'venue', case when coalesce(l.city, '') <> '' and right(coalesce(l.venue, ''), length(l.city) + 2) = ', ' || l.city
                  then left(l.venue, length(l.venue) - length(l.city) - 2) else coalesce(l.venue, '') end,
    'city', coalesce(l.city, ''), 'style', l.style, 'email', l.email)
  from public.leads l
  where app.is_service() and length(coalesce(p_token, '')) >= 20 and l.preview_token = p_token
    and l.anonymized_at is null and l.partner_a is not null and l.wedding_date is not null
$$;

create or replace function public.soy_admin() returns boolean
language sql stable as $$ select app.is_admin() $$;

-- ── Permisos ──────────────────────────────────────────────────

do $$
declare f text;
begin
  foreach f in array array[
    'public.api_automation_due()', 'public.api_automation_event(text, uuid)',
    'public.api_automation_claim(uuid, text)', 'public.api_automation_done(jsonb)', 'public.api_automation_block(text)',
    'public.api_automation_sweep()', 'public.api_optout(text, text)', 'public.api_lead_preview(text)']
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
  revoke execute on function public.soy_admin() from public, anon;
  grant execute on function public.soy_admin() to authenticated, service_role;
end $$;
