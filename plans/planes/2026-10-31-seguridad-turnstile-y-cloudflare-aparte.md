# Plan: actualizaciones de seguridad, captcha Turnstile y estadísticas de Cloudflare

- **Fecha:** 2026-10-31
- **Estado:** aplicado (2026-10-31, prompts 1 a 7, subido a IONOS)
- **Prompts:** `plans/prompts/2026-10-31-seguridad-turnstile-y-cloudflare-aparte.md`
- **Alcance:** `app/` (seguridad, auth, clientes, resenas, pedidos, contrasenas, totp, arranque, api,
  config.ejemplo, captcha nuevo), `public/` (.htaccess, style.css, las páginas públicas, js de cuenta, producto y
  carrito, captcha.js nuevo, fuentes, vendor/chart.umd.js), `scripts/seguridad/ataques.js`, `README.md`, informe
  nuevo en `plans/auditorias/`. **No se toca nada de IONOS** (hosting, dominio, DNS, nameservers, correo, base):
  Cloudflare se usa aparte, solo para el captcha y las estadísticas.

## Contexto

El usuario pidió: (1) investigar en fuentes oficiales las actualizaciones de seguridad de lo que usa Necutla y
aplicar las recomendaciones; (2) usar Cloudflare para proteger el sitio y ver el tráfico; (3) agregar captcha; y una
guía de lo que tiene que hacer él.

Decisiones del usuario (2026-10-31):
- Captcha: **Cloudflare Turnstile**, en **registro, restablecer contraseña, iniciar sesión de clientes, opiniones y
  pedidos** (no en Necutools: ya tiene freno por cuenta y 2 pasos).
- Cloudflare: **sin tocar nada de IONOS**. Se usa como servicio aparte: Turnstile y **Web Analytics** (cuenta
  visitas con un script, sin cookies). No se cambian los nameservers.
- Fuentes: **alojar Archivo en `public/`** y quitar Google Fonts.

**Límite que hay que tener claro:** sin pasar el tráfico por Cloudflare (nameservers), Cloudflare **no frena
ataques DDoS** a necutla.com; eso queda a cargo de la protección que ya incluye IONOS y de los límites por IP y por
cuenta que ya tiene el código. Si algún día se quiere el escudo completo, está descrito al final como opción.

## Lo que ya se sabe (investigación preliminar, se confirma en el prompt 1)

| Pieza | Estado conocido | Fuente |
|---|---|---|
| PHP 8.5 | 8.5.12 (2026-10-21) corrige CVE-2026-109618/109619 (RCE sin login, CVSS 9.2). En IONOS hay 8.5.12; falta confirmarlo desde el web (no solo `php8.5 -v`). Mitigación extra: `session.upload_progress.enabled=0`. Un blog menciona CVE-2026-115560 sin corregir: verificar en php.net | github.com/php/php-src/releases/tag/php-8.5.12 |
| MariaDB | IONOS tiene 11.8. CVE-2026-49261 (CVSS 10) se corrige en 11.8.8; un fallo de CONNECT, en 11.8.9. Lo administra IONOS: se revisa `SELECT VERSION()` y, si es viejo, el usuario abre ticket | Avisos de distribuciones; confirmar en mariadb.com/kb |
| Apache | Lo administra IONOS (2.4.69 corrige 14 CVE). Local: el Apache y el MariaDB 10.4 de XAMPP son viejos (10.4 sin soporte): deben escuchar solo en 127.0.0.1 | httpd.apache.org/security/vulnerabilities_24.html |
| Chart.js 4.4.7 | Revisar versión nueva o aviso de seguridad | github.com/chartjs/Chart.js |
| Turnstile | Validación en servidor obligatoria (`siteverify`), token de un uso y 300 s; CSP: `script-src` y `frame-src https://challenges.cloudflare.com` | developers.cloudflare.com/turnstile |
| Web Analytics | Script `static.cloudflareinsights.com/beacon.min.js` con token; manda datos a `cloudflareinsights.com`; sin cookies; funciona sin cambiar el DNS | developers.cloudflare.com/web-analytics |

