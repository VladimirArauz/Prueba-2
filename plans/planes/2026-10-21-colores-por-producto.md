# Plan: colores de un mismo producto (barra de colores)

- **Fecha:** 2026-10-21
- **Estado:** aplicado
- **Prompts:** `plans/prompts/2026-10-21-colores-por-producto.md`
- **Alcance:** Necutools (formulario de productos), base de datos, API pública, página del producto, tarjetas, carrito, mensaje de WhatsApp y pedidos.

## 1. Contexto

Hoy cada producto tiene una sola imagen (`productos.imagen`). Si una tienda tiene los mismos audífonos en 5 colores, tiene que crear 5 productos. El usuario quiere crear **un solo producto** y agregarle solo los colores que maneja, cada uno con su foto. El estudiante abre el producto y ve una **barra de colores**: al tocar uno cambia la foto, y el color elegido viaja al carrito y al mensaje de WhatsApp.

Decisiones tomadas (se pueden cambiar antes de aplicar):
- Todos los colores cuestan lo mismo (precio y ofertas del producto).
- Cada color tiene: nombre ("Rojo"), muestra de color (selector de color), foto (hasta 1 MB) y casilla "Disponible" (si no, sale como "Agotado" y no se puede elegir).
- Máximo 12 colores por producto. Los colores son opcionales: un producto sin colores funciona igual que hoy.

## 2. Base de datos (`db/schema.sql`, idempotente)

```sql
CREATE TABLE IF NOT EXISTS producto_colores (
  id SERIAL PRIMARY KEY,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  nombre VARCHAR(30) NOT NULL,
  hex CHAR(7) NOT NULL CHECK (hex ~ '^#[0-9a-f]{6}$'),
  imagen BYTEA, imagen_tipo VARCHAR(30),
  disponible BOOLEAN NOT NULL DEFAULT true,
  orden INTEGER NOT NULL DEFAULT 0,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS producto_colores_nombre_idx ON producto_colores (producto_id, lower(nombre));
CREATE INDEX IF NOT EXISTS producto_colores_producto_idx ON producto_colores (producto_id, orden);
```
Agregar `producto_colores` a `TABLAS` de `server/imagenes.js` no hace falta (la migración ya corrió); las fotos nuevas pasan por `limpiarMetadatos` al subirlas.

## 3. API de Necutools (`server/admin.js`)

Rutas separadas por color, porque el JSON con imagen tiene límite de 2 MB (`jsonConImagen` en `server/index.js`) y no caben varias fotos en una sola petición. Registrar estas rutas con `jsonConImagen` igual que `/admin/productos`.
- `GET /admin/productos` agrega `colores` (lista `{id, nombre, hex, disponible, orden, imagen_url}`) con un `json_agg` ordenado.
- `POST /admin/productos/:id/colores`: usa `exigirProducto` (permisos de tienda), solo para `tipo = 'producto'`, máximo 12, nombre con `v.texto(…, {max: 30, requerido: true})`, hex validado con regex y pasado a minúsculas, imagen con `imagenDe(body)` (requerida al crear), `disponible` con `v.booleano`, `orden` con `v.entero`. Nombre repetido → 409 "Ese color ya está en el producto.".
- `PUT /admin/colores/:id` (imagen opcional, mismo patrón `CASE WHEN $n::bytea IS NOT NULL` que `PUT /productos/:id`) y `DELETE /admin/colores/:id`; las dos buscan el color, su producto y llaman `exigirStand`.
- Cada cambio toca `productos.actualizado_en` y se anota con `anotar(req.admin, …, "producto_colores", …)`.
- Si un producto pasa a `servicio`, se borran sus colores.

## 4. API pública (`server/api.js`)

- `GET /colores/:id/imagen`: igual que `/productos/:id/imagen`, con `servirImagen` y `publica = p.visible AND s.visible`.
- `COLUMNAS_PRODUCTO` agrega `(SELECT count(*)::int FROM producto_colores c WHERE c.producto_id = p.id) AS total_colores`; `productoPublico` devuelve `colores_total`.
- `GET /productos/:id` agrega `colores: [{id, nombre, hex, disponible, imagen_url}]` ordenados por `orden, id`. Si el color no tiene foto, `imagen_url` es la del producto.
- Carrito: `leerCarrito` acepta `color` opcional (`idValido`); la clave pasa a `producto-<id>` o `producto-<id>-c<color>`. `calcularCarrito` carga los colores pedidos y:
  - si el producto tiene colores y el item no trae color, o el color no es de ese producto o no está disponible → va a `faltantes`;
  - el item devuelve `color: {id, nombre}` y `nombre: "Audífonos inalámbricos (Rojo)"`.
