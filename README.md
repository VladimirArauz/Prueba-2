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
  privacidad.html      Aviso de privacidad;  terminos.html  Términos de uso;  404.html  Página de error
  robots.txt, site.webmanifest, favicon.ico, apple-touch-icon.png   Buscadores e iconos
  js/                  comun.js (API, carrito, WhatsApp) + un archivo por página; graficas.js (Chart.js);
                       validacion.js (validación en vivo y medidor de contraseña)
  vendor/chart.umd.js  Chart.js 4.6.1 (copia fija, revisada con el hash de npm)
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
  Productos y servicios → Editar → Colores y fotos). Todos cuestan lo mismo; el color elegido llega al carrito y
  al mensaje de WhatsApp.
- **Carruseles de fotos**: el producto base tiene su carrusel (la imagen principal y hasta 5 fotos más,
  `producto_fotos`) y cada color tiene el suyo (su foto y hasta 5 más, `producto_color_fotos`). Se editan en
  Necutools → Colores y fotos → Carrusel. En la página del producto se ve el carrusel base y, al elegir un
  color, el de ese color. Las tarjetas usan el base. Los servicios también tienen carrusel (su imagen principal
  y hasta 5 fotos más en `producto_fotos`, sin colores): se editan en Necutools → Editar servicio → Fotos.
- **Fotos que no caben**: `ajustarFoto()` de `comun.js` muestra completa (`.foto-completa`, `object-fit:
  scale-down`) la foto que `cover` recortaría más del 20 % o que es mucho más chica que su marco; las franjas
  toman el color del borde de la foto (`--foto-fondo`) o `--gis`. El archivo guardado no se toca.
- **Ofertas de la tienda**: semanales (por día de la semana), de temporada (por fechas) o remates; por
  porcentaje, precio especial o 2x1, sobre un producto, una subcategoría o toda la tienda. El servidor
  las calcula con la fecha de Ciudad de México.
- **Promociones generales**: paquetes con precio propio y fechas de inicio y fin. Al pedir uno se avisa
  a los vendedores de todas las tiendas incluidas.
- **Portada**: el servidor (`con_tablero` en `app/paginas.php`) manda el tablero de tiendas y "Explorar las N
  tiendas" ya pintados, para que la página no salte al cargar; `portada.js` solo los repinta si cambió algo.
- **Lo que dicen otros estudiantes** (portada): `GET /api/portada/resumen` da cuántas tiendas, productos,
  servicios y opiniones visibles hay, y las 3 opiniones visibles más nuevas de 4 o 5 estrellas con comentario
  (mismo nombre que en la página del producto; sin correos, teléfonos ni usuarios). Los pedidos pagados solo
  salen cuando son 20 o más (`MINIMO_PEDIDOS_PUBLICOS` en `app/api.php`). Sin opiniones, la sección no se ve.
- **Carrito**: guarda solo `{tipo, id, cantidad, color}` en el navegador. Nombres, precios y descuentos
  los calcula siempre el servidor (`POST /api/carrito/precios`).
- **Pedidos**: al tocar "Enviar pedido por WhatsApp" se guarda el pedido (`POST /api/pedidos`) con los
  precios del servidor. **No se guarda ningún dato del cliente**: solo tienda, productos, piezas, total
  y fecha. Si guardarlo falla, WhatsApp se abre igual.
- **Necutools**: los **dueños** crean tiendas, usuarios y promociones y editan todo; los **encargados**
  solo editan las tiendas que tienen asignadas. Se entra con el usuario o con el correo en el mismo campo.
- **Cuentas de cliente** (`/cuenta.html`, solo para opinar): nombre, usuario único, correo con un dominio
  que reciba correos (revisión DNS MX), teléfono con la lada de su país (privado: no sale en ninguna
  respuesta), contraseña escrita dos veces y la casilla "Tengo 18 años o más, o mi madre, padre o tutor me dio
  permiso" (se guarda la fecha en `clientes.edad_aceptada_en`; las cuentas de antes la marcan en "Completa tu cuenta").
