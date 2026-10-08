begin;
-- Shorts: una publicacion de solo video marcada como short. Reutiliza todo lo de posts (reportes, bloqueos, moderacion,
-- borrado, corazones, tomates y comentarios). Inicio muestra is_short=false; la pestana Videos muestra is_short=true.
-- Aplicar PRIMERO en el proyecto de pruebas. En produccion solo con confirmacion del dueño y ANTES de publicar la app que la usa.
alter table public.posts add column is_short boolean not null default false;
alter table public.posts add constraint posts_short_is_video check(not is_short or kind='video');
create index posts_short_idx on public.posts(is_short,created_at desc,id desc);
commit;
