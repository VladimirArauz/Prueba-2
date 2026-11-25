# Prompts: rediseño de la portada como tienda en línea

Plan: `plans/planes/2026-11-24-rediseno-tienda-en-linea.md`. Solo se corren cuando el usuario apruebe el diseño y los 5 cambios de regla.

## Prompt 0: reglas
Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan. Pide al usuario permiso para cambiar en `plans/CLAUDE.md` los 5 puntos de "Cambios a las reglas" y hazlo solo con su sí.

## Prompt 1: barra de la tienda y barra lateral
Lee `plans/CLAUDE.md` y el plan. Agrega la barra de la tienda (buscador grande, Mi cuenta, Carrito, fila de tiendas) en las páginas públicas, quita el buscador de la barra lateral y agrega "Mis pedidos" a la barra lateral. Conserva `id`, `data-action` y clases que usa `comun.js` (búsqueda, contador del carrito, menú). En celular, el botón de menú abre la barra lateral como hoy.

## Prompt 2: portada
Lee `plans/CLAUDE.md` y el plan. Reordena `public/index.html` y `public/js/portada.js`: banner de promociones con el tablero, beneficios, Ofertas de hoy, Compra por tienda, Lo más pedido (ruta `/api/portada/productos`, PDO con parámetros), opiniones y Conócenos con su menú. El texto actual de Qué es Necutla, Cómo funciona, la app y las preguntas se conserva sin cambios. Sin CLS: el servidor pinta lo que se ve al abrir.

## Prompt 3: tarjeta y rejilla de producto
Lee `plans/CLAUDE.md` y el plan. Tarjeta nueva (foto cuadrada, precio primero, calificación, tienda) en portada, tienda, promociones y búsqueda; rejilla 5 → 3 → 2. Conserva el carrusel de fotos al pasar el mouse.

## Prompt 4: ficha de producto
Lee `plans/CLAUDE.md` y el plan. Miniaturas, foto grande y caja de compra en `producto.html`, con el carrusel por color de hoy.

## Prompt 5: app de Android
Lee `plans/CLAUDE.md` y el plan. Lleva la misma estructura a Inicio, Tienda y Producto de la app, sube la versión y genera el APK como dice la regla vigente.

## Prompt 6: pruebas y subida
Lee `plans/CLAUDE.md` y el plan. Chrome a 1280, 360 y movimiento reducido (sin scroll horizontal, CLS menor a 0.02, sin errores de CSP), `ataques.js` contra localhost, Lighthouse local, y con permiso del usuario, subida a IONOS con respaldo previo.
