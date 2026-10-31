# Plan: cambio de hoster a IONOS (hosting compartido, PHP + MariaDB)

- **Fecha:** 2026-10-25
- **Estado:** aplicado (prompts 1 a 7; el 7 terminó el 2026-10-30 con el dominio `https://necutla.com` y su SSL. Falta apagar Render. La versión de PHP pasó a 8.5: ver `2026-10-25-php85-y-puntos-debiles.md`)
- **Prompts:** `plans/prompts/2026-10-25-migracion-ionos-php-mariadb.md`
- **Alcance:** todo el servidor (`server/` → `app/` en PHP), la base (PostgreSQL → MariaDB), configuración,
  despliegue y documentación. El frontend (`public/`) **no cambia**, salvo `.htaccess`, `api/index.php` y
  `vendor/chart.umd.js`.
- **Reemplaza en parte a:** `2026-10-16-hosting-render-postgres.md` (el hosting y la base; sus reglas de
  seguridad siguen valiendo).

## 1. Contexto y decisiones

El usuario va a mudar Necutla de Render a **IONOS con hosting web compartido**. Ese plan solo corre **PHP
y MariaDB**: no hay Node.js ni PostgreSQL. Por eso:

- El servidor de Node + Express (`server/`, unos 3,600 renglones y 63 rutas) se reescribe en **PHP 8.2 sin
  frameworks ni Composer** (regla de `plans/CLAUDE.md`: nada de dependencias nuevas).
- La base pasa a **MariaDB** (decisión del usuario). Se escribe para **MariaDB 10.4**, la versión que trae
  XAMPP en esta máquina, así funciona igual en las versiones más nuevas de IONOS.
- **La API conserva las mismas rutas, los mismos JSON y los mismos códigos de error.** Así el frontend
  (`public/js/*`) no se toca, y la batería `scripts/seguridad/ataques.js` sirve para probar que el servidor
  en PHP se porta igual.
- Las direcciones públicas no cambian (`/t/ropa`, `/p/12`, `/carrito.html`, redirecciones viejas).

Otra opción con mucho menos trabajo sería un **VPS de IONOS**, donde el servidor de Node se queda como está
y solo se cambia la base. El usuario eligió el hosting compartido.

**Choque con `plans/CLAUDE.md`:** las secciones 1 y 4 dicen Render, Node.js + Express, PostgreSQL, `.env`,
`render.yaml` y `server/`. Al terminar hay que pedirle al usuario permiso para actualizar ese archivo. Sin
permiso no se toca (pendiente en `plans/MEMORIA.md`).

## 2. Base de datos (hecho el 2026-10-25)

- `db/mariadb/schema.sql`: estructura para MariaDB. Es idempotente (`CREATE TABLE IF NOT EXISTS`).
  Equivalencias:

  | PostgreSQL | MariaDB |
  |---|---|
  | `SERIAL` | `INT UNSIGNED AUTO_INCREMENT` |
  | `TIMESTAMPTZ` | `DATETIME(6)` en UTC (la conexión usa `SET time_zone = '+00:00'`) |
  | `BYTEA` | `MEDIUMBLOB` |
  | `TEXT[]` / `SMALLINT[]` (`whatsapp`, `dias`, `totp_respaldo`) | `JSON` |
  | `JSONB` (`pedidos.items`) | `JSON` |
  | índice único en `lower(col)` | intercalación `utf8mb4_unicode_ci`, que ya compara sin importar mayúsculas |
  | índices parciales (`WHERE …`) | índices normales |
  | trigramas (`pg_trgm`) | `LIKE` con índice normal en `nombre` |
  | `hex ~ '^#…'` | `hex REGEXP '^#…'` con `ascii_bin` |
  | `session` (connect-pg-simple) | `sesiones` (manejador de sesiones de PHP) |
  | límite de peticiones en memoria | tabla `limites` (la IP se guarda como HMAC) |

  `admins.usuario` usa `utf8mb4_bin`: en producción existen `Axel` (id 1) y `axel` (id 3), y con
  `unicode_ci` chocarían (pendiente 22). El login busca primero el usuario exacto y luego sin importar
  mayúsculas, como hoy.
