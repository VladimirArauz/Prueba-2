# App de Android en Android Studio (primera versión, APK)

- **Fecha:** 2026-11-22
- **Estado:** descartado (reemplazado por `2026-11-22-app-nativa-mis-pedidos-y-descarga.md`)
- **Prompts:** `plans/prompts/2026-11-22-app-android-studio.md`
- **Alcance:** proyecto de Android Studio `~/AndroidStudioProjects/NecutlaMovil` con una app nativa (Kotlin, sin Compose) que abre https://necutla.com y se comporta como app; APK firmado en `~/Escritorio/Versiones Necutla Movil/Android/`. No cambia la API, el carrito, Necutools ni el envío a WhatsApp del sitio.

### Decisiones del usuario (2026-11-22)

- Quiere app en la web y en el celular, como las apps que tienen las dos. Eligió "PWA y luego tiendas", notificaciones para clientes y vendedores, y **no tiene Mac** (iPhone queda como PWA hasta tener una).
- Pidió el proyecto en Android Studio y el APK en `/home/aumf-ubuntu-080704/Escritorio/Versiones Necutla Movil/Android`.

### Por qué una app que carga necutla.com

- Hay un solo sistema (API en PHP de IONOS y MariaDB): lo que cambie en Necutools se ve igual en la web y en la app, y una mejora del sitio llega a la app **sin publicar otro APK**.
- La sesión (`__Host-necutla.sid`, `SameSite=Strict`), la CSP y Turnstile siguen iguales porque la app abre el mismo dominio.
- El diseño móvil del lienzo (https://claude.ai/artifact/LEtPcm84F9X3f9nwDKJsAU) se aplicará en el sitio (plan aparte de PWA, pendiente) y la app lo mostrará solo.

### Lo que hace la app (Android)

1. Abre `https://necutla.com/` a pantalla completa, con pantalla de arranque e icono de Necutla (`public/imagenes/icono-maskable-512.png`, fondo `--tinta`).
2. Se queda dentro de la app solo en `necutla.com` y `www.necutla.com` (https). WhatsApp (`api.whatsapp.com`, `wa.me`, `whatsapp:`), correo, teléfono y cualquier otro sitio se abren con su app o con el navegador.
3. `window.open(..., "_blank")` (lo usa `enviarPorWhatsApp()` en `public/js/comun.js`) y los enlaces `target="_blank"` ("Volver a abrir WhatsApp", "Vendedor 2") se atienden con `onCreateWindow` y se abren afuera.
4. Subir fotos en Necutools y en Mi cuenta: selector de archivos de Android (`onShowFileChooser`), sin pedir permiso de cámara.
5. Botón Atrás: regresa en el historial de la página; en la primera, sale de la app.
6. Jalar hacia abajo para recargar, solo cuando la página está hasta arriba.
7. Sin internet: pantalla propia ("Sin conexión" y "Reintentar") con los tokens de `plans/CLAUDE.md`.
8. Barra de progreso delgada en `--senal` al cargar.
9. Cookies y `localStorage` activos (sesión y carrito); cookies de terceros solo para Turnstile y Analytics, que ya están en la CSP.
10. El agente de usuario termina en ` NecutlaApp/1.0 (Android)`, para que el sitio pueda reconocer la app más adelante.
11. Enlaces `https://necutla.com/...` abren la app (`autoVerify`). Para que Android los verifique hace falta subir `public/.well-known/assetlinks.json` a IONOS (con la huella SHA-256 de la llave de firma). Sin eso, abren en el navegador.
12. Sin copia de seguridad de los datos de la app (`allowBackup="false"`): la cookie de sesión no debe viajar a otro teléfono.

### Firma

- Llave en `~/.necutla-firma/necutla-release.jks` (fuera del proyecto y de git, permisos 600). La contraseña va en `keystore.properties` del proyecto (ignorado por git, 600). **Si se pierde la llave, no se pueden publicar actualizaciones de la misma app en Play Store**: respaldarla.

### Lo que no hace todavía

- Notificaciones: en un WebView no funciona Web Push; hacen falta Firebase Cloud Messaging o una Trusted Web Activity. Va en el plan de PWA y tiendas.
- Diseño móvil (pestañas abajo, hojas): es trabajo del sitio, no de la app.
- Play Store: cuenta de Google Play (25 USD), ficha, política de privacidad y AAB en lugar de APK.

### Verificación

- `./gradlew assembleRelease` sin errores; APK firmado (`apksigner verify`).
- Si hay un teléfono o emulador: instalar, entrar, agregar al carrito, mandar un pedido por WhatsApp, subir una foto en Necutools, Atrás, sin internet.