- **Eliminar mi cuenta** (Mi cuenta, plan `2026-11-04-cumplimiento-legal-cuenta-y-edad.md`): ventana de confirmación
  y código por correo (`/api/clientes/eliminar` y `/api/clientes/eliminar/codigo`). Se borran la cuenta, sus códigos,
  sus frenos de login y sus sesiones (la de Necutools del mismo navegador sigue). Sus opiniones se quedan con
  `cliente_id` en NULL y salen como "Cliente de Necutla" en la tienda y en Necutools.
- **Mis pedidos** (Mi cuenta, plan `2026-11-22-app-nativa-mis-pedidos-y-descarga.md`): `GET /api/clientes/pedidos`
  con sesión de cliente devuelve sus pedidos del más nuevo al más viejo, de 50 en 50 (`?antes=<id>` del último visto;
  `hay_mas` dice si quedan), con tienda o paquete, estado (`en_proceso`, `pagado`, `cancelado`), total, fecha y
  líneas (nombre, cantidad, subtotal y color). No lleva la nota del vendedor, la huella ni el stock. `no-store`.
- **Sin groserías en lo público** (`app/groserias.php`, plan `2026-11-04-filtro-groserias.md`): nombre y usuario de
  los clientes, opiniones, respuestas de las tiendas y todo lo que se publica desde Necutools (tiendas, productos,
  servicios, subcategorías, colores, ofertas y promociones) pasan por `v_publico()` y dan 400 si llevan groserías en
  español o en inglés, aunque vengan con acentos, números (`pend3jo`), letras repetidas o separadas. Para agregar o
  quitar una palabra se edita la lista de ese archivo: `GROSERIAS_PALABRAS` (palabra completa, para las que van dentro de
  palabras normales, como "puta" en computadora) o `GROSERIAS_RAICES` (cuentan dentro de otra palabra).
- **Código por correo** (`app/codigos.php`, `app/correo.php`, `public/js/codigo.js`): entrar, crear la cuenta,
  eliminarla y "¿Olvidaste tu contraseña?" piden un código de 6 dígitos que llega desde `yancore@necutla.com`. Vence a los
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
| `.btn` (amarillo) | La acción principal del grupo. Solo uno por grupo | "Guardar producto", "Agregar al carrito" |
| `.btn.secondary` | Acciones de apoyo o para salir de una edición | "Cancelar edición", "Ver tienda" |
| `.btn.ghost` | Acciones discretas de navegación, sin borde visible | "Volver", "Cerrar menú" |
| `.btn.danger` | Solo borrar, quitar o vaciar | "Vaciar carrito", icono de borrar |
| `.btn.wa` | Solo el envío por WhatsApp | "Enviar pedido por WhatsApp" |
| `.btn.secondary` o `.btn.ghost` con `aria-pressed="true"` | Filtro, pestaña o sección seleccionada. Marca un estado, no una acción: nunca amarillo | "Todos", "Productos (12)" |
| `.btn-sm`, `.btn-icon`, `.btn-block` | Tamaño (36px), solo icono (con `aria-label`) y ancho completo | |

Estados: hover y presionado los da `style.css`. `disabled` lo pone gris en cualquier variante
(agotado, sin datos). Mientras espera al servidor se usa `botonOcupado(boton)` / `botonListo(boton)` de
`comun.js`: el texto cambia a la acción en curso ("Guardando producto"), sin spinner.

Los botones de WhatsApp (pedido del carrito y servicios) usan `enviarPorWhatsApp(boton, numeros, mensaje,
contenedor, textoHecho)`, que tiene 3 estados: "Abriendo WhatsApp" al tocarlo, abre el chat y queda en
`.is-hecho` ("Pedido abierto en WhatsApp", con palomita). Otro toque ya no abre un segundo chat; el aviso de
abajo trae "Volver a abrir WhatsApp".

Para no mandar una petición por cada tecla o clic se usa `conEspera(fn, ms)` (debounce) de `comun.js`: los
botones + y − del carrito cambian el número al momento y piden los precios 350 ms después del último toque
(mientras tanto el botón de WhatsApp dice "Actualizando el total"), y el buscador de la portada busca
mientras escribes, 400 ms después de la última tecla.

