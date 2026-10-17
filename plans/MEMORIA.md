# Memoria del proyecto Necutla

Bitácora para que cualquier sesión sepa en qué va el proyecto sin confundirse.
**Se actualiza al final de cada sesión que cambie algo** (a diferencia de `plans/CLAUDE.md`, que no se toca).

Cómo se usa:
- **Planes**: tabla con el estado de cada plan de `plans/planes/`.
- **Cambios hechos**: entradas por fecha, la más reciente arriba. Qué se cambió y en qué archivos.
- **Pendientes**: lo que se habló o se detectó y falta hacer. Al resolver uno, se mueve a "Cambios hechos" con su fecha.

---

## Planes

| Plan | Estado | Fecha |
|---|---|---|
| `2026-10-16-rediseno-visual-profesional.md` | Terminado (fases 1 a 5 aplicadas) | 2026-10-16 |
| `2026-10-16-hosting-render-postgres.md` | Terminado en código; **falta el despliegue en Render** (lo hace el usuario) | 2026-10-16 |

---

## Pendientes

1. **Desplegar en Render.** Commit local hecho; falta el `git push` a GitHub (`VladimirArauz/Prueba-2`, esta máquina no tenía credenciales: `gh auth login`), crear el Blueprint en Render y conectar pgAdmin. Pasos en `README.md`.
2. **Contraseña del admin en Render.** Después del primer despliegue (cuando ya existe el admin), se puede borrar `ADMIN_PASSWORD` de las variables de Render; ya no se usa. Todavía no hay pantalla para cambiar contraseña ni para crear más admins (se hace insertando en la tabla `admins` con un hash bcrypt).
3. **Base de datos gratis de Render caduca** a los 30 días de creada (luego hay un periodo corto para pasar a plan de pago) y no tiene respaldos. Antes de que caduque: pasar a plan pagado o exportar con `pg_dump`/pgAdmin y crear otra.
4. **Restringir el acceso externo a la base** en `render.yaml` (`ipAllowList`): hoy está abierto a `0.0.0.0/0` para que pgAdmin funcione desde cualquier red. Cambiar por la IP del usuario.
5. **Números reales de WhatsApp.** Ahora se configuran en la variable `WHATSAPP_NUMBERS` (Render → Environment), ya no en el código. Faltan los números reales.
6. **Fotos reales.** Casi todas las tarjetas usan imágenes SVG de ejemplo. Solo `tecnologia/cables` y `tecnologia/audifonos` tienen fotos.
7. **Textos de ejemplo** en las subcategorías ("Producto de ejemplo. Puedes reemplazar…").
8. **Dos carritos separados.** El de la portada (`necutla_carrito_global`) y el de cada tienda (`carrito_<tienda>`) no se comparten. Decidir si se unifican.
9. **Productos de las páginas de tiendas son HTML fijo.** Los de Necutools salen de la base y se ven en la portada ("Productos del catálogo"); los de `ropa/playeras/…` siguen escritos a mano. Decidir si las tiendas también leen de la base.
10. **Mensaje de WhatsApp con emojis** (`public/app.js`, `sendOrderToWhatsApps`): permitido por las reglas; cambiar si se quiere más sobrio.
11. **Archivo sin uso:** `js_carrito.js` en la raíz (no se publica porque está fuera de `public/`). Borrar si el usuario confirma.
12. **Plan gratis del servicio web:** se duerme tras 15 min sin visitas y tarda ~1 min en despertar.

---

## Cambios hechos

