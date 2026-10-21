# Necutla — La Ciudad del Estudiante

Catálogo de varias tiendas estudiantiles. Cada tienda tiene su catálogo (con subcategorías), sus
servicios, sus ofertas de cada día y sus propios vendedores: el carrito se agrupa por tienda y cada
pedido llega por WhatsApp solo a los vendedores de esa tienda. Además hay promociones generales de
temporada en forma de paquete, que pueden juntar productos de varias tiendas.

Todo se administra desde **Necutools** (`/necutools.html`) y se guarda en PostgreSQL.

## Estructura

```
public/                Sitio (lo único que ve el navegador)
  index.html           Portada: tablero de tiendas, promociones, ofertas de hoy y buscador
  tienda.html          Una sola página para todas las tiendas (/t/<tienda>)
  carrito.html         Carrito agrupado por tienda
  promociones.html     Promociones de temporada
  necutools.html       Panel de administración
  js/                  comun.js (API, carrito, WhatsApp) + un archivo por página; graficas.js (Chart.js);
                       validacion.js (validación en vivo y medidor de contraseña)
  datos/paises.json    Países con su lada y el largo de sus teléfonos (lo usa también el servidor)
  style.css, iconos.js Sistema de diseño e iconos (Lucide)
server/
  index.js             Seguridad, páginas, redirecciones de direcciones viejas y arranque
  api.js               API pública (tiendas, ofertas, promociones, búsqueda, precios del carrito)
  admin.js             API de Necutools (/api/admin), con permisos por rol
  pedidos.js           Pedidos enviados por WhatsApp y resumen del dashboard de Necutools
  auth.js              Login, sesiones, dueños y encargados
  ofertas.js           Cálculo de las ofertas del día (único lugar que pone precios con descuento)
  validar.js           Validación compartida (incluye correo con DNS MX, teléfono por país y usuario)
  contrasenas.js       Reglas de contraseñas nuevas (largo, tipos de carácter, comunes, sin usuario, confirmación)
  intentos.js          Límite de intentos fallidos por cuenta
  totp.js              Verificación en dos pasos (códigos de Google Authenticator y similares)
  imagenes.js          Quita los metadatos (GPS, modelo del celular) de las imágenes subidas
  bitacora.js          Registro de lo que se hace en Necutools
  ejemplos.js          Carga los productos de ejemplo de db/ejemplos.json (una sola vez)
db/schema.sql          Tablas de la base de datos (se aplican solas al arrancar)
db/ejemplos.json       Productos de ejemplo que antes eran páginas fijas
scripts/               importar-ejemplos.js (npm run importar) y seguridad/ataques.js (pruebas de ataque en local)
recursos/              Fotos reales sin usar todavía (no se publican)
plans/                 Reglas del proyecto, planes y prompts (no se publica)
render.yaml            Configuración de Render (servicio web + base de datos)
.env.example           Plantilla de variables de entorno
```

## Correrlo en tu computadora

Requisitos: Node.js 22 o más nuevo y PostgreSQL.

```bash
# 1. Crear la base local (una sola vez)
sudo -u postgres psql -c "CREATE ROLE necutla LOGIN PASSWORD 'una-contraseña';"
sudo -u postgres psql -c "CREATE DATABASE necutla OWNER necutla;"

# 2. Variables de entorno
cp .env.example .env      # y edita DATABASE_URL, SESSION_SECRET, ADMIN_* y WHATSAPP_NUMBERS

# 3. Instalar y arrancar
npm install
npm run dev               # http://localhost:3000
```

