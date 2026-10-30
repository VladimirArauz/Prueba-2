# Prompts: ideas de 3 reels (esqueletos de carga, variantes de botón y vista previa en WhatsApp)

## Prompt 1: esqueletos de carga

Lee `plans/CLAUDE.md` y el plan `2026-10-29-reels-esqueletos-botones-open-graph.md`. Haz lo del "Prompt 1":
`.esqueleto`, `.esqueleto-card` y `.esqueleto-fila` en `public/style.css` (bloques planos `--linea`, pulso de
opacidad, nada con movimiento reducido, sin degradados) y `pintarEsqueletos()` en `public/js/comun.js`, llamado
antes de cada carga en portada, tienda, producto, promociones, carrito y el Resumen de Necutools. El pulso es una
excepción autorizada solo para este plan. Conserva todos los `id`, `data-action` y la lógica de la API.

## Prompt 2: variantes y estados de botón

Lee `plans/CLAUDE.md` y el plan. Haz lo del "Prompt 2": revisa que cada grupo de acciones tenga un solo botón
principal y que `.danger` solo se use para borrar o vaciar; agrega los estilos `.btn:disabled` y
`.btn[aria-busy="true"]` (sin spinner, contraste AA) y `botonOcupado()` / `botonListo()` en `comun.js`, y úsalos
en los envíos de `cuenta.js`, `producto.js` y `necutools.js`. Agrega la tabla "Qué botón usar" a `README.md`.

## Prompt 3: vista previa general

Lee `plans/CLAUDE.md` y el plan. Haz lo del "Prompt 3": `recursos/og/og-necutla.svg` con los tokens y la letra
Archivo, conviértelo a `public/imagenes/og-necutla.png` (1200×630, menos de 300 KB) con Chrome sin ventana y
pon el bloque `<!--og:inicio-->…<!--og:fin-->` con las etiquetas generales en `index.html`, `carrito.html`,
`promociones.html`, `cuenta.html`, `tienda.html` y `producto.html` (no en `necutools.html`). Documenta
`url_publica` en `app/config.ejemplo.php` y `README.md`.

## Prompt 4: vista previa por tienda y producto

Lee `plans/CLAUDE.md` y el plan. Haz lo del "Prompt 4": en `public/.htaccess`, manda esas páginas a
`api/index.php`; crea `app/paginas.php` (cargado desde `app/arranque.php`), que cambia el bloque `og` por las
etiquetas de la tienda o del producto (precio con la oferta de hoy, imagen solo si es PNG/JPG/WEBP), todo con
`htmlspecialchars`, consultas PDO con `?` reusando las de `app/api.php`, las mismas cabeceras (CSP, `no-cache`)
y las etiquetas generales si no existe o está oculto. `/api/*` no debe cambiar.

## Prompt 5: pruebas, subida y memoria

Lee `plans/CLAUDE.md` y el plan. Corre las pruebas del "Prompt 5" en local (http://localhost:8081, `php8.5`,
Chrome sin ventana a 1280 y 360 px), revisa las reglas de diseño y, solo con el permiso del usuario, sube a
IONOS por rsync (sin `app/config.php`) y agrega `url_publica` al `config.php` del servidor. Pide al usuario que
pruebe un enlace en WhatsApp. Actualiza `plans/MEMORIA.md` y el estado del plan.
