begin;
-- Foto de perfil: un archivo por persona dentro de su propia carpeta del bucket publico "avatars".
-- Aplicar PRIMERO en el proyecto de pruebas. En produccion solo con confirmacion del dueño y ANTES de publicar la app que la usa.
alter table public.profiles add column avatar_path text;
alter table public.profiles add constraint profiles_avatar_path_check check(
 avatar_path is null or (split_part(avatar_path,'/',1)=id::text and avatar_path ~ '^[0-9a-f-]{36}/avatar-[0-9]{10,16}\.(jpg|png|webp)$')
);
-- Misma vista de siempre (008_safety.sql) con la columna nueva al final.
create or replace view public.public_profiles with(security_barrier=true) as
 select id,display_name,username,bio,avatar_path from public.profiles
 where username is not null and display_name<>'' and not public.blocked_with(id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avatars','avatars',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy avatars_insert_own on storage.objects for insert to authenticated
 with check(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
 using(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
do $$ begin
 if not exists(select 1 from storage.buckets where id='avatars' and public and file_size_limit=5242880) then
  raise exception 'No se creo el bucket avatars como se esperaba';
 end if;
end $$;
commit;
