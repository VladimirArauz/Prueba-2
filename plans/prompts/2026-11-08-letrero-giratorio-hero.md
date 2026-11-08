# Prompts: letrero que cambia de palabra en el encabezado

Plan: `plans/planes/2026-11-08-letrero-giratorio-hero.md`.

## Prompt 1: letrero, pruebas y memoria

```text
Lee plans/CLAUDE.md, plans/MEMORIA.md y plans/planes/2026-11-08-letrero-giratorio-hero.md.

Agrega debajo de los botones del encabezado (public/index.html) el letrero "Encuentra ___" con las decisiones del plan: estilo de tablero, una sola vuelta que termina en "lo que necesitas", pausa con el mouse encima y con la pestaña oculta, frase fija para el lector de pantalla y fija con movimiento reducido. El ancho lo reserva la palabra más larga. Usa los tokens y curvas de movimiento que ya existen en style.css; el JS va en public/js/portada.js.

Prueba en Chrome a 1280, 360 y con movimiento reducido (CLS 0, sin scroll horizontal, sin errores). Anota la excepción de movimiento en plans/MEMORIA.md, haz commit y pídeme permiso para subirlo a IONOS.
```
