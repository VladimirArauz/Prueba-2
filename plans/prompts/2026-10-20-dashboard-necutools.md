# Prompts: dashboard de Necutools con pedidos registrados y gráficas

Plan: `plans/planes/2026-10-20-dashboard-necutools.md`. Ejecutar en orden, uno por sesión o seguidos.
Al empezar el prompt 1, cambia el estado del plan a `en curso`.

## Prompt 1: tabla de pedidos y registro desde el carrito

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan `2026-10-20-dashboard-necutools.md` (secciones 1, 2 y 3).
Agrega a `db/schema.sql` la tabla `pedidos` y sus índices tal como vienen en el plan, de forma idempotente.
En `server/api.js`, saca el cuerpo de `POST /carrito/precios` a `calcularCarrito(items)` sin cambiar lo
que responde la ruta. Crea `server/pedidos.js` con `POST /api/pedidos` (`{ clave, items }`): recalcula con
`calcularCarrito`, guarda solo el grupo de esa clave con precios del servidor, sin datos del cliente, con
un límite de 40 por hora por IP. Móntalo en `server/index.js`.
En `public/js/carrito.js`, dentro de `enviar(clave)`, registra el pedido sin esperar ni bloquear la
apertura de WhatsApp, una sola vez por grupo, y agrega la línea "Guardamos el pedido sin tus datos para
que la tienda le dé seguimiento." con una clase de `style.css`.
Prueba contra un PostgreSQL local (nunca Render): schema 2 veces, pedido con precio falso del navegador
guardado con el precio real, 400 con clave inválida, 403 sin Origin, 429 al pasar el límite y
`/carrito/precios` igual que antes.

## Prompt 2: API de administración de pedidos y resumen

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan (sección 2). En `server/pedidos.js`, agrega
`GET /api/admin/pedidos` (filtros de estado y tienda, 20 por página), `PUT /api/admin/pedidos/:id`
(`estado`, `nota`, validados con `server/validar.js`) y `GET /api/admin/resumen?dias=&tienda=` con los
indicadores del periodo y del anterior, la serie diaria en hora de Ciudad de México (días vacíos en 0),
pedidos por tienda y por estado, 5 productos más pedidos, 5 pedidos recientes y la lista "Por hacer".
Todo detrás de `requireAdmin`; el encargado solo ve sus tiendas (`puedeEditarStand`) y los paquetes solo
el dueño. SQL siempre con parámetros.
Prueba: 401 sin sesión, encargado con 403 en pedidos ajenos, estados inválidos con 400 y números del
resumen que cuadren con pedidos creados a mano en 3 días distintos.

## Prompt 3: Chart.js, utilidades de gráficas e iconos

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan (secciones 2 y 5). Agrega `"chart.js": "4.4.7"` a
`package.json` (versión exacta) y actualiza `package-lock.json`. En `server/index.js`, sirve
`chart.js/dist/chart.umd.js` en `/vendor/chart.umd.js` con `no-cache`, sin tocar la CSP.
Crea `public/js/graficas.js` con `graficaLinea`, `graficaDona` y `graficaBarras`: colores leídos de los
tokens con `getComputedStyle`, fuente Archivo, sin degradados, tooltips en español con pesos MXN,
`animation: false` con movimiento reducido, `role="img"` + `aria-label` y tabla `.visually-hidden` con los
datos; cada función destruye la gráfica anterior. Agrega a `public/iconos.js` los símbolos de Lucide
`layout-dashboard`, `receipt`, `trending-up`, `trending-down`, `chart-column`, `circle-check` y
`clipboard-list`. Comprueba en una página de prueba local (que no se sube) que una gráfica se dibuja con
cero errores de CSP.

## Prompt 4: rediseño del contenedor de Necutools

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan (sección 4 y "Excepciones de diseño"). Antes de
empezar, pregúntale al usuario si autoriza la animación de entrada de las gráficas y el menú propio de
Necutools; si tiene capturas del reel, pídeselas y ajusta el acomodo. Anota su respuesta en el plan
(solo el estado y una línea de decisión) y en `plans/MEMORIA.md`.
En `public/necutools.html`, convierte `#admin-tabs` en el menú vertical `.dash-nav` con icono por pestaña,
agrega los botones "Resumen" (primero) y "Pedidos", sus secciones vacías `#panel-resumen` y
`#panel-pedidos`, y el encabezado `.dash-head` (saludo, rol, tiendas, selectores de tienda y periodo,
"Ver sitio", "Cerrar sesión"). Conserva todos los `id`, `name`, `data-action`, `data-panel` y
`data-solo-dueno`. Da a los paneles existentes el encabezado de sección uniforme sin cambiar sus
formularios. En `public/js/necutools.js`, solo ajusta `mostrarPanel` para el estilo nuevo y abre en
"Resumen". Estilos en `public/style.css` con los tokens existentes; ≤ 860px el menú pasa a fila con scroll.
Prueba que las 7 pestañas de antes funcionan igual (crear, editar y borrar) a 1280px y 360px.

## Prompt 5: paneles Resumen y Pedidos

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan (secciones 4 y 5). En `public/js/necutools.js`, carga
`/admin/resumen` y `/admin/pedidos` dentro de `cargarTodo` y `recargar`, y pinta:
el panel Resumen (4 indicadores con tendencia, línea de pedidos y ventas, dona de estados, barras por
tienda, productos más pedidos, pedidos recientes y "Por hacer" con enlaces a la pestaña correcta), el
panel Pedidos (filtros, tabla, "Marcar como vendido", "Cancelar pedido", "Agregar nota", paginado) y los
contadores del menú (pedidos pendientes y opiniones sin responder). Los selectores de tienda y periodo
recargan el resumen. Todo texto de datos con `escapeHTML`, eventos con `data-action` y el listener
delegado que ya existe. Estados vacíos que inviten a la acción. Grid 3 → 2 → 1.

## Prompt 6: verificación y cierre

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan (sección "Verificación"). Corre todo lo de esa sección
con el servidor real y un PostgreSQL local (nunca Render), incluido el flujo completo carrito → WhatsApp →
pedido en Necutools → vendido → indicadores y gráficas actualizados, las 9 pestañas sin errores de consola
ni de CSP, 360px sin scroll horizontal y `prefers-reduced-motion`. Busca en lo nuevo hex sueltos,
degradados, `backdrop-filter`, `style="`, `onclick`, emojis y `text-transform: uppercase`.
Documenta en `README.md` la tabla `pedidos`, `POST /api/pedidos`, qué se guarda y qué no (sin datos
personales) y Chart.js. Cambia el estado del plan a `aplicado` y registra en `plans/MEMORIA.md` los cambios
con fecha y archivos, las pruebas hechas y los pendientes nuevos.
