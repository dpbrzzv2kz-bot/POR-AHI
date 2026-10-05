begin;
-- Only these display fields are public. The underlying profile remains owner-only.
create view public.public_profiles with (security_barrier=true) as
 select id,display_name,username,bio from public.profiles
 where username is not null and display_name<>'';
revoke all on public.public_profiles from anon,authenticated;
grant select on public.public_profiles to anon,authenticated;
create table public.follows (
 follower_id uuid not null references public.profiles(id) on delete cascade,
 followed_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(follower_id,followed_id),
 check(follower_id<>followed_id)
);
alter table public.follows enable row level security;
revoke all on public.follows from anon,authenticated;
grant select,insert,delete on public.follows to authenticated;
create policy follows_read_own on public.follows for select to authenticated using(follower_id=(select auth.uid()));
create policy follows_create_own on public.follows for insert to authenticated with check(
 follower_id=(select auth.uid()) and
 exists(select 1 from public.public_profiles p where p.id=followed_id) and
 exists(select 1 from public.profiles p where p.id=follower_id and p.username is not null and p.display_name<>'')
);
create policy follows_delete_own on public.follows for delete to authenticated using(follower_id=(select auth.uid()));
commit;
