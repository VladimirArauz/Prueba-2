# Prompts: actualizaciones de seguridad, captcha Turnstile y estadísticas de Cloudflare

Plan: `plans/planes/2026-10-31-seguridad-turnstile-y-cloudflare-aparte.md`. Se corren en orden. Regla de todos:
no tocar nada de IONOS fuera de subir archivos y editar `app/config.php` (nada de DNS, dominio ni nameservers), no
imprimir secretos (memoria `secrets-md-no-imprimir`), trabajar en `main`, ataques solo contra localhost.

## Prompt 1: investigación oficial y diagnóstico

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan `2026-10-31-seguridad-turnstile-y-cloudflare-aparte.md`.
Actúa como experto en ciberseguridad. Investiga en fuentes oficiales (php.net, httpd.apache.org, mariadb.com/kb,
GitHub de Chart.js, OWASP Cheat Sheets y ASVS 5.0, docs de Cloudflare Turnstile y Web Analytics) las
actualizaciones y recomendaciones de seguridad vigentes para PHP 8.5, Apache 2.4, MariaDB 11.8 y Chart.js 4.
Revisa las versiones reales en local y en IONOS por SSH (PHP del web y de la terminal, `SELECT VERSION()` con la
contraseña leída solo a una variable, cabecera `Server`), si IONOS lee `.user.ini` y si su PHP tiene `curl`,
`sodium` y Argon2. Repasa los hallazgos H1–H21 de `plans/auditorias/2026-10-20-seguridad.md`. Escribe
`plans/auditorias/2026-10-31-seguridad-actualizaciones.md` con los hallazgos nuevos (N1…), severidad, fuente y el
prompt que los corrige. No cambies código. Si algo cambia el plan de fondo, avísame antes de seguir.

## Prompt 2: endurecimiento del servidor y dependencias

Lee `plans/CLAUDE.md`, el plan y el informe del prompt 1. Aplica la sección "Prompt 2" del plan: versión mínima
de PHP en producción, `.user.ini`, `/api/admin/sistema` solo para dueños, secreto TOTP cifrado con sodium
(migración idempotente, sin borrar datos), Argon2id con `password_needs_rehash` si está disponible, Chart.js al
día con checksum, fuentes Archivo alojadas en `public/fuentes/` (quitar Google Fonts de las páginas y de la CSP,
mismo aspecto) y los ajustes de CSP. Pregúntame por el `Contact` de `security.txt` y antes de usar `sudo` para que
XAMPP y MariaDB escuchen solo en 127.0.0.1. Prueba en local (curl y Chrome sin ventana a 1280 y 360 px).

## Prompt 3: Turnstile en el servidor

Lee `plans/CLAUDE.md` y el plan. Crea `app/captcha.php` con `exigir_captcha()` (siteverify con hostname, action e
idempotency_key; curl o `stream_socket_client` como `app/correo.php`; 5 s; 400 si el token es malo y dejar pasar
con aviso en el log si Cloudflare no responde). Agrega la opción `turnstile` a `app/config.ejemplo.php` y
`README.md`, la site key a `/api/config`, la verificación en registro, login de clientes, restablecer, reenviar
código, opiniones y pedidos, y `challenges.cloudflare.com` en `script-src` y `frame-src` de la CSP. Usa las
llaves de prueba oficiales en local. Agrega las pruebas a `scripts/seguridad/ataques.js` y pruébalas con curl.

## Prompt 4: Turnstile en el navegador

Lee `plans/CLAUDE.md` y el plan. Crea `public/js/captcha.js` (render explícito, `interaction-only`, flexible,
español, `tokenCaptcha()`, reset tras cada envío) y conéctalo en `cuenta.js`, `producto.js` y `carrito.js` sin
cambiar la lógica del carrito ni el envío a WhatsApp. Estilo `.captcha` en `style.css` con tokens existentes.
Pregúntame si acepto la excepción de diseño del recuadro de Cloudflare. Prueba en Chrome sin ventana a 1280 y
360 px y con movimiento reducido, con la llave de prueba que pasa y la que falla, sin errores de consola ni CSP.

## Prompt 5: Web Analytics de Cloudflare

Lee `plans/CLAUDE.md` y el plan. Pídeme el token de Web Analytics (o la línea de `secrets.md`). Agrega la opción
`cloudflare_analytics` y haz que `app/paginas.php` inserte el script del beacon solo en las páginas públicas
(no en Necutools) cuando haya token; ajusta la CSP (`static.cloudflareinsights.com` y `cloudflareinsights.com`).
Documenta en `config.ejemplo.php` y `README.md`. Pregúntame si quiero una línea que avise que se cuentan visitas.

## Prompt 6: subir a IONOS y probar en vivo

Lee `plans/CLAUDE.md` y el plan. Sube por rsync solo los archivos cambiados de `app/` y `public/`. En el
`app/config.php` del servidor agrega `turnstile` y `cloudflare_analytics` con `require` + `var_export`, la secret
leída de `~/Escritorio/secrets.md` solo a variable o stdin, copia previa y permisos 600. Prueba en vivo la sección
"Verificación" del plan (Turnstile real, código por correo, opinión, pedido, Necutools, CSP, versión de PHP desde
el web, visitas en Web Analytics, vista previa de WhatsApp).

## Prompt 7: revisión final y cierre

Lee `plans/CLAUDE.md` y el plan. Corre `/security-review` sobre los commits del plan y las pruebas de ataque
(o curl) solo contra localhost. Completa el estado de cada hallazgo en el informe del prompt 1. Actualiza el
estado del plan y `plans/MEMORIA.md`, y haz el commit en `main` con mi usuario (`runuser`); el push lo hago yo
desde VS Code.
