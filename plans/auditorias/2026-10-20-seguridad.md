# Auditoría de seguridad de Necutla

- **Fecha:** 2026-10-20
- **Plan:** `plans/planes/2026-10-20-seguridad-auditoria-y-endurecimiento.md`
- **Código auditado:** commit `c2830ab` (rama `seguridad`)
- **Entorno:** servidor real (`server/index.js`, Node 22.23.3) contra PostgreSQL 18.4 local en el puerto
  54329 (`embedded-postgres`), Chrome sin ventana con `puppeteer-core`. **Nunca contra Render.**
- **Método:** OWASP Top 10 (2021) y ASVS 4.0 nivel 2, ruta por ruta; skill `/code-review max` sobre
  `server/` y `public/js/`; pruebas de ataque repetibles; `npm audit --omit=dev`.

## Cómo repetir las pruebas

```
node scripts/seguridad/ataques.js http://localhost:3000
```

Solo corre contra `localhost`. Usa el dueño de la base local (`NECUTLA_DUENO_USUARIO` y
`NECUTLA_DUENO_PASSWORD`, por defecto `dueno` / `prueba-dueno-123`). Crea encargados, clientes y
productos de prueba con un sufijo único y desactiva a los encargados al terminar.

La prueba de XSS en el navegador necesita Chrome y `puppeteer-core`, que no son dependencias del
proyecto. Se corrió desde la carpeta temporal de la sesión: mete cargas como
`<img data-xss src=x>"'><b data-xss>` en cada campo de texto por la API y revisa en Chrome la
portada, la búsqueda, la tienda, el producto, el servicio, las promociones, el carrito, la cuenta y
las 9 pestañas de Necutools.

## Resultados del prompt 1 (antes de corregir)

- `scripts/seguridad/ataques.js`: **149 de 168** pruebas pasan. Las 19 que fallan son exactamente los
  hallazgos de abajo (H4, H5, H6, H7, H9, H11, H12, H13, H16).
