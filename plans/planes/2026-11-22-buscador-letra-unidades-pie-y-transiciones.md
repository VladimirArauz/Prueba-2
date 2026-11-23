# Plan: buscador claro, menos tamaños de letra, unidades flexibles, pie de la app y transiciones Shared Element

Fecha: 2026-11-22 · Estado: en curso · Prompts: `plans/prompts/2026-11-22-buscador-letra-unidades-pie-y-transiciones.md`
Alcance: web (`public/`) y app de Android (`~/AndroidStudioProjects/NecutlaMovil`), sin cambios en la API ni en la base.

## Context

El usuario pidió aplicar 4 reels y corregir el pie de la app. Lo que dicen los reels (leídos con `/embed/captioned/`; los videos no se ven):

| Reel | Autor | Qué pide | Dónde |
|---|---|---|---|
| Df3FZ0BIK66 | @jiron.design | Buscador que diga su estado: si buscó, si está cargando o si no está activo. Los tips exactos están solo en el video; el usuario eligió completarlos con guías (Carbon, Apple HIG, Baymard, VTEX) | Web y app |
| DfuZApgB38D | @codingwithabdullah | Dejar de usar px para todo: `rem` para letra, `%` para anchos, `px` para bordes, `vw` para pantalla completa, `em` para el relleno de botones; `rem` respeta la letra grande del usuario | Web (en la app, `sp`/`dp`) |
| DfsvuchIp2F | @jiron.design | Menos tamaños de letra: que lo importante resalte; más de 5 tamaños en una tarjeta es demasiado | Web y app |
| Dftu2zGj6i2 | @ale.uiux | 8 transiciones entre pantallas. Shared element para no perderse; slide para entrar al detalle; fade/zoom para navegación tranquila; modal sheet para tareas rápidas | Solo app |

Hallazgos en el código:
- **Web:** la letra ya va en `rem`, pero hay **17 tamaños distintos** en `style.css` (dos de `0.75rem` = 12 px, por debajo del mínimo de 14 px). Los `@media` van en `px` (no crecen con la letra del usuario) y hay anchos y altos fijos en px (`width: 320px`, `132px`, `height: 260px`, `190px`, `220px`, `min-width: 240px`…). El buscador de la portada (`public/js/portada.js:172`) ya tiene debounce y esqueletos, pero no tiene botón para borrar dentro del campo, avisa "faltan letras" con un toast, el error no trae "Reintentar" y el buscador de la barra lateral no da ninguna señal.
- **App:** el pie (`Pie()` en `ui/pantallas/Comunes.kt:148`) es un divisor y texto gris sobre `--gis`, con el mismo relleno que el contenido: parece una sección más. En la web, el pie es una banda `--tinta` de lado a lado (`.site-footer`). El tema (`ui/tema/Tema.kt`) usa 7 tamaños (30, 22, 17, 16, 15, 14, 18) y la barra inferior baja a **12 sp** (`Letra.Etiqueta × 0.86` en `ui/App.kt:120`), por debajo de 14. No hay ninguna transición entre pantallas (NavHost por omisión). `Buscar.kt` cambia los resultados por `Cargando()` en cada búsqueda y no tiene botón para borrar.
- La BOM de Compose `2026.09.00` ya trae `SharedTransitionLayout` estable (Compose Animation 1.10+) y Navigation 2.10.2 lo soporta con el atrás predictivo.

Decisiones del usuario: tips del buscador desde el texto del post y las guías; escala de 7 tamaños; Shared Element desde el reel Dftu2zGj6i2, y otras transiciones solo para ciertas acciones si quedan mejor.

Todas las transiciones responden a un toque del usuario, así que cumplen la regla de movimiento de `plans/CLAUDE.md`; no hace falta excepción.

## Escala de letra (web y app, la misma)

