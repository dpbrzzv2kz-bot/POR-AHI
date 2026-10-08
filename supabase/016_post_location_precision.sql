begin;
-- La ubicacion ahora es la del LUGAR que la persona elige en el mapa (no la suya), asi que necesita precision de calle:
-- 6 decimales (~10 cm). Reemplaza el redondeo a ~1 km de 015_post_location.sql.
-- Aplicar PRIMERO en el proyecto de pruebas. En produccion solo con confirmacion del dueño y ANTES de publicar la app que la usa.
alter table public.posts alter column lat type numeric(9,6), alter column lng type numeric(9,6);
commit;
