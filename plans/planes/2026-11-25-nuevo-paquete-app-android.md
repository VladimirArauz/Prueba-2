# Plan: nuevo nombre de paquete de la app de Android para el Android Developer Console

- **Fecha:** 2026-11-25 · **Estado:** aplicado
- **Prompts:** `plans/prompts/2026-11-25-nuevo-paquete-app-android.md`
- **Alcance:** proyecto `~/AndroidStudioProjects/NecutlaMovil` (`applicationId`, `google-services.json`), `public/.well-known/assetlinks.json`, `public/app/`, `README.md`. Sin cambios en la API ni en la base.

## Contexto

Play Protect bloqueó la actualización de la app ("no vio una app de este desarrollador antes"). El usuario creó una cuenta gratis de distribución limitada en el Android Developer Console, pero esa cuenta solo registra nombres de paquete que nunca se han usado, y `com.necutla.app` ya circula. El usuario eligió cambiar el nombre del paquete: por ahora solo él tiene la app.

**Lo que esto implica (explicado al usuario):**
- Para Android es otra app. La vieja (`com.necutla.app`) no se actualiza sola a la nueva, porque el actualizador amarra la sesión al paquete propio (`setAppPackageName`). Se desinstala y se baja la nueva de necutla.com una vez.
- La cuenta limitada solo permite instalar en dispositivos que el usuario autorice (20 o 50, según la página de Google). Para que cualquiera la baje hará falta la cuenta completa, que se puede migrar después.

## Decisiones
- Paquete nuevo: **`com.yancore.necutla`** (la marca del usuario, sirve para sus otras apps), y `com.yancore.necutla.debug` para la variante de pruebas. Antes de cambiar el código, el usuario comprueba en el console que el nombre se acepta.
- `namespace` del código sigue en `com.necutla.app`: no cambia ninguna clase ni `proguard-rules.pro`.
- Misma llave de firma (`41:38:B7…7C:16:7D`).
- Versión **2.5.0** (`versionCode` 10).

## Pasos
1. **Usuario:** en el Android Developer Console → Packages, registrar `com.yancore.necutla` con la huella SHA-256 de la llave.
2. **Usuario:** en Firebase (proyecto `necutla`), agregar 2 apps de Android, `com.yancore.necutla` y `com.yancore.necutla.debug`, y bajar el `google-services.json` nuevo (debe traer los 4 paquetes o al menos los 2 nuevos). El servidor no cambia: FCM manda por proyecto con la misma cuenta de servicio.
3. **Claude:** `applicationId = "com.yancore.necutla"`, `google-services.json` nuevo, `assetlinks.json` con los dos paquetes (el viejo hasta que se desinstale), `README.md`, 2.5.0 compilada y firmada, al escritorio y a `public/app/` con `version.json`. Si el console pide una prueba de propiedad (archivo en `assets/`), se agrega y se firma.
4. **Claude:** probar en el emulador (instalación limpia, permisos, avisos al entrar, actualizador leyendo `version.json`), y subir a IONOS con permiso del usuario (APK, `version.json`, `assetlinks.json` y lo pendiente de la línea de Play Protect).
5. **Usuario:** desinstalar la app vieja, autorizar su teléfono en el console si lo pide, instalar la 2.5.0 desde necutla.com y decir si Play Protect sigue avisando.
