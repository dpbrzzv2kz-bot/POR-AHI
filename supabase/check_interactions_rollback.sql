-- Disposable two-user test workflow, entirely rolled back (no passwords or sent emails).
begin;
select set_config('test.a',gen_random_uuid()::text,true),set_config('test.b',gen_random_uuid()::text,true),set_config('test.post',gen_random_uuid()::text,true),set_config('test.comment',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email) values
 (current_setting('test.a')::uuid,'authenticated','authenticated','interaction-a-'||current_setting('test.a')||'@example.invalid'),
 (current_setting('test.b')::uuid,'authenticated','authenticated','interaction-b-'||current_setting('test.b')||'@example.invalid');
insert into public.profiles(id,display_name,username) values
 (current_setting('test.a')::uuid,'Prueba A','prueba_'||left(replace(current_setting('test.a'),'-',''),12)),
 (current_setting('test.b')::uuid,'Prueba B','prueba_'||left(replace(current_setting('test.b'),'-',''),12));
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.b'),true);
insert into storage.objects(bucket_id,name,owner_id,metadata) values('review-media',auth.uid()||'/interaction-test.png',auth.uid()::text,'{"size":128,"mimetype":"image/png"}');
insert into public.posts(id,user_id,author_name,category,place,kind,media_path) values(current_setting('test.post')::uuid,auth.uid(),'Overridden','Explorar','Temporal','image',auth.uid()||'/interaction-test.png');
select set_config('request.jwt.claim.sub',current_setting('test.a'),true);
insert into public.post_likes(user_id,post_id) values(auth.uid(),current_setting('test.post')::uuid);
insert into public.post_likes(user_id,post_id) values(auth.uid(),current_setting('test.post')::uuid) on conflict do nothing;
insert into public.bookmarks(user_id,post_id) values(auth.uid(),current_setting('test.post')::uuid);
insert into public.bookmarks(user_id,post_id) values(auth.uid(),current_setting('test.post')::uuid) on conflict do nothing;
insert into public.comments(id,user_id,post_id,author_name,body) values(current_setting('test.comment')::uuid,auth.uid(),current_setting('test.post')::uuid,'Fake author','Comentario de prueba');
insert into public.comments(id,user_id,post_id,author_name,body) values(current_setting('test.comment')::uuid,auth.uid(),current_setting('test.post')::uuid,'Fake author','Comentario de prueba') on conflict do nothing;
select set_config('test.saved',(select (count(*)=1)::text from public.bookmarks where post_id=current_setting('test.post')::uuid),true),
 set_config('test.liked',(select (count(*)=1)::text from public.post_likes where post_id=current_setting('test.post')::uuid),true),
 set_config('test.comments',(select (count(*)=1 and min(author_name)='Prueba A')::text from public.comments where post_id=current_setting('test.post')::uuid),true);
do $$ begin
 begin insert into public.post_likes(user_id,post_id) values(current_setting('test.b')::uuid,current_setting('test.post')::uuid);
  perform set_config('test.spoof','false',true);exception when insufficient_privilege then perform set_config('test.spoof','true',true);end;
 begin insert into public.comments(user_id,post_id,author_name,body) values(auth.uid(),current_setting('test.post')::uuid,'','  ');
  perform set_config('test.empty','false',true);exception when check_violation then perform set_config('test.empty','true',true);end;
 begin insert into public.comments(user_id,post_id,author_name,body) values(auth.uid(),current_setting('test.post')::uuid,'',repeat('x',1001));
  perform set_config('test.long','false',true);exception when check_violation then perform set_config('test.long','true',true);end;
 begin insert into public.comments(user_id,post_id,author_name,body) values(current_setting('test.b')::uuid,current_setting('test.post')::uuid,'','Impersonation');
  perform set_config('test.comment_spoof','false',true);exception when insufficient_privilege then perform set_config('test.comment_spoof','true',true);end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.b'),true);
select set_config('test.private',(select (count(*)=0)::text from public.bookmarks where user_id=current_setting('test.a')::uuid),true);
delete from public.post_likes where user_id=current_setting('test.a')::uuid;
delete from public.bookmarks where user_id=current_setting('test.a')::uuid;
update public.comments set deleted_at=now() where id=current_setting('test.comment')::uuid;
select set_config('test.other_comment',(select (count(*)=1)::text from public.comments where id=current_setting('test.comment')::uuid and deleted_at is null),true);
do $$ begin
 begin update public.comments set body='Not allowed' where id=current_setting('test.comment')::uuid;
  perform set_config('test.immutable','false',true);exception when insufficient_privilege then perform set_config('test.immutable','true',true);end;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('test.counts',(select (likes_count=1 and comments_count=1)::text from public.post_stats where post_id=current_setting('test.post')::uuid),true);
do $$ begin
 begin insert into public.post_likes(user_id,post_id) values(current_setting('test.b')::uuid,current_setting('test.post')::uuid);
  perform set_config('test.anon','false',true);exception when insufficient_privilege then perform set_config('test.anon','true',true);end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.a'),true);
select set_config('test.reload',(select (count(*)=1)::text from public.bookmarks where post_id=current_setting('test.post')::uuid),true);
update public.comments set deleted_at=now() where id=current_setting('test.comment')::uuid;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('test.removed',(select (count(*)=0)::text from public.comments where id=current_setting('test.comment')::uuid),true),
 set_config('test.count_removed',(select (comments_count=0)::text from public.post_stats where post_id=current_setting('test.post')::uuid),true);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.a'),true);
update public.comments set deleted_at=null where id=current_setting('test.comment')::uuid;
select set_config('test.restored',(select (count(*)=1)::text from public.comments where id=current_setting('test.comment')::uuid and deleted_at is null),true);
delete from public.post_likes where user_id=auth.uid() and post_id=current_setting('test.post')::uuid;
delete from public.bookmarks where user_id=auth.uid() and post_id=current_setting('test.post')::uuid;
select set_config('test.unsaved',(select (count(*)=0)::text from public.bookmarks where post_id=current_setting('test.post')::uuid),true),
 set_config('test.unliked',(select (likes_count=0)::text from public.post_stats where post_id=current_setting('test.post')::uuid),true);
select label as check_name,current_setting('test.'||setting)='true' as passed from (values
 ('like_saved_once','liked'),('bookmark_saved_once','saved'),('comment_once_and_real_author','comments'),
 ('cannot_like_as_other','spoof'),('empty_comment_rejected','empty'),('long_comment_rejected','long'),
 ('cannot_comment_as_other','comment_spoof'),('bookmarks_private','private'),('cannot_remove_others_comment','other_comment'),
 ('comment_fields_protected','immutable'),('public_counts_correct','counts'),('anonymous_write_rejected','anon'),
 ('bookmark_reloaded_and_other_cannot_delete','reload'),('removed_comment_hidden','removed'),('count_reduced','count_removed'),
 ('undo_removal','restored'),('bookmark_removed','unsaved'),('like_removed_and_count_reduced','unliked')
 ) checks(label,setting);
rollback;
