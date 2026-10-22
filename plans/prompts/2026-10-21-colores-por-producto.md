# Prompts: colores de un mismo producto

Plan: `plans/planes/2026-10-21-colores-por-producto.md`. Ejecutar en orden, uno por sesión o seguidos.
Al empezar el prompt 1, cambia el estado del plan a `en curso`.

## Prompt 1: base de datos y API de colores

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y `plans/planes/2026-10-21-colores-por-producto.md`. Aplica las
secciones 2, 3 y 4 del plan: tabla `producto_colores` en `db/schema.sql` (idempotente), rutas de colores en
`server/admin.js` (con `exigirProducto`, `imagenDe`, `anotar` y el límite `jsonConImagen`), imagen pública
`/api/colores/:id/imagen`, `colores_total` y `colores` en `server/api.js`, y el color en `leerCarrito`,
`calcularCarrito` y `server/pedidos.js`. Valida todo en el servidor y usa SQL con parámetros. Prueba con una
base local (nunca Render) y reinicia dos veces para confirmar que el schema no falla.

## Prompt 2: colores en Necutools

Lee `plans/CLAUDE.md` y el plan `2026-10-21-colores-por-producto.md`. Aplica la sección 5: bloque "Colores"
en el formulario de productos de `public/necutools.html` y `public/js/necutools.js` (lista, agregar, editar,
borrar, disponible), pasar a edición después de crear un producto, y "· N colores" en el catálogo. Reusa
`leerImagen`, `api`, `enviar` y el listener delegado; sin `onclick` ni `style=`. Prueba creando unos audífonos
en Tecnología con 5 colores y revisa que un encargado no pueda tocar otra tienda.

## Prompt 3: barra de colores, tarjetas y carrito

Lee `plans/CLAUDE.md` y el plan `2026-10-21-colores-por-producto.md`. Aplica la sección 6: barra de colores
en `public/producto.html` y `public/js/producto.js` (cambia la foto, `?color=`, agotados), botón "Elegir
color" y etiqueta "N colores" en las tarjetas (`public/js/comun.js`), color en el carrito con `claveItem`
(`public/js/comun.js`, `public/js/carrito.js`) y en el mensaje de WhatsApp. Estilos solo en
`public/style.css` con tokens existentes; la muestra usa `--muestra` por CSSOM. Verifica a 1280 y 360 px,
con teclado y sin errores de consola o CSP.

## Prompt 4: verificación, memoria y commit

Lee `plans/CLAUDE.md` y el plan `2026-10-21-colores-por-producto.md`. Corre toda la sección 7 del plan
(incluido `node scripts/seguridad/ataques.js`). Cambia el estado del plan a `aplicado`, actualiza
`plans/MEMORIA.md` (tabla, cambios hechos y un pendiente con la excepción de diseño de la muestra de color)
y `README.md`. Haz commit en `main` (sin crear ramas) y pregunta antes del push.
