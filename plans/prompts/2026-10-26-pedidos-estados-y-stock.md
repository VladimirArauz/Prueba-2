# Prompts: pedidos con estados, edición y stock

## Prompt 1: base de datos

Lee `plans/CLAUDE.md` y el plan `2026-10-26-pedidos-estados-y-stock.md`. Agrega a `db/mariadb/schema.sql` lo de
la sección 1 (stock en productos y colores, `pedido_items`, `pedido_paquete_colores`, `movimientos_stock`,
estados nuevos y la migración del JSON), idempotente. Córrelo 2 veces en el MariaDB local y después en IONOS
por SSH (contraseña solo por stdin), antes de subir código. Confirma tablas y conteos.

## Prompt 2: stock en productos, tarjetas y carrito

Lee `plans/CLAUDE.md` y el plan. Haz lo de la sección 2 para `app/admin.php` (stock obligatorio en productos y
colores, ajustes en `movimientos_stock`) y `app/api.php` (`agotado` en tarjetas y detalle, colores agotados,
faltantes en `calcular_carrito`). No publiques el número exacto de stock.

## Prompt 3: estados y edición de pedidos

Lee `plans/CLAUDE.md` y el plan. Haz lo de la sección 2 para `app/pedidos.php`: estados en_proceso/pagado/
cancelado, `pedido_items` al guardar, transiciones con stock en transacción, `PUT /admin/pedidos/:id/items`,
`GET /admin/pedidos/articulos` y el resumen con los estados nuevos. Prueba los permisos por tienda.

## Prompt 4: Necutools

Lee `plans/CLAUDE.md` y el plan. Haz la sección 3: pestaña Pedidos con estados y acciones, editor del pedido
(solo artículos de la tienda del pedido) y campo Stock en productos y colores. Solo tokens y clases existentes.

## Prompt 5: público, pruebas y subida

Lee `plans/CLAUDE.md` y el plan. Haz la sección 4, corre las pruebas de la sección 7, sube a IONOS por rsync
(sin `app/config.php`), prueba en vivo y actualiza `plans/MEMORIA.md` y el estado del plan.
