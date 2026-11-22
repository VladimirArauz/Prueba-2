# Mis pedidos, app nativa de Android y descarga del APK desde la web

- **Fecha:** 2026-11-22
- **Estado:** aplicado
- **Prompts:** `plans/prompts/2026-11-22-app-nativa-mis-pedidos-y-descarga.md`
- **Alcance:** subsección "Mis pedidos" en Mi cuenta (web y API), regla de trabajo "cada cambio también en la app con APK nuevo", app de Android **nativa** (Kotlin + Compose) con todas las funciones del sitio y de Necutools sobre la misma API, y botón "Descargar la app para Android" en el pie de todas las páginas y en la portada, que siempre baja el último APK. **Reemplaza** a `2026-11-22-app-android-studio.md` (la app WebView 1.0.0).

## Contexto

El usuario pidió 4 cosas (2026-11-22):
1. Una sección **Mis pedidos** en Mi cuenta con todos los pedidos del cliente y su estado (en proceso, pagado, cancelado).
2. Una **regla nueva en la memoria**: todo cambio a Necutla se aplica también a la app móvil y genera un APK nuevo, con versión nueva, en `/home/aumf-ubuntu-080704/Escritorio/Versiones Necutla Movil/Android`.
3. Rehacer la app de Android como **app nativa** (no un WebView de la página: no le gustó la 1.0.0), con el diseño del lienzo (`~/Escritorio/Necutla-app-diseno/Android/*.dc.html`, https://claude.ai/artifact/LEtPcm84F9X3f9nwDKJsAU) y **todas** las funciones, incluido Necutools (respuesta del usuario: "Todo de una vez").
4. En la web (solo en la web), un botón **Descargar la app** en el pie de todas las páginas y una sección en la portada, que siempre baje el APK más nuevo. La app avisa sola cuando hay versión nueva.

Decisiones del usuario: Necutools también nativo en este plan ("Todo de una vez"); botón en el pie de todas las páginas y sección en la portada; la app avisa sola de versiones nuevas.

## Entregables al aprobar este plan (antes de cualquier código)

1. `plans/planes/2026-11-22-app-nativa-mis-pedidos-y-descarga.md` con fecha, estado `propuesto`, ruta de prompts y alcance (contenido de este plan, en el formato del proyecto). Dice que **reemplaza** a `2026-11-22-app-android-studio.md`; en ese plan solo se cambia el campo estado a `descartado (reemplazado por 2026-11-22-app-nativa-mis-pedidos-y-descarga.md)`.
2. `plans/prompts/2026-11-22-app-nativa-mis-pedidos-y-descarga.md` con los 10 prompts de abajo; cada uno empieza pidiendo leer `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan.
3. **Regla en la memoria:** archivo `memory/app-movil-con-cada-cambio.md` (tipo `feedback`, con **Why:** y **How to apply:**) y su línea en `MEMORY.md`. En `plans/MEMORIA.md`: fila del plan nuevo en la tabla, entrada en "Cambios hechos" y la regla en "Pendientes" como regla de trabajo vigente (`plans/CLAUDE.md` **no se toca**; si el usuario la quiere ahí, que lo pida).
   - Regla: cada cambio de Necutla (web, API, Necutools) se refleja en la app de Android en la misma tarea; se sube `versionName` (semver: corrección = parche, función = menor) y `versionCode` (+1), se compila `assembleRelease`, se verifica la firma y se guarda `Necutla-X.Y.Z.apk` en `~/Escritorio/Versiones Necutla Movil/Android/` (sin borrar las anteriores). También se actualizan `public/app/necutla-android.apk` y `public/app/version.json`, que suben a IONOS junto con el resto (con permiso, como siempre). Cambios que solo son de la web (como el botón de descarga) no cambian la app.

## Estrategia: misma información en la web y la app

- **Un solo sistema**: la app nativa consume la misma API JSON de `https://necutla.com/api/...` (PHP + MariaDB de IONOS) que usa el JS del sitio. No hay base local: lo que se cambia en Necutools (web o app) se ve al instante en las dos. Es lo que hacen las apps que tienen web y móvil (API única, clientes distintos).
- **Sesión**: OkHttp con `CookieJar` propio que guarda la cookie `__Host-necutla.sid` cifrada con una llave del Android Keystore (AES-GCM) en DataStore. `SameSite=Strict` no aplica a un cliente nativo; `allowBackup=false` sigue.
- **Mismo origen** (`exigir_mismo_origen()` en `app/seguridad.php`): la app manda `Origin: https://necutla.com` en POST/PUT/DELETE y no manda `Sec-Fetch-Site` (vacío se acepta). No hay que cambiar el servidor.
- **Turnstile** (`exigir_captcha()` en `app/captcha.php` revisa `hostname` = `necutla.com` y `action`): Cloudflare no tiene SDK nativo; la app abre una hoja con un WebView en `https://necutla.com/app/captcha.html?accion=<login|registro|pedido|...>` (página nueva, `noindex`, sin JS en línea: `public/js/app-captcha.js` reutiliza `public/js/captcha.js`) que entrega el token por un `@JavascriptInterface` aceptado solo si la URL cargada es esa página. Verificar en la documentación oficial de Turnstile antes de hacerlo.
- **Precios**: igual que la web, el carrito vive en el teléfono (DataStore) y los precios los pone el servidor con `POST /api/carrito/precios`; el pedido se guarda con `POST /api/pedidos` y después se abre WhatsApp con un `Intent` (`https://api.whatsapp.com/send?phone=…&text=…`). El texto del mensaje se porta tal cual de `public/js/comun.js` (`mensajeServicio()`, mensaje del pedido, `textoPlanoWA()`).
- **Fotos**: Coil con la caché HTTP de OkHttp; las fotos ya salen con `?v=<huella>` e `immutable` (plan 2026-11-11), así que la app las guarda un año.
- **Límite de la API**: 300 peticiones cada 15 min por IP; la app comparte IP con la escuela. Se cachean listas en memoria por pantalla y no se repiten peticiones al volver atrás.
- **Enlaces**: `https://necutla.com/t/<slug>` y `/p/<id>` abren la pantalla nativa (App Links con `assetlinks.json`, ya preparado y sin subir).

## Parte 1: Mis pedidos en la web (prompt 1)

- **API** `GET /api/clientes/pedidos` en `app/clientes.php` (dentro de `rutas_clientes()`): `requiere_cliente('Inicia sesión para ver tus pedidos.')`, `Cache-Control: no-store`, SQL con `?` sobre `pedidos WHERE cliente_id = ? ORDER BY creado_en DESC, id DESC LIMIT 50` con paginación `?antes=<id>` (usa el índice `pedidos_cliente_fecha_idx`, ya existe; **sin cambios en la base**). Por pedido: `id`, `tienda` (o `paquete`), `estado`, `total`, `piezas`, `creado_en` (`fecha_iso`) y líneas `{nombre, cantidad, subtotal, color}` (tomar de `lineas_de_pedidos()` de `app/pedidos.php`, quitando `stock`, `falta_color` y `contenido` de stock). **No** se devuelven `nota` (es del vendedor), `huella` ni datos de otros. Reusar `UNIR_PEDIDO` / `COLUMNAS_PEDIDO`.
- **Web**: botón de subsección "Mis pedidos" en `public/cuenta.html:305` (`data-grupo="mi-cuenta" data-sub="pedidos"`, se reusa `mostrarSubseccion` de `comun.js`) y un `div.subseccion` con la lista. `public/js/cuenta.js`: cargar al abrir la subsección (evento `subseccion`), tarjetas `.card` con número de pedido, tienda, fecha local, líneas, total `tabular-nums` y estado como texto + chip ("En proceso", "Pagado", "Cancelado"; reusar las clases de estado que ya usa Necutools en `style.css`, sin colores nuevos), todo con `escapeHTML`. Estado vacío: "Todavía no tienes pedidos." + "Explorar las tiendas". "Ver más pedidos" si hay más. Con `cuentas_clientes` en false, la subsección no se muestra.
- `scripts/seguridad/ataques.js`: pruebas "MPD" (sin sesión 401, solo los suyos, sin `nota`, `antes` inválido 400). `README.md`.

## Parte 2: app nativa de Android (prompts 2 a 8)

Proyecto: el mismo `~/AndroidStudioProjects/NecutlaMovil` (mismo `applicationId` `com.necutla.app` y misma llave, para que la 1.0.0 se actualice encima). Versión **2.0.0** (`versionCode` 2).

- **Tecnología** (verificar versiones estables en la documentación oficial de Android al empezar): Kotlin + Jetpack Compose + Material 3, Navigation Compose, OkHttp, kotlinx.serialization, Coil, DataStore. Arquitectura por pantalla: `data/` (cliente HTTP, modelos, repositorios por tema: tiendas, productos, carrito, cuenta, pedidos, admin), `ui/<pantalla>/` (Screen + ViewModel con `StateFlow`), `ui/tema/`. Sin base local.
- **Diseño**: tokens de `plans/CLAUDE.md` en `ui/tema/Colores.kt` (`Tinta`, `Senal`, `Aviso`, `Gis`, `Hoja`, `Linea`, `Texto2`, `Wa`…), Archivo variable empaquetada con eje `wdth` (125/800 títulos, 112/700 h2, 100 resto), botones con borde 2 dp, radio 6 dp, alto 44 dp, sin sombras (elevación 0 en Material), iconos Lucide como vectores, sin emojis (salvo el mensaje de WhatsApp), sentence case. Componentes del lienzo de Android: barra inferior con píldora (Inicio, Buscar, Carrito con contador `--aviso`, Mi cuenta), cajón para tiendas, snackbar como toast, hojas inferiores. Animación solo como respuesta a una acción y respetando "Quitar animaciones" del sistema.
- **Pantallas** (las 8 del lienzo):
  - Inicio (tablero de tiendas `/api/stands`, promociones, vitrina, opiniones `/api/portada/resumen`), Tienda (`/api/stands/:slug`, filtros, carga progresiva de 12 en 12, servicios), Producto (`/api/productos/:id`, carrusel por color, colores, reseñas `/api/productos/:id/resenas`, opinar con captcha), Buscar y promociones (`/api/buscar`, `/api/promociones`).
  - Carrito agrupado por tienda y paquetes, + y − con espera de 350 ms como la web, "Enviar pedido por WhatsApp" (cuenta obligatoria con `puedePedir`), servicios.
  - Mi cuenta: entrar, crear cuenta, código por correo, restablecer, completar cuenta, contraseña, eliminar cuenta y **Mis pedidos** (misma ruta de la parte 1).
  - Necutools: entrar + dos pasos (TOTP), resumen con gráficas dibujadas en Compose (sin librería), pedidos (estado, artículos, nota, cancelar viejos), productos y servicios (catálogo, por resurtir, editar, colores, fotos y carrusel, stock y mínimo), tiendas, ofertas, promociones, opiniones, usuarios, bitácora, mi cuenta y servidor (solo dueños). Mismas rutas `/api/admin/...` y mismos permisos (`requiere_admin()` y encargados por tienda los aplica el servidor). Fotos: selector de fotos de Android (Photo Picker, sin permisos) y mismo formato de envío que `necutools.js`.
- **Errores**: el JSON de error del servidor (`app/http.php`) se muestra tal cual; sin internet, pantalla "Sin conexión" con "Reintentar".
- **Aviso de versión nueva**: al abrir, la app lee `https://necutla.com/app/version.json`; si `versionCode` es mayor, hoja "Hay una versión nueva" con "Descargar la versión nueva" (abre la URL del APK en el navegador; Android pide confirmar). Sin permiso `REQUEST_INSTALL_PACKAGES`.
- **Agente de usuario**: ` NecutlaApp/<versión> (Android)`.

## Parte 3: descarga desde la web (prompt 9)

- `public/app/necutla-android.apk` (nombre fijo = siempre el último) y `public/app/version.json` (`version`, `versionCode`, `tamano`, `sha256`, `fecha`, `minimo_android`).
- `public/.htaccess`: `AddType application/vnd.android.package-archive .apk`, `Content-Disposition: attachment; filename="Necutla.apk"`; `Cache-Control: no-cache` para el APK y `version.json` (siempre la última); `X-Robots-Tag: noindex` en `/app/`.
- Pie de **todas** las páginas (mismo bloque `footer` de las 10-11 páginas): enlace "Descargar la app para Android" con icono Lucide `download` (agregar a `iconos.js` si falta). Portada: sección corta con h2 "Necutla en tu celular", descripción, botón `.btn` "Descargar la app para Android" y la versión y el tamaño leídos de `version.json` (`portada.js`, con `escapeHTML`); dice "Por ahora solo para Android". Sin estilos nuevos fuera de los tokens.
- `README.md`: cómo se publica una versión nueva.

## Prompts (en orden; van en `plans/prompts/2026-11-22-app-nativa-mis-pedidos-y-descarga.md`)

1. **Mis pedidos en la web** (parte 1), pruebas locales con Chrome a 1280, 360 y movimiento reducido, `ataques.js`.
2. **Base de la app nativa**: migrar el proyecto a Compose, tema y tipografía, cliente HTTP (cookies cifradas, `Origin`, errores), Coil, navegación con barra inferior, App Links, hoja de captcha (`public/app/captcha.html` + `public/js/app-captcha.js`), aviso de versión. Compila.
3. **Pantallas de compra**: Inicio, Tienda, Producto, Buscar y promociones.
4. **Carrito y WhatsApp**: carrito, pedido, servicios, mensajes portados de `comun.js`.
5. **Mi cuenta nativa** con Mis pedidos.
6. **Necutools 1**: entrar y dos pasos, resumen, pedidos.
7. **Necutools 2**: productos y servicios (con colores y fotos), tiendas, ofertas, promociones.
8. **Necutools 3**: opiniones, usuarios, bitácora, mi cuenta, servidor. Revisión de todo contra el lienzo y `plans/CLAUDE.md`.
9. **Descarga desde la web** (parte 3); compilar **2.0.0**, `apksigner verify`, copiar `Necutla-2.0.0.apk` al escritorio y a `public/app/`, `version.json` con su SHA-256.
10. **Pruebas finales y subida a IONOS** (pide permiso): respaldo y md5 como siempre (`~/necutla/`, respaldos en `~/necutla/respaldos/`), subir Mis pedidos, `public/app/` y `assetlinks.json`; probar en vivo `GET /api/clientes/pedidos` sin sesión (401), que el APK baja con su tipo y que `version.json` responde. Actualizar `plans/MEMORIA.md`.

Cada prompt termina actualizando `plans/MEMORIA.md` y, si toca la app, subiendo la versión según la regla nueva (2.0.0-alpha en compilaciones intermedias que no se publican; la 2.0.0 es la primera publicada).

## Archivos principales

- Web/servidor: `app/clientes.php`, `app/pedidos.php` (reuso), `public/cuenta.html`, `public/js/cuenta.js`, `public/style.css`, `public/js/portada.js`, `public/index.html` y el pie de todas las páginas, `public/iconos.js`, `public/.htaccess`, `public/app/` (nuevo), `public/js/app-captcha.js` (nuevo), `scripts/seguridad/ataques.js`, `README.md`.
- App: `~/AndroidStudioProjects/NecutlaMovil/app/build.gradle.kts`, `gradle/libs.versions.toml`, `app/src/main/java/com/necutla/app/**`, `AndroidManifest.xml`, `res/font/`.
- Reuso: `lineas_de_pedidos()`, `UNIR_PEDIDO`, `fecha_iso()` (`app/pedidos.php`), `requiere_cliente()` (`app/clientes.php`), `mostrarSubseccion`, `escapeHTML`, `alAcercarse` (`public/js/comun.js`), `public/js/captcha.js`.

## Riesgos y cosas a decir

- Es mucho trabajo (10 prompts); Necutools nativo es la parte más grande.
- No hay teléfono ni emulador comprobado: si no hay, se compila y se prueba la API con `curl`; la prueba en teléfono la hace el usuario.
- iPhone sigue fuera (sin Mac): el botón solo ofrece Android.
- Notificaciones siguen pendientes (Firebase, plan aparte).
- Instalar un APK fuera de Play Store pide activar "Instalar apps desconocidas": la sección de la portada lo explica en una línea.

## Verificación

- Parte 1: Chrome local (1280, 360, movimiento reducido) con un cliente temporal y pedidos de prueba en los 3 estados; sin errores de consola ni scroll horizontal, CLS < 0.02; `ataques.js` completo; borrar datos de prueba.
- App: `./gradlew assembleRelease` sin errores ni advertencias nuevas, `apksigner verify`; si hay emulador/teléfono, `adb install -r` sobre la 1.0.0 y recorrer: entrar, carrito, pedido por WhatsApp (sin mandarlo), Mis pedidos, Necutools con un dueño temporal en la base local (apuntando la app a `http://10.0.2.2:8081` solo en la variante `debug`).
- Descarga: `curl -I` de `/app/necutla-android.apk` (200, `application/vnd.android.package-archive`, `no-cache`) y `/app/version.json`; SHA-256 igual al del escritorio.