| Token web (`:root`) | Tamaño | App (`Letra`) | Uso |
|---|---|---|---|
| `--letra-chica` | 0.875rem (14) | `Secundario`, `Etiqueta` | Texto secundario, etiquetas, ayuda |
| `--letra-base` | 1rem (16) | `Cuerpo`, `Boton` | Cuerpo y botones (antes 15) |
| `--letra-media` | 1.125rem (18) | `H3`, `Precio` | Nombre en tarjeta, precio |
| `--letra-h3` | 1.375rem (22) | `H2` | h3 de página, títulos de tarjeta grande |
| `--letra-h2` | 1.75rem (28) | `Titulo` | h2 de sección |
| `--letra-titulo` | clamp(2.25rem, 4.6vw, 3.5rem) | — | h1 de página |
| `--letra-portada` | clamp(2.5rem, 6vw, 4.25rem) | — | h1 del hero |

Cada tamaño viejo pasa al token más cercano (`0.75rem` y `0.9375rem` → chica o base según si es botón; `1.0625rem` y `1.25rem` → media o h3 según jerarquía, comparando capturas antes y después). Ninguna tarjeta queda con más de 3 tamaños. Jerarquía con ancho y peso (`wdth`), como dice `plans/CLAUDE.md`.

## Prompts (en orden)

