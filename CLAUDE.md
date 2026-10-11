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

Nota del equipo: antes Windows bloqueaba `node.exe` en las sesiones de Claude; ahora sí corre. Comprobaciones: `node node_modules/typescript/bin/tsc --noEmit` (debe dar 0 errores) y `node node_modules/eslint/bin/eslint.js App.tsx components lib src scripts --quiet` (0 errores; quedan 33 avisos antiguos).

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

## 11. Migraciones y cambios que faltan en producción (actualizado 2026-10-07)

Todo lo siguiente está aplicado **solo en el Supabase de pruebas** ("PRUEBAS POR AHI"). El Supabase real y la web publicada siguen como antes. **Antes de publicar la nueva versión hay que aplicar en producción, en este orden y con confirmación del dueño:**
1. `supabase/013_avatars.sql`: columna `avatar_path`, bucket público `avatars`, vista `public_profiles` con la foto.
2. `supabase/014_reactions.sql`: reacción de tomate (`post_tomatoes`), exclusión corazón/tomate y `tomatoes_count` en `post_stats`.
Si se publica la app sin aplicar esas migraciones, los perfiles y los contadores dejan de cargar.

**Decisiones de producto de esta tanda:**
- Cada publicación muestra arriba a la derecha cuántos corazones y tomates tiene; abajo se elige corazón o tomate. Es una sola reacción por persona (elegir una quita la otra, lo hace la base de datos). El tomate NO genera notificación al autor. Los comentarios solo se hacen en el detalle.
- Publicaciones sin recuadro y casi a pantalla completa; la barra oscura "Ver detalles" va sobre la imagen.
- Stories: un círculo por persona con su foto de perfil y un número si tiene varias; se reproducen en orden (fotos 6 s, videos hasta el final). "Tu story" abre la cámara directo (máx. 30 s, calidad media para no pasar 50 MB); el botón + de reseñas sigue usando la galería.
- Se quitaron el atajo de guardados junto a la campana (siguen en Perfil → Guardados) y los textos sobre el feed.

**Pendientes nuevos:**
- Al eliminar una cuenta no se borra su foto de perfil (bucket `avatars`): arreglar antes de publicar.
- Los scripts `supabase/verify_*.sql` no cubren `post_tomatoes` ni `avatars`.
- Reseñas de ejemplo (Ana, Luis, Mar) ya no llevan aviso de "ejemplos ficticios" en el feed: decidir si se quitan antes de publicar.
- La foto de perfil aún no se ve en las tarjetas del feed, en Mensajes ni en los resultados de búsqueda de personas.

## 12. Publicar, ubicación y cámara (actualizado 2026-10-07)

**Flujo de publicar una reseña (sin fricción):** el **+** abre la galería directo; al elegir, la foto queda a pantalla completa y se avanza por pasos: 1) título (+ categoría), 2) tu recomendación (opcional), 3) mapa para elegir el lugar (**obligatorio**; el botón del mapa dice "Publicar"), 4) subida con progreso y reintento. Código en `components/ReviewFlow.tsx`.
**Stories:** "Tu story" abre una cámara propia (`StoryCamera.native.tsx`): foto o video de hasta 30 s (H.264, 4 Mbps), galería abajo a la izquierda, cambiar de cámara abajo a la derecha. Con algo ya elegido se ve a pantalla completa y solo se puede cancelar o publicar. En la web se elige un archivo.
**Ubicación:** es la del LUGAR que la persona elige en un mapa (OpenStreetMap + búsqueda Nominatim, dentro de un WebView/iframe con Leaflet), no la del teléfono; no se pide permiso de ubicación. Se guarda en `posts.lat` y `posts.lng` con 6 decimales.
- Migraciones nuevas, aplicadas **solo en pruebas**: `015_post_location.sql` y `016_post_location_precision.sql` (se aplican en orden; 016 sube la precisión de 2 a 6 decimales). Hay que correrlas en producción, con confirmación del dueño, **antes de publicar**.
- Dependencias nuevas: `expo-camera`, `react-native-webview` (ya en `package.json`). `app.json` lleva los textos de permisos de cámara y micrófono.
- Pendiente de privacidad: la ubicación de cada reseña es pública con el resto de sus datos y el aviso de privacidad aún no la menciona; revisar con un abogado antes de publicar. OpenStreetMap/Nominatim tienen límites de uso razonable: para mucho tráfico habrá que pasar a un servicio de pago.
- El 10% de "cerca de ti" del feed ya tiene dónde apoyarse (hay coordenadas), pero no está programado.
- Sin probar en iPhone: el mapa dentro del flujo, la cámara propia y la subida de video grabado.