- `server/pedidos.js`: guardar `color` en `items` del pedido y usarlo en la huella. El resumen del dashboard sigue agrupando por producto.

## 5. Necutools (`public/necutools.html`, `public/js/necutools.js`)

- Debajo del formulario de producto, un bloque **"Colores"** (`<fieldset id="prod-colores">`) que solo sale con `tipo = producto`:
  - Al crear: texto "Guarda el producto y luego agrega sus colores." Después de guardar un producto nuevo, el formulario pasa directo a editarlo (no a `cancelarProducto`) para poder agregar colores en seguida.
  - Al editar: lista de colores (miniatura, muestra, nombre, Disponible/Agotado, botones Editar y Eliminar) y un mini formulario: Nombre del color, Color (`<input type="color">`), Foto del color (reusar `leerImagen`), casilla Disponible, botón "Agregar color" (secundario; el principal sigue siendo "Guardar").
- En la tabla del catálogo, `cell-sub` agrega "· 5 colores".
- Eventos con `data-action` (`color-editar`, `color-borrar`) en el listener delegado existente; nada de `onclick` ni `style=`.

## 6. Tienda, página del producto y carrito (público)

- **Barra de colores** en `public/producto.html` (debajo del precio, antes del botón): `<fieldset class="color-barra"><legend>Color: Rojo</legend>…</fieldset>` con un radio por color (`visually-hidden`) y su `label` = círculo de muestra + nombre. Agotados: `disabled` y texto "Agotado".
  - La muestra usa una clase `.color-muestra { background: var(--muestra); border: 2px solid var(--linea) }`; el JS pone `el.style.setProperty("--muestra", hex)` (CSSOM, lo permite la CSP; no es `style=` en el HTML). El color elegido lleva borde `--tinta` de 2px.
  - Al elegir: cambia `#producto-img` (src y alt "Audífonos, color rojo"), el texto de la leyenda y `?color=<id>` en la URL (con `history.replaceState`) para poder compartirla. Al entrar, se elige el de la URL o el primero disponible.
  - Si ningún color está disponible, el botón dice "Agotado en todos los colores" y está deshabilitado.
- **Tarjetas** (`tarjetaProducto` / `accionProducto` en `public/js/comun.js`): si `colores_total > 0`, el botón es un enlace secundario "Elegir color" a `/p/<id>` y se agrega la etiqueta "5 colores".
- **Carrito** (`public/js/comun.js` y `public/js/carrito.js`): `agregarAlCarrito(tipo, id, nombre, color)`; un mismo producto en dos colores son dos renglones. Una función `claveItem(i)` reemplaza los `${tipo}-${id}` repetidos (filaItem, quitar, enviar, faltantes, registrarPedido), y `cambiarCantidad` recibe el color (`data-color`). `leerCarrito` acepta `color` entero opcional.
- **WhatsApp** (`mensajeDe`): el nombre ya llega con el color ("• *Audífonos inalámbricos (Rojo)* x2 = $…"); no cambia nada más.
- Estilos nuevos solo en `public/style.css`, con tokens existentes. Excepción a reportar: el relleno de la muestra es el color real del producto (dato del vendedor), no un color de interfaz. Se avisa al usuario al terminar.

## 7. Verificación

1. Base local (PostgreSQL 17 de esta máquina, nunca Render): `npm run dev`, el servidor arranca y crea `producto_colores` sin error; reiniciar otra vez para confirmar que el schema es idempotente.
2. Necutools: crear "Audífonos inalámbricos" en Tecnología → queda en edición → agregar 5 colores con foto (usar fotos de `recursos/fotos-tecnologia/`), marcar uno como no disponible, editar uno, borrar uno. Probar permisos: un encargado no puede tocar colores de otra tienda (403).
3. Tienda Tecnología: la tarjeta dice "4 colores" y "Elegir color". En `/p/<id>`: la barra cambia la foto, el agotado no se elige, `?color=` funciona al recargar.
4. Carrito: agregar Rojo x2 y Azul x1 → dos renglones; subir/bajar cantidad y quitar cada uno por separado; el mensaje de WhatsApp lleva los colores; el pedido aparece en Necutools → Resumen.
5. Manipular el carrito: color de otro producto, color agotado o sin color → el servidor lo manda a faltantes.
6. Producto sin colores: todo igual que antes.
7. 1280 px y 360 px sin scroll horizontal, navegación con teclado en la barra de colores, cero errores de consola o CSP, y `node scripts/seguridad/ataques.js` sin fallos.

## 8. Prompts

En `plans/prompts/2026-10-21-colores-por-producto.md`, en orden de ejecución. Al empezar el prompt 1, el estado del plan pasa a `en curso`.
