begin;
-- Textos y emojis que se ponen sobre una story antes de publicarla. Se guardan como lista (JSON) y la app los dibuja encima de la foto o el video.
-- Cada elemento: {id,type:'text'|'emoji',text,x,y,size,color} con x,y,size en proporciones (0 a 1) del ancho/alto de la pantalla. Las stories anteriores quedan en null.
-- Aplicar PRIMERO en el proyecto de pruebas. En produccion solo con confirmacion del dueño y ANTES de publicar la app que la usa.
alter table public.stories add column overlays jsonb check(overlays is null or (jsonb_typeof(overlays)='array' and jsonb_array_length(overlays)<=20 and octet_length(overlays::text)<=8000));
commit;
