# Plan: pedidos con estados, edición y stock

- **Fecha:** 2026-10-26
- **Estado:** aplicado (2026-10-26; base y código en IONOS)
- **Prompts:** `plans/prompts/2026-10-26-pedidos-estados-y-stock.md`
- **Alcance:** `db/mariadb/schema.sql` (+ la base de IONOS), `app/pedidos.php`, `app/api.php`, `app/admin.php`,
  `public/necutools.html`, `public/js/necutools.js`, `public/js/comun.js`, `public/js/producto.js`,
  `public/js/carrito.js`, `public/style.css`. Se sube a IONOS por SSH/rsync.

## Contexto

Hoy cada "Enviar pedido por WhatsApp" ya guarda un pedido (`pedidos`, con los artículos en JSON) y Necutools
tiene la pestaña **Pedidos** con estados pendiente / vendido / cancelado. Los encargados ya ven solo los de sus
tiendas (`tiendas_de_admin()` y `en_alcance()` en `app/pedidos.php`). Lo que falta:

1. Estados **En proceso**, **Pagado** y **Cancelado**.
2. **Editar** un pedido en proceso: cambiar cantidades, quitar artículos y agregar artículos, pero solo de las
   tiendas asignadas a quien está en Necutools.
3. **Stock**: hoy no existe (solo "Disponible / Pocas piezas / Por pedido"). Al pasar a Pagado se descuenta.

Decisiones del usuario (2026-10-26):
- Stock **por producto y por color** (si el producto tiene colores, cada color lleva el suyo). Los servicios no
  llevan stock.
- Stock **obligatorio** para todo producto.
- Stock en 0 → **Agotado**: la tarjeta lo dice, el botón se desactiva y el servidor lo manda a faltantes.
- Un pedido **pagado puede volver a En proceso**: regresa el stock y se puede editar otra vez.

## 1. Base de datos (idempotente, en `db/mariadb/schema.sql`; se corre en local y en IONOS)

- `productos.stock INT NULL` y `producto_colores.stock INT NULL`, con `CHECK (stock IS NULL OR stock >= 0)`.
  NULL = "falta capturar". Necutools lo exige al guardar; mientras sea NULL, el producto se trata como agotado.
- **Tabla nueva `pedido_items`** (los artículos dejan de vivir en JSON para poder editarlos y descontar stock):
  `id, pedido_id (FK CASCADE), tipo ('producto'|'paquete'), producto_id (FK SET NULL), color_id (FK SET NULL),
  promocion_id (FK SET NULL), nombre VARCHAR(160), cantidad SMALLINT (1–30), precio DECIMAL(10,2) NULL,
  subtotal DECIMAL(10,2) NULL, orden`. Índices por `pedido_id` y `producto_id`.
- **Tabla nueva `pedido_paquete_colores`** `(pedido_item_id, producto_id, color_id)`: el color que se eligió para
  cada producto con colores dentro de un paquete (hoy el color de un paquete se acuerda por WhatsApp).
- **Tabla nueva `movimientos_stock`**: `id, producto_id, color_id NULL, pedido_id NULL, cambio INT (−/+),
  motivo ('pago'|'reversa'|'ajuste'), admin_id, creado_en`. Sirve para la bitácora y para devolver
  exactamente lo que se descontó (aunque el pedido se edite después).
- `pedidos`: estados nuevos. `UPDATE` de `pendiente → en_proceso` y `vendido → pagado`; se quita
  `pedidos_estado_check` y se crea `pedidos_estado_check2 CHECK (estado IN ('en_proceso','pagado','cancelado'))`
  y `DEFAULT 'en_proceso'`. (Probar en el MariaDB 10.4 de XAMPP y en el 11.8 de IONOS que se puede correr 2 veces.)
- Migración única (tabla `migraciones`, clave `pedido-items-2026-10-26`): copia el JSON de cada pedido a
  `pedido_items`. La columna `pedidos.items` se conserva y se sigue llenando, para no borrar datos.
