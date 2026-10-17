# Necutla — La Ciudad del Estudiante

Directorio de stands estudiantiles: el visitante arma un carrito y envía el pedido por WhatsApp.
Los administradores publican productos y stands desde **Necutools**, que guarda todo en PostgreSQL.

## Estructura

```
public/        Sitio (lo único que ve el navegador): index.html, style.css, app.js, iconos.js, tiendas
server/        Servidor Express: seguridad, sesiones y API
db/schema.sql  Tablas de la base de datos (se aplican solas al arrancar)
plans/         Reglas del proyecto, planes y prompts (no se publica)
render.yaml    Configuración de Render (servicio web + base de datos)
.env.example   Plantilla de variables de entorno
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

Al arrancar, el servidor crea las tablas y, si no existe ningún administrador, crea uno con
`ADMIN_USERNAME` / `ADMIN_PASSWORD`.

## Variables de entorno

| Variable | Para qué sirve |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL |
| `DATABASE_SSL` | `true` solo al conectarte a una base remota por su URL externa |
| `SESSION_SECRET` | Firma de las cookies de sesión (32+ caracteres aleatorios) |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Primer administrador (solo se usa si no hay ninguno; contraseña de 12+ caracteres) |
| `WHATSAPP_NUMBERS` | Números que reciben los pedidos, separados por coma (`5255XXXXXXXX`) |
| `NODE_ENV` | `production` en Render (activa cookies seguras) |

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
3. Tablas: `stands`, `productos`, `admins`, `session`.

Para cambiar la estructura de la base, agrega sentencias idempotentes a `db/schema.sql`
(`ALTER TABLE … ADD COLUMN IF NOT EXISTS …`); se aplican en el siguiente despliegue.

## Seguridad incluida

- Solo se publica la carpeta `public/`.
- Contraseñas con bcrypt; sesiones en PostgreSQL con cookie `httpOnly`, `secure` y `sameSite=strict`.
- Límite de 10 intentos de login fallidos cada 15 minutos.
- Revisión de origen en peticiones que modifican datos (CSRF).
- Cabeceras con Helmet: CSP estricta (sin scripts en línea), HSTS, `nosniff`, sin iframes ajenos.
- Validación de datos y de imágenes (tipo real por bytes, máximo 1 MB) y consultas parametrizadas.