El buscador de la portada (`portada.js`) siempre dice qué pasa en `#search-estado` ("Escribe al menos 2 letras",
"Buscando…", cuántos resultados, "No encontramos…" o el error con "Reintentar"); mientras llega una búsqueda nueva,
los resultados anteriores se quedan atenuados (`.grid.is-buscando`). Todo `input[type="search"]` lleva una X para
borrar (`conBotonBorrar()` de `comun.js`). Las búsquedas recientes (las últimas 5 con resultados, al buscar con
Enter o el botón, o al salir del campo) se guardan solo en el navegador (`localStorage` `necutla_busquedas`).

Transición entre páginas: `@view-transition` en `style.css` (solo sin movimiento reducido). `comun.js` nombra la
foto y el nombre de la tarjeta tocada (`foto-producto`, `nombre-producto`, `nombre-tienda`) y la página de destino
los lleva fijos (`#producto-img`, `#producto-nombre`, `#store-title`); `app/paginas.php` manda la foto y el nombre
del producto ya pintados para que la foto llegue a la foto real. Dos elementos con el mismo nombre cancelan la
transición: no se pone `view-transition-name` a mano en otras tarjetas.

Secciones con más de 2 partes (Necutools → Mi cuenta, Productos y servicios, Tiendas, y la página Mi cuenta)
se dividen con botones `data-action="subseccion"` (`data-grupo`, `data-sub`) y envoltorios `.subseccion`;
`mostrarSubseccion(grupo, sub)` de `comun.js` cambia la vista y avisa con el evento `subseccion`. Los
formularios largos llevan el guardar pegado abajo (`.form-actions.is-fija`); el de productos usa
`.barra-guardar`, que dice si hay cambios sin guardar.

Texto mínimo: 14 px. Solo hay 6 tamaños de letra, como variables de `:root` en `style.css`:
`--letra-chica` (14), `--letra-base` (16, cuerpo y botones), `--letra-media` (18), `--letra-h3` (22),
`--letra-h2` (28) y `--letra-titulo` (de 36 a 56, el h1). Un `font-size` nuevo usa una de ellas; la jerarquía
se hace con el ancho (`wdth`) y el peso, no con más tamaños. La app de Android usa la misma escala (`Letra` en
`Tema.kt`).

Unidades (para que la página crezca con la letra que elige el usuario en su navegador):

| Qué | Unidad |
|---|---|
| Tamaño de letra | `rem`, por las variables de arriba |
| Cortes de `@media` | `em` (62em = 992px, 53.75em = 860px, 47.5em = 760px, 40em = 640px, 25em = 400px) |
| Anchos y altos de contenido, columnas fijas | `rem`, `%`, `min()` (ej. `min(26.25rem, calc(100% - 32px))`) |
| Relleno de botones | `em` (crece con su letra) |
| Bordes, radios, divisores, altos mínimos de botón, sombras | `px` |
| Columnas de grid | `minmax(0, 1fr)`, nunca `1fr` solo (una palabra larga ensanchaba la columna) |

Se prueba con Chrome → Configuración → Apariencia → Tamaño de fuente en "Muy grande" (o el tamaño
predeterminado a 32 px): a 360 px de ancho no debe haber scroll horizontal.

### Preguntar y avisar (sin `alert`, `confirm` ni `prompt`)

Las ventanas del navegador ("necutla.com dice") no se usan. En su lugar, de `comun.js`:

| Función | Para qué | Devuelve |
|---|---|---|
| `await confirmar({ titulo, mensaje, aceptar, volver, tipo })` | Confirmar una acción. `tipo`: `"peligro"` (borrar, cancelar, vaciar: botón rojo y el foco empieza en Volver), `"importante"` (admiración amarilla) o `"info"` | `true` / `false` |
| `await pedirTexto({ titulo, mensaje, etiqueta, valor, max, aceptar })` | Pedir un texto corto (la nota de un pedido) | el texto, o `null` si eligió Volver |
| `avisarError(mensaje)` | Errores y validaciones: toast con admiración roja, temblor y botón para cerrarlo (6 s) | |
| `showToast(mensaje, icono)` | Avisos de que algo salió bien (3.2 s) | |