## Qué se va a hacer (por prompt)

### Prompt 1: investigación oficial y diagnóstico (sin cambiar código)
- Fuentes: php.net (ChangeLog y security), httpd.apache.org, mariadb.com/kb, GitHub de Chart.js, OWASP (Cheat
  Sheets de Session, Password Storage, CSP, HTTP Headers; ASVS 5.0), docs de Turnstile y Web Analytics.
- Versiones reales: local e IONOS por SSH (`php8.5 -v`, `SELECT VERSION()` con la contraseña leída a una variable
  según la memoria `secrets-md-no-imprimir`, cabecera `Server`). Revisar si IONOS lee `.user.ini`, si su PHP web
  tiene `curl`, `sodium` y Argon2.
- Repasar los hallazgos H1–H21 del informe anterior (`plans/auditorias/2026-10-20-seguridad.md`): cuáles ya no
  aplican (eran de Render) y qué falta.
- Salida: `plans/auditorias/2026-10-31-seguridad-actualizaciones.md` (hallazgos N1…, severidad, fuente, prompt que
  lo corrige). Si algo cambia el plan de fondo, se avisa.

### Prompt 2: endurecimiento del servidor y dependencias
- `app/arranque.php`: en producción exigir PHP ≥ 8.5.12 (`version_compare`); en local basta 8.5 (Ubuntu parcha con
  número viejo, MEMORIA 24j).
- `.user.ini` donde IONOS lo lea: `session.upload_progress.enabled=0`, `display_errors=0`, `log_errors=1`
  (y `expose_php` si se permite). Probar en local con el pool de FPM.
- `GET /api/admin/sistema` (solo dueños): versión de PHP y MariaDB y extensiones clave, para verlas sin exponerlas.
  Tarjeta pequeña en Necutools con clases existentes.
- `app/totp.php`: secreto TOTP cifrado con `sodium_crypto_secretbox` (llave derivada del `secreto`); migración
  idempotente en `migraciones` que cifra los que estén en claro, sin borrar nada.
- `app/contrasenas.php`: Argon2id si el PHP de IONOS lo trae; al entrar, `password_needs_rehash` actualiza el hash.
  Se conserva la regla de 72 bytes. Sin Argon2, sigue bcrypt.
- Chart.js: actualizar `public/vendor/chart.umd.js` a la última 4.x si la hay, con checksum del registro de npm.
- Fuentes: Archivo woff2 variable (eje `wdth`, OFL) en `public/fuentes/`, `@font-face` en `style.css`, quitar los
  `<link>` de Google de las páginas y `fonts.googleapis.com`/`fonts.gstatic.com` de la CSP. Mismo aspecto
  (capturas antes y después).
- CSP: revisarla con CSP Evaluator; agregar `frame-src 'none'` (se abre en el prompt 3), `worker-src 'none'`,
  `manifest-src 'self'`.
- `public/.well-known/security.txt`: revisar `Contact` con el usuario (hoy apunta al repo de Vladi).
- Local (con `sudo`, preguntando antes): Apache de XAMPP y MariaDB solo en 127.0.0.1.

### Prompt 3: Turnstile en el servidor
- `app/captcha.php` (nuevo): `exigir_captcha(string $accion)` lee el campo `captcha` del cuerpo y hace POST a
  `https://challenges.cloudflare.com/turnstile/v0/siteverify` con `secret`, `response`, `remoteip` (`ip_cliente()`)
  e `idempotency_key`; revisa `success`, `hostname` (de `url_publica`) y `action`. Con curl si existe; si no,
  `stream_socket_client('ssl://…')` como `app/correo.php` (allow_url_fopen está apagado). Tiempo máximo 5 s.
  - Token malo, vencido o reusado → 400 "Confirma que no eres un robot y vuelve a intentarlo."
  - Cloudflare no responde → se deja pasar y se anota en el log (los límites por IP y por cuenta siguen).
