-- Run in the SQL editor after at least one account has completed its profile.
-- All metadata test rows are rolled back; no real files are uploaded.
begin;
select set_config('test.uid',(select id::text from public.profiles where username is not null limit 1),true);
select set_config('request.jwt.claim.sub',current_setting('test.uid'),true);
set local role authenticated;
insert into storage.objects(bucket_id,name,owner_id,metadata) values('review-media',current_setting('test.uid')||'/verification.png',current_setting('test.uid'),'{"size":128,"mimetype":"image/png"}');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('test.draft_hidden',(select (count(*)=0)::text from storage.objects where bucket_id='review-media' and name=current_setting('test.uid')||'/verification.png'),true);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.uid'),true);
insert into public.posts(user_id,author_name,category,place,kind,media_path) values(auth.uid(),'Must be overridden','Comer','Lugar de prueba','image',current_setting('test.uid')||'/verification.png');
select set_config('test.author_enforced',(select (p.author_name=u.display_name)::text from public.posts p join public.profiles u on u.id=p.user_id where p.media_path=current_setting('test.uid')||'/verification.png'),true);
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select current_setting('test.draft_hidden')='true' as unpublished_media_hidden,
 current_setting('test.author_enforced')='true' as author_enforced,
 (select count(*)=1 from public.posts where media_path=current_setting('test.uid')||'/verification.png') as published_post_visible,
 (select count(*)=1 from storage.objects where bucket_id='review-media' and name=current_setting('test.uid')||'/verification.png') as published_media_readable;
rollback;
