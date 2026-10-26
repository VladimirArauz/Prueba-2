# Prompts: cambio de hoster a IONOS (PHP + MariaDB)

Plan: `plans/planes/2026-10-25-migracion-ionos-php-mariadb.md`. Ejecutar en orden, uno por sesión o
seguidos. La sección 2 del plan (base de datos) ya está hecha. Trabajar siempre en `main`, sin ramas.

## Prompt 1: esqueleto PHP, base local y .htaccess

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y `plans/planes/2026-10-25-migracion-ionos-php-mariadb.md`.
Aplica las secciones 3 y 5 del plan:
- Crea la base `necutla` en el MariaDB de XAMPP desde `~/necutla-mariadb.sql`.
- Crea el virtual host de XAMPP en el puerto 8081.
- Escribe `app/config.ejemplo.php` y `app/config.php`, y agrega `app/config.php` a `.gitignore`.
- Escribe `arranque.php`, `bd.php`, `http.php`, `seguridad.php` y `sesiones.php`.
- Escribe `public/api/index.php` con `/healthz`, y `public/.htaccess` con: reescrituras de `/api`, `/t/:slug`
  y `/p/:id`; redirecciones 301 viejas; `security.txt`; cabeceras de seguridad iguales a las de
  `server/index.js`; caché `no-cache` en HTML, CSS y JS; HTTPS en producción.
- Copia `chart.umd.js` 4.4.7 a `public/vendor/`.

Prueba con `curl` lo siguiente: las cabeceras; las páginas; los 404 de `/app/`, `/plans/` y `/db/`; el 403
sin Origin; el 413 con un cuerpo grande; el 429 al pasar el límite; y `/healthz`. No toques `server/`
todavía. Cambia el estado del plan a `en curso` si no lo está.

## Prompt 2: API pública

Lee `plans/CLAUDE.md` y el plan `2026-10-25-migracion-ionos-php-mariadb.md`. Pasa a PHP `server/api.js`,
`server/ofertas.js`, la parte pública de `server/resenas.js` y `POST /api/pedidos` de `server/pedidos.js`.
Hazlo en `app/api.php`, `app/ofertas.php`, `app/resenas.php` y `app/pedidos.php`, con las equivalencias de
la sección 4.

El JSON de cada ruta debe salir idéntico al de Node: tipos, nombres, orden de los bloques y textos de
error. Ve handler por handler. Para el carrito usa los precios del servidor (`calcularCarrito`) e incluye
el color. Prueba en el navegador la portada, la tienda, el producto con colores, las promociones, el
buscador y carrito → WhatsApp, a 1280 y 360 px, con cero errores de consola o de CSP.

## Prompt 3: cuentas, sesiones y seguridad de login

Lee `plans/CLAUDE.md` y el plan `2026-10-25-migracion-ionos-php-mariadb.md`. Pasa a PHP `server/auth.js`,
`server/clientes.js`, `server/contrasenas.js`, `server/intentos.js`, `server/totp.js` y `server/validar.js`
(con DNS MX y sugerencias de errores de dedo). Conserva todo esto:
- la cookie `__Host-` en producción, `regenerate` al entrar y al salir, 8 h deslizantes y 24 h máximas;
- `sesion_version`;
- el freno por cuenta;
- 2 pasos con códigos de respaldo;
- login con usuario o correo: primero el usuario exacto, por `Axel`/`axel`;
- 409 sin revelar qué chocó.

Prueba el registro, el login, completar la cuenta, cambiar la contraseña y los 2 pasos. Prueba también el
login con una cuenta real de la base convertida, con una contraseña que dé el usuario en ese momento (no la
guardes).

## Prompt 4: Necutools

Lee `plans/CLAUDE.md` y el plan `2026-10-25-migracion-ionos-php-mariadb.md`. Pasa a PHP `server/admin.js`
(las 35 rutas), la parte de administración de `server/pedidos.js` (lista, estados y resumen con la serie
diaria rellenada en PHP y `CONVERT_TZ` a -06:00), `server/bitacora.js` y `server/imagenes.js` (sin EXIF ni
GPS, por bytes, con la orientación del JPEG). Respeta los permisos de dueño y encargado, y aplica
`requireAdmin` y validación en cada ruta que modifique datos. Prueba las 9 pestañas de Necutools a 1280 y
360 px como dueño y como encargado: crear, editar y borrar productos, colores, ofertas, promociones,
tiendas y usuarios, más pedidos, opiniones y bitácora.

## Prompt 5: pruebas completas

Lee `plans/CLAUDE.md` y el plan `2026-10-25-migracion-ionos-php-mariadb.md`. Corre toda la sección 6 del
plan. Pasa `server/totp.js` a `scripts/seguridad/totp.js` y ajusta el `require` de
`scripts/seguridad/ataques.js`. Baja Node 22 a la carpeta temporal de la sesión, revisando su checksum, y
corre `ataques.js` contra `http://localhost:8081` hasta tener 225 de 225. Si una prueba depende de algo
propio de Node, ajusta la prueba (no la regla) y anótalo. Corre `/security-review`. Anota los resultados.

## Prompt 6: limpieza, documentación y commit

Lee `plans/CLAUDE.md` y el plan `2026-10-25-migracion-ionos-php-mariadb.md`. Aplica la sección 8: quita los
archivos de Node y reescribe `README.md` (local con XAMPP, despliegue en IONOS, base, seguridad, cómo
convertir un respaldo). Actualiza `plans/MEMORIA.md`: tabla, cambios hechos, y pendientes del día del
cambio y de los pasos de Render que ya no aplican. Pregúntale al usuario si autoriza actualizar las
secciones 1 y 4 de `plans/CLAUDE.md`. Haz commit en `main` y pregunta antes del push.

## Prompt 7: día del cambio en IONOS (con el usuario)

Lee `plans/CLAUDE.md` y el plan `2026-10-25-migracion-ionos-php-mariadb.md`. Guía al usuario paso a paso
por la sección 7. Cada paso en el panel de IONOS lo hace el usuario; tú convierte el respaldo nuevo, arma
`app/config.php` sin mostrar secretos en el chat y verifica el sitio en vivo con `curl`. Al terminar,
cambia el estado del plan a `aplicado` y anota en `plans/MEMORIA.md` la fecha, el dominio y lo que falte
(apagar Render).