- Config `turnstile` => `['site_key' => '', 'secret' => '']` en `app/config.ejemplo.php` y `README.md`. Vacío =
  apagado. En local, las llaves de prueba oficiales (siempre pasa / siempre falla).
- `/api/config` agrega `captcha` (la site key, pública) y se ajusta el JS que la usa.
- Se exige en `/api/clientes/registro`, `/login`, `/restablecer`, `/codigo/reenviar`, crear y editar opinión
  (`app/resenas.php`) y `POST /api/pedidos`. No en `/…/codigo` (ya tiene 5 intentos) ni en Necutools.
- CSP: `script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com`.
- `scripts/seguridad/ataques.js`: sin token, token falso, token reusado.

### Prompt 4: Turnstile en el navegador
- `public/js/captcha.js` (nuevo): carga `api.js?render=explicit` una vez; `turnstile.render` en `.captcha` con
  `appearance: 'interaction-only'` (solo se ve si Cloudflare duda), `size: 'flexible'`, `language: 'es'`,
  `theme: 'light'`, `action` por formulario; `tokenCaptcha()` devuelve una promesa; `reset` tras cada envío. Sin
  site key no hace nada.
- `cuenta.html`/`cuenta.js` (entrar, registro, restablecer, reenviar), `producto.js` (opinión), `carrito.js`
  (cada grupo pide su token antes de registrar el pedido; si sale el reto, se ve junto al botón, que queda ocupado
  con `botonOcupado()` hasta tener token; WhatsApp se abre igual que hoy).
- `style.css`: `.captcha` (margen y ancho, sin colores nuevos). **Excepción de diseño a confirmar:** el recuadro de
  Turnstile es un iframe de Cloudflare que no usa los tokens; con `interaction-only` casi nunca se ve.
- Chrome sin ventana (cliente CDP propio) a 1280 y 360 px y con movimiento reducido, con la llave de prueba que pasa
  y la que falla; sin errores de consola ni de CSP.

### Prompt 5: Web Analytics de Cloudflare (sin tocar el DNS)
- Con el token que da el usuario (es público): `<script defer src="https://static.cloudflareinsights.com/beacon.min.js"
  data-cf-beacon='{"token":"…"}'></script>` en las páginas públicas (no en `necutools.html`). No es JS en línea:
  pasa la CSP agregando `static.cloudflareinsights.com` a `script-src` y `cloudflareinsights.com` a `connect-src`.
- Si el token está vacío, no se pone. Mejor: lo inserta `app/paginas.php` desde config `cloudflare_analytics`, así no
  se escribe en cada HTML y en local queda apagado. Documentar en `config.ejemplo.php` y `README.md`.
- Mencionarlo en una línea del pie o de Mi cuenta ("Contamos visitas sin cookies con Cloudflare") si el usuario
  quiere (preguntar).

### Prompt 6: subir a IONOS y probar en vivo
- Subir por rsync solo los archivos cambiados (`app/` y `public/`), como en los planes anteriores.
- En el `app/config.php` del servidor: llaves de Turnstile y token de Analytics con `require` + `var_export`, la
  secret leída de `~/Escritorio/secrets.md` a variable/stdin, copia previa y permisos 600. Nunca imprimirla.
- En vivo: CSP con `curl -I`, `/healthz`, registro/entrar/restablecer con correo real, opinión, pedido a WhatsApp,
  Necutools, `/app/config.php` 404, versión de PHP en `/api/admin/sistema`, visitas que aparecen en el panel de Web
  Analytics, vista previa de WhatsApp.

### Prompt 7: revisión final y cierre
- `/security-review` sobre los commits del plan; `ataques.js` (o `curl` si no hay Node) solo contra localhost.
- Completar el informe `plans/auditorias/2026-10-31-…` con el estado de cada hallazgo.
- Estado del plan, `plans/MEMORIA.md`, commit en `main` con `runuser` (el usuario hace el push desde VS Code).

## Guía para el usuario (lo que Claude no puede hacer)

