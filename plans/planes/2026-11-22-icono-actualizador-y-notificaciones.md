# Plan: ícono completo, actualizador dentro de la app y notificaciones de pedidos (web y app)

Fecha: 2026-11-22 · Estado: en curso · Prompts: `plans/prompts/2026-11-22-icono-actualizador-y-notificaciones.md`
Alcance: app de Android (`~/AndroidStudioProjects/NecutlaMovil`, versión 2.2.0), web (`public/`), servidor (`app/`) y base (`db/mariadb/schema.sql`).

## Context

El usuario pidió tres cosas:

1. **Que no quede confuso el APK en Descargas.** Android no deja que una app borre un archivo que bajó el navegador. El usuario eligió el **actualizador dentro de la app**: las actualizaciones se bajan a la carpeta privada de la app, se instalan y se borran solas. La primera instalación desde la web sí deja `Necutla.apk` en Descargas; al abrir la app por primera vez sale un aviso para borrarlo, con un botón que abre Descargas.
2. **Ícono de la app:** la N y la estrella se salen del área segura del ícono adaptable. Medido sobre `res/drawable-nodpi/icono_frente.png` (512×512, fondo `--tinta` incluido): el logo ocupa de x 128 a 378 y de y 88 a 386, y sus esquinas quedan a 178 px del centro, cuando el círculo seguro (66/108) mide 156. La pantalla de arranque usa el mismo dibujo (`windowSplashScreenAnimatedIcon`).
3. **Notificaciones de pedidos** en la web y en la app, aunque estén cerradas. Elecciones del usuario: Web Push en la web (sin servicios de pago) y **Firebase Cloud Messaging** en la app. Avisos: **cambio de estado**, **nota del vendedor**, **cambio de artículos** (al cliente) y **pedido nuevo** (a los dueños y encargados de esa tienda).

Lo que ya hay en el código:
- `PUT /api/admin/pedidos/:id` (estado y nota) y `PUT /api/admin/pedidos/:id/items` en `app/pedidos.php`. `POST /api/pedidos` crea el pedido con `cliente_id`. `POST /api/admin/pedidos/cancelar-viejos` cancela en lote, y ahí no se avisa.
- Encargados por tienda en `admin_stands`; `puede_editar_stand()` en `app/auth.php`.
- `app/captcha.php` ya llama a HTTPS con `curl` (y respaldo): ese patrón sirve para Web Push y FCM.
- PHP 8.5 tiene `openssl` y `sodium`: alcanza para cifrar Web Push (RFC 8291: ECDH P-256, HKDF y AES-128-GCM), firmar VAPID (RFC 8292, ES256) y el JWT de la cuenta de servicio de FCM (RS256). No hace falta Composer.
- La app ya revisa `public/app/version.json` (`AvisoVersionNueva` en `ui/App.kt`) y tiene `Red.cliente` (OkHttp).

Reglas que aplican: sin emojis en los textos de las notificaciones (son interfaz); permiso de notificaciones solo después de que el usuario toque un botón; secretos solo en `app/config.php`; `schema.sql` idempotente; cada cambio con APK nuevo (2.2.0); subir a IONOS solo con permiso.

## Prompts (en orden)

