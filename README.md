# Red de reseñas: primera demo

Nombre provisional de interfaz: «por ahí». Proyecto independiente de MUSA.

Expo + React Native + TypeScript. Feed visual de fotos y videos con tres categorías. La información de la reseña se abre en un panel separado desde «Ver detalles» o deslizando hacia arriba sobre ese control. Al acabar un video aparece una invitación a ver detalles, sin abrir el panel automáticamente. Guardar y quitar pendientes y perfil con contadores.

Publicación local mediante expo-image-picker y reproducción mediante expo-video. Se exige foto o video y nombre de lugar; la descripción es opcional. Límites preliminares de 100 MB y 60 segundos cuando el selector facilita metadatos. Antes de producción se necesitan validaciones de archivos en servidor, conversión y almacenamiento real. No se sube ningún archivo a internet. Los ejemplos iniciales son maquetas con personas y lugares ficticios. El estado vive en memoria y se pierde al reiniciar. Las cuentas y perfiles usan Supabase; publicaciones, seguimiento y mensajes siguen siendo locales.

## Primer enfoque social

Cinco pestañas: Fotos, Videos, Mensajes, Buscar y Perfil. Fotos y videos se separan por tipo de archivo. Para ti muestra ejemplos; Siguiendo filtra según los perfiles seguidos localmente; Cerca de ti usa etiquetas estáticas de demostración, sin GPS ni recomendador real.

Stories separadas en la cabecera de Fotos. El botón Tu story abre un selector de foto/video; se asigna caducidad de 24 horas y la vista se actualiza cada 30 segundos. Reiniciar borra el estado, incluso stories propias. Las stories de muestra se regeneran con cada arranque; no son publicaciones reales.

Búsqueda de perfiles ficticios por nombre y usuario, abrir perfiles y seguir/dejar de seguir. Mensajes locales de prueba que no se envían a nadie. Perfil con fotos/videos propios y guardados. Me gusta y guardado son controles separados. Crear reseña desde ＋.

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

Próximos pasos: sesión Expo y primera prueba iPhone, persistencia de borradores, diseño revisado con el usuario, fotos, Supabase independiente, autenticación y permisos, moderación, pruebas con usuarios.

## Cuentas y perfiles (2026-10-05)
Proyecto Supabase independiente bxsllqteuafbusruspqd. Variables públicas en .env.example; copiar a .env y usar solo publishable, nunca secret/service_role. Migración supabase/001_profiles.sql aplicada: RLS, lectura y escritura solo de perfil propio. Registro con confirmación de correo, inicio/cierre de sesión y edición de nombre, usuario y biografía desde Perfil. Configurar Site URL en Supabase con la URL Netlify. No se ha probado el registro con un correo humano; validar confirmación, persistencia y permisos antes de abrir al público. Perfiles aún privados; búsqueda pública pendiente. Dependencias reportan 24 hallazgos npm audit: revisión antes del lanzamiento público.


Corrección de Guardar perfil: normaliza @ y mayúsculas, muestra avisos junto al botón y permite reintentar la carga. Cancela consultas de perfil a los 15 segundos. TypeScript/export web pasan. Prueba SQL con rol authenticated insertó, actualizó y leyó perfil propio en una transacción revertida, sin conservar datos. Publicado y verificado bundle index-0167c9b90a8e069d992ecd71e3f7541e.js. Verificación del recorrido en iPhone pendiente.


La cabecera del perfil usa ahora el registro cargado o guardado en Supabase (nombre, usuario y biografía); los contadores locales se marcan como demostración. Cerrar sesión limpia la identidad visible. TypeScript y export web verificados.

