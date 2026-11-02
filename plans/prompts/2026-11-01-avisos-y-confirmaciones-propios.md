# Prompts: avisos y confirmaciones propios en lugar de alert, confirm y prompt

Plan: `plans/planes/2026-11-01-avisos-y-confirmaciones-propios.md`. Correr en orden.


### Prompt 0 — guardar el plan
Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y este plan. Guarda el plan en `plans/planes/2026-11-01-avisos-y-confirmaciones-propios.md` (sin la sección de prompts) y los prompts en `plans/prompts/2026-11-01-avisos-y-confirmaciones-propios.md`. Agrega la fila a la tabla de planes de `plans/MEMORIA.md`.

### Prompt 1 — ventana y toast con tipos
Lee `plans/CLAUDE.md` y `plans/planes/2026-11-01-avisos-y-confirmaciones-propios.md`. Agrega el icono `triangle-alert` a `public/iconos.js`, las funciones `confirmar`, `pedirTexto`, `avisarError` y el tercer parámetro de `showToast` en `public/js/comun.js`, y los estilos de la sección "Diseño" en `public/style.css`, solo con tokens existentes (la sombra `--sombra-2` es la excepción autorizada). Pruébalo en local con una página que las llame desde la consola, a 1280 y 360 px, con teclado y con movimiento reducido.

### Prompt 2 — Necutools
Lee `plans/CLAUDE.md` y el plan. Cambia en `public/js/necutools.js` los 9 `confirm`, el `prompt` de la nota y los `alert` por `confirmar`, `pedirTexto` y `avisarError`, con títulos y botones de acción exacta según la sección "Diseño". No cambies lo que hace cada acción. Prueba en local con un dueño de prueba los flujos de la verificación 2 y 3.

### Prompt 3 — páginas públicas
Lee `plans/CLAUDE.md` y el plan. Cambia el `confirm` de `public/js/carrito.js` (vaciar) y de `public/js/producto.js` (borrar opinión) y el `alert` de `abrirWhatsApp` en `public/js/comun.js`. Confirma con `grep` que ya no queda ningún `alert(`, `confirm(` ni `prompt(` en `public/`. Prueba la verificación 4.

### Prompt 4 — verificación, subida y memoria
Lee `plans/CLAUDE.md` y el plan. Corre la verificación completa (puntos 1 a 6), borra los datos de prueba, documenta las funciones en `README.md`, sube a IONOS por rsync y revisa en vivo, haz el commit en `main` y actualiza `plans/MEMORIA.md` (estado del plan, cambios hechos con fecha y archivos, la excepción de la sombra solo para este plan y el pendiente de que el usuario lo revise en su navegador). Cambia el estado del plan a "aplicado".
