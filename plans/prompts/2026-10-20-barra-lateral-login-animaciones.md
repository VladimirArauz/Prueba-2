# Prompts: barra lateral, login con panel deslizante y animaciones

Plan: `plans/planes/2026-10-20-barra-lateral-login-animaciones.md`. Ejecutar en orden, uno por sesión o
seguidos. Al empezar el prompt 1, cambia el estado del plan a `en curso`.

## Prompt 1: tokens de movimiento e iconos

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan `2026-10-20-barra-lateral-login-animaciones.md`
(sobre todo "Excepciones autorizadas"). En `public/style.css`, agrega a `:root` los tokens `--t-media`,
`--t-lenta`, `--t-panel`, `--sombra-1` y `--sombra-2` tal como vienen en el plan, y amplía el bloque
`prefers-reduced-motion: reduce` para que también apague `transform` y las entradas. En `public/iconos.js`,
agrega de Lucide los iconos `menu`, `house`, `mail`, `lock`, `eye` y `log-in`. No cambies nada más todavía.

## Prompt 2: barra lateral con submenú de tiendas

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan (sección 2). Reemplaza la `site-navbar` de las 7
páginas de `public/` por la barra lateral `.sidebar` descrita en el plan: cerrada de 76px que se abre a
264px con hover y con `:focus-within`, encima del contenido; marca, buscador que manda a `/?q=`, Inicio,
Tiendas, Promociones, Carrito (con `cart-count`), Mi cuenta y, abajo, Necutools. La opción activa lleva
`aria-current="page"`.
En `public/js/comun.js`, llena el submenú "Tiendas" con `obtenerTiendas()` (icono, nombre, descripción y
`/t/<slug>`). Debe abrirse con hover (con tolerancia al salir), clic, Enter o la flecha derecha y cerrarse
con Escape. Agrega el cajón para ≤ 860px (botón "Abrir menú", fondo que lo cierra, Escape, foco atrapado y
devuelto) y el acordeón de Tiendas en el cajón.
Haz que `public/js/portada.js` lea `?q=` y busque al cargar. Usa solo `data-action` y un listener
delegado, sin estilos en línea. Prueba a 1280px y 360px con la CSP activa.

## Prompt 3: hover y animaciones de entrada

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan (sección 3). En `public/style.css`, agrega los hover de
la tabla del plan (tarjetas que suben 4px con `--sombra-1`, imagen a 1.04, `.btn` con escalón y presión,
icono que se desliza, subrayado que crece y filas del tablero) dentro de `@media (hover: hover)`.
En `public/js/comun.js`, agrega la clase `anim` a `<html>` solo con `prefers-reduced-motion: no-preference`
y un `IntersectionObserver` que revele las secciones una sola vez. También debe animar lo que se inserte
después con la API (tarjetas, vitrina, búsqueda, submenú). Las tarjetas se escalonan con `:nth-child`
(60ms, máximo 8). Revisa que sin JS y con movimiento reducido todo se vea desde el principio.

## Prompt 4: login con panel deslizante

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan (sección 4). Rehaz la parte "fuera de sesión" de
`public/cuenta.html` como la tarjeta `.auth` con dos formularios y el panel `.auth-panel` `--tinta`, con el
dibujo plano de ciudad en SVG (sin degradados). El panel se desliza al otro lado con `--t-panel` y
`data-action="auth-cambiar"`; los formularios salen y entran con fundido. Usa `inert` en el formulario
oculto y pasa el foco al primer campo. `#crear-cuenta` abre el registro. Agrega los campos con icono y el
botón para ver la contraseña.
Conserva `form-entrar`, `form-registro`, los `id` y `name` de los campos y todo lo que hace
`public/js/cuenta.js` (login, registro, salir, `?volver=`). En ≤ 760px, apila la tarjeta como dice el plan.

## Prompt 5: verificación y cierre

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan (criterios de terminado). Levanta el servidor local con
una base PostgreSQL de prueba (nunca la de Render) y revisa en el navegador las 7 páginas a 1280px, 860px y
360px:
- barra lateral con mouse y con teclado, y submenú con las tiendas de la base;
- cajón en celular;
- login, registro, salir y `?volver=` en `cuenta.html`;
- hover y entradas;
- `prefers-reduced-motion: reduce`;
- carrito y envío a WhatsApp sin cambios;
- cero errores de consola o de CSP y sin scroll horizontal a 360px.

Busca que no haya hex sueltos, degradados, `backdrop-filter`, `style="` ni emojis nuevos. Cambia el estado
del plan a `aplicado` y actualiza `plans/MEMORIA.md` (cambios, excepciones autorizadas y pendientes).