**0. Guardar el plan.** Copiar este plan a `plans/planes/2026-11-22-buscador-letra-unidades-pie-y-transiciones.md` y escribir sus prompts en `plans/prompts/` con el mismo nombre. Cada prompt empieza pidiendo leer `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan. Agregarlo a la tabla de `plans/MEMORIA.md`.

**1. Web: escala de 7 tamaños** (`public/style.css`, `public/js/graficas.js` si fija tamaños). Tokens en `:root`, reemplazar los 17 `font-size` por `var(--letra-*)`, quitar los 12 px. Capturas antes y después a 1280 y 360 de portada, tienda, producto, carrito, cuenta y Necutools.

**2. Web: unidades flexibles** (`public/style.css`). `@media` de px a `em` (992px → 62em, 860 → 53.75em, 760 → 47.5em, 640 → 40em, 400 → 25em, 1200 → 75em; mismos cortes con letra normal). Anchos y altos fijos en px → `rem`, `%` o `min()` (ej. `width: min(20rem, 100%)`); altos de fotos con `aspect-ratio` donde sea posible. Relleno de `.btn` en `em`. Bordes, radios y el borde de 2px de botones siguen en px. Contenedor `min(1200px, 92%)` sin cambio (regla). Probar con letra al 200 % (`html { font-size: 200% }` inyectado) a 360 y 1280: sin scroll horizontal ni texto cortado.

**3. Buscador claro, web y app.**
- Web (`public/index.html`, `public/js/portada.js`, `public/style.css`, `public/iconos.js` si falta `x` o `loader`): botón "Borrar búsqueda" (icono `x`, `aria-label`) dentro del campo, visible con texto; reutiliza la acción `limpiar-busqueda`. Bajo el campo, una línea de estado `aria-live` que siempre dice algo: "Escribe al menos 2 letras" (en vez del toast), "Buscando en todas las tiendas…", "N resultados para «q»", "No encontramos «q»" con enlaces a las tiendas, y error con botón "Reintentar". Mientras busca, se quedan los resultados anteriores atenuados (`aria-busy`) en lugar de vaciar la cuadrícula; esqueletos solo en la primera búsqueda. El buscador de la barra lateral también lleva botón de borrar. Mantener `turnoBusqueda`, `conEspera` y los `id`.
- App (`ui/pantallas/Buscar.kt`, `ui/Comp.kt` → `Campo` con icono de borrar opcional): mismos 5 estados y textos, resultados anteriores visibles mientras carga, "Reintentar" en el error, teclado con acción "Buscar".

**4. App: tema, escala y tamaños mínimos** (`ui/tema/Tema.kt`, `ui/App.kt`, pantallas). `Letra` con la escala de arriba (Titulo 28, H2 22, H3 18, Boton 16; sin 30, 17 ni 15) y `labelSmall` a 14. Barra inferior a 14 sp; si "Promociones" no cabe a 360 dp, `alwaysShowLabel = false` (solo la pestaña elegida muestra su texto; todas conservan `contentDescription`). Equivalente del reel de unidades: nada con alto fijo que tenga texto, `minimumInteractiveComponentSize()` (48 dp) en lo tocable a mano, y que todo se lea con letra del sistema al 200 %.

**5. App: pie que se distingue** (`ui/pantallas/Comunes.kt` → `Pie()`, `ui/tema/Tema.kt`, `Inicio.kt`, `Tienda.kt`). Banda `N.Tinta` de lado a lado (rompe el relleno de 16 dp de la lista con `Modifier.layout`), sin divisor, separada del contenido por 32 dp: logo y "Necutla" en `N.Senal` (`Archivo125`), descripción, lugar y horario en `TintaSuave`; enlaces como filas de 48 dp con texto blanco e icono; "© 2026 … By YANCORE" bajo un divisor `LineaTinta`. Se agregan a `N` los derivados que ya existen en la web, `TintaSuave` (#C9D3EA) y `LineaTinta` (blanco al 14 %): no son colores nuevos. El pie llega hasta la barra inferior. Revisar que las demás pantallas que lo necesiten lo usen.

**6. App: transiciones** (`ui/App.kt`, `ui/pantallas/Comunes.kt`, `Inicio.kt`, `Tienda.kt`, `Producto.kt`, `ui/Comp.kt` → `Foto`, `AndroidManifest.xml`). Siguiendo https://developer.android.com/develop/ui/compose/animation/shared-elements/navigation:
- `SharedTransitionLayout` alrededor del `NavHost`; el `SharedTransitionScope` y el `AnimatedVisibilityScope` de cada `composable` bajan por un `CompositionLocal` (sin pasarlos por todas las funciones).
- **Shared element** (al pasar de sección): la foto de `TarjetaProducto` crece hasta la primera foto del carrusel de `ProductoPantalla` (`sharedElement`, clave `foto-producto-<id>`) y el nombre con `sharedBounds` (la guía lo recomienda para texto que cambia de tamaño); la foto de la tienda (tablero, lista de tiendas) hasta el encabezado de `TiendaPantalla` (`foto-tienda-<slug>`). Al regresar, se encoge a su tarjeta, también con el gesto de atrás predictivo (`android:enableOnBackInvokedCallback="true"`).
- **Fade** (navegación tranquila) entre pestañas de la barra inferior, 150 ms.
- **Slide** (entrar al detalle) solo donde no hay elemento compartido: Buscar, Necutools y sus subsecciones.
- **Modal sheet** (tareas rápidas): ya se usa en el captcha y en el aviso de versión; no se agrega otro.
- Curvas iguales a la web: entrar `CubicBezierEasing(.2f,.7f,.2f,1f)` 300 ms, salir `(.42f,0f,1f,1f)` 200 ms. Con "Quitar animaciones" del sistema (`ANIMATOR_DURATION_SCALE` = 0) no hay movimiento: confirmarlo en la documentación de Compose; si no se respeta solo, leer el ajuste y usar `snap()`.
- Flip, Circle reveal y Card stack no se usan: no ayudan a pedir más rápido y chocan con el concepto de señalética plana.

**7. App: revisión de diseño móvil** (checklist de las guías oficiales de Android: core app quality, edge-to-edge, accesibilidad). Contenido detrás de las barras del sistema y botones fuera de ellas (insets), objetivos de 48 dp, el teclado no tapa campos (`imePadding`), cuadrícula adaptable en pantallas anchas (`GridCells.Adaptive` ya está), TalkBack con etiquetas, letra al 200 %. Corregir lo que falle.

**8. Extras pedidos por el usuario el 2026-11-22** (antes eran recomendaciones):
- **Búsquedas recientes** (web y app): las últimas 5 búsquedas con resultados, guardadas solo en el dispositivo (`localStorage` con `try/catch` en la web, `SharedPreferences` en la app), visibles con el campo vacío y enfocado, cada una con su botón para quitarla y un "Borrar historial". Nunca se mandan al servidor ni a Analytics.
- **Foto que crece en la web** (View Transitions entre páginas): `@view-transition { navigation: auto; }` dentro de `@media (prefers-reduced-motion: no-preference)` y `view-transition-name` en la foto de la tarjeta (`foto-producto-<id>`) y en la foto principal de `/p/<id>`, igual con la foto de la tienda y el encabezado de `/t/<slug>`. El nombre cambia por producto, así que se pone desde JS con `el.style.viewTransitionName` (la CSP bloquea `style="…"` en el HTML, pero no las propiedades puestas desde JS). Los navegadores sin soporte navegan igual que hoy. Es respuesta a un toque, así que cumple la regla de movimiento.
- **Pie de la web en 2 columnas en el celular**: a 40em o menos, los enlaces del pie en una cuadrícula de 2 columnas; marca, lugar y horario siguen arriba a todo lo ancho.
- **Botones de 48 px en el celular**: a 40em o menos, `.btn` con alto mínimo de 48px y `.btn-sm` de 44px, y lo tocable de solo icono también. El usuario pidió cambiar la regla, así que `plans/CLAUDE.md` se actualiza en esa línea.

**9. Versión, APK y cierre.** App 2.1.0 (`versionCode` 3), `assembleRelease` con `JAVA_HOME=/opt/android-studio/jbr` como el usuario, `apksigner verify` con la misma llave, copia a `~/Escritorio/Versiones Necutla Movil/Android/Necutla-2.1.0.apk` (sin borrar las anteriores), `public/app/necutla-android.apk` y `version.json`. `README.md` (escala de letra, unidades). `plans/MEMORIA.md`. Commit con `runuser`; el push lo hace el usuario desde VS Code. Subir a IONOS solo con permiso, con respaldo y md5 previos.

**E (opcional, pide permiso). Emulador para probar la app.** Hay `emulator` y `/dev/kvm`, pero no hay imagen del sistema (unos 1.5 GB) y el equipo tiene 5 GB de RAM. Si el usuario acepta, bajar una imagen x86_64 de API 36 con `sdkmanager`, crear un AVD chico y probar ahí las transiciones, el pie y la letra al 200 %. Sin emulador, la app solo se compila.

## Archivos que se tocan

- Web: `public/style.css`, `public/index.html`, `public/js/portada.js`, `public/iconos.js`, `public/js/graficas.js` (si aplica), `README.md`, `public/app/*`.
- App: `ui/tema/Tema.kt`, `ui/App.kt`, `ui/Comp.kt`, `ui/pantallas/{Comunes,Inicio,Tienda,Producto,Buscar}.kt`, `ui/necutools/Necutools.kt`, `app/src/main/AndroidManifest.xml`, `app/build.gradle.kts`.
- Se reusa: `conEspera`, `turnoBusqueda`, `pintarEsqueletos`, la acción `limpiar-busqueda`, `escapeHTML` (web); `Campo`, `Foto`, `Vacio`, `Nota`, `ErrorCarga`, `irA` (app).

## Verificación

- Web local (http://localhost:8081, Playwright del venv de `~/estudio/tests` con Chrome): portada, tienda, producto, carrito, promociones, cuenta y Necutools a 1280, 360, 320, letra al 200 % y movimiento reducido. Sin scroll horizontal, CLS menor a 0.02, sin errores de consola ni CSP, ningún texto de menos de 14 px y no más de 7 tamaños (script que junta los `font-size` calculados). Buscador: los 5 estados, borrar, respuesta lenta (API simulada con retraso) y error (API simulada con 500).
- `grep` de `style.css`: 0 `@media` en px, 0 `font-size` fuera de los tokens, 0 hex nuevos.
- App: compila sin advertencias, `apksigner verify` y SHA-256 igual en las 3 copias; con emulador (si se aprueba el prompt E): foto que crece y se encoge, fade entre pestañas, pie en banda azul, letra al 200 %, "Quitar animaciones".
- `ataques.js` no hace falta: no cambian la API ni las rutas.

## Recomendaciones extra

Las 4 que había aquí (búsquedas recientes, View Transitions en la web, pie en 2 columnas y botones de 48 px) pasaron al prompt 8 a pedido del usuario. Queda una: probar la app en un teléfono o emulador (prompt E).
