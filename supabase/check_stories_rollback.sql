-- Reversible metadata-only test. Requires one completed profile.
begin;
select set_config('test.uid',(select id::text from public.profiles where username is not null limit 1),true);
select set_config('request.jwt.claim.sub',current_setting('test.uid'),true);
set local role authenticated;
insert into storage.objects(bucket_id,name,owner_id) values('review-media',current_setting('test.uid')||'/story-verification.png',current_setting('test.uid'));
insert into public.stories(user_id,author_name,kind,media_path,expires_at)
values(auth.uid(),'Must be overridden','image',current_setting('test.uid')||'/story-verification.png','2099-01-01');
select set_config('test.fixed_expiry',(select (expires_at-created_at=interval '24 hours')::text from public.stories where media_path=current_setting('test.uid')||'/story-verification.png'),true);
select set_config('test.author',(select (st.author_name=p.display_name)::text from public.stories st join public.profiles p on p.id=st.user_id where st.media_path=current_setting('test.uid')||'/story-verification.png'),true);
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('test.active_visible',(select (count(*)=1)::text from public.stories where media_path=current_setting('test.uid')||'/story-verification.png'),true);
reset role;
update public.stories set expires_at=now()-interval '1 second' where media_path=current_setting('test.uid')||'/story-verification.png';
set local role anon;
select current_setting('test.fixed_expiry')='true' as server_sets_24_hours,
 current_setting('test.author')='true' as author_enforced,
 current_setting('test.active_visible')='true' as active_story_visible,
 (select count(*)=0 from public.stories where media_path=current_setting('test.uid')||'/story-verification.png') as expired_story_hidden,
 (select count(*)=0 from storage.objects where bucket_id='review-media' and name=current_setting('test.uid')||'/story-verification.png') as expired_media_hidden;
rollback;
