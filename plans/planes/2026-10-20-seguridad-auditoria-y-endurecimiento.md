# Plan: auditoría de seguridad y endurecimiento de Necutla

- **Fecha:** 2026-10-20
- **Estado:** aplicado
- **Prompts:** `plans/prompts/2026-10-20-seguridad-auditoria-y-endurecimiento.md` (6 prompts)
- **Alcance:** todo el sitio: servidor (`server/`), base (`db/schema.sql`), frontend (`public/`),
  configuración (`render.yaml`, `.env.example`) y dependencias. Encontrar vulnerabilidades,
  corregirlas sin romper nada de lo que ya funciona y dejar pruebas de ataque que se puedan repetir.

## Contexto

El usuario pidió revisar la página como experto en ciberseguridad, buscar una skill que ayude a
encontrar vulnerabilidades y corregirlas para dejar la página lo más segura posible.

**Skills que se usan** (ya vienen en Claude Code; no hay que instalar nada):
- **`/security-review`**: revisa en busca de vulnerabilidades los **cambios pendientes de la rama
  actual** comparados con `main`. Por eso todo el trabajo se hace en la rama `seguridad`: al final,
  la skill revisa de una sola vez todo lo que cambió el plan.
- **`/code-review`** (nivel `max`, con una carpeta como objetivo, ej. `/code-review max server/`):
  revisa código que ya existe, no solo el diff. Sirve para la auditoría inicial de `server/` y `public/js/`.
- Ninguna de las dos sustituye las pruebas: cada hallazgo se confirma atacando el servidor local.

## Lo que ya está bien (no se toca)

Revisión preliminar del 2026-10-20 sobre el commit `c2830ab`:
- CSP estricta (`script-src 'self'`, `script-src-attr 'none'`, `frame-ancestors 'none'`), HSTS,
  `nosniff` y `Referrer-Policy` con Helmet; sin `X-Powered-By`.
- SQL con parámetros en todas las rutas. Lo que se interpola (`VIGENTE_HOY`, `EN_ALCANCE`,
  `ORDENES[...]`, `ZONA`) son constantes del código, no datos del usuario.
- bcrypt costo 12, comparación con hash falso si el usuario no existe (mismo tiempo de respuesta),
  `regenerate` al iniciar sesión, cookie `httpOnly` + `secure` + `sameSite: strict`, 8 h.
- CSRF: revisión de `Origin` en todo lo que no es GET (403 sin Origin).
- Permisos: `requireAdmin` / `requireDueno` / `exigirStand` en cada ruta de Necutools; el
  encargado no ve tiendas ajenas ni paquetes.
