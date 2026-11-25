# Prompts: aviso de cookies sin salto, entrega en el Metro, foto de Libros y nombre en la barra

Plan: `plans/planes/2026-11-24-cookies-metro-libros-y-nombre.md`. Se corren en orden.

## Prompt 1. Aviso de cookies sin salto (`public/js/etiquetas.js`)

```
Lee plans/CLAUDE.md, plans/MEMORIA.md y plans/planes/2026-11-24-cookies-metro-libros-y-nombre.md.
Aplica el prompt "1. Aviso de cookies sin salto (`public/js/etiquetas.js`)" del plan:
- Insertar el aviso solo cuando la letra ya cargó: `document.fonts.ready` (o `document.fonts.load("600 16px Archivo")`)
  con un tope de unos 2.5 s, para que no se quede sin aviso si la fuente falla. Un elemento nuevo al final no cuenta
  como salto; lo que contaba era su cambio de alto al llegar Archivo.
- No cambiar la lógica de la decisión (`necutla_cookies` = `si`/`no`) ni cuándo carga Tag Manager.
- Prueba local: el aviso solo sale con `google_tag_manager` en `app/config.php` → ponerlo temporalmente (como el
  2026-11-06) y restaurarlo; simular fuente lenta con Playwright (`route` a `*.woff2` con 1.5 s de espera) y medir CLS
  sin decisión a 1280 y 360 en `/`, `/t/tecnologia` y `/p/<id>`. Meta: menos de 0.02.
Respeta las reglas de diseño y de seguridad; no subas nada a IONOS ni hagas commit sin permiso.
Al terminar, actualiza plans/MEMORIA.md.
```

## Prompt 2. Entrega en el Metro, sin CECyT 9

```
Lee plans/CLAUDE.md, plans/MEMORIA.md y plans/planes/2026-11-24-cookies-metro-libros-y-nombre.md.
Aplica el prompt "2. Entrega en el Metro, sin CECyT 9" del plan:
- Texto nuevo del lugar: "Líneas azul y naranja del Metro CDMX" (icono `map-pin`).
- Web: pie de las 11 páginas (`CECyT&nbsp;9 Juan de Dios Bátiz` → texto nuevo), pie del tablero (`index.html`),
  beneficio "Entrega en el CECyT 9" → "Entrega en el Metro" con "Líneas azul y naranja; acuerdas la estación y la hora",
  h1 del banner "Todo lo de los stands del CECyT 9" → "Todo lo de las tiendas de estudiantes", `<title>` y
  `meta description` de `index.html`, `descripcion` de `app/paginas.php:22` (Open Graph) y JSON-LD si lo menciona.
  Revisar con `grep -rn "CECyT\|Bátiz" public app` que no quede ninguno. Revisar que los títulos sigan en 60 caracteres
  o menos (`titulo_pagina`).
- FAQ "¿Cómo recibo lo que pedí?": agregar que se entrega en estaciones de las líneas azul y naranja.
- App: `Inicio.kt` (beneficio, título del banner, pie del tablero) y `Comunes.kt:200` (pie).
Respeta las reglas de diseño y de seguridad; no subas nada a IONOS ni hagas commit sin permiso.
Al terminar, actualiza plans/MEMORIA.md.
```

## Prompt 3. Foto de Libros y respaldo con icono

```
Lee plans/CLAUDE.md, plans/MEMORIA.md y plans/planes/2026-11-24-cookies-metro-libros-y-nombre.md.
Aplica el prompt "3. Foto de Libros y respaldo con icono" del plan:
- Elegir una foto de libros en Unsplash (Unsplash License, no Unsplash+), **pedir permiso antes de descargarla**
  (nombre, origen y tamaño), con `?fm=jpg&q=85&w=1600`; recorte 16:10, WebP a 640 y 1280 sin metadatos en
  `public/imagenes/tiendas/libros-640.webp` / `-1280.webp`, como dice `recursos/fotos-unsplash/creditos.md`
  (actualizar su tabla).
- `public/js/portada.js`: `libros` en `FOTOS_TIENDAS` (alt y crédito). `imagenTarjeta()`: si no hay foto ni portada,
  en lugar de `/imagenes/otra.svg` un recuadro `.tienda-tile-icono` con `icon(t.icono || "store")` en `--tinta`
  sobre `--gis` (clase nueva en `style.css`, solo tokens).
- App: `fotoTienda()` de `Inicio.kt` con `libros`; sin foto, recuadro con el icono de la tienda.
Respeta las reglas de diseño y de seguridad; no subas nada a IONOS ni hagas commit sin permiso.
Al terminar, actualiza plans/MEMORIA.md.
```

