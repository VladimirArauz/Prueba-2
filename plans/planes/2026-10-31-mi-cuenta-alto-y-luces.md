# Plan: tarjeta de Mi cuenta que se ajusta al formulario y luces de los edificios

- **Fecha:** 2026-10-31
- **Estado:** aplicado (2026-10-31, subido a IONOS)
- **Prompts:** `plans/prompts/2026-10-31-mi-cuenta-alto-y-luces.md`
- **Alcance:** `public/style.css` (sección del login `.auth`), `public/js/cuenta.js`. Sin cambios en la API ni en la base.

## Por qué

En Mi cuenta los dos formularios comparten la misma fila de la tarjeta `.auth`, así que siempre mide lo que el
registro (el más largo): en "Iniciar sesión" el panel con los edificios se ve muy alto y sobra espacio. El usuario
pidió que la tarjeta se adapte al formulario visible (con animación al cambiar), que se vea más centrada, que las
ventanas de los edificios parpadeen de vez en cuando y que se pongan rojas y parpadeen si la contraseña está mal.

## Decisiones del usuario

- **Excepción a `plans/CLAUDE.md` (movimiento), solo para el panel de Mi cuenta:** algunas ventanas parpadean solas,
  despacio y a ratos, sin que la persona haga nada. Con `prefers-reduced-motion` no parpadean.
- Las luces rojas al fallar la contraseña cumplen las reglas: rojo `--aviso` de error y movimiento como respuesta.

## Cambios

1. `cuenta.js`: `ajustarAlto()` mide el formulario visible (más el panel en celular) y lo pone en `--alto-auth`
   (CSSOM, no `style=""` en el HTML); se llama al cambiar de modo y con un `ResizeObserver` (mensajes de validación).
   Si la contraseña está mal (401 al entrar), `.auth` lleva `.is-alarma` 1.8 s.
2. `style.css`: `.auth` con `height: var(--alto-auth, auto)` y transición `--t-panel`, centrada (`margin-inline: auto`);
   los formularios ya no se estiran; el texto del panel se centra arriba de la ciudad. Ventanas: parpadeo suave en
   algunas (`nth-child` con duraciones y retrasos distintos); `.is-alarma` las pone `--aviso` y parpadean 4 veces.

## Verificación

Chrome sin ventana a 1280 y 360 px: altura de entrar menor que la de registro y cambia al cambiar; sin scroll
horizontal; ventanas rojas con contraseña mala; sin parpadeo con movimiento reducido; cero errores de consola o CSP.
