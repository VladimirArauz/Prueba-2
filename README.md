# Necutla — La Ciudad del Estudiante

Catálogo de varias tiendas estudiantiles. Cada tienda tiene su catálogo (con subcategorías), sus
servicios, sus ofertas de cada día y sus propios vendedores: el carrito se agrupa por tienda y cada
pedido llega por WhatsApp solo a los vendedores de esa tienda. Además hay promociones generales de
temporada en forma de paquete, que pueden juntar productos de varias tiendas.

Todo se administra desde **Necutools** (`/necutools.html`) y se guarda en **MariaDB**. El sitio corre en
el **hosting compartido de IONOS** con **PHP 8.5** y Apache (sin Node). Con PHP más viejo que 8.5 la API
no arranca: así no se queda corriendo en una versión sin los parches de PHP2Shell (CVE-2026-109618/109619). Plan del cambio de Render a IONOS:
`plans/planes/2026-10-25-migracion-ionos-php-mariadb.md`.

## Estructura

```
public/                Sitio: lo único que se publica (el dominio apunta aquí)
  .htaccess            Direcciones (/t/<tienda>, /p/<id>), redirecciones viejas, HTTPS, cabeceras de seguridad y caché
  api/index.php        Único punto de entrada de la API (/api/* y /healthz)
  index.html           Portada: tablero de tiendas, promociones, ofertas de hoy y buscador
  tienda.html          Una sola página para todas las tiendas (/t/<tienda>)
  producto.html        Un producto o servicio con sus opiniones (/p/<id>)
  carrito.html         Carrito agrupado por tienda
  promociones.html     Promociones de temporada
  cuenta.html          Cuenta de cliente (para opinar)
  necutools.html       Panel de administración
  js/                  comun.js (API, carrito, WhatsApp) + un archivo por página; graficas.js (Chart.js);
                       validacion.js (validación en vivo y medidor de contraseña)
  vendor/chart.umd.js  Chart.js 4.4.7 (copia fija, revisada con el hash de npm)
  datos/paises.json    Países con su lada y el largo de sus teléfonos (lo usa también el servidor)
  style.css, iconos.js Sistema de diseño e iconos (Lucide)
app/                   Servidor en PHP, FUERA de la carpeta pública
  config.ejemplo.php   Plantilla de configuración (copiar a config.php)
  config.php           Configuración real: base, secreto… (NO se sube a git)
  arranque.php         Carga todo, convierte errores en respuestas sin detalles y atiende la petición
  bd.php               Conexión PDO a MariaDB (UTC, consultas con parámetros)
  http.php             Router, respuestas, lectura del JSON (20 KB; 2 MB solo al subir imágenes)
  seguridad.php        Mismo origen (CSRF) y límite de peticiones por IP (tabla limites)
  sesiones.php         Sesiones en la tabla sesiones (cookie __Host-necutla.sid)
  api.php              API pública (tiendas, ofertas, promociones, búsqueda, precios del carrito)
  admin.php            API de Necutools (/api/admin), con permisos por rol
  pedidos.php          Pedidos enviados por WhatsApp y resumen del dashboard de Necutools
  auth.php, clientes.php  Login de Necutools y cuentas de cliente
  resenas.php          Opiniones
  ofertas.php          Cálculo de las ofertas del día (único lugar que pone precios con descuento)
  validar.php          Validación compartida (correo con DNS MX, teléfono por país, usuario…)
  contrasenas.php      Reglas de contraseñas nuevas
  intentos.php         Límite de intentos fallidos por cuenta
  totp.php             Verificación en dos pasos (Google Authenticator y similares)
  imagenes.php         Quita los metadatos (GPS, modelo del celular) de las imágenes subidas
  bitacora.php         Registro de lo que se hace en Necutools
db/mariadb/schema.sql  Tablas de la base (se aplican a mano en phpMyAdmin; se puede correr varias veces)
scripts/
  crear-admin.php      Crea un dueño o le pone contraseña nueva (php8.5 scripts/crear-admin.php USUARIO)
  migracion/pg-a-mariadb.py  Convierte un respaldo de PostgreSQL (Render) en el .sql de MariaDB
  seguridad/ataques.js Pruebas de ataque contra el servidor local (necesita Node solo para correrlas)
recursos/              Fotos reales sin usar todavía (no se publican)
plans/                 Reglas del proyecto, planes y prompts (no se publica)
```

## Correrlo en tu computadora (XAMPP)