## Prompt 4. Primer nombre en la barra

```
Lee plans/CLAUDE.md, plans/MEMORIA.md y plans/planes/2026-11-24-cookies-metro-libros-y-nombre.md.
Aplica el prompt "4. Primer nombre en la barra" del plan:
- Servidor (`app/paginas.php`, en `pagina_publica`): solo si llega la cookie de sesión, `Sesion::cargar()` y
  `cargar_cliente()` **sin guardar la sesión** (mismo criterio que `servir_imagen()`); si hay cliente, reemplazar en
  `.barra-acciones` el `<span class="barra-texto">Mi cuenta</span>` por el primer nombre escapado
  (`htmlspecialchars`, primera palabra de `nombre`) y poner `aria-label="Mi cuenta: <nombre>"`. Si la base falla,
  queda "Mi cuenta". La página pasa a `Cache-Control: private, no-cache` (ya lleva `Vary: Cookie`).
- `public/js/comun.js`: `pintarCuentaBarra(nombre | null)`; `public/js/cuenta.js` la llama al entrar, al salir y al
  eliminar la cuenta, para que se vea sin recargar.
- `style.css`: el nombre se corta con puntos suspensivos (`max-width` en `ch`, `text-overflow: ellipsis`). En celular
  la barra solo muestra iconos: allí no cambia.
- Sin cuentas (`cuentas_clientes` en false) no se toca nada.
- La app no tiene barra de arriba: no cambia (ya muestra el nombre en Mi cuenta).
Respeta las reglas de diseño y de seguridad; no subas nada a IONOS ni hagas commit sin permiso.
Al terminar, actualiza plans/MEMORIA.md.
```

## Prompt 5. App 2.3.1 (`versionCode` 7)

```
Lee plans/CLAUDE.md, plans/MEMORIA.md y plans/planes/2026-11-24-cookies-metro-libros-y-nombre.md.
Aplica el prompt "5. App 2.3.1 (`versionCode` 7)" del plan:
- Compilar con `JAVA_HOME=/opt/android-studio/jbr`, `./gradlew --stop` después; probar en el emulador `necutla`
  (debug contra `10.0.2.2:8081`); APK firmado a `~/Escritorio/Versiones Necutla Movil/Android/Necutla-2.3.1.apk` y
  `public/app/` con `version.json` (tamaño y SHA-256).
Respeta las reglas de diseño y de seguridad; no subas nada a IONOS ni hagas commit sin permiso.
Al terminar, actualiza plans/MEMORIA.md.
```

## Prompt 6. Pruebas, README y memoria

```
Lee plans/CLAUDE.md, plans/MEMORIA.md y plans/planes/2026-11-24-cookies-metro-libros-y-nombre.md.
Aplica el prompt "6. Pruebas, README y memoria" del plan:
- Chrome (Playwright del venv) a 1280, 360 y movimiento reducido: 8 páginas sin errores ni scroll horizontal; CLS
  sin decisión de cookies y con fuente lenta; ningún "CECyT" en el HTML; tile de Libros con su foto y tienda sin foto
  con su icono; con un cliente temporal, la barra muestra el primer nombre en todas las páginas, cambia al entrar y
  salir sin recargar, y un nombre con `<script>` sale escapado; sin sesión dice "Mi cuenta".
- `ataques.js` contra localhost (agregar: la página con cookie de otro cliente no muestra su nombre; `Cache-Control`
  privado); borrar lo que cree por `creado_en`.
- `README.md` (nombre en la barra, respaldo con icono), estado del plan a `aplicado en local`, `plans/MEMORIA.md`
  (cambio y pendiente de subir; el pendiente (a2) y (b2) quedan resueltos si el CLS baja).
Respeta las reglas de diseño y de seguridad; no subas nada a IONOS ni hagas commit sin permiso.
Al terminar, actualiza plans/MEMORIA.md.
```
