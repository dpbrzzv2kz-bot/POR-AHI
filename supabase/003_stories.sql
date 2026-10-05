begin;
create table public.stories (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 author_name text not null,
 kind text not null check(kind in ('image','video')),
 media_path text not null unique,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '24 hours',
 check(split_part(media_path,'/',1)=user_id::text)
);
create index stories_expires_idx on public.stories(expires_at);
alter table public.stories enable row level security;
revoke all on public.stories from anon,authenticated;
grant select on public.stories to anon,authenticated;
grant insert on public.stories to authenticated;
create policy stories_active_read on public.stories for select to anon,authenticated using(expires_at>now());
create policy stories_create on public.stories for insert to authenticated with check(
 user_id=(select auth.uid()) and exists(select 1 from storage.objects o where o.bucket_id='review-media' and o.name=media_path)
);
create function public.set_story_expiry() returns trigger language plpgsql set search_path='' as $$
begin new.created_at=now();new.expires_at=now()+interval '24 hours';return new;end;
$$;
create trigger story_author before insert on public.stories for each row execute function public.set_post_author();
create trigger story_expiry before insert on public.stories for each row execute function public.set_story_expiry();
create policy review_media_story_read on storage.objects for select to anon,authenticated using(
 bucket_id='review-media' and exists(select 1 from public.stories st where st.media_path=name and st.expires_at>now())
);
commit;
