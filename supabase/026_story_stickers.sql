begin;
-- Stickers interactivos de las stories: encuestas (votos) y preguntas (respuestas), y mas espacio para dibujos y stickers en stories.overlays.
-- Aplicar PRIMERO en el proyecto de pruebas (despues de la 025). En produccion solo con confirmacion del dueño y ANTES de publicar la app que la usa.

-- Los dibujos son trazos con puntos: hasta 40 trazos + 20 elementos + 1 filtro y 120 KB.
alter table public.stories drop constraint if exists stories_overlays_check;
alter table public.stories add constraint stories_overlays_valid check(overlays is null or (jsonb_typeof(overlays)='array' and jsonb_array_length(overlays)<=61 and octet_length(overlays::text)<=120000));

-- Encuesta: un voto por persona y por encuesta. Cada quien ve solo su propio voto; los totales salen de una funcion que solo devuelve conteos.
create table public.story_poll_votes(
 story_id uuid not null references public.stories(id) on delete cascade,
 overlay_id text not null check(char_length(overlay_id) between 1 and 40),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 choice smallint not null check(choice in(0,1)),
 created_at timestamptz not null default now(),
 primary key(story_id,overlay_id,user_id)
);
alter table public.story_poll_votes enable row level security;
revoke all on public.story_poll_votes from anon,authenticated;
grant select,insert on public.story_poll_votes to authenticated;
create policy poll_votes_own_read on public.story_poll_votes for select to authenticated using(user_id=(select auth.uid()));
create policy poll_votes_create on public.story_poll_votes for insert to authenticated with check(
 user_id=(select auth.uid()) and exists(
  select 1 from public.stories s,jsonb_array_elements(coalesce(s.overlays,'[]'::jsonb)) o
  where s.id=story_id and s.expires_at>now() and o->>'id'=overlay_id and o->>'type'='poll')
);
create function public.story_poll_counts(p_story uuid) returns table(overlay_id text,choice smallint,votes bigint)
language sql stable security definer set search_path='' as $$
 select v.overlay_id,v.choice,count(*) from public.story_poll_votes v join public.stories s on s.id=v.story_id
 where v.story_id=p_story and s.expires_at>now() group by v.overlay_id,v.choice
$$;
revoke all on function public.story_poll_counts(uuid) from public,anon,authenticated;
grant execute on function public.story_poll_counts(uuid) to authenticated;

-- Pregunta: una respuesta por persona. La respuesta la ve quien contesto y la persona que publico la story.
create table public.story_answers(
 id uuid primary key default gen_random_uuid(),
 story_id uuid not null references public.stories(id) on delete cascade,
 overlay_id text not null check(char_length(overlay_id) between 1 and 40),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 answer text not null check(char_length(answer) between 1 and 200),
 created_at timestamptz not null default now(),
 unique(story_id,overlay_id,user_id)
);
alter table public.story_answers enable row level security;
revoke all on public.story_answers from anon,authenticated;
grant select,insert on public.story_answers to authenticated;
create policy story_answers_read on public.story_answers for select to authenticated using(
 user_id=(select auth.uid()) or exists(select 1 from public.stories s where s.id=story_id and s.user_id=(select auth.uid()))
);
create policy story_answers_create on public.story_answers for insert to authenticated with check(
 user_id=(select auth.uid()) and exists(
  select 1 from public.stories s,jsonb_array_elements(coalesce(s.overlays,'[]'::jsonb)) o
  where s.id=story_id and s.expires_at>now() and o->>'id'=overlay_id and o->>'type'='question')
);
commit;
