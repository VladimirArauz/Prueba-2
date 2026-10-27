# Prompts: IONOS por HTTP y cuentas de cliente en pausa

## Prompt 1 (aplicado el 2026-10-26)

Lee `plans/CLAUDE.md` y el plan `2026-10-26-ionos-sin-https-y-cuentas-en-pausa.md`. Quita la redirección a HTTPS
de `public/.htaccess`, agrega los interruptores `https` y `cuentas_clientes` de `app/config.php`, pon en pausa las
cuentas de cliente en el servidor y en el frontend, prueba en local con las dos posiciones y súbelo a IONOS.

## Prompt 2 (cuando haya dominio con SSL)

Lee `plans/CLAUDE.md` y el plan. Vuelve a activar la redirección a HTTPS, pon `'https' => true` en el
`app/config.php` del servidor, comprueba por `curl` la redirección 301, la cookie `__Host-necutla.sid` con
`Secure` y el login de Necutools. Decide con el usuario si se reactivan las cuentas de cliente.
