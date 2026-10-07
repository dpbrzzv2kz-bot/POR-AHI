begin;
-- Two stages: freeze this account, remove binaries through Storage API, then delete Auth.
-- No service-role key in the app; this RPC has no target-user parameter.
create table public.account_deletions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 started_at timestamptz not null default now()
);
alter table public.account_deletions enable row level security;
revoke all on public.account_deletions from public,anon,authenticated;

-- A signed JWT can outlive the deleted user. Serialize writes with the deletion lock
-- and reject writes from an absent/frozen account, including in-flight TUS completion.
create function public.guard_account_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid();
begin
 if auth.role()='authenticated' then
  perform 1 from auth.users where id=uid for key share;
  if not found or exists(select 1 from public.account_deletions where user_id=uid) then
   raise exception 'ACCOUNT_UNAVAILABLE' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_account_write() from public,anon,authenticated;
do $$ declare tbl text; begin
 foreach tbl in array array['profiles','posts','stories','follows','post_likes','bookmarks','comments','conversations','messages','user_blocks','content_reports'] loop
  execute format('create trigger account_write_guard before insert or update on public.%I for each row execute function public.guard_account_write()',tbl);
 end loop;
end $$;
-- Storage is managed by Supabase. Protect uploads with policies, not a schema trigger.
create function public.account_upload_allowed() returns boolean
language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid();
begin
 perform 1 from auth.users where id=uid for key share;
 return found and not exists(select 1 from public.account_deletions where user_id=uid);
end $$;
revoke all on function public.account_upload_allowed() from public,anon,authenticated;
grant execute on function public.account_upload_allowed() to authenticated;
create policy account_upload_guard on storage.objects as restrictive for insert to authenticated
 with check(public.account_upload_allowed());
create policy account_upload_update_guard on storage.objects as restrictive for update to authenticated
 using(public.account_upload_allowed()) with check(public.account_upload_allowed());

-- Historical administrator references must not prevent the person from leaving.
alter table public.moderation_holds alter column updated_by drop not null;
alter table public.moderation_holds drop constraint moderation_holds_updated_by_fkey;
alter table public.moderation_holds add constraint moderation_holds_updated_by_fkey
 foreign key(updated_by) references auth.users(id) on delete set null;
alter table public.moderation_audit alter column moderator_id drop not null;
alter table public.moderation_audit drop constraint moderation_audit_moderator_id_fkey;
alter table public.moderation_audit add constraint moderation_audit_moderator_id_fkey
 foreign key(moderator_id) references auth.users(id) on delete set null;
alter table public.moderation_audit drop constraint moderation_audit_report_id_fkey;
alter table public.moderation_audit add constraint moderation_audit_report_id_fkey
 foreign key(report_id) references public.content_reports(id) on delete cascade;

create function public.account_deletion(p_action text,p_confirmation text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid();claims jsonb=auth.jwt();pending boolean;files jsonb;
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
  if exists(select 1 from storage.objects where (owner_id=uid::text or owner=uid or
   (bucket_id='review-media' and split_part(name,'/',1)=uid::text)) and
   (bucket_id<>'review-media' or split_part(name,'/',1)<>uid::text or
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
  return jsonb_build_object('files',files);
 end if;
 -- Never delete Storage metadata in SQL: that would leave orphaned binary files.
 if exists(select 1 from storage.objects where owner_id=uid::text or owner=uid or
  (bucket_id='review-media' and split_part(name,'/',1)=uid::text)) then raise exception 'FILES_REMAIN';end if;
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
revoke all on function public.account_deletion(text,text) from public,anon,authenticated;
grant execute on function public.account_deletion(text,text) to authenticated;

create function public.own_account_deleting() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.account_deletions where user_id=auth.uid());
$$;
revoke all on function public.own_account_deleting() from public,anon,authenticated;
grant execute on function public.own_account_deleting() to authenticated;
create policy review_media_deletion_read on storage.objects for select to authenticated using(
 bucket_id='review-media' and split_part(name,'/',1)=auth.uid()::text and public.own_account_deleting());
create policy review_media_deletion_remove on storage.objects for delete to authenticated using(
 bucket_id='review-media' and split_part(name,'/',1)=auth.uid()::text and public.own_account_deleting());
commit;
