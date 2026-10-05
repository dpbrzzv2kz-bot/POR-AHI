-- Execute only AFTER the human authorizes administrative access for this exact account.
-- Grants review of reports (including reported messages), reversible hiding and audit access.
begin;
do $$ begin
 if not exists(select 1 from public.profiles where id='44003aa5-dce4-4c23-a45e-a198c5abc1f4'::uuid and username='gusto' and display_name='Daniel Pe') then
  raise exception 'Account identity changed; verify with the owner again';
 end if;
end $$;
insert into public.moderators(user_id) values('44003aa5-dce4-4c23-a45e-a198c5abc1f4') on conflict(user_id) do nothing;
commit;