- Los pedidos que ya estaban "vendido" pasan a pagado **sin** descontar stock (no hay movimientos); si se
  regresan a En proceso no devuelven nada.

## 2. Servidor

**`app/pedidos.php`**
- `ESTADOS_PEDIDO = ['en_proceso', 'pagado', 'cancelado']`. `POST /api/pedidos` guarda también en
  `pedido_items` (dentro de una transacción) y rechaza lo agotado (ya llega filtrado por `calcular_carrito`).
- `GET /api/admin/pedidos`: trae los artículos de `pedido_items` (con `color`, `stock` actual y si la línea
  tiene colores pendientes de elegir); contador `en_proceso` en lugar de `pendientes`. Mismo alcance por tienda.
- `PUT /api/admin/pedidos/:id` (estado y nota), con estas transiciones, todo en una transacción con
  `SELECT … FOR UPDATE` sobre el pedido y las filas de stock:
  - en_proceso → pagado: revisa que alcance el stock de cada línea (y de cada producto de los paquetes, por
    color si tiene). Si no alcanza: 409 "Solo quedan N de X". Si alcanza, descuenta y escribe `movimientos_stock`
    (`pago`). Un paquete con un producto de colores sin color elegido: 400 "Elige el color de X".
  - pagado → en_proceso o pagado → cancelado: devuelve la suma de sus movimientos (`reversa`).
  - en_proceso ↔ cancelado: sin stock.
- **`PUT /api/admin/pedidos/:id/items`** (nuevo, solo En proceso): recibe la lista completa
  `[{tipo, id, color, cantidad}]` y la reemplaza. Reglas:
  - Cada producto nuevo debe ser de **la tienda del pedido** y esa tienda de quien edita (`puede_editar_stand`);
    un pedido de tienda no acepta paquetes. Los paquetes (pedido sin tienda) solo los edita un dueño y solo aceptan
    paquetes y el color de sus productos.
  - Precio y subtotal los pone el servidor (reusar el cálculo de `calcular_carrito` en `app/api.php`, sacando una
    función para una sola línea si hace falta). Recalcula `total` y `piezas`; mismos topes (30 piezas, 15 líneas).
  - Permite pedir más de lo que hay en stock (el pedido todavía no está pagado), pero la respuesta avisa por línea.
  - `anotar()` en la bitácora con el antes y el después.
- **`GET /api/admin/pedidos/articulos?tienda=`** (nuevo): productos y colores de esa tienda para el buscador de
  "Agregar artículo" (nombre, precio, stock), con el mismo permiso por tienda.
- `GET /api/admin/resumen`: "Ventas" pasa a contar `pagado`; "Por hacer" cuenta `en_proceso`.

**`app/admin.php`**: crear y editar producto exige `stock` (entero ≥ 0) si es producto sin colores; cada color
exige su `stock`. `GET /admin/productos` trae `stock` y `colores[].stock`. Filtro "Falta stock". Un ajuste a mano
del stock escribe `movimientos_stock` (`ajuste`).

**`app/api.php`**: tarjetas y detalle llevan `agotado` (stock 0 o NULL; con colores, todos los colores
agotados) y cada color `disponible = disponible && stock > 0`. **No** se publica el número exacto.
`calcular_carrito`: un producto o color agotado, o una cantidad mayor que el stock, va a faltantes con el
mensaje "Solo quedan N" o "Agotado".

## 3. Necutools (`public/necutools.html`, `public/js/necutools.js`)

- Pestaña **Pedidos**: filtros En proceso / Pagado / Cancelado / Todos; etiqueta de estado con las clases que ya
  existen (`estadoPedido`), contador del menú = en proceso.
- Acciones por estado (un solo botón principal por grupo):
  - En proceso: **Editar pedido**, **Marcar como pagado** (principal), **Cancelar pedido** (`danger`, con
    confirmación).
  - Pagado: **Regresar a en proceso** (avisa que el stock vuelve).
  - Cancelado: **Reabrir pedido**.
