-- WeddingWebs · Cookies de publicidad del escaparate.
--
-- Si ya instalaste la base de datos antes: pega SOLO este archivo en el editor SQL.
--
--   · Cuando un lead llega con la elección del aviso de cookies (aceptar o rechazar), se guarda en
--     consents con el propósito «cookies_publicidad»: el texto exacto que vio, la fecha, IP y navegador.
--   · Solo se añade una fila si cambia lo elegido respecto a la última guardada para ese lead,
--     para no llenar la tabla con cada prueba que repite.

create or replace function public.api_record_cookie_consent(
  p_lead_id uuid, p_granted boolean, p_text text, p_page text, p_ip text, p_user_agent text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_ip inet;
  v_last boolean;
  v_email text;
begin
  if not app.is_service() then raise exception 'Solo desde el servidor.' using errcode = '42501'; end if;
  if p_lead_id is null or p_granted is null or nullif(btrim(p_text), '') is null then return false; end if;

  select c.granted into v_last from public.consents c
   where c.lead_id = p_lead_id and c.purpose = 'cookies_publicidad'
   order by c.created_at desc limit 1;
  if v_last is not distinct from p_granted then return false; end if;

  select l.email into v_email from public.leads l where l.id = p_lead_id;
  if not found then return false; end if;
  begin v_ip := nullif(p_ip, '')::inet; exception when others then v_ip := null; end;

  insert into public.consents (lead_id, email, purpose, granted, text, source, ip, user_agent)
  values (p_lead_id, v_email, 'cookies_publicidad', p_granted, left(p_text, 2000),
          left(coalesce(p_page, 'escaparate'), 300), v_ip, left(p_user_agent, 300));
  return true;
end $$;

revoke execute on function public.api_record_cookie_consent(uuid, boolean, text, text, text, text) from public, anon, authenticated;
grant execute on function public.api_record_cookie_consent(uuid, boolean, text, text, text, text) to service_role;