## 13. Publicaciones con varias fotos y videos (actualizado 2026-10-07)

Una reseña puede tener hasta 10 archivos (fotos y videos mezclados). La primera sigue siendo `posts.media_path` (portada); del 2 al 10 van en `post_media`. En la galería se eligen varias a la vez (el orden de selección es el orden de la publicación) y se deslizan a la derecha con contador "1/5" (`components/MediaPager.tsx`). Las stories siguen siendo de un archivo.
- Migración `supabase/017_multi_media.sql`: tabla `post_media` con RLS, lectura de archivos extra en Storage, y cambios en tres funciones de seguridad: `reported_media` (moderadores ven los extras), `own_content_file_deleting` y `content_management` (al borrar una publicación se retiran también sus extras; `begin` devuelve `files`). **Aplicada solo en pruebas.** En producción correrla con confirmación del dueño y ANTES de publicar, después de 013 a 016.
- La subida (`publishPostMany` en `lib/posts.ts`) es reintentable: cada archivo se sube una vez, la publicación se crea una vez y los extras se guardan sin duplicar. Si `post_media` no existe o falla, el feed muestra solo la portada.
- **Sin probar:** borrar una publicación con varios archivos (comprobar que no queden archivos en Storage), y la subida desde iPhone.
- Pendientes: el panel de moderación solo muestra la portada como vista previa; no hay tope de peso total por publicación (10 videos de 50 MB = 500 MB); la selección no se puede editar después de elegirla.
- Orden de migraciones para producción: 013, 014, 015, 016, 017 (y 018, que es inofensiva allí porque 017 ya trae su corrección). 018 existe solo porque la primera versión de 017, aplicada en pruebas, tenía una recursión infinita en la política de post_media. Verificado en pruebas el 2026-10-07: se guardan portada y extras.

## 14. Shorts, detalle simple y dirección (actualizado 2026-10-07)

**Concepto de producto:** Inicio muestra TODAS las publicaciones (fotos, videos o ambos). La pestaña Videos es solo para **shorts** (estilo TikTok, un video por pantalla, deslizar hacia arriba).
- Un short es una publicación normal con `posts.is_short=true` y siempre un solo video (migración `019_shorts.sql`); reutiliza reportes, bloqueos, moderación, borrado, corazones, tomates y comentarios. Se sube desde el botón "Subir short" de esa pestaña: video de la galería + título + categoría, sin recomendación ni mapa. Código: `components/ShortsFeed.tsx`, `startShort` en `App.tsx`, modo `short` de `ReviewFlow`.
- **Pendiente, decidido:** herramienta que arma un short de ~40 s a partir de varios clips, como **lista de clips sin procesar** (la app los reproduce uno tras otro; no genera un archivo único). Falta diseñar recortes y audio. Una versión con video real unido en servidor quedó descartada por ahora (costo y servicio externo).
- Pendientes de shorts: botón de silenciar; en la web arrancan sin sonido; el perfil aún muestra todo junto en sus pestañas Fotos/Videos; el feed de Inicio y el de shorts comparten el límite de 60 publicaciones por consulta.

**Detalle de una publicación (simple):** solo título, detalles y dirección. Guardar y compartir viven en la tarjeta. Los **comentarios ya no tienen ninguna pantalla** (código en `components/Comments.tsx` sin usar) y el botón de comentarios de los shorts abre ese mismo detalle: decidir pronto dónde viven. Editar/eliminar la propia, reportar y bloquear siguen disponibles detrás de "Más opciones" en el detalle (las tiendas exigen reportar, bloquear y borrar).
**Dirección:** se guarda al elegir el lugar en el mapa (`posts.address`, migración `020_post_address.sql`; viene de la búsqueda de OpenStreetMap o de una geocodificación inversa al tocar el mapa). Las reseñas anteriores no la tienen.

