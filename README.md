# Red de reseñas: primera demo

Nombre provisional de interfaz: «por ahí». Proyecto independiente de MUSA.

Expo + React Native + TypeScript. Feed visual de fotos y videos con tres categorías. La información de la reseña se abre en un panel separado desde «Ver detalles» o deslizando hacia arriba sobre ese control. Al acabar un video aparece una invitación a ver detalles, sin abrir el panel automáticamente. Guardar y quitar pendientes y perfil con contadores.

Publicación mediante expo-image-picker y reproducción mediante expo-video. Se exige foto o video y nombre de lugar; la descripción es opcional. Límites preliminares de 6 MiB y 60 segundos cuando el selector facilita metadatos. Antes de ampliar el piloto se necesitan validaciones de archivos en servidor y conversión de videos. Las reseñas visuales y stories se suben a Supabase al pulsar Publicar. Los ejemplos iniciales son maquetas con personas y lugares ficticios. Solo el estado de demostración vive en memoria; las reseñas se recuperan de Supabase. Cuentas, perfiles, reseñas y stories usan Supabase; solo los mensajes siguen siendo locales.

## Primer enfoque social

Cinco pestañas: Fotos, Videos, Mensajes, Buscar y Perfil. Fotos y videos se separan por tipo de archivo. Para ti muestra ejemplos; Siguiendo consulta las publicaciones de perfiles seguidos en Supabase; Cerca de ti usa etiquetas estáticas de demostración, sin GPS ni recomendador real.

Stories separadas en la cabecera de Fotos. El botón Tu story abre un selector de foto/video; se asigna caducidad de 24 horas y la vista se actualiza cada 30 segundos. Las stories se recuperan de Supabase al recargar. Se retiraron las stories ficticias.

Búsqueda de perfiles reales por nombre y usuario, abrir perfiles y seguir/dejar de seguir con persistencia. Mensajes locales de prueba que no se envían a nadie. Perfil con fotos/videos propios y guardados. Me gusta y guardado son controles separados y se conservan en Supabase. Crear reseña desde ＋.

Verificados en navegador: filtros de seguimiento, separación de videos, búsqueda por @usuario, apertura de perfil, seguir, apertura de story, conversación local. TypeScript pasa. Falta prueba en iPhone y conexión de servicios reales.

El cambio de feed se verificó con TypeScript y en navegador: detalles separados, guardado, rechazo de publicación sin archivo y selección/publicación de imagen de prueba. El video y gesto táctil en iPhone aún no se comprobaron en un dispositivo físico.

## Ejecutar

Desde esta carpeta, con Node y dependencias instaladas:

```powershell
node node_modules/expo/bin/cli start --lan --port 8780
```

Para web: añadir `--web`. Para iniciar sesión en Expo sin escribir la contraseña en comandos:

```powershell
node node_modules/expo/bin/cli login --browser
```

En iPhone físico, iniciar sesión en Expo Go con la misma cuenta que Expo CLI. Teléfono y computadora deben compartir una red Wi-Fi accesible. El servidor local no equivale a hosting público. El QR se genera al arrancar el servidor con conexión LAN; no usar la dirección localhost desde el iPhone.

## Verificación y pendientes

TypeScript: `node node_modules/typescript/bin/tsc --noEmit`.

La navegación, detalle y guardado se comprobaron en navegador. TypeScript pasó y se exportó el paquete JavaScript de iOS con `--no-bytecode` para diagnóstico. Falta comprobar el dispositivo físico. La exportación Hermes encontró un bloqueo del ejecutable en este equipo; no hay compilación nativa firmada ni envío a las tiendas. Revisar dependencias de la plantilla y runtime Node LTS antes de publicación; no ejecutar actualizaciones incompatibles automáticas.

Próximos pasos: probar stories desde iPhone, perfiles y búsqueda públicos, notificaciones, mensajes reales y moderación. La prueba nativa en Expo sigue pendiente.

## Cuentas y perfiles (2026-10-05)
Proyecto Supabase independiente bxsllqteuafbusruspqd. Variables públicas en .env.example; copiar a .env y usar solo publishable, nunca secret/service_role. Migración supabase/001_profiles.sql aplicada: RLS, lectura y escritura solo de perfil propio. Registro con confirmación de correo, inicio/cierre de sesión y edición de nombre, usuario y biografía desde Perfil. Configurar Site URL en Supabase con la URL Netlify. El usuario confirmó inicio de sesión y persistencia del perfil; los permisos propios se verificaron con SQL. La tabla profiles permanece privada; la migración 004 publica únicamente id, nombre, @usuario y biografía mediante public_profiles. Dependencias reportan 24 hallazgos npm audit: revisión antes del lanzamiento público.