Al arrancar, el servidor crea o actualiza las tablas, carga una sola vez los productos de ejemplo
y, si no existe ningún administrador, crea uno (como **dueño**) con `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

Para volver a cargar los productos de ejemplo que hayas borrado: `npm run importar` (no duplica los que existen).

## Cómo funciona

- **Tiendas**: cada una tiene dirección propia (`/t/ropa`), descripción, icono, orden en el directorio,
  números de WhatsApp de sus vendedores y subcategorías. Si una tienda no tiene números, usa los de
  `WHATSAPP_NUMBERS`. Las direcciones viejas (`/ropa/playeras/`) redirigen a la nueva.
- **Productos y servicios**: los productos se agregan al carrito; los servicios (precio fijo, "desde"
  o "a cotizar") se piden por WhatsApp directo a la tienda.
- **Ofertas de la tienda**: se repiten por día de la semana (porcentaje, precio especial o 2x1) sobre un
  producto, una subcategoría o toda la tienda. El servidor las calcula con la hora de Ciudad de México.
- **Promociones generales**: paquetes con precio propio y fechas de inicio y fin. Al pedir uno se avisa
  a los vendedores de todas las tiendas incluidas.
- **Carrito**: guarda solo `{tipo, id, cantidad}` en el navegador. Nombres, precios y descuentos los
  calcula siempre el servidor (`POST /api/carrito/precios`).
- **Pedidos**: al tocar "Enviar pedido por WhatsApp", el carrito guarda ese pedido en la tabla `pedidos`
  (`POST /api/pedidos`) con los precios que calcula el servidor. **No se guarda ningún dato del cliente**
  (ni nombre ni indicaciones): solo tienda, productos, piezas, total y fecha. Si guardarlo falla, WhatsApp
  se abre igual. Límite de 40 pedidos por hora por IP.
- **Necutools**: los **dueños** crean tiendas, usuarios y promociones y editan todo; los **encargados**
  solo editan las tiendas que tienen asignadas (productos, servicios, subcategorías y ofertas).
  Cada quien puede cambiar su contraseña y poner un correo opcional en "Mi cuenta". Se entra con el
  usuario o con el correo en el mismo campo.
- **Cuentas de cliente** (`/cuenta.html`, solo para opinar): nombre visible, nombre de usuario único,
  correo, teléfono con la lada de su país y contraseña escrita dos veces. Se entra con el usuario o el
  correo. El correo debe tener un dominio que reciba correos (el servidor revisa su registro MX en DNS
  y avisa de errores de dedo como `gmial.com`). El teléfono se valida con el largo de su país
  (`public/datos/paises.json`, formato E.164: México 10 dígitos, España 9…) y se guarda como
  `+525512345678`. **El teléfono es privado**: no sale en opiniones, tiendas ni pedidos. Las cuentas de
  antes de este cambio siguen entrando y completan usuario y teléfono una vez.
- **Contraseñas nuevas** (registro, cambio y reinicio): minúscula, mayúscula, número y carácter
  especial obligatorios; 10 caracteres o más para clientes y 12 para Necutools; siempre se escriben dos
  veces. Debajo del campo, un medidor dice si es débil, media, fuerte o súper segura, y cada campo
  avisa en vivo qué le falta (`public/js/validacion.js`; el servidor vuelve a revisar todo).
- **Dashboard de Necutools**: abre en "Resumen" con pedidos, ventas confirmadas, ticket promedio y
  calificación del periodo (7, 30 o 90 días, por tienda), comparados con el periodo anterior; gráficas
  de pedidos y ventas por día, estado de los pedidos y pedidos por tienda; productos más pedidos,
  pedidos recientes y una lista de pendientes. En "Pedidos" el vendedor marca cada pedido como
  vendido o cancelado y le agrega notas. "Ventas" cuenta solo los pedidos marcados como vendidos.
  Las gráficas usan **Chart.js** (dependencia `chart.js`), que el servidor publica en
  `/vendor/chart.umd.js` desde `node_modules` (sin CDN, la CSP no cambia).

## Variables de entorno

| Variable | Para qué sirve |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL |
| `DATABASE_SSL` | `true` al conectarte a una base remota por su URL externa (cifra y verifica el certificado). `no-verify` cifra sin verificar: solo si Node no reconoce el certificado del proveedor |
| `SESSION_SECRET` | Firma de las cookies de sesión (32+ caracteres aleatorios) |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Primer administrador (solo se usa si no hay ninguno; contraseña de 12+ caracteres) |
| `WHATSAPP_NUMBERS` | Números de respaldo para las tiendas sin números propios, separados por coma (`5255XXXXXXXX`) |
| `NODE_ENV` | `production` en Render (activa cookies seguras) |
| `HOY_PRUEBA` | Solo en tu computadora: fija la fecha de "hoy" (`AAAA-MM-DD`) para probar ofertas y promociones. En producción se ignora |
| `CORREO_DNS_PRUEBA` | Solo en tu computadora: con `1`, no consulta el DNS al revisar correos (todo dominio vale salvo `*.invalid` y `sin-correo.*`). En producción se ignora |

El archivo `.env` **nunca** se sube a git (está en `.gitignore`).

## Publicar en Render

1. Sube el proyecto a GitHub (`git push`).
2. En https://dashboard.render.com: **New → Blueprint** → conecta el repositorio.
3. Render lee `render.yaml` y te pide `ADMIN_USERNAME`, `ADMIN_PASSWORD` y `WHATSAPP_NUMBERS`.
4. **Apply**. Crea la base `necutla-db` y el servicio `necutla`, y despliega.
5. Abre `https://necutla.onrender.com` (o el nombre que te asigne Render) → Necutools → inicia sesión.

Cada `git push` a la rama principal vuelve a desplegar el sitio.

## Administrar la base con pgAdmin

1. Render → `necutla-db` → **Info / Connect** → copia los datos de **External Database URL**
   (host `dpg-xxxxxxxx-a.oregon-postgres.render.com`, base, usuario y contraseña).
2. pgAdmin → **Register → Server**:
   - *General → Name*: `Necutla (Render)`
   - *Connection*: Host = host externo, Port = `5432`, Maintenance database = `necutla`,
     Username y Password de Render.
   - *Parameters*: **SSL mode = require**.
