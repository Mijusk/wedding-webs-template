-- WeddingWebs · Tarifas al día con el escaparate y constancia del permiso de analítica.
--
-- Si ya instalaste la base de datos antes: pega SOLO este archivo en el editor SQL.
--
--   · Lo que incluye cada tarifa (products.includes) queda igual que en el escaparate
--     (studio/studio.json): Con cambios ya no promete «secciones extra».
--   · Con cambios incluye ahora la lista de invitados con un enlace personal por familia o grupo
--     (RSVP ampliado), como A medida. Se aplica también a las bodas que ya tienen ese plan.
--   · Cuando un lead llega con la elección del aviso de cookies, se guarda en consents tanto el
--     permiso de publicidad («cookies_publicidad») como el de analítica («cookies_analitica»).

update public.products set includes = '["Vuestros datos, fotos y programa del día", "Panel con las confirmaciones al momento y descarga en Excel", "Publicada y lista para compartir", "Sin rondas de cambios: se entrega tal cual la habéis probado"]'::jsonb
 where code = 'tal-cual';
update public.products set
  includes = '["Todo lo de Tal cual", "Colores, tipografías y textos a medida", "Lista de invitados con un enlace personal por familia o grupo", "2 rondas de cambios de diseño"]'::jsonb,
  features = features || '{"rsvp_ampliado": true}'::jsonb
 where code = 'con-cambios';
update public.products set includes = '["Todo lo de Con cambios", "Diseño único, sin plantilla de partida", "3 rondas de cambios de diseño"]'::jsonb
 where code = 'a-medida';

-- La función anterior solo guardaba la publicidad. Ahora recibe también el propósito
-- (por defecto «cookies_publicidad», así sigue valiendo la llamada antigua).
drop function if exists public.api_record_cookie_consent(uuid, boolean, text, text, text, text);

create or replace function public.api_record_cookie_consent(
  p_lead_id uuid, p_granted boolean, p_text text, p_page text, p_ip text, p_user_agent text,
  p_purpose text default 'cookies_publicidad')
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_ip inet;
  v_last boolean;
  v_email text;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  if p_lead_id is null or p_granted is null or nullif(btrim(p_text), '') is null then return false; end if;
  if p_purpose not in ('cookies_publicidad', 'cookies_analitica') then return false; end if;

  -- Solo una fila nueva si cambia lo elegido respecto a la última guardada para ese lead.
  select c.granted into v_last from public.consents c
   where c.lead_id = p_lead_id and c.purpose = p_purpose
   order by c.created_at desc limit 1;
  if v_last is not distinct from p_granted then return false; end if;

  select l.email into v_email from public.leads l where l.id = p_lead_id;
  if not found then return false; end if;
  begin v_ip := nullif(p_ip, '')::inet; exception when others then v_ip := null; end;

  insert into public.consents (lead_id, email, purpose, granted, text, source, ip, user_agent)
  values (p_lead_id, v_email, p_purpose, p_granted, left(p_text, 2000),
          left(coalesce(p_page, 'escaparate'), 300), v_ip, left(p_user_agent, 300));
  return true;
end $$;

revoke execute on function public.api_record_cookie_consent(uuid, boolean, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.api_record_cookie_consent(uuid, boolean, text, text, text, text, text) to service_role;