- **Editar pedido**: tarjeta con las líneas (cantidad con −/+, quitar), "Agregar artículo" con buscador que solo
  muestra productos de la tienda del pedido, selector de color si aplica, stock disponible al lado y total que se
  actualiza; **Guardar cambios** / **Cancelar**. En paquetes: selector de color por cada producto con colores.
- Formulario de producto: campo **Stock** (obligatorio) y **Stock** por color en la tarjeta de colores; en el
  catálogo, "Agotado" o "Falta stock".
- Solo tokens y clases de `style.css`; sin `style="…"`, `onclick` ni emojis; `escapeHTML` en todo dato.

## 4. Público

`comun.js` (`tarjetaProducto`, `accionProducto`): etiqueta "Agotado" con `.status-badge` y botón deshabilitado.
`producto.js`: colores agotados deshabilitados (ya existe para `disponible`). `carrito.js`: muestra los faltantes
con su mensaje (ya existe el bloque de faltantes).

## 5. Riesgo importante: al publicar, todo sale agotado

Como el stock es obligatorio y hoy ningún producto lo tiene, **en cuanto se suba el código los 37 productos
aparecerán como Agotado** hasta que alguien capture su stock en Necutools. Para que dure lo menos posible:
subir el código y capturar el stock enseguida (Necutools → Productos → filtro "Falta stock"). Los servicios no
cambian.

## 6. Despliegue en IONOS

1. Aplicar el bloque nuevo de `schema.sql` en IONOS por SSH con el cliente `mysql`, con la contraseña solo por
   stdin (igual que en la importación), **antes** de subir el código. Confirmar las tablas y que correrlo 2
   veces no falla.
2. Subir con `rsync` solo los archivos cambiados de `app/` y `public/` (nunca `app/config.php`).
3. Probar en vivo con `curl` (sin crear pedidos falsos en producción salvo uno de prueba que se cancela y se
   anota en la memoria).

## 7. Verificación

- **Local** (XAMPP, MariaDB `necutla`, PHP 8.5; nunca contra IONOS para pruebas de ataque):
  - schema 2 veces sin error; migración de JSON a `pedido_items` con los pedidos que haya.
  - API: encargado de Ropa no ve ni edita pedidos de Regalos (403) ni agrega un producto de Regalos a su pedido
    (403); pagar descuenta producto y color; sin stock suficiente 409 y nada cambia; pagado → en proceso
    devuelve exacto aunque se haya editado; paquete con color sin elegir 400; edición en pagado o cancelado 409;
    precio del navegador ignorado; carrito manda agotado a faltantes; producto sin stock no se guarda.
  - `scripts/seguridad/ataques.js` sigue pasando (se ajustan los estados viejos en las pruebas). Node no está en
    esta máquina: si no se puede correr, se dice y se prueba con `curl` + PHP CLI.
  - Navegador (si hay herramienta): Pedidos a 1280 y 360 px, editar, pagar, regresar; sin scroll horizontal ni
    errores de CSP.
- **IONOS**: `/healthz`, tablas creadas, `/api/stands` con `agotado`, Necutools → Pedidos carga (con el usuario).
- Actualizar `plans/MEMORIA.md` y el estado de este plan.

## Prompts (en `plans/prompts/2026-10-26-pedidos-estados-y-stock.md`)

Todos empiezan pidiendo leer `plans/CLAUDE.md` y este plan.
1. Base: schema local + IONOS (secciones 1 y 6.1).
2. Servidor: stock en productos y colores, carrito y tarjetas con agotado (secciones 2 `admin.php` / `api.php`).
3. Servidor: estados, transiciones con stock y edición de pedidos (sección 2 `pedidos.php`).
4. Necutools: pestaña Pedidos y editor, campo Stock (sección 3).
5. Público, pruebas, subida a IONOS y memoria (secciones 4, 6.2–6.3 y 7).
