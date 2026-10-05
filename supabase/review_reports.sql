-- Read-only queue for the project owner in Supabase SQL Editor, never in the client app.
-- Fetches only the item specifically reported, not an entire private conversation.
select r.id,r.created_at,r.target_kind,r.target_id,r.target_owner,
 r.reason,r.details,r.status,
 case r.target_kind
 when 'profile' then (select display_name||' · @'||username from public.profiles where id=r.target_id)
 when 'post' then (select place||' · '||description from public.posts where id=r.target_id)
 when 'story' then (select author_name||' · '||kind||' · vence '||expires_at from public.stories where id=r.target_id)
 when 'comment' then (select body from public.comments where id=r.target_id)
 when 'message' then (select body from public.messages where id=r.target_id)
 end as reported_item
from public.content_reports r where r.status='pending'
order by r.created_at limit 50;
-- Missing items may have expired or been removed; report IDs remain available.
-- A future admin panel should record decisions and restrict staff permissions.
