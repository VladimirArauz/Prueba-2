# Prompts: auditoría de seguridad y endurecimiento

Plan: `plans/planes/2026-10-20-seguridad-auditoria-y-endurecimiento.md`. Correr en orden, en la rama `seguridad`.

---

## Prompt 1: auditoría y pruebas de ataque (sin corregir)

```
Lee plans/CLAUDE.md, plans/MEMORIA.md y plans/planes/2026-10-20-seguridad-auditoria-y-endurecimiento.md.
Actúa como auditor de seguridad. En este prompt NO corrijas nada: solo encuentra, confirma y documenta.

1. Crea la rama `seguridad` desde `main` (sin push).
2. Levanta el servidor real en local con Node 22 y un PostgreSQL de prueba (pendiente 17 de MEMORIA).
   Nunca contra Render. Crea datos de prueba: 1 dueño, 2 encargados con tiendas distintas, 2 clientes,
   productos, ofertas, opiniones y pedidos.
3. Revisa todas las rutas de server/ con la checklist OWASP Top 10 (2021) y ASVS nivel 2:
   control de acceso, inyección, autenticación, sesión, validación, errores, cabeceras, archivos.
4. Usa la skill /code-review con nivel max sobre `server/` y luego sobre `public/js/`.
   Confirma cada hallazgo antes de anotarlo.
5. Escribe pruebas de ataque en scripts/seguridad/ (Node puro, sin dependencias nuevas; solo
   permiten apuntar a localhost): SQLi en cada parámetro, XSS almacenado en cada campo de texto
   (y abre las páginas en Chrome sin ventana para ver si algo se ejecuta), IDOR entre encargados y
   entre clientes, CSRF (sin Origin, Origin ajeno, Origin null, Content-Type de formulario),
   fijación y reuso de sesión, fuerza bruta, cuerpos de 2 MB en rutas públicas, imágenes falsas o
   políglotas, rutas con .. y archivos privados (plans/, .env, server/, .git), cabeceras.
   Cada prueba dice qué espera y si pasó.
6. Corre npm audit --omit=dev.
7. Escribe plans/auditorias/2026-10-20-seguridad.md: por hallazgo, gravedad (CVSS aproximado),
   cómo reproducirlo, evidencia y qué prompt del plan lo corrige. Agrega los nuevos que no estén
   en la tabla H1–H15 y asígnales prompt.
8. Actualiza plans/MEMORIA.md (plan "en curso", prompt 1 hecho).
```

---

## Prompt 2: entrada, sesión y cabeceras (H4, H9, H10, H13)

```
Lee plans/CLAUDE.md, plans/MEMORIA.md, el plan 2026-10-20-seguridad-auditoria-y-endurecimiento.md
y plans/auditorias/2026-10-20-seguridad.md. Trabaja en la rama `seguridad`.

1. server/index.js: express.json con 20kb para la API pública; 2mb solo para las rutas de Necutools
   que reciben imágenes (tiendas, productos, promociones). 413 con mensaje claro.
2. sameOrigin: además de Origin, rechaza con 403 si Sec-Fetch-Site es "cross-site".
3. server/auth.js: cookie `__Host-necutla.sid` solo en producción (en local sigue `necutla.sid`);
   path "/" y sin domain.
4. Al cerrar la sesión de admin o de cliente cuando la otra sigue abierta: regenerate y conserva
   solo la otra (en server/auth.js y server/clientes.js).
5. Cabeceras: Permissions-Policy (camera, microphone, geolocation, payment, usb… en ()),
   X-Robots-Tag noindex,nofollow en /necutools.html y /api, Cache-Control no-store en /api/admin,
   /api/auth y /api/clientes.
6. Corre las pruebas de scripts/seguridad/ de estos puntos y las de los planes anteriores que
   toquen login, carrito y subida de imágenes. Usa /security-review sobre la rama.
7. Actualiza el informe de auditoría (estado de cada hallazgo) y plans/MEMORIA.md.
```

---

## Prompt 3: cuentas, contraseñas y verificación en dos pasos (H7, H12, H14)

```
Lee plans/CLAUDE.md, plans/MEMORIA.md, el plan 2026-10-20-seguridad-auditoria-y-endurecimiento.md
y plans/auditorias/2026-10-20-seguridad.md. Trabaja en la rama `seguridad`.

1. db/schema.sql (idempotente): tabla intentos_login (tipo admin/cliente, cuenta en minúsculas,
   fallos, bloqueado_hasta); columnas de TOTP en admins (secreto, activo, códigos de respaldo con
   hash). Sin borrar datos.
2. Límite por cuenta: 10 fallos seguidos → 15 minutos frenada, además del límite por IP. El mensaje
   no revela si la cuenta existe. Un login correcto reinicia el contador.
3. Contraseñas nuevas: máximo 72 bytes UTF-8; cliente mínimo 10; rechazar una lista corta de
   contraseñas comunes (archivo en server/, no en public/) y las que contengan el usuario o correo.
   Las cuentas existentes siguen entrando.
4. TOTP opcional para Necutools con crypto de Node (RFC 6238, SHA-1, 30 s, 6 dígitos, ventana ±1,
   un código no se acepta dos veces):
   - Mi cuenta → "Activar verificación en dos pasos": muestra la clave en base32 y el enlace
     otpauth://, pide un código para confirmar, entrega 8 códigos de respaldo una sola vez.
   - Login en dos pasos: primero usuario y contraseña; si tiene TOTP, la sesión queda "a medias"
     (sin adminId) hasta mandar el código; 5 minutos máximo.
   - "Desactivar" pide contraseña y código. Un dueño puede quitársela a otro usuario.
   - Diseño solo con tokens y clases existentes de style.css; sin JS ni estilos en línea.
5. Pruebas: fuerza bruta por cuenta desde IPs distintas (X-Forwarded-For en local con trust proxy),
   TOTP correcto/incorrecto/repetido/vencido, códigos de respaldo de un uso, login sin TOTP igual
   que antes. /security-review sobre la rama.
6. Actualiza el informe, README (variables nuevas, si hubiera) y plans/MEMORIA.md.
```

