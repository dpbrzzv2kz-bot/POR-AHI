begin;
-- Publicaciones con varias fotos o videos (hasta 10 en total). La primera sigue siendo posts.media_path (portada).
-- Los demas van en post_media, posiciones 2 a 10. Aplicar PRIMERO en el proyecto de pruebas.
-- En produccion solo con confirmacion del dueño y ANTES de publicar la app que la usa.
create table public.post_media (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 position smallint not null check(position between 2 and 10),
 kind text not null check(kind in('image','video')),
 media_path text not null unique,
 created_at timestamptz not null default now(),
 unique(post_id,position),
 check(split_part(media_path,'/',1)=user_id::text)
);
create index post_media_post_idx on public.post_media(post_id,position);
alter table public.post_media enable row level security;
revoke all on public.post_media from anon,authenticated;
grant select on public.post_media to anon,authenticated;
grant insert on public.post_media to authenticated;
-- Se ve lo mismo que se ve de la publicacion: bloqueos, moderacion y retiros ya filtran public.posts.
create policy post_media_read on public.post_media for select to anon,authenticated
 using(exists(select 1 from public.posts p where p.id=post_id));
create policy post_media_add_own on public.post_media for insert to authenticated with check(
 user_id=(select auth.uid())
 and exists(select 1 from public.posts p where p.id=post_id and p.user_id=(select auth.uid()))
 and split_part(media_path,'/',1)=(select auth.uid())::text
 and exists(select 1 from storage.objects o where o.bucket_id='review-media' and o.name=media_path)
);
-- Misma validacion de tipo y tamano que la portada (010_large_media.sql) y misma proteccion de cuentas en borrado (011).
create trigger post_media_validation before insert on public.post_media for each row execute function public.validate_visual_media();
create trigger account_write_guard before insert or update on public.post_media for each row execute function public.guard_account_write();
-- Los archivos extra se pueden leer mientras se pueda ver la publicacion.
create policy review_media_extra_read on storage.objects for select to anon,authenticated using(
 bucket_id='review-media' and exists(select 1 from public.post_media pm join public.posts p on p.id=pm.post_id where pm.media_path=name)
);

-- Moderacion: ademas de la portada, se pueden ver los archivos extra de una publicacion reportada (009_moderation.sql).
create or replace function public.reported_media(path text) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_moderator() and exists(select 1 from public.content_reports r where
 (r.target_kind='post' and exists(select 1 from public.posts p where p.id=r.target_id and p.media_path=path)) or
 (r.target_kind='post' and exists(select 1 from public.post_media pm where pm.post_id=r.target_id and pm.media_path=path)) or
 (r.target_kind='story' and exists(select 1 from public.stories s where s.id=r.target_id and s.media_path=path)));
$$;

-- Borrado propio (012_own_content.sql): al eliminar una publicacion tambien se retiran sus archivos extra.
create or replace function public.own_content_file_deleting(path text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.role()='authenticated' and exists(select 1 from auth.sessions where user_id=auth.uid() and id::text=auth.jwt()->>'session_id' and (not_after is null or not_after>now()))
 and not exists(select 1 from public.account_deletions where user_id=auth.uid())
 and (
  exists(select 1 from public.content_deletions where user_id=auth.uid() and media_path=path and finished_at is null)
  or exists(select 1 from public.post_media pm join public.content_deletions d on d.target_kind='post' and d.target_id=pm.post_id
   where pm.media_path=path and d.user_id=auth.uid() and d.finished_at is null)
 );
$$;

create or replace function public.content_management(p_action text,p_kind text default null,p_id uuid default null,p_confirmation text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid=public.content_account();d public.content_deletions;path text;items jsonb;extra jsonb;
begin
 if p_action='pending' then
  select coalesce(jsonb_agg(jsonb_build_object('kind',target_kind,'id',target_id)),'[]'::jsonb) into items
  from (select target_kind,target_id from public.content_deletions where user_id=uid and finished_at is null order by started_at limit 100)q;
  return jsonb_build_object('items',items);
 end if;
 if p_action is null or p_action not in('begin','finish') or p_kind is null or p_kind not in('post','story') or p_id is null then raise exception 'INVALID_ACTION';end if;
 if p_confirmation is distinct from 'ELIMINAR' then raise exception 'CONFIRMATION_REQUIRED';end if;
 select * into d from public.content_deletions where target_kind=p_kind and target_id=p_id and user_id=uid for update;
 if found then
  if d.finished_at is not null then return jsonb_build_object('deleted',true);end if;
  path=d.media_path;
 elsif p_action='finish' then raise exception 'DELETION_NOT_STARTED';
 else
  if p_kind='post' then select media_path into path from public.posts where id=p_id and user_id=uid for update;
  else select media_path into path from public.stories where id=p_id and user_id=uid for update;end if;
  if path is null then raise exception 'CONTENT_UNAVAILABLE';end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('porahi.media:'||path,0));
  if split_part(path,'/',1)<>uid::text or exists(select 1 from storage.objects where bucket_id='review-media' and name=path and
   ((owner_id is not null and owner_id<>uid::text) or (owner is not null and owner<>uid))) or
   exists(select 1 from public.posts where media_path=path and (p_kind<>'post' or id<>p_id)) or
   exists(select 1 from public.stories where media_path=path and (p_kind<>'story' or id<>p_id)) then raise exception 'STORAGE_REVIEW_REQUIRED';end if;
  insert into public.content_deletions(target_kind,target_id,user_id,media_path) values(p_kind,p_id,uid,path);
 end if;
 if p_action='begin' then
  -- Archivos extra de la publicacion (vacio para stories y publicaciones de un solo archivo).
  select coalesce(jsonb_agg(pm.media_path order by pm.position),'[]'::jsonb) into extra
  from public.post_media pm where p_kind='post' and pm.post_id=p_id and pm.user_id=uid;
  return jsonb_build_object('file',path,'files',extra,'pending',true);
 end if;
 if exists(select 1 from storage.objects where bucket_id='review-media' and name=path)
  or (p_kind='post' and exists(select 1 from storage.objects o join public.post_media pm on pm.media_path=o.name where o.bucket_id='review-media' and pm.post_id=p_id))
 then raise exception 'FILES_REMAIN';end if;
 -- Storage binaries are removed by the Storage API, never by SQL metadata deletion.
 delete from public.moderation_holds h where (h.target_kind=p_kind and h.target_id=p_id) or
  (p_kind='post' and h.target_kind='comment' and exists(select 1 from public.comments c where c.id=h.target_id and c.post_id=p_id));
 delete from public.content_reports r where (r.target_kind=p_kind and r.target_id=p_id) or
  (p_kind='post' and r.target_kind='comment' and exists(select 1 from public.comments c where c.id=r.target_id and c.post_id=p_id));
 if p_kind='post' then delete from public.posts where id=p_id and user_id=uid;
 else delete from public.stories where id=p_id and user_id=uid;end if;
 update public.content_deletions set finished_at=now() where target_kind=p_kind and target_id=p_id and user_id=uid;
 return jsonb_build_object('deleted',true);
end $$;
commit;
