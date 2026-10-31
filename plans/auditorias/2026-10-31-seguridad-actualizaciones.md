# Auditoría 2026-10-31: actualizaciones de seguridad, Turnstile y Cloudflare aparte

Plan: `plans/planes/2026-10-31-seguridad-turnstile-y-cloudflare-aparte.md` (prompt 1).
Informe anterior: `plans/auditorias/2026-10-20-seguridad.md` (H1–H21, cuando el sitio estaba en Render).

## Versiones encontradas

| Pieza | Local | IONOS (necutla.com) | Al día |
|---|---|---|---|
| PHP | 8.5.4 de Ubuntu (parchado, USN-8948-1), sin `curl`, con `sodium` y Argon2 | 8.5.12 en la terminal (`php8.5`), con `curl`, `sodium`, `gd`, `intl` y Argon2. La versión del web se confirma con `/api/admin/sistema` (prompt 2) | Sí: 8.5.12 es la última (php.net/ChangeLog-8.php) |
| MariaDB | 10.4.32 de XAMPP (sin soporte desde 2024), solo en 127.0.0.1 | 11.8.8 | Casi: 11.8.8 corrige CVE-2026-49261 (CVSS 10); el fallo del motor CONNECT se corrige en 11.8.9 |
| Apache | 2.4.58 de XAMPP, escuchando en **todas** las interfaces (80, 443, 8081) | `Server: Apache` (lo administra IONOS); IONOS pone su propio límite (`x-ws-ratelimit-limit: 1000`) | Local no: 2.4.59 a 2.4.69 corrigen fallas críticas (mod_rewrite, mod_http2) |
| Chart.js | 4.4.7 en `public/vendor/` | igual | Hay 4.6.1; sin avisos de seguridad publicados (GitHub Security) |
| Fuente Archivo | Google Fonts | Google Fonts | Se aloja en el sitio (decisión del usuario) |

## Fuentes revisadas
- php.net ChangeLog 8 (8.5.11: 11 avisos, entre ellos FPM `listen.allowed_clients`, OpenSSL, mysqlnd, phar, SOAP y el
  envoltorio HTTP; 8.5.12: GHSA-w8hw-w9fx-j79w y GHSA-6wmf-4rv5-p3rp, "state corruption via bailout", las del
  CVE-2026-109618/109619). CVE-2026-115560, que mencionaba un blog, no aparece en php.net: se descarta.
- github.com/php/php-src/releases/tag/php-8.5.12; httpd.apache.org/security/vulnerabilities_24.html; avisos de
  MariaDB 11.8 (Red Hat, AlmaLinux, Fedora, CSC de EAU).
- OWASP Cheat Sheets: Password Storage (Argon2id primero, bcrypt aceptable), Cryptographic Storage (secretos
  cifrados en la base), Session Management, Content Security Policy, HTTP Headers; ASVS 5.0.
- Cloudflare: Turnstile (validación en servidor, llaves de prueba, CSP, render explícito) y Web Analytics (fragmento
  manual para sitios que no pasan por Cloudflare; CSP `script-src https://static.cloudflareinsights.com` y
  `connect-src https://cloudflareinsights.com`).

## Hallazgos del informe anterior que ya no aplican
H1, H2 y H19 eran de Render (base abierta, `ADMIN_PASSWORD`, proxy): el sitio ya no está en Render. H3 (SSL de la
base de Render) igual. Los demás siguen corregidos en el código PHP (se revisaron las rutas al portarlo).

## Hallazgos nuevos

| # | Severidad | Hallazgo | Corrige |
|---|---|---|---|
| N1 | Media | No se puede ver qué versión de PHP atiende la página (solo la de la terminal). La API acepta cualquier 8.5, incluso las anteriores a 8.5.12 | Prompt 2: mínimo 8.5.12 en producción y `/api/admin/sistema` |
| N2 | Baja | `session.upload_progress` sigue encendido (mitigación sugerida para PHP2Shell); IONOS no tiene `.user.ini` | Prompt 2: `.user.ini` |
| N3 | Baja | MariaDB 11.8.8 en IONOS: falta el arreglo del motor CONNECT (11.8.9). Solo lo pueden usar usuarios con permisos que el hosting compartido no da | Usuario: pedir a IONOS la 11.8.9 o más nueva |
| N4 | Media | El Apache 2.4.58 de XAMPP escucha en todas las interfaces: cualquiera en la misma red (Wi-Fi de la escuela) llega a phpMyAdmin y al sitio local, con un Apache con fallas conocidas | Prompt 2: escuchar solo en 127.0.0.1 |
| N5 | Info | MariaDB 10.4 de XAMPP sin soporte; ya escucha solo en 127.0.0.1 | Aceptado (solo local) |
| N6 | Media | El secreto de los 2 pasos (TOTP) está en claro en `admins.totp_secreto`: quien lea un respaldo puede generar códigos | Prompt 2: cifrado con sodium |
| N7 | Baja | Contraseñas con bcrypt; OWASP recomienda Argon2id | Prompt 2: Argon2id con rehash al entrar |
| N8 | Info | Chart.js 4.4.7 → 4.6.1 (mantenimiento, sin avisos) | Prompt 2 |
| N9 | Baja | Google Fonts recibe la IP de cada visitante y amplía la CSP | Prompt 2: fuente propia |
| N10 | Info | La CSP no dice `frame-src`, `worker-src` ni `manifest-src` (los cubre `default-src`) | Prompt 2/3: explícitos |
| N11 | Media | Registro, restablecer, entrar, reenviar código, opiniones y pedidos solo tienen límites por IP: un bot con muchas IPs gasta el buzón y llena pedidos falsos | Prompts 3 y 4: Turnstile |
| N12 | Info | No hay forma de ver el tráfico | Prompt 5: Web Analytics |
| N13 | Info | Sin Cloudflare delante (decisión del usuario) no hay protección DDoS de Cloudflare; queda la de IONOS y los límites del código | Aceptado; opción descrita en el plan |
| N14 | Info | `security.txt` solo tiene como contacto el repositorio de Vladi | Prompt 2: se agrega el correo de la tienda |

