# Por Ahí — contexto del proyecto

> Este archivo resume una conversación larga de planeación. Léelo completo antes de tocar código.
> Colócalo en la raíz de `resenas-app` con el nombre `CLAUDE.md`.

## 1. Quiénes son y cómo trabajar con ellos

- El dueño del proyecto **no programa**. Su primo (contador) también está en el proyecto y tampoco programa.
- Idioma: **español, sencillo, sin jerga**. Explica cada cambio en una o dos frases: qué hiciste, por qué y cómo comprobarlo.
- El código original lo generó ChatGPT (Codex). Ahora se continúa con Claude. Todo lo que se haga debe quedar documentado para que cualquier IA o persona pueda retomarlo.

## 2. Qué es la app

**"Por Ahí"** (nombre provisional): red social de **reseñas y recomendaciones de lugares**, con fotos y videos, al estilo de un feed vertical.

- Pestañas del feed: Para ti / Siguiendo / Cerca de ti. Stories arriba del feed.
- Barra inferior: Inicio (Fotos), Videos, Mensajes, Buscar, Perfil.
- Categorías de lugares: Comer, Divertirse, Explorar.
- **Principio de producto: neutralidad.** Nadie puede pagar por aparecer mejor ni por cambiar o borrar reseñas. Los usuarios pueden criticar libremente.
- Proyecto independiente de "MUSA" (otra idea anterior, en pausa). No hay criptomonedas ni pagos.

## 3. Stack y estado técnico (según lo que reportó ChatGPT)

- **React Native + Expo + TypeScript**, con **React Native Web** para la versión web.
- **Netlify**: aloja la versión web. URL: https://incredible-crumble-34cbca.netlify.app/ (las actualizaciones se han subido a mano como ZIP; no hay despliegue automático desde GitHub).
- **Supabase** (proyecto "POR AHI"): autenticación, base de datos PostgreSQL y Storage.
  - Tablas: `profiles`, `posts`.
  - Bucket: `review-media` (límite actual de 6 MB por archivo). Archivos sin publicar restringidos; los de reseñas publicadas son visibles para visitantes.
  - Hay reglas de acceso (RLS) para que cada usuario edite su propio perfil. **No han sido revisadas por un especialista.**
- Carpeta local original: `C:/Users/jperezcarden/Documents/Codex/2026-10-02/hola/outputs/resenas-app` (Windows).
- **Git**: existe historial local, pero **no hay repositorio en GitHub** para este proyecto (el que existe es de MUSA).

### Qué funciona y qué es maqueta

| Función | Estado |
|---|---|
| Web publicada | Funciona |
| Registro e inicio de sesión (Supabase) | Funciona |
| Perfil (nombre, usuario, biografía) | Funciona, confirmado por el dueño |
| Publicar reseña con foto o video (hasta 50 MB, subida reanudable) | Implementado en código y SQL; **falta probar completo desde iPhone real** |
| Stories, seguir, me gusta, guardados, comentarios, notificaciones, mensajes de texto | Implementado con Supabase (migraciones 003–007); según README de ChatGPT verificado en 58 comprobaciones; **no reverificado por Claude** |
| Bloquear, reportar, panel de moderación | Implementado (008, 009) |
| Borrar cuenta, editar/borrar contenido propio | Implementado (011, 012) |
| Recuperar contraseña, acceso con Google, compartir por enlace, búsqueda por lugar/categoría | Implementado y publicado según README |
| Rediseño "urbano" (oscuro + verde lima) | Aplicado en el código, **aún no publicado** en la web |
| Recomendaciones por ubicación real | Pendiente |
| App en App Store / Google Play (`eas.json`, bundle ID) | Pendiente |

> **Aviso (2026-10-07):** las líneas anteriores de este archivo decían que likes, mensajes, stories y búsqueda eran maqueta. La auditoría de Claude encontró que ya están implementados (ver `supabase/` y `README.md`). Los detalles de la web publicada (datos ficticios, "Actualizando…", íconos de texto) venían de una revisión anterior y **hay que reverificarlos** contra la versión actual.

Entornos: `.env` = producción, `.env.local` = pruebas (tiene prioridad). Guía en `docs/ENTORNOS.md`. **Antes de publicar, confirmar que `.env.local` no existe.** El Supabase de pruebas aún no está creado.

