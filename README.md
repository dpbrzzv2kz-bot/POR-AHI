# Red de reseñas: primera demo

Nombre provisional de interfaz: «por ahí». Proyecto independiente de MUSA.

Expo + React Native + TypeScript. Inicio con tres categorías, detalle de reseña, guardar y quitar pendientes, publicación de reseñas de comida de prueba y perfil con contadores. Personas y lugares iniciales ficticios. No hay cuentas reales, backend ni fotografías de lugares. El estado vive en memoria y se pierde al reiniciar.

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
