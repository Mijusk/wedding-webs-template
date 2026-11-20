-- Fotos de la prueba que una pareja comparte con su pareja («Enseñádsela a vuestra pareja»).
-- Decidido con Luis (20 nov 2026): solo se suben al compartir, a un cubo privado, y se borran
-- solas a los 30 días. Excepción acotada a la regla «solo webs, sin guardar fotos».
--
-- Cubo privado "prueba-fotos": rutas <id>/<n>.jpg con un id de 22 caracteres imposible de
-- adivinar. Nadie lo lee ni escribe desde el navegador: solo el servidor con la clave secreta
-- (api/compartir.js sube y firma enlaces de una hora; api/cron.js borra lo caducado).

create table if not exists public.trial_shares (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{22}$'),
  photos smallint not null check (photos between 1 and 6),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.trial_shares enable row level security;
revoke all on public.trial_shares from public, anon, authenticated;
comment on table public.trial_shares is
  'Pruebas del escaparate compartidas con fotos. Las fotos (cubo prueba-fotos) se borran a los 30 días.';

-- Nueva prueba compartida con p_photos fotos (las sube el servidor justo después).
create or replace function public.api_share_create(p_id text, p_photos integer)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  insert into public.trial_shares (id, photos) values (p_id, p_photos);
end $$;

-- ¿Se puede subir la foto n de esta prueba? Solo en los 15 minutos después de crearla.
create or replace function public.api_share_upload_ok(p_id text, p_n integer)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  return exists (select 1 from public.trial_shares s
                 where s.id = p_id and s.deleted_at is null and p_n >= 0 and p_n < s.photos
                   and s.created_at > now() - interval '15 minutes');
end $$;

-- Cuántas fotos tiene una prueba compartida que sigue viva (null si no existe o tiene más de 30 días).
create or replace function public.api_share_get(p_id text)
returns integer
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  return (select s.photos from public.trial_shares s
          where s.id = p_id and s.deleted_at is null and s.created_at > now() - interval '30 days');
end $$;

-- Las que ya tienen 30 días y aún tienen fotos guardadas (las borra api/cron.js).
create or replace function public.api_shares_expired(p_limit integer default 300)
returns table (id text, photos smallint)
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  return query select s.id, s.photos from public.trial_shares s
               where s.deleted_at is null and s.created_at <= now() - interval '30 days'
               order by s.created_at limit greatest(1, least(p_limit, 1000));
end $$;

create or replace function public.api_shares_deleted(p_ids text[])
returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  update public.trial_shares set deleted_at = now() where id = any(p_ids) and deleted_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.api_share_create(text, integer) from public, anon, authenticated;
revoke execute on function public.api_share_upload_ok(text, integer) from public, anon, authenticated;
revoke execute on function public.api_share_get(text) from public, anon, authenticated;
revoke execute on function public.api_shares_expired(integer) from public, anon, authenticated;
revoke execute on function public.api_shares_deleted(text[]) from public, anon, authenticated;
grant execute on function public.api_share_create(text, integer) to service_role;
grant execute on function public.api_share_upload_ok(text, integer) to service_role;
grant execute on function public.api_share_get(text) to service_role;
grant execute on function public.api_shares_expired(integer) to service_role;
grant execute on function public.api_shares_deleted(text[]) to service_role;

-- El cubo, privado: sin políticas para nadie (la clave secreta del servidor no las necesita).
do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    raise notice 'Sin esquema storage (base local sin Supabase Storage): se omite.';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('prueba-fotos', 'prueba-fotos', false, 8388608, array['image/jpeg'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
                                 allowed_mime_types = excluded.allowed_mime_types;
end $$;
