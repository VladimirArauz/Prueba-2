# Prompts: errores al activar avisos y permisos al abrir (web y app)

Plan: `plans/planes/2026-11-25-avisos-errores-y-permisos-al-inicio.md`. Se corren en orden, uno por sesión o seguidos.

---

## Prompt 1: errores de la transición y mensajes de Web Push

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y `plans/planes/2026-11-25-avisos-errores-y-permisos-al-inicio.md` (parte A).

1. En `public/js/comun.js`, listener `pagereveal`: si existe `event.viewTransition`, agrega `catch(() => {})` a `ready`, `finished` y `updateCallbackDone` **antes** de cualquier `return`, para que una transición cancelada ("ViewTransition opt-in disabled") no deje `Uncaught (in promise)` en ninguna página. Lo de la tarjeta nombrada sigue igual.
2. Crea `mensajeErrorAvisos(e)` y úsala en `activarAvisos()`, envolviendo `serviceWorker.register`, `ready` y `pushManager.subscribe`. Textos en español, sin disculpas, que digan cómo arreglarlo:
   - En Brave (`navigator.brave && await navigator.brave.isBrave()`) o con `AbortError` / "push service": que active en `brave://settings/privacy` la opción de servicios de Google para mensajes push y vuelva a cargar.
   - Con `NotAllowedError`: el texto de "bloqueado" que ya existe.
   - Cualquier otro error: uno genérico con "vuelve a cargar e inténtalo de nuevo".
   Los mensajes de error de `api()` (los del servidor) salen como están.
3. En `pintarAvisos()`, si el navegador es Brave y el estado es "inactivo", el texto de la caja avisa del ajuste antes de tocar el botón.
4. `README.md`: aclara que `beacon.min.js … ERR_BLOCKED_BY_CLIENT` es el bloqueador del navegador con Cloudflare Web Analytics y que no es una falla.
5. Prueba en local con Chrome (Playwright) a 1280, 360 y movimiento reducido:
   - Portada, luego `cuenta.html?sub=pedidos`, luego `/p/<id>` y Atrás: ningún `InvalidStateError` ni error de consola.
   - Con `subscribe` simulado para que lance `AbortError`, sale el texto nuevo.
   - Sin scroll horizontal y con CLS menor a 0.02.
6. Actualiza `plans/MEMORIA.md` (plan "en curso").

---

## Prompt 2: panel de permisos al abrir la web

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan (parte B).

1. `public/js/etiquetas.js`: al decidir las cookies (o al cargar, si ya estaban decididas), lanza `document.dispatchEvent(new Event("necutla:cookies-decididas"))`. No cambies cuándo sale el aviso de cookies (sigue esperando a la fuente).
2. Crea `public/js/permisos.js` y cárgalo con `defer` en las páginas públicas (no en Necutools ni en `app/captcha.html`). Usa la vía más simple: un `<script>` en cada `.html` o una inyección en `app/paginas.php` como `con_tag_manager`.
   - Sale solo si `avisosPosibles()`, `Notification.permission === "default"`, no existe `localStorage.necutla_permisos` y ya se decidieron las cookies. Nunca al mismo tiempo que el aviso de cookies.
   - Es una tarjeta fija abajo con el estilo de `.aviso-cookies`, con tokens y clases que ya existen. Si hace falta una clase nueva, va en `style.css` con los mismos tokens, sin `style=` en línea ni JS en línea.
   - Lleva un h2 "Permisos de Necutla", un texto que diga para qué son las notificaciones y 2 botones: "Permitir notificaciones" (`.btn`, icono `bell`) y "Ahora no" (`.btn ghost`).
3. "Permitir notificaciones" llama `Notification.requestPermission()` dentro del clic:
   - Si da `granted`: registra `/sw.js`. Si hay sesión de cliente, llama `activarAvisos("cliente")`; si no, guarda `necutla_avisos_pendiente=cliente` y avisa con un toast: "Listo. Te avisaremos de tus pedidos cuando entres a tu cuenta."
   - Guarda `necutla_permisos` como `si`, `no` o `despues`. Los errores pasan por `mensajeErrorAvisos`.
