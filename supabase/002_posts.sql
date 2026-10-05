begin;
create table public.posts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 author_name text not null,
 category text not null check(category in ('Comer','Divertirse','Explorar')),
 place text not null check(char_length(place) between 2 and 100),
 description text not null default '' check(char_length(description)<=1500),
 kind text not null check(kind in ('image','video')),
 media_path text not null unique,
 created_at timestamptz not null default now(),
 check(split_part(media_path,'/',1)=user_id::text)
);
create index posts_created_idx on public.posts(created_at desc,id desc);
alter table public.posts enable row level security;
revoke all on public.posts from anon,authenticated;
grant select on public.posts to anon,authenticated;
grant insert on public.posts to authenticated;
create policy posts_read on public.posts for select to anon,authenticated using(true);
create policy posts_create on public.posts for insert to authenticated with check(
 user_id=(select auth.uid()) and exists(select 1 from storage.objects o where o.bucket_id='review-media' and o.name=media_path)
);
create function public.set_post_author() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 select p.display_name into new.author_name from public.profiles p where p.id=auth.uid() and p.username is not null and p.display_name<>'';
 if new.author_name is null then raise exception 'Complete your profile before publishing'; end if;
 return new;
end;
$$;
create trigger post_author before insert on public.posts for each row execute function public.set_post_author();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('review-media','review-media',false,6291456,array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime']);
create policy review_media_upload on storage.objects for insert to authenticated with check(bucket_id='review-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy review_media_owner_read on storage.objects for select to authenticated using(bucket_id='review-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy review_media_published_read on storage.objects for select to anon,authenticated using(bucket_id='review-media' and exists(select 1 from public.posts p where p.media_path=name));
commit;
