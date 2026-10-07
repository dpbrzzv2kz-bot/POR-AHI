# Entornos: pruebas y producción

Objetivo: probar sin tocar los datos reales de los usuarios.

## Cómo funciona

| Archivo | Entorno | ¿Va a Git? |
|---|---|---|
| `.env` | **Producción** (Supabase real "POR AHI") | No |
| `.env.local` | **Pruebas** (segundo proyecto de Supabase) | No |
| `.env.pruebas.example` | Plantilla sin valores reales | Sí |

Expo da prioridad a `.env.local` sobre `.env`. Si `.env.local` existe, la app usa pruebas; si no existe, usa producción.

## Una sola vez: crear el Supabase de pruebas

1. En supabase.com crea un proyecto nuevo, por ejemplo "POR AHI - pruebas" (a nombre de la empresa).
2. En su editor SQL, ejecuta en orden los archivos `supabase/001_*.sql` a `supabase/012_*.sql`. Solo esos; los `check_*`, `verify_*` y `activate_*` son comprobaciones o acciones puntuales.
3. Copia `.env.pruebas.example` como `.env.local` y pega ahí la URL y la clave **publicable** del proyecto de pruebas. Nunca la `service_role`.
4. En el panel de pruebas, repite los ajustes de Authentication del proyecto real (URL del sitio, redirecciones, Google si aplica).

## Uso diario

- **Probar:** deja `.env.local` y arranca con `npm start`.
- **Volver a producción:** borra `.env.local` y reinicia Expo.

## Regla para publicar

**Antes de publicar la web (`expo export`) o una actualización, confirma que `.env.local` no existe.** `expo export` también lee `.env.local`; si se queda, se publicaría la app apuntando a pruebas.

Hoy no hay forma automática de detectar esto; es una verificación manual.

## Pendiente

- Verificar en el proyecto de pruebas que las 12 migraciones se aplican sin errores.
- Entorno de pruebas para EAS (builds de tiendas): se define en el paso 8 del plan.
