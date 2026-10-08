begin;
-- La foto de perfil vive en el bucket "avatars" (013_avatars.sql). account_deletion (011) solo conocia review-media:
-- veia el archivo de la foto como "otro bucket" y paraba con STORAGE_REVIEW_REQUIRED, asi que una persona con foto no podia borrar su cuenta.
-- Ahora la carpeta propia de avatars cuenta como archivos de la cuenta: 'files' los devuelve en 'avatars' y 'finish' exige que ya no queden.
-- Aplicar PRIMERO en el proyecto de pruebas. En produccion solo con confirmacion del dueño y ANTES de publicar la app que la usa.
create or replace function public.account_deletion(p_action text,p_confirmation text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid();claims jsonb=auth.jwt();pending boolean;files jsonb;avatars jsonb;
begin
 if uid is null or auth.role() is distinct from 'authenticated' or coalesce((claims->>'is_anonymous')::boolean,false) then
  raise exception 'SIGN_IN_REQUIRED' using errcode='42501';
 end if;
 -- A revoked/deleted session cannot initiate or finish deletion even with a valid JWT.
 if not exists(select 1 from auth.sessions where user_id=uid and id::text=claims->>'session_id' and (not_after is null or not_after>now())) then
  raise exception 'SIGN_IN_REQUIRED' using errcode='42501';
 end if;
 perform 1 from auth.users where id=uid for update;
 if not found then raise exception 'SIGN_IN_REQUIRED' using errcode='42501';end if;
 pending=exists(select 1 from public.account_deletions where user_id=uid);
 if p_action='status' then return jsonb_build_object('pending',pending);end if;
 if p_action not in('begin','files','finish') or p_action is null then raise exception 'INVALID_ACTION';end if;
 if p_confirmation is distinct from 'ELIMINAR' then raise exception 'CONFIRMATION_REQUIRED';end if;
 -- Token refresh is deliberately insufficient. Require an actual login in the last 10 min.
 if not exists(select 1 from jsonb_array_elements(coalesce(claims->'amr','[]'::jsonb)) a
  where a->>'method' in('password','oauth') and
  (a->>'timestamp')::numeric between extract(epoch from now())-600 and extract(epoch from now())+30) then
  raise exception 'RECENT_SIGN_IN_REQUIRED' using errcode='42501';
 end if;
 if p_action='begin' then
  -- Serialize simultaneous administrator departures and keep one active moderator.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('porahi.account-deletion.moderators',0));
  if not pending and exists(select 1 from public.moderators where user_id=uid) and
   not exists(select 1 from public.moderators m where m.user_id<>uid and not exists(select 1 from public.account_deletions d where d.user_id=m.user_id)) then
   raise exception 'LAST_MODERATOR';
  end if;
  -- Stop BEFORE removing any file if another bucket or ownership mismatch needs review.
  -- review-media y avatars son los dos buckets de esta app; en ambos solo cuenta la carpeta propia.
  if exists(select 1 from storage.objects where (owner_id=uid::text or owner=uid or
   (bucket_id in('review-media','avatars') and split_part(name,'/',1)=uid::text)) and
   (bucket_id not in('review-media','avatars') or split_part(name,'/',1)<>uid::text or
    (owner_id is not null and owner_id<>uid::text) or (owner is not null and owner<>uid))) then
   raise exception 'STORAGE_REVIEW_REQUIRED';
  end if;
  insert into public.account_deletions(user_id) values(uid) on conflict do nothing;
  return jsonb_build_object('pending',true);
 end if;
 if not pending then raise exception 'DELETION_NOT_STARTED';end if;
 if p_action='files' then
  select coalesce(jsonb_agg(name),'[]'::jsonb) into files from(
   select name from storage.objects where bucket_id='review-media' and split_part(name,'/',1)=uid::text order by name limit 100
  )q;
  select coalesce(jsonb_agg(name),'[]'::jsonb) into avatars from(
   select name from storage.objects where bucket_id='avatars' and split_part(name,'/',1)=uid::text order by name limit 100
  )q;
  return jsonb_build_object('files',files,'avatars',avatars);
 end if;
 -- Never delete Storage metadata in SQL: that would leave orphaned binary files.
 if exists(select 1 from storage.objects where owner_id=uid::text or owner=uid or
  (bucket_id in('review-media','avatars') and split_part(name,'/',1)=uid::text)) then raise exception 'FILES_REMAIN';end if;
 -- Remove references to this person's disappearing content, before FK cascades.
 delete from public.moderation_holds h where
  (h.target_kind='post' and exists(select 1 from public.posts p where p.id=h.target_id and p.user_id=uid)) or
  (h.target_kind='story' and exists(select 1 from public.stories s where s.id=h.target_id and s.user_id=uid)) or
  (h.target_kind='comment' and exists(select 1 from public.comments c where c.id=h.target_id and (c.user_id=uid or exists(select 1 from public.posts p where p.id=c.post_id and p.user_id=uid)))) or
  (h.target_kind='message' and exists(select 1 from public.messages m join public.conversations c on c.id=m.conversation_id where m.id=h.target_id and uid in(c.user_low,c.user_high)));
 update public.moderation_audit set note='Cuenta eliminada' where moderator_id=uid;
 -- Cascades remove identities, sessions, profile, posts, stories, interactions,
 -- follows, notices, blocks, related reports AND entire two-person conversations.
 delete from auth.users where id=uid;
 return jsonb_build_object('deleted',true);
end $$;
commit;
