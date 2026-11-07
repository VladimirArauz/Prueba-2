# Prompts: mejoras de 5 reels

Plan: `plans/planes/2026-11-07-reels-texto-botones-menu-movimiento.md`. Van en orden; cada uno se corre en Claude Code.

## Prompt 1: comprobar Google Analytics

```text
Lee plans/CLAUDE.md, plans/MEMORIA.md y plans/planes/2026-11-07-reels-texto-botones-menu-movimiento.md.

Comprueba que Google Analytics funcione en https://necutla.com. No cambies código, y no toques robots.txt, sitemap.xml ni Search Console.

1. Con Chrome real a 1280 y 360 px, sin aceptar cookies: 0 peticiones a Google y sin cookies _ga.
2. Al aceptar: /g/collect responde 204 con page_view y la cookie _ga queda creada.
3. Simula sesión, carrito y pedido como en plans/planes/2026-11-06-medir-carrito-y-pedidos.md para ver add_to_cart y begin_checkout sin crear pedidos reales. Espera 9 s antes de cambiar de página, porque GA agrupa los eventos.
4. Revisa que no haya errores de consola ni de CSP.
5. Manda el mínimo de page_view reales para no ensuciar los datos.

Después pídeme que revise en GA4 "Tiempo real" y "Eventos recientes", porque tú no tienes acceso a esos informes. Si begin_checkout ya sale, recuérdame marcar la estrella; "+ Crear evento" no sirve.

Si algo falla, detente y repórtalo antes de seguir. Actualiza plans/MEMORIA.md con el resultado.
```

## Prompt 2: texto alineado

```text
Lee plans/CLAUDE.md y plans/planes/2026-11-07-reels-texto-botones-menu-movimiento.md, sección "Texto alineado". Pon el plan en estado "en curso".

En public/style.css:
1. Alinea a la izquierda .cart-empty y .auth-panel-texto, con align-items: flex-start donde sean flex en columna.
2. Alinea a la izquierda .admin-table .cell-empty.
3. Deja centrados los números y datos de una línea: .qty-value, .codigo-digito, .cart-col-center y .col-actions.
4. Revisa los demás flex en columna con align-items: center y los textos de public/404.html. Cambia solo lo que sea texto de varias líneas.

Comprueba a 1280 y 360 px el carrito vacío, el panel de Mi cuenta en sus dos modos y las tablas vacías de Necutools: .auth-panel-texto no debe chocar con la ciudad y no debe haber scroll horizontal. Es un cambio solo de diseño: no toques lógica, id, data-action ni data-section.
```

## Prompt 3: jerarquía de botones

```text
Lee plans/CLAUDE.md y plans/planes/2026-11-07-reels-texto-botones-menu-movimiento.md, sección "Jerarquía de botones".

1. public/js/portada.js: "Ver tienda" pasa a .btn.secondary. "Agregar al carrito" sigue amarillo.
2. public/cuenta.html: los dos botones de .auth-panel-texto pasan a .btn.secondary. Revisa su contraste sobre .on-tinta.
3. Filtros y pestañas: en public/js/tienda.js, public/js/necutools.js y public/necutools.html deben llevar siempre .btn.secondary, y lo activo se marca solo con aria-pressed="true". Busca todos los aria-pressed para no dejar ninguno fuera.
4. public/style.css: agrega .btn.secondary[aria-pressed="true"] con fondo y borde var(--tinta), texto var(--hoja) y hover var(--tinta-2). Este estilo nuevo lo aprobó el usuario en este plan. Revisa que no lo rompan las reglas de hover de la sección de animaciones.
5. Conserva data-action, data-tab, data-sub y aria-pressed.
6. Audita que quede un solo botón amarillo por grupo de acciones en portada, tienda, producto, carrito, cuenta y Necutools. Si encuentras otro caso, corrígelo o dime por qué se queda.
7. Actualiza la tabla "Qué botón usar" de README.md con la regla de lo seleccionado.

Comprueba a 1280 y 360 px los filtros de una tienda y de Necutools → Pedidos con mouse y teclado: aria-pressed correcto, foco visible y contraste AA. Agregar al carrito debe seguir funcionando igual.
```

## Prompt 4: triángulo seguro del panel Tiendas

