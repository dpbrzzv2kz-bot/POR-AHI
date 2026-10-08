begin;
-- Corrige 017_multi_media.sql tal como se aplico primero en pruebas: la politica de insercion de post_media
-- producia "infinite recursion detected in policy for relation post_media".
-- La 017 del repositorio ya trae esta correccion; en un proyecto nuevo, 018 es inofensiva (se puede correr o no).
create or replace function public.owns_post(post uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.posts p where p.id=post and p.user_id=auth.uid());
$$;
create or replace function public.own_media_exists(path text) returns boolean language sql stable security definer set search_path='' as $$
 select split_part(path,'/',1)=auth.uid()::text and exists(select 1 from storage.objects o where o.bucket_id='review-media' and o.name=path);
$$;
revoke all on function public.owns_post(uuid),public.own_media_exists(text) from public,anon,authenticated;
grant execute on function public.owns_post(uuid),public.own_media_exists(text) to authenticated;
drop policy if exists post_media_add_own on public.post_media;
create policy post_media_add_own on public.post_media for insert to authenticated with check(
 user_id=(select auth.uid()) and public.owns_post(post_id) and public.own_media_exists(media_path)
);
commit;
