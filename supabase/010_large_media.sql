begin;
-- The private bucket and its existing ownership/read/moderation policies remain in effect.
update storage.buckets set file_size_limit=52428800
where id='review-media' and public=false;
do $$ begin
 if not exists(select 1 from storage.buckets where id='review-media' and not public and file_size_limit=52428800) then
  raise exception 'Expected private review-media bucket is missing';
 end if;
end $$;

create function public.validate_visual_media() returns trigger
language plpgsql security invoker set search_path='' as $$
declare meta jsonb; bytes numeric; mime text;
begin
 if auth.uid() is null or new.user_id is distinct from auth.uid() then
  raise exception 'Only the owner can publish media' using errcode='42501';
 end if;
 select o.metadata into meta from storage.objects o
 where o.bucket_id='review-media' and o.name=new.media_path
 and split_part(o.name,'/',1)=auth.uid()::text;
 if meta is null or coalesce(meta->>'size','') !~ '^[0-9]{1,20}$' then
  raise exception 'Completed file with valid storage metadata is required';
 end if;
 bytes=(meta->>'size')::numeric; mime=meta->>'mimetype';
 if bytes<=0 then raise exception 'Empty media cannot be published'; end if;
 if new.kind='image' then
  if mime is null or mime not in ('image/jpeg','image/png','image/webp') or bytes>10485760 then
   raise exception 'Images require JPG/PNG/WebP and a maximum of 10 MiB';
  end if;
 elsif new.kind='video' then
  if mime is null or mime not in ('video/mp4','video/quicktime') or bytes>52428800 then
   raise exception 'Videos require MP4/MOV and a maximum of 50 MiB';
  end if;
 else raise exception 'Invalid media kind'; end if;
 return new;
end;
$$;
revoke all on function public.validate_visual_media() from public,anon,authenticated;
create trigger post_media_validation before insert on public.posts for each row execute function public.validate_visual_media();
create trigger story_media_validation before insert on public.stories for each row execute function public.validate_visual_media();
commit;