Corrección de Guardar perfil: normaliza @ y mayúsculas, muestra avisos junto al botón y permite reintentar la carga. Cancela consultas de perfil a los 15 segundos. TypeScript/export web pasan. Prueba SQL con rol authenticated insertó, actualizó y leyó perfil propio en una transacción revertida, sin conservar datos. Publicado y verificado bundle index-0167c9b90a8e069d992ecd71e3f7541e.js. Verificación del recorrido en iPhone pendiente.


La cabecera del perfil usa ahora el registro cargado o guardado en Supabase (nombre, usuario y biografía); los contadores locales se marcan como demostración. Cerrar sesión limpia la identidad visible. TypeScript y export web verificados.


## Publicaciones persistentes (2026-10-05)
Migración 002_posts.sql aplicada. Tabla posts con RLS, lectura pública e inserción propia; trigger fija autor desde perfil propio y requiere @usuario. Bucket review-media privado, máximo 6 MiB, MIME JPG/PNG/WebP/MP4/MOV. Objetos no publicados son legibles solo por su dueño; publicados permiten lectura con políticas y enlaces firmados de una hora. Actualizar publicaciones recarga últimas 60 reseñas. El perfil filtra por id real de usuario. No hay borrado/edición, paginación, transcoding, moderación o cargas reanudables todavía. Reintentos reutilizan ruta para reducir duplicados. Archivos huérfanos tras fallos requieren limpieza futura. Duración 60 s es validación cliente si hay metadatos.
Verificación: TypeScript/export web pasan; API anónima de feed responde; check_posts_rollback.sql pasó cuatro verificaciones de privacidad de borrador, autor, lectura de post y de medio publicado, sin conservar filas. Selector de imagen, rechazo sin archivo y rechazo sin sesión comprobados en navegador. El usuario confirmó que publicó una reseña real y permanece al actualizar. Dependencias npm audit siguen con 24 hallazgos que requieren revisión antes de lanzamiento amplio.


## Stories persistentes (2026-10-05)
Migración 003_stories.sql aplicada. Cada story requiere sesión, perfil completo y archivo real. Comparte el bucket privado review-media y límite de 6 MiB. El servidor fija autor y vencimiento a 24 horas, independientemente de lo enviado por el cliente. RLS permite consultar solo stories activas y sus medios; los enlaces firmados duran como máximo una hora y nunca más que el tiempo restante calculado. Se cargan las últimas 60 y se recargan al iniciar, publicar o pulsar Actualizar publicaciones. El reloj de la interfaz retira las vencidas cada 30 segundos.
Los registros y archivos vencidos quedan almacenados; la limpieza programada está pendiente. Los reintentos reutilizan una ruta para reducir duplicados. Stories anteriores guardadas únicamente en memoria no son recuperables después de recargar.
Verificación: TypeScript y export web pasan. check_stories_rollback.sql pasó cinco comprobaciones (24 horas impuestas por servidor, autor correcto, lectura activa, ocultación de story vencida y de medio vencido a visitantes) en una transacción revertida. El usuario confirmó que las stories nuevas con archivos pequeños permanecen al recargar.