3. Tablas: `stands` (tiendas), `subcategorias`, `productos` (productos y servicios), `ofertas`,
   `promociones`, `promocion_items`, `admins`, `admin_stands` (tiendas de cada encargado),
   `migraciones` y `session`.

Para cambiar la estructura de la base, agrega sentencias idempotentes a `db/schema.sql`
(`ALTER TABLE … ADD COLUMN IF NOT EXISTS …`); se aplican en el siguiente despliegue.

## Seguridad

Auditoría completa y su estado en `plans/auditorias/2026-10-20-seguridad.md`.

**Qué protege cada capa**

| Capa | Protección |
|---|---|
| Archivos | Solo se publica `public/`; `.env`, `server/`, `plans/` y `.git` dan 404 |
| Cabeceras | CSP estricta (sin scripts ni estilos en línea, sin iframes ajenos), HSTS, `nosniff`, `Permissions-Policy` sin cámara, micrófono ni ubicación; Necutools y `/api` con `noindex`; respuestas privadas con `no-store` |
| Peticiones | Solo las rutas de Necutools que suben imágenes aceptan 2 MB; el resto, 20 KB. Lo que modifica datos debe venir de este sitio (`Origin` y `Sec-Fetch-Site`) |
| Sesión | En PostgreSQL; cookie `__Host-necutla.sid` (`httpOnly`, `secure`, `sameSite=strict`); id nuevo al entrar y al salir; 8 h sin uso o 24 h en total. En Render, el servidor no arranca sin `NODE_ENV=production` |
| Cuentas | bcrypt; contraseñas nuevas de 12 (Necutools) o 10 (clientes) caracteres o más, con minúscula, mayúscula, número y carácter especial, hasta 72 bytes, sin las más comunes ni el usuario o correo, confirmadas dos veces. El freno por cuenta cuenta igual si se intenta con el usuario o con el correo. 10 fallos seguidos frenan la cuenta 15 minutos, venga de la IP que venga (también al adivinar la contraseña actual en "Mi cuenta"); además, 10 por IP |
| Dos pasos | Opcional en Necutools ("Mi cuenta"): código de la app de autenticación, cada código sirve una vez, 8 códigos de respaldo de un solo uso. Un dueño puede quitársela a quien perdió su celular |
| Permisos | Revisados en el servidor en cada petición: un encargado no toca tiendas ajenas ni paquetes. Desactivar a alguien, cambiar su contraseña o activar dos pasos cierra sus otras sesiones |
| Datos | Consultas con parámetros; validación de cada campo; los precios los pone el servidor; todo texto se escapa al mostrarlo |
| Imágenes | Tipo real por sus bytes, máximo 1 MB, sin SVG; se les quitan los metadatos (GPS, modelo del celular); las de algo oculto solo las ve quien puede editarlo |
| Pedidos | Precios del servidor, hasta 30 piezas y 15 productos, el mismo pedido no se duplica en 10 minutos, 40 por hora por IP y 500 por hora en total |
| Registro | Bitácora de Necutools (solo dueños): quién entró y qué cambió |
| Reportes | `/.well-known/security.txt` dice cómo reportar una falla en privado |

**Pruebas de ataque** (solo en tu computadora, nunca contra Render):

```
node scripts/seguridad/ataques.js http://localhost:3000
```

Usa un dueño de la base local (`NECUTLA_DUENO_USUARIO` y `NECUTLA_DUENO_PASSWORD`). Prueba inyección
SQL, accesos entre encargados, CSRF, sesión, fuerza bruta, cuerpos enormes, imágenes falsas, pedidos
falsos y la verificación en dos pasos. Debe terminar con todas las pruebas bien.

**Checklist en Render** (lo que solo puedes hacer tú en el panel):

1. `necutla` → Environment → borrar `ADMIN_PASSWORD` (el primer admin ya existe) → Save changes.
2. `necutla-db` → Networking → Access Control: cambiar `0.0.0.0/0` por tu IP con `/32`, o dejarlo
   vacío si no usas pgAdmin desde fuera.
3. Necutools → Mi cuenta → activar la verificación en dos pasos en cada dueño.
4. Si `SESSION_SECRET` o la contraseña de la base se filtraron: generar otro valor en Environment
   (cierra todas las sesiones) y rotar la contraseña de la base desde su página en Render.
5. Respaldar la base (pgAdmin → Backup) antes de que caduque el plan gratis.
6. Después de desplegar, revisar en Logs las 3 líneas "Revisión de proxy": deben decir 1 dirección.
   Si dicen 2, Render tiene otro proxy delante y hay que poner `trust proxy` en 2 en `server/index.js`
   (si no, el límite por IP vería la IP del proxy y frenaría a todos juntos).
