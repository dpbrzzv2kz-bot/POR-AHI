begin;
create table public.post_likes (
 user_id uuid not null references auth.users(id) on delete cascade,
 post_id uuid not null references public.posts(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,post_id)
);
create index post_likes_post_idx on public.post_likes(post_id);
create table public.bookmarks (
 user_id uuid not null references auth.users(id) on delete cascade,
 post_id uuid not null references public.posts(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,post_id)
);
alter table public.post_likes enable row level security;
alter table public.bookmarks enable row level security;
revoke all on public.post_likes,public.bookmarks from anon,authenticated;
grant select,insert,delete on public.post_likes,public.bookmarks to authenticated;
create policy likes_read_own on public.post_likes for select to authenticated using(user_id=(select auth.uid()));
create policy likes_add_own on public.post_likes for insert to authenticated with check(user_id=(select auth.uid()));
create policy likes_remove_own on public.post_likes for delete to authenticated using(user_id=(select auth.uid()));
create policy bookmarks_read_own on public.bookmarks for select to authenticated using(user_id=(select auth.uid()));
create policy bookmarks_add_own on public.bookmarks for insert to authenticated with check(user_id=(select auth.uid()));
create policy bookmarks_remove_own on public.bookmarks for delete to authenticated using(user_id=(select auth.uid()));
create table public.comments (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 post_id uuid not null references public.posts(id) on delete cascade,
 author_name text not null,
 body text not null check(char_length(btrim(body)) between 1 and 1000),
 created_at timestamptz not null default now(),
 deleted_at timestamptz
);
create index comments_post_idx on public.comments(post_id,created_at desc,id desc);
alter table public.comments enable row level security;
revoke all on public.comments from anon,authenticated;
grant select on public.comments to anon,authenticated;
grant insert on public.comments to authenticated;
-- Removal is reversible. No editing other fields through the client.
grant update(deleted_at) on public.comments to authenticated;
create policy comments_read on public.comments for select to anon,authenticated using(deleted_at is null or user_id=(select auth.uid()));
create policy comments_add_own on public.comments for insert to authenticated with check(user_id=(select auth.uid()) and deleted_at is null);
create policy comments_remove_own on public.comments for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create trigger comment_author before insert on public.comments for each row execute function public.set_post_author();
-- Public aggregates expose counts, not identities or anyone's bookmarks.
create view public.post_stats with (security_barrier=true) as
 select p.id as post_id,coalesce(l.total,0)::bigint as likes_count,coalesce(c.total,0)::bigint as comments_count
 from public.posts p
 left join (select post_id,count(*) total from public.post_likes group by post_id) l on l.post_id=p.id
 left join (select post_id,count(*) total from public.comments where deleted_at is null group by post_id) c on c.post_id=p.id;
revoke all on public.post_stats from anon,authenticated;
grant select on public.post_stats to anon,authenticated;
commit;
