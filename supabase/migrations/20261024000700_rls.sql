-- WeddingWebs · 7/9 · Seguridad por filas (RLS) en TODAS las tablas.
--
-- Quién ve qué:
--   · anon (cualquiera sin sesión): nada. Lo público (webs de boda, RSVP, leads) pasa por
--     nuestras funciones de servidor con la clave secreta y por las funciones api_* de 8/9.
--   · equipo (staff): el CRM, las bodas y los invitados. Ajustes, equipo y facturas: solo owner/admin.
--   · pareja (couple_users): solo su boda, sus invitados y sus respuestas.
--   · service_role (nuestras funciones de servidor): se salta la RLS, como en todo Supabase.

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Defensa extra: el rol anónimo no toca ninguna tabla ni vista directamente.
revoke all on all tables in schema public from anon;

-- ── Equipo y ajustes ──────────────────────────────────────────
create policy staff_select on public.staff for select to authenticated using (app.is_staff());
create policy staff_write on public.staff for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy settings_select on public.settings for select to authenticated using (app.is_staff());
create policy settings_write on public.settings for all to authenticated using (app.is_admin()) with check (app.is_admin());

-- counters y rate_limits: sin políticas (solo funciones internas y service_role).

-- ── CRM ───────────────────────────────────────────────────────
create policy clients_select on public.clients for select to authenticated using (app.is_staff());
create policy clients_insert on public.clients for insert to authenticated with check (app.is_staff());
create policy clients_update on public.clients for update to authenticated using (app.is_staff()) with check (app.is_staff());
create policy clients_delete on public.clients for delete to authenticated using (app.is_admin());

create policy leads_select on public.leads for select to authenticated using (app.is_staff());
create policy leads_insert on public.leads for insert to authenticated with check (app.is_staff());
create policy leads_update on public.leads for update to authenticated using (app.is_staff()) with check (app.is_staff());
create policy leads_delete on public.leads for delete to authenticated using (app.is_admin());

create policy lead_attribution_select on public.lead_attribution for select to authenticated using (app.is_staff());
create policy lead_attribution_write on public.lead_attribution for all to authenticated using (app.is_admin()) with check (app.is_staff());

create policy consents_select on public.consents for select to authenticated using (app.is_staff());
create policy consents_insert on public.consents for insert to authenticated with check (app.is_staff());

create policy activities_select on public.activities for select to authenticated using (app.is_staff());
create policy activities_insert on public.activities for insert to authenticated with check (app.is_staff());
create policy activities_update on public.activities for update to authenticated
  using (app.is_admin() or (kind = 'nota' and actor_id = app.staff_id()))
  with check (app.is_admin() or (kind = 'nota' and actor_id = app.staff_id()));
create policy activities_delete on public.activities for delete to authenticated
  using (app.is_admin() or (kind = 'nota' and actor_id = app.staff_id()));

create policy tasks_all on public.tasks for all to authenticated using (app.is_staff()) with check (app.is_staff());

-- ── Productos, pedidos y pagos ────────────────────────────────
create policy products_select on public.products for select to authenticated using (app.is_staff());
create policy products_write on public.products for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy orders_select on public.orders for select to authenticated using (app.is_staff());
create policy orders_insert on public.orders for insert to authenticated with check (app.is_staff());
create policy orders_update on public.orders for update to authenticated using (app.is_staff()) with check (app.is_staff());
create policy orders_delete on public.orders for delete to authenticated using (app.is_admin());

create policy order_lines_all on public.order_lines for all to authenticated using (app.is_staff()) with check (app.is_staff());

create policy payments_select on public.payments for select to authenticated using (app.is_staff());
create policy payments_insert on public.payments for insert to authenticated with check (app.is_staff());
create policy payments_update on public.payments for update to authenticated using (app.is_staff()) with check (app.is_staff());
create policy payments_delete on public.payments for delete to authenticated using (app.is_admin());

-- ── Bodas ─────────────────────────────────────────────────────
create policy weddings_select on public.weddings for select to authenticated
  using (app.is_staff() or id in (select app.couple_wedding_ids()));
create policy weddings_insert on public.weddings for insert to authenticated with check (app.is_staff());
create policy weddings_update on public.weddings for update to authenticated using (app.is_staff()) with check (app.is_staff());
create policy weddings_delete on public.weddings for delete to authenticated using (app.is_admin());

create policy wedding_versions_select on public.wedding_versions for select to authenticated
  using (app.is_staff() or wedding_id in (select app.couple_wedding_ids()));
create policy wedding_versions_insert on public.wedding_versions for insert to authenticated with check (app.is_staff());
create policy wedding_versions_delete on public.wedding_versions for delete to authenticated using (app.is_admin());

create policy wedding_assets_select on public.wedding_assets for select to authenticated
  using (app.is_staff() or wedding_id in (select app.couple_wedding_ids()));
create policy wedding_assets_write on public.wedding_assets for all to authenticated using (app.is_staff()) with check (app.is_staff());

create policy couple_users_select on public.couple_users for select to authenticated
  using (app.is_staff() or wedding_id in (select app.couple_wedding_ids()));
create policy couple_users_write on public.couple_users for all to authenticated using (app.is_staff()) with check (app.is_staff());

-- ── Invitados ─────────────────────────────────────────────────
create policy guest_groups_all on public.guest_groups for all to authenticated
  using (app.is_staff() or wedding_id in (select app.couple_wedding_ids()))
  with check (app.is_staff() or wedding_id in (select app.couple_wedding_ids()));
create policy guests_all on public.guests for all to authenticated
  using (app.is_staff() or wedding_id in (select app.couple_wedding_ids()))
  with check (app.is_staff() or wedding_id in (select app.couple_wedding_ids()));

create policy rsvp_responses_select on public.rsvp_responses for select to authenticated
  using (app.is_staff() or wedding_id in (select app.couple_wedding_ids()));
create policy rsvp_responses_insert on public.rsvp_responses for insert to authenticated
  with check ((app.is_staff() or wedding_id in (select app.couple_wedding_ids())) and source = 'panel');
create policy rsvp_responses_delete on public.rsvp_responses for delete to authenticated using (app.is_admin());

-- ── Facturación: solo owner/admin. Las reglas de inmutabilidad están en los disparadores. ──
create policy invoice_series_all on public.invoice_series for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy invoices_all on public.invoices for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy invoice_lines_all on public.invoice_lines for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy invoicing_records_select on public.invoicing_records for select to authenticated using (app.is_admin());

-- ── Sistema ───────────────────────────────────────────────────
create policy email_log_select on public.email_log for select to authenticated using (app.is_staff());
create policy webhook_events_select on public.webhook_events for select to authenticated using (app.is_admin());
create policy audit_log_select on public.audit_log for select to authenticated using (app.is_admin());
