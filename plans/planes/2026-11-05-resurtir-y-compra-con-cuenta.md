# Plan: productos por resurtir y compra con cuenta

- **Fecha:** 2026-11-05
- **Estado:** aplicado
- **Prompts:** `plans/prompts/2026-11-05-resurtir-y-compra-con-cuenta.md`
- **Alcance:** Necutools (mínimo de stock y lista por resurtir), carrito y servicios (cuenta obligatoria), nombre autorrellenado, pedidos ligados a la cuenta y textos legales.


## Context

Hoy la lista de Productos de Necutools muestra todo el catálogo y no hay forma de avisar cuándo resurtir. Además, cualquiera manda un pedido sin cuenta: `POST /api/pedidos` es público y los números de WhatsApp salen en la API pública. El usuario lo ve como vulnerabilidad. También quiere que el nombre del carrito deje de ser opcional y se rellene con el nombre registrado.

La pestaña Bitácora no tiene lista de productos. El usuario confirmó que el cambio va en la lista de **Productos**.

## Decisiones

**Del usuario:**
- La lista de Productos abre solo con lo que está por agotarse; un filtro deja ver todos, porque hace falta para editar.
- Sin cuenta se puede ver el catálogo y agregar al carrito. Abrir el carrito pide iniciar sesión y conserva lo agregado.
- El servidor solo entrega los números de WhatsApp con sesión. Pedir un servicio también pide cuenta.
- El nombre se autorrellena, es obligatorio y se puede editar. El pedido queda ligado a la cuenta y la tienda ve quién lo hizo.

**Propuestas en este plan (cambiarlas aquí si no convencen):**
- `stock_minimo` es obligatorio con valor 0 por omisión. Un producto aparece si su stock es menor o igual al mínimo, así que los agotados siempre salen aunque nadie ponga mínimo.
- Con colores hay un solo mínimo por producto y se compara contra cada color. La fila dice qué colores faltan ("Rojo: 2").
- No entran servicios, productos ocultos ni productos sin stock capturado (esos ya tienen su filtro "Falta capturar el stock").
- La tienda ve solo el nombre del cliente, nunca su teléfono ni su correo.
- Una cuenta incompleta (sin teléfono o sin casilla de edad) no puede comprar hasta completarla.
- Con `cuentas_clientes` en false todo funciona como hoy, sin exigir cuenta. Si no, nadie podría comprar durante una pausa.
- Los pedidos viejos se quedan sin cliente y se muestran como "Sin cuenta". Eliminar una cuenta deja el pedido sin cliente.

## Cambios

### Base (`db/mariadb/schema.sql`, idempotente)
- `productos.stock_minimo INT NOT NULL DEFAULT 0` con su `CHECK >= 0`.
- `pedidos.cliente_id` nulo, con el mismo tipo que `clientes.id`, índice y FK `ON DELETE SET NULL`.

### Mínimo y lista por resurtir
- `app/admin.php`: validar `stock_minimo` con `v_entero` y `MAX_STOCK` (usa el arreglo de datos del producto, cerca de la línea 100), guardarlo en el `INSERT` y el `UPDATE`, y agregar en `GET /api/admin/productos` los campos `stock_minimo`, `por_resurtir` y `colores_por_resurtir`.
- `public/necutools.html`: campo "Mínimo para resurtir" junto al stock, que se queda visible en productos con colores (hoy `prod-stock-group` se oculta), y opción "Por resurtir" en `#prod-stock-filtro`, elegida por omisión.
- `public/js/necutools.js`: filtro en `renderProductos`, colores y mínimo en la fila, mensaje de lista vacía que invita a elegir "Todos", y que `editar` y guardar manden y lean el mínimo.
- Ojo: un producto nuevo con stock suficiente no saldrá en la lista por resurtir. El aviso al guardar debe decir que está en "Todos".

### Compra con cuenta (servidor)
- `app/clientes.php`: `requiere_cliente()` hoy dice "para opinar"; darle un mensaje por parámetro. Función nueva `requiere_comprador()`: en pausa devuelve null; sin sesión da 401; con cuenta incompleta da 403.
- `app/pedidos.php`:
  - `POST /api/pedidos` llama a `requiere_comprador()` antes del captcha y guarda `cliente_id`.
  - La huella usa el id del cliente en vez de la IP. Así, dos estudiantes en la red de la escuela con el mismo carrito ya no se toman como repetidos.
  - Límite por cuenta además del de IP.
  - `COLUMNAS_PEDIDO` y `UNIR_PEDIDO` traen el nombre del cliente con `LEFT JOIN`.
