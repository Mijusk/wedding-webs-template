-- WeddingWebs · 9/9 · Fotos de las parejas en Supabase Storage.
--
-- Cubo "wedding-assets" de lectura pública con rutas imposibles de adivinar
-- (weddings/<id de la boda>/<uuid>.jpg): la foto es tan privada como la propia web de la boda,
-- que también es pública para quien tenga el enlace. Así las webs cargan rápido y se pueden
-- cachear, sin URLs firmadas que caducan. Solo el equipo puede subir, cambiar o borrar.
-- Nunca se guardan aquí fotos de invitados (regla de negocio 1).

do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    raise notice 'Sin esquema storage (base local sin Supabase Storage): se omite.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('wedding-assets', 'wedding-assets', true, 26214400, array['image/jpeg', 'image/webp', 'image/png'])
  on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
                                 allowed_mime_types = excluded.allowed_mime_types;

  execute $p$drop policy if exists wedding_assets_staff_select on storage.objects$p$;
  execute $p$drop policy if exists wedding_assets_staff_insert on storage.objects$p$;
  execute $p$drop policy if exists wedding_assets_staff_update on storage.objects$p$;
  execute $p$drop policy if exists wedding_assets_staff_delete on storage.objects$p$;
  execute $p$create policy wedding_assets_staff_select on storage.objects for select to authenticated
            using (bucket_id = 'wedding-assets' and app.is_staff())$p$;
  execute $p$create policy wedding_assets_staff_insert on storage.objects for insert to authenticated
            with check (bucket_id = 'wedding-assets' and app.is_staff())$p$;
  execute $p$create policy wedding_assets_staff_update on storage.objects for update to authenticated
            using (bucket_id = 'wedding-assets' and app.is_staff())
            with check (bucket_id = 'wedding-assets' and app.is_staff())$p$;
  execute $p$create policy wedding_assets_staff_delete on storage.objects for delete to authenticated
            using (bucket_id = 'wedding-assets' and app.is_staff())$p$;
end $$;
