# Plan: PHP 8.5 y cierre de los puntos débiles de la revisión de seguridad

- **Fecha:** 2026-10-25
- **Estado:** aplicado (2026-10-25)
- **Prompts:** `plans/prompts/2026-10-25-php85-y-puntos-debiles.md`
- **Alcance:** versión de PHP (local e IONOS), `app/arranque.php`, `app/bd.php`, `app/auth.php`,
  `app/clientes.php`, `db/mariadb/schema.sql`, `public/.htaccess`, `scripts/seguridad/ataques.js`, `README.md`.
- **Reemplaza en parte a:** `2026-10-25-migracion-ionos-php-mariadb.md` en lo que dice de **PHP 8.2** (ahora
  8.5) y de la intercalación de correos y usuarios (ahora `utf8mb4_nopad_bin`). Lo demás sigue igual.

## 1. Pedido del usuario

"Sigue con lo que falta, revisa esos puntos débiles, haz algo para que no haya puntos débiles y utiliza la
versión de PHP más reciente, ya que se encontró una vulnerabilidad."

La vulnerabilidad es **PHP2Shell** (CVE-2026-109618 y CVE-2026-109619, CVSS 9.2, ejecución remota de código
sin iniciar sesión). Se corrigió el 2026-10-21 en PHP 8.5.12, 8.4.27, 8.3.36 y 8.2.35. El caso más expuesto
es Apache con `mod_php`, que es justo lo que trae XAMPP (PHP 8.2.12, sin versión corregida de XAMPP).

## 2. Versión de PHP

- **IONOS:** PHP 8.5 (IONOS aplica los parches de su lado). La API exige `PHP_VERSION_ID >= 80500`: con una
  versión más vieja responde 503 y lo deja en el log, para que nunca se quede en una versión sin parche.
- **Local:** PHP 8.5 de Ubuntu 26.04 (`8.5.4-0ubuntu1.5`, USN-8948-1, ya trae el parche aunque `php -v` diga
  8.5.4) por PHP-FPM. Se apagó el `mod_php` 8.2.12 de XAMPP; el Apache y el MariaDB de XAMPP se quedan.
  - Pool `necutla`: corre como el dueño de la carpeta (como en el hosting), `open_basedir` a `app/` y
    `public/`, sin `exec`/`shell_exec`/`system`/`proc_open`/`popen`/`putenv`/`mail`, sin `allow_url_fopen`,
    sin subir archivos por formulario (las imágenes llegan en JSON), sin mostrar errores.
  - Pool `xampp`: dashboard y phpMyAdmin del puerto 80.
- Cambio de código por PHP 8.5: `PDO::MYSQL_ATTR_FOUND_ROWS` es obsoleto → `Pdo\Mysql::ATTR_FOUND_ROWS`.

## 3. Puntos débiles de la revisión y qué se hizo

| # | Punto | Decisión |
|---|---|---|
| 1 | Un encargado puede editar su propia tienda | Se queda: es así por diseño desde el plan del catálogo (solo sus tiendas) |
| 2 | Correo y usuario comparaban sin acentos ni espacios finales (`utf8mb4_unicode_ci`) | **Corregido:** columnas `utf8mb4_nopad_bin`; el servidor guarda y busca en minúsculas. `josé` ≠ `jose`; mayúsculas siguen sin importar |
| 3 | `X-Forwarded-Proto: https` se saltaba la redirección a HTTPS | **Corregido:** solo vale `%{HTTPS}` de Apache |
| 4 | El router no distingue mayúsculas y la regla de `no-store` sí | **Corregido:** la regla de `no-store` tampoco distingue |
| 5 | `Sec-Fetch-Site` puede no venir | Se queda: `Origin` del mismo sitio sigue siendo obligatorio; exigir `Sec-Fetch-Site` dejaría fuera a celulares con Safari viejo |
| 6 | Imagen de promoción visible según `activa` | No es de seguridad (la promoción es pública) |
| 7 | Secretos en `app/config.php` | Fuera de `public/`; checklist con permisos 600 en IONOS |
| 8 | Consulta DNS del correo | No es SSRF (solo nombre de dominio) y tiene límite por IP |

## 4. Verificación

- `scripts/seguridad/ataques.js` con 5 pruebas nuevas (mayúsculas sí, acentos no, `/api/Admin/yo` con `no-store`).
- Node contra PHP con los mismos datos, respuestas iguales; navegador; `crear-admin.php` con PHP 8.5 y aviso con PHP 8.2.
- `X-Forwarded-Proto: https` falsificado → 301 a HTTPS.