Requisitos: Apache con `mod_rewrite`, `mod_headers` y `mod_proxy_fcgi`, **PHP 8.5** con `pdo_mysql`,
`mbstring` e `intl`, y MariaDB 10.4 o más nuevo.

En esta máquina se usan el Apache y el MariaDB de XAMPP con el **PHP 8.5 de Ubuntu** (paquetes
`php8.5-fpm`, `php8.5-mysql`, `php8.5-mbstring` y `php8.5-intl`, versión `8.5.4-0ubuntu1.5` o más nueva,
que ya trae el parche de PHP2Shell; Ubuntu no cambia el número que muestra `php -v`, se revisa con
`dpkg -l php8.5-fpm`). El PHP 8.2.12 de XAMPP (`mod_php`) quedó apagado porque XAMPP no tiene versión
corregida. Para tener los parches al día: `sudo apt update && sudo apt upgrade`.

- `/etc/php/8.5/fpm/pool.d/necutla.conf`: Necutla corre como el dueño de la carpeta, solo puede abrir
  `app/` y `public/` (`open_basedir`), sin funciones para correr comandos, sin `allow_url_fopen` y sin
  mostrar errores.
- `/etc/php/8.5/fpm/pool.d/xampp.conf`: el dashboard y phpMyAdmin de XAMPP (puerto 80).
- `/opt/lampp/etc/extra/httpd-xampp.conf` y `necutla.conf` mandan los `.php` a esos pools (copias de
  antes en `*.antes-php85`).

