-- Three synthetic identities against the real database policies and triggers.
-- No password, login session, email, binary upload, or production account change.
-- All synthetic rows and helper functions are rolled back together.
begin;
create temporary table beta_results(section text,check_name text,passed boolean not null);
grant select,insert on beta_results to authenticated,anon;
create function pg_temp.beta_check(section text,label text,passed boolean) returns void
language sql as $$ insert into beta_results values(section,label,coalesce(passed,false)); $$;
create function pg_temp.beta_denied(section text,label text,query text,codes text[]) returns void
language plpgsql as $$
begin
 begin execute query; perform pg_temp.beta_check(section,label,false);
 exception when others then perform pg_temp.beta_check(section,label,sqlstate=any(codes));end;
end $$;
grant execute on function pg_temp.beta_check(text,text,boolean),pg_temp.beta_denied(text,text,text,text[]) to authenticated,anon;

select set_config('beta.a',gen_random_uuid()::text,true),set_config('beta.b',gen_random_uuid()::text,true),set_config('beta.c',gen_random_uuid()::text,true);
select set_config('beta.post',gen_random_uuid()::text,true),set_config('beta.story',gen_random_uuid()::text,true),set_config('beta.comment',gen_random_uuid()::text,true),set_config('beta.message',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email)
 select current_setting('beta.'||x)::uuid,'authenticated','authenticated','beta-integration-'||current_setting('beta.'||x)||'@example.invalid'
 from unnest(array['a','b','c'])x;
insert into public.profiles(id,display_name,username,bio)
 select current_setting('beta.'||x)::uuid,'Beta '||upper(x),'beta_'||substr(replace(current_setting('beta.'||x),'-',''),1,16),'Cuenta temporal de prueba'
 from unnest(array['a','b','c'])x;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('beta.a'),true);
update public.profiles set bio='Biografía guardada' where id=auth.uid();
select pg_temp.beta_check('profiles','own_profile_saved',(select bio='Biografía guardada' from public.profiles where id=auth.uid()));
select pg_temp.beta_check('profiles','private_profile_hidden',(select count(*)=0 from public.profiles where id=current_setting('beta.b')::uuid));
update public.profiles set bio='No autorizado' where id=current_setting('beta.b')::uuid;
select pg_temp.beta_check('profiles','public_search_three_profiles',(select count(*)=3 from public.public_profiles where id in(current_setting('beta.a')::uuid,current_setting('beta.b')::uuid,current_setting('beta.c')::uuid)));
select pg_temp.beta_denied('profiles','invalid_username_rejected',format('update public.profiles set username=%L where id=%L','bad user',auth.uid()),array['23514']);
select pg_temp.beta_denied('profiles','duplicate_username_rejected',format('update public.profiles set username=%L where id=%L','beta_'||substr(replace(current_setting('beta.b'),'-',''),1,16),auth.uid()),array['23505']);
select pg_temp.beta_check('profiles','regular_account_not_admin',not public.is_moderator());

-- Author B publishes both a review and a story, with owned completed metadata.
select set_config('request.jwt.claim.sub',current_setting('beta.b'),true);
select pg_temp.beta_check('profiles','other_cannot_edit_profile',(select bio='Cuenta temporal de prueba' from public.profiles where id=auth.uid()));
insert into storage.objects(bucket_id,name,owner_id,metadata) values
 ('review-media',auth.uid()||'/beta-photo.png',auth.uid()::text,'{"size":128,"mimetype":"image/png"}'),
 ('review-media',auth.uid()||'/beta-story.png',auth.uid()::text,'{"size":128,"mimetype":"image/png"}'),
 ('review-media',auth.uid()||'/beta-video.mp4',auth.uid()::text,'{"size":4096,"mimetype":"video/mp4"}'),
 ('review-media',auth.uid()||'/beta-private.png',auth.uid()::text,'{"size":128,"mimetype":"image/png"}'),
 ('review-media',auth.uid()||'/beta-empty.png',auth.uid()::text,'{"size":0,"mimetype":"image/png"}'),
 ('review-media',auth.uid()||'/beta-large.png',auth.uid()::text,'{"size":10485761,"mimetype":"image/png"}');
insert into public.posts(id,user_id,author_name,category,place,description,kind,media_path)
 values(current_setting('beta.post')::uuid,auth.uid(),'Fake author','Comer','Café de prueba','Una reseña de prueba','image',auth.uid()||'/beta-photo.png');
insert into public.posts(user_id,author_name,category,place,kind,media_path)
 values(auth.uid(),'Fake author','Explorar','Video de prueba','video',auth.uid()||'/beta-video.mp4');
