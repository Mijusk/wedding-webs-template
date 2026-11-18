-- WeddingWebs · Nombres nuevos de las tarifas: Esencial, Completa y Atelier.
--
-- Si ya instalaste la base de datos antes: pega SOLO este archivo en el editor SQL.
--
--   · Solo cambia el nombre que se ve (products.name) y el «Todo lo de …» de lo que incluye.
--     Los códigos (tal-cual, con-cambios, a-medida), los precios y las rondas no cambian, así
--     que los pedidos, las bodas y los enlaces de pago que ya existen siguen igual.
--   · Las facturas ya emitidas conservan el nombre con el que se emitieron.

update public.products set name = 'Esencial' where code = 'tal-cual';

update public.products set
  name = 'Completa',
  includes = (select coalesce(jsonb_agg(case when e.x = 'Todo lo de Tal cual' then to_jsonb('Todo lo de Esencial'::text) else to_jsonb(e.x) end order by e.n), '[]'::jsonb)
                from jsonb_array_elements_text(includes) with ordinality as e(x, n))
 where code = 'con-cambios';

update public.products set
  name = 'Atelier',
  includes = (select coalesce(jsonb_agg(case when e.x = 'Todo lo de Con cambios' then to_jsonb('Todo lo de Completa'::text) else to_jsonb(e.x) end order by e.n), '[]'::jsonb)
                from jsonb_array_elements_text(includes) with ordinality as e(x, n))
 where code = 'a-medida';
