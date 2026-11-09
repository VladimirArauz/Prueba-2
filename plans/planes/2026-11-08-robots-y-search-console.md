# Robots.txt para el catálogo y revisión en Search Console

- **Fecha:** 2026-11-08
- **Estado:** en curso
- **Prompts:** `plans/prompts/2026-11-08-robots-y-search-console.md`
- **Alcance:** `public/robots.txt`, cabecera `X-Robots-Tag` de las fotos públicas de la API, y revisión de Search Console con la extensión de Claude en el navegador.

## Por qué

La lista de productos de cada tienda y el detalle de cada producto los pide el navegador a `/api/`, que `robots.txt` tenía cerrada.

Lo que dice Google (leído el 2026-11-08):
- Si una URL está bloqueada, Googlebot no hace la petición, y no renderiza JavaScript de archivos o páginas bloqueados (`javascript-seo-basics`).
- Con reglas en conflicto gana la más específica, la de ruta más larga (`robots_txt#syntax`).
- `X-Robots-Tag` con `noindex` sirve para impedir que se indexen imágenes (`robots-meta-tag`).
- Lo que Google ve se comprueba en el HTML renderizado de la Inspección de URLs.

**Sin confirmar:** esas páginas no mencionan las peticiones XHR a una API. Se comprueba en la Inspección de URLs (prompt 1).

## Cambios

1. `public/robots.txt`: `Allow: /api/stands/` y `Allow: /api/productos/` antes de `Disallow: /api/`.
2. `app/arranque.php`: `FOTOS_INDEXABLES` quita el `X-Robots-Tag` solo a `/api/productos/<id>/imagen` y `/api/stands/<id>/portada`. El JSON y lo demás de la API lo conservan.
3. `app/paginas.php`: `OG_VERSION` a 3, porque cambiaron las cabeceras de las imágenes.

No se expone nada nuevo: esas rutas ya eran públicas y sin sesión no traen números de WhatsApp (`numeros_de`).

## Detectado y sin cambiar

`carrito.html`, `cuenta.html` y `necutools.html` tienen `noindex` y también `Disallow`. Según `robots-meta-tag`, si la URL está bloqueada el `noindex` no se lee. Se decide con lo que muestre Search Console.