### 2026-10-16: `plans/CLAUDE.md` actualizado (autorizado por el usuario) y commit
- `plans/CLAUDE.md`: sección 1 describe la arquitectura nueva (Render, Node/Express, PostgreSQL, `public/`); regla 8 de mantener `plans/MEMORIA.md`; sección 4 con reglas técnicas y de seguridad (sin JS ni estilos en línea por la CSP, SQL parametrizado, secretos en variables de entorno, migraciones idempotentes).
- Verde de WhatsApp `--wa` de `#178A4A` a `#157F44` (contraste 5.06:1, cumple AA) y su hover `--wa-oscuro` a `#0D5C30`, en `plans/CLAUDE.md` y `public/style.css`.
- Commit local con todo el trabajo del día (rediseño + preparación para Render). El push quedó pendiente por falta de credenciales de GitHub en esta máquina.

### 2026-10-16: preparación para Render + PostgreSQL (plan `2026-10-16-hosting-render-postgres.md`)

**Estructura**
- El sitio completo se movió a `public/` (con `git mv`). Solo esa carpeta se publica; `plans/`, `.env`, `server/`, `.git` dan 404.
- `README.txt` → `README.md` reescrito (cómo correrlo, variables, Render, pgAdmin, seguridad).

**Servidor (nuevo)**
- `package.json` + `package-lock.json` (Node 22; express 4, pg, helmet, express-session, connect-pg-simple, express-rate-limit, bcryptjs). `npm start` en Render, `npm run dev` local con `.env`.
- `server/index.js`: Helmet con CSP estricta, `trust proxy`, revisión de Origin (CSRF), límite de peticiones, estáticos de `public/`, `/healthz`, errores sin detalles.
- `server/db.js`: conexión con `DATABASE_URL`; aplica `db/schema.sql` en cada arranque.
- `server/auth.js`: login con bcrypt, sesión en PostgreSQL (cookie httpOnly/secure/sameSite strict, 8 h), `regenerate` al entrar, 10 intentos fallidos / 15 min, admin inicial desde `ADMIN_USERNAME`/`ADMIN_PASSWORD`.
- `server/api.js`: `/api/config` (WhatsApp), `/api/stands`, `/api/productos` (CRUD), `/api/productos/:id/imagen`. Validación de todo; imágenes PNG/JPG/WEBP/GIF verificadas por bytes, máximo 1 MB, guardadas en la base.
- `db/schema.sql`: tablas `stands`, `productos`, `admins`, `session` + 7 stands iniciales.

**Frontend**
- `public/app.js` reescrito para usar la API: productos, stands y login ahora son compartidos por todos los visitantes. El carrito sigue en el navegador y **ya no empieza con 2 productos falsos**.
- Eliminado el formulario público "Crear cuenta" de Necutools (cualquiera podía hacerse admin).
- Cero `onclick` en HTML y plantillas: ahora `data-section` / `data-action` con un listener delegado (permite la CSP sin scripts en línea y quita una inyección posible en `editAdminProduct('${id}')`).
- `public/iconos.js`: el sprite usa `hidden` en vez de `style` (lo exige la CSP).
- `public/*/js/carrito.js` y `*/carrito.html`: números de WhatsApp desde `/api/config`, eventos delegados, confirmación al vaciar, `noopener` al abrir WhatsApp.

**Configuración**
- `.env.example` documentado, `.env` local (ignorado por git, permisos 600), `.gitignore`, `.node-version` (22), `render.yaml` (web + Postgres gratis en Oregon, `SESSION_SECRET` generado, `ADMIN_*` y `WHATSAPP_NUMBERS` se piden al crear).

**Verificación hecha** (PostgreSQL 18 de prueba + servidor local)
- 404 para `plans/`, `.env`, `package.json`, `server/`, `.git/config`, `render.yaml`.
- Cabeceras CSP, HSTS, nosniff, X-Frame-Options, Referrer-Policy presentes; sin `X-Powered-By`.
- API: 401 sin sesión, 403 con Origin ajeno o sin Origin, 429 tras 10 logins fallidos, 413 con cuerpo enorme, 400 con imagen falsa / precio inválido / stand inexistente, 409 stand duplicado.
- Prueba en navegador con la CSP activa: carrito, WhatsApp, login, crear/editar/borrar producto, crear y ver stand, cerrar sesión, carrito de tienda. Cero violaciones de CSP. Diseño sin cambios (capturas).

