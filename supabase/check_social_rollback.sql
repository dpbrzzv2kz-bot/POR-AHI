-- Two synthetic users, no passwords or emails sent. All rows rolled back.
begin;
select set_config('test.a',gen_random_uuid()::text,true),set_config('test.b',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email) values
 (current_setting('test.a')::uuid,'authenticated','authenticated','social-a-'||current_setting('test.a')||'@example.invalid'),
 (current_setting('test.b')::uuid,'authenticated','authenticated','social-b-'||current_setting('test.b')||'@example.invalid');
insert into public.profiles(id,display_name,username,bio) values
 (current_setting('test.a')::uuid,'Prueba social A','prueba_'||left(replace(current_setting('test.a'),'-',''),12),'Temporal'),
 (current_setting('test.b')::uuid,'Prueba social B','prueba_'||left(replace(current_setting('test.b'),'-',''),12),'Temporal');
select set_config('request.jwt.claim.sub',current_setting('test.b'),true);
set local role authenticated;
insert into storage.objects(bucket_id,name,owner_id,metadata) values('review-media',auth.uid()||'/social-test.png',auth.uid()::text,'{"size":128,"mimetype":"image/png"}');
insert into public.posts(user_id,author_name,category,place,kind,media_path) values(auth.uid(),'Overridden','Explorar','Prueba temporal','image',auth.uid()||'/social-test.png');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('test.search',(select (count(*)=2)::text from public.public_profiles where id in(current_setting('test.a')::uuid,current_setting('test.b')::uuid)),true);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.a'),true);
select set_config('test.private',(select (count(*)=0)::text from public.profiles where id=current_setting('test.b')::uuid),true);
insert into public.follows(follower_id,followed_id) values(auth.uid(),current_setting('test.b')::uuid);
select set_config('test.follow',(select (count(*)=1)::text from public.follows where follower_id=auth.uid() and followed_id=current_setting('test.b')::uuid),true);
select set_config('test.feed',(select (count(*)=1)::text from public.posts where user_id in(select followed_id from public.follows where follower_id=auth.uid()) and media_path=current_setting('test.b')||'/social-test.png'),true);
do $$ begin
 begin insert into public.follows(follower_id,followed_id) values(current_setting('test.b')::uuid,current_setting('test.a')::uuid);
  perform set_config('test.spoof','false',true);
 exception when insufficient_privilege then perform set_config('test.spoof','true',true);end;
 begin insert into public.follows(follower_id,followed_id) values(auth.uid(),auth.uid());
  perform set_config('test.self','false',true);
 exception when check_violation then perform set_config('test.self','true',true);end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.b'),true);
select set_config('test.hidden',(select (count(*)=0)::text from public.follows where follower_id=current_setting('test.a')::uuid),true);
delete from public.follows where follower_id=current_setting('test.a')::uuid;
select set_config('request.jwt.claim.sub',current_setting('test.a'),true);
select set_config('test.reload',(select (count(*)=1)::text from public.follows where followed_id=current_setting('test.b')::uuid),true);
delete from public.follows where follower_id=auth.uid() and followed_id=current_setting('test.b')::uuid;
select current_setting('test.search')='true' as public_profiles_visible,
 current_setting('test.private')='true' as private_profile_protected,
 current_setting('test.follow')='true' as follow_saved,
 current_setting('test.feed')='true' as following_feed,
 current_setting('test.spoof')='true' as cannot_follow_as_other,
 current_setting('test.self')='true' as cannot_follow_self,
 current_setting('test.hidden')='true' as other_follow_list_private,
 current_setting('test.reload')='true' as follow_reloaded_and_other_cannot_delete,
 (select count(*)=0 from public.follows where followed_id=current_setting('test.b')::uuid) as unfollow_saved;
rollback;
