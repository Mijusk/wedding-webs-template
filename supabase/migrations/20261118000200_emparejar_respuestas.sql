-- WeddingWebs · Emparejar respuestas con la lista de invitados.
--
-- Si ya instalaste la base de datos antes: pega SOLO este archivo en el editor SQL.
--
-- Quien contesta desde el enlace general de la web (no desde su enlace personal) llega sin grupo.
-- El panel de la pareja compara su nombre con la lista (pareja/js/emparejar.js) y:
--   · si la coincidencia es casi segura, la une sola ('auto') y lo enseña con los dos nombres al lado;
--   · si solo se parece, la sugiere y la pareja la confirma ('pareja') o la descarta ('descartar').
-- Todo se puede deshacer. No cambia ninguna tabla: la marca va en rsvp_responses.payload
--   payload.emparejada  = 'auto' | 'pareja'   (la unió el panel: así «Deshacer» sabe qué soltar)
--   payload.descartados = [group_id, …]        (sugerencias que la pareja dijo que no eran)

-- Añade un id a una lista JSON sin repetirlo.
create or replace function app.add_once(p_list jsonb, p_item text) returns jsonb
language sql immutable as $$
  select case when coalesce(p_list, '[]'::jsonb) @> to_jsonb(p_item) then coalesce(p_list, '[]'::jsonb)
              else coalesce(p_list, '[]'::jsonb) || to_jsonb(p_item) end
$$;

create or replace function public.pareja_emparejar(p_wedding_id uuid, p_name_key text, p_group_id uuid, p_modo text)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  if not app.can_manage_wedding(p_wedding_id) then
    raise exception 'No tienes acceso a esta boda.' using errcode = '42501';
  end if;
  if p_modo not in ('auto', 'pareja', 'deshacer', 'descartar') then raise exception 'Modo no válido.'; end if;
  if coalesce(p_name_key, '') = '' then raise exception 'Falta el nombre.'; end if;
  if p_group_id is null or not exists (select 1 from public.guest_groups g where g.id = p_group_id and g.wedding_id = p_wedding_id) then
    raise exception 'Ese grupo no es de esta boda.';
  end if;

  if p_modo in ('auto', 'pareja') then
    -- Todas las respuestas sueltas con ese nombre (si cambió de opinión, son varias filas).
    update public.rsvp_responses r
       set group_id = p_group_id, payload = r.payload || jsonb_build_object('emparejada', p_modo)
     where r.wedding_id = p_wedding_id and r.group_id is null and r.name_key = p_name_key;
  elsif p_modo = 'deshacer' then
    -- Solo suelta lo que unió el panel: nunca lo que el grupo contestó desde su enlace.
    update public.rsvp_responses r
       set group_id = null,
           payload = (r.payload - 'emparejada') || jsonb_build_object('descartados',
             app.add_once(r.payload -> 'descartados', p_group_id::text))
     where r.wedding_id = p_wedding_id and r.group_id = p_group_id and r.name_key = p_name_key
       and r.payload ? 'emparejada';
  else
    update public.rsvp_responses r
       set payload = r.payload || jsonb_build_object('descartados',
             app.add_once(r.payload -> 'descartados', p_group_id::text))
     where r.wedding_id = p_wedding_id and r.group_id is null and r.name_key = p_name_key;
  end if;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.pareja_emparejar(uuid, text, uuid, text) from public, anon;
grant execute on function public.pareja_emparejar(uuid, text, uuid, text) to authenticated, service_role;
