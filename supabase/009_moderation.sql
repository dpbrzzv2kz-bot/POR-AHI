begin;
create table public.moderators(user_id uuid primary key references auth.users(id) on delete cascade,created_at timestamptz not null default now());
alter table public.moderators enable row level security;
revoke all on public.moderators from anon,authenticated;
-- Membership is assigned only by the project owner, never by app/profile metadata.
create function public.is_moderator() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.moderators where user_id=auth.uid());
$$;
revoke all on function public.is_moderator() from public,anon,authenticated;
grant execute on function public.is_moderator() to authenticated;
create table public.moderation_holds(
 target_kind text not null check(target_kind in('post','story','comment','message')),
 target_id uuid not null,active boolean not null default true,
 updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now(),
 primary key(target_kind,target_id)
);
alter table public.moderation_holds enable row level security;
revoke all on public.moderation_holds from anon,authenticated;
create function public.content_hidden(kind text,target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.moderation_holds where target_kind=kind and target_id=target and active);
$$;
revoke all on function public.content_hidden(text,uuid) from public,anon,authenticated;
grant execute on function public.content_hidden(text,uuid) to anon,authenticated;
create policy posts_moderated on public.posts as restrictive for select to anon,authenticated using(not public.content_hidden('post',id));
create policy stories_moderated on public.stories as restrictive for select to anon,authenticated using(not public.content_hidden('story',id));
create policy comments_moderated on public.comments as restrictive for select to anon,authenticated using(not public.content_hidden('comment',id) and not public.content_hidden('post',post_id));
create policy comments_moderated_insert on public.comments as restrictive for insert to authenticated with check(not public.content_hidden('post',post_id));
create policy messages_moderated on public.messages as restrictive for select to authenticated using(not public.content_hidden('message',id));
create policy notices_moderated on public.notifications as restrictive for select to authenticated using((post_id is null or not public.content_hidden('post',post_id)) and (comment_id is null or not public.content_hidden('comment',comment_id)));
create or replace view public.post_stats with(security_barrier=true) as
 select p.id as post_id,coalesce(l.total,0)::bigint as likes_count,coalesce(c.total,0)::bigint as comments_count
 from public.posts p
 left join(select post_id,count(*) total from public.post_likes group by post_id)l on l.post_id=p.id
 left join(select post_id,count(*) total from public.comments where deleted_at is null and not public.content_hidden('comment',id) group by post_id)c on c.post_id=p.id
 where not public.content_hidden('post',p.id);
alter table public.content_reports add column review_version integer not null default 0;
create table public.moderation_audit(
 id uuid primary key,report_id uuid not null references public.content_reports(id),
 moderator_id uuid not null references auth.users(id),action text not null check(action in('hide','restore','review','dismiss','reopen')),
 note text not null check(length(btrim(note)) between 3 and 1000),created_at timestamptz not null default now()
);
alter table public.moderation_audit enable row level security;
revoke all on public.moderation_audit from anon,authenticated;
-- All administrative data is exposed through narrow RPCs with a fresh membership check.
create function public.moderation_queue(p_status text default 'pending') returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.is_moderator() then raise insufficient_privilege;end if;
 if p_status not in('pending','reviewed','dismissed') then raise exception 'Invalid status';end if;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into result from(
 select id,created_at,target_kind,reason,status,review_version from public.content_reports where status=p_status
 order by case when p_status='pending' then created_at end asc,created_at desc,id limit 50)q;
 return result;
