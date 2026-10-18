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
| `2026-10-16-hosting-render-postgres.md` | Desplegado en Render; faltan los pasos 3 y 5 de la checklist | 2026-10-16 |
| `2026-10-17-catalogo-multitienda.md` | Aplicado (fases 1 a 7). **Falta subirlo** (commit + push) y revisar las 2 decisiones de diseño pendientes | 2026-10-17 |

---

## Pendientes

**Para empezar la próxima sesión (cerrado el 2026-10-17):**
- Confirmar que el usuario subió el plan `2026-10-17-catalogo-multitienda.md` (commit + push) y que Render desplegó sin errores (Logs, `/healthz`).
- En Necutools: poner los números de WhatsApp de cada tienda y crear los usuarios de Fer y Aura (encargados).
- Pedir el visto bueno de los pendientes 10 y 11.

1. **Terminar el despliegue en Render: ver la checklist "Pasos pendientes en Render" justo abajo.** Pasos 1, 2 y 4 hechos (2026-10-17); faltan el paso 3 (comprobar la página) y el 5 (seguridad). Si el usuario pregunta "¿qué pasos eran para Render?", responder con esa checklist completa.
2. **Contraseña del admin en Render.** Después del primer despliegue (cuando ya existe el admin), se puede borrar `ADMIN_PASSWORD` de las variables de Render; ya no se usa. Ya hay pantallas para cambiar contraseña ("Mi cuenta") y crear usuarios (pestaña "Usuarios" de Necutools).
3. **Base de datos gratis de Render caduca** a los 30 días de creada (luego hay un periodo corto para pasar a plan de pago) y no tiene respaldos. Antes de que caduque: pasar a plan pagado o exportar con `pg_dump`/pgAdmin y crear otra.
4. **Restringir el acceso externo a la base** en `render.yaml` (`ipAllowList`): hoy está abierto a `0.0.0.0/0` para que pgAdmin funcione desde cualquier red. Cambiar por la IP del usuario.
5. **Números reales de WhatsApp.** Cada tienda pone los de sus vendedores en Necutools (Tiendas → Editar). `WHATSAPP_NUMBERS` queda solo de respaldo para tiendas sin números. Faltan los números reales.
6. **Fotos reales.** Casi todos los productos usan SVG de ejemplo (`public/imagenes/ejemplos/`). Hay 10 fotos reales de tecnología sin usar en `recursos/fotos-tecnologia/` para subirlas desde Necutools.
7. **Textos de ejemplo** en los productos importados ("Producto de ejemplo. Puedes reemplazar…" y "Producto destacado de la tienda."). Se editan o borran desde Necutools.
8. **Mensaje de WhatsApp con emojis** (`public/js/carrito.js`, `mensajeDe`): permitido por las reglas; cambiar si se quiere más sobrio.
9. **Plan gratis del servicio web:** se duerme tras 15 min sin visitas y tarda ~1 min en despertar.
10. **Diseño por confirmar (plan 2026-10-17):** (a) el letrero azul de "Promociones de temporada" debajo del hero, que compite un poco con el tablero (choque con `plans/CLAUDE.md`, "la única pieza llamativa es el tablero"); (b) la etiqueta de oferta `.tag-oferta` (relleno `--senal`, borde `--tinta`). Se hicieron dentro de las reglas, pero el usuario no las ha visto.
11. **`plans/CLAUDE.md` desactualizado:** la sección 1 todavía dice que son 7 tiendas fijas con carpetas propias y que Necutools es una sección de `index.html`. Solo se puede corregir si el usuario lo pide.
12. **Límite de peticiones a la API:** 300 cada 15 minutos por IP. Si muchos estudiantes entran desde la misma red de la escuela (misma IP), podrían toparse con el límite. Vigilar y subirlo en `server/index.js` si pasa.

### Pasos pendientes en Render (guardados el 2026-10-16 a pedido del usuario)

Marcar cada paso con `[x]` cuando el usuario confirme que lo hizo.