select pg_temp.beta_check('media','photo_video_separate',(select count(*)=2 and count(*) filter(where kind='image')=1 and count(*) filter(where kind='video')=1 from public.posts where user_id=auth.uid()));
select pg_temp.beta_check('media','author_from_profile',(select author_name='Beta B' from public.posts where id=current_setting('beta.post')::uuid));
insert into public.stories(id,user_id,author_name,kind,media_path,expires_at)
 values(current_setting('beta.story')::uuid,auth.uid(),'Fake author','image',auth.uid()||'/beta-story.png','2099-01-01');
select pg_temp.beta_check('stories','server_sets_24h',(select expires_at-created_at=interval '24 hours' and author_name='Beta B' from public.stories where id=current_setting('beta.story')::uuid));
select pg_temp.beta_denied('media','empty_file_rejected',format('insert into public.posts(user_id,author_name,category,place,kind,media_path) values(%L,%L,%L,%L,%L,%L)',auth.uid(),'Fake','Comer','Vacío','image',auth.uid()||'/beta-empty.png'),array['P0001']);
select pg_temp.beta_denied('media','oversize_photo_rejected',format('insert into public.posts(user_id,author_name,category,place,kind,media_path) values(%L,%L,%L,%L,%L,%L)',auth.uid(),'Fake','Comer','Grande','image',auth.uid()||'/beta-large.png'),array['P0001']);
select pg_temp.beta_denied('media','missing_file_rejected',format('insert into public.posts(user_id,author_name,category,place,kind,media_path) values(%L,%L,%L,%L,%L,%L)',auth.uid(),'Fake','Comer','Ausente','image',auth.uid()||'/beta-missing.png'),array['P0001']);

set local role anon;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.beta_check('media','visitor_sees_published_review',(select count(*)=1 from public.posts where id=current_setting('beta.post')::uuid));
select pg_temp.beta_check('stories','visitor_sees_active_story',(select count(*)=1 from public.stories where id=current_setting('beta.story')::uuid));
select pg_temp.beta_check('media','visitor_reads_published_media',(select count(*)=1 from storage.objects where name=current_setting('beta.b')||'/beta-photo.png' and bucket_id='review-media'));
select pg_temp.beta_check('media','unpublished_media_private',(select count(*)=0 from storage.objects where name=current_setting('beta.b')||'/beta-private.png' and bucket_id='review-media'));

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('beta.a'),true);
insert into public.follows(follower_id,followed_id) values(auth.uid(),current_setting('beta.b')::uuid) on conflict do nothing;
insert into public.follows(follower_id,followed_id) values(auth.uid(),current_setting('beta.b')::uuid) on conflict do nothing;
select pg_temp.beta_check('social','follow_deduplicated',(select count(*)=1 from public.follows where follower_id=auth.uid() and followed_id=current_setting('beta.b')::uuid));
select pg_temp.beta_check('social','following_feed',(select count(*)=2 from public.posts where user_id in(select followed_id from public.follows where follower_id=auth.uid()) and user_id=current_setting('beta.b')::uuid));
select pg_temp.beta_denied('social','cannot_follow_as_other',format('insert into public.follows(follower_id,followed_id) values(%L,%L)',current_setting('beta.b'),current_setting('beta.c')),array['42501']);
select pg_temp.beta_denied('social','cannot_follow_self',format('insert into public.follows(follower_id,followed_id) values(%L,%L)',auth.uid(),auth.uid()),array['23514']);
select pg_temp.beta_denied('media','cannot_publish_as_other',format('insert into public.posts(user_id,author_name,category,place,kind,media_path) values(%L,%L,%L,%L,%L,%L)',current_setting('beta.b'),'Fake','Comer','Ajeno','image',current_setting('beta.b')||'/beta-private.png'),array['42501']);
insert into public.post_likes(user_id,post_id) values(auth.uid(),current_setting('beta.post')::uuid) on conflict do nothing;
insert into public.post_likes(user_id,post_id) values(auth.uid(),current_setting('beta.post')::uuid) on conflict do nothing;
insert into public.bookmarks(user_id,post_id) values(auth.uid(),current_setting('beta.post')::uuid) on conflict do nothing;
insert into public.bookmarks(user_id,post_id) values(auth.uid(),current_setting('beta.post')::uuid) on conflict do nothing;
insert into public.comments(id,user_id,post_id,author_name,body)
 values(current_setting('beta.comment')::uuid,auth.uid(),current_setting('beta.post')::uuid,'Fake','¡Buena recomendación!') on conflict do nothing;
