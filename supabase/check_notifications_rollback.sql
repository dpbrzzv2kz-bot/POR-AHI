-- Two disposable users. All actions and notification rows are rolled back.
begin;
select set_config('test.a',gen_random_uuid()::text,true),set_config('test.b',gen_random_uuid()::text,true),set_config('test.post',gen_random_uuid()::text,true),set_config('test.comment',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email) values
 (current_setting('test.a')::uuid,'authenticated','authenticated','notice-a-'||current_setting('test.a')||'@example.invalid'),
 (current_setting('test.b')::uuid,'authenticated','authenticated','notice-b-'||current_setting('test.b')||'@example.invalid');
insert into public.profiles(id,display_name,username) values
 (current_setting('test.a')::uuid,'Prueba A','prueba_'||left(replace(current_setting('test.a'),'-',''),12)),
 (current_setting('test.b')::uuid,'Prueba B','prueba_'||left(replace(current_setting('test.b'),'-',''),12));
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.a'),true);
insert into storage.objects(bucket_id,name,owner_id,metadata) values('review-media',auth.uid()||'/notice-test.png',auth.uid()::text,'{"size":128,"mimetype":"image/png"}');
insert into public.posts(id,user_id,author_name,category,place,kind,media_path) values(current_setting('test.post')::uuid,auth.uid(),'Fake','Explorar','Temporal','image',auth.uid()||'/notice-test.png');
insert into public.post_likes(user_id,post_id) values(auth.uid(),current_setting('test.post')::uuid);
insert into public.comments(user_id,post_id,author_name,body) values(auth.uid(),current_setting('test.post')::uuid,'Fake','Comentario propio');
select set_config('test.self',(select (count(*)=0)::text from public.notifications where recipient_id=auth.uid()),true);
select set_config('request.jwt.claim.sub',current_setting('test.b'),true);
insert into public.follows(follower_id,followed_id) values(auth.uid(),current_setting('test.a')::uuid);
insert into public.post_likes(user_id,post_id) values(auth.uid(),current_setting('test.post')::uuid);
insert into public.comments(id,user_id,post_id,author_name,body) values(current_setting('test.comment')::uuid,auth.uid(),current_setting('test.post')::uuid,'Fake','Comentario ajeno');
insert into public.bookmarks(user_id,post_id) values(auth.uid(),current_setting('test.post')::uuid);
select set_config('test.private',(select (count(*)=0)::text from public.notifications where recipient_id=current_setting('test.a')::uuid),true);
update public.notifications set read_at=now() where recipient_id=current_setting('test.a')::uuid;
do $$ begin
 begin insert into public.notifications(recipient_id,actor_id,actor_name,kind,event_key) values(current_setting('test.a')::uuid,auth.uid(),'Fake','follow','fake');
  perform set_config('test.fake','false',true);exception when insufficient_privilege then perform set_config('test.fake','true',true);end;
 begin update public.notifications set actor_name='Fake' where recipient_id=current_setting('test.a')::uuid;
  perform set_config('test.fields','false',true);exception when insufficient_privilege then perform set_config('test.fields','true',true);end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.a'),true);
select set_config('test.events',(select (count(*)=3 and count(distinct kind)=3)::text from public.notifications where recipient_id=auth.uid()),true),
 set_config('test.actor',(select (count(*)=3)::text from public.notifications where recipient_id=auth.uid() and actor_id=current_setting('test.b')::uuid and actor_name='Prueba B'),true),
 set_config('test.unread',(select (count(*)=3)::text from public.notifications where recipient_id=auth.uid() and read_at is null),true),
 set_config('test.targets',(select (count(*)=2)::text from public.notifications where post_id=current_setting('test.post')::uuid),true);
update public.notifications set read_at=now() where recipient_id=auth.uid() and kind='like';
select set_config('test.one_read',(select (count(*)=2)::text from public.notifications where recipient_id=auth.uid() and read_at is null),true);
update public.notifications set read_at=now() where recipient_id=auth.uid() and read_at is null;
select set_config('request.jwt.claim.sub',current_setting('test.b'),true);
delete from public.follows where follower_id=auth.uid() and followed_id=current_setting('test.a')::uuid;
delete from public.post_likes where user_id=auth.uid() and post_id=current_setting('test.post')::uuid;
update public.comments set deleted_at=now() where id=current_setting('test.comment')::uuid;
select set_config('request.jwt.claim.sub',current_setting('test.a'),true);
select set_config('test.withdrawn',(select (count(*)=0)::text from public.notifications where recipient_id=auth.uid()),true);
select set_config('request.jwt.claim.sub',current_setting('test.b'),true);
insert into public.follows(follower_id,followed_id) values(auth.uid(),current_setting('test.a')::uuid);
insert into public.post_likes(user_id,post_id) values(auth.uid(),current_setting('test.post')::uuid);
insert into public.post_likes(user_id,post_id) values(auth.uid(),current_setting('test.post')::uuid) on conflict do nothing;
update public.comments set deleted_at=null where id=current_setting('test.comment')::uuid;
select set_config('request.jwt.claim.sub',current_setting('test.a'),true);
select set_config('test.dedup',(select (count(*)=3)::text from public.notifications where recipient_id=auth.uid()),true),
 set_config('test.read_persisted',(select (count(*)=0)::text from public.notifications where recipient_id=auth.uid() and read_at is null),true),
 set_config('test.trigger_private',(not has_function_privilege('authenticated','public.notify_social_action()','execute'))::text,true);
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 begin perform id from public.notifications limit 1;perform set_config('test.anon','false',true);
 exception when insufficient_privilege then perform set_config('test.anon','true',true);end;
end $$;
select label as check_name,current_setting('test.'||setting)='true' as passed from (values
 ('no_self_notifications','self'),('others_inbox_private','private'),('cannot_forge_notice','fake'),('cannot_edit_notice_fields','fields'),
 ('three_event_types_and_no_bookmark_notice','events'),('real_actor','actor'),('unread_count_and_other_cannot_mark','unread'),
 ('correct_post_targets','targets'),('mark_one_read','one_read'),('withdraw_removed_actions','withdrawn'),
 ('no_duplicates_on_retry_or_restore','dedup'),('read_state_persists_after_reload','read_persisted'),
 ('trigger_cannot_be_called_by_client','trigger_private'),('anonymous_inbox_denied','anon')
 ) checks(label,setting);
rollback;