**Orden de migraciones para producción (todas con confirmación del dueño, antes de publicar):** 013, 014, 015, 016, 017 (018 opcional), 019, 020.

## 15. Las reseñas no se editan (actualizado 2026-10-07)

**Decisión de producto:** una reseña no se puede editar, para que lo que la gente vio y calificó (corazones, tomates) no cambie después, y para que una publicación reportada no se pueda "arreglar" y evadir moderación. Para corregir algo se **elimina y se publica una nueva** (se pierden sus corazones, tomates y comentarios).
- Migración `supabase/021_no_editing.sql`: quita el permiso de ejecutar `edit_own_review` (verificado en pruebas: responde "permission denied for function"). Los usuarios no tienen UPDATE directo sobre `posts`, así que no queda ninguna vía de edición. Eliminar sigue igual (`content_management`).
- En la app, `ContentEditor` (`components/OwnContent.tsx`) quedó solo para eliminar; en el detalle el enlace dice "Eliminar mi reseña". El código de `editOwnReview` / `edit_own_review` sigue en el repositorio sin usarse.
- **Pendiente:** `supabase/verify_own_content.sql` y `tests/ownContent.test.mts` aún prueban la edición y fallarán; actualizarlos antes de publicar. Las erratas ya no se pueden corregir.
- En el mapa, el botón Publicar espera hasta 4.5 s a que llegue la dirección (la geocodificación inversa tarda ~1 s); antes una reseña publicada de inmediato quedaba sin dirección.

**Orden de migraciones para producción (todas con confirmación del dueño, antes de publicar):** 013, 014, 015, 016, 017 (018 opcional), 019, 020, 021.

## 16. Perfil: mapa de estados reseñados e iconos (actualizado 2026-10-07)

- **Tarjeta "ESTADOS RESEÑADOS"** bajo la cabecera de cada perfil (`components/StatesMapCard.tsx`): mapa del mundo en negro con los estados/provincias donde la persona publicó al menos una reseña con ubicación, pintados de lima, y el número. Mide "reseñó", no "estuvo" (se puede reseñar un lugar desde casa). Reseñas anteriores sin ubicación y shorts no cuentan. Sin migración: usa `posts.lat` y `posts.lng`, ya públicos (`loadVisitedPoints` en `lib/posts.ts`).
- **Mapa:** `assets/regions.json` (1.9 MB, 4,242 regiones de 241 países) sale de Natural Earth admin-1 a 10 m (dominio público, sin obligación de crédito, pero conviene mencionarlo en los créditos). Se simplificó con Douglas-Peucker (tolerancia 0.04°, 2 decimales, islas menores de 0.12° descartadas salvo la mayor de cada región); se perdieron 354 regiones diminutas (sobre todo municipios de países pequeños). Se regenera con `scripts/RegionsBuilder.cs` desde PowerShell 5.1: `Add-Type -Path scripts/RegionsBuilder.cs -ReferencedAssemblies System.Web.Extensions; [RegionsBuilder]::Build(entrada.geojson, salida.json, 0.04, 2, 0.12)`.
- El dibujo y la asignación punto→estado ocurren dentro de un canvas (WebView/iframe, sin red) en `lib/regionsMapHtml.ts`. Si un punto queda fuera de todo contorno por la simplificación, se asigna el estado más cercano (máx. ~35 km). Sin probar en iPhone (peso/velocidad del WebView). El mapa es fijo, sin zoom ni toques.
- **Pestañas del perfil** (fotos, videos, guardados): solo iconos. Siguen mezclando todo; falta decidir cómo se separan reseñas y shorts en el perfil.
- **Notificaciones:** el panel va directo a la lista (sin título, contador, botón de recargar ni notas); "Marcar todas como leídas" solo aparece si hay sin leer.

## 17. Comentarios, totales del perfil y dónde se publica (actualizado 2026-10-07)

