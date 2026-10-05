begin;
create table public.conversations (
 id uuid primary key default gen_random_uuid(),
 user_low uuid not null references public.profiles(id) on delete cascade,
 user_high uuid not null references public.profiles(id) on delete cascade,
 updated_at timestamptz not null default now(),
 unique(user_low,user_high), check(user_low<user_high)
);
alter table public.conversations enable row level security;
revoke all on public.conversations from anon,authenticated;
create policy chat_read on public.conversations for select to authenticated using(auth.uid() in (user_low,user_high));
create policy chat_create on public.conversations for insert to authenticated with check(auth.uid() in (user_low,user_high) and exists(select 1 from public.public_profiles where id=user_low) and exists(select 1 from public.public_profiles where id=user_high));
grant select on public.conversations to authenticated;
grant insert(user_low,user_high) on public.conversations to authenticated;
create table public.messages (
 id uuid primary key,
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(length(btrim(body)) between 1 and 1000),
 created_at timestamptz not null default now()
);
create index messages_history on public.messages(conversation_id,created_at desc,id desc);
alter table public.messages enable row level security;
revoke all on public.messages from anon,authenticated;
create policy message_read on public.messages for select to authenticated using(exists(select 1 from public.conversations c where c.id=conversation_id and auth.uid() in(c.user_low,c.user_high)));
create policy message_send on public.messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.conversations c where c.id=conversation_id and auth.uid() in(c.user_low,c.user_high)));
grant select on public.messages to authenticated;
grant insert(id,conversation_id,sender_id,body) on public.messages to authenticated;
create function public.touch_conversation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.conversations set updated_at=new.created_at where id=new.conversation_id;
 return new;
end $$;
revoke all on function public.touch_conversation() from public,anon,authenticated;
create trigger message_activity after insert on public.messages for each row execute function public.touch_conversation();
create view public.chat_inbox with(security_invoker=true) as
select c.id,c.updated_at,p.id as peer_id,p.display_name as peer_name,p.username as peer_handle,
 m.body as last_body
from public.conversations c
join public.public_profiles p on p.id=case when c.user_low=auth.uid() then c.user_high else c.user_low end
left join lateral(select body from public.messages where conversation_id=c.id order by created_at desc,id desc limit 1)m on true;
grant select on public.chat_inbox to authenticated;
revoke all on public.chat_inbox from anon;
commit;