## Estado (2026-10-31, prompt 7)

| # | Estado | Cómo quedó |
|---|---|---|
| N1 | Corregido | `app/arranque.php` exige 8.5.12 en producción (503 si no). La API arranca en vivo, así que el PHP web de IONOS es ≥ 8.5.12. Necutools → Mi cuenta → Servidor (solo dueños, `/api/admin/sistema`) muestra las versiones |
| N2 | Corregido | `public/.user.ini`: progreso de subidas y errores en pantalla apagados (en local se comprobó que FPM lo lee). En IONOS el archivo da 403 al pedirlo; falta que un dueño lo confirme en la tarjeta Servidor |
| N3 | Usuario | MariaDB 11.8.8 en IONOS: pedir la 11.8.9 o más nueva por ticket |
| N4 | Corregido | Apache de XAMPP solo en 127.0.0.1 (80, 443, 8081); copias `*.antes-localhost` en `/opt/lampp/etc/` |
| N5 | Aceptado | Solo local, ya en 127.0.0.1 |
| N6 | Corregido | Secreto TOTP con `sodium_crypto_secretbox` (`s1:` + base64), columna a 160; el de IONOS (1 dueño) ya está cifrado (`scripts/cifrar-totp.php`) y se descifra bien |
| N7 | Corregido | Argon2id 64 MiB / 4 pasadas (tiempo parecido a bcrypt 12 para no delatar cuentas), rehash al entrar; probado bcrypt → Argon2id en admin y cliente |
| N8 | Corregido | Chart.js 4.6.1 (sha512 del registro de npm) |
| N9 | Corregido | Archivo en `public/fuentes/` (woff2 latin y latin-ext, OFL); cero peticiones a Google en local y en vivo |
| N10 | Corregido | CSP con `frame-src`, `worker-src 'none'` y `manifest-src 'self'` |
| N11 | Corregido | Turnstile en registro, entrar, olvidé mi contraseña, reenviar código, opiniones y pedidos. En vivo: sin token o con token falso → 400 |
| N12 | Corregido | Cloudflare Web Analytics en las páginas públicas (no en Necutools); en vivo el beacon manda datos sin errores |
| N13 | Aceptado | Decisión del usuario |
| N14 | Corregido | `security.txt` con `mailto:tienda@necutla.com` además del enlace de GitHub |

### Pruebas
- `scripts/seguridad/ataques.js` (Node 22.23.4 bajado a la carpeta temporal con su checksum, solo contra localhost):
  253 de 253. Se corrigió la prueba "el mismo código no sirve dos veces", que fallaba si pasaban 30 s (usaba el
  código del paso actual en vez del de la activación).
- Chrome sin ventana (cliente CDP propio): 17 de 17 a 1280, 360 y 360 con movimiento reducido (fuente, login,
  registro con código, opinión, pedido, sin scroll horizontal, sin errores de consola ni CSP); llave que siempre
  falla → aviso y no se manda; reto interactivo (llave 3x) se ve arriba del botón. Necutools a 1280 y 360: gráficas
  con Chart.js 4.6.1 y tarjeta Servidor, sin errores.
- En vivo: `/healthz`, páginas, `/app/config.php` 404, CSP, fuente, Analytics, vista previa (`og:image` 200).
  Turnstile real **pide la casilla a Chrome automatizado y lo rechaza aunque la marque**: es lo esperado con un
  bot; el camino feliz en vivo lo debe probar una persona en su navegador.

### Hallado en la revisión del cambio
- Con Argon2id al mínimo de OWASP (19 MiB) el login de una cuenta inexistente tardaba ~13 ms en IONOS y el de una
  cuenta con bcrypt ~160 ms: se podía saber si una cuenta existe. Se subió a 64 MiB / 4 pasadas (~140 ms).
- Si `/api/config` fallaba, el captcha quedaba apagado en esa página hasta recargar: ahora se vuelve a pedir.
- Local: `httpd.conf` de XAMPP (proyecto "estudio") solo deja GET/POST/HEAD/OPTIONS en todo Apache y rompía los
  PUT/DELETE de Necutla en local; se permitieron en el virtual host de Necutla (`/opt/lampp/etc/extra/necutla.conf`).