---

## Prompt 4: pedidos falsos, metadatos de fotos y bitácora (H5, H6, H8, H11)

```
Lee plans/CLAUDE.md, plans/MEMORIA.md, el plan 2026-10-20-seguridad-auditoria-y-endurecimiento.md
y plans/auditorias/2026-10-20-seguridad.md. Trabaja en la rama `seguridad`.

1. server/pedidos.js: máximo 30 piezas y 15 productos por pedido; mismo grupo desde la misma IP en
   10 minutos no se duplica (guarda un hash de IP + clave + items, no la IP); tope global de 500 por
   hora. Si no se guarda, WhatsApp se abre igual (carrito.js ya no espera). En Necutools → Pedidos,
   "Cancelar pendientes de más de 7 días", solo dueños, con confirmación.
2. server/validar.js: limpiar metadatos al subir (JPEG APP1–APP15 y COM; PNG eXIf/tEXt/iTXt/zTXt;
   WebP EXIF y "XMP "; GIF extensiones de comentario) sin dependencias nuevas. Pruebas con fotos
   reales de recursos/fotos-tecnologia/ (que se vean igual y sin EXIF). Migración única
   (tabla migraciones) que limpia las imágenes ya guardadas sin borrar ninguna.
3. Bitácora: tabla bitacora (fecha, admin_id, accion, tabla, registro_id, resumen ≤ 200, sin
   contraseñas ni imágenes). Registrar crear/editar/borrar de tiendas, subcategorías, productos,
   ofertas, promociones, usuarios, pedidos y opiniones; cambios de contraseña y de 2 pasos.
   Pestaña "Bitácora" solo dueños (lectura, 50 por página, filtro por usuario), mismos patrones
   de necutools.js (data-action, escapeHTML).
4. server/api.js: imágenes de productos/tiendas/promociones ocultas → 404 salvo a un admin que
   pueda editarlas (sin caché pública en ese caso).
5. Pruebas de cada punto + baterías anteriores de pedidos y Necutools. /security-review.
6. Actualiza el informe y plans/MEMORIA.md.
```

---

## Prompt 5: frontend, base de datos, Render y documentación (H1, H2, H3, H15)

```
Lee plans/CLAUDE.md, plans/MEMORIA.md, el plan 2026-10-20-seguridad-auditoria-y-endurecimiento.md
y plans/auditorias/2026-10-20-seguridad.md. Trabaja en la rama `seguridad`.

1. Revisa uno por uno los innerHTML de public/js/: todo dato con escapeHTML, atributos entre
   comillas, URLs solo internas o wa.me; si no lleva datos o es texto, usa textContent. Confirma
   que escapeHTML escapa & < > " '. Lista lo revisado en el informe.
2. server/db.js: con DATABASE_SSL=true verifica el certificado (rejectUnauthorized: true). Pruébalo
   contra un PostgreSQL local con SSL; si el certificado de Render no lo permite, documenta la
   excepción y su razón en vez de dejarlo apagado sin aviso.
3. render.yaml: comentario claro en ipAllowList; la IP real la pone el usuario en Render (no a git).
4. public/.well-known/security.txt (RFC 9116) con contacto y fecha de expiración; pregunta al
   usuario qué correo usar.
5. README.md: sección "Seguridad" (qué protege cada capa, cómo correr scripts/seguridad/) y la
   checklist de Render: borrar ADMIN_PASSWORD, restringir IP, rotar SESSION_SECRET si hubo fuga,
   respaldo de la base, activar 2 pasos en los dueños.
6. Corrige cualquier hallazgo del informe que siga abierto y no tenga prompt.
7. /security-review sobre la rama. Actualiza el informe y plans/MEMORIA.md (pendientes 2 y 4 con
   los pasos exactos para el usuario).
```

---

## Prompt 6: verificación final y cierre

```
Lee plans/CLAUDE.md, plans/MEMORIA.md, el plan 2026-10-20-seguridad-auditoria-y-endurecimiento.md
y plans/auditorias/2026-10-20-seguridad.md. Trabaja en la rama `seguridad`.

1. Schema aplicado 3 veces seguidas sin error sobre una copia con datos de los planes anteriores.
2. Corre todo scripts/seguridad/: cada ataque debe fallar con el código esperado.
3. Corre las baterías anteriores (API, carrito → WhatsApp → pedido, Necutools 10 pestañas,
   1280 y 360 px sin scroll horizontal) con cero errores de consola o CSP.
4. Busca en lo nuevo: hex sueltos, degradados, style=", onclick, uppercase, emojis.
5. /security-review sobre toda la rama y npm audit --omit=dev. Corrige o justifica cada punto.
6. Informe final: tabla de hallazgos con estado (corregido / lo hace el usuario en Render / aceptado
   con razón). Plan → `aplicado`. plans/MEMORIA.md con cambios y pendientes.
7. No hagas merge ni push: dile al usuario cómo revisar la rama y que pida "haz merge y push".
```
