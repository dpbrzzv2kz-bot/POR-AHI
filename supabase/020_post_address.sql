begin;
-- Direccion en texto del lugar elegido en el mapa (viene de OpenStreetMap/Nominatim al elegir el lugar).
-- Aplicar PRIMERO en el proyecto de pruebas. En produccion solo con confirmacion del dueño y ANTES de publicar la app que la usa.
alter table public.posts add column address text check(address is null or char_length(address)<=300);
commit;
