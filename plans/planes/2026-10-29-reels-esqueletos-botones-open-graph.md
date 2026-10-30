# Plan: ideas de 3 reels aplicadas a Necutla (esqueletos de carga, variantes de botón y vista previa en WhatsApp)

- **Fecha:** 2026-10-29
- **Estado:** aplicado en local (2026-10-29); falta subir a IONOS con el permiso del usuario
- **Prompts:** `plans/prompts/2026-10-29-reels-esqueletos-botones-open-graph.md`
- **Alcance:** esqueletos de carga, variantes y estados de botón, y vista previa del enlace (Open Graph) en
  `public/` (páginas, `style.css`, `js/`, `.htaccess`, imagen 1200×630) y `app/` (`paginas.php` nuevo,
  `arranque.php`, `api.php`, `config.ejemplo.php`). Sin cambios en la base.

## Contexto

El usuario pidió aplicar 3 reels de Instagram al proyecto. El texto de cada post se leyó con WebFetch desde
`/reel/<id>/embed/captioned/`. El video no se pudo ver: esta sesión no tiene las herramientas de Chrome.

| Reel | Autor | Qué enseña |
|---|---|---|
| DfBJ5MGtFj_ | @jiron.design | "Deja de usar spinners para cargar tus pantallas". Lo que propone en su lugar son esqueletos con la forma del contenido, que hacen que la carga se sienta más rápida. |
| DfDuWCKsfqm | @jiron.design | "Te enseño las variantes de un botón". Cada variante tiene un propósito: principal, secundario, terciario/ghost y destructivo, y cada una tiene sus estados (hover, presionado, deshabilitado, cargando). |
| DfEWnhqMNcp | @go.expoose | "Tu web se ve bien en tu compu. ¿Y cuando la mandan por WhatsApp?" Open Graph: imagen de 1200×630, un título que diga qué haces y dónde, y una frase clara. |

Estado actual del código:
- Mientras carga, los grids (`#stores-grid`, `#store-grid`, `#servicios-grid`, `#promos-grid`, `#search-grid`, `#board-list`) se quedan vacíos y solo el h1 dice "Cargando tienda" o "Cargando producto".
- `.btn` ya tiene las variantes `.secondary`, `.danger`, `.wa`, `.ghost` y `.btn-sm` (`public/style.css:156-246`). No tiene un estilo para `:disabled`; solo `.btn:disabled:hover` en la línea 2614. Tampoco hay estado de "cargando": `cuenta.js:71`, `producto.js:81/224` y `necutools.js:122/177/646` solo ponen `disabled`.
- No hay etiquetas `og:` en ninguna página. `/t/<slug>` y `/p/<id>` sirven HTML fijo por `.htaccess` (líneas 43 y 45). Las imágenes de ejemplo de las tiendas son SVG, y WhatsApp no muestra SVG en la vista previa.

Decisiones del usuario (2026-10-29): esqueletos con **pulso suave** (excepción a la regla de movimiento, solo
para este plan) y **vista previa propia por tienda y producto**.

## Prompt 1: esqueletos de carga
- `public/style.css`, sección nueva "ESQUELETOS DE CARGA":
  - `.esqueleto` (bloque plano `--linea` con el radio de su pieza).
  - `.esqueleto-card` (imagen, 2 líneas y botón con las medidas de `.card`) y `.esqueleto-fila` (fila del tablero y letrero).
  - Pulso de opacidad de 1 a 0.55 (`@keyframes`, 1.2 s).
  - Sin degradados ni colores nuevos. Con `prefers-reduced-motion` no hay animación.
- `public/js/comun.js`: `pintarEsqueletos(contenedor, n, tipo)`.
  - Pone `aria-busy="true"` en el contenedor y bloques `aria-hidden`.
  - Al pintar los datos o un error, se quita `aria-busy`.
  - Se llama antes de cada `api(...)` en `portada.js`, `tienda.js`, `producto.js`, `promociones.js` y `carrito.js`, con tantas piezas como la primera página (12 en tienda).
- Los h1 "Cargando tienda" y "Cargando producto" pasan a un esqueleto de título y el texto queda en `.sr-only`.
- Necutools: tablas y KPIs del Resumen con `.esqueleto-fila` al cambiar de panel o de periodo.
- No cambia ningún `id` ni la lógica de la API.

## Prompt 2: variantes y estados de botón
- Auditoría de las 7 páginas y de las plantillas JS: un solo `.btn` principal por grupo de acciones. El rojo (`.danger`) solo para borrar o vaciar, y `.ghost` para acciones terciarias (Cancelar, Volver). Se corrige lo que no cumpla.
- `public/style.css`:
  - `.btn:disabled, .btn[aria-disabled="true"]`: fondo `--gis`, texto y borde `--texto-2`, `cursor: not-allowed`, sin escalón en hover. El contraste se revisa contra AA.
  - `.btn[aria-busy="true"]`: mismo aspecto que el normal, `cursor: progress`. **Sin spinner**, para ser coherente con el reel 1.
