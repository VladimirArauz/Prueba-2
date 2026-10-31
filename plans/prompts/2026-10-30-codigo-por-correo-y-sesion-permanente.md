# Prompts: código por correo (OTP), sesión de cliente sin vencimiento y revisión de 2 reels

## Prompt 0: guardar el plan (aplicado el 2026-10-30)

Copia este plan a `plans/planes/2026-10-30-codigo-por-correo-y-sesion-permanente.md`
y sus prompts al archivo del mismo nombre en `plans/prompts/`. Agrega la fila en la tabla de `plans/MEMORIA.md`.

## Prompt 1: envío de correo (aplicado el 2026-10-30)

Lee `plans/CLAUDE.md` y el plan. Crea `app/correo.php` (SMTP propio y plantilla del
código), la opción `correo` en `app/config.ejemplo.php` y `README.md`, y `modo: archivo` en el `config.php` local.
Prueba en local en modo archivo. En IONOS: revisa que el servidor llegue a `smtp.ionos.mx:465`, pon la opción
`correo` en el `config.php` del servidor sin imprimir la contraseña (permisos 600, copia antes) y manda un correo
de prueba de `tienda@necutla.com` a `tienda@necutla.com`. Si el SMTP rechaza `tienda@`, detente y pregunta.

## Prompt 2: códigos y rutas (aplicado el 2026-10-30)

Lee `plans/CLAUDE.md` y el plan. Agrega `codigos_correo` a `db/mariadb/schema.sql`
(idempotente) y córrelo en local, crea `app/codigos.php` y cambia las rutas de `app/clientes.php` (login, registro,
restablecer, reenviar, sesión). Prueba con `curl` en local (modo archivo): código correcto, incorrecto, vencido,
usado, 5 intentos, reenviar antes de 60 s, código de otro navegador, restablecer con correo que no existe (misma
respuesta), registro que crea la cuenta solo después del código e inicia sesión.

## Prompt 3: sesión sin vencimiento (aplicado el 2026-10-30)

Lee `plans/CLAUDE.md` y el plan. Cambia `app/sesiones.php` y `vida_maxima()`
como dice la sección 4. Prueba: cookie de cliente con 400 días; sesión de cliente con `creada` de hace 2 días
sigue dentro; admin a las 24 h sale y el cliente del mismo navegador sigue; cerrar sesión y cambiar contraseña
siguen cerrando.

## Prompt 4: componente OTP y pantallas (aplicado el 2026-10-30)

Lee `plans/CLAUDE.md` y el plan. Crea `public/js/codigo.js`, la sección
de `style.css` y los pasos de `public/cuenta.html` y `public/js/cuenta.js`. Prueba en Chrome sin ventana (cliente
CDP propio, ver memoria) a 1280 y 360 px: avanzar, borrar, pegar, error con temblor y vaciado, acierto con brillo,
reenviar con cuenta atrás, movimiento reducido, sin scroll horizontal, cero errores de consola o CSP.

## Prompt 5: subir y cerrar (aplicado el 2026-10-30)

Lee `plans/CLAUDE.md` y el plan. Corre el `schema.sql` en IONOS (phpMyAdmin o
`mysql` por SSH, sin imprimir la contraseña), sube los archivos por rsync, prueba en vivo con una cuenta de prueba
con un correo que el usuario indique (registro → código → sesión; salir; entrar → código; olvidé mi contraseña) y
bórrala después. Actualiza `scripts/seguridad/ataques.js` (sin correrlo si no hay Node), el estado del plan y
`plans/MEMORIA.md` (excepción del brillo, pendiente 14 resuelto). Pregunta antes de hacer commit.
