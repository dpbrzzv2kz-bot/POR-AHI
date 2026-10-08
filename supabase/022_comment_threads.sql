begin;
-- Comentarios con respuestas (dos niveles) y reacciones de corazon o tomate.
-- Aplicar PRIMERO en el proyecto de pruebas. En produccion solo con confirmacion del dueño y ANTES de publicar la app que la usa.

-- Respuestas: parent_id apunta al comentario principal. Solo dos niveles: una respuesta no puede tener respuestas.
alter table public.comments add column parent_id uuid references public.comments(id) on delete cascade;
create index comments_parent_idx on public.comments(parent_id) where parent_id is not null;
create function public.check_comment_parent() returns trigger language plpgsql security definer set search_path='' as $$
declare par public.comments;
begin
 if new.parent_id is null then return new; end if;
 select * into par from public.comments where id=new.parent_id;
 if not found or par.post_id<>new.post_id or par.parent_id is not null then
  raise exception 'INVALID_PARENT' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function public.check_comment_parent() from public,anon,authenticated;
create trigger comment_parent_check before insert on public.comments for each row execute function public.check_comment_parent();

-- Reacciones a comentarios: una por persona y comentario (la llave primaria lo garantiza; cambiar de corazon a tomate actualiza la fila).
create table public.comment_reactions (
 user_id uuid not null references auth.users(id) on delete cascade,
 comment_id uuid not null references public.comments(id) on delete cascade,
 kind text not null check(kind in('heart','tomato')),
 created_at timestamptz not null default now(),
 primary key(user_id,comment_id)
);
create index comment_reactions_comment_idx on public.comment_reactions(comment_id);
alter table public.comment_reactions enable row level security;
revoke all on public.comment_reactions from anon,authenticated;
grant select,insert,delete on public.comment_reactions to authenticated;
grant update(kind) on public.comment_reactions to authenticated;
create policy comment_reactions_read_own on public.comment_reactions for select to authenticated using(user_id=(select auth.uid()));
create policy comment_reactions_add_own on public.comment_reactions for insert to authenticated with check(user_id=(select auth.uid()));
create policy comment_reactions_change_own on public.comment_reactions for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy comment_reactions_remove_own on public.comment_reactions for delete to authenticated using(user_id=(select auth.uid()));
-- Solo se reacciona a comentarios que la persona puede ver (no ocultos, bloqueados ni de publicaciones retiradas).
create policy comment_reactions_visible on public.comment_reactions as restrictive for insert to authenticated with check(exists(select 1 from public.comments c where c.id=comment_id));
create trigger account_write_guard before insert or update on public.comment_reactions for each row execute function public.guard_account_write();

-- Contadores publicos por comentario (no revelan quien reacciono). Misma idea que post_stats.
create view public.comment_stats with(security_barrier=true) as
 select c.id as comment_id,
  count(r.user_id) filter (where r.kind='heart')::bigint as hearts_count,
  count(r.user_id) filter (where r.kind='tomato')::bigint as tomatoes_count
 from public.comments c
 left join public.comment_reactions r on r.comment_id=c.id
 where c.deleted_at is null and not public.content_hidden('comment',c.id)
 group by c.id;
revoke all on public.comment_stats from anon,authenticated;
grant select on public.comment_stats to anon,authenticated;
commit;
