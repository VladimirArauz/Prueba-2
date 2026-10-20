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
  js/                  comun.js (API, carrito, WhatsApp) + un archivo por página; graficas.js (Chart.js)
  style.css, iconos.js Sistema de diseño e iconos (Lucide)
server/
  index.js             Seguridad, páginas, redirecciones de direcciones viejas y arranque
  api.js               API pública (tiendas, ofertas, promociones, búsqueda, precios del carrito)
  admin.js             API de Necutools (/api/admin), con permisos por rol
  pedidos.js           Pedidos enviados por WhatsApp y resumen del dashboard de Necutools
  auth.js              Login, sesiones, dueños y encargados
  ofertas.js           Cálculo de las ofertas del día (único lugar que pone precios con descuento)
  validar.js           Validación compartida
  ejemplos.js          Carga los productos de ejemplo de db/ejemplos.json (una sola vez)
db/schema.sql          Tablas de la base de datos (se aplican solas al arrancar)
db/ejemplos.json       Productos de ejemplo que antes eran páginas fijas
scripts/               importar-ejemplos.js (npm run importar)
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
  Cada quien puede cambiar su contraseña en "Mi cuenta".
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
| `DATABASE_SSL` | `true` solo al conectarte a una base remota por su URL externa |
| `SESSION_SECRET` | Firma de las cookies de sesión (32+ caracteres aleatorios) |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Primer administrador (solo se usa si no hay ninguno; contraseña de 12+ caracteres) |
| `WHATSAPP_NUMBERS` | Números de respaldo para las tiendas sin números propios, separados por coma (`5255XXXXXXXX`) |
| `NODE_ENV` | `production` en Render (activa cookies seguras) |
| `HOY_PRUEBA` | Solo en tu computadora: fija la fecha de "hoy" (`AAAA-MM-DD`) para probar ofertas y promociones. En producción se ignora |

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

## Seguridad incluida

- Solo se publica la carpeta `public/`.
- Contraseñas con bcrypt; sesiones en PostgreSQL con cookie `httpOnly`, `secure` y `sameSite=strict`.
- Permisos revisados en el servidor en cada petición: un encargado no puede tocar tiendas ajenas,
  y desactivar a un usuario o cambiarle la contraseña cierra sus sesiones.
- Los precios del carrito los calcula el servidor; lo que mande el navegador se ignora.
- Límite de 10 intentos de login fallidos cada 15 minutos.
- Revisión de origen en peticiones que modifican datos (CSRF).
- Cabeceras con Helmet: CSP estricta (sin scripts en línea), HSTS, `nosniff`, sin iframes ajenos.
- Validación de datos y de imágenes (tipo real por bytes, máximo 1 MB) y consultas parametrizadas.
