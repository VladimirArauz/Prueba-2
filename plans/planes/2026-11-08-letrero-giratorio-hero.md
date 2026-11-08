# Letrero que cambia de palabra en el encabezado

- **Fecha:** 2026-11-08
- **Estado:** aplicado
- **Prompts:** `plans/prompts/2026-11-08-letrero-giratorio-hero.md`
- **Alcance:** llenar el hueco de la columna izquierda del encabezado (en computadora) con un letrero "Encuentra ___" cuya palabra cambia sola. Solo la portada; sin cambios en la API ni en el carrito.

## Contexto

Con el letrero de Necutla, el tablero quedó más alto que el texto de la izquierda y, a 1280 px, sobran unos 100 px arriba del título y otros 100 debajo de los botones. Se le dieron 4 opciones al usuario (buscador en el encabezado, letrero que cambia de palabra, oferta del día y puesto animado), y eligió el letrero.

## Decisiones

- Va **debajo de los botones**, no encima del h1: `plans/CLAUDE.md` prohíbe poner etiquetas encima de los títulos.
- **Excepción de diseño autorizada por el usuario solo para este plan:** movimiento que no responde a una acción (`plans/CLAUDE.md`, "Movimiento"). Si quiere que sea regla, que pida actualizar `plans/CLAUDE.md`.
- Estilo de tablero: "Encuentra" en `--tinta`; la palabra en `--senal` sobre `--tinta`, dentro de una caja de radio 4px, como las letras de un tablero de aeropuerto. Cambia hacia arriba cada 2.5 s con `transform` y opacidad (sin CLS).
- Palabras de cada tienda: playeras, audífonos, dulces, volantes, cuadernos, regalos, engargolados; termina en "lo que necesitas" y se detiene (una sola vuelta).
- Accesibilidad: el lector de pantalla lee una frase fija ("Encuentra playeras, audífonos… y lo que necesitas"); lo que gira va con `aria-hidden`. Se pausa con el mouse encima y cuando la pestaña no se ve (no es interactivo, así que no recibe foco). Con `prefers-reduced-motion` no gira: muestra "lo que necesitas" fijo.
- El ancho lo reserva la palabra más larga (en una celda de grid oculta): la caja no cambia de tamaño.

## Verificación

1280, 360 y movimiento reducido: la palabra cambia y se detiene en "lo que necesitas"; se pausa con el mouse encima; CLS 0; sin scroll horizontal; sin errores. Subir a IONOS solo con permiso del usuario.
