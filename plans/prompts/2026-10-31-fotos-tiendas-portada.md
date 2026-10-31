# Prompts: fotos profesionales de Unsplash en las tarjetas de tiendas de la portada

Plan: `plans/planes/2026-10-31-fotos-tiendas-portada.md`. Se corren en orden. Reglas de todos: solo la portada; solo
fotos con "Unsplash License" (nunca Unsplash+); las fotos se sirven desde `public/`, no enlazadas a Unsplash; solo
tokens y clases de `style.css`; nada de JS ni estilos en línea; no imprimir secretos; trabajar en `main`.

## Prompt 1: buscar y elegir

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan `2026-10-31-fotos-tiendas-portada.md`. Busca en Unsplash en
español con WebFetch (`unsplash.com/es/s/fotos/<tema>`) fotos para las 7 tiendas (ropa, tecnologia, dulces,
propaganda, papeleria, regalos, otra). Abre la página de cada candidata para confirmar "Unsplash License", fotógrafo,
perfil y su dirección en `images.unsplash.com`. Descarga las candidatas a la carpeta temporal, arma una hoja de
contacto con Pillow, revísala y elige una por tienda (más una de respaldo) con los criterios del plan. Anota todo en
`recursos/fotos-unsplash/creditos.md` (con el `alt` en español).

## Prompt 2: descargar y optimizar

Lee `plans/CLAUDE.md` y el plan. Descarga las 7 elegidas a 1600 px desde `images.unsplash.com`, recórtalas a 16:10,
quítales los metadatos y guárdalas en WebP en `public/imagenes/tiendas/<slug>-640.webp` y `<slug>-1280.webp`
(menos de 60 KB y 150 KB). Revisa tamaño, dimensiones y cómo se ve cada una.

## Prompt 3: usarlas en la portada

Lee `plans/CLAUDE.md` y el plan. En `public/js/portada.js` agrega `FOTOS_TIENDAS` y haz que `tarjetaTienda` use la
foto (con `srcset`, `sizes`, `width`/`height`, `loading="lazy"`, `decoding="async"` y `alt`) solo cuando la tienda
tiene foto y su imagen es el SVG de relleno; respeta la portada propia de Necutools. Agrega `.card-img-wrap.is-foto`
y `.creditos-fotos` en `style.css`, y la línea de créditos debajo de `#stores-grid` en `index.html`, llenada por
`portada.js` con `escapeHTML`. No cambies la página de cada tienda, la API ni la vista previa de WhatsApp.

## Prompt 4: probar, subir y cerrar

Lee `plans/CLAUDE.md` y el plan. Prueba en Chrome sin ventana a 1280, 360 y con movimiento reducido (fotos,
tamaño que carga, créditos, tienda con portada propia, tienda nueva sin foto, sin scroll horizontal, sin errores de
consola ni CSP) y corre Lighthouse en la portada antes y después. Sube por rsync a IONOS y revisa en vivo. Actualiza
el estado del plan y `plans/MEMORIA.md`, y haz el commit en `main` con mi usuario; el push lo hago yo desde VS Code.
Al final dime qué foto quedó en cada tienda y cómo pedir que cambie alguna.