select pg_temp.beta_check('interactions','like_deduplicated',(select count(*)=1 from public.post_likes where user_id=auth.uid() and post_id=current_setting('beta.post')::uuid));
select pg_temp.beta_check('interactions','bookmark_saved',(select count(*)=1 from public.bookmarks where user_id=auth.uid() and post_id=current_setting('beta.post')::uuid));
select pg_temp.beta_check('interactions','comment_author_enforced',(select author_name='Beta A' from public.comments where id=current_setting('beta.comment')::uuid));
select pg_temp.beta_check('interactions','aggregate_counts',(select likes_count=1 and comments_count=1 from public.post_stats where post_id=current_setting('beta.post')::uuid));
select pg_temp.beta_denied('interactions','blank_comment_rejected',format('insert into public.comments(user_id,post_id,author_name,body) values(%L,%L,%L,%L)',auth.uid(),current_setting('beta.post'),'','   '),array['23514']);
select pg_temp.beta_denied('interactions','cannot_like_as_other',format('insert into public.post_likes(user_id,post_id) values(%L,%L)',current_setting('beta.c'),current_setting('beta.post')),array['42501']);

insert into public.conversations(user_low,user_high)
 values(least(auth.uid(),current_setting('beta.b')::uuid),greatest(auth.uid(),current_setting('beta.b')::uuid)) on conflict do nothing;
select set_config('beta.chat',(select id::text from public.conversations where auth.uid() in(user_low,user_high) and current_setting('beta.b')::uuid in(user_low,user_high)),true);
insert into public.messages(id,conversation_id,sender_id,body)
 values(current_setting('beta.message')::uuid,current_setting('beta.chat')::uuid,auth.uid(),'¿Vamos al café?') on conflict(id) do nothing;
insert into public.messages(id,conversation_id,sender_id,body)
 values(current_setting('beta.message')::uuid,current_setting('beta.chat')::uuid,auth.uid(),'¿Vamos al café?') on conflict(id) do nothing;
select pg_temp.beta_check('messages','message_deduplicated',(select count(*)=1 from public.messages where conversation_id=current_setting('beta.chat')::uuid));
select pg_temp.beta_denied('messages','cannot_spoof_sender',format('insert into public.messages(id,conversation_id,sender_id,body) values(%L,%L,%L,%L)',gen_random_uuid(),current_setting('beta.chat'),current_setting('beta.b'),'Intruso'),array['42501']);
select pg_temp.beta_denied('messages','blank_message_rejected',format('insert into public.messages(id,conversation_id,sender_id,body) values(%L,%L,%L,%L)',gen_random_uuid(),current_setting('beta.chat'),auth.uid(),'  '),array['23514']);
select pg_temp.beta_denied('messages','long_message_rejected',format('insert into public.messages(id,conversation_id,sender_id,body) values(%L,%L,%L,%L)',gen_random_uuid(),current_setting('beta.chat'),auth.uid(),repeat('x',1001)),array['23514']);
select pg_temp.beta_denied('messages','message_body_immutable',format('update public.messages set body=%L where id=%L','Editado',current_setting('beta.message')),array['42501']);

select set_config('request.jwt.claim.sub',current_setting('beta.b'),true);
select pg_temp.beta_check('social','others_follow_list_private',(select count(*)=0 from public.follows where follower_id=current_setting('beta.a')::uuid));
select pg_temp.beta_check('interactions','others_bookmarks_private',(select count(*)=0 from public.bookmarks where user_id=current_setting('beta.a')::uuid));
select pg_temp.beta_check('messages','recipient_reads_message',(select body='¿Vamos al café?' from public.messages where id=current_setting('beta.message')::uuid));
insert into public.messages(id,conversation_id,sender_id,body) values(gen_random_uuid(),current_setting('beta.chat')::uuid,auth.uid(),'¡Sí, vamos!');
select pg_temp.beta_check('notifications','follow_like_comment_generated',(select count(*)=3 from public.notifications where recipient_id=auth.uid() and actor_id=current_setting('beta.a')::uuid));
update public.notifications set read_at=now() where recipient_id=auth.uid() and actor_id=current_setting('beta.a')::uuid;
select pg_temp.beta_check('notifications','read_state_saved',(select count(*)=3 and count(*) filter(where read_at is null)=0 from public.notifications where recipient_id=auth.uid() and actor_id=current_setting('beta.a')::uuid));