- `app/api.php`: función `numeros_para_cliente()` que devuelve lista vacía sin comprador. Usarla en `/api/config` (línea 254), `/api/stands/:slug` (290), `/api/productos/:id` (346), y en los grupos de `calcular_carrito` (146, 213, 229). `/api/carrito/precios` sigue siendo público para no romper otras páginas, pero sin números.

### Carrito y servicios (front)
- `public/js/comun.js`: reutilizar `/api/clientes/sesion` (ya trae `nombre` e `incompleta`) con una función `sesionCompra()` y un `irACuenta()` que manda a `/cuenta.html?volver=…`.
- `public/js/carrito.js`:
  - Sin sesión: mostrar una tarjeta "Inicia sesión para ver tu carrito" con su botón, sin tocar el carrito guardado.
  - Con cuenta incompleta: mandar a completarla.
  - Rellenar `#order-customer-name` con `sesion.nombre`.
  - `enviar()` exige el nombre: si está vacío, marca el error y pone el foco, sin abrir WhatsApp.
  - Si `registrarPedido` recibe 401 porque venció la sesión, avisar con `avisarError`.
- `public/carrito.html`: label "Tu nombre", `required`, sin "(opcional)".
- `public/js/tienda.js` (`pedirServicio`) y `public/js/producto.js`: sin sesión, llevar a iniciar sesión en vez de abrir WhatsApp. Si no, `abrirWhatsApp` diría que la tienda no tiene números.
- `public/js/cuenta.js`:
  - `destinoDeVuelta` rechaza `/carrito.html` porque su expresión no acepta el punto: agregarlo, cuidando seguir rechazando `//`.
  - "Volver al producto" debe decir "Volver al carrito" cuando vuelva ahí.

### Textos (dicen hoy que no hace falta cuenta)
- `public/index.html` líneas 191, 223 y 247; `public/terminos.html` 113; `public/privacidad.html` 104 y 109, con fecha nueva.
- Texto `cart-privacidad` en `carrito.js`, `public/necutools.html` línea 211 y `README.md`.
- `public/cuenta.html` línea 99 solo se ve con cuentas en pausa y sigue siendo cierta.

## Prompts (en orden)

1. Base y mínimo: columnas, API de productos, formulario y lista por resurtir.
2. Servidor de compra: `requiere_comprador`, pedidos con cliente, números solo con sesión y columna Cliente en Pedidos de Necutools.
3. Front de compra: carrito con sesión, nombre obligatorio, servicios y regreso desde Mi cuenta.
4. Textos: portada, términos, aviso de privacidad y `README.md`.
5. Pruebas, `ataques.js` y `plans/MEMORIA.md`. La subida a IONOS se hace solo con permiso del usuario.

Cada prompt empieza pidiendo leer `plans/CLAUDE.md` y este plan.

## Subida a IONOS (cuando el usuario la autorice)

1. Respaldar `pedidos` y `productos`, y correr el `schema.sql` **antes** de subir el código: el código nuevo falla si no existe `cliente_id`.
2. Subir por rsync los archivos de `app/` y `public/`, con respaldo previo.
3. Los 2 clientes reales verán "Completa tu cuenta" antes de poder comprar.

## Verificación

- Schema corrido 2 veces sin error en local.
- API con `curl` en local:
  - `POST /api/pedidos` sin sesión da 401; con cuenta incompleta, 403; con cuenta completa, 201 y `cliente_id` guardado.
  - `/api/config`, `/api/stands/:slug`, `/api/productos/:id` y `/api/carrito/precios` sin sesión no traen números; con sesión, sí.
  - Con `cuentas_clientes` en false, todo responde como hoy.
  - Encargado sin acceso a pedidos de otra tienda, y sin teléfono ni correo del cliente en ninguna respuesta.
  - Eliminar una cuenta deja sus pedidos con `cliente_id` nulo.
- Stock: producto con stock igual al mínimo sale en la lista; con uno más, no; agotado sin mínimo, sí; color bajo con otro alto, sí, y dice cuál; servicio, oculto y sin stock capturado, no.
- `scripts/seguridad/ataques.js`: ajustar las pruebas que mandan pedidos sin sesión, agregar las nuevas y correrlo solo contra localhost con Node aparte.
- Chrome sin ventana a 1280, 360 px y con movimiento reducido: carrito sin sesión → entrar → regresa al carrito con lo agregado y el nombre puesto; nombre vacío bloquea el envío; servicio sin sesión lleva a iniciar sesión; filtro de Productos; sin scroll horizontal ni errores de consola o CSP.
- Borrar los datos de prueba locales al terminar.
