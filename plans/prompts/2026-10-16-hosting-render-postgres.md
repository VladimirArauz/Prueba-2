# Prompts: preparar Necutla para Render con PostgreSQL

- **Plan:** `plans/planes/2026-10-16-hosting-render-postgres.md`
- **Cómo usarlos:** en orden. Cada uno asume una sesión abierta en `Prueba-2`.

---

## Prompt 1: estructura de carpetas

```
Lee plans/CLAUDE.md, plans/MEMORIA.md y plans/planes/2026-10-16-hosting-render-postgres.md.
Mueve con git mv todo el sitio (index.html, style.css, app.js, iconos.js, imagenes/ y las 7 carpetas
de tiendas) a public/. No muevas plans/, README, js_carrito.js ni CLAUDE.md. Verifica que las rutas
relativas entre páginas sigan funcionando.
```

## Prompt 2: servidor y base de datos

```
Lee plans/CLAUDE.md y el plan 2026-10-16-hosting-render-postgres.md. Crea:
- package.json (Node 22, "type": "commonjs") con express, pg, helmet, express-session,
  connect-pg-simple, express-rate-limit y bcryptjs. Scripts: start = node server/index.js,
  dev = node --env-file=.env server/index.js.
- db/schema.sql idempotente con tablas stands, productos (imagen bytea + imagen_tipo), admins y los
  7 stands iniciales con ON CONFLICT DO NOTHING.
- server/db.js (Pool con DATABASE_URL, SSL opcional con DATABASE_SSL=true, función migrate()).
- server/auth.js (sesión en Postgres, cookie httpOnly/secure/sameSite strict, login con bcrypt y
  regenerate, logout, GET sesión, requireAdmin, admin inicial desde ADMIN_USERNAME/ADMIN_PASSWORD).
- server/api.js (GET /api/config con WHATSAPP_NUMBERS; GET/POST /api/stands; GET/POST/PUT/DELETE
  /api/productos; GET /api/productos/:id/imagen). Validación de todo y consultas parametrizadas.
- server/index.js (helmet con la CSP del plan, trust proxy, revisión de Origin en métodos que
  modifican, rate limits, express.static('public'), /healthz, 404 y manejador de errores sin stack).
```

## Prompt 3: frontend contra la API

```
Lee plans/CLAUDE.md. Cambia public/app.js para que productos, stands y login usen la API en lugar de
localStorage (el carrito se queda en localStorage pero empieza vacío). Quita el formulario de crear
cuenta. Reemplaza todos los onclick del HTML y de las plantillas por atributos data-action con un
solo listener delegado. Los números de WhatsApp vienen de /api/config. Haz lo mismo en
public/*/js/carrito.js y en los carrito.html de las tiendas. No cambies el diseño.
```

## Prompt 4: configuración de Render y seguridad

```
Lee plans/CLAUDE.md. Crea .env.example documentado, un .env local (no se sube), .gitignore
(node_modules, .env, *.log), .node-version (22), render.yaml con web service gratis + base de datos
gratis en la misma región, DATABASE_URL desde la base, SESSION_SECRET con generateValue y
ADMIN_USERNAME, ADMIN_PASSWORD y WHATSAPP_NUMBERS con sync: false. Escribe README.md con cómo correrlo
localmente y desplegarlo.
```

## Prompt 5: pruebas

```
Lee plans/CLAUDE.md. Levanta un PostgreSQL local de prueba y el servidor con npm run dev. Verifica los
criterios de aceptación del plan 2026-10-16-hosting-render-postgres.md (archivos fuera de public dan
404, 401 sin sesión, 403 con Origin ajeno, 429 por fuerza bruta, cabeceras de seguridad, CRUD de
productos con imagen, stands, cero onclick en public/). Toma capturas para confirmar que no se rompió
el diseño ni la CSP. Actualiza plans/MEMORIA.md con lo hecho y lo pendiente.
```
