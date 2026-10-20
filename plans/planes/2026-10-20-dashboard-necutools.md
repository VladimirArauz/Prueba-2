# Plan: dashboard de Necutools con pedidos registrados y gráficas

- **Fecha:** 2026-10-20
- **Estado:** aplicado
- **Prompts:** `plans/prompts/2026-10-20-dashboard-necutools.md`
- **Alcance:** Necutools (`public/necutools.html`, `public/js/necutools.js`, `public/style.css`), una tabla
  nueva `pedidos` en la base, rutas nuevas de API para guardar pedidos y para el resumen, una llamada en
  `public/js/carrito.js` al enviar por WhatsApp y la dependencia Chart.js. No quita ninguna función de
  Necutools ni cambia el mensaje de WhatsApp, los precios del carrito o la barra lateral del sitio.

## Qué pidió el usuario

Mejorar el dashboard (Necutools) como se ve en el reel de Instagram
https://www.instagram.com/reel/DeoxA_vzRbo/ (code.xr, "Dashboard V14 — Modern & Minimal UI"), sin
modificar lo que ya funciona y acomodándolo a lo que tiene Necutla.

Del reel solo se pudo leer el texto del post, no los cuadros del video. El post describe: tarjetas de
métricas, gráficas de ventas fluidas, tema blanco, diseño minimalista, animaciones suaves y diseño
responsivo (React + Framer Motion). El plan sigue ese patrón, que es el típico de esa serie: menú lateral,
encabezado con saludo y filtros, fila de indicadores con tendencia, gráfica de línea, barras, dona y tabla
de pedidos recientes. Si el usuario manda capturas del video, se ajusta en el prompt 4.

Decisiones del usuario (2026-10-20):
1. **Rediseñar todo Necutools**, no solo agregar una pestaña de resumen.
2. **Registrar pedidos.** Hoy los pedidos se cierran por WhatsApp y no queda nada guardado, así que no hay
   ventas que graficar. Se guardará el pedido cuando el cliente toque "Enviar pedido por WhatsApp".
3. **Chart.js** para las gráficas (dependencia nueva autorizada). Se sirve desde nuestro servidor, no de un CDN.

## Qué NO cambia

- Las 7 pestañas actuales (Tiendas, Productos y servicios, Ofertas de la tienda, Opiniones, Promociones
  generales, Usuarios, Mi cuenta), con sus formularios, `id`, `name`, `data-action="panel"` / `data-panel`
  y la lógica de `public/js/necutools.js` (`mostrarPanel`, `cargarTodo`, `recargar`, `renderTodo`, guardar,
  editar y borrar).
- El login de Necutools (`#admin-auth`) y sus permisos: el dueño ve todo; el encargado, solo sus tiendas
  (`puedeEditarStand`, `requireDueno` en `server/auth.js`).
- La barra lateral global (`initBarraLateral` en `public/js/comun.js`).
- El carrito: precios del servidor, agrupado por tienda, mensaje de WhatsApp y "Ya lo envié".

## 1. Base de datos (`db/schema.sql`, idempotente)

```sql
CREATE TABLE IF NOT EXISTS pedidos (
  id             SERIAL PRIMARY KEY,
  stand_id       INTEGER REFERENCES stands(id) ON DELETE SET NULL,      -- null en paquetes
  promocion_id   INTEGER REFERENCES promociones(id) ON DELETE SET NULL, -- solo paquetes
  items          JSONB NOT NULL,           -- [{tipo,id,nombre,cantidad,subtotal}] con precios del servidor
  total          NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  piezas         SMALLINT NOT NULL CHECK (piezas > 0),
  estado         VARCHAR(12) NOT NULL DEFAULT 'pendiente'
                 CHECK (estado IN ('pendiente', 'vendido', 'cancelado')),
  nota           VARCHAR(200),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pedidos_stand_fecha_idx ON pedidos (stand_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS pedidos_fecha_idx ON pedidos (creado_en DESC);
```

- **Sin datos personales del cliente** (nombre, teléfono, salón): solo lo que la tienda vende.
- Estados: `pendiente` (se mandó por WhatsApp), `vendido` (el vendedor lo confirma) y `cancelado`.
  "Ventas" en el dashboard = solo pedidos `vendido`.

## 2. Servidor

- **Refactor sin cambio de comportamiento** en `server/api.js`: sacar el cuerpo de
  `POST /carrito/precios` a una función `calcularCarrito(items)` que use lo mismo que hoy
  (`leerCarrito`, `mejorPrecio`, `ofertasDeHoy`, `promocionesVigentes`, `redondear`). La ruta sigue
  respondiendo exactamente igual.