select set_config('request.jwt.claim.sub',current_setting('beta.c'),true);
select pg_temp.beta_check('messages','third_person_cannot_read',(select count(*)=0 from public.messages where conversation_id=current_setting('beta.chat')::uuid));
select pg_temp.beta_check('messages','third_person_cannot_see_chat',(select count(*)=0 from public.chat_inbox where id=current_setting('beta.chat')::uuid));
select pg_temp.beta_denied('messages','third_person_cannot_send',format('insert into public.messages(id,conversation_id,sender_id,body) values(%L,%L,%L,%L)',gen_random_uuid(),current_setting('beta.chat'),auth.uid(),'Intruso'),array['42501']);
select pg_temp.beta_check('notifications','others_notifications_private',(select count(*)=0 from public.notifications where recipient_id=current_setting('beta.b')::uuid));

select set_config('request.jwt.claim.sub',current_setting('beta.a'),true);
select pg_temp.beta_check('messages','reply_persisted',(select count(*)=2 from public.messages where conversation_id=current_setting('beta.chat')::uuid));
update public.comments set deleted_at=now() where id=current_setting('beta.comment')::uuid;
select pg_temp.beta_check('interactions','comment_soft_removed',(select comments_count=0 from public.post_stats where post_id=current_setting('beta.post')::uuid));
update public.comments set deleted_at=null where id=current_setting('beta.comment')::uuid;
select pg_temp.beta_check('interactions','comment_restored',(select comments_count=1 from public.post_stats where post_id=current_setting('beta.post')::uuid));
insert into public.content_reports(reporter_id,target_kind,target_id,reason,details)
 values(auth.uid(),'post',current_setting('beta.post')::uuid,'Otro','Reporte de prueba') on conflict do nothing;
select pg_temp.beta_check('safety','report_saved_with_real_owner',(select count(*)=1 from public.content_reports where reporter_id=auth.uid() and target_id=current_setting('beta.post')::uuid and target_owner=current_setting('beta.b')::uuid and status='pending'));
insert into public.user_blocks(blocker_id,blocked_id) values(auth.uid(),current_setting('beta.b')::uuid);
select pg_temp.beta_check('safety','block_hides_posts',(select count(*)=0 from public.posts where user_id=current_setting('beta.b')::uuid));
select pg_temp.beta_check('safety','block_hides_stories',(select count(*)=0 from public.stories where id=current_setting('beta.story')::uuid));
select pg_temp.beta_check('safety','block_hides_messages',(select count(*)=0 from public.messages where conversation_id=current_setting('beta.chat')::uuid));
select pg_temp.beta_check('safety','block_removes_follow',(select count(*)=0 from public.follows where follower_id=auth.uid() and followed_id=current_setting('beta.b')::uuid));
select pg_temp.beta_denied('safety','blocked_message_rejected',format('insert into public.messages(id,conversation_id,sender_id,body) values(%L,%L,%L,%L)',gen_random_uuid(),current_setting('beta.chat'),auth.uid(),'Bloqueado'),array['42501']);
delete from public.user_blocks where blocker_id=auth.uid() and blocked_id=current_setting('beta.b')::uuid;
select pg_temp.beta_check('safety','unblock_restores_history',(select count(*)=2 from public.messages where conversation_id=current_setting('beta.chat')::uuid));
select pg_temp.beta_check('safety','unblock_restores_content',(select count(*)=2 from public.posts where user_id=current_setting('beta.b')::uuid));
select pg_temp.beta_check('safety','unblock_does_not_refollow',(select count(*)=0 from public.follows where follower_id=auth.uid() and followed_id=current_setting('beta.b')::uuid));

-- Advance only this synthetic story. No production story is touched.
reset role;
update public.stories set expires_at=now()-interval '1 second' where id=current_setting('beta.story')::uuid;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.beta_check('stories','expired_story_hidden',(select count(*)=0 from public.stories where id=current_setting('beta.story')::uuid));
select pg_temp.beta_check('stories','expired_story_media_hidden',(select count(*)=0 from storage.objects where bucket_id='review-media' and name=current_setting('beta.b')||'/beta-story.png'));
select pg_temp.beta_denied('messages','visitor_cannot_read_messages','select * from public.messages',array['42501']);
select pg_temp.beta_denied('interactions','visitor_cannot_like',format('insert into public.post_likes(user_id,post_id) values(%L,%L)',current_setting('beta.c'),current_setting('beta.post')),array['42501']);
reset role;
select section,count(*) as checks,count(*) filter(where passed) as passed,
 coalesce(jsonb_agg(check_name) filter(where not passed),'[]') as failures
 from beta_results group by section
union all
select 'TOTAL',count(*),count(*) filter(where passed),coalesce(jsonb_agg(check_name) filter(where not passed),'[]') from beta_results
order by section;
rollback;
