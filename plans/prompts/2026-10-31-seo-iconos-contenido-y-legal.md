# Prompts: recomendaciones de IONOS (SEO, icono touch, contenido), aviso de privacidad y rendimiento

Plan: `plans/planes/2026-10-31-seo-iconos-contenido-y-legal.md`. Se corren en orden. Reglas de todos: no cambiar
el carrito, la API de pedidos, Necutools ni el envío a WhatsApp; solo tokens y clases de `style.css`; nada de JS ni
estilos en línea; no imprimir secretos (memoria `secrets-md-no-imprimir`); trabajar en `main`; no tocar el DNS.

## Prompt 1: línea base

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan `2026-10-31-seo-iconos-contenido-y-legal.md`. Sin cambiar
código, mide con Lighthouse (Node 22 y `lighthouse` en la carpeta temporal, no en el proyecto) la portada, una
tienda y un producto, en local y en https://necutla.com. Cuenta las palabras de la portada en el HTML inicial y
ya pintada. Revisa si IONOS acepta `mod_deflate` y `mod_expires` en `.htaccess`. Anota los puntajes en el plan
(sección nueva "Línea base") sin cambiar lo demás.

## Prompt 2: títulos, descripciones y etiquetas por página

Lee `plans/CLAUDE.md` y el plan. Aplica la sección "Prompt 2": título y descripción nuevos de la portada (y
`OG_GENERAL`), `<title>` y descripción por tienda y producto en `app/paginas.php`, `canonical`, `noindex` en
carrito, cuenta y Necutools, JSON-LD (`WebSite`, `Organization`, `Product` con `Offer`, `BreadcrumbList`) con
`json_encode` seguro, y `theme-color`. Revisa que la CSP no marque el JSON-LD. Prueba con `curl` el largo de cada
título y descripción y que el JSON-LD se lea con `json_decode`.

## Prompt 3: sitemap.xml y robots.txt

Lee `plans/CLAUDE.md` y el plan. Crea `app/sitemap.php` con `GET /sitemap.xml` (solo lo visible, `lastmod`,
caché de 1 hora), la regla en `public/.htaccess` y `public/robots.txt`. Prueba con `xmllint --noout`, oculta una
tienda y un producto de prueba para ver que desaparecen, y bórralos al terminar.

## Prompt 4: icono touch, iconos de app y manifest

Lee `plans/CLAUDE.md` y el plan. Genera desde `public/imagenes/favicon.svg` con Chrome sin ventana
`apple-touch-icon.png` (180, fondo sólido), `icono-192.png`, `icono-512.png`, `icono-maskable-512.png`,
`favicon-32.png` y `favicon.ico`; crea `public/site.webmanifest` y agrega los `<link>` a todas las páginas. Usa
para el manifest y `theme-color` exactamente los valores de `--tinta` y `--gis` y pregúntame si acepto esa
excepción técnica. Revisa cada archivo (tamaño, tipo, 200).

## Prompt 5: contenido de la portada

Lee `plans/CLAUDE.md` y el plan. Agrega a `index.html` "Qué es Necutla", "Cómo funciona" (3 pasos reales) y
"Preguntas frecuentes" (`<details>`), con el texto en el HTML, tono directo, sentence case, sin emojis y con el
encabezado de sección de siempre. Estilo `.faq` solo con tokens. Muéstrame el texto antes de darlo por bueno.
Comprueba 550+ palabras en el HTML inicial y prueba en Chrome sin ventana a 1280 y 360 px y con movimiento
reducido (teclado en `<details>`, sin scroll horizontal, sin errores de consola ni CSP).

## Prompt 6: aviso de privacidad, términos, 404 y rendimiento

Lee `plans/CLAUDE.md` y el plan. Crea `privacidad.html` y `terminos.html` (borrador con `[COMPLETAR]` donde
van mis datos), enlázalos en el pie de todas las páginas y en el registro, y pásalos por `app/paginas.php` y el
sitemap. Cambia `404.txt` por `404.html` con el diseño del sitio. En `.htaccess`, compresión de CSS, JS, SVG,
JSON, XML y TXT, caché de 30 días para las fuentes y tipos correctos. Agrega `width`/`height` a las imágenes
fijas. Prueba en local con `curl` y Chrome sin ventana.

## Prompt 7: subir, probar y cerrar

Lee `plans/CLAUDE.md` y el plan. Sube por rsync a IONOS y prueba en vivo la sección "Verificación" del plan.
Corre Lighthouse otra vez y compara con la línea base. Actualiza `README.md` (SEO y por qué no hay CDN), el estado
del plan y `plans/MEMORIA.md`, y haz el commit en `main` con mi usuario; el push lo hago yo desde VS Code. Al
final dame la lista de lo que me toca hacer (aviso de privacidad, Google Search Console, revisor de IONOS).