### 2026-10-16: rediseño visual profesional (plan `2026-10-16-rediseno-visual-profesional.md`)

**Sistema de diseño**
- `style.css` reescrito completo: tokens de color (`--tinta`, `--senal`, `--aviso`, `--gis`, `--hoja`, `--linea`, `--texto-2`, `--wa`), fuente única Archivo con eje de ancho, botones con borde de 2px (`.btn`, `.secondary`, `.danger`, `.wa`, `.ghost`, `.btn-sm`, `.btn-icon`, `.btn-block`), foco visible, sin degradados, brillos ni mayúsculas, `prefers-reduced-motion`.
- Nuevo `iconos.js`: sprite de iconos Lucide que se inserta en cada página y la función global `icon(nombre)` para las plantillas de JS.

**Página principal**
- `index.html` reestructurado: navbar blanca, hero con tablero directorio azul de las 7 tiendas, tarjetas sin etiquetas flotantes, carrito con resumen en borde azul, Necutools sin badges, footer azul. Sin emojis y sin `style=""` inline.
- `app.js`: plantillas del carrito, tabla de Necutools, productos públicos, stands y toast con iconos y clases (sin estilos inline). Toasts con texto consistente ("Agregado al carrito: …").
- `app.js`: el hero solo se muestra en la sección Tienda (en Carrito y Necutools se oculta para que el contenido quede arriba).
- `app.js`: **corregido error previo**: `getAdminStores()` devolvía la misma lista `DEFAULT_STORES` y al crear el primer stand se modificaba, así que el stand nuevo no aparecía en la portada hasta recargar. Ahora devuelve una copia.

**Subpáginas de tiendas (37 archivos)**
- Todas las `*/index.html`, `*/*/index.html` y `*/carrito.html` regeneradas con la misma barra superior (marca, Volver, Carrito), encabezado de página y tarjetas. Se conservaron todos los productos, precios e imágenes.
- `*/js/carrito.js` (las 7 copias, idénticas): plantilla del carrito con iconos, estado vacío y mensaje de "Agregado al carrito" con clase en vez de `style`.
- Corregido: `tecnologia/cables` y `tecnologia/audifonos` mostraban en pantalla el texto "```html" (marcas de Markdown pegadas en el HTML).
- Corregido: `tecnologia/audifonos` tenía el título y el h1 "Cables"; ahora dice "Audífonos".
- Corregido: imagen `audifnos entrada c.png` no cargaba en Linux por mayúsculas; ahora apunta a `Audifnos entrada c.png`.
- Corregido: textos `alt` de imágenes de cables/audífonos que no correspondían al producto.

**Imágenes**
- Los 47 SVG de ejemplo se recolorearon a la paleta nueva (fondo `#DDE3EC`, texto `--tinta`).
- Creados `imagenes/producto.svg` (imagen por defecto de productos de Necutools) y los SVG que faltaban en `tecnologia/imagenes/` (baterias, cables, micas, carcasas, audifonos).

**Verificación hecha**
- Capturas en 1280px y 390px de portada, carrito, Necutools, una tienda, una subcategoría y un carrito de tienda.
- Prueba automática en navegador: agregar al carrito, cambiar cantidad, total, abrir los 3 WhatsApp, vaciar, crear cuenta, crear, editar y borrar producto, crear stand y ver stand. Todo pasa.
- Criterios del plan: sin emojis en la interfaz (solo en el mensaje de WhatsApp), sin degradados, glow, mayúsculas ni `style=""` en HTML.

---

## Cómo ver la página

En local (necesita PostgreSQL y un `.env`, ver `README.md`):

```
npm install
npm run dev
```

y abrir http://localhost:3000/

En producción: la URL que asigne Render al servicio `necutla` (ver `README.md`).