- `public/js/comun.js`: `botonOcupado(boton, texto)` / `botonListo(boton)`.
  - Guarda el texto, pone `aria-busy`, `disabled` y el texto de la acción en curso ("Guardando producto", "Entrando", "Publicando opinión").
  - Se aplica en los envíos de `cuenta.js`, `producto.js` y `necutools.js` que hoy solo ponen `disabled`.
- Una tabla "Qué botón usar" en `README.md`, sección de diseño. No se toca `plans/CLAUDE.md`.

## Prompt 3: vista previa general (Open Graph)
- Imagen `public/imagenes/og-necutla.png` de 1200×630:
  - Se arma desde `recursos/og/og-necutla.svg` (nuevo, fuera de `public/`) con el tablero del hero: fondo `--tinta`, texto `--senal` y blanco, letra Archivo.
  - Se convierte a PNG con `google-chrome --headless --screenshot`, que ya está en la máquina.
- En `index.html`, `carrito.html`, `promociones.html` y `cuenta.html`:
  - `og:type`, `og:site_name` "Necutla", `og:title` "Necutla — tiendas de estudiantes con pedido por WhatsApp", `og:description` (frase clara), `og:image` (+ `:width`, `:height`, `:alt`), `og:locale` `es_MX` y `twitter:card` `summary_large_image`.
  - `necutools.html` no lleva vista previa (ya tiene `noindex`).
- `og:image` y `og:url` deben ser absolutas: van con la opción nueva `url_publica` de `app/config.php`.
  - Como las 4 páginas fijas no pasan por PHP, el prompt 4 las sirve también por `api/index.php`. Así ninguna página lleva un dominio escrito a mano.

## Prompt 4: vista previa por tienda y producto (PHP)
- `public/.htaccess`: `/`, `/index.html`, `/t/<slug>`, `/p/<id>`, `/carrito.html`, `/promociones.html` y `/cuenta.html` pasan a `api/index.php` (`[END,QSA]`). Siguen siendo el único `.php` que se ejecuta; el resto de las reglas no cambia.
- `app/paginas.php` (nuevo, se carga desde `app/arranque.php`):
  - Lee el HTML de `public/` y cambia el bloque `<!--og:inicio-->…<!--og:fin-->` por las etiquetas de esa página, con `htmlspecialchars`.
  - Responde con las mismas cabeceras que `.htaccess` (CSP, `no-cache`).
  - Si el slug o el id no existe o está oculto, usa las etiquetas generales (sin 404 nuevo; la página ya muestra su aviso).
  - Tienda: "`<nombre>` en Necutla", su descripción y su portada si es PNG/JPG/WEBP; si no, la general.
  - Producto: "`<nombre>` — $precio en `<tienda>`" (precio con la oferta de hoy, usando `app/ofertas.php`), los primeros 150 caracteres de la descripción y `imagen_producto()` de `app/api.php`.
  - Consultas con PDO y `?`, reusando las mismas consultas de `/api/stands/:slug` y `/api/productos/:id` (se sacan a funciones si hace falta).
- `app/config.ejemplo.php` y `README.md`: `url_publica` (ej. `http://s1115824141.onlinehome.mx`). Si está vacía, no se ponen `og:url` ni `og:image`.
- Aviso para el usuario: WhatsApp guarda en caché la vista previa de cada enlace, y algunas versiones no muestran la imagen si el sitio no tiene HTTPS (pendiente 25).

## Prompt 5: verificación y memoria
- Local (http://localhost:8081, nunca IONOS para las pruebas de ataque), con `php8.5`:
  - `curl` de `/t/ropa`, `/p/<id>`, `/p/999999` y `/t/no-existe`: etiquetas correctas, escapadas (probar un nombre con `"<>&`), CSP igual que antes.
  - `/api/*` sin cambios.
- Chrome sin ventana a 1280 y 360 px:
  - Esqueletos visibles con la API lenta (limitar la red) y sin animación con movimiento reducido.
  - Botones deshabilitados y ocupados.
  - Sin scroll horizontal, cero errores de consola o CSP.
- Validar `og-necutla.png` (1200×630, menos de 300 KB).
- Revisión de reglas: sin hex sueltos, degradados, `style="`, `onclick`, `uppercase` ni emojis.
- Subir a IONOS por rsync solo con el permiso del usuario. Después, probar el enlace en un chat de WhatsApp.
- `plans/MEMORIA.md`: estado del plan, cambios hechos, excepción del pulso (si se quiere permanente, hay que pedir que se actualice `plans/CLAUDE.md`) y el pendiente de HTTPS para la vista previa.

## Archivos principales
`public/style.css`, `public/js/comun.js` (+ `portada.js`, `tienda.js`, `producto.js`, `promociones.js`,
`carrito.js`, `cuenta.js`, `necutools.js`), las 7 páginas HTML, `public/.htaccess`, `app/paginas.php` (nuevo),
`app/arranque.php`, `app/api.php` (sacar consultas a funciones), `app/config.ejemplo.php`, `README.md`,
`public/imagenes/og-necutla.png` y `recursos/og/og-necutla.svg`.
