begin;
-- Corrige 026: story_poll_counts es security definer y devolvia conteos de stories que la persona no deberia ver
-- (bloqueadas entre cuentas, retiradas por su autor o ocultas por moderacion). Ahora aplica las mismas reglas que la lectura de stories.
-- Aplicar PRIMERO en el proyecto de pruebas (despues de la 026). En produccion solo con confirmacion del dueño y ANTES de publicar la app que la usa.
create or replace function public.story_poll_counts(p_story uuid) returns table(overlay_id text,choice smallint,votes bigint)
language sql stable security definer set search_path='' as $$
 select v.overlay_id,v.choice,count(*) from public.story_poll_votes v join public.stories s on s.id=v.story_id
 where v.story_id=p_story and s.expires_at>now()
  and not public.content_hidden('story',s.id) and not public.content_withdrawn('story',s.id) and not public.blocked_with(s.user_id)
 group by v.overlay_id,v.choice
$$;
revoke all on function public.story_poll_counts(uuid) from public,anon,authenticated;
grant execute on function public.story_poll_counts(uuid) to authenticated;
commit;