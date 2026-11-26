# Prompts: descripción del producto con renglones y espacios

Plan: `plans/planes/2026-11-25-descripcion-con-renglones.md`.

## Prompt 1 (hecho el 2026-11-25)

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan.

1. En `public/style.css`, haz que `#producto-desc` respete los saltos de línea y los espacios (`white-space: pre-wrap`, `overflow-wrap: anywhere`), sin cambiar `producto.js`, que usa `textContent`.
2. En `public/necutools.html`, pon el campo de la descripción del producto en 6 renglones, con una ayuda (`form-hint`, `aria-describedby`) que diga que Enter separa renglones.
3. En la app (`NtCatalogo.kt`), haz lo mismo en el campo de Necutools. La ficha del producto ya respeta los renglones.
4. Prueba con una descripción con renglones, un renglón vacío y espacios dobles, en Chrome a 1280 y 360 y en el emulador. Restaura la descripción original.
5. Se sube con el prompt 4 de `plans/prompts/2026-11-25-avisos-errores-y-permisos-al-inicio.md`.
