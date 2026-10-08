begin;
-- Ubicacion opcional de una resena. Solo se guarda una ZONA aproximada, nunca la posicion exacta:
-- numeric(5,2) redondea a 2 decimales (alrededor de 1 km), lo hace la base de datos aunque la app mande mas precision.
-- Aplicar PRIMERO en el proyecto de pruebas. En produccion solo con confirmacion del dueño y ANTES de publicar la app que la usa.
alter table public.posts add column lat numeric(5,2), add column lng numeric(5,2);
alter table public.posts add constraint posts_location_check check(
 (lat is null and lng is null) or (lat between -90 and 90 and lng between -180 and 180)
);
commit;
