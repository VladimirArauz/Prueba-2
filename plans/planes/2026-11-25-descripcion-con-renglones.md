# Plan: descripción del producto con renglones y espacios

- **Fecha:** 2026-11-25 · **Estado:** aplicado (subido a IONOS el 2026-11-25)
- **Prompts:** `plans/prompts/2026-11-25-descripcion-con-renglones.md`
- **Alcance:** `public/style.css`, `public/necutools.html` y, en la app, `ui/necutools/NtCatalogo.kt`. Se sube junto con `2026-11-25-avisos-errores-y-permisos-al-inicio.md` (app 2.4.0).

## Contexto

El usuario pidió poder usar Enter (renglones) y espacios en la descripción del producto, y que al ver el producto se vea tal como se escribió.

- **Lo que ya funcionaba:** el campo de Necutools (`<textarea>`) acepta Enter. El servidor guarda el texto tal cual (`v_publico` → `js_trim` solo recorta las orillas) y la API lo manda con sus `\n`. En la app, el campo es de varias líneas y `Text` de Compose ya respeta los renglones y los espacios.
- **Lo que fallaba:** en la web, `#producto-desc` es un `<p>` que llena `producto.js` con `textContent`, y el navegador junta los espacios y los saltos de línea.

## Cambios
- `public/style.css`: `#producto-desc { white-space: pre-wrap; overflow-wrap: anywhere; }`. Sigue llenándose con `textContent`, así que no hay riesgo de HTML inyectado.
- `public/necutools.html`: la descripción del producto pasa a `rows="6"`, con la ayuda "Usa Enter para separar renglones. Se verá tal como la escribas." (`aria-describedby`).
- App: el campo "Descripción" de Necutools pasa a 6 líneas, con la misma ayuda. Va en la 2.4.0.
- Sin cambios en la API ni en la base. El mensaje de WhatsApp de los servicios sigue juntando la descripción en una línea (`textoPlanoWA`), a propósito.

## Verificación
- Producto local con "renglón, renglón vacío, sangría y espacios dobles": en Chrome a 1280 y 360 se ve igual que como se escribió, sin scroll horizontal. En el emulador, la ficha de la app también.
- Se restauró la descripción original del producto de prueba.
