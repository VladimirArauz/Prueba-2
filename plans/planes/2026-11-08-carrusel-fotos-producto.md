# Varias fotos por producto con carrusel

- **Fecha:** 2026-11-08
- **Estado:** en curso
- **Prompts:** `plans/prompts/2026-11-08-carrusel-fotos-producto.md`
- **Alcance:** hasta 6 fotos por producto (la principal y 5 más), administradas en Necutools; carrusel en la página del producto y en las tarjetas. Solo productos, no servicios. No cambia el carrito, los pedidos ni el envío por WhatsApp.

## Decisiones del usuario

- **Excepción de diseño autorizada solo para este plan:** movimiento que no responde a una acción (`plans/CLAUDE.md`, "Movimiento"). Si quiere que sea regla, que pida actualizar `plans/CLAUDE.md`.
- Página del producto: cambia solo cada 4 segundos, en loop infinito, con deslizamiento suave. Sin zoom (prohibido).
- Tarjetas: el carrusel empieza cuando el cursor entra en la tarjeta; al salir, regresa a la primera foto. En pantallas táctiles se queda la primera.
- Colores: al elegir un color se muestra su foto y el carrusel se detiene. El color que se elige solo al cargar no lo detiene.
- Máximo 6 fotos por producto.

## Diseño técnico

- Tabla nueva `producto_fotos` en `db/mariadb/schema.sql`. La foto principal sigue en `productos.imagen`: no se mueve ningún dato.
- `GET /api/productos/:id/fotos/:foto`, pública si el producto es visible. Queda bajo `Allow: /api/productos/` y sin `noindex`, igual que las demás fotos públicas.
- `fotos` en la respuesta pública: principal (si no es un SVG de ejemplo) y las extra.
- Necutools: `POST /api/admin/productos/:id/fotos`, `PUT /api/admin/productos/:id/fotos/orden` y `DELETE /api/admin/fotos/:id`, con `requiere_admin()` y permiso sobre la tienda.
- Accesibilidad: flechas y puntos para cambiar a mano, pausa con el mouse, el foco o la pestaña oculta; con `prefers-reduced-motion` no cambia solo.

## Riesgos

- **Orden al subir:** `COLUMNAS_PRODUCTO` lee `producto_fotos`. Si el código llega a IONOS antes que la tabla, se rompen las tiendas: primero el SQL.
- Cada foto cuenta en el límite de 300 peticiones cada 15 minutos por IP de la API. Las tarjetas solo piden fotos al pasar el cursor, y el navegador las guarda un día.

## Verificación

1280, 360 y movimiento reducido: loop, flechas, puntos, pausa, color, hover en tarjetas, CLS 0, sin scroll horizontal ni errores. Rutas nuevas: sin sesión 401, otra tienda rechazada, archivo falso rechazado y máximo de fotos. Subir a IONOS solo con permiso del usuario.