- **`server/pedidos.js` (nuevo):**
  - `POST /api/pedidos` con `{ clave, items }`: recalcula con `calcularCarrito`, toma solo el grupo
    `clave` (`tienda-<id>` o `paquete-<id>`) y lo guarda. Ignora cualquier precio o nombre que mande el
    navegador. 400 si la clave no existe en el carrito calculado. Límite propio de 40 por hora por IP
    (holgado por la IP compartida de la escuela, ver pendiente 12).
  - `GET /api/admin/pedidos?estado=&tienda=&pagina=`: 20 por página, solo pedidos de las tiendas del
    admin; los paquetes (sin `stand_id`) solo los ve el dueño.
  - `PUT /api/admin/pedidos/:id` con `{ estado, nota }`: valida con `server/validar.js` y revisa permisos
    con `puedeEditarStand` (paquetes: `requireDueno`).
  - `GET /api/admin/resumen?dias=7|30|90&tienda=<id>|todas`:
    - **Indicadores** del periodo y del periodo anterior del mismo largo: pedidos, ventas confirmadas
      (suma de `vendido`), ticket promedio (ventas / pedidos vendidos), calificación promedio y opiniones
      sin responder.
    - **Serie diaria**: pedidos y ventas por día (días sin pedidos en 0), con la hora de Ciudad de México
      igual que en `server/ofertas.js`.
    - Pedidos por tienda, pedidos por estado, 5 productos más pedidos (desde `items`) y 5 pedidos recientes.
    - **Por hacer**: opiniones sin respuesta, productos sin foto, productos con el texto de ejemplo
      ("Producto de ejemplo…", "Producto destacado de la tienda.") y ofertas que vencen en 7 días.
  - Todo SQL con parámetros (`$1`, `$2`…); rutas `/api/admin` detrás de `requireAdmin`.
- `server/index.js`: montar el router de pedidos; servir Chart.js en `/vendor/chart.umd.js` con
  `res.sendFile(require.resolve("chart.js/dist/chart.umd.js"))` y `Cache-Control: no-cache` como el resto
  de JS. La CSP sigue en `'self'`, sin CDN.
- `package.json`: `"chart.js": "4.4.7"` (versión exacta) y `package-lock.json` actualizado.

## 3. Carrito (`public/js/carrito.js`)

- En `enviar(clave)`, antes de abrir `wa.me`, llamar
  `api("/pedidos", { method: "POST", body: { clave, items } })` **sin esperar ni bloquear**: si falla,
  WhatsApp se abre igual y no se muestra error al cliente. Un pedido se registra una sola vez por grupo
  (si el cliente vuelve a tocar el botón del mismo grupo sin cambiar el carrito, no se duplica).
- Debajo del botón de WhatsApp, una línea en `--texto-2`: "Guardamos el pedido sin tus datos para que la
  tienda le dé seguimiento."

## 4. Rediseño de Necutools (`public/necutools.html`, `public/style.css`, `public/js/necutools.js`)

### Estructura tipo dashboard (solo dentro de `main`, con sesión iniciada)

- **Menú de Necutools a la izquierda** (`.dash-nav`, 232px, fondo `--hoja`, borde 1px `--linea`, radio
  4px, `position: sticky`): son los mismos botones de `#admin-tabs`, con su `data-action="panel"` y
  `data-panel`, ahora en columna, con icono Lucide y nombre. El activo usa el estilo de `.btn` principal;
  los demás, `.ghost`. Contadores con `.cart-pill` (`--aviso`) en Pedidos (pendientes) y Opiniones
  (sin responder). Se agregan **Resumen** (primero y panel por defecto) y **Pedidos**.
  ≤ 860px: el menú pasa a una fila horizontal con scroll arriba de los paneles.
- **Encabezado** (`.dash-head`): "Hola, <usuario>", rol y tiendas a cargo (lo que hoy está en
  `#admin-user`). A la derecha: selector de tienda y de periodo (7, 30 o 90 días; solo se ven en Resumen y
  Pedidos), "Ver sitio" y "Cerrar sesión" (`data-action="logout"`, se conserva).
- **Paneles existentes**: el mismo contenido, con un encabezado de sección uniforme (h2 a la izquierda,
  descripción debajo, acción a la derecha, divisor 1px `--linea`).
- **Íconos nuevos** en `public/iconos.js` (Lucide): `layout-dashboard`, `receipt`, `trending-up`,
  `trending-down`, `chart-column`, `circle-check`, `clipboard-list`.

### Panel Resumen (`#panel-resumen`)

