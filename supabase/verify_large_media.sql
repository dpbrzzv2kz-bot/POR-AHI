-- Metadata-only assertions in a rolled-back transaction; no real accounts/files are retained.
begin;
select set_config('test.a',gen_random_uuid()::text,true);
select set_config('test.b',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email) select current_setting('test.'||x)::uuid,'authenticated','authenticated',x||'-upload@example.invalid' from unnest(array['a','b']) x;
insert into public.profiles(id,display_name,username) select current_setting('test.'||x)::uuid,'Prueba '||x,'media_'||substr(replace(current_setting('test.'||x),'-',''),1,15) from unnest(array['a','b']) x;
insert into storage.objects(bucket_id,name,metadata)
select 'review-media',current_setting('test.a')||'/'||path,meta::jsonb from (values
 ('photo8.png','{"size":8388608,"mimetype":"image/png"}'),
 ('photo10.jpg','{"size":10485760,"mimetype":"image/jpeg"}'),
 ('video50.mp4','{"size":52428800,"mimetype":"video/mp4"}'),
 ('story8.mov','{"size":8388608,"mimetype":"video/quicktime"}'),
 ('photo_over.png','{"size":10485761,"mimetype":"image/png"}'),
 ('video_over.mp4','{"size":52428801,"mimetype":"video/mp4"}'),
 ('wrong_kind.mp4','{"size":128,"mimetype":"video/mp4"}'),
 ('empty.png','{"size":0,"mimetype":"image/png"}'),
 ('unknown.png','{}'),
 ('unsupported.svg','{"size":128,"mimetype":"image/svg+xml"}'),
 ('fractional.png','{"size":1.5,"mimetype":"image/png"}'),
 ('huge.png','{"size":99999999999999999999,"mimetype":"image/png"}'),
 ('private.png','{"size":128,"mimetype":"image/png"}')
) t(path,meta);
select set_config('request.jwt.claim.sub',current_setting('test.a'),true);
set local role authenticated;
insert into public.posts(user_id,author_name,category,place,kind,media_path) values
 (auth.uid(),'','Comer','Foto ocho','image',auth.uid()||'/photo8.png'),
 (auth.uid(),'','Comer','Foto diez','image',auth.uid()||'/photo10.jpg'),
 (auth.uid(),'','Explorar','Video cincuenta','video',auth.uid()||'/video50.mp4');
insert into public.stories(user_id,author_name,kind,media_path,expires_at) values(auth.uid(),'','video',auth.uid()||'/story8.mov',now()+interval '1 year');
create function pg_temp.rejected(path text,kind text,story boolean default false) returns boolean language plpgsql as $$
begin
 begin
  if story then insert into public.stories(user_id,author_name,kind,media_path) values(auth.uid(),'',kind,auth.uid()||'/'||path);
  else insert into public.posts(user_id,author_name,category,place,kind,media_path) values(auth.uid(),'','Comer','Prueba',kind,auth.uid()||'/'||path);end if;
  return false;
 exception when raise_exception or insufficient_privilege then return true;
 end;
end $$;
select set_config('test.results',jsonb_build_object(
 'photo_above_old_limit',(select count(*)=1 from public.posts where media_path=auth.uid()||'/photo8.png'),
 'photo_boundary',(select count(*)=1 from public.posts where media_path=auth.uid()||'/photo10.jpg'),
 'video_boundary',(select count(*)=1 from public.posts where media_path=auth.uid()||'/video50.mp4'),
 'story_large_and_expiry',(select count(*)=1 from public.stories where media_path=auth.uid()||'/story8.mov' and expires_at=created_at+interval '24 hours'),
 'photo_over_limit',pg_temp.rejected('photo_over.png','image'),
 'video_over_limit',pg_temp.rejected('video_over.mp4','video'),
 'story_over_limit',pg_temp.rejected('video_over.mp4','video',true),
 'kind_matches_mime',pg_temp.rejected('wrong_kind.mp4','image'),
 'empty_rejected',pg_temp.rejected('empty.png','image'),
 'metadata_required',pg_temp.rejected('unknown.png','image'),
 'missing_file_rejected',pg_temp.rejected('nonexistent.png','image'),
 'unsupported_rejected',pg_temp.rejected('unsupported.svg','image'),
 'fractional_rejected',pg_temp.rejected('fractional.png','image'),
 'huge_metadata_rejected',pg_temp.rejected('huge.png','image')
)::text,true);
select set_config('request.jwt.claim.sub',current_setting('test.b'),true);
select set_config('test.results',(current_setting('test.results')::jsonb||jsonb_build_object('draft_private',(select count(*)=0 from storage.objects where name=current_setting('test.a')||'/private.png')))::text,true);
do $$ begin
 begin insert into public.posts(user_id,author_name,category,place,kind,media_path) values(auth.uid(),'','Comer','Ajeno','image',current_setting('test.a')||'/private.png');
  perform set_config('test.foreign','false',true);
 exception when raise_exception or insufficient_privilege then perform set_config('test.foreign','true',true);end;
end $$;
reset role;
select set_config('test.results',(current_setting('test.results')::jsonb||jsonb_build_object('foreign_file_rejected',current_setting('test.foreign')='true','bucket_private_50mb',(select not public and file_size_limit=52428800 from storage.buckets where id='review-media')))::text,true);
select key as comprobacion,value='true'::jsonb as correcto from jsonb_each(current_setting('test.results')::jsonb) order by key;
rollback;
