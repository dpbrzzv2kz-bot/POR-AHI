# Red de reseñas: primera demo

Nombre provisional de interfaz: «por ahí». Proyecto independiente de MUSA.

Expo + React Native + TypeScript. Feed visual de fotos y videos con tres categorías. La información de la reseña se abre en un panel separado desde «Ver detalles» o deslizando hacia arriba sobre ese control. Al acabar un video aparece una invitación a ver detalles, sin abrir el panel automáticamente. Guardar y quitar pendientes y perfil con contadores.

Publicación local mediante expo-image-picker y reproducción mediante expo-video. Se exige foto o video y nombre de lugar; la descripción es opcional. Límites preliminares de 100 MB y 60 segundos cuando el selector facilita metadatos. Antes de producción se necesitan validaciones de archivos en servidor, conversión y almacenamiento real. No se sube ningún archivo a internet. Los ejemplos iniciales son maquetas con personas y lugares ficticios. El estado vive en memoria y se pierde al reiniciar. No hay cuentas reales, stories de 24 h, seguidores ni buscador conectados.

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