Limitación del equipo: Windows bloquea `node.exe` por directiva de grupo en las sesiones de Claude, por lo que `tsc`, `lint` y las pruebas no se han podido correr desde aquí.

## 4. Decisiones ya tomadas

**Producto y negocio**
- **No** se venderán destacados a negocios locales (rompe la neutralidad).
- Ingresos previstos: anuncios automáticos de una red (AdMob u otra) etiquetados "Patrocinado", fuera de las fichas de lugar y sin relación con el ranking. Segundo ingreso opcional: suscripción sin anuncios.
- Los anuncios solo funcionan en **app nativa**, no en la web.
- Meta de sostenibilidad: costos mínimos al inicio; los anuncios cubren servidores hacia 2.000–5.000 usuarios diarios y sueldos hacia 15.000–40.000 usuarios diarios (estimación, depende del eCPM real en México).

**Técnicas**
- Seguir con **Expo / React Native** como base única para web, iPhone y Android. **No reescribir** como apps nativas separadas.
- La app nativa se genera con **Expo EAS Build** y se publica con **EAS Submit**. Actualizaciones pequeñas con **EAS Update**.
- **El identificador de la app (bundle ID / package name) no se puede cambiar después de publicar.** No fijarlo sin confirmación del dueño. Propuesta de formato: `com.<empresa>.porahi`.
- La app debe hablar con el backend mediante **un dominio propio** (p. ej. `api.<dominio>`), no con la URL directa de Supabase, para poder migrar el servidor sin que los usuarios descarguen otra app.
- Mantener **dos entornos** de Supabase (pruebas y producción) y guardar los cambios de base de datos como **migraciones en código**.
- Incluir un mecanismo de "versión mínima soportada" para pedir actualizar la app.
- Las cuentas de Apple Developer, Google Play, Expo, Supabase, Netlify y el dominio deben quedar **a nombre de la empresa**, no de una persona.

## 5. Requisitos que las tiendas esperan (verificar vigencia)

- Política de privacidad y términos con enlace público.
- Reportar contenido y bloquear usuarios; moderación básica.
- Borrar la cuenta desde dentro de la app.
- Permisos de cámara/fotos con texto de justificación.
- Cuentas personales nuevas de Google Play pueden requerir una fase de pruebas cerradas antes de publicar.

## 6. Plan de trabajo, en orden

1. **Auditoría del código**: estructura, qué es real y qué es maqueta, errores, dependencias. Entregar un informe corto en español.
2. **Revisión de seguridad de Supabase**: políticas RLS de `profiles`, `posts` y del bucket `review-media`; validación de tipos y tamaños de archivo; que no haya claves secretas en el código. Proponer correcciones, **sin aplicarlas en producción sin avisar**.
3. **Orden del proyecto**: `.gitignore` correcto (sin `.env` ni `node_modules`), crear este `CLAUDE.md` y un `README` básico, preparar el repositorio para subir a GitHub (el dueño crea el repo y autoriza el push).
4. **Entornos y migraciones**: separar configuración de pruebas y producción con variables de entorno.
5. **Ajustes para teléfono**: sesión persistente con almacenamiento seguro, enlace de confirmación de correo que abra la app, selección/subida/reproducción de foto y video en iOS y Android, compresión de video antes de subir.
6. **Funciones reales**: sustituir maquetas por datos reales en este orden: feed de reseñas reales, perfiles públicos, búsqueda de usuarios, seguir, likes/comentarios, y al final mensajes y ubicación.
7. **Requisitos de tiendas**: reportar, bloquear, borrar cuenta, pantallas de privacidad y términos.
8. **Expo EAS**: `app.json`, `eas.json`, íconos, permisos, builds de prueba (Android directo, iPhone por TestFlight).
9. Después de lanzar y probar con 10–20 personas reales: anuncios (AdMob), monitoreo de errores (p. ej. Sentry) y estadísticas básicas.

## 7. Reglas de trabajo para Claude Code