```text
Lee plans/CLAUDE.md y plans/planes/2026-11-07-reels-texto-botones-menu-movimiento.md, sección "Triángulo seguro".

Primero reproduce la falla con el código actual: con Chrome sin ventana e Input.dispatchMouseEvent, abre Tiendas y mueve el cursor en diagonal hacia la última tienda. Guarda el resultado.

En public/js/comun.js, dentro de la barra lateral:
1. Mientras el panel está abierto y CON_MOUSE.matches, escucha pointermove en document. Quita el listener al cerrar, en abrirTiendas().
2. Crea vaHaciaPanel(anterior, actual, rect): actual debe estar dentro del triángulo formado por anterior y las esquinas izquierdas de .side-flyout, y avanzar hacia la derecha. Lee rect con getBoundingClientRect(), porque la lista carga después.
3. Si va hacia el panel, reinicia el cierre a 300 ms y pon .is-rumbo en la barra. Si no, deja el cierre de 150 ms.
4. Reutiliza cierreTiendas y aplica la misma lógica en mouseover y mouseleave, para cubrir el hueco de 12 px.

En public/style.css: con .is-rumbo, la fila que queda bajo el cursor no se resalta.

No cambies el teclado, Escape, el clic fuera ni el cajón de celular. No toques el HTML de las páginas ni agregues dependencias.

Comprueba:
- La diagonal hacia la última tienda deja el panel abierto, rápido y despacio.
- Bajar en línea recta a "Promociones" cierra el panel en menos de 500 ms y el clic navega.
- Teclado (→, ←, Escape) y cajón a 360 px siguen igual.
- Sin errores de consola ni CSP.
```

## Prompt 5: movimiento

```text
Lee plans/CLAUDE.md y plans/planes/2026-11-07-reels-texto-botones-menu-movimiento.md, sección "Movimiento". El parallax es una excepción autorizada por el usuario solo para este plan.

Easing, en public/style.css:
1. Agrega a :root --curva-entra, --curva-sale y --curva-mueve, a partir de las curvas ya en uso (.2,.7,.2,1 y .65,0,.35,1). Haz que --t-fast, --t-media, --t-lenta y --t-panel las usen.
2. Reemplaza cubic-bezier y ease sueltos sin cambiar duraciones. Lo que aparece usa la curva de entrada; lo que se va es más corto y usa la de salida. No cambies los steps() de la alarma de Mi cuenta.

Offset y delay:
3. Mantén el escalonado de .revelar-grid y agrégalo a las filas del tablero cuando llegan de la API, con tope de 420 ms y sin afectar a los esqueletos.
4. No animes el h1 al cargar, para no retrasar el LCP.

Parallax:
5. Solo en la portada, dentro de @supports (animation-timeline: scroll()), prefers-reduced-motion: no-preference y escritorio. Usa el corte real de .hero-grid.
6. .hero-copy y .board se desplazan a distinta velocidad, máximo 24 px, en los primeros 480 px de scroll. Solo transform, sin JavaScript.
7. Revisa que no choque con .revelar ni con la capa de la barra lateral y su panel.

Comprueba a 1280, a 360 y con movimiento reducido: sin parallax ni desplazamientos con movimiento reducido, sin scroll horizontal y el panel Tiendas por encima del hero. Prohibidos los degradados, los brillos y los colores nuevos.
```

## Prompt 6: revisión final y subida

```text
Lee plans/CLAUDE.md, plans/MEMORIA.md y plans/planes/2026-11-07-reels-texto-botones-menu-movimiento.md.

1. En http://localhost:8081/, con Chrome a 1280, 360 y movimiento reducido, corre toda la sección "Verificación" del plan, salvo lo de producción.
2. Revisa que no haya hex sueltos, degradados, style=", onclick, uppercase ni emojis en lo nuevo.
3. Si cambiaron textos o clases que usa scripts/seguridad/ataques.js, córrelo solo contra localhost.
4. Pregúntame antes de subir. Con mi permiso, sube a IONOS por rsync solo los archivos cambiados, con respaldo previo en ~/respaldos/2026-11-07-reels/ del servidor, sin imprimir credenciales.
5. Comprueba en vivo /healthz, las páginas, los archivos idénticos a los locales, cero errores de consola o CSP, y Lighthouse de la portada sin bajar de 92 / 100 / 100 / 100.
6. Actualiza el estado del plan y plans/MEMORIA.md, incluida la excepción del parallax: vale solo para este plan.

Haz commit en main solo si te lo pido. El push lo hago yo desde VS Code.
```
