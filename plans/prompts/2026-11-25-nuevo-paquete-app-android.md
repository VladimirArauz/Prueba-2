# Prompts: nuevo nombre de paquete de la app de Android

Plan: `plans/planes/2026-11-25-nuevo-paquete-app-android.md`.

## Prompt 1: cambiar el paquete y compilar la 2.5.0

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan. Antes de empezar, confirma con el usuario que el console aceptó `com.yancore.necutla` y que el `google-services.json` nuevo está en `~/Descargas`.

1. En `app/build.gradle.kts`, `applicationId = "com.yancore.necutla"` (el `namespace` queda igual). Versión 2.5.0, `versionCode` 10.
2. Copia el `google-services.json` nuevo y revisa que traiga `com.yancore.necutla` y `com.yancore.necutla.debug`.
3. En `public/.well-known/assetlinks.json`, agrega el paquete nuevo con la misma huella y deja el viejo.
4. Si el console pidió una prueba de propiedad, agrégala a `app/src/main/assets/` como diga el console.
5. Compila debug y release (`JAVA_HOME=/opt/android-studio/jbr`), revisa la firma con `apksigner`, copia `Necutla-2.5.0.apk` al escritorio y a `public/app/`, y actualiza `version.json`.
6. Prueba en el emulador: instalación limpia, la hoja de permisos y los avisos al entrar (con FID en la base local).
7. Actualiza `README.md` y `plans/MEMORIA.md`.

## Prompt 2: subir a IONOS

Pide permiso al usuario. Respalda en `~/necutla/respaldos/2026-11-25-paquete/antes.tar`, compara por SHA-256 y sube con rsync `public/index.html`, `public/app/necutla-android.apk`, `public/app/version.json` y `public/.well-known/assetlinks.json`. Revisa en vivo con `curl` (200, `application/json` en `assetlinks.json`, huella del APK) y actualiza `plans/MEMORIA.md` y el estado del plan.
