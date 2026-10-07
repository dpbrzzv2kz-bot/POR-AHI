begin;
-- Only narrow owner RPCs may edit/remove content. No direct UPDATE/DELETE grant.
alter table public.posts add column edit_version integer not null default 0;
create function public.initial_post_version() returns trigger language plpgsql set search_path='' as $$
begin new.edit_version=0;return new;end $$;
create trigger post_initial_version before insert on public.posts for each row execute function public.initial_post_version();

-- Retain a small tombstone to prevent retrying an old upload from resurrecting it.
create table public.content_deletions(
 target_kind text not null check(target_kind in('post','story')),
 target_id uuid not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 media_path text not null unique,
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 primary key(target_kind,target_id),
 check(split_part(media_path,'/',1)=user_id::text)
);
alter table public.content_deletions enable row level security;
revoke all on public.content_deletions from public,anon,authenticated;
create index content_deletions_pending on public.content_deletions(user_id,started_at) where finished_at is null;

create function public.content_withdrawn(kind text,target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.content_deletions where target_kind=kind and target_id=target);
$$;
revoke all on function public.content_withdrawn(text,uuid) from public,anon,authenticated;
grant execute on function public.content_withdrawn(text,uuid) to anon,authenticated;
create policy posts_withdrawn on public.posts as restrictive for select to anon,authenticated using(not public.content_withdrawn('post',id));
create policy stories_withdrawn on public.stories as restrictive for select to anon,authenticated using(not public.content_withdrawn('story',id));
create policy comments_withdrawn on public.comments as restrictive for select to anon,authenticated using(not public.content_withdrawn('post',post_id));
create policy comments_withdrawn_insert on public.comments as restrictive for insert to authenticated with check(not public.content_withdrawn('post',post_id));
create policy notices_withdrawn on public.notifications as restrictive for select to authenticated using(post_id is null or not public.content_withdrawn('post',post_id));
-- post_stats is a definer view: explicitly filter withdrawn posts as well.
create or replace view public.post_stats with(security_barrier=true) as
 select p.id as post_id,coalesce(l.total,0)::bigint as likes_count,coalesce(c.total,0)::bigint as comments_count
 from public.posts p
 left join(select post_id,count(*) total from public.post_likes group by post_id)l on l.post_id=p.id
 left join(select post_id,count(*) total from public.comments where deleted_at is null and not public.content_hidden('comment',id) group by post_id)c on c.post_id=p.id
 where not public.content_hidden('post',p.id) and not public.content_withdrawn('post',p.id);

create function public.content_account() returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid();
begin
 if uid is null or auth.role() is distinct from 'authenticated' or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
  raise exception 'SIGN_IN_REQUIRED' using errcode='42501';
 end if;
 perform 1 from auth.users where id=uid for key share;
 if not found or not exists(select 1 from auth.sessions where user_id=uid and id::text=auth.jwt()->>'session_id' and (not_after is null or not_after>now())) then
  raise exception 'SIGN_IN_REQUIRED' using errcode='42501';
 end if;
 if exists(select 1 from public.account_deletions where user_id=uid) then raise exception 'ACCOUNT_UNAVAILABLE';end if;
 return uid;
end $$;
revoke all on function public.content_account() from public,anon,authenticated;

create function public.edit_own_review(p_id uuid,p_version integer,p_place text,p_category text,p_description text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid=public.content_account();r public.posts;
begin
 select * into r from public.posts where id=p_id and user_id=uid for update;
 if not found or public.content_withdrawn('post',p_id) then raise exception 'CONTENT_UNAVAILABLE';end if;
 if public.content_hidden('post',p_id) then raise exception 'EDIT_BLOCKED';end if;
 if p_version is null or p_version<>r.edit_version then raise exception 'EDIT_CONFLICT';end if;
 if p_place is null or char_length(btrim(p_place)) not between 2 and 100 or
  p_category is null or p_category not in('Comer','Divertirse','Explorar') or
  p_description is null or char_length(p_description)>1500 then raise exception 'INVALID_DETAILS';end if;
 update public.posts set place=btrim(p_place),category=p_category,description=p_description,edit_version=edit_version+1 where id=r.id;
 return jsonb_build_object('id',r.id,'version',r.edit_version+1);
end $$;
revoke all on function public.edit_own_review(uuid,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.edit_own_review(uuid,integer,text,text,text) to authenticated;

create function public.content_management(p_action text,p_kind text default null,p_id uuid default null,p_confirmation text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid=public.content_account();d public.content_deletions;path text;items jsonb;
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
 if p_action='begin' then return jsonb_build_object('file',path,'pending',true);end if;
 if exists(select 1 from storage.objects where bucket_id='review-media' and name=path) then raise exception 'FILES_REMAIN';end if;
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
revoke all on function public.content_management(text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.content_management(text,text,uuid,text) to authenticated;

create function public.own_content_file_deleting(path text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.role()='authenticated' and exists(select 1 from auth.sessions where user_id=auth.uid() and id::text=auth.jwt()->>'session_id' and (not_after is null or not_after>now()))
 and not exists(select 1 from public.account_deletions where user_id=auth.uid())
 and exists(select 1 from public.content_deletions where user_id=auth.uid() and media_path=path and finished_at is null);
$$;
revoke all on function public.own_content_file_deleting(text) from public,anon,authenticated;
grant execute on function public.own_content_file_deleting(text) to authenticated;
create policy review_media_content_remove on storage.objects for delete to authenticated using(
 bucket_id='review-media' and split_part(name,'/',1)=auth.uid()::text and public.own_content_file_deleting(name));

create function public.content_upload_allowed(path text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 -- Serialize uploads against withdrawal, so a completed removal cannot be re-uploaded.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('porahi.media:'||path,0));
 return not exists(select 1 from public.content_deletions where media_path=path);
end $$;
revoke all on function public.content_upload_allowed(text) from public,anon,authenticated;
grant execute on function public.content_upload_allowed(text) to authenticated;
create policy review_media_retired_insert on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'review-media' or public.content_upload_allowed(name));
create policy review_media_retired_update on storage.objects as restrictive for update to authenticated using(bucket_id<>'review-media' or public.content_upload_allowed(name)) with check(bucket_id<>'review-media' or public.content_upload_allowed(name));
create policy posts_retired_insert on public.posts as restrictive for insert to authenticated with check(not public.content_withdrawn('post',id) and public.content_upload_allowed(media_path));
create policy stories_retired_insert on public.stories as restrictive for insert to authenticated with check(not public.content_withdrawn('story',id) and public.content_upload_allowed(media_path));
commit;
