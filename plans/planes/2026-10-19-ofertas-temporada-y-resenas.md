# Plan: ofertas de temporada, remates, cuentas de cliente y opiniones

- **Fecha:** 2026-10-19
- **Estado:** aplicado
- **Prompts:** `plans/prompts/2026-10-19-ofertas-temporada-y-resenas.md`
- **Alcance:** ofertas de la tienda (clase semanal / temporada / remate), vitrina de ofertas al final de la
  portada y de cada tienda, página de producto, cuentas de cliente, calificaciones y comentarios por
  producto, y respuestas del vendedor en Necutools.

## Qué pidió el usuario

1. En la parte del cliente, **hasta abajo**, ver las ofertas de temporada agrupadas (ej. "Temporada de
   Navidad" con las camisas navideñas al 30% de la tienda de ropa y los chocolates de la dulcería).
2. Que el vendedor marque cada oferta como **de temporada**, **semanal** (ej. todos los lunes) o
   **remate** (no es oferta, es liquidación).
3. Que cada producto tenga **calificación y comentarios**.

Decisión del usuario (2026-10-19): las opiniones se dejan con **cuenta de cliente** (registro con correo y
contraseña), no de forma anónima.

## Diseño

### Ofertas (se amplía la tabla `ofertas`, no se crea otra)
- Columnas nuevas: `clase` (`semanal` | `temporada` | `remate`, por defecto `semanal` para las que ya
  existen), `temporada` (texto, ej. "Navidad"), `inicio`, `fin` (fechas) y `piezas` (solo remate).
- Semanal: igual que hoy, por días de la semana. Temporada: nombre + fecha de inicio y fin obligatorias,
  aplica todos los días. Remate: sin días; fecha de fin y piezas opcionales.
- Una oferta está vigente si está activa, hoy es uno de sus días y la fecha de hoy cae entre `inicio` y
  `fin` (si los tiene). `server/ofertas.js` sigue siendo el único lugar que calcula descuentos.
- Validación en el servidor: descuento de 1 a 90%, precio especial menor al normal, fin ≥ inicio.

### Vitrina de ofertas (cliente)
- `GET /api/vitrina?tienda=<slug>`: productos con oferta vigente hoy, agrupados en: un bloque por
  temporada ("Temporada de Navidad"), "Ofertas de este lunes" (semanales) y "Remates". Máx. 12 por bloque.
- Se muestra al final de la portada (reemplaza a la lista "Ofertas de hoy" de arriba) y al final de la
  página de cada tienda (solo esa tienda). Si no hay nada, no aparece.
- Tarjetas: etiqueta de la oferta, precio tachado, "Hasta el 25 de diciembre", "Quedan N piezas" y estrellas.

### Cuentas de cliente
- Tabla `clientes` (correo único, nombre público, hash bcrypt, activo). Sesión en la misma cookie con
  `clienteId` (no se mezcla con `adminId`).
- `/api/clientes`: `sesion`, `registro`, `login`, `logout`. Límite de intentos por IP.
- Página `cuenta.html` (Entrar / Crear cuenta / Cerrar sesión) y enlace "Mi cuenta" en la barra.

### Opiniones
- Tabla `resenas`: una por cliente y producto (`UNIQUE (producto_id, cliente_id)`), 1 a 5 estrellas,
  comentario de 3 a 500 caracteres sin enlaces, respuesta del vendedor y `visible`.
- Página de producto `/p/<id>` (`producto.html`): datos, oferta, promedio, distribución por estrellas,
  lista ordenable (recientes / mejor calificadas) paginada y formulario para opinar, editar o borrar la propia.
- Tarjetas de producto: estrellas promedio y número de opiniones; nombre e imagen llevan a `/p/<id>`.
- Necutools, pestaña "Opiniones": el vendedor ve las opiniones de sus tiendas, responde y puede ocultar
  una opinión inapropiada (no puede borrarla ni cambiarla).
- No hay "compra verificada": los pedidos se cierran por WhatsApp y no quedan registrados.

### Reglas de diseño
- Sin emojis, sin colores nuevos. Estrellas con iconos Lucide (`star`, y `star-fill` relleno con
  `currentColor` en `--tinta`). Iconos nuevos: `star`, `star-fill`, `user`.