`aceptar` es el texto exacto de la acción ("Cancelar pedido", "Eliminar tienda"); `volver` es "Volver" si no se pasa.
Escape y el clic en el fondo cuentan como Volver. La ventana es un `<dialog>` con `showModal()` (estilos en la
sección "VENTANAS DE CONFIRMACIÓN" de `style.css`).

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
| `turnstile` | Captcha de Cloudflare: `site_key` (pública) y `secret`. Vacías = sin captcha. En local, las llaves de prueba de Cloudflare (ver `app/config.ejemplo.php`) |
| `cloudflare_analytics` | Token de Cloudflare Web Analytics (público). Vacío = no se cuentan visitas |
| `google_tag_manager` | Id del contenedor de Google Tag Manager (`GTM-…`, público). Vacío = no se carga. `public/js/etiquetas.js` muestra el aviso de cookies y carga Google solo si la persona acepta, en todas las páginas menos Mi cuenta y Necutools. Con cookies aceptadas, `medirCompra()` de `public/js/comun.js` manda `add_to_cart` y `begin_checkout` (pedido o servicio enviado, uno por tienda) en MXN, sin datos del cliente. La CSP solo permite Analytics: Google Ads, HTML personalizado y variables de JavaScript personalizado requieren cambiarla |
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
`producto_fotos`, `producto_color_fotos`,
`ofertas`, `promociones`, `promocion_items`, `pedidos`, `admins`, `admin_stands` (tiendas de cada
encargado), `clientes`, `resenas`, `bitacora`, `intentos_login`, `migraciones`, `sesiones`, `limites` y
`dns_correo`.

## Buscadores, iconos y rendimiento

Plan `plans/planes/2026-10-31-seo-iconos-contenido-y-legal.md` (recomendaciones del revisor de IONOS).

- **Títulos y descripciones:** `app/paginas.php` pone el `<title>` (hasta 60 caracteres), la descripción (140 a 160),
  la dirección canónica y los datos estructurados (JSON-LD: `WebSite` y `Organization` en la portada, `Product` o
  `Service` con precio y existencias, y migas de pan) de cada página. Carrito, cuenta y Necutools van con `noindex`;
  una tienda o producto que no existe responde 404.
- **Mapa del sitio:** `/sitemap.xml` lo arma `app/sitemap.php` con lo visible (portada, promociones, aviso de
  privacidad, términos, tiendas y productos). `public/robots.txt` lo anuncia y deja fuera la API (salvo `/api/stands/` y `/api/productos/`, que pintan el catálogo), Necutools,
  carrito y cuenta. Después de subir, envíalo en Google Search Console.
- **Logo e iconos:** `imagenes/logo.png`, `favicon-32.png`, `favicon.ico` (16, 32 y 48), `apple-touch-icon.png` (180) y los de la app (192, 512
  y maskable) en `public/site.webmanifest`. Se generan desde `recursos/iconos/logo-original.png` con `python3 recursos/iconos/generar.py` (Pillow).
- **Legal:** `privacidad.html` (aviso de privacidad, LFPDPPP) y `terminos.html`, enlazados en el pie y en el
  registro. Los huecos `[COMPLETAR]` los llena el responsable.
- **Rendimiento:** gzip para todo lo que es texto (`mod_deflate` en `.htaccess`), fuentes con caché de 30 días, y
  el contenido reserva su alto mientras llegan los datos para que la página no salte.
- **Fotos guardadas en el navegador** (plan `2026-11-11-carga-progresiva-y-cache-de-fotos.md`): la dirección de cada
  foto lleva `?v=` con su huella (`imagen_v` / `portada_v`, columnas que calcula la base con `MD5` de la imagen), que
  solo cambia cuando cambia la foto. Con la versión al día, `servir_imagen()` responde `max-age` de un año e
  `immutable`: el navegador no la vuelve a pedir. Con otra versión o sin `?v=`, 5 minutos y luego 304 con
  `If-None-Match` (la imagen no se lee de la base). Las fotos extra del carrusel no se reemplazan nunca: su id es su
  versión. Las fotos públicas no leen ni renuevan la sesión y tienen su propio límite (`fotos`, 2000 cada 15 min por
  IP), aparte de las 300 peticiones de la API. Las ocultas siguen sin caché y solo para quien puede editarlas.