**Paso 0: acceso al repositorio (bloqueado: Vladi no contesta)**
- [ ] El repo `VladimirArauz/Prueba-2` es de Vladi. Para que Render lo vea, hay dos caminos:
  - **A (con Vladi):** que Vladi te agregue como colaborador (GitHub → repo → Settings → Collaborators) o que él mismo conecte el repo en Render.
  - **B (sin esperar a Vladi):** haz un **fork** a tu cuenta (botón *Fork* en https://github.com/VladimirArauz/Prueba-2) y despliega desde `TU_USUARIO/Prueba-2`. En la carpeta local, apunta a tu fork con `git remote add mio https://github.com/TU_USUARIO/Prueba-2.git` y sube con `git push mio main`. Más adelante, cuando Vladi conteste, se pueden juntar los cambios con un Pull Request.

**Paso 1: crear la cuenta**
- [x] Entrar a https://dashboard.render.com y registrarse con **GitHub** (la cuenta que tenga acceso al repo).
- [x] Autorizar a Render a ver el repositorio (*Configure account* → elegir `Prueba-2`).

**Paso 2: crear todo con el Blueprint**
- [x] Render → **New → Blueprint** → elegir el repositorio `Prueba-2`, rama `main`.
- [x] Render lee `render.yaml` y pide 3 valores:
  - `ADMIN_USERNAME`: el usuario para entrar a Necutools (ej. `axel`).
  - `ADMIN_PASSWORD`: contraseña de **12 caracteres o más** (guardarla en un lugar seguro).
  - `WHATSAPP_NUMBERS`: números reales separados por coma, formato `52` + 10 dígitos, sin espacios ni `+` (ej. `525512345678,525598765432`).
- [x] **Apply.** Se crean la base `necutla-db` y el servicio web `necutla` (ambos plan Free, región Oregon).
- [x] Esperar a que el servicio diga **Live** (la primera vez tarda unos minutos).

**Paso 3: comprobar que funciona**
- [ ] Abrir la URL del servicio (`https://necutla….onrender.com`, aparece arriba en la página del servicio).
- [ ] Abrir `…onrender.com/healthz`: debe decir `{"ok":true}`.
- [ ] Ir a **Necutools** → iniciar sesión con `ADMIN_USERNAME` / `ADMIN_PASSWORD` → crear un producto de prueba → verlo en "Productos del catálogo".
- [ ] Probar el carrito y el botón **Enviar pedido por WhatsApp**.
- [ ] Si algo falla: servicio `necutla` → pestaña **Logs** → copiar el error y pasárselo a Claude.

**Paso 4: conectar pgAdmin (ya está instalado en la máquina)**
- [x] Render → `necutla-db` → **Connect** → pestaña **External**: copiar Hostname (`dpg-…-a.oregon-postgres.render.com`), Port `5432`, Database `necutla`, Username, Password.
- [x] pgAdmin → clic derecho en *Servers* → **Register → Server**:
  - *General → Name*: `Necutla (Render)`
  - *Connection*: Host = hostname externo, Port = `5432`, Maintenance database = `necutla`, Username y Password; marcar *Save password*.
  - *Parameters*: **SSL mode = require**.
- [x] Ver las tablas en *Databases → necutla → Schemas → public → Tables* (`stands`, `productos`, `admins`, `session`).

**Paso 5: después del primer despliegue (seguridad)**
- [ ] Render → `necutla` → **Environment** → borrar `ADMIN_PASSWORD` (el admin ya quedó creado en la base) → *Save changes*.
- [ ] Restringir el acceso a la base: `necutla-db` → **Networking / Access Control** → cambiar `0.0.0.0/0` por tu IP (búscala en https://ifconfig.me) con `/32` al final.
- [ ] Anotar la **fecha de creación de la base**: el plan gratis caduca a los 30 días. Poner recordatorio para respaldarla (pgAdmin → clic derecho en `necutla` → *Backup…*) o pasarla a plan de pago antes.

---

## Cambios hechos

### 2026-10-17: catálogo de varias tiendas (plan `2026-10-17-catalogo-multitienda.md`, fases 1 a 7)

**Base de datos** (`db/schema.sql`, todo idempotente; probado 2 veces seguidas, sobre datos viejos y desde cero)
- `stands`: slug, descripción, icono, `whatsapp[]`, orden, visible, portada. Las 7 tiendas originales quedaron con slug, icono, descripción e imagen.
- Tablas nuevas: `subcategorias`, `ofertas`, `promociones`, `promocion_items`, `admin_stands`, `migraciones` (datos que se acomodan una sola vez).
- `productos`: tipo (producto/servicio), `subcategoria_id`, `precio_modo` (fijo/desde/cotizar), visible, orden, `imagen_ruta`. El texto de `categoria` pasó a `subcategorias` (la columna se conserva).
- `admins`: rol (dueño/encargado) y activo. Los admins que ya existían quedan como **dueños**.
- Índice de trigramas para buscar (si la base no lo permite, la búsqueda sigue funcionando sin índice).

**Servidor**
- `server/validar.js` (validación compartida), `server/ofertas.js` (único lugar que calcula descuentos, hora de Ciudad de México, `HOY_PRUEBA` solo en desarrollo), `server/admin.js` (API `/api/admin`), `server/ejemplos.js` + `scripts/importar-ejemplos.js` (`npm run importar`).
- `server/api.js` reescrito: `/api/stands`, `/api/stands/:slug`, `/api/hoy`, `/api/promociones`, `/api/buscar`, `POST /api/carrito/precios` (el servidor pone los precios). Se quitaron las rutas viejas `/api/productos` (lista y CRUD sin permisos por tienda).
- `server/auth.js`: el admin se carga de la base en cada petición (rol, tiendas, activo), `requireDueno`, `puedeEditarStand`, cierre de sesiones al desactivar o cambiar contraseña, login rechaza cuentas desactivadas.
- `server/index.js`: `/t/:slug` sirve `tienda.html`; redirecciones 301 de las direcciones viejas (`/ropa/playeras/` → `/t/ropa?sub=playeras`, `/<tienda>/carrito.html` → `/carrito.html`); importa los ejemplos al arrancar (una vez).

**Frontend**
- Páginas nuevas: `tienda.html` (pestañas Productos/Servicios/Ofertas, filtro por subcategoría en la URL, de 12 en 12), `carrito.html` (agrupado por tienda, un botón de WhatsApp por grupo, "Ya lo envié" quita solo ese grupo), `promociones.html`, `necutools.html` (Tiendas, Productos y servicios, Ofertas, Promociones y Usuarios solo para dueños, Mi cuenta).
- `index.html`: tablero y tarjetas salen de la base (las tiendas nuevas aparecen solas), letrero de promociones de temporada (máx. 3), "Ofertas de hoy" (una línea por tienda, máx. 6) y buscador (máx. 20 resultados).
- `public/js/`: `comun.js` (API, carrito con `{tipo,id,cantidad}`, WhatsApp, tarjetas), `portada.js`, `tienda.js`, `carrito.js`, `promociones.js`, `necutools.js`.
- WhatsApp: se abre el chat del vendedor 1 y aparecen botones para los demás (abrir varias ventanas seguidas lo bloquea el navegador).
- `iconos.js`: 19 iconos de Lucide nuevos (los que se pueden elegir para tiendas y los de la interfaz). `style.css`: estilos nuevos solo con los tokens existentes; barra sin iconos a ≤400px; en celular los datos del cliente van antes de los pedidos. Favicon `imagenes/favicon.svg`.

**Borrado** (sigue en el historial de git)
- Las 7 carpetas de tiendas fijas (31 páginas, 7 carritos), `public/app.js` y `js_carrito.js`. Sus 26 productos (incluidos los 7 destacados de la portada vieja) están en `db/ejemplos.json` y sus imágenes en `public/imagenes/ejemplos/`.
- 10 fotos reales de tecnología que ninguna página usaba se movieron a `recursos/fotos-tecnologia/` (no se publican).

**Desviaciones del plan**
- El carrito viejo (`necutla_carrito_global`, `carrito_<tienda>`) no se convierte: guardaba nombre y precio sin id. Se borra con el aviso "Actualizamos el carrito. Vuelve a agregar los productos que tenías."
- La importación de ejemplos corre sola al arrancar (el plan gratis de Render no tiene Shell).
- Las pestañas y filtros usan `.btn.btn-sm` (el activo) y `.btn.secondary.btn-sm` (los demás): no hizo falta un estilo de botón nuevo.
- El usuario pidió hacer todas las fases sin detenerse, así que no se esperó su visto bueno para borrar las carpetas viejas ni para el diseño del letrero y la etiqueta de oferta (ver pendiente 10).

**Verificación** (PostgreSQL 18 local + Chromium)
- 71 pruebas de API: 401 sin sesión, 403 sin Origin, encargado con 403 en tiendas ajenas, usuarios y promociones; 400 con datos inválidos; 409 en duplicados; sesiones cerradas al desactivar o reiniciar contraseña; carrito ignora el precio del navegador; ofertas (porcentaje, precio especial, 2x1, por días); promociones por fecha; búsqueda.
- 38 pruebas en navegador: Necutools completo (dueño y encargado), tienda nueva que aparece sola en la portada, filtros, servicios por WhatsApp a los números de la tienda, carrito con 3 grupos y mensaje correcto, direcciones viejas, 360px sin scroll horizontal (portada, tienda, carrito, promociones, Necutools) y **cero errores de consola o de CSP**.

### 2026-10-17: plan del catálogo de varias tiendas
- Nuevo plan `plans/planes/2026-10-17-catalogo-multitienda.md` y sus 7 prompts en `plans/prompts/2026-10-17-catalogo-multitienda.md`. Sale de lo que pidió el socio: tiendas con subcategorías, pedido por tienda a sus vendedores, Necutools con dueños y encargados, servicios, ofertas de cada día por tienda y promociones generales de temporada.
- Decisiones del usuario: dueño + encargados por tienda; las promos que mezclan tiendas son paquetes; un carrito único agrupado por tienda; los productos de ejemplo se importan a la base.
- Choque con las reglas de diseño que hay que confirmar en la fase 6: las promociones generales "más visibles" frente a "la única pieza llamativa es el tablero del hero".

### 2026-10-17: base de Render creada y conectada a pgAdmin
- Render ya creó la base `necutla-db` con las tablas `admins`, `productos`, `session` y `stands` (el Blueprint corrió).
- Servidor "Necutla (Render)" registrado en el pgAdmin web local (http://localhost/pgadmin4), con SSL `require`. La contraseña **no** se guardó en ningún archivo: se escribe en pgAdmin al conectar.
- Checklist de Render: pasos 1, 2 y 4 marcados como hechos.

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