- `scripts/migracion/pg-a-mariadb.py`: convierte un respaldo de PostgreSQL (formato custom de pgAdmin o
  `.sql`) en un `.sql` para MariaDB con el esquema y los datos. Hace esto:
  - fechas a UTC, booleanos a 1/0, `bytea` a hexadecimal y arreglos a JSON;
  - textos con `\` o caracteres de control van como `CONVERT(0x… USING utf8mb4)`, así el resultado no
    depende de `NO_BACKSLASH_ESCAPES`;
  - no copia `session`.
  Se usa con `python3 -I`.
- `~/necutla-mariadb.sql` (carpeta personal del usuario, **fuera del repo**, permisos 600). Sale del
  respaldo `~/Descargas/necutla` del 2026-10-25 y trae 7 tiendas, 24 subcategorías, 37 productos (uno con
  foto WEBP en la base), 3 admins, 2 clientes, 4 migraciones y 2 renglones de bitácora. Lleva contraseñas
  cifradas, correos y teléfonos: no se sube a git.
- Verificado en el MariaDB 10.4.32 de XAMPP, en la base de prueba `necutla_prueba_ionos`:
  - importa sin errores y los conteos de cada tabla cuadran;
  - la foto es idéntica byte por byte (mismo MD5);
  - los acentos se conservan;
  - el esquema corre dos veces sin error;
  - el CHECK del color rechaza `#FF0000`;
  - un correo repetido con otras mayúsculas da 1062;
  - `Axel` y `AXEL` conviven.
- Los hashes son bcrypt `$2a$` (bcryptjs): `password_verify` de PHP los acepta. Nadie tiene que cambiar
  su contraseña.

## 3. Estructura nueva

```
app/                      ← código del servidor, FUERA de la carpeta pública
  config.ejemplo.php      ← plantilla (se sube a git); reemplaza a .env.example
  config.php              ← valores reales (NO se sube; .gitignore); reemplaza a .env
  arranque.php            ← carga config, zona horaria, errores sin detalles, PDO, sesión
  bd.php                  ← PDO (ERRMODE_EXCEPTION, EMULATE_PREPARES false, utf8mb4, time_zone +00:00)
  http.php                ← router mínimo, json(), error(), leer_json() con límite de tamaño, cabeceras
  seguridad.php           ← mismo origen (Origin + Sec-Fetch-Site), límites por IP (tabla limites)
  sesiones.php            ← SessionHandlerInterface sobre la tabla sesiones
  auth.php  clientes.php  admin.php  api.php  pedidos.php  resenas.php  ofertas.php
  validar.php  contrasenas.php  intentos.php  imagenes.php  totp.php  bitacora.php
public/
  .htaccess               ← reescrituras, redirecciones viejas, cabeceras (CSP…), caché, HTTPS
  api/index.php           ← único punto de entrada de /api/* y /healthz; hace require de ../../app/
  vendor/chart.umd.js     ← copia fija de chart.js 4.4.7 (ya no hay npm en el servidor)
  (todo lo demás igual)
```

- En IONOS, el **directorio de destino del dominio** apunta a `…/necutla/public`, así `app/` queda fuera de
  la web. Si el panel no deja apuntar a una subcarpeta, `app/` va dentro de `public/` con un `.htaccess`
  `Require all denied`, y se prueba que dé 403.
- `app/config.php` devuelve un arreglo con estos valores:
  - `bd` (host, nombre, usuario, contraseña: los da IONOS);
  - `secreto` (32 bytes al azar; para el HMAC de huellas y de IPs);
  - `produccion` (bool);
  - `whatsapp_respaldo`;
  - `confiar_x_forwarded_for`: solo `true` en desarrollo, para que `ataques.js` simule IPs. En IONOS
    compartido la IP real viene en `REMOTE_ADDR`.

## 4. Equivalencias de Node a PHP

