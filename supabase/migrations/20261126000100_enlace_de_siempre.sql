-- El enlace de siempre de las parejas: /pareja/#llave=<clave>. Sirve todas las veces y desde cualquier
-- móvil, sin escribir nada (el de un solo uso obligaba a pedir otro al cambiar de móvil o al volver a
-- pulsar el del WhatsApp). La clave la cambia el equipo desde el panel si se la pasan a quien no debía.
-- Si ya instalaste la base de datos antes: pega SOLO este archivo en el editor SQL.

-- Cada fila ya existente recibe su propia clave (la función es volátil: se calcula fila a fila).
alter table public.couple_users
  add column access_key text not null default app.random_token(),
  add constraint couple_users_access_key_format check (access_key ~ '^[A-Za-z0-9_-]{24,}$');
create unique index couple_users_access_key_key on public.couple_users (access_key);
comment on column public.couple_users.access_key is 'Clave del enlace de siempre de la pareja (/pareja/#llave=…). Cambiarla anula el enlace anterior.';

-- ¿Este email es de una pareja con una boda activa? (para el email de acceso y el botón del panel)
-- Igual que antes, y ahora también devuelve su clave.
create or replace function public.api_couple_access(p_email text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c record;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  select cu.id, cu.email, cu.name, cu.user_id, cu.access_key, w.config #> '{event,couple}' as couple
    into c
    from public.couple_users cu join public.weddings w on w.id = cu.wedding_id
   where lower(cu.email) = lower(btrim(p_email)) and w.status <> 'retirada'
   order by w.wedding_date nulls last limit 1;
  if c.id is null then return null; end if;
  update public.couple_users set last_link_at = now() where lower(email) = lower(btrim(p_email));
  return jsonb_build_object('email', c.email, 'name', c.name, 'user_id', c.user_id, 'couple', c.couple, 'access_key', c.access_key);
end $$;

-- ¿De quién es esta clave? Devuelve su email si la boda sigue activa (para entrar con el enlace de siempre).
create or replace function public.api_couple_key(p_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  if p_key is null or length(p_key) < 24 then return null; end if;
  select cu.email into v_email
    from public.couple_users cu join public.weddings w on w.id = cu.wedding_id
   where cu.access_key = p_key and w.status <> 'retirada';
  if v_email is null then return null; end if;
  return jsonb_build_object('email', v_email);
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.api_couple_access(text)', 'public.api_couple_key(text)'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