end $$;
create function public.moderation_report(p_report uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.content_reports;preview text;path text;media text;author text;available boolean=false;history jsonb;
begin
 if not public.is_moderator() then raise insufficient_privilege;end if;
 select * into r from public.content_reports where id=p_report;
 if not found then raise exception 'Report unavailable';end if;
 select display_name into author from public.profiles where id=r.target_owner;
 case r.target_kind
 when 'profile' then select display_name||' · @'||username||' · '||bio into preview from public.profiles where id=r.target_id;
 when 'post' then select place||' · '||description,media_path,kind into preview,path,media from public.posts where id=r.target_id;
 when 'story' then select author_name||' · Story · vence '||expires_at,media_path,kind into preview,path,media from public.stories where id=r.target_id;
 when 'comment' then select body into preview from public.comments where id=r.target_id;
 when 'message' then select body into preview from public.messages where id=r.target_id;
 end case;
 available=found;
 select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) into history from(select action,note,created_at,moderator_id from public.moderation_audit where report_id=r.id order by created_at desc,id limit 20)a;
 return to_jsonb(r)-'reporter_id'||jsonb_build_object('author',author,'preview',preview,'media_path',path,'media_kind',media,'available',available,'hidden',public.content_hidden(r.target_kind,r.target_id),'history',history);
end $$;
create function public.moderation_decide(p_report uuid,p_action text,p_note text,p_version integer,p_request uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.content_reports;a public.moderation_audit;exists_target boolean;
begin
 if not public.is_moderator() then raise insufficient_privilege;end if;
 if p_action not in('hide','restore','review','dismiss','reopen') or length(btrim(p_note)) not between 3 and 1000 or p_request is null then raise exception 'Invalid decision';end if;
 select * into r from public.content_reports where id=p_report for update;
 if not found then raise exception 'Report unavailable';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(r.target_kind||r.target_id::text,0));
 select * into a from public.moderation_audit where id=p_request;
 if found then
  if a.report_id=p_report and a.moderator_id=auth.uid() and a.action=p_action and a.note=btrim(p_note) then return;end if;
  raise exception 'Request already used';
 end if;
 if r.review_version is distinct from p_version then raise exception 'Report changed; refresh';end if;
 if p_action in('hide','restore') then
  if r.target_kind='profile' then raise exception 'Profiles require a separate account review';end if;
  case r.target_kind
  when 'post' then select exists(select 1 from public.posts where id=r.target_id) into exists_target;
  when 'story' then select exists(select 1 from public.stories where id=r.target_id) into exists_target;
  when 'comment' then select exists(select 1 from public.comments where id=r.target_id) into exists_target;
  when 'message' then select exists(select 1 from public.messages where id=r.target_id) into exists_target;
  end case;
  if not exists_target then raise exception 'Content unavailable';end if;
  if public.content_hidden(r.target_kind,r.target_id)=(p_action='hide') then raise exception 'Visibility changed; refresh';end if;
  insert into public.moderation_holds(target_kind,target_id,active,updated_by) values(r.target_kind,r.target_id,p_action='hide',auth.uid())
  on conflict(target_kind,target_id) do update set active=excluded.active,updated_by=excluded.updated_by,updated_at=now();
 end if;
 update public.content_reports set status=case when p_action='dismiss' then 'dismissed' when p_action='reopen' then 'pending' else 'reviewed' end,review_version=review_version+1 where id=r.id;
 insert into public.moderation_audit(id,report_id,moderator_id,action,note) values(p_request,r.id,auth.uid(),p_action,btrim(p_note));
end $$;
-- Permits only media referenced by an existing report, not arbitrary private uploads.
create function public.reported_media(path text) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_moderator() and exists(select 1 from public.content_reports r where
 (r.target_kind='post' and exists(select 1 from public.posts p where p.id=r.target_id and p.media_path=path)) or
 (r.target_kind='story' and exists(select 1 from public.stories s where s.id=r.target_id and s.media_path=path)));
$$;
create policy review_reported_media on storage.objects for select to authenticated using(bucket_id='review-media' and public.reported_media(name));
revoke all on function public.moderation_queue(text),public.moderation_report(uuid),public.moderation_decide(uuid,text,text,integer,uuid),public.reported_media(text) from public,anon,authenticated;
grant execute on function public.moderation_queue(text),public.moderation_report(uuid),public.moderation_decide(uuid,text,text,integer,uuid),public.reported_media(text) to authenticated;
commit;
