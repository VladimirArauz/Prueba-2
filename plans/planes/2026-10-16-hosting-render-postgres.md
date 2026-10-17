# Plan: preparar Necutla para Render con PostgreSQL

- **Fecha:** 2026-10-16
- **Estado:** aplicado (2026-10-16). Detalle y pendientes en `plans/MEMORIA.md`.
- **Prompts asociados:** `plans/prompts/2026-10-16-hosting-render-postgres.md`
- **Alcance:** estructura de carpetas, servidor Node/Express, base de datos PostgreSQL, Necutools con cuentas reales en servidor, seguridad, configuración de Render (`render.yaml`, `.env`), guía de despliegue y de pgAdmin. El diseño visual no cambia.

---

## 1. Situación actual y problemas

| # | Problema | Riesgo |
|---|---|---|
| 1 | El sitio es estático y se sirve desde la raíz del repo | Al publicarlo se exponen `plans/`, `README.txt`, `js_carrito.js` y cualquier archivo nuevo (incluido un `.env`) |
| 2 | Necutools crea la cuenta de admin desde el navegador si no existe | En un sitio público, **cualquier visitante** puede crear la cuenta y entrar |
| 3 | Productos, stands y cuenta viven en `localStorage` | Cada visitante ve un catálogo distinto; lo que publica el admin no lo ve nadie más |
| 4 | Contraseña con SHA-256 sin sal, en el navegador | Fácil de romper; además `crypto.subtle` falla fuera de HTTPS/localhost |
| 5 | `onclick="…"` en HTML y en plantillas JS | Impide una CSP estricta; `editAdminProduct('${id}')` permite inyección si el id trae comillas |
| 6 | El carrito de un visitante nuevo trae 2 productos de ejemplo | Pedidos falsos por WhatsApp |
| 7 | Números de WhatsApp escritos en 8 archivos | Cambiarlos exige editar código y redeploy |
| 8 | Sin cabeceras de seguridad (CSP, HSTS, X-Frame-Options…) | Clickjacking, inyección de recursos externos |

## 2. Arquitectura nueva

```
Prueba-2/
├── public/                 ← lo ÚNICO que se sirve al navegador
│   ├── index.html, style.css, app.js, iconos.js, imagenes/
│   └── ropa/, tecnologia/, dulces/, propaganda/, papeleria/, regalos/, otra/
├── server/
│   ├── index.js            ← Express: seguridad, estáticos, rutas, arranque
│   ├── db.js               ← conexión a PostgreSQL + migración al arrancar
│   ├── auth.js             ← sesiones, login, middleware requireAdmin
│   └── api.js              ← /api/config, /api/stands, /api/productos
├── db/
│   └── schema.sql          ← tablas (idempotente) + stands iniciales
├── plans/                  ← no se publica
├── .env.example            ← plantilla de variables (sí se sube)
├── .env                    ← variables reales locales (NO se sube)
├── .gitignore
├── .node-version
├── package.json / package-lock.json
├── render.yaml             ← Blueprint: web service + base de datos
└── README.md
```

- **Node 22 + Express 4.** El servidor sirve `public/` y la API en el mismo dominio (sin CORS).
- **PostgreSQL** (Render Postgres). Tablas: `stands`, `productos` (imagen en `bytea`, máx. 1 MB), `admins`, `session`.
- **Migración automática al arrancar** (`CREATE TABLE IF NOT EXISTS`): el plan gratis de Render no tiene shell ni pre-deploy.
- **Admin inicial por variables de entorno** `ADMIN_USERNAME` / `ADMIN_PASSWORD`: se crea solo si no hay ningún admin. Se elimina el formulario público de "Crear cuenta".
- **El carrito sigue en `localStorage`** (es del visitante, no del negocio).
- Las páginas estáticas de tiendas (`ropa/playeras`, etc.) siguen siendo HTML; los productos de Necutools vienen de la base de datos.

## 3. Seguridad

- `helmet` con CSP estricta: `script-src 'self'`, estilos de `self` + Google Fonts, `img-src 'self' data:`, `frame-ancestors 'none'`, `object-src 'none'`, HSTS.
- Sin `onclick` en línea: delegación de eventos con `data-action`.
- Contraseñas con **bcrypt** (costo 12) en el servidor.
- Sesiones `express-session` guardadas en PostgreSQL (`connect-pg-simple`); cookie `httpOnly`, `secure` en producción, `sameSite: strict`, `session.regenerate()` al iniciar sesión. Expira a las 8 h.
- Revisión de `Origin` en peticiones que modifican datos (CSRF) + cookie `sameSite`.
- `express-rate-limit`: login 10 intentos / 15 min; API 300 / 15 min.
- Validación de entrada (largos, precio, disponibilidad, tipo y tamaño real de imagen por bytes mágicos).
- Consultas parametrizadas (`$1`), nunca concatenadas.
- Errores sin stack al cliente; `trust proxy` para Render.
- `.env` en `.gitignore`; `SESSION_SECRET` generado por Render.
- `GET /healthz` para el health check de Render.

## 4. Fases

1. Plan y prompts (este archivo).
2. Mover el sitio a `public/` con `git mv`.
3. Servidor: `package.json`, `server/*`, `db/schema.sql`.
4. Frontend: `app.js` y `*/js/carrito.js` usan la API, delegación de eventos, sin productos falsos en el carrito, números de WhatsApp desde `/api/config`, login sin auto-registro.
5. Configuración: `.env.example`, `.env` local, `.gitignore`, `.node-version`, `render.yaml`, `README.md`.
6. Pruebas locales con PostgreSQL real: API, login, CSP, cabeceras, que no se sirvan archivos fuera de `public/`.
7. Guía de Render y pgAdmin; actualizar `plans/MEMORIA.md`.

## 5. Criterios de aceptación

- `GET /plans/CLAUDE.md`, `/.env`, `/package.json`, `/server/index.js` → 404.
- Sin sesión: `POST /api/productos` → 401. Con `Origin` ajeno → 403.
- Login con usuario/contraseña de `.env`; 11.º intento fallido seguido → 429.
- Producto creado desde Necutools aparece para cualquier visitante.
- Cabeceras CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors` presentes.
- Cero `onclick=` en `public/`.
- `npm ci && npm start` funciona con solo `DATABASE_URL` y `SESSION_SECRET`.