- **Comentarios estilo TikTok** (`components/CommentsSheet.tsx`): hoja que sube desde abajo (~72% de la pantalla), lo más nuevo arriba, caja para escribir fija abajo. Se abre desde el botón de comentarios de los shorts y del icono de comentarios de las tarjetas de Inicio. Cada comentario tiene corazón y tomate (una reacción por persona; se guarda con insert/update de `kind`, no con upsert, porque solo hay permiso de UPDATE sobre esa columna) y "Responder". Respuestas en **dos niveles** (una respuesta no puede tener respuestas; si respondes a una respuesta queda en el mismo hilo con "@Nombre "); si se borra el principal, su hilo se oculta. Hasta 200 comentarios por publicación. Reportar abre el formulario de reporte y cierra la hoja; el "⋯" de los shorts abre el detalle (reportar/bloquear/eliminar).
- Migración `supabase/022_comment_threads.sql`: `comments.parent_id` + trigger que valida el padre, tabla `comment_reactions` (PK user_id+comment_id) con RLS y vista pública `comment_stats`. **Aplicada solo en pruebas.** Pendientes: responder no avisa a quien recibe la respuesta (solo a la persona autora de la publicación); sin foto de quien comenta; reacciones a comentarios sin verificar con una sesión real tras el arreglo del guardado.
- **Perfil:** la fila de números muestra publicaciones, siguiendo (solo el propio), ♥ y 🍅 recibidos por todas sus publicaciones (`loadReceivedReactions`: suma `post_stats` de hasta 300 publicaciones; sin migración). "Guardados" ya no es una cifra. La tarjeta del mapa de estados muestra "N / total" y, al abrirla, el avance por país (México 3/32…).
- **Dónde se publica cada cosa:** story desde "Tu story" (cámara), short desde "Subir short" en Videos, reseña desde el botón + del perfil propio (junto a las pestañas de iconos). Se quitó el + de la barra de arriba.

- Visor de stories estilo Instagram (`components/StoryViewer.tsx`): toque derecha = siguiente, izquierda = anterior, mantener presionado = pausa; la cola pasa de una persona a la siguiente. Pendiente confirmar en iPhone.
- Revisión de ChatGPT (4 puntos, todos ciertos y corregidos): enlace compartido de video abre Inicio; el mapa invalida respuestas de dirección atrasadas (`geoToken`); `useShot` renombrado `acceptShot`; errores de TypeScript resueltos.
- Migración `supabase/023_account_deletion_avatars.sql`: el borrado de cuenta ahora también retira la foto de perfil (bucket `avatars`); `lib/accountDeletion.ts` la borra. **Pendiente de aplicar en pruebas** y probar el borrado con una cuenta que tenga foto.