**A. Cuentas y 2 pasos**
1. Crea la cuenta en https://dash.cloudflare.com/sign-up con tu correo personal y activa la verificación en dos
   pasos (My Profile → Authentication). No hace falta agregar el dominio ni tocar IONOS.
2. Activa los 2 pasos en IONOS (Mi cuenta → Seguridad) y en GitHub.
3. En Necutools → Mi cuenta, activa los 2 pasos en las cuentas de dueño.

**B. Llaves de Turnstile (captcha)**
1. Cloudflare → Turnstile → Add widget. Nombre `Necutla`, hostname `necutla.com` (agrega también `localhost` si
   Cloudflare lo permite; si no, en local se usan las llaves de prueba), modo **Managed**, pre-clearance **No**.
2. Guarda la **Site Key** (pública) y la **Secret Key** en `~/Escritorio/secrets.md` como
   `Turnstile site key : …` y `Turnstile secret : …`. **No pegues la secret en el chat**; dile a Claude la línea.

**C. Web Analytics**
1. Cloudflare → Analytics & Logs → Web Analytics → Add a site → escribe `necutla.com` → elige la opción
   **manual / JS snippet** (no la automática, que pide pasar el dominio a Cloudflare).
2. Copia solo el `token` del fragmento (es público) y pásaselo a Claude o guárdalo en `secrets.md`.

**D. IONOS (solo revisar, sin cambiar nada)**
1. Revisa en el panel de tu hosting si tu paquete incluye protección DDoS o "CDN" y anótalo para el informe.
2. Si `SELECT VERSION()` sale menor que 11.8.9, abre un ticket a IONOS pidiendo la actualización de MariaDB.
3. Antes del 2027-04-29, revisa que el certificado SSL se renueve.

**E. Pendientes de seguridad que ya existían**
- Cambiar los secretos del pendiente 28 que faltan (base de Estudios, API key de Gemini, buzón tiendita@).
- Respaldo de la base desde phpMyAdmin una vez al mes, fuera de git.

## Opción para después (no se hace en este plan): escudo completo de Cloudflare
Solo si un día quieres protección DDoS y firewall: el sitio, la base y el correo se quedan en IONOS, pero el dominio
apuntaría a Cloudflare (nameservers). Requiere copiar los registros de correo en "DNS only", SSL Full (strict), y en
el código leer `CF-Connecting-IP` solo desde los rangos de Cloudflare (`ip_cliente()` en `app/seguridad.php`) para no
juntar a todos los visitantes en los límites por IP. Se haría con un plan nuevo.

## Archivos clave y lo que se reutiliza
- `app/seguridad.php` (`ip_cliente`, `limite_*`, `exigir_mismo_origen`).
- `app/correo.php` (patrón de `stream_socket_client` con TLS verificado, para `siteverify` sin curl).
- `app/clientes.php`, `app/resenas.php`, `app/pedidos.php` (donde entra `exigir_captcha`); `app/api.php`
  (`/api/config`); `app/paginas.php` (inserta el script de Analytics); `app/arranque.php` (versión mínima).
- `public/js/comun.js` (`api`, `botonOcupado`/`botonListo`), `cuenta.js`, `producto.js`, `carrito.js`.
- `public/.htaccess` (CSP), `public/style.css`, `app/fuentes/` (ya trae Archivo y `OFL.txt`).
- Memorias: `secrets-md-no-imprimir`, `push-desde-vscode`, `solo-main-sin-ramas`.

## Verificación
- Local (XAMPP + `php8.5-fpm`; los ataques nunca contra IONOS): `curl` de cada ruta con llave de prueba que pasa,
  que falla, token reusado y sin token (400); CSP en todas las páginas; fuentes desde `/fuentes/` y cero peticiones
  a Google; script de Analytics solo con token; Chrome sin ventana a 1280 y 360 px: registro, entrar, restablecer,
  opinión y pedido completos, sin errores de consola/CSP ni scroll horizontal.
- En vivo (prompt 6): Turnstile real, correo del código en la bandeja, visitas en Web Analytics, Necutools entra,
  `/app/config.php` 404, PHP ≥ 8.5.12 desde el web.