**0. Guardar el plan.** Copiar este plan a `plans/planes/2026-11-22-icono-actualizador-y-notificaciones.md` y escribir sus prompts en `plans/prompts/` con el mismo nombre (cada uno empieza pidiendo leer `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan). Agregarlo a `plans/MEMORIA.md`.

**1. Ícono completo.** Con PIL: quitar el fondo `--tinta` de `icono_frente.png`, escalar solo el logo al 80 % alrededor de su centro (esquinas a unos 142 px, dentro del círculo de 156) y volver a ponerlo sobre el mismo fondo, en 512×512. `drawable/icono_mono.xml`: envolver sus `path` en un `<group>` con `scaleX`/`scaleY` 0.8 y pivote 256. Revisar que el arranque y el ícono monocromo (Android 13+) se vean completos. Mostrar al usuario el antes y el después (círculo, cuadrado redondeado y gota) antes de compilar. "Solo un poco": si al 80 % se ve chico, probar 84 %.

**2. Actualizador dentro de la app.** Leer antes la documentación oficial de Android sobre `PackageInstaller` y `REQUEST_INSTALL_PACKAGES`.
- `AvisoVersionNueva`: "Actualizar ahora" baja `necutla-android.apk` con `Red.cliente` a `cacheDir/actualizacion/` mostrando el progreso, revisa el SHA-256 y el tamaño contra `version.json` (si no coinciden: "La descarga llegó incompleta. Inténtalo de nuevo.") e instala con una sesión de `PackageInstaller`. Si Android pide permiso para "instalar apps desconocidas", lleva a ese ajuste (`ACTION_MANAGE_UNKNOWN_APP_SOURCES`) con un texto que explique por qué.
- El archivo se borra al terminar la instalación (receptor de `MY_PACKAGE_REPLACED` y, además, al abrir la app). Nunca se guarda en Descargas.
- Primera vez que se abre la app instalada desde la web: una hoja "Ya puedes borrar Necutla.apk" con "Abrir Descargas" (`DownloadManager.ACTION_VIEW_DOWNLOADS`) y "Listo". Sale una sola vez.
- Web (`public/index.html`, sección "Necutla en tu celular"): una línea que diga "Después, la app se actualiza sola".

**3. Servidor: base y envío de notificaciones.**
- `db/mariadb/schema.sql`: tabla `notificaciones_destinos` (id, `cliente_id` o `admin_id`, `tipo` `web`|`fcm`, `endpoint` o token, `p256dh`, `auth`, `creado_en`, `usado_en`; índice único por endpoint) con `IF NOT EXISTS`; correrla en la base local.
- `app/notificaciones.php` (nuevo):
  - `enviar_web_push()`: cifrado aes128gcm y VAPID, con `curl` como en `captcha.php`. Se prueba con el ejemplo del RFC 8291 (llaves y resultado conocidos).
  - `enviar_fcm()`: HTTP v1 con token OAuth de la cuenta de servicio (JWT RS256), guardado en caché hasta que caduque.
  - `avisar_cliente($pedidoId, $tipo)` y `avisar_tienda($pedidoId)`.
  - Los destinos que devuelven 404 o 410 se borran.
  - Se manda después de responder (`fastcgi_finish_request()` si existe), con 5 s de límite por envío. Un fallo no rompe el pedido; queda en el `error_log`.
- `app/pedidos.php`: cambio de estado, nota nueva o cambiada y artículos cambiados avisan al cliente (si el pedido tiene `cliente_id`); `POST /api/pedidos` avisa a los dueños y a los encargados de esa tienda (`admin_stands`). "Cancelar viejos" no avisa.
- Rutas: `POST /api/notificaciones/suscribir` y `POST /api/notificaciones/quitar` (con sesión de cliente o de admin, validando cada campo y su largo), y `GET /api/notificaciones/llave` (la llave pública VAPID).
- `scripts/crear-vapid.php`: genera el par de llaves y lo imprime una sola vez para pegarlo en `app/config.php`. Opciones nuevas `web_push` y `fcm` (`proyecto`, ruta del JSON de la cuenta de servicio fuera de `public/`, permisos 600), documentadas en `app/config.ejemplo.php` y `README.md`.
- Textos:

  | Aviso | Texto |
  |---|---|
  | Estado | "Tu pedido #123 de Tecnología ya está pagado" / "fue cancelado" / "volvió a estar en proceso" |
  | Nota | "Tecnología te dejó una nota en tu pedido #123", con la nota recortada a 120 caracteres |
  | Artículos | "Tecnología ajustó las piezas de tu pedido #123" |
  | Pedido nuevo | "Pedido nuevo #124 en Tecnología: 3 piezas, $150.00" |

  Al tocarlos: cliente a Mis pedidos; vendedor a Necutools, Pedidos.

**4. Web: Web Push.**
- `public/sw.js` (service worker en la raíz: solo `push` y `notificationclick`, sin caché).
- En `public/js/comun.js`, `activarAvisos()` y `quitarAvisos()`. Piden permiso solo al tocar el botón; si el navegador no lo permite o fue rechazado, explican cómo activarlo en sus ajustes.
- Botones:
  - Mi cuenta, Mis pedidos: "Avisarme cuando cambie mi pedido", y luego "Avisos activados en este navegador" con "Desactivar".
  - Carrito, después de enviar el pedido por WhatsApp: una tarjeta que invita a activarlos.
  - Necutools, Mi cuenta: "Avisarme de pedidos nuevos".
- `public/.htaccess`: `sw.js` con `no-cache` y `Service-Worker-Allowed: /`, y `worker-src 'self'` en la CSP.
- En iPhone solo funciona con Necutla agregada a la pantalla de inicio: decirlo junto al botón cuando sea iPhone.
- Actualizar `public/privacidad.html` (notificaciones, servicios de push del navegador y Google Firebase en la app) y su fecha.

**5. Firebase (lo hace el usuario con la guía, y luego se conecta).** Pasos para el usuario:
1. En console.firebase.google.com, crear el proyecto "Necutla" (sin Analytics).
2. Agregar las apps de Android `com.necutla.app` y `com.necutla.app.debug`, y bajar `google-services.json`.
3. En Configuración, Cuentas de servicio, generar una llave privada (JSON).

Claude coloca el JSON de la cuenta de servicio en el servidor, fuera de `public/` y con permisos 600 (sin imprimirlo), y `google-services.json` en `app/` del proyecto Android (sin secretos de servidor). Este prompt espera a que el usuario termine.

**6. App: notificaciones con FCM.**
- `firebase-messaging` (BoM) y el plugin de Google Services, en la versión estable de la documentación oficial.
- `AvisosFcm : FirebaseMessagingService` con dos canales: "Mis pedidos" y "Pedidos de mi tienda".
- Permiso `POST_NOTIFICATIONS` (Android 13+), pedido después de enviar un pedido o desde el botón en Mis pedidos y en Necutools.
- El token se registra al entrar como cliente o admin (`POST /api/notificaciones/suscribir`, tipo `fcm`) y se quita al cerrar sesión o al refrescarse.
- Al tocar la notificación se abre Mis pedidos o Necutools, Pedidos (enlaces internos de navegación).
- Icono pequeño de notificación: la N monocroma.

**7. Pruebas, versión y subida.**
- `scripts/seguridad/ataques.js`: pruebas "NOT" (suscribir sin sesión 401, campos inválidos 400, no se puede quitar un destino ajeno, `no-store`).
- Web Push real en el Chrome del usuario (en Chrome sin ventana no hay servicio de push): pedido de prueba, cambiar estado y nota en Necutools, y ver los avisos.
- App en el emulador (imagen `google_apis` con servicios de Google): token, permiso, aviso con la app cerrada, al tocarlo abre Mis pedidos, y actualizar desde la 2.1.1 con el actualizador nuevo.
- App 2.2.0 (`versionCode` 5), APK en el escritorio y en `public/app/`.
- Correr `schema.sql` en IONOS antes del código, `config.php` del servidor (con `require` y `var_export`, sin imprimir nada), subir con permiso, `plans/MEMORIA.md` y commits.

## Archivos principales

- App: `res/drawable-nodpi/icono_frente.png`, `res/drawable/icono_mono.xml`, `ui/App.kt` (`AvisoVersionNueva`), `data/Actualizador.kt` (nuevo), `AvisosFcm.kt` (nuevo), `AndroidManifest.xml`, `build.gradle.kts`, `gradle/libs.versions.toml`, `ui/pantallas/CuentaP.kt`, `ui/pantallas/CarritoP.kt`, `ui/necutools/NtMas.kt`.
- Servidor: `app/notificaciones.php` (nuevo), `app/pedidos.php`, `app/arranque.php` (cargarlo), `app/config.ejemplo.php`, `scripts/crear-vapid.php`, `db/mariadb/schema.sql`.
- Web: `public/sw.js`, `public/js/comun.js`, `public/js/cuenta.js`, `public/js/carrito.js`, `public/js/necutools.js`, `public/cuenta.html`, `public/necutools.html`, `public/.htaccess`, `public/privacidad.html`, `public/index.html`, `README.md`.

## Verificación

- Cifrado de Web Push contra el ejemplo del RFC 8291 (prueba unitaria en PHP 8.5); firma VAPID y JWT de FCM verificadas con `openssl_verify`.
- Local: rutas con `ataques.js`; envío simulado (un servidor de prueba en la carpeta temporal que recibe el POST) para revisar los encabezados y que los 404 o 410 borren el destino.
- Chrome del usuario: avisos reales en compu y celular. Emulador: FCM real con la app cerrada y abierta, permisos, canales, enlace al tocar, y actualizador (descarga, SHA-256, instalación y borrado del archivo).
- Web a 1280, 360 y movimiento reducido: sin scroll horizontal, CLS menor a 0.02, sin errores de consola ni de CSP.

## Lo que no hace este plan

- Avisos por correo (el SMTP ya existe; se puede agregar después).
- Notificaciones en el WebView de la app (la app es nativa; usa FCM).
- Publicar en Google Play.