| Hoy (Node) | PHP |
|---|---|
| `express.Router` y `:id` | `http.php`: tabla de rutas con regex, mismas rutas y métodos, 404 JSON `{"error":"Ruta no encontrada."}` |
| `express.json({limit})` | `leer_json()` lee `php://input` con tope de 20 KB, o de 2 MB en las mismas rutas de `CON_IMAGEN`; 413 y 400 con los mismos textos |
| `helmet` | cabeceras en `.htaccess` (`mod_headers`) para los archivos, y `header()` en la API: misma CSP, HSTS en producción, nosniff, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, sin `X-Powered-By` (`expose_php` / `header_remove`) |
| `express-session` + connect-pg-simple | `session_set_save_handler` sobre `sesiones` con estos ajustes: cookie `__Host-necutla.sid` en producción (`necutla.sid` en local); `httponly`, `secure` y `SameSite=Strict`; 8 h deslizantes y 24 h máximas (`vidaMaxima`); `session_regenerate_id(true)` al entrar y al salir |
| `express-rate-limit` | `limites` con estos topes: 300 peticiones cada 15 min por IP en `/api`; los mismos límites por ruta (login, registro, pedidos, opiniones, revisar-correo); respuesta 429 con el mismo texto |
| `bcryptjs` | `password_hash($p, PASSWORD_BCRYPT, ['cost' => BCRYPT_COST actual])` y `password_verify`; misma regla de 72 bytes |
| `pg` (`$1`, `$2`) | PDO con `?` o `:nombre`. Nunca concatenar valores |
| `RETURNING` | `lastInsertId()` o un `SELECT` después, dentro de la misma transacción |
| `ON CONFLICT DO NOTHING / UPDATE` | `INSERT IGNORE` / `INSERT … ON DUPLICATE KEY UPDATE` |
| `= ANY($1)` | `IN (?, ?, …)` armado con la cantidad de `?` que haga falta (solo placeholders) |
| arreglo `dias` | `JSON_CONTAINS(dias, ?)` con el día como texto JSON |
| `count(*) FILTER (WHERE …)` | `SUM(CASE WHEN … THEN 1 ELSE 0 END)` |
| `json_agg`, `array_agg` | segunda consulta y armado en PHP (`JSON_ARRAYAGG` no existe en MariaDB 10.4) |
| `AT TIME ZONE 'America/Mexico_City'` | `CONVERT_TZ(col, '+00:00', '-06:00')`. México no tiene horario de verano desde 2022, y las tablas de zonas horarias pueden no estar cargadas en IONOS. En PHP, `date_default_timezone_set('America/Mexico_City')` para "hoy" |
| `generate_series` (serie diaria del resumen) | rellenar los días vacíos en PHP |
| `HOY_PRUEBA` | igual, solo si `produccion` es `false` |
| `crypto` HMAC / al azar | `hash_hmac('sha256', …)`, `random_bytes`, `hash_equals` |
| `server/totp.js` | `totp.php` con `hash_hmac('sha1')`, base32 y la misma ventana; los códigos de respaldo, en JSON |
| `server/imagenes.js` (quita EXIF/GPS por bytes) | `imagenes.php` con el mismo algoritmo por bytes (el JPEG conserva la orientación), sin GD, para no volver a comprimir. Mismos tipos y tope de 1 MB |
| DNS MX en `validar.js` | `dns_get_record($dominio, DNS_MX)` y luego `DNS_A + DNS_AAAA`; si falla, se acepta, como hoy; caché de 1 h en una tabla o en APCu si existe |
| `bitacora.js`, `intentos.js` | igual con PDO; limpieza de viejos: 1 de cada 100 peticiones (no hay `setInterval` ni, en todos los planes, cron) |
| `migrate()` al arrancar | se acabó: el esquema se aplica a mano en phpMyAdmin (`db/mariadb/schema.sql`). Las migraciones de datos ya corrieron y quedaron registradas en `migraciones` |
| `importarEjemplos`, `importarServicios`, `ensureInitialAdmin` | no se portan: los datos ya vienen en la base convertida |
| `/vendor/chart.umd.js` desde `node_modules` | archivo fijo en `public/vendor/` |
| `/t/:slug`, `/p/:id`, redirecciones 301, `security.txt`, `noindex` de Necutools, `no-cache` en HTML/CSS/JS | `.htaccess` con `mod_rewrite` y `mod_headers` |

**Tipos en el JSON:** node-pg devuelve `NUMERIC` como texto (`"250.00"`), enteros como número y
booleanos como `true`/`false`. PDO con MySQL devuelve `0`/`1`. En PHP hay que convertir cada campo para
que el JSON salga **idéntico** al de hoy: booleanos con `(bool)`, decimales como texto con 2 decimales
como ahora, fechas en ISO 8601 con `Z` como las saca `pg`, y los arreglos JSON decodificados. Se revisa
ruta por ruta contra el código de `server/`.

## 5. Desarrollo local (en esta máquina)

- Se usa **XAMPP**, que ya está instalado: Apache, PHP 8.2.12 y MariaDB 10.4.32. Se prueba con Apache de
  verdad, así el `.htaccess` es el mismo que en IONOS.
- Virtual host de XAMPP en `http://localhost:8081` con `DocumentRoot` en `Prueba-2/public` y
  `AllowOverride All`. Así no choca con el puerto 80 de XAMPP ni con el 8080 de pgAdmin.
- Base local: `necutla` en el MariaDB de XAMPP, cargada desde `~/necutla-mariadb.sql`. Ya existe la base de
  prueba `necutla_prueba_ionos` con esos datos.
