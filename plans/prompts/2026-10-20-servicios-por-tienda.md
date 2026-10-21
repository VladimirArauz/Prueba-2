# Prompts: apartado de Servicios en cada tienda

Plan: `plans/planes/2026-10-20-servicios-por-tienda.md`. Ejecutar en orden, uno por sesión o seguidos.
Al empezar el prompt 1, cambia el estado del plan a `en curso`.

## Prompt 1: servicios de ejemplo

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y `plans/planes/2026-10-20-servicios-por-tienda.md`. Aplica la
sección 2 del plan: crea `db/servicios-ejemplo.json` con los servicios propuestos y agrega
`importarServicios()` en `server/ejemplos.js` con la migración `servicios-ejemplo-2026-10-20`, llamada desde
`server/index.js` y `scripts/importar-ejemplos.js`. No dupliques si se corre dos veces y no la vuelvas a
correr si ya está en `migraciones`. Prueba contra una base local, nunca Render.

## Prompt 2: sección Servicios en la tienda

Lee `plans/CLAUDE.md` y el plan `2026-10-20-servicios-por-tienda.md`. Aplica las secciones 3 y 4: sección
fija `#servicios` en `public/tienda.html`, `renderServicios()` y pestaña que baja a la sección en
`public/js/tienda.js`, compatibilidad con `?tab=servicios`, y enlaces `#servicios` en `comun.js` y
`producto.js`. Solo tokens y clases existentes, sin `style=` ni `onclick`. Verifica a 1280 y 360px, cero
errores de consola o CSP.

## Prompt 3: verificación, memoria y commit

Lee `plans/CLAUDE.md` y el plan `2026-10-20-servicios-por-tienda.md`. Corre la verificación completa del
plan (API, navegador, `scripts/seguridad/ataques.js`). Actualiza el estado del plan a `aplicado`,
`plans/MEMORIA.md` (tabla, cambios hechos, pendiente 13) y `README.md`. Haz commit en `main` y pregunta
antes del push.
