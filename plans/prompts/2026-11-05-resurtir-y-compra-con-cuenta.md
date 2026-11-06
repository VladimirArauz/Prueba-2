# Prompts: productos por resurtir y compra con cuenta

Plan: `plans/planes/2026-11-05-resurtir-y-compra-con-cuenta.md`. Se corren en orden, uno por uno.

## Prompt 1: base y mínimo de stock

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan `plans/planes/2026-11-05-resurtir-y-compra-con-cuenta.md`. Cambia su estado a `en curso`.

Aplica las secciones "Base" y "Mínimo y lista por resurtir":
1. En `db/mariadb/schema.sql` agrega, de forma idempotente, `productos.stock_minimo` (`INT NOT NULL DEFAULT 0`, con `CHECK >= 0`) y `pedidos.cliente_id` (nulo, del mismo tipo que `clientes.id`, con índice y FK `ON DELETE SET NULL`). Agrégalo también al `CREATE TABLE` si así se hizo con otras columnas. Córrelo 2 veces en la base local.
2. En `app/admin.php` valida `stock_minimo` y guárdalo al crear y editar. En `GET /api/admin/productos` agrega `stock_minimo`, `por_resurtir` y `colores_por_resurtir`. Un producto cuenta si su stock es menor o igual al mínimo; con colores, el mínimo se compara contra cada color. No cuentan servicios, productos ocultos ni stock sin capturar.
3. En `public/necutools.html` agrega el campo "Mínimo para resurtir", visible también en productos con colores, y la opción "Por resurtir" en `#prod-stock-filtro`, elegida por omisión.
4. En `public/js/necutools.js` aplica el filtro, muestra qué colores faltan, invita a elegir "Todos" si la lista queda vacía y, si el producto guardado no sale en la lista, avisa que está en "Todos".

Usa solo tokens y clases de `public/style.css`. Prueba en local a 1280 y 360 px. No subas nada a IONOS.

## Prompt 2: servidor de compra

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan `plans/planes/2026-11-05-resurtir-y-compra-con-cuenta.md`.

Aplica "Compra con cuenta (servidor)":
1. En `app/clientes.php` dale a `requiere_cliente()` un mensaje por parámetro, sin cambiar el de las opiniones, y crea `requiere_comprador()`: en pausa (`cuentas_clientes` en false) devuelve null, sin sesión da 401 y con cuenta incompleta da 403.
2. En `app/pedidos.php`, `POST /api/pedidos` llama a `requiere_comprador()` antes del captcha y guarda `cliente_id`. La huella usa el id del cliente (la IP solo en pausa). Agrega un límite por cuenta además del de IP.
3. En la lista de pedidos de Necutools trae el nombre del cliente con `LEFT JOIN` y muéstralo en una columna "Cliente" en `public/necutools.html` y `public/js/necutools.js`, con `escapeHTML`. Sin cliente, muestra "Sin cuenta". Nunca devuelvas su teléfono ni su correo.
4. En `app/api.php` crea `numeros_para_cliente()` y úsala en todos los lugares que entregan números: `/api/config`, `/api/stands/:slug`, `/api/productos/:id` y los grupos de `calcular_carrito`. Busca con `grep` que no quede otro.
5. Revisa que `eliminar_cliente` deje los pedidos sin cliente y no los borre.

Prueba con `curl` en local cada caso del plan, también con `cuentas_clientes` en false. No subas nada a IONOS.

## Prompt 3: front de compra

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan `plans/planes/2026-11-05-resurtir-y-compra-con-cuenta.md`.

Aplica "Carrito y servicios (front)":
1. En `public/js/comun.js` crea `sesionCompra()` e `irACuenta()`, usando `/api/clientes/sesion` y respetando `cuentas` de `/api/config`.
2. En `public/js/carrito.js`: sin sesión, muestra la tarjeta "Inicia sesión para ver tu carrito" sin tocar el carrito guardado; con cuenta incompleta, manda a completarla; rellena `#order-customer-name` con el nombre registrado; `enviar()` exige el nombre (mensaje de error y foco, sin abrir WhatsApp); si `registrarPedido` recibe 401, avisa con `avisarError`.
3. En `public/carrito.html` deja el label "Tu nombre" y `required`.
4. En `public/js/tienda.js` y `public/js/producto.js`, pedir un servicio sin sesión lleva a iniciar sesión.
5. En `public/js/cuenta.js` deja que `destinoDeVuelta` acepte `/carrito.html` sin aceptar `//` ni otros dominios, y que el botón diga "Volver al carrito" cuando regrese ahí.

Prueba en Chrome sin ventana a 1280, 360 px y con movimiento reducido. No subas nada a IONOS.

## Prompt 4: textos

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan `plans/planes/2026-11-05-resurtir-y-compra-con-cuenta.md`.

Aplica "Textos". Corrige lo que hoy dice que no hace falta cuenta o que el pedido se guarda sin datos:
- `public/index.html`: "Cómo funciona" y las 2 preguntas frecuentes.
- `public/terminos.html`.
- `public/privacidad.html`: pedir exige cuenta, el pedido se liga a la cuenta, la tienda ve tu nombre y al eliminar la cuenta el pedido se queda sin cliente. Actualiza la fecha. No llenes los `[COMPLETAR]`.
- `cart-privacidad` en `public/js/carrito.js`, `public/necutools.html` y `README.md`.

Busca con `grep` otras frases que hayan quedado falsas. `public/cuenta.html` (aviso de pausa) se queda igual.

## Prompt 5: pruebas y cierre

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan `plans/planes/2026-11-05-resurtir-y-compra-con-cuenta.md`.

1. En `scripts/seguridad/ataques.js` ajusta las pruebas que mandan pedidos sin sesión y agrega pruebas para: pedido sin cuenta, cuenta incompleta, números ocultos sin sesión y cliente de otra sesión. Córrelo solo contra localhost, con Node bajado aparte.
2. Corre toda la sección "Verificación" del plan e informa cualquier falla con su salida.
3. Borra los datos de prueba locales.
4. Cambia el estado del plan a `aplicado` y actualiza `plans/MEMORIA.md`.
5. Haz commit solo si el usuario lo pide. Para subir a IONOS, pide permiso y sigue la sección "Subida a IONOS" del plan: el `schema.sql` va antes que el código. Nunca imprimas `secrets.md` ni `app/config.php`.