- **Un cambio a la vez**, probado y con su propio commit con mensaje claro en español.
- Antes de cualquier acción que **publique, borre datos, cambie producción, gaste dinero o toque cuentas**, pedir confirmación explícita.
- **Nunca** pedir, mostrar ni guardar contraseñas, la `service_role key` de Supabase ni valores de `.env`. Si hace falta una variable, indicar su nombre y dónde configurarla.
- No ejecutar operaciones destructivas sobre la base de datos ni borrar archivos sin confirmar.
- Si algo es una suposición o no se pudo verificar, decirlo.
- Mantener este archivo actualizado cuando cambie una decisión o el estado de una función.

## 8. Referencias de costos (estimaciones, 2026)

- Supabase Pro: $25/mes + uso (computación extra, salida de datos a $0,09/GB sobre 250 GB). Plan gratis se pausa tras una semana sin uso.
- Netlify: Free, Personal $9, Pro $20 (sistema de créditos desde abril de 2026).
- Cloudflare R2: ~$0,015/GB al mes, sin cobro por salida de datos.
- Video administrado: Cloudflare Stream $5 por 1.000 min almacenados y $1 por 1.000 min reproducidos; Mux $0,0024/min almacenado y $0,0008/min reproducido. El video es el costo que más crece.
- Expo EAS: plan gratis con 15 builds de Android y 15 de iOS al mes; Starter $19/mes.
- Apple Developer ~$99/año y Google Play ~$25 una vez (de memoria, verificar).
- Un caso de 100.000 usuarios con 30.000 activos al día: ~$1.000–3.000/mes si el video lo guardan ellos; ~$8.000–11.000/mes con video administrado. Son estimaciones.

## 9. Pendientes de definir con el dueño

- Nombre definitivo de la app y de la empresa.
- Identificador (bundle ID) definitivo.
- Dominio propio.
- Quién será el titular de las cuentas de Apple y Google.
- Reglas de la comunidad y política de moderación (revisión por un abogado).
- Revisión de seguridad por un especialista antes de abrir al público.

## 10. Decisiones de producto y diseño (2026-10-07) y pendientes

**Ya aplicado en el código (probado en iPhone con Expo Go solo lo que se indica):**
- Acceso obligatorio: sin sesión solo se ve el login. Primer paso al entrar: elegir nombre y @usuario (sin "Sobre ti").
- Feed único, sin filtros arriba: lo de quienes sigues; si no sigue a nadie, lo más reciente de la comunidad. Jalar hacia abajo para refrescar.
- Filtro global por categoría desde el cuadrito del logo (Todo, Comer, Divertirse, Explorar). Siempre abre en Todo. Aplica al feed y a Buscar; el perfil tiene su propio filtro. Colores "Neón": Comer #FF9F1C, Divertirse #C26BFF, Explorar #2DE2C0 (en `lib/theme.ts`).
- Mensajes: directo a conversaciones, con buscador de personas. Buscar: solo selector Reseñas/Personas y buscador.
- Configuración del perfil en pantalla aparte (icono en la tarjeta del perfil): editar perfil, bloqueados, cerrar sesión, eliminar cuenta.
- Arreglo importante: subir fotos y videos fallaba siempre en iPhone (la librería contaba 0 bytes). Corregido en `lib/media.ts`; **falta confirmar con videos grandes**.

**Pendiente:**
- **90/10 del feed:** 90% de quienes sigues y 10% "cerca de ti". El 10% está apartado: la app no guarda la ubicación de cada reseña ni pide la del teléfono. Requiere cambio en base de datos (primero en pruebas) y permiso de ubicación.
- **Acceso con Google en iPhone:** código escrito (`lib/nativeGoogleSignIn.ts`), sin probar. Falta crear credenciales en Google Cloud (cuenta personal por ahora; pasar a la de la empresa antes de publicar), activarlas en el Supabase de pruebas y agregar `exp://**` y `porahi://**` en Redirect URLs.
- **Acceso con Apple:** no existe. Requiere cuenta de Apple Developer. Apple suele exigirlo si se ofrece Google (verificar la regla vigente).
- Error sin mensaje en la terminal ligado a `BlockedList` en Perfil: sin investigar.
- Frase de relleno de biografía en la tarjeta del perfil, y etiquetas repetidas cuando hay un filtro activo: decisiones de diseño abiertas.
- Para ver la app en iPhone: Expo Go, misma cuenta de Expo en teléfono y computadora, y arrancar con `node node_modules/expo/bin/cli start` (el `npm run` lo bloquea la directiva de grupo de Windows).
