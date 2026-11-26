# Plan: errores al activar avisos y permisos al abrir (web y app)

- **Fecha:** 2026-11-25 · **Estado:** aplicado (prompts 1 a 4; subido a IONOS el 2026-11-25)
- **Prompts:** `plans/prompts/2026-11-25-avisos-errores-y-permisos-al-inicio.md`
- **Alcance:** web (`public/js/comun.js`, `public/js/etiquetas.js` o un archivo nuevo `public/js/permisos.js`, `public/style.css`, `app/paginas.php`, `public/*.html`), app Android (`ui/App.kt`, `ui/AvisosUi.kt`, `data/AvisosPush.kt`, `data/Actualizador.kt`), app 2.4.0, subida a IONOS.

## Contexto

En necutla.com, al tocar "Avisarme cuando cambie mi pedido" en `cuenta.html?sub=pedidos`, la consola mostró dos errores:

1. `beacon.min.js … ERR_BLOCKED_BY_CLIENT`: es el script de Cloudflare Web Analytics (`con_web_analytics`, `app/paginas.php:257`). Lo bloquea el bloqueador del navegador (Brave Shields o una extensión). No es un error de Necutla y no afecta los avisos. Desde la página no se puede quitar ese mensaje de la consola. Se deja igual y se documenta.
2. `Uncaught (in promise) InvalidStateError: Transition was aborted… ViewTransition opt-in disabled`: viene de la transición entre páginas (`@view-transition`, `style.css:5022`). Chrome crea la transición, la cancela al revelar la página y rechaza sus promesas `ready` y `finished`. El listener `pagereveal` (`comun.js:938`) solo atiende esas promesas en `/p/` y `/t/`, así que en `cuenta.html` el rechazo queda sin `catch`. El error no tiene que ver con los avisos, pero ensucia la consola y confunde.
3. **Causa probable de que el aviso no se active:** el usuario usa Brave. Brave trae apagado el servicio de push, y `pushManager.subscribe()` falla con `AbortError: Registration failed - push service error`. Hoy ese error sale tal cual en `avisarError(e.message)` (`comun.js:1058`), en inglés y sin decir cómo arreglarlo.

El usuario también pide que **al abrir por primera vez** la web y la app pidan todos los permisos que se puedan necesitar:
- **Web:** solo usa el permiso de notificaciones. La `Permissions-Policy` bloquea cámara, micrófono y ubicación, y el portapapeles y el selector de archivos no piden permiso.
- **App:** usa `POST_NOTIFICATIONS` (Android 13 o más nuevo) e "Instalar apps desconocidas" (`REQUEST_INSTALL_PACKAGES`, que se activa en Ajustes y que el actualizador necesita). El selector de fotos (`PickVisualMedia`) no pide permiso.

**Límites que el plan respeta:**
- Los navegadores solo muestran el permiso si la persona toca algo. Firefox y Safari lo rechazan sin un toque, y Chrome lo esconde si la página lo pide sola. Por eso la web muestra un panel de bienvenida con un botón, en lugar de abrir el permiso directamente.
- Suscribirse en el servidor pide una sesión (`/api/notificaciones/suscribir` → `dueno_aviso`). Si la persona da el permiso sin sesión, queda anotado y la suscripción se hace sola cuando entra a su cuenta.

## Cambios

### A. Corregir los errores (web)
- `comun.js`, listener `pagereveal`: si llega `event.viewTransition`, siempre se agregan `ready.catch(() => {})`, `finished.catch(() => {})` y `updateCallbackDone.catch(() => {})`, también fuera de `/p/` y `/t/`. Lo de la tarjeta nombrada sigue igual.
- `activarAvisos()`: se agrega un `try` alrededor de `register` y `subscribe`. Los errores pasan por una función nueva, `mensajeErrorAvisos(e)`, que devuelve textos en español con la solución:
  - En Brave (`navigator.brave?.isBrave()`) o con `AbortError` / "push service": "Brave trae apagados los avisos. Abre brave://settings/privacy, activa 'Usar los servicios de Google para mensajes push' y vuelve a cargar."
  - Con `NotAllowedError`: el texto de "bloqueado" que ya existe.
  - Cualquier otro error: "No se pudieron activar los avisos en este navegador. Vuelve a cargar la página e inténtalo de nuevo."
- `pintarAvisos()`: en Brave, el texto de la caja avisa del ajuste antes de que la persona toque el botón.
- `README.md`: una nota que diga que `beacon.min.js` bloqueado por el cliente es normal.

### B. Panel de permisos al abrir (web)
- Archivo nuevo `public/js/permisos.js`, que cargan las páginas públicas con `defer` (no Necutools, que ya tiene su caja en Pedidos). Se incluye con la misma inyección que usa `con_tag_manager` en `app/paginas.php`, o con un `<script>` en cada `.html` público (lo que sea más simple al aplicar).
- Solo sale en la primera visita: si `avisosPosibles()`, `Notification.permission === "default"` y no existe `localStorage.necutla_permisos` (con valor `si`, `no` o `despues`).
- Para que nada se tape, sale **después** de que se resuelve el aviso de cookies: `etiquetas.js` lanza el evento `necutla:cookies-decididas`, y si las cookies ya estaban decididas, el panel sale al cargar.
- Es una `.dialogo` no modal, o una tarjeta fija abajo con el mismo estilo que `.aviso-cookies`, con los tokens y botones que ya existen:
  - h2 "Permisos de Necutla" y el texto "Te avisamos cuando la tienda confirme, pague o cambie tu pedido. Solo pedimos permiso para mandarte notificaciones."
  - Botones: "Permitir notificaciones" (amarillo, icono `bell`) y "Ahora no" (ghost).