4. `public/js/cuenta.js`: con sesión, si `necutla_avisos_pendiente` existe y el permiso es `granted`, llama `activarAvisos("cliente")` sin preguntar, borra la marca y vuelve a pintar las cajas.
5. Revisa que `public/privacidad.html` siga diciendo la verdad sobre los avisos. Agrega el panel a `README.md`.
6. Prueba en local (Playwright con Chrome) a 1280, 360 y movimiento reducido:
   - El panel sale después de decidir las cookies y una sola vez.
   - "Ahora no" no vuelve a mostrarlo.
   - Con `grant_permissions(["notifications"])` y sin sesión, queda la marca; al entrar con un cliente temporal se crea la fila en `notificaciones_destinos`. Simula la suscripción si Chrome sin ventana no tiene servicio de push.
   - Con el permiso negado, el panel no sale.
   - En iPhone simulado, el panel no sale.
   - Sin scroll horizontal, con CLS menor a 0.02 y sin errores de consola ni de CSP.
   - Corre `ataques.js` completo y borra lo que creen las pruebas.
7. Actualiza `plans/MEMORIA.md`.

---

## Prompt 3: hoja de permisos al abrir la app y versión 2.4.0

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan (parte C). El proyecto está en `~/AndroidStudioProjects/NecutlaMovil`; compila con `JAVA_HOME=/opt/android-studio/jbr`.

1. `ui/App.kt`: crea `HojaPermisos()` (ModalBottomSheet con el estilo de `AvisoBorrarApk`). Sale una sola vez (`SharedPreferences "avisos"`, `permisos_vistos`), después de `AvisoBorrarApk` y nunca a la vez. Lleva 2 filas, y cada una dice para qué es y muestra "Permitido" con icono `check` cuando ya se dio:
   - Notificaciones: `RequestPermission(POST_NOTIFICATIONS)` en Android 13 o más nuevo. Si se niega, ofrece abrir los ajustes de notificaciones (el intent de `AvisosUi.kt`).
   - Instalar actualizaciones: `Actualizador.abrirPermiso(ctx)`. Al volver (`ON_RESUME`), revisa otra vez `Actualizador.puedeInstalar(ctx)`.
   - Abajo, "Continuar" (fantasma).
2. `data/AvisosPush.kt`: guarda si la persona aceptó los avisos en la hoja. Al iniciar sesión de cliente, o de admin en Necutools, con las notificaciones permitidas, llama `AvisosPush.activar(para)` solo. `CajaAvisos` y el cierre de sesión quedan igual.
3. Versión **2.4.0** (`versionCode` 8), firmada con la misma llave (`apksigner verify`). El APK va a `~/Escritorio/Versiones Necutla Movil/Android/Necutla-2.4.0.apk`, sin borrar los anteriores, y a `public/app/necutla-android.apk`, con `public/app/version.json` (tamaño y SHA-256).
4. Prueba en el emulador `necutla` (detén Gradle antes, `./gradlew --stop`):
   - Con la app instalada desde cero, la hoja sale, pide el permiso del sistema y abre el ajuste de instalar; al volver se ve "Permitido".
   - Al iniciar sesión, el FID queda en la base local sin tocar la caja.
   - Con "Quitar animaciones", la hoja sigue funcionando.
   - Actualizar encima de la 2.3.1 funciona.
5. Actualiza `plans/MEMORIA.md`.

---

## Prompt 4: subir a IONOS

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan. **Pide permiso al usuario antes de subir.**

1. Lista los archivos que cambiaron desde el último commit subido y compara por SHA-256 que el servidor tenga la versión anterior.
2. Haz un respaldo en `~/necutla/respaldos/2026-11-25-permisos/antes.tar` (permisos 600). Lee las credenciales a variables con `sshpass -e`, sin imprimirlas.
3. Sube por rsync a `~/necutla/` y comprueba que los archivos quedaron idénticos. No hay cambios en la base.
4. Revisa en vivo:
   - Con `curl`: `/healthz`, `version.json` 2.4.0 y SHA-256 del APK igual.
   - En Chrome a 1280, 360 y movimiento reducido: el panel sale después del aviso de cookies; sin `InvalidStateError` ni errores de CSP; nada va a Google sin aceptar las cookies.
   - Lo que pide sesión lo prueba el usuario (Turnstile).
5. Pídele al usuario que, en Brave, active la opción de servicios de Google para mensajes push en `brave://settings/privacy` y pruebe los avisos. Pídele también que instale la 2.4.0 en su teléfono.
6. Cambia el estado del plan a "aplicado" y actualiza `plans/MEMORIA.md`.