- Para correr `scripts/seguridad/ataques.js` hace falta Node solo en la máquina de desarrollo. Se baja a la
  carpeta temporal de la sesión, como el 2026-10-20. Antes de borrar `server/`, se pasa `server/totp.js` a
  `scripts/seguridad/totp.js`, porque la batería lo usa.

## 6. Pruebas (antes de subir a IONOS)

1. Las 63 rutas responden con el mismo JSON y el mismo código que en Node. Se revisa leyendo cada handler
   de `server/` junto a su versión en PHP. Si se puede, se compara contra el servidor de Node levantado
   con `embedded-postgres` en la carpeta temporal.
2. `node scripts/seguridad/ataques.js http://localhost:8081`: 225 de 225 (con
   `confiar_x_forwarded_for = true` solo en local).
3. Navegador a 1280 y 360 px, en estas pantallas: portada, tienda, producto con colores, carrito →
   WhatsApp (pedido guardado), promociones, cuenta (registro, login con usuario o correo, completar
   cuenta, cambiar contraseña) y Necutools completo (las 9 pestañas, 2 pasos, imágenes). Cero errores de
   consola o de CSP y sin scroll horizontal.
4. Login con las cuentas reales de la base convertida: los hashes `$2a$` funcionan. Solo en local, con una
   contraseña que el usuario dé en ese momento.
5. 404 o 403 para `/app/`, `/app/config.php`, `/plans/`, `/db/`, `/.git/` y `/scripts/`.
6. Imagen subida: sin EXIF ni GPS, y la orientación se conserva.

## 7. Día del cambio (con el usuario)

1. Avisar a los vendedores que no editen Necutools durante el cambio (unos 30 minutos).
2. Sacar un **respaldo nuevo** de Render (pgAdmin → `necutla` → Backup…, formato Custom) y convertirlo:
   `python3 -I scripts/migracion/pg-a-mariadb.py RESPALDO ~/necutla-mariadb.sql`.
   El de hoy ya va a estar viejo.
3. IONOS → Bases de datos → crear una base MariaDB. Anotar host, nombre (`dbs…`), usuario y contraseña.
4. phpMyAdmin de IONOS → elegir la base → Importar `~/necutla-mariadb.sql`.
5. Subir `app/` y `public/` por SFTP a la carpeta `necutla/` del espacio web. Crear `app/config.php` en el
   servidor con los datos de la base y un `secreto` nuevo.
6. IONOS → Dominios → apuntar el dominio a `necutla/public`, activar el certificado SSL y elegir PHP 8.2 o
   más nuevo.
7. Comprobar `https://DOMINIO/healthz` (`{"ok":true}`), la portada, el login de Necutools, un pedido a
   WhatsApp y una imagen. Todos vuelven a iniciar sesión una vez.
8. Cambiar los enlaces y QR que apunten a `necutla.onrender.com`.
9. Dejar Render encendido unos días como respaldo. Después, borrar el servicio `necutla` y la base
   `necutla-db`. **La base gratis de Render caduca a los 30 días de creada (se creó el 2026-10-17, así que
   cerca del 2026-11-16)**: el cambio debe hacerse antes de esa fecha.

## 8. Lo que se quita al final

Va en el último prompt, después de que todo pase las pruebas, y con commit:
- se quitan `server/`, `package.json`, `package-lock.json`, `.node-version`, `render.yaml`,
  `db/schema.sql` (PostgreSQL) y `scripts/importar-ejemplos.js`; todo sigue en el historial de git;
- `.env.example` pasa a `app/config.ejemplo.php`, y `.gitignore` agrega `app/config.php`;
- se reescriben las secciones de despliegue, base y seguridad de `README.md`.

## 9. Riesgos

- **Contrato de la API**: el riesgo más grande es que una respuesta cambie de tipo, por ejemplo `1` en vez
  de `true`, y algo del frontend falle sin avisar. Lo cubren la sección 4 ("Tipos en el JSON") y las
  pruebas 1 a 3.
- **Límites del hosting compartido**: memoria, tiempo por petición, `post_max_size` y si
  `dns_get_record` está habilitado. Se revisan con un `phpinfo()` temporal en IONOS, que se borra
  enseguida.
- **Sin acceso externo a la base**: la base de IONOS compartido solo se ve desde su espacio web. pgAdmin
  deja de servir para producción y se usa el phpMyAdmin del panel de IONOS.
- **IP compartida de la escuela** (pendiente 12): el límite de 300 cada 15 min se mantiene.
- **Sin SSH ni cron en los planes básicos**: por eso la limpieza de viejos corre dentro de las peticiones
  y el despliegue es por SFTP.
