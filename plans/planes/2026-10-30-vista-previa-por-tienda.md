# Plan: imagen de vista previa propia para cada tienda

- **Fecha:** 2026-10-30
- **Estado:** aplicado (2026-10-30, subido a IONOS). Falta que el usuario pruebe el enlace de una tienda en WhatsApp
- **Prompts:** `plans/prompts/2026-10-30-vista-previa-por-tienda.md`
- **Alcance:** `app/` (`og-imagen.php` nuevo, `paginas.php`, `arranque.php`), `app/fuentes/` (Archivo en TTF fijo),
  `recursos/og/` (cómo se sacaron las fuentes), `README.md`. Sin cambios en la base ni en el frontend.
  Continúa el reel de @go.expoose (DfEWnhqMNcp) del plan `2026-10-29-reels-esqueletos-botones-open-graph.md`.

## Por qué

Con HTTPS en `https://necutla.com` (2026-10-30) la vista previa ya funciona, pero las 7 tiendas comparten la imagen
general: sus portadas son SVG y WhatsApp no muestra SVG. Decisiones del usuario: cada tienda tiene su imagen
generada sola (también las tiendas nuevas); el título general se queda como está (sin lugar).

## Cambios

1. `app/fuentes/`: Archivo (OFL, con su licencia) en TTF fijo, sacado de la fuente variable de Google Fonts con
   `fonttools varLib.instancer`: 125/800 (nombre), 112/700 (tablero y lema), 100/500 (frases). GD no lee los ejes.
2. `app/og-imagen.php`: `GET /api/stands/:slug/vista.png` arma con GD un PNG de 1200×630 con el mismo diseño que
   `public/imagenes/og-necutla.png`: fondo `--tinta`, marca Necutla chica, nombre de la tienda grande en blanco,
   descripción en 2 o 3 líneas, frase de WhatsApp en `--senal` y, a la derecha, el tablero `--tinta-2` con hasta 5
   subcategorías (si no tiene, Productos, Servicios y Ofertas). Los colores salen de los tokens (comentados con su
   nombre). Nombres largos se achican o se cortan con "…". Sin sesión; con el límite de la API.
   `Cache-Control: public, max-age=86400`; la dirección lleva `?v=` con `actualizado_en`, así cambia al editar.
   Tienda oculta o inexistente: 404. Sin GD o sin fuentes: 404 y la página usa la imagen general.
3. `app/paginas.php`: si la tienda no tiene portada PNG/JPG/WEBP, `og:image` apunta a su imagen generada, con
   `og:image:width/height` y `alt` "Tienda X en Necutla". Con portada real se sigue usando la portada.
4. Local: `php8.5-gd` de Ubuntu (IONOS ya tiene GD con FreeType y WebP).

## Verificación

PNG de 1200×630 y menos de 300 KB para las 7 tiendas, nombres largos y con acentos, tienda sin subcategorías,
tienda oculta 404, `og:image` correcto en `/t/<slug>`, `curl` en vivo después de subir; mandar por WhatsApp
el enlace de una tienda (lo hace el usuario).
