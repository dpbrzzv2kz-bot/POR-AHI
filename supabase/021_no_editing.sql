begin;
-- Las resenas ya no se pueden editar: lo que la gente vio y califico (corazones, tomates) no debe cambiar despues.
-- Para corregir algo se elimina la publicacion y se sube una nueva. Eliminar sigue funcionando igual (content_management).
-- posts no tiene permiso de UPDATE directo para los usuarios (012_own_content.sql); al cerrar esta funcion no queda ninguna via de edicion.
-- Aplicar PRIMERO en el proyecto de pruebas. En produccion solo con confirmacion del dueño.
revoke execute on function public.edit_own_review(uuid,integer,text,text,text) from public,anon,authenticated;
commit;