- **Cargar al hacer scroll:** `alAcercarse()` de `comun.js` (con `IntersectionObserver`). En `/t/<slug>` los
  productos y servicios se agregan solos de 12 en 12 al acercarse al final (sin IntersectionObserver vuelven los
  botones "Mostrar más") y la vitrina se pide al llegar abajo. En la portada, las opiniones y la vitrina se piden al
  acercarse (con `#ancla` o `?q=` de una vez); el tablero y las promociones, al abrir. El encabezado de la tienda
  (nombre, descripción, pestañas y subcategorías) llega pintado desde el servidor (`con_encabezado_tienda()`).
- **CDN: no se usa.** La CDN de IONOS solo funciona en subdominios (`www.necutla.com`) y el sitio usa
  `necutla.com` como dirección única (cookie `__Host-`, vista previa, Turnstile). Además, todas las visitas
  llegarían con la IP de Cloudflare y habría que cambiar `ip_cliente()`. Los visitantes son de la misma zona, así
  que gzip y caché dan casi lo mismo. El revisor de IONOS seguirá marcando ese punto.

## Avisos de pedidos (notificaciones)

Plan `2026-11-22-icono-actualizador-y-notificaciones.md`. Al cliente le llega un aviso cuando la tienda cambia el
estado de su pedido, le deja una nota o ajusta las piezas; a los dueños y a los encargados de la tienda, cuando llega
un pedido nuevo ("cancelar viejos" no avisa).

- **Servidor** (`app/notificaciones.php`): tabla `notificaciones_destinos` (un navegador o un celular por fila, de un
  cliente o de un admin; hasta 10 por cuenta). Web Push estándar sin servicios de pago: cifrado RFC 8291 y firma
  VAPID con `openssl`, probado contra el ejemplo del RFC. La app de Android usa Firebase Cloud Messaging (HTTP v1 con
  la cuenta de servicio). Se manda después de responder (`fastcgi_finish_request`), con 5 s por envío; los destinos
  que el servicio da por muertos (404 o 410) se borran. Solo se manda a los servicios de push de los navegadores
  (`PUSH_HOSTS`).
- **Rutas:** `GET /api/notificaciones/llave`, `POST /api/notificaciones/suscribir` y `POST /api/notificaciones/quitar`
  (`para` = `cliente` o `admin`, con su sesión; `tipo` = `web` con `endpoint`, `p256dh` y `auth`, o `fcm` con `token`).
- **Web:** `public/sw.js` (solo `push` y `notificationclick`, sin caché), `activarAvisos()` y `quitarAvisos()` en
  `comun.js`, cajas `[data-avisos]` en Mi cuenta → Mis pedidos y en Necutools → Pedidos, y la tarjeta del carrito
  después de mandar un pedido (`ofrecerAvisos()`). El permiso solo se pide al tocar el botón. Al cerrar sesión se quita
  la suscripción de ese navegador. En iPhone solo funciona con Necutla en la pantalla de inicio. La CSP permite
  `worker-src 'self'`.
- **Llaves:** `php8.5 scripts/crear-vapid.php` crea las de Web Push y las guarda en `app/config.php` (`web_push`). Para
  la app, `fcm` en `app/config.php` (`proyecto` y la ruta del JSON de la cuenta de servicio, `app/fcm-cuenta.json`,
  permisos 600, fuera de git).
- Al tocar un aviso: el cliente va a `/cuenta.html?sub=pedidos`; el vendedor, a `/necutools.html?seccion=pedidos`.

## App de Android

La app nativa (Kotlin + Jetpack Compose) vive en `~/AndroidStudioProjects/NecutlaMovil` y usa la misma API de
`https://necutla.com/api/...` que el sitio (no tiene base propia). La variante `debug` apunta a `http://10.0.2.2:8081`
(el XAMPP de esta compu visto desde el emulador). Turnstile corre en una hoja con WebView sobre
`/app/captcha.html` (`public/js/app-captcha.js`), que entrega el token a la app.

