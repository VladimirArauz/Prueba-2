# Mejoras de 5 reels: texto, botones, menú, movimiento y Analytics

- **Fecha:** 2026-11-07
- **Estado:** aplicado
- **Prompts:** `plans/prompts/2026-11-07-reels-texto-botones-menu-movimiento.md`
- **Alcance:** comprobar Google Analytics, alinear el texto de varias líneas a la izquierda, ordenar la jerarquía de botones, agregar el triángulo seguro al panel Tiendas y unificar el movimiento con parallax en el hero. No incluye Search Console ni Google Business.

## Contexto

El usuario pidió aplicar a Necutla lo que muestran 5 reels. Del reel de SEO solo se comprueba Google Analytics: la página debe recibir visitas, pero todavía no quiere hacerla muy pública.

Se leyó el texto de cada post con `/embed/captioned/`. No se vieron los videos.

| Reel | Autor | Tema | Estado en Necutla |
|---|---|---|---|
| DefoWU9oUOK | @jiron.design | No centrar texto de varias líneas (tarjetas de producto) | Las tarjetas ya van a la izquierda; quedan 3 casos centrados |
| DedHRaDMz7_ | @jiron.design | No usar botón primario para todo | "Ver tienda" repetido, filtros activos amarillos, 2 amarillos en Mi cuenta |
| DfWHsoZtS_Q | @go.expoose | Triángulo invisible de los menús estilo Amazon | Falta: el panel Tiendas se cierra al ir en diagonal |
| Deto2m_MOUL | @peter_lead | SEO básico, Search Console y Google Business | Solo se verifica Analytics |
| DepyeB-I3kb | @jiron.design | Easing, offset y delay, parallax | Ya hay curvas y escalonado; falta unificar y agregar parallax |

Revisado en vivo con `curl` (solo lectura, 2026-11-07): `gtm.js` publicado trae `G-VPH0MC28FN`, `add_to_cart` y `begin_checkout`; la portada carga `etiquetas.js` con `GTM-MPJ9PMLR`. Falta la prueba con navegador real (prompt 1).

## Decisiones del usuario

- **Tarjetas:** "Ver tienda" pasa a secundario; "Agregar al carrito" sigue amarillo.
- **Filtro o pestaña activa:** relleno `--tinta` con texto `--hoja`, igual que la opción activa de la barra lateral. Es un estilo nuevo, aprobado en este plan.
- **Parallax:** en el hero de la portada, como excepción a `plans/CLAUDE.md` solo para este plan.
- **Search Console y Google Business:** no se hacen por ahora.

## Cambios por tema

### Texto alineado (reel 1)

- `public/style.css`: alinear a la izquierda `.cart-empty`, `.auth-panel-texto` y `.admin-table .cell-empty`.
- Se quedan centrados los números y datos de una línea: `.qty-value`, `.codigo-digito`, `.cart-col-center` y `.col-actions`.

### Jerarquía de botones (reel 2)

- `public/js/portada.js`: "Ver tienda" con `.btn.secondary`.
- `public/cuenta.html`: los botones del panel azul pasan a secundario, porque el formulario de al lado ya lleva el amarillo.
- `public/js/tienda.js`, `public/js/necutools.js` y `public/necutools.html`: filtros siempre con `.btn.secondary`; lo activo se marca solo con `aria-pressed="true"`.
- `public/style.css`: `.btn.secondary[aria-pressed="true"]` con fondo y borde `--tinta`, texto `--hoja` y hover `--tinta-2`.
- `README.md`: regla de lo seleccionado en la tabla "Qué botón usar".

### Triángulo seguro (reel 3)

Hoy, en `initBarraLateral()` (`public/js/comun.js`), pasar por "Promociones" o "Carrito" rumbo al panel inicia el cierre de 150 ms. Cruzar despacio el hueco de 12 px también lo cierra.

- Mientras el panel está abierto y `CON_MOUSE.matches`, se escucha `pointermove` en `document`; el listener se quita al cerrar.
- `vaHaciaPanel(anterior, actual, rect)`: `actual` debe estar dentro del triángulo formado por `anterior` y las esquinas izquierdas de `.side-flyout`, y avanzar hacia la derecha.
- Si va hacia el panel, el cierre se reinicia a 300 ms y la barra lleva `.is-rumbo`. Si no, sigue el cierre de 150 ms.
- Con `.is-rumbo`, la fila bajo el cursor no se resalta.
- No cambian el teclado, Escape, el clic fuera ni el cajón de celular. No se toca el HTML de las páginas.

### Movimiento (reel 5)

- **Easing:** tokens `--curva-entra`, `--curva-sale` y `--curva-mueve` en `:root`; `--t-fast`, `--t-media`, `--t-lenta` y `--t-panel` los usan. Se reemplazan `cubic-bezier` y `ease` sueltos sin cambiar duraciones.
- **Offset y delay:** se mantiene `.revelar-grid` y se agregan las filas del tablero, con tope de 420 ms y sin afectar a los esqueletos. El `h1` no se anima al cargar, para no retrasar el LCP.
- **Parallax:** solo en la portada y en escritorio, con `animation-timeline: scroll()` dentro de `@supports` y `prefers-reduced-motion: no-preference`. `.hero-copy` y `.board` se desplazan a distinta velocidad, máximo 24 px, en los primeros 480 px de scroll. Solo `transform`, sin JavaScript. Sin soporte, se queda quieto.

## Verificación

- **Analytics:** en necutla.com a 1280 y 360, 0 peticiones a Google sin aceptar cookies; al aceptar, `/g/collect` responde 204. `add_to_cart` y `begin_checkout` simulados, sin pedidos reales.
- **Triángulo:** con `Input.dispatchMouseEvent`, primero reproducir la falla con el código viejo. Después, la diagonal de "Tiendas" a la última tienda deja el panel abierto, rápido y despacio. Bajar en línea recta a "Promociones" lo cierra en menos de 500 ms y el clic navega. Teclado, Escape y cajón a 360 siguen igual.
- **Botones:** contar amarillos visibles por grupo. Filtros con `aria-pressed` correcto, contraste AA y teclado.
- **Carrito y WhatsApp:** agregar al carrito, armar el pedido y abrir WhatsApp siguen funcionando, con el evento de medición simulado sin cambios.
- **Texto:** carrito vacío, panel de Mi cuenta y tablas vacías, sin scroll horizontal a 360.
- **Movimiento:** con movimiento reducido no hay parallax ni desplazamientos; sin soporte, el hero se queda quieto. Lighthouse de la portada en vivo sin bajar de 92 / 100 / 100 / 100.
- **General:** cero errores de consola o CSP. Si cambian textos o clases que usa `scripts/seguridad/ataques.js`, correrlo solo contra localhost.
