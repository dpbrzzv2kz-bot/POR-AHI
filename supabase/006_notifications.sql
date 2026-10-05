begin;
create table public.notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references auth.users(id) on delete cascade,
 actor_id uuid not null references auth.users(id) on delete cascade,
 actor_name text not null,
 kind text not null check(kind in ('follow','like','comment')),
 post_id uuid references public.posts(id) on delete cascade,
 comment_id uuid references public.comments(id) on delete cascade,
 event_key text not null unique,
 created_at timestamptz not null default now(),
 read_at timestamptz,
 withdrawn_at timestamptz,
 check(recipient_id<>actor_id)
);
create index notifications_recipient_idx on public.notifications(recipient_id,created_at desc,id desc) where withdrawn_at is null;
alter table public.notifications enable row level security;
revoke all on public.notifications from anon,authenticated;
grant select on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;
create policy notifications_read_own on public.notifications for select to authenticated using(recipient_id=(select auth.uid()) and withdrawn_at is null);
create policy notifications_mark_own on public.notifications for update to authenticated using(recipient_id=(select auth.uid()) and withdrawn_at is null) with check(recipient_id=(select auth.uid()));
-- Events are generated only by committed social actions, never by client inserts.
create function public.notify_social_action() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid;recipient uuid;pid uuid;cid uuid;event_kind text;key text;name text;withdraw boolean;
begin
 withdraw=(tg_op='DELETE');
 if tg_table_name='follows' then
  event_kind='follow';
  if tg_op='DELETE' then actor=old.follower_id;recipient=old.followed_id;else actor=new.follower_id;recipient=new.followed_id;end if;
  key='follow:'||actor||':'||recipient;
 elsif tg_table_name='post_likes' then
  event_kind='like';
  if tg_op='DELETE' then actor=old.user_id;pid=old.post_id;else actor=new.user_id;pid=new.post_id;end if;
  select p.user_id into recipient from public.posts p where p.id=pid;
  key='like:'||actor||':'||pid;
 else
  event_kind='comment';
  if tg_op='DELETE' then actor=old.user_id;pid=old.post_id;cid=old.id;
  else actor=new.user_id;pid=new.post_id;cid=new.id;withdraw=(new.deleted_at is not null);end if;
  select p.user_id into recipient from public.posts p where p.id=pid;
  key='comment:'||cid;
 end if;
 if recipient is null or recipient=actor then return null;end if;
 if withdraw then update public.notifications set withdrawn_at=now() where event_key=key;return null;end if;
 select nullif(p.display_name,'') into name from public.profiles p where p.id=actor;
 insert into public.notifications(recipient_id,actor_id,actor_name,kind,post_id,comment_id,event_key)
 values(recipient,actor,coalesce(name,'Una persona'),event_kind,pid,cid,key)
 on conflict(event_key) do update set withdrawn_at=null,actor_name=excluded.actor_name;
 return null;
end $$;
revoke all on function public.notify_social_action() from public,anon,authenticated;
create trigger follow_notification after insert or delete on public.follows for each row execute function public.notify_social_action();
create trigger like_notification after insert or delete on public.post_likes for each row execute function public.notify_social_action();
create trigger comment_notification after insert or update of deleted_at or delete on public.comments for each row execute function public.notify_social_action();
commit;
