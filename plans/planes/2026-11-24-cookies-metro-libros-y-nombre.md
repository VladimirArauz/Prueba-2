# Aviso de cookies sin salto, entrega en el Metro, foto de Libros y nombre en la barra

- **Fecha:** 2026-11-24
- **Estado:** aplicado en local (2026-11-24); falta subir a IONOS
- **Prompts:** `plans/prompts/2026-11-24-cookies-metro-libros-y-nombre.md`
- **Alcance:** `public/js/etiquetas.js`, las páginas públicas (pie, portada), `public/js/portada.js`, `public/js/comun.js`,
  `public/js/cuenta.js`, `public/style.css`, `app/paginas.php`, foto nueva en `public/imagenes/tiendas/`, app de Android
  2.3.1. Sin cambios en la base, el carrito, Necutools ni el envío por WhatsApp.

## Contexto
Después del rediseño (`2026-11-24-rediseno-tienda-en-linea.md`, en vivo) el usuario pidió 4 cosas:
1. **Salto del aviso de cookies**: en la primera visita la portada da en vivo un CLS de 0.08 a 1280 y hasta 0.095 a 360
   (con la decisión ya tomada, menos de 0.015). Lo que se mueve es el aviso (`etiquetas.js` lo inserta sticky al final del
   `body`); crece cuando llega Archivo y sube su texto. Es el pendiente (a2) del carrusel.
2. **Ubicación**: quitar "CECyT 9" de **todo** (decisión del usuario) y decir que se entrega en las líneas azul y naranja
   del Metro de la CDMX.
3. **Compra por tienda**: en IONOS la tienda 8 `libros` no tiene portada (`imagen_url` null) ni foto en `FOTOS_TIENDAS`;
   `imagenTarjeta()` cae en `/imagenes/otra.svg` y parece repetir "Otra". Decisión: foto de libros de Unsplash, y toda
   tienda sin foto muestra su propio icono.
4. **Nombre en la barra**: con sesión de cliente, el enlace "Mi cuenta" de la barra de la tienda muestra el **primer nombre**.

Decisión del usuario: generar plan y prompts y **aplicarlos en local** en esta sesión; subir a IONOS solo cuando lo pida.

## Archivos de reglas (primer paso)
- `plans/planes/2026-11-24-cookies-metro-libros-y-nombre.md` (fecha, estado `en curso`, ruta de prompts, alcance) con
  este contenido.
- `plans/prompts/2026-11-24-cookies-metro-libros-y-nombre.md`: prompts 1 a 6 abajo, cada uno pide leer `plans/CLAUDE.md`
  y el plan.

## Prompts (orden de ejecución)

### 1. Aviso de cookies sin salto (`public/js/etiquetas.js`)
- Insertar el aviso solo cuando la letra ya cargó: `document.fonts.ready` (o `document.fonts.load("600 16px Archivo")`)
  con un tope de unos 2.5 s, para que no se quede sin aviso si la fuente falla. Un elemento nuevo al final no cuenta
  como salto; lo que contaba era su cambio de alto al llegar Archivo.
- No cambiar la lógica de la decisión (`necutla_cookies` = `si`/`no`) ni cuándo carga Tag Manager.
- Prueba local: el aviso solo sale con `google_tag_manager` en `app/config.php` → ponerlo temporalmente (como el
  2026-11-06) y restaurarlo; simular fuente lenta con Playwright (`route` a `*.woff2` con 1.5 s de espera) y medir CLS
  sin decisión a 1280 y 360 en `/`, `/t/tecnologia` y `/p/<id>`. Meta: menos de 0.02.

### 2. Entrega en el Metro, sin CECyT 9
- Texto nuevo del lugar: "Líneas azul y naranja del Metro CDMX" (icono `map-pin`).
- Web: pie de las 11 páginas (`CECyT&nbsp;9 Juan de Dios Bátiz` → texto nuevo), pie del tablero (`index.html`),
  beneficio "Entrega en el CECyT 9" → "Entrega en el Metro" con "Líneas azul y naranja; acuerdas la estación y la hora",
  h1 del banner "Todo lo de los stands del CECyT 9" → "Todo lo de las tiendas de estudiantes", `<title>` y
  `meta description` de `index.html`, `descripcion` de `app/paginas.php:22` (Open Graph) y JSON-LD si lo menciona.
  Revisar con `grep -rn "CECyT\|Bátiz" public app` que no quede ninguno. Revisar que los títulos sigan en 60 caracteres
  o menos (`titulo_pagina`).
- FAQ "¿Cómo recibo lo que pedí?": agregar que se entrega en estaciones de las líneas azul y naranja.
- App: `Inicio.kt` (beneficio, título del banner, pie del tablero) y `Comunes.kt:200` (pie).

### 3. Foto de Libros y respaldo con icono
- Elegir una foto de libros en Unsplash (Unsplash License, no Unsplash+), **pedir permiso antes de descargarla**
  (nombre, origen y tamaño), con `?fm=jpg&q=85&w=1600`; recorte 16:10, WebP a 640 y 1280 sin metadatos en
  `public/imagenes/tiendas/libros-640.webp` / `-1280.webp`, como dice `recursos/fotos-unsplash/creditos.md`
  (actualizar su tabla).
- `public/js/portada.js`: `libros` en `FOTOS_TIENDAS` (alt y crédito). `imagenTarjeta()`: si no hay foto ni portada,
  en lugar de `/imagenes/otra.svg` un recuadro `.tienda-tile-icono` con `icon(t.icono || "store")` en `--tinta`
  sobre `--gis` (clase nueva en `style.css`, solo tokens).
- App: `fotoTienda()` de `Inicio.kt` con `libros`; sin foto, recuadro con el icono de la tienda.

### 4. Primer nombre en la barra
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

### 5. App 2.3.1 (`versionCode` 7)
- Compilar con `JAVA_HOME=/opt/android-studio/jbr`, `./gradlew --stop` después; probar en el emulador `necutla`
  (debug contra `10.0.2.2:8081`); APK firmado a `~/Escritorio/Versiones Necutla Movil/Android/Necutla-2.3.1.apk` y
  `public/app/` con `version.json` (tamaño y SHA-256).

### 6. Pruebas, README y memoria
- Chrome (Playwright del venv) a 1280, 360 y movimiento reducido: 8 páginas sin errores ni scroll horizontal; CLS
  sin decisión de cookies y con fuente lenta; ningún "CECyT" en el HTML; tile de Libros con su foto y tienda sin foto
  con su icono; con un cliente temporal, la barra muestra el primer nombre en todas las páginas, cambia al entrar y
  salir sin recargar, y un nombre con `<script>` sale escapado; sin sesión dice "Mi cuenta".
- `ataques.js` contra localhost (agregar: la página con cookie de otro cliente no muestra su nombre; `Cache-Control`
  privado); borrar lo que cree por `creado_en`.
- `README.md` (nombre en la barra, respaldo con icono), estado del plan a `aplicado en local`, `plans/MEMORIA.md`
  (cambio y pendiente de subir; el pendiente (a2) y (b2) quedan resueltos si el CLS baja).

## Verificación
Las pruebas del prompt 6; `php8.5 -l` de los PHP tocados; `node --check` (Node del driver de Playwright) de los JS.
Sin commit ni subida a IONOS hasta que el usuario lo pida.