Cómo se publica una versión nueva:

1. Sube `versionName` (corrección = parche, función nueva = menor) y `versionCode` (+1) en `app/build.gradle.kts`.
2. Compila como el usuario dueño del proyecto, con el Java de Android Studio:
   `JAVA_HOME=/opt/android-studio/jbr ./gradlew assembleRelease`.
3. Revisa la firma: `apksigner verify --print-certs app/build/outputs/apk/release/app-release.apk`
   (la huella SHA-256 debe ser la de `public/.well-known/assetlinks.json`).
4. Copia el APK a `~/Escritorio/Versiones Necutla Movil/Android/Necutla-X.Y.Z.apk` (sin borrar las anteriores)
   y a `public/app/necutla-android.apk` (nombre fijo: el botón siempre baja ese).
5. Actualiza `public/app/version.json` (`version`, `versionCode`, `tamano` en bytes, `sha256`, `fecha`,
   `minimo_android`). La app lo lee al abrir y, si `versionCode` es mayor que el suyo, ofrece descargar la nueva.
6. Sube `public/app/` a IONOS. `.htaccess` sirve el APK como `application/vnd.android.package-archive`, con
   `attachment`, `no-cache` y `noindex`.

La llave de firma (`~/.necutla-firma/necutla-release.jks`) y `keystore.properties` no van a git: sin ellas no se
puede actualizar la app instalada.

Diseño y movimiento en la app (plan `2026-11-22-buscador-letra-unidades-pie-y-transiciones.md`):

- Misma escala de letra que el sitio (`Letra` en `ui/tema/Tema.kt`), botones de 48 dp (44 el chico) y la barra de
  abajo en 14 sp: si "Promociones" no cabe (pantalla angosta o letra grande), solo la pestaña elegida muestra texto.
- Pie (`Pie()` en `ui/pantallas/Comunes.kt`): banda `N.Tinta` de orilla a orilla, como `.site-footer`.
- Transiciones (`ui/Transiciones.kt`): la foto y el nombre de una tarjeta viajan a la pantalla del producto o de la
  tienda con `Modifier.compartido(clave)` (shared element; claves `foto-producto-<id>`, `nombre-producto-<id>`,
  `foto-tienda-<slug>`, `nombre-tienda-<slug>`); `Previa` guarda la tarjeta tocada para pintarla mientras carga el
  detalle. Fade entre pestañas y slide al entrar a Buscar, Necutools y sus secciones de "Más". Con "Quitar
  animaciones" del sistema no se mueve nada (`LocalSinMovimiento`).
- Búsquedas recientes (`Recientes` en `data/Estado.kt`): las últimas 5, solo en el teléfono.
- Actualizador (`data/Actualizador.kt`): "Actualizar ahora" baja el APK a la carpeta privada de la app (nunca a
  Descargas), revisa tamaño y SHA-256 contra `version.json`, lo instala con `PackageInstaller` y lo borra al terminar
  (`AppActualizada` con `MY_PACKAGE_REPLACED` y al abrir la app). La primera vez que se abre la app sale una hoja para
  borrar el `Necutla.apk` que bajó el navegador (Android no deja que la app lo borre).

## Seguridad

Auditoría completa en `plans/auditorias/2026-10-20-seguridad.md` (se hizo sobre la versión en Node; la
versión en PHP pasa las mismas pruebas) y la revisión de versiones y parches del 2026-10-31 en
`plans/auditorias/2026-10-31-seguridad-actualizaciones.md`.