- Al tocar "Permitir notificaciones" se llama `Notification.requestPermission()` (el toque de la persona lo permite):
  - Con permiso: se registra `/sw.js` y, si hay sesión de cliente (`sesionCompra()` o `/api/clientes/yo`), `activarAvisos("cliente")` como hoy. Sin sesión, se guarda `necutla_avisos_pendiente=cliente`.
  - Sin permiso: se guarda `no` y no se vuelve a mostrar.
- `cuenta.js`, cuando hay sesión (`render`): si `necutla_avisos_pendiente` existe y el permiso es `granted`, se llama `activarAvisos("cliente")` sin preguntar y se borra la marca. Las cajas de avisos de Mi cuenta, el carrito y Necutools se quedan como están.
- En iPhone fuera de la pantalla de inicio (`estado "no"`), el panel no sale.
- En `privacidad.html` ya están los avisos. Solo se revisa que el texto siga siendo cierto.

### C. Permisos al abrir la app (Android)
- `ui/App.kt`: hoja nueva `HojaPermisos()` (ModalBottomSheet, con el estilo de `AvisoBorrarApk`). Sale una sola vez (`SharedPreferences "avisos"`, `permisos_vistos`), después de `AvisoBorrarApk` y nunca al mismo tiempo. Lleva 2 filas:
  1. **Notificaciones:** botón "Permitir notificaciones", que lanza `RequestPermission(POST_NOTIFICATIONS)` en Android 13 o más nuevo. En versiones anteriores la fila sale como "Listo". Si el permiso se niega, se ofrece "Abrir los ajustes de notificaciones" (el mismo intent de `AvisosUi.kt`).
  2. **Actualizar la app sola:** botón "Permitir instalar actualizaciones", que abre `Actualizador.abrirPermiso(ctx)`. Al volver (`ON_RESUME`), se vuelve a revisar `Actualizador.puedeInstalar(ctx)`.
  - Cada fila muestra "Permitido" con icono `check` cuando ya se dio. El botón final es "Continuar" (fantasma). El texto explica para qué es cada permiso.
- `data/AvisosPush.kt`: marca `avisos_pendiente` (cliente). Al iniciar sesión de cliente, o de admin en Necutools, si las notificaciones están permitidas y la persona las aceptó en la hoja, se llama `AvisosPush.activar(para)` solo (el mismo lugar donde hoy se llama al iniciar sesión). Al cerrar sesión sigue igual, se quitan.
- `CajaAvisos` no cambia: sirve para quien dijo "Ahora no".
- Versión **2.4.0** (`versionCode` 8), con la misma firma. El APK va a `~/Escritorio/Versiones Necutla Movil/Android/Necutla-2.4.0.apk`, `public/app/necutla-android.apk` y `public/app/version.json` (regla vigente).

## Prompts (en `plans/prompts/`, cada uno empieza pidiendo leer `plans/CLAUDE.md` y el plan)
0. (Hecho al crear el plan.) Plan y prompts guardados en `plans/planes/` y `plans/prompts/`.
1. Parte A: errores de transición y mensajes de Web Push (con Brave). Se prueba en local.
2. Parte B: panel de permisos de la web, avisos pendientes al iniciar sesión y que no choque con el aviso de cookies.
3. Parte C: hoja de permisos de la app, activar los avisos solos al iniciar sesión y la 2.4.0. Se prueba en el emulador.
4. Subir a IONOS (con permiso del usuario): respaldo `~/necutla/respaldos/2026-11-25-permisos/antes.tar`, rsync de los archivos que cambiaron, comparación por SHA-256 y revisión en vivo. Después, actualizar `plans/MEMORIA.md` y el estado del plan.

## Verificación
- **Local, Chrome con Playwright a 1280, 360 y movimiento reducido:**
  - Ir de la portada a `cuenta.html?sub=pedidos`, a `/p/<id>` y de regreso, sin `InvalidStateError` en la consola.
  - El panel sale una sola vez y después del aviso de cookies.
  - Con permiso concedido (`context.grant_permissions(["notifications"])`) y sin sesión, se guarda la marca pendiente; al entrar con un cliente temporal se crea una fila en `notificaciones_destinos`.
  - Con el permiso negado, el panel no vuelve a salir.
  - Con `subscribe` simulado para que lance `AbortError`, sale el texto en español.
  - Sin scroll horizontal, con CLS menor a 0.02, y sin el panel en iPhone simulado.
  - `ataques.js` completo.
- **Brave real del usuario:** activar el ajuste de push y confirmar que se activa el aviso. Lo hace el usuario.
- **Emulador (Android 16):** con instalación limpia, la hoja sale, pide el permiso del sistema y abre el ajuste de instalar; al volver se ve "Permitido". Se inicia sesión y el FID queda en la base sin tocar la caja. Con "Quitar animaciones", la hoja sigue funcionando.
- **En vivo:** `curl` de los archivos (SHA-256 iguales) y, en Chrome, sin errores de transición ni de CSP. Lo que pide sesión lo prueba el usuario (Turnstile).
