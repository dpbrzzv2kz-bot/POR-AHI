begin;
-- Tomate: reaccion de desacuerdo, hermana de post_likes. Una sola reaccion por persona y publicacion.
-- Aplicar PRIMERO en el proyecto de pruebas. En produccion solo con confirmacion del dueño y ANTES de publicar la app que la usa.
create table public.post_tomatoes (
 user_id uuid not null references auth.users(id) on delete cascade,
 post_id uuid not null references public.posts(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,post_id)
);
create index post_tomatoes_post_idx on public.post_tomatoes(post_id);
alter table public.post_tomatoes enable row level security;
revoke all on public.post_tomatoes from anon,authenticated;
grant select,insert,delete on public.post_tomatoes to authenticated;
create policy tomatoes_read_own on public.post_tomatoes for select to authenticated using(user_id=(select auth.uid()));
create policy tomatoes_add_own on public.post_tomatoes for insert to authenticated with check(user_id=(select auth.uid()));
create policy tomatoes_remove_own on public.post_tomatoes for delete to authenticated using(user_id=(select auth.uid()));
-- Solo se puede reaccionar a publicaciones que la persona ve (no bloqueadas, ocultas ni retiradas), igual que los me gusta (008).
create policy tomatoes_block_filter on public.post_tomatoes as restrictive for insert to authenticated with check(exists(select 1 from public.posts where id=post_id));
-- Misma proteccion de cuentas en borrado que el resto de tablas (011).
create trigger account_write_guard before insert or update on public.post_tomatoes for each row execute function public.guard_account_write();
-- Corazon y tomate se excluyen: al elegir uno se quita el otro, de forma atomica.
create function public.exclusive_reaction() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='post_tomatoes' then
  delete from public.post_likes where user_id=new.user_id and post_id=new.post_id;
 else
  delete from public.post_tomatoes where user_id=new.user_id and post_id=new.post_id;
 end if;
 return new;
end $$;
revoke all on function public.exclusive_reaction() from public,anon,authenticated;
create trigger tomato_replaces_like before insert on public.post_tomatoes for each row execute function public.exclusive_reaction();
create trigger like_replaces_tomato before insert on public.post_likes for each row execute function public.exclusive_reaction();
-- Contadores publicos: misma vista de 012_own_content.sql con tomatoes_count al final.
create or replace view public.post_stats with(security_barrier=true) as
 select p.id as post_id,coalesce(l.total,0)::bigint as likes_count,coalesce(c.total,0)::bigint as comments_count,coalesce(t.total,0)::bigint as tomatoes_count
 from public.posts p
 left join(select post_id,count(*) total from public.post_likes group by post_id)l on l.post_id=p.id
 left join(select post_id,count(*) total from public.comments where deleted_at is null and not public.content_hidden('comment',id) group by post_id)c on c.post_id=p.id
 left join(select post_id,count(*) total from public.post_tomatoes group by post_id)t on t.post_id=p.id
 where not public.content_hidden('post',p.id) and not public.content_withdrawn('post',p.id);
commit;