1. Base de datos (phpMyAdmin de XAMPP en http://localhost/phpmyadmin):
   - Crea la base `necutla` con intercalación `utf8mb4_unicode_ci` (correos y usuarios llevan su propia
     intercalación, `utf8mb4_nopad_bin`, que viene en el esquema).
   - Importa el `.sql` que sale de `scripts/migracion/pg-a-mariadb.py` (esquema y datos). Para una base
     vacía, importa solo `db/mariadb/schema.sql` y crea un dueño con `php8.5 scripts/crear-admin.php TU_USUARIO`.
   - Crea un usuario de MariaDB solo para esa base (no uses `root` en `config.php`).
2. Configuración: `cp app/config.ejemplo.php app/config.php` y llénalo. En local pon
   `'produccion' => false` (la cookie no lleva `Secure` y se puede entrar por http).
3. Apache: un virtual host con `DocumentRoot` en la carpeta `public/` y `AllowOverride All`. En esta
   máquina ya existe en el puerto 8081 (`/opt/lampp/etc/extra/necutla.conf`): http://localhost:8081/

Cambiar la estructura de la base: agrega sentencias que se puedan repetir sin error a
`db/mariadb/schema.sql` y córrelas en phpMyAdmin (local e IONOS). PHP ya no aplica el esquema solo.

## Cómo funciona

- **Tiendas**: cada una tiene dirección propia (`/t/ropa`), descripción, icono, orden en el directorio,
  números de WhatsApp de sus vendedores y subcategorías. Si una tienda no tiene números, usa los de
  `whatsapp_respaldo` (`app/config.php`). Las direcciones viejas (`/ropa/playeras/`) redirigen a la nueva.
- **Productos y servicios**: los productos se agregan al carrito; los servicios (precio fijo, "desde"
  o "a cotizar") se piden por WhatsApp directo a la tienda. Cada tienda muestra sus servicios en una
  sección propia (`/t/<tienda>#servicios`).
- **Colores de un producto**: hasta 12 colores, cada uno con su foto y si está disponible (Necutools →
  Productos y servicios → Editar → Colores). Todos cuestan lo mismo; el color elegido llega al carrito y
  al mensaje de WhatsApp.
- **Ofertas de la tienda**: semanales (por día de la semana), de temporada (por fechas) o remates; por
  porcentaje, precio especial o 2x1, sobre un producto, una subcategoría o toda la tienda. El servidor
  las calcula con la fecha de Ciudad de México.
- **Promociones generales**: paquetes con precio propio y fechas de inicio y fin. Al pedir uno se avisa
  a los vendedores de todas las tiendas incluidas.
- **Carrito**: guarda solo `{tipo, id, cantidad, color}` en el navegador. Nombres, precios y descuentos
  los calcula siempre el servidor (`POST /api/carrito/precios`).
- **Pedidos**: al tocar "Enviar pedido por WhatsApp" se guarda el pedido (`POST /api/pedidos`) con los
  precios del servidor. **No se guarda ningún dato del cliente**: solo tienda, productos, piezas, total
  y fecha. Si guardarlo falla, WhatsApp se abre igual.
- **Necutools**: los **dueños** crean tiendas, usuarios y promociones y editan todo; los **encargados**
  solo editan las tiendas que tienen asignadas. Se entra con el usuario o con el correo en el mismo campo.
- **Cuentas de cliente** (`/cuenta.html`, solo para opinar): nombre, usuario único, correo con un dominio
  que reciba correos (revisión DNS MX), teléfono con la lada de su país (privado: no sale en ninguna
  respuesta) y contraseña escrita dos veces.
- **Código por correo** (`app/codigos.php`, `app/correo.php`, `public/js/codigo.js`): entrar, crear la cuenta y
  "¿Olvidaste tu contraseña?" piden un código de 6 dígitos que llega desde `tienda@necutla.com`. Vence a los
  10 minutos, sirve una vez, aguanta 5 intentos y solo vale en el navegador que lo pidió; se reenvía cada 60 s
  (5 por hora). La cuenta se crea hasta poner el código, y entonces la sesión se inicia sola. Restablecer no dice
  si una cuenta existe. En local los correos se guardan en `/tmp/necutla-correos/` (`correo.modo = 'archivo'`).
- **Sesión de cliente sin vencimiento**: cookie de 400 días (el máximo de Chrome) que se renueva en cada visita;
  solo se cierra con "Cerrar sesión" o al cambiar o restablecer la contraseña. Necutools sigue con 8 h / 24 h.
- **Contraseñas nuevas**: minúscula, mayúscula, número y carácter especial; 10 caracteres o más para
  clientes y 12 para Necutools; hasta 72 bytes; siempre se escriben dos veces.
- **Dashboard de Necutools**: indicadores del periodo (7, 30 o 90 días) contra el anterior, gráficas con
  **Chart.js** (servido desde `public/vendor/`, sin CDN), productos más pedidos, pedidos recientes y
  pendientes. "Ventas" cuenta solo los pedidos marcados como vendidos.
- **Mientras carga**: las listas muestran esqueletos (bloques planos con la forma de las tarjetas,
  `pintarEsqueletos()` en `public/js/comun.js`) en lugar de un spinner. Con movimiento reducido no pulsan.
- **Vista previa del enlace** (Open Graph): al mandar un enlace por WhatsApp sale una tarjeta con
  imagen, título y descripción. `/t/<tienda>` y `/p/<id>` llevan los datos de esa tienda o producto
  (`app/paginas.php`); las demás páginas, la imagen general `public/imagenes/og-necutla.png` (1200×630,
  fuente en `recursos/og/og-necutla.svg`). Necesita `url_publica` en `app/config.php`.
  Las tiendas sin portada PNG/JPG/WEBP usan una imagen hecha con GD (`app/og-imagen.php`,
  `/api/stands/<id>/vista`) con su nombre, descripción y subcategorías. Necesita la extensión GD con FreeType
  (IONOS la trae; en local, `sudo apt install php8.5-gd`) y las fuentes de `app/fuentes/`: Archivo fija en
  125/800, 112/700 y 100/500, sacada de la variable de Google Fonts con
  `fonttools varLib.instancer "Archivo[wdth,wght].ttf" wdth=125 wght=800 -o Archivo-125-800.ttf`. Sin GD,
  la tienda usa la imagen general.

### Qué botón usar

| Clase | Para qué | Ejemplo |
|---|---|---|
| `.btn` (amarillo) | La acción principal del grupo. Solo uno por grupo | "Guardar producto", "Ver tienda" |
| `.btn.secondary` | Acciones de apoyo o para salir de una edición | "Cancelar edición", "Mostrar más" |
| `.btn.ghost` | Acciones discretas de navegación, sin borde visible | "Volver", "Cerrar menú" |
| `.btn.danger` | Solo borrar, quitar o vaciar | "Vaciar carrito", icono de borrar |
| `.btn.wa` | Solo el envío por WhatsApp | "Enviar pedido por WhatsApp" |
| `.btn-sm`, `.btn-icon`, `.btn-block` | Tamaño (36px), solo icono (con `aria-label`) y ancho completo | |

Estados: hover y presionado los da `style.css`. `disabled` lo pone gris en cualquier variante
(agotado, sin datos). Mientras espera al servidor se usa `botonOcupado(boton)` / `botonListo(boton)` de
`comun.js`: el texto cambia a la acción en curso ("Guardando producto"), sin spinner.

## Configuración (`app/config.php`)

| Clave | Para qué sirve |
|---|---|
| `produccion` | `true` en IONOS: cookie `__Host-necutla.sid` con `Secure`. `false` solo en tu computadora |
| `bd` | `host`, `puerto`, `nombre`, `usuario`, `password` de MariaDB (en IONOS salen en el panel de la base) |
| `secreto` | 32 bytes al azar en base64 (`php -r "echo base64_encode(random_bytes(32)), PHP_EOL;"`). Firma las huellas de pedidos y las IP del límite |
| `whatsapp_respaldo` | Números para las tiendas sin números propios, separados por coma (`5255XXXXXXXX`) |
| `confiar_x_forwarded_for` | `false` en IONOS (la IP real viene en `REMOTE_ADDR`). `true` solo en local, para `ataques.js` |
| `correo_dns_prueba` | Solo en local: no consulta el DNS al revisar correos (todo dominio vale salvo `*.invalid` y `sin-correo.*`) |
| `url_publica` | Dirección del sitio sin `/` al final (ej. `https://necutla.com`). Arma las direcciones completas de la vista previa del enlace (`og:url`, `og:image`). Vacía: la vista previa sale sin imagen |
| `correo` | Buzón que manda los códigos de las cuentas de cliente: `modo` (`smtp`, o `archivo` solo en local: guarda los correos en `/tmp/necutla-correos/`), `host` (`smtp.ionos.mx`), `puerto` (465), `usuario` y `password` del buzón, `remitente` y `nombre` |
| `hoy_prueba` | Solo en local: fija la fecha de "hoy" (`AAAA-MM-DD`) para probar ofertas y promociones |

`app/config.php` **nunca** se sube a git (está en `.gitignore`).

## Publicar en IONOS (hosting compartido)

1. **Base**: panel de IONOS → Hosting → **Bases de datos** → *Crear base de datos* (MariaDB). Anota el
   host (`db…hosting-data.io`), el nombre (`dbs…`), el usuario (`dbu…`) y la contraseña.
2. **Datos**: saca un respaldo nuevo de Render (pgAdmin → `necutla` → *Backup…*, formato **Custom**) y
   conviértelo en tu computadora:
   ```
   python3 -I scripts/migracion/pg-a-mariadb.py RESPALDO ~/necutla-mariadb.sql
   ```
   En IONOS → la base → **phpMyAdmin** → elige la base `dbs…` a la izquierda → **Importar** → ese archivo.
   El archivo lleva contraseñas cifradas, correos y teléfonos: no lo subas a git ni lo compartas.
3. **Archivos**: por SFTP (los datos de acceso están en IONOS → Hosting → SFTP y SSH), sube las carpetas
   `app/` y `public/` a una carpeta `necutla/` del espacio web. No subas `plans/`, `scripts/`, `db/`,
   `recursos/` ni `.git`.
4. **Configuración**: en el servidor, copia `app/config.ejemplo.php` a `app/config.php` y llena los datos
   de la base, un `secreto` nuevo y `'produccion' => true`.
5. **Dominio**: IONOS → Dominios y SSL → tu dominio → *Destino* = la carpeta `necutla/public`. Activa el
   certificado SSL y, en Hosting → *Versión de PHP*, elige **8.5** (o la más nueva que aparezca). IONOS
   aplica los parches de seguridad de esa versión por su cuenta.
6. **Comprobar**: `https://TU-DOMINIO/healthz` debe decir `{"ok":true}`; luego la portada, el login de
   Necutools, un pedido a WhatsApp y una imagen. Todos vuelven a iniciar sesión una vez.

Si el panel no deja apuntar el dominio a `necutla/public`, se puede apuntar a `necutla/` y mover el
contenido de `public/` ahí, con `app/` protegida por un `.htaccess` que diga `Require all denied` (y
cambiar la ruta del `require` en `api/index.php`). Revisa que `https://TU-DOMINIO/app/config.php` dé 403
o 404.

Para subir cambios después: vuelve a subir por SFTP los archivos que cambiaron. Si cambió
`db/mariadb/schema.sql`, corre lo nuevo en phpMyAdmin.

## Administrar la base

La base de IONOS compartido solo se ve desde su propio espacio web: no se conecta desde pgAdmin ni desde
fuera. Se administra en IONOS → Bases de datos → **phpMyAdmin**. Respaldos: phpMyAdmin → *Exportar*.

Tablas: `stands` (tiendas), `subcategorias`, `productos` (productos y servicios), `producto_colores`,
`ofertas`, `promociones`, `promocion_items`, `pedidos`, `admins`, `admin_stands` (tiendas de cada
encargado), `clientes`, `resenas`, `bitacora`, `intentos_login`, `migraciones`, `sesiones`, `limites` y
`dns_correo`.

## Seguridad

Auditoría completa en `plans/auditorias/2026-10-20-seguridad.md` (se hizo sobre la versión en Node; la
versión en PHP pasa las mismas pruebas).

| Capa | Protección |
|---|---|
| Archivos | Solo se publica `public/`; `app/` (con `config.php`), `plans/`, `db/` y `.git` quedan fuera. Dentro de `public/`, los archivos que empiezan con punto y cualquier `.php` que no sea `api/index.php` dan 404 |
| Cabeceras | En `public/.htaccess`: CSP estricta (sin scripts ni estilos en línea), HSTS con HTTPS, `nosniff`, `Permissions-Policy` sin cámara, micrófono ni ubicación; Necutools y `/api` con `noindex`; respuestas privadas con `no-store`; sin `X-Powered-By` |
| Peticiones | Solo las rutas de Necutools que suben imágenes aceptan 2 MB; el resto, 20 KB. Lo que modifica datos debe venir de este sitio (`Origin` obligatorio y `Sec-Fetch-Site`). TRACE no se acepta. La redirección a HTTPS solo cree lo que dice Apache, no la cabecera `X-Forwarded-Proto` |
| Sesión | En la tabla `sesiones` (solo el SHA-256 de la cookie); cookie `__Host-necutla.sid` (`HttpOnly`, `Secure`, `SameSite=Strict`); id nuevo al entrar y al salir; Necutools: 8 h sin uso o 24 h en total; clientes: 400 días renovados en cada visita, hasta cerrar sesión |
| Cuentas | Correo y usuario se guardan en minúsculas y se comparan exactos (`josé` y `jose` son cuentas distintas); bcrypt (costo 12; las contraseñas de antes siguen sirviendo); 10 fallos seguidos frenan la cuenta 15 minutos, venga de la IP que venga; además, 10 por IP |
| Dos pasos | Opcional en Necutools ("Mi cuenta"); 8 códigos de respaldo de un solo uso |
| Permisos | Revisados en el servidor en cada petición: un encargado no toca tiendas ajenas ni paquetes |
| Datos | Consultas con parámetros; validación de cada campo; los precios los pone el servidor; todo texto se escapa al mostrarlo |
| Imágenes | Tipo real por sus bytes, máximo 1 MB, sin SVG; sin metadatos (GPS, modelo del celular); las de algo oculto solo las ve quien puede editarlo |
| Pedidos | Precios del servidor, hasta 30 piezas y 15 productos, sin duplicados en 10 minutos, 40 por hora por IP y 500 por hora en total |
| Límites | 300 peticiones a la API cada 15 minutos por IP (tabla `limites`, con la IP cifrada con HMAC) |
| PHP | 8.5 con parches al día; con una versión más vieja la API no arranca. En local: pool propio con `open_basedir` y sin funciones para correr comandos |
| Reportes | `/.well-known/security.txt` dice cómo reportar una falla en privado |

**Pruebas de ataque** (solo contra tu computadora, nunca contra IONOS). Necesitan Node 22 solo para
correr la prueba, y en `app/config.php` local `confiar_x_forwarded_for` y `correo_dns_prueba` en `true`:

```
node scripts/seguridad/ataques.js http://localhost:8081
```

Usa un dueño de la base local (`NECUTLA_DUENO_USUARIO` y `NECUTLA_DUENO_PASSWORD`; por defecto `dueno`).
Debe terminar con todas las pruebas bien.

**Checklist en IONOS** (lo que solo puedes hacer tú en el panel):

1. `app/config.php` con `'produccion' => true`, `'confiar_x_forwarded_for' => false` y un `secreto` nuevo;
   permisos 600 (SFTP → clic derecho → Permisos), para que solo tu usuario del hosting lo lea.
2. Hosting → PHP: versión **8.5**. `https://TU-DOMINIO/healthz` debe decir `{"ok":true}` (con PHP viejo da 503).
3. Revisar que `https://TU-DOMINIO/app/config.php`, `/.htaccess` y `/api/../app/config.php` no se vean.
4. Necutools → Mi cuenta → activar la verificación en dos pasos en cada dueño.
5. Respaldar la base (phpMyAdmin → Exportar) de vez en cuando.
6. Si la contraseña de la base se filtró: cámbiala en IONOS → Bases de datos y en `app/config.php`.
