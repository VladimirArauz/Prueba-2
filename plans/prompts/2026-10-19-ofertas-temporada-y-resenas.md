# Prompts: ofertas de temporada, remates, cuentas de cliente y opiniones

Plan: `plans/planes/2026-10-19-ofertas-temporada-y-resenas.md`. Se aplicó en una sola sesión el 2026-10-19.

## Prompt 1: ofertas por clase y vitrina

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan `2026-10-19-ofertas-temporada-y-resenas.md`.
Amplía la tabla `ofertas` con `clase` (semanal, temporada, remate), `temporada`, `inicio`, `fin` y `piezas`
(sentencias idempotentes en `db/schema.sql`). Haz que `server/ofertas.js` solo tome ofertas vigentes por
día y por fecha, valida los campos nuevos en `server/admin.js` y agrega `GET /api/vitrina`. En Necutools,
agrega al formulario de ofertas la clase, la temporada, las fechas y las piezas, y un filtro por clase. En la
portada y en cada tienda, muestra al final los bloques "Temporada de …", "Ofertas de este <día>" y "Remates".

## Prompt 2: cuentas de cliente y opiniones

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan `2026-10-19-ofertas-temporada-y-resenas.md`.
Crea las tablas `clientes` y `resenas`, la API `/api/clientes` (registro, login, logout, sesión) y las
rutas de opiniones de cada producto. Haz `cuenta.html`, `producto.html` (`/p/<id>`) con promedio,
distribución, lista paginada y formulario. Muestra estrellas en las tarjetas. Agrega la pestaña "Opiniones"
en Necutools para responder y ocultar opiniones de las tiendas de cada vendedor.

## Prompt 3: verificación

Lee `plans/CLAUDE.md` y el plan. Prueba con una base PostgreSQL local de prueba (nunca la de Render):
API (permisos, validaciones, vigencia por fecha, precios del carrito con remates y temporadas) y navegador
(portada, tienda, producto, cuenta, Necutools) a 1280px y 360px sin errores de consola ni de CSP.
Actualiza `plans/MEMORIA.md` y el estado del plan.