- XSS almacenado en navegador: **44 de 44** (ningún elemento inyectado, cero violaciones de CSP,
  `?volver=` no sale del sitio con `//`, `/\`, `https://` ni `javascript:`).
- `npm audit --omit=dev`: 0 vulnerabilidades.
- Historial de git: `.env` nunca se subió; no hay contraseñas, hashes ni `DATABASE_URL` reales en ningún commit.

### Lo que resistió (sin hallazgo)

| Área | Qué se probó | Resultado |
|---|---|---|
| Inyección SQL | 5 cargas (`' OR '1'='1`, `UNION`, `DROP`, `pg_sleep`) en 12 parámetros de rutas públicas y de Necutools, y en ambos logins | Sin 500, sin demora, sin datos filtrados. Todo el SQL usa parámetros; lo interpolado son constantes del código |
| Control de acceso | 17 acciones de un encargado sobre la tienda de otro, escalada a dueño, crear y borrar tiendas, usuarios, promociones | 403 en todas; listas filtradas por tienda; paquetes solo para dueños |
| Autenticación | 15 rutas sin sesión, cliente en Necutools, cookie alterada | 401 en todas |
| CSRF | Sin `Origin`, `Origin` ajeno, `Origin: null`, formulario con `Origin` ajeno | 403 en todas; cookie `SameSite=Strict` |
| Sesión | Fijación, logout, admin desactivado | El id cambia al entrar; cookie vieja sin acceso; desactivar corta la sesión al instante |
| Tiempo de login | Usuario existente contra inexistente | Diferencia de menos de 120 ms (hash falso) |
| Asignación masiva | `rol`, `activo`, `adminId`, `__proto__` y `constructor.prototype` en el registro | Ignorados |
| Archivos | `.env`, `plans/`, `server/`, `.git`, `package.json`, `render.yaml`, `node_modules`, rutas con `%2e%2e` y `%5c` | 404 |
| Imágenes | Texto declarado como PNG, SVG con `onload`, políglota PNG + HTML | 400, 400, y la políglota se sirve como `image/png` con `nosniff` y CSP |
| XSS | Cargas en 15 campos, 19 vistas | Todo pasa por `escapeHTML`; `escapeHTML` cubre `& < > " '` |
| Precios | Precio y total del navegador en el pedido | Ignorados; el servidor recalcula |
| Errores | JSON roto, ruta inexistente | 400/404 sin pila ni rutas internas |

## Hallazgos

Gravedad con CVSS 3.1 aproximado. "Prompt" es el del plan que lo corrige.

| # | Gravedad | Hallazgo | Evidencia | Prompt | Estado |
|---|---|---|---|---|---|
| H1 | Alta (7.5) | La base de Render acepta conexiones de cualquier IP (`ipAllowList 0.0.0.0/0`). Solo la protege la contraseña | `render.yaml` | 5 + usuario | Lo hace el usuario en Render (pasos en README → Seguridad) |
| H2 | Alta (7.2) | `ADMIN_PASSWORD` sigue en las variables de Render; quien vea el panel la lee | Pendiente 2 de MEMORIA | Usuario | Lo hace el usuario en Render (pasos en README → Seguridad) |
| H3 | Media (5.9) | Conexión externa a la base sin verificar el certificado (`rejectUnauthorized: false`): un intermediario podría leer la contraseña | `server/db.js:15` | 5 | Corregido (prompt 5) |
| H4 | Media (5.3) | Toda la API acepta 2 MB de JSON, también las rutas públicas sin sesión; además no se revisa `Sec-Fetch-Site` | Prueba: 1.9 MB a `/api/pedidos`, `/api/clientes/registro`, `/api/carrito/precios` y `/api/auth/login` → 400/200 en vez de 413 | 2 | Corregido (prompt 2) |
| H5 | Media (5.3) | Pedidos falsos: un pedido de 99 piezas se guarda; el mismo pedido dos veces seguidas crea dos; sin tope global | Prueba: 201 con 99 piezas; ids 119 y 120 | 4 | Corregido (prompt 4) |
| H6 | Media (5.3) | Las fotos conservan EXIF (ubicación GPS del celular) al publicarse | Prueba: el JPEG servido contiene `Exif` y `GPSLatitude` | 4 | Corregido (prompt 4) |
| H7 | Media (5.3) | Sin límite por cuenta: 15 intentos desde 15 IPs contra el mismo usuario o correo no se frenan; adivinar la contraseña actual en "Mi cuenta" no tiene límite propio | Prueba: 401 en el intento 15; 400 en el 12 de `mi-password` | 3 | Corregido (prompt 3) |
| H8 | Media (4.3) | No hay registro de quién hizo qué en Necutools | Revisión de `server/admin.js` | 4 | Corregido (prompt 4) |
| H9 | Baja (3.1) | Al cerrar Necutools con una cuenta de cliente abierta se conserva el mismo id de sesión (la sesión vieja ya no tiene acceso de admin, pero el id no rota) | Prueba: misma cookie después del logout | 2 | Corregido (prompt 2) |
| H10 | Baja (3.1) | La cookie no usa el prefijo `__Host-` | `server/auth.js:22` | 2 | Corregido (prompt 2) |
| H11 | Baja (3.7) | Imágenes de productos, tiendas y promociones ocultas siguen públicas por su URL | Prueba: 200 sin sesión | 4 | Corregido (prompt 4) |
| H12 | Baja (3.7) | bcrypt ignora lo que pasa de 72 bytes (se entra con otra contraseña que comparte los primeros 72); el cliente acepta `12345678` | Prueba: login 200 con contraseña distinta; registro 200 | 3 | Corregido (prompt 3) |
| H13 | Baja (2.6) | Faltan `Permissions-Policy`, `X-Robots-Tag: noindex` en Necutools y `/api`, y `Cache-Control: no-store` en respuestas con datos privados | Prueba: cabeceras ausentes | 2 | Corregido (prompt 2) |
| H14 | Baja (3.7) | Necutools solo pide contraseña: si se filtra la de un dueño, se pierde todo | Revisión | 3 | Corregido (prompt 3): opcional por usuario |
| H15 | Info | 73 `innerHTML` en `public/js/`: la prueba de XSS no encontró fallas, falta la revisión línea por línea | Revisión | 5 | Revisado (prompt 5): sin fallas |
| H16 | Media (5.3) | El límite de registro no cuenta los correos repetidos (`skipFailedRequests`), pero cada intento calcula un bcrypt antes del 409: se puede gastar CPU sin freno y probar correos sin límite | Prueba: 32 registros repetidos desde una IP → 409 siempre, nunca 429 | 3 | Corregido (prompt 3) |
| H17 | Baja (2.6) | El registro dice si un correo ya tiene cuenta (409). Sin correo de verificación no se puede evitar del todo; se acota con el límite de H16 | Revisión | 3 | Aceptado: sin correo de verificación no se evita; acotado por H16 |
| H18 | Baja (3.1) | La cookie `secure` depende de que `NODE_ENV=production`; si alguien la quita en Render, la sesión viaja sin esa marca | `server/auth.js:11` | 2 | Corregido (prompt 2) |
| H19 | Info | `trust proxy 1` supone un solo proxy delante. Si Render pone más de uno, el límite por IP vería la IP del proxy (todos juntos) | `server/index.js:23` | 5 (verificar en Render) | Por verificar en los Logs de Render (línea "Revisión de proxy") |
| H20 | Baja (2.6) | La sesión se renueva con cada uso (`rolling`) y no tiene duración máxima absoluta | `server/auth.js:27` | 2 | Corregido (prompt 2) |
| H21 | Baja (2.6) | Un paquete sigue a la venta y expone los WhatsApp de una tienda o producto ocultos | `server/api.js` (`promocionesVigentes`) | 4 | Corregido (prompt 4) |

## Correcciones (prompts 2 a 5)

| # | Qué se hizo | Archivos |
|---|---|---|
| H4 | 20 KB de JSON en toda la API y 2 MB solo en las rutas de Necutools que suben imágenes (413 con mensaje claro); `Sec-Fetch-Site` distinto de `same-origin` o `none` → 403; el Origin se revisa antes de leer el cuerpo | `server/index.js` |
| H9, H10, H18, H20 | Cookie `__Host-necutla.sid` en producción; `renovarSesion` da un id nuevo al entrar y al salir de una de las dos cuentas; el servidor no arranca en Render sin `NODE_ENV=production`; 24 h máximas por sesión (`vidaMaxima`) | `server/auth.js`, `server/clientes.js` |
| H13 | `Permissions-Policy`; `X-Robots-Tag: noindex, nofollow` en `/necutools.html` y `/api`; `Cache-Control: no-store` en `/api/admin`, `/api/auth` y `/api/clientes` | `server/index.js` |
| H7 | Tabla `intentos_login`: 10 fallos seguidos frenan la cuenta 15 minutos (login de admin y cliente, contraseña actual, código de 2 pasos), exista o no la cuenta | `server/intentos.js`, `db/schema.sql` |
| H12, H16, H17 | Contraseñas nuevas: hasta 72 bytes, 12 (admin) o 10 (cliente) caracteres, sin las más comunes ni con menos de 4 letras distintas, sin el usuario o correo. El registro revisa el correo antes del bcrypt y los 409 cuentan para el límite | `server/contrasenas.js`, `server/clientes.js`, `server/admin.js` |
| H14 | TOTP (RFC 6238) con `crypto`: activar con contraseña + código, 8 códigos de respaldo de un uso (hash SHA-256), un código no sirve dos veces, login en dos pasos con la sesión "a medias" 5 minutos, desactivar con contraseña + código, el dueño se la quita a otro. Activarla y cambiar la contraseña cierran también los logins a medias | `server/totp.js`, `server/auth.js`, `server/admin.js`, `public/necutools.html`, `public/js/necutools.js` |
| H5 | Hasta 30 piezas y 15 productos; huella HMAC (IP + grupo + productos, sin guardar la IP) para no duplicar en 10 minutos; 500 por hora en total; "Cancelar pendientes de más de 7 días" (solo dueños) | `server/pedidos.js` |
| H6 | `limpiarMetadatos` para JPEG, PNG, WebP y GIF sin dependencias; conserva la orientación del JPEG; migración única que limpió las imágenes ya guardadas (6 en la base local) sin borrar ninguna | `server/imagenes.js`, `server/admin.js` |
| H8 | Tabla `bitacora` y pestaña "Bitácora" (solo dueños, 50 por página, filtro por usuario): entradas, altas, cambios y bajas de todo Necutools, contraseñas y 2 pasos | `server/bitacora.js`, `server/admin.js`, `server/pedidos.js` |
| H11, H21 | Imágenes de lo oculto: 404 salvo a quien puede editarlo (sin caché pública); un paquete con algo oculto ya no se vende ni muestra WhatsApp | `server/api.js` |
| H3 | `DATABASE_SSL=true` verifica el certificado; `no-verify` solo si se pide | `server/db.js` |
| H15 | Revisión de cada `${…}` en `public/js/`: todo dato pasa por `escapeHTML` o `textContent`; el resto son números, constantes o textos de `confirm`, del toast (que escapa) o del mensaje de WhatsApp (codificado en la URL) | — |
| Extra | `/.well-known/security.txt` (RFC 9116) con contacto privado en GitHub; `render.yaml` explica cómo cerrar el acceso externo sin escribir la IP en git; registro "Revisión de proxy" para H19 | `public/.well-known/security.txt`, `server/index.js`, `render.yaml` |

**Desviaciones del plan**
- La skill `/code-review max` se cortó por el límite de uso de la sesión antes de dar resultados; no se repitió. La cubren la revisión manual, las pruebas de ataque y `/security-review` sobre toda la rama.
- El secreto TOTP se guarda sin cifrar en la base: cifrarlo con una clave de las variables de entorno ataría los 2 pasos a esa clave, y quien lee la base ya tiene todo lo demás.
- `security.txt` usa los avisos privados de seguridad del repositorio de GitHub en vez de un correo, para no publicar datos personales.
- PNG y WebP pierden la orientación EXIF (los celulares guardan fotos en JPEG; en JPEG sí se conserva).

## Verificación final (prompt 6)

- `db/schema.sql` aplicado 3 veces seguidas sin error, más cada reinicio del servidor.
- `scripts/seguridad/ataques.js`: **184 de 184** (las 168 originales más 2 pasos, cuentas inexistentes y contraseñas débiles).
- XSS almacenado en navegador: **44 de 44**.
- Pruebas nuevas en navegador (activar 2 pasos, códigos equivocados, código de respaldo, recargar a medias, "Usar otra cuenta", quitarla como dueño, Bitácora con filtro, cancelar viejos, 1280 y 360 px sin scroll horizontal): **36 de 36**, cero errores de consola o CSP.
- Baterías anteriores: pedidos 9 de 9; administración 34 de 34 (la prueba vieja mandaba el mismo pedido dos veces desde una IP; ahora cada pedido sale de otra IP, porque el duplicado ya no se guarda a propósito); Necutools en navegador 95 de 95.
- TLS de la base contra un PostgreSQL local con SSL: rechaza CA desconocida y nombre distinto, conecta con la CA correcta.
- Modo producción: cookie `__Host-necutla.sid; Secure; HttpOnly; SameSite=Strict`, HSTS; con `RENDER=true` y sin `NODE_ENV=production` el servidor no arranca.
- Imágenes reales (JPEG con GPS y orientación 6, PNG con texto e iTXt, WebP y GIF con EXIF o comentario): mismos píxeles, sin GPS ni modelo, JPEG con su orientación.
- Sin hex sueltos, degradados, `backdrop-filter`, `style="`, `onclick`, `uppercase` ni emojis en lo nuevo.
- `/security-review` sobre toda la rama: **sin vulnerabilidades**. Su única nota informativa (un login a medias sobrevivía 5 minutos a un cambio de contraseña) se corrigió.
- `npm audit --omit=dev`: 0 vulnerabilidades.

## Lo que falta (solo el usuario, en el panel de Render)

1. H2: borrar `ADMIN_PASSWORD` de Environment.
2. H1: restringir `0.0.0.0/0` de `necutla-db` a tu IP con `/32` (o dejarlo vacío).
3. Activar los 2 pasos en las cuentas de dueño.
4. H19: después de desplegar, leer en Logs las líneas "Revisión de proxy" (deben decir 1 dirección).
