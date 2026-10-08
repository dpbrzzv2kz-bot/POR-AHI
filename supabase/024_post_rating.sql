begin;
-- Calificacion del lugar que pone quien publica la resena: 1 (Tomatazo) a 5 (Imperdible). Las resenas anteriores quedan sin calificacion (null).
-- Aplicar PRIMERO en el proyecto de pruebas. En produccion solo con confirmacion del dueño y ANTES de publicar la app que la usa.
alter table public.posts add column rating smallint check(rating is null or rating between 1 and 5);
commit;
