begin;
create table public.user_blocks (
 blocker_id uuid not null references auth.users(id) on delete cascade,
 blocked_id uuid not null references auth.users(id) on delete cascade,
 blocked_name text not null default '',
 blocked_handle text not null default '',
 created_at timestamptz not null default now(),
 primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id)
);
create index blocks_reverse on public.user_blocks(blocked_id,blocker_id);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from anon,authenticated;
grant select,delete on public.user_blocks to authenticated;
grant insert(blocker_id,blocked_id) on public.user_blocks to authenticated;
create policy blocks_own_read on public.user_blocks for select to authenticated using(blocker_id=auth.uid());
create policy blocks_own_add on public.user_blocks for insert to authenticated with check(blocker_id=auth.uid());
create policy blocks_own_remove on public.user_blocks for delete to authenticated using(blocker_id=auth.uid());
-- Only answers whether the caller can interact with this target; no other pairs can be queried.
create function public.blocked_with(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_blocks b where (b.blocker_id=auth.uid() and b.blocked_id=target) or (b.blocked_id=auth.uid() and b.blocker_id=target));
$$;
revoke all on function public.blocked_with(uuid) from public,anon,authenticated;
grant execute on function public.blocked_with(uuid) to anon,authenticated;
create function public.prepare_block() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.blocker_id is distinct from auth.uid() then raise insufficient_privilege;end if;
 select display_name,username into new.blocked_name,new.blocked_handle from public.profiles where id=new.blocked_id and username is not null and display_name<>'';
 if new.blocked_handle is null then raise exception 'Profile unavailable';end if;
 new.created_at=now();return new;
end $$;
create function public.apply_block() returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from public.follows where (follower_id=new.blocker_id and followed_id=new.blocked_id) or (follower_id=new.blocked_id and followed_id=new.blocker_id);
 return new;
end $$;
revoke all on function public.prepare_block(),public.apply_block() from public,anon,authenticated;
create trigger block_prepare before insert on public.user_blocks for each row execute function public.prepare_block();
create trigger block_apply after insert on public.user_blocks for each row execute function public.apply_block();
create or replace view public.public_profiles with(security_barrier=true) as select id,display_name,username,bio from public.profiles where username is not null and display_name<>'' and not public.blocked_with(id);
-- Restrictive policies combine with the original ownership/public policies, never replace them.
create policy posts_block_filter on public.posts as restrictive for select to authenticated using(not public.blocked_with(user_id));
create policy stories_block_filter on public.stories as restrictive for select to authenticated using(not public.blocked_with(user_id));
create policy notices_block_filter on public.notifications as restrictive for select to authenticated using(not public.blocked_with(actor_id));
create policy follows_block_filter on public.follows as restrictive for insert to authenticated with check(not public.blocked_with(followed_id));
create policy chats_block_filter on public.conversations as restrictive for select to authenticated using(not public.blocked_with(case when user_low=auth.uid() then user_high else user_low end));
create policy chats_block_create on public.conversations as restrictive for insert to authenticated with check(not public.blocked_with(case when user_low=auth.uid() then user_high else user_low end));
create policy likes_block_filter on public.post_likes as restrictive for insert to authenticated with check(exists(select 1 from public.posts where id=post_id));
create policy bookmarks_block_filter on public.bookmarks as restrictive for insert to authenticated with check(exists(select 1 from public.posts where id=post_id));
create policy comments_block_read on public.comments as restrictive for select to authenticated using(not public.blocked_with(user_id) and exists(select 1 from public.posts where id=post_id));
create policy comments_block_send on public.comments as restrictive for insert to authenticated with check(exists(select 1 from public.posts where id=post_id));
create policy comments_block_restore on public.comments as restrictive for update to authenticated using(exists(select 1 from public.posts where id=post_id)) with check(exists(select 1 from public.posts where id=post_id));

create table public.content_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references auth.users(id) on delete cascade,
 target_kind text not null check(target_kind in ('profile','post','story','comment','message')),
 target_id uuid not null,
 target_owner uuid not null references auth.users(id) on delete cascade,
 reason text not null check(reason in ('Spam','Acoso','Contenido inapropiado','Suplantación','Otro')),
 details text not null default '' check(length(details)<=1000),
 status text not null default 'pending' check(status in ('pending','reviewed','dismissed')),
 created_at timestamptz not null default now(),
 unique(reporter_id,target_kind,target_id),check(reporter_id<>target_owner)
);
alter table public.content_reports enable row level security;
revoke all on public.content_reports from anon,authenticated;
grant select on public.content_reports to authenticated;
grant insert(reporter_id,target_kind,target_id,reason,details) on public.content_reports to authenticated;
create policy reports_own_read on public.content_reports for select to authenticated using(reporter_id=auth.uid());
create policy reports_own_send on public.content_reports for insert to authenticated with check(reporter_id=auth.uid());
-- Invoker respects the visibility of the reported item, including private messages and blocks.
create function public.prepare_report() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.reporter_id is distinct from auth.uid() then raise insufficient_privilege;end if;
 case new.target_kind
 when 'profile' then select id into new.target_owner from public.public_profiles where id=new.target_id;
 when 'post' then select user_id into new.target_owner from public.posts where id=new.target_id;
 when 'story' then select user_id into new.target_owner from public.stories where id=new.target_id;
 when 'comment' then select user_id into new.target_owner from public.comments where id=new.target_id and deleted_at is null;
 when 'message' then select sender_id into new.target_owner from public.messages where id=new.target_id;
 else raise exception 'Invalid target';
 end case;
 if new.target_owner is null then raise exception 'Item unavailable';end if;
 new.status='pending';new.created_at=now();return new;
end $$;
revoke all on function public.prepare_report() from public,anon,authenticated;
create trigger report_prepare before insert on public.content_reports for each row execute function public.prepare_report();
create index reports_pending on public.content_reports(created_at) where status='pending';
commit;
