# Prompts: app de Android en Android Studio

Plan: `plans/planes/2026-11-22-app-android-studio.md`. Se corren en orden.

### Prompt 1: proyecto y APK
Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan. Crea `~/AndroidStudioProjects/NecutlaMovil` (Kotlin, sin Compose, mismas versiones de AGP y Gradle que `~/AndroidStudioProjects/CamI`) con todo lo de "Lo que hace la app". Crea la llave de firma sin imprimir la contraseña, compila `assembleRelease` como el usuario `aumf-ubuntu-080704`, verifica la firma y copia el APK a `~/Escritorio/Versiones Necutla Movil/Android/`. Prepara `public/.well-known/assetlinks.json` con la huella, sin subirlo. Actualiza `plans/MEMORIA.md`.

### Prompt 2: probar en un teléfono
Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan. Con el teléfono conectado por USB (depuración activada) o un emulador, instala el APK con `adb install -r` y prueba lo de "Verificación". Revisa `adb logcat` si algo falla. Anota los resultados en `plans/MEMORIA.md`.

### Prompt 3: enlaces que abren la app
Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan. Pídeme permiso y sube `public/.well-known/assetlinks.json` a IONOS (respaldo y md5 como siempre). Comprueba que responde 200 con `application/json` y que `adb shell pm get-app-links com.necutla.app` dice `verified`.