- Selector de mapa (`lib/mapHtml.ts`) rediseñado: MapLibre GL + mapas gratuitos de OpenFreeMap (vectorial; el estilo Voyager de CARTO exige llave y se descartó), barra de búsqueda tipo píldora con resultados en tarjetas (título + dirección), pin propio arrastrable y nombre del lugar en el pie. Búsqueda solo al pulsar Enter/lupa (la política de Nominatim prohíbe autocompletar al teclear). OpenFreeMap es un servicio comunitario sin garantía: si la app crece, contratar proveedor. Verificado en navegador; **sin probar en el WebView del iPhone** (necesita WebGL).
- **Versión web para probadores (Netlify):** `.env` apunta a PRODUCCIÓN y `.env.local` a PRUEBAS. Un `expo export` normal mezcló ambos (la caché de Metro dejó el cliente de Supabase en producción y el login falló con «No se pudo cargar tu perfil», porque producción no tiene las migraciones 013–024). Para una build de pruebas: cargar las variables `EXPO_PUBLIC_*` de `.env.local` en el entorno del proceso y exportar con `--clear`, y **comprobar que el bundle contiene solo el proyecto `hyxesmrjxvuftkfqsffe` y no `bxsllqteuafbusruspqd`**. Salida en `dist/web-publish`; se zipea con rutas `/` (no usar Compress-Archive de PowerShell 5.1: pone `\`).
- **Editor de stories (texto y emojis, v1):** antes de publicar, la story permite agregar texto (Aa, 6 colores, editar al tocar un texto ya seleccionado) y emojis (lista fija de 40), arrastrarlos, cambiar tamaño (− / +) y quitarlos. Se guardan como lista JSON en `stories.overlays` (migración `supabase/025_story_overlays.sql`, **aplicar en pruebas antes de usarlo; sin la columna fallan las cargas de stories**), con posiciones y tamaños relativos al ancho/alto de la pantalla; el visor los dibuja encima (`StoryOverlayLayer`, solo lectura). Todo lo que llega de la base se limpia con `sanitizeOverlays` (`lib/storyOverlays.ts`). No se queman en el archivo: funciona igual para fotos y videos. Pendiente: probar arrastre y teclado de emoji en iPhone; stickers con imagen, dibujo, rotar/pellizcar.
- **Editor de stories fases 2 y 3:** además del texto y los emojis, ahora hay pellizcar/girar con dos dedos (y botón ↻ de 15° para la web), tipografías (Clásica, Serif, Máquina, Manuscrita), alineación y fondo del texto, **dibujo** (8 colores, 3 grosores, goma, deshacer; trazos de hasta 150 puntos, máx. 40), **filtros** de color (Cálido, Frío, Blanco y negro, Vívido, Desvanecido; capas de color con `mixBlendMode` encima de la foto/video, no se queman en el archivo) y **stickers**: Ubicación (reusa el selector de mapa), Mención (busca personas; **no avisa todavía** a la persona mencionada), Encuesta (2 respuestas, votos en `story_poll_votes`, totales vía `story_poll_counts`), Pregunta (respuestas en `story_answers`; la persona autora las ve con «Ver respuestas»), Cuenta regresiva (presets de 1 h a 1 semana), Hora y «por ahí». Migración `supabase/026_story_stickers.sql` (**aplicar después de la 025, antes de usar el editor**: sube el límite de `overlays` a 120 KB y crea las tablas de votos y respuestas con RLS). Código: `lib/storyOverlays.ts` (tipos y `sanitizeOverlays`), `components/StoryOverlayEditor.tsx`, `StoryOverlayLayer.tsx` (dibuja y arrastra), `StoryOverlaysConnected.tsx` (encuestas/preguntas en el visor), `lib/storyInteractions.ts`. Verificado en navegador (texto, stickers, dibujo, goma, filtro); **sin probar en iPhone**: pellizcar/girar, filtros con mezcla (`mixBlendMode` en iOS), teclado y mapa dentro del editor. Fuera de alcance: GIFs, música, marcador/neón, efectos con cámara, procesar video.
- **CAMBIO DE RUMBO (2026-10-10): app simple de reseñas en video.** Decisión del dueño: la app son perfiles, reseñas (estilo short), reacciones, comentarios y chat (para mandarse reseñas y para mensajes libres). **Se quitan las stories** y los posts de foto como formato aparte. Hecho en la etapa 1 (reversible, no se borró nada en la base): (a) el inicio es un solo feed vertical (`ShortsFeed`) con TODAS las reseñas publicadas (fotos, videos y secuencias de hasta 10), de quienes sigues o lo más reciente; una reseña con varias fotos/videos se reproduce como secuencia (foto 4 s, video hasta el final, vuelve a empezar, barras de progreso arriba); (b) el botón «Nueva reseña» abre el flujo de reseña (título, calificación, recomendación, mapa); (c) ya no se cargan ni se muestran stories (código de stories, editor de texto/stickers/dibujo y migraciones 025/026 se **conservan sin usar** para reusar el editor sobre las reseñas; `newStory`, `StoryViewer`, `StoryOverlay*` siguen en el repo). Pendiente de esta línea: etapa 2 (un solo creador de reseñas con orden de fotos/videos y duración), etapa 3 (reusar el editor de textos y stickers sobre la secuencia), más adelante un `.mp4` real con servidor (costo). Las reseñas de foto antiguas se ven como reseñas de una sola foto.
- **Dirección pública web:** `lib/appOrigin.ts` (hoy `https://por-ahi-ap.pages.dev`, Cloudflare Pages; Netlify se quedó sin créditos). Se usa en links de compartir y en retornos de correo/recuperación/Google; hay que agregarla a las URL permitidas de Supabase (Site URL y Redirect URLs).
- Orden de calificaciones: 5 Imperdible, 4 Volvería, 3 Pasa, 2 Tomatazo, 1 Mejor nada (Mejor nada es la peor).

**Orden de migraciones para producción (todas con confirmación del dueño, antes de publicar):** 013, 014, 015, 016, 017 (018 opcional), 019, 020, 021, 022, 023, 024, 025, 026.

## 18. Opiniones, pasaporte y resumen semanal (2026-10-08)

- `OpinionMeter` muestra solo la barra de corazones/tomates (ya NO calcula niveles por reacciones). La calificación del lugar la elige quien publica (paso 2 de `ReviewFlow`, obligatoria en reseñas, no en shorts): 5 Imperdible, 4 Volvería, 3 Pasa, 2 Tomatazo, 1 Mejor nada, guardada en `posts.rating` (migración `supabase/024_post_rating.sql`, **aplicar antes de usar la app: sin la columna fallan las cargas**; las reseñas viejas quedan sin calificación). Se ve como etiqueta con estrellas en la tarjeta y en el detalle. La tarjeta mide esa reseña; `PlaceOpinion` en el detalle suma las reacciones de las reseñas visibles de la misma dirección, excluyendo shorts. No es un catálogo de lugares ni un conteo de personas únicas. Las consultas completas paginan y respetan RLS; ante error no muestran un total parcial.
- `ReactionAtmosphere`: confeti discreto en los bordes con >=8 reacciones y >=75% corazones; salpicaduras con <=25% corazones. Animación breve, sin bucles, respeta reducir movimiento. Usa `Animated.Value` con `useState` para compatibilidad con react-native-web (no exporta `useAnimatedValue`). Los contadores de otras personas se actualizan al refrescar, sin tiempo real nuevo.
- `ReviewDetails` muestra fecha real `created_at`; afirma «intacta» solo si `version===0`. Se preserva la decisión de no editar reseñas y se evita afirmar que versiones antiguas editadas están intactas.
- Perfil: botón pequeño Pasaporte, sellos por ID de estado/región, y 30 rangos (lista y umbrales en `lib/passport.ts`; de 0 estados «De estreno» hasta 500 «Sin fronteras», p. ej. 5 Mochilero, 10 Cazarrutas, 20 Trotamundos, 50 Cartógrafo callejero, 150 Piloto del mundo). Repetir un estado no suma. El mapa usa todas las reseñas ubicadas del usuario mediante paginación, con cancelación/timeout, en lugar del límite previo de 500.
- Compartir mapa genera PNG 1080×1080 con logo, nombre, @usuario, rango y estados. iOS abre la hoja nativa; web comparte el archivo o descarga. Solo se inicia al tocar el botón; no publica automáticamente. La exportación espera al mapa, valida origen y petición, y usa el nombre/rango actuales.
- `WeeklyRecap` bajo stories en Inicio abre un resumen personal con aspecto de story: últimos 7 días, reseñas, lugares distintos y lugares nuevos comparados con el historial completo. Prioriza dirección; `posts.place` es un título libre, no el nombre canónico del lugar. Excluye shorts y no afirma visitas físicas ni publica una story pública automáticamente.
- Avisos con humor mexicano suave. `expo-haptics` ~57.0.3 y `expo-sharing` ~57.0.22 instalados con Expo CLI; feedback suave después de guardar corazón/tomate en reseñas y comentarios. La web omite haptics. Se limpian comentarios al cambiar de cuenta y su componente se identifica por reseña+usuario.
- Validación: 80 pruebas pasan; TypeScript, lint y export web/iOS JavaScript pasan. QA visual con datos ficticios en ancho393 y PNG del canvas exacto. La ruta temporal de QA se retiró antes de exportar. Pendiente comprobación física de vibración y hoja de compartir en iPhone. No hubo escrituras en Supabase, nuevas migraciones, publicación Netlify, compilación nativa firmada ni envío a tiendas por esta fase.