1. **Fila de 4 indicadores** (`.kpi`, tarjeta `--hoja` con borde `--linea`): Pedidos, Ventas confirmadas,
   Ticket promedio y Calificación promedio. Valor grande con `tabular-nums`, icono, y la tendencia contra
   el periodo anterior ("12% más que los 30 días anteriores") con `trending-up` en `--tinta` o
   `trending-down` en `--aviso`. Nunca amarillo como texto.
2. **"Pedidos y ventas por día"**: gráfica de línea (2/3 del ancho) + **"Estado de los pedidos"**: dona (1/3).
3. **"Pedidos por tienda"**: barras horizontales + **"Productos más pedidos"**: lista con piezas y total.
4. **"Pedidos recientes"**: tabla de 5 con botón "Ver todos los pedidos" + tarjeta **"Por hacer"** con
   enlaces que abren la pestaña correspondiente.
- Estados vacíos que invitan a la acción: "Aún no hay pedidos en este periodo. Comparte el enlace de tu
  tienda para recibir los primeros."
- Grid 3 → 2 (≤ 992px) → 1 (≤ 640px). 360px sin scroll horizontal.

### Panel Pedidos (`#panel-pedidos`)

- Filtros por estado y tienda (`.btn.btn-sm` activo / `.btn.secondary.btn-sm` como las pestañas de hoy).
- Tabla: fecha, tienda (o "Paquete"), productos, total, estado (`estadoBadge`) y acciones
  "Marcar como vendido" (principal), "Cancelar pedido" (`.danger`) y "Agregar nota".
- Paginado de 20 en 20. Al cambiar un estado se recargan el resumen y los contadores del menú.

## 5. Gráficas (`public/js/graficas.js`, nuevo)

- `necutools.html` carga `/vendor/chart.umd.js` y `js/graficas.js` con `<script src>` (sin JS en línea).
- Colores leídos de los tokens con `getComputedStyle(document.documentElement)`: `--tinta`, `--tinta-2`,
  `--senal`, `--linea`, `--texto-2`, `--aviso`. Fuente Archivo. Sin degradados ni rellenos de área.
- Línea: pedidos en `--tinta`, ventas en `--tinta-2` (eje derecho en pesos). Barras en `--tinta`.
  Dona: pendiente `--senal` con borde `--tinta`, vendido `--tinta`, cancelado `--linea`.
- Tooltips en español, pesos con `Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })`.
- `animation: false` con `prefers-reduced-motion: reduce`.
- Cada gráfica tiene `role="img"` y `aria-label`, y una tabla `.visually-hidden` con los mismos datos.
- Funciones `graficaLinea`, `graficaDona` y `graficaBarras`, que destruyen la gráfica anterior antes de
  dibujar otra (al cambiar de tienda o periodo).

## Excepciones de diseño que hay que confirmar con el usuario

1. **Animación de entrada de las gráficas** (Chart.js las dibuja creciendo al cargar) y conteo de los
   indicadores: `plans/CLAUDE.md` solo permite movimiento como respuesta a una acción. El prompt 4
   pregunta antes de activarla. Si el usuario no la autoriza: `animation: false` al cargar y animación solo
   al cambiar de tienda o periodo (eso sí es respuesta a una acción).
2. **Menú lateral propio de Necutools** dentro de una página que ya tiene la barra lateral global del sitio.

Si el usuario quiere que estas excepciones sean regla permanente, tiene que pedir que se actualice
`plans/CLAUDE.md`.

## Verificación

- Servidor real (`npm run dev`) contra un PostgreSQL de prueba local, nunca contra Render (en esta máquina
  hace falta instalar Node 22 y PostgreSQL, ver pendiente 17 de `plans/MEMORIA.md`).
- `db/schema.sql` aplicado 2 veces seguidas sin error, sobre la base con datos y desde cero.
- API: el pedido se guarda con precios del servidor aunque el navegador mande otros; 400 con clave inválida;
  403 sin Origin; 429 al pasar 40 por hora; 401 sin sesión en `/api/admin/pedidos` y `/resumen`; encargado
  sin tiendas ajenas ni paquetes; los números del resumen cuadran con los pedidos creados a mano;
  `/carrito/precios` responde igual que antes del refactor.
- Navegador: agregar al carrito → "Enviar pedido por WhatsApp" abre `wa.me` → el pedido aparece en
  Necutools → "Marcar como vendido" → cambian indicadores, gráficas y contadores. Las 9 pestañas sin errores
  de consola ni de CSP. 1280px y 360px sin scroll horizontal. `prefers-reduced-motion` sin animaciones.
- Búsqueda en lo nuevo: hex sueltos, degradados, `backdrop-filter`, `style="`, `onclick`, emojis y
  `text-transform: uppercase`.