- Imágenes: solo PNG/JPG/WEBP/GIF verificados por sus bytes, máximo 1 MB, sin SVG.
- `?volver=` de `cuenta.js` solo acepta rutas internas (sin `//` ni `\`).
- `npm audit --omit=dev`: **0 vulnerabilidades**. `.env` nunca entró al historial de git y no hay
  contraseñas en ningún commit.

## Hallazgos preliminares (se confirman y se completan en el prompt 1)

| # | Gravedad | Hallazgo | Dónde |
|---|---|---|---|
| H1 | Alta | La base de Render acepta conexiones de cualquier IP (`ipAllowList 0.0.0.0/0`) | `render.yaml`, pendiente 4 |
| H2 | Alta | `ADMIN_PASSWORD` sigue guardada en las variables de Render | pendiente 2 |
| H3 | Media | Conexión externa a la base sin verificar el certificado (`rejectUnauthorized: false`) | `server/db.js` |
| H4 | Media | Toda la API acepta cuerpos JSON de 2 MB, también las rutas públicas (registro, pedidos, carrito): se puede saturar el servidor | `server/index.js` |
| H5 | Media | Cualquiera puede llenar el dashboard con pedidos falsos (40 por hora y por IP; con varias IPs no hay tope) | `server/pedidos.js`, pendiente 20 |
| H6 | Media | Las fotos de los celulares llevan datos EXIF (ubicación GPS, modelo). Se publican tal cual | `server/validar.js` (`leerImagen`) |
| H7 | Media | El límite de intentos de login es solo por IP: un ataque desde muchas IPs contra un usuario no se frena | `server/auth.js`, `server/clientes.js` |
| H8 | Media | No queda registro de quién hizo qué en Necutools (borrar productos, cambiar usuarios o roles) | `server/admin.js` |
| H9 | Baja | Al cerrar la sesión de Necutools con una cuenta de cliente abierta, la cookie conserva el mismo id de sesión | `server/auth.js`, `server/clientes.js` |
| H10 | Baja | La cookie se llama `necutla.sid`; con el prefijo `__Host-` el navegador garantiza que es solo de este dominio y por HTTPS | `server/auth.js` |
| H11 | Baja | Las imágenes de productos, tiendas y promociones ocultas siguen públicas por su URL | `server/api.js` |
| H12 | Baja | bcrypt solo usa los primeros 72 bytes; se aceptan contraseñas de hasta 200 caracteres. La de cliente pide 8 y no rechaza las más comunes | `server/admin.js`, `server/clientes.js` |
| H13 | Baja | Faltan `Permissions-Policy` y `X-Robots-Tag: noindex` en Necutools y `/api` | `server/index.js` |
| H14 | Baja | Necutools solo pide contraseña. Si se filtra la del dueño, se pierde todo | `server/auth.js` |
| H15 | Info | 73 `innerHTML` en `public/js/`: hay que confirmar uno por uno que todo dato pasa por `escapeHTML` | `public/js/*.js` |

## Cambios

### 1. Auditoría (prompt 1, sin corregir nada)
- Rama `seguridad` desde `main`. Servidor local con Node 22 y PostgreSQL de prueba (pendiente 17),
  **nunca contra Render**.
- Checklist OWASP Top 10 (2021) y OWASP ASVS nivel 2, ruta por ruta (todas las de la API).
- `/code-review max server/` y `/code-review max public/js/` para buscar lo que la lectura manual no vea.
- **Pruebas de ataque** en `scripts/seguridad/` (Node puro, sin dependencias nuevas, solo contra
  `localhost`), que se guardan para repetirlas:
  - **Inyección SQL:** cargas de inyección en cada parámetro y campo.
  - **XSS almacenado:** `<img src=x onerror=…>`, `"><svg onload=…>` y `javascript:` en cada campo de texto. Se abre cada página en Chrome sin ventana para ver si algo se ejecuta.
  - **IDOR:** un encargado intenta leer y modificar tiendas, productos, ofertas, opiniones y pedidos ajenos, y un cliente intenta editar la opinión de otro.
  - **CSRF:** sin `Origin`, con `Origin` ajeno o `null`, y con `Content-Type` de formulario.
  - **Sesión:** fijación, cookie después del logout y sesión de admin desactivado.
  - **Fuerza bruta y límites:** login, registro y pedidos.
  - **Cuerpos enormes y JSON mal formado:** mandar un cuerpo de 2 MB a las rutas públicas y medir el tiempo de respuesta.
  - **Archivos:** imágenes falsas, archivos políglotas, rutas con `..` y acceso a `plans/`, `.env`, `server/` y `.git`.
  - **Cabeceras:** revisar todas las respuestas.
- Resultado: `plans/auditorias/2026-10-20-seguridad.md` con cada hallazgo, su gravedad, cómo se
  reproduce y cuál prompt lo corrige. Esa carpeta no se publica.

### 2. Entrada y cabeceras (prompt 2) → H4, H9, H10, H13
- `express.json({ limit: "20kb" })` para la API pública y `2mb` solo en las rutas de Necutools que
  suben imágenes. 413 con mensaje claro.
- Además de `Origin`, revisar `Sec-Fetch-Site` cuando el navegador lo manda. Si dice `cross-site`, responder 403.
- Cookie con nombre `__Host-necutla.sid` en producción. Se queda `necutla.sid` en local porque sin HTTPS el prefijo no funciona. Las sesiones viejas se pierden una sola vez y todos vuelven a entrar.
- Al cerrar una de las dos sesiones (admin o cliente), `regenerate` y conservar solo la otra.
- `Permissions-Policy` (cámara, micrófono, geolocalización, pagos, USB, todo en `()`);
  `X-Robots-Tag: noindex, nofollow` en `/necutools.html` y `/api`; `Cache-Control: no-store` en
  las respuestas de `/api/admin`, `/api/auth` y `/api/clientes`.

### 3. Cuentas y contraseñas (prompt 3) → H7, H12, H14
- Límite de intentos **por usuario o correo** además del límite por IP. Al fallar 10 veces seguidas, la cuenta se frena 15 minutos.
  - Se guarda en la base: tabla `intentos_login`, idempotente, para que sobreviva a los reinicios de Render.
  - El mensaje de error no dice si la cuenta existe.
- Contraseñas:
  - Máximo de 72 bytes en UTF-8, con un mensaje claro.
  - Cliente: mínimo 10 caracteres.
  - Rechazar una lista corta de contraseñas comunes, guardada en el servidor, y las que contienen el usuario o el correo.
  - Las cuentas que ya existen siguen entrando igual.
- **Verificación en dos pasos (TOTP) opcional en Necutools**, recomendada para dueños:
  - Se hace con `crypto` de Node, sin dependencias nuevas.
  - "Mi cuenta" → "Activar verificación en dos pasos". Muestra la clave para escribirla en Google Authenticator o similar, junto con el enlace `otpauth://`, y pide un código para confirmar.
  - El login pide el código solo si está activa.
  - 8 códigos de respaldo de un solo uso, guardados con hash.
  - Un dueño puede quitarle la verificación a otro usuario que perdió su celular.

### 4. Datos y abuso (prompt 4) → H5, H6, H8, H11
- **Pedidos falsos:**
  - Tope de 30 piezas y 15 productos por pedido.
  - El mismo grupo enviado desde la misma IP en 10 minutos no se duplica.
  - Límite global de 500 pedidos por hora: al pasarlo, el pedido no se guarda, pero WhatsApp se abre igual.
  - En Necutools, "Cancelar todos los pendientes de más de 7 días", solo para dueños y con confirmación.
- **EXIF:** al subir una imagen, quitar los metadatos sin dependencias nuevas:
  - JPEG: se quitan los segmentos APP1 a APP15 y COM.
  - PNG: se quitan los chunks `eXIf`, `tEXt`, `iTXt` y `zTXt`.
  - WebP: se quitan los chunks `EXIF` y `XMP `.
  - GIF: se quitan las extensiones de comentario.
  - Las imágenes ya guardadas se limpian una sola vez con una migración en `migraciones`. No se borra ninguna imagen; solo se reescriben los bytes de cada una.
- **Bitácora de Necutools:**
  - Tabla `bitacora` con fecha, admin, acción, tabla, id y un resumen corto, sin contraseñas ni imágenes.
  - Se registra al crear, editar y borrar en tiendas, productos, ofertas, promociones, usuarios y pedidos, y en los cambios de contraseña y de verificación en dos pasos.
  - Pestaña "Bitácora" solo para dueños: lectura, 50 por página.
- Las imágenes de productos, tiendas y promociones ocultas responden 404, salvo a un admin que puede editarlas.

### 5. Frontend, infraestructura y documentación (prompt 5) → H1, H2, H3, H15
- Revisar los 73 `innerHTML` uno por uno:
  - Todo dato va con `escapeHTML`, los atributos entre comillas y las URLs solo internas o `wa.me`.
  - Si algún HTML no lleva datos, se pasa a `textContent` o `createElement`.
- `escapeHTML` escapa `& < > " '` (se confirma).
- `server/db.js`: verificar el certificado de la base externa (`rejectUnauthorized: true`).
  - Si el certificado de Render no lo permite, se deja documentado como excepción con la razón.
  - La conexión interna de Render no sale a internet.
- `render.yaml`: `ipAllowList` con un marcador explícito y un comentario. **La IP real la pone el usuario en el panel de Render**; no se sube a git.
- `public/.well-known/security.txt` con el contacto para reportar fallas (correo que elija el usuario, o el del repositorio).
- `README.md`: sección "Seguridad", con:
  - Qué protege cada capa.
  - Cómo correr `scripts/seguridad/`.
  - La checklist de Render: borrar `ADMIN_PASSWORD`, restringir la IP, rotar `SESSION_SECRET` si hubo fuga y respaldar la base.

### 6. Verificación y cierre (prompt 6)
- Repetir todas las pruebas de `scripts/seguridad/`: lo que antes pasaba ahora debe fallar con el código de error correcto.
- Las baterías de pruebas de los planes anteriores (API, carrito, Necutools, 360px) siguen pasando, con cero errores de consola o de CSP.
- `/security-review` sobre toda la rama `seguridad` y `npm audit --omit=dev`. Cada punto de la revisión se corrige o se anota con su razón.
- Estado del plan a `aplicado`, informe de auditoría actualizado y `plans/MEMORIA.md`.
- **No se hace merge ni push sin que el usuario lo pida.**

## Qué NO cambia
- Lógica del carrito, mensaje y envío a WhatsApp, precios del servidor, permisos dueño/encargado.
- Diseño: lo nuevo de Necutools (2 pasos, bitácora) usa solo tokens y clases existentes.
- Ningún dato se borra. Las migraciones son idempotentes. Las imágenes se limpian, pero no se borran.

## Riesgos y decisiones
- El cambio de nombre de la cookie cierra todas las sesiones una sola vez.
- Que el código de 2 pasos sea obligatorio para los dueños queda como decisión del usuario: por defecto es opcional.
- H1 y H2 solo los puede cerrar el usuario en el panel de Render. El plan deja los pasos exactos.
- Ninguna medida hace la página "invulnerable". El objetivo es cerrar todo lo encontrado y dejar
  pruebas para que una regresión se note.