## Perfiles, búsqueda y seguimiento (2026-10-05)
Migración 004_social.sql aplicada. La vista public_profiles presenta solo id, display_name, username y bio de perfiles completos; no consulta auth.users ni expone correos. La vista usa intencionalmente permisos de su propietario para publicar esta lista limitada; la tabla profiles mantiene lectura y escritura propias por RLS. Considerar preferencias de visibilidad y bloqueo antes de ampliar la comunidad.
Follows guarda pares únicos, sin seguimiento propio, y solo permite consultar, insertar o borrar el seguimiento del usuario autenticado. Se limpia el estado de seguimiento al cambiar sesión, se ignoran respuestas antiguas y se muestran errores de escritura. No hay contadores públicos de seguidores todavía.
El buscador consulta hasta 30 perfiles por búsqueda con espera de 300 ms, cancela consultas obsoletas y permite reintentar. Los perfiles y Siguiendo consultan sus últimas 60 publicaciones directamente, sin depender del primer lote del feed general. Las listas todavía requieren paginación para más volumen. Los perfiles de Mensajes siguen siendo ficticios y los mensajes no se envían.
Verificación: TypeScript y export web pasan. check_social_rollback.sql creó dos usuarios sintéticos sin contraseñas, perfiles y metadatos en una transacción revertida: nueve resultados true verifican lectura pública limitada, protección de la tabla privada, seguimiento guardado, feed siguiendo, rechazo de suplantación y seguimiento propio, privacidad de lista ajena, lectura posterior y protección contra borrado ajeno, y dejar de seguir. No quedaron usuarios ni publicaciones de prueba. No equivale a dos sesiones de navegador con login.
En navegador: buscar @gusto, abrir perfil real y consultar su foto, búsqueda sin resultados, y rechazo de seguimiento sin sesión. La prueba de seguimiento autenticado se realizó con roles SQL; el recorrido con dos sesiones reales en Safari/iPhone sigue pendiente.
Lint instalado con herramientas de Expo 57: ejecución directa de ESLint sin errores y 15 advertencias. Las reglas de migración al React Compiler (refs, purity y set-state-in-effect) quedan como advertencias visibles para los componentes existentes que usan fábricas de eventos y efectos de carga; React Compiler no está habilitado. No se silencian reglas de orden de hooks o dependencias. En este equipo `expo lint` encuentra un bloqueo del ejecutable por política Windows, por eso se usa `node node_modules/eslint/bin/eslint.js App.tsx components lib`. Dependencias siguen con 24 hallazgos npm audit anteriores.


## Me gusta, guardados y comentarios (2026-10-05)
Migración 005_interactions.sql aplicada. post_likes y bookmarks admiten un registro por usuario/publicación, requieren sesión y solo permiten consultar o cambiar los registros propios. post_stats publica únicamente los contadores de likes y comentarios activos, sin identidades de likes ni guardados. Los guardados se consultan por sus IDs directamente (últimas 60 publicaciones), aunque no estén en el primer lote del feed general. Colecciones de likes y guardados limitadas por el límite de filas de PostgREST (1000 por defecto): agregar paginación antes de mayor escala.
Comments exige perfil completo, autor fijado por servidor y texto no vacío de hasta 1000 caracteres. Lectura pública de comentarios activos; el propietario conserva acceso a los retirados para poder restaurarlos. Solo se concede actualización de deleted_at, nunca autor, cuerpo, post o usuario. Borrar mi comentario lo oculta y ofrece Deshacer borrado durante esa sesión del panel; las filas no se eliminan físicamente. No hay edición, moderación, reportes, rate limiting o filtros de spam todavía.
La interfaz carga la biblioteca propia tras iniciar sesión/reintentar; la filtra por dueño para evitar mostrar guardados ajenos al cambiar cuenta. Los contadores ignoran respuestas anteriores cuando ya existe una consulta más reciente. Los cambios se muestran tras respuesta del servidor, bloquean toques repetidos mientras están pendientes y conservan un ID de borrador para reintentos de comentarios. Actualizar publicaciones recarga biblioteca y contadores. Los comentarios se cargan al abrir detalles o al pulsar Actualizar comentarios (últimos 50); no son actualizaciones en tiempo real.
Verificación: TypeScript pasa; ESLint directo pasa sin errores y con 20 advertencias de migración al compilador de React/efectos heredados, documentadas en el bloque anterior. Export web completado. check_interactions_rollback.sql creó dos usuarios sintéticos, un post de metadatos y las interacciones en una transacción revertida; 18 resultados true para unicidad/reintento, autor, persistencia, privacidad, rechazo de suplantación, límites de texto, contadores, rechazo de escritura anónima, protección de borrado ajeno, borrado reversible y deshacer. Todos los datos de prueba se revirtieron; no se enviaron correos ni se crearon contraseñas.
En navegador: contador público real de la publicación existente, rechazo de me gusta sin sesión, panel de comentarios vacío y lectura anónima con aviso para iniciar sesión. Pruebas autenticadas realizadas con roles SQL; no se afirma haber probado dos sesiones reales de navegador o teléfonos. Las pruebas de video/iPhone físico y de interacción autenticada completa desde Safari siguen pendientes. La exportación no equivale a publicación en App Store/Google Play.