| Capa | Protección |
|---|---|
| Archivos | Solo se publica `public/`; `app/` (con `config.php`), `plans/`, `db/` y `.git` quedan fuera. Dentro de `public/`, los archivos que empiezan con punto y cualquier `.php` que no sea `api/index.php` dan 404 |
| Cabeceras | En `public/.htaccess`: CSP estricta (sin scripts ni estilos en línea), HSTS con HTTPS, `nosniff`, `Permissions-Policy` sin cámara, micrófono ni ubicación; Necutools y `/api` con `noindex`; respuestas privadas con `no-store`; sin `X-Powered-By` |
| Peticiones | Solo las rutas de Necutools que suben imágenes aceptan 2 MB; el resto, 20 KB. Lo que modifica datos debe venir de este sitio (`Origin` obligatorio y `Sec-Fetch-Site`). TRACE no se acepta. La redirección a HTTPS solo cree lo que dice Apache, no la cabecera `X-Forwarded-Proto` |
| Sesión | En la tabla `sesiones` (solo el SHA-256 de la cookie); cookie `__Host-necutla.sid` (`HttpOnly`, `Secure`, `SameSite=Strict`); id nuevo al entrar y al salir; Necutools: 8 h sin uso o 24 h en total; clientes: 400 días renovados en cada visita, hasta cerrar sesión |
| Cuentas | Correo y usuario se guardan en minúsculas y se comparan exactos (`josé` y `jose` son cuentas distintas); Argon2id (64 MiB, 4 pasadas; OWASP lo recomienda y pide al menos 19 MiB y 2; las de bcrypt de antes siguen sirviendo y se cambian solas al entrar); 10 fallos seguidos frenan la cuenta 15 minutos, venga de la IP que venga; además, 10 por IP |
| Dos pasos | Opcional en Necutools ("Mi cuenta"); 8 códigos de respaldo de un solo uso; la clave se guarda cifrada (sodium) con una llave que sale del `secreto` (si cambias el `secreto`, hay que volver a activarla) |
| Captcha | Cloudflare Turnstile en registro, entrar, olvidé mi contraseña, reenviar código, opiniones y pedidos (`app/captcha.php`, `public/js/captcha.js`). Casi nunca pide nada: solo aparece si Cloudflare duda. Si Cloudflare no responde, se deja pasar y se anota en el log |
| Terceros | Cloudflare (captcha y Web Analytics, sin cookies) y Google Tag Manager (solo si la persona acepta las cookies; lo que se publique en el contenedor puede usar cookies: si se agrega una etiqueta nueva, revisar la CSP y `public/privacidad.html`). La fuente Archivo está en `public/fuentes/` (antes venía de Google Fonts) |
| Permisos | Revisados en el servidor en cada petición: un encargado no toca tiendas ajenas ni paquetes |
| Datos | Consultas con parámetros; validación de cada campo; los precios los pone el servidor; todo texto se escapa al mostrarlo |
| Imágenes | Tipo real por sus bytes, máximo 1 MB, sin SVG; sin metadatos (GPS, modelo del celular); las de algo oculto solo las ve quien puede editarlo |
| Pedidos | Con cuenta completa (`requiere_comprador()`; sin cuentas en pausa, como antes), precios del servidor, hasta 30 piezas y 15 productos, sin duplicados en 10 minutos, 40 por hora por IP, 20 por hora por cuenta y 500 por hora en total. Sin cuenta, la API no entrega números de WhatsApp (`puede_pedir()`) |
| Límites | 300 peticiones a la API cada 15 minutos por IP (tabla `limites`, con la IP cifrada con HMAC) |
| PHP | 8.5 con parches al día; en producción, 8.5.12 o más nuevo (si no, la API da 503). `public/.user.ini` apaga el progreso de subidas y los errores en pantalla. Necutools → Mi cuenta → Servidor (solo dueños) muestra las versiones que atienden la página. En local: pool propio con `open_basedir` y sin funciones para correr comandos |
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
4. Necutools → Mi cuenta → activar la verificación en dos pasos en cada dueño, y revisar la tarjeta "Servidor".
   Si la verificación ya estaba activa de antes, correr una vez `php8.5 scripts/cifrar-totp.php` por SSH
   (después del `ALTER` de `db/mariadb/schema.sql`) para cifrar las claves guardadas.
5. Respaldar la base (phpMyAdmin → Exportar) de vez en cuando.
6. Si la contraseña de la base se filtró: cámbiala en IONOS → Bases de datos y en `app/config.php`.
