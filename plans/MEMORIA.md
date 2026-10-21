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
| `2026-10-17-catalogo-multitienda.md` | Aplicado y subido (fases 1 a 7). Faltan revisar las 2 decisiones de diseño pendientes | 2026-10-17 |
| `2026-10-19-ofertas-temporada-y-resenas.md` | Aplicado y subido (commit + push del 2026-10-19) | 2026-10-19 |
| `2026-10-20-barra-lateral-login-animaciones.md` | Aplicado, probado con el servidor real y subido (commit + push del 2026-10-20) | 2026-10-20 |
| `2026-10-20-dashboard-necutools.md` | Aplicado, probado en local y con commit `c2830ab`. Falta el push (token de `gh` vencido) | 2026-10-20 |
| `2026-10-20-seguridad-auditoria-y-endurecimiento.md` | Aplicado y unido a `main` (commit `8d2e868`, la rama `seguridad` se borró en local). Falta el push de `main` y los pasos de Render | 2026-10-20 |
| `2026-10-20-registro-validacion-y-login.md` | Aplicado, commit `97fd422` en `main` y subido (ya se ve en Render) | 2026-10-20 |

---

## Pendientes

**Para empezar la próxima sesión (cerrado el 2026-10-17):**
- Confirmar que el usuario subió el plan `2026-10-17-catalogo-multitienda.md` (commit + push) y que Render desplegó sin errores (Logs, `/healthz`).
- En Necutools: poner los números de WhatsApp de cada tienda y crear los usuarios de Fer y Aura (encargados).
- Pedir el visto bueno de los pendientes 10 y 11.

1. **Terminar el despliegue en Render: ver la checklist "Pasos pendientes en Render" justo abajo.** Pasos 1, 2 y 4 hechos (2026-10-17); faltan el paso 3 (comprobar la página) y el 5 (seguridad). Si el usuario pregunta "¿qué pasos eran para Render?", responder con esa checklist completa.
2. **(Resuelto 2026-10-20: el usuario borró `ADMIN_PASSWORD`.) Contraseña del admin en Render.** Después del primer despliegue (cuando ya existe el admin), se puede borrar `ADMIN_PASSWORD` de las variables de Render; ya no se usa. Ya hay pantallas para cambiar contraseña ("Mi cuenta") y crear usuarios (pestaña "Usuarios" de Necutools).
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
13. **Ofertas de ejemplo de temporada:** no se agregaron a la base de Render (serían datos falsos). Para verlas, crear en Necutools una oferta "De temporada" (ej. Navidad, del 1 al 25 de diciembre) y un "Remate".
14. **Moderación de opiniones:** el vendedor solo puede responder u ocultar (no borrar). No hay "compra verificada" porque los pedidos se cierran por WhatsApp y no quedan registrados. Tampoco hay todavía "olvidé mi contraseña" para clientes (no hay servicio de correo); si un cliente la olvida, puede crear otra cuenta.
15. **Las piezas del remate no bajan solas:** el vendedor actualiza el número en Necutools cuando vende.
16. **Excepciones de diseño del plan `2026-10-20-barra-lateral-login-animaciones.md`:** el usuario autorizó la barra lateral, el hover que levanta con sombra suave, el zoom leve de imagen, las secciones que aparecen al bajar y las tarjetas escalonadas. Siguen prohibidos los colores nuevos, los degradados y `backdrop-filter`. Si el usuario quiere que esas excepciones sean regla permanente, tiene que pedir que se actualice `plans/CLAUDE.md`.
17. **En esta máquina no hay Node ni servidor de PostgreSQL instalados** (solo el cliente `psql`). Para probar el 2026-10-20 se bajaron Node 22.23.3 (nodejs.org, con su checksum) y PostgreSQL 18.4 (paquete npm `embedded-postgres`) a la carpeta temporal de la sesión. Para correr `npm run dev` aquí hay que instalar Node 22 y PostgreSQL.

18. **Dashboard de Necutools, decisiones por confirmar (plan `2026-10-20-dashboard-necutools.md`):** el usuario pidió correr todo sin detenerse, así que en el prompt 4 no se le preguntó por las excepciones. Se aplicó lo que cumple `plans/CLAUDE.md`: las gráficas **no** se animan al cargar, solo al cambiar tienda o periodo (y nunca con movimiento reducido); los indicadores no cuentan hacia arriba. El menú propio de Necutools sí se hizo (lo implica "rediseñar todo Necutools"). Si quiere la animación al cargar, se cambia `animar` en `renderResumen` (`public/js/necutools.js`).
19. **Subir el dashboard:** commit `c2830ab` hecho; falta el push (el token de `gh` de la cuenta Mor4l3sAx3l04 está vencido: `gh auth login -h github.com` y `git push origin main`). En Render, `npm install` instala `chart.js` solo; la tabla `pedidos` se crea sola al arrancar. Después de desplegar, revisar `/vendor/chart.umd.js` y Necutools → Resumen.
20. **Pedidos que no se cierran:** el pedido se guarda al tocar "Enviar pedido por WhatsApp", aunque el cliente no lo mande en WhatsApp. Por eso "Ventas" solo cuenta los que el vendedor marca como vendidos; los demás se quedan pendientes hasta que alguien los cancele.
21. **Seguridad (plan `2026-10-20-seguridad-auditoria-y-endurecimiento.md`):** unido a `main` el 2026-10-20 (fast-forward a `8d2e868`; la rama local `seguridad` se borró, en GitHub sigue `origin/seguridad`). **Regla del usuario: no crear ramas, trabajar siempre en `main`.** Para publicar: `git push origin main` (también sube el dashboard, pendiente 19). Después, en Render: restringir la IP de la base (pendiente 4), activar los 2 pasos en los dueños y leer en Logs las líneas "Revisión de proxy" (deben decir 1 dirección). Al desplegar, todos tendrán que volver a iniciar sesión una vez (la cookie cambia a `__Host-necutla.sid`). Informe: `plans/auditorias/2026-10-20-seguridad.md`.
22. **Registro y login (plan `2026-10-20-registro-validacion-y-login.md`):** (a) el usuario autorizó usar el verde `--wa` solo para el estado "campo válido" (y para el nivel "súper segura" del medidor y las reglas cumplidas), como excepción a `plans/CLAUDE.md`; si quiere que sea regla permanente, tiene que pedir que se actualice. (b) En producción existen los admins `Axel` (id 1) y `axel` (id 3): mientras existan los dos, el login busca el usuario exacto primero y no se crea el índice único de `lower(usuario)` (el `DO $$` de `db/schema.sql` lo salta). Hay que preguntarle al usuario cuál renombrar o desactivar; al quitar el choque, el índice se crea solo en el siguiente arranque. (c) Falta commit y push.

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
- [x] (hecho, avisado por el usuario el 2026-10-20) Render → `necutla` → **Environment** → borrar `ADMIN_PASSWORD` (el admin ya quedó creado en la base) → *Save changes*.
- [ ] Restringir el acceso a la base: `necutla-db` → **Networking / Access Control** → cambiar `0.0.0.0/0` por tu IP (búscala en https://ifconfig.me) con `/32` al final.
- [ ] Anotar la **fecha de creación de la base**: el plan gratis caduca a los 30 días. Poner recordatorio para respaldarla (pgAdmin → clic derecho en `necutla` → *Backup…*) o pasarla a plan de pago antes.

---

## Cambios hechos

### 2026-10-20: barra lateral pegada al borde y login alineado arriba (`public/style.css`)
- La barra lateral (escritorio) ya no flota: `top`, `bottom` y `left` en 0, sin radio y solo con borde derecho `--linea`. El contenido conserva su separación de 16px (`--side-margen` ahora solo se usa en el `padding-left` del `body`). En celular no cambió (cajón).
- `.auth-entrar` con `justify-content: flex-start`: al crecer el registro, "Iniciar sesión" quedaba centrado con un hueco grande encima (lo mostró la captura del usuario en producción).
- Verificado en local a 1366 y 360px (portada, cuenta, Necutools): barra en 0,0 de alto completo, sin scroll horizontal, sin errores.

### 2026-10-20: registro con usuario y teléfono, validación en vivo y login con usuario o correo (plan `2026-10-20-registro-validacion-y-login.md`, prompts 1 a 5, en `main`)
- **Base** (`db/schema.sql`): `clientes.usuario` (índice único en `lower`), `clientes.pais`, `clientes.telefono` (E.164); `admins.correo` (índice único en `lower`); índice único de `lower(admins.usuario)` solo si no hay choques (pendiente 22). Nulos para las cuentas viejas; no se borró nada.
- **Servidor**:
  - `server/validar.js`: `usuarioValido`, `correoReal` (formato + DNS MX con caché de 1 h; sugerencia de errores de dedo como `gmial.com`; si el DNS no responde, se acepta) y `telefono` (largo por país, devuelve E.164).
  - `public/datos/paises.json`: 32 países con lada y largos válidos; México primero.
  - `server/contrasenas.js`: minúscula, mayúscula, número y carácter especial obligatorios, y `confirmar`.
  - `server/clientes.js`: registro con usuario, país, teléfono y confirmación (409 sin decir si chocó el usuario o el correo); `POST /revisar-correo` (60 por 15 min, no revela si el correo existe); login con `identificador` (usuario o correo); `PUT /password` (cierra la sesión de cliente en otros navegadores); `PUT /completar`; `/sesion` con `usuario` e `incompleta`. El teléfono no sale en ninguna respuesta.
  - `server/auth.js`: login de Necutools con usuario o correo (`buscarAdmin`). Freno por id de cuenta en los dos logins, así cuenta igual con el usuario que con el correo.
  - `server/admin.js`: correo opcional en Usuarios, `PUT /mi-correo` con la contraseña actual, confirmación obligatoria en toda contraseña nueva; usuario repetido sin importar mayúsculas → 409.
- **Frontend**:
  - `public/js/validacion.js` (nuevo): mensajes bajo cada campo, verde al estar bien, medidor débil/media/fuerte/súper segura con la lista de reglas, teléfono con selector de país, sugerencia "Usar …@gmail.com".
  - `public/cuenta.html` y `public/js/cuenta.js`: "Usuario o correo", registro completo, "Completa tu cuenta" para cuentas viejas y "Cambiar contraseña".
  - `public/necutools.html` y `public/js/necutools.js`: "Usuario o correo", correo en Usuarios (y en la tabla), "Repite la contraseña" y medidor en Usuarios y Mi cuenta, tarjeta "Mi correo".
  - `public/style.css` (sección "VALIDACIÓN EN VIVO", solo tokens), `public/iconos.js` (`circle-alert`, `phone`, `at-sign`), `public/js/comun.js` (`api` deja el cuerpo del error en `error.datos`).
- **Docs y pruebas**: `README.md` y `.env.example` (`CORREO_DNS_PRUEBA`, solo desarrollo); `scripts/seguridad/ataques.js` con 41 pruebas nuevas y las contraseñas de prueba con las reglas nuevas.
- **Revisión de código** (`/code-review medium`, 10 puntos, todos corregidos):
  - Los errores de dedo ya no bloquean: si el dominio recibe correos (ymail.com, email.com, hotmail.fr) solo se sugiere el otro. Sin MX se acepta si el dominio tiene A/AAAA (RFC 5321).
  - El correo se revisa en el servidor solo al salir del campo, no en cada tecla, por la IP compartida de la escuela.
  - Si la lista de países no carga, queda México.
  - Un admin cuyo usuario lleva `@` sigue entrando.
  - Al editar un usuario, su correo solo se manda si cambió.
  - La contraseña de admin tampoco puede llevar la parte del correo antes de la @.
  - Columna `clientes.sesion_version`: al cambiar la contraseña, una sesión vieja que se vuelva a guardar ya no vale.
  - Letras de cualquier idioma (ç, ß) cuentan como letras.
  - El login de clientes usa dos consultas fijas en vez de meter el nombre de la columna en el SQL.
- **Verificación** (servidor real local + `embedded-postgres` en el puerto 54329, nunca Render):
  - Ataques 225 de 225; XSS 44; UI de seguridad 36; Necutools 95; p1 9; p2 34.
  - Nuevas en navegador: registro 41, Necutools 25 y cuenta vieja 8. La carrera de sesiones al cambiar la contraseña se probó volviendo a guardar la sesión vieja a mano: queda fuera.
  - Schema aplicado 3 veces seguidas sin error. El caso `Caso`/`caso` se probó con el índice quitado: cada uno entra con su usuario exacto y en mayúsculas da 401.
  - DNS real probado con gmail.com, unam.mx, dominios inventados y errores de dedo.
  - Cero errores de consola o CSP, y a 360px sin scroll horizontal.
  - Sin hex sueltos, degradados, `style="`, `onclick`, `uppercase` ni emojis. `npm audit` 0.
- **Desviaciones**:
  - El prompt 2 no se detuvo a preguntar por `Axel`/`axel` (el usuario pidió no parar). Se resolvió sin tocar producción: el índice solo se crea sin choques y el login busca el usuario exacto primero (pendiente 22).
  - El botón de enviar no deshabilita nada. Si el foco va directo al botón, el campo no se repinta al salir, para que el mensaje no mueva el botón y no se pierda el clic.
  - No hay "olvidé mi contraseña" (no hay servicio de correo; pendiente 14).

### 2026-10-20: plan de registro, validación en vivo y login con usuario o correo
- Nuevo plan `plans/planes/2026-10-20-registro-validacion-y-login.md` y sus 5 prompts en `plans/prompts/` (mismo nombre). No se cambió código.
- Pedido del usuario: registro con usuario, teléfono con lada por país y correo; errores bajo cada campo y verde cuando es válido; medidor débil/media/fuerte/súper segura; mayúscula, minúscula, número y carácter especial obligatorios en toda contraseña nueva, con confirmación; login con usuario o correo en un solo campo (tienda y Necutools).
- Decisiones del usuario: cualquier dominio de correo real (revisión DNS MX), verde `--wa` para lo válido (pendiente 22), usuario único además del nombre visible, teléfono obligatorio y privado.

### 2026-10-20: usuarios de Necutools en producción y pgAdmin en el puerto 8080
- A pedido del usuario se crearon en la base de Render los admins `vladi` (id 2) y `axel` (id 3), ambos dueños. Ya existía `Axel` (id 1, con mayúscula; el login distingue mayúsculas). Las contraseñas se dieron en el chat y cada uno debe cambiarla en Mi cuenta. No se guardaron en ningún archivo.
- pgAdmin web no abría porque el Apache de XAMPP ocupa el puerto 80 y el `apache2` del sistema estaba apagado. Se cambió `/etc/apache2/ports.conf` a `Listen 8080` (copia en `ports.conf.antes-8080`) y se arrancó: ahora es http://localhost:8080/pgadmin4. `apache2` sigue sin arrancar solo al prender la máquina (`systemctl start apache2`).

### 2026-10-20: auditoría de seguridad y endurecimiento (plan `2026-10-20-seguridad-auditoria-y-endurecimiento.md`, prompts 1 a 6, rama `seguridad`)

Informe completo con hallazgos, evidencia y estado: `plans/auditorias/2026-10-20-seguridad.md`.

- **Auditoría** (prompt 1): OWASP Top 10 y ASVS 2 ruta por ruta; pruebas de ataque repetibles en `scripts/seguridad/ataques.js` (solo localhost); XSS en navegador. Lo que ya existía resistió: SQLi, IDOR entre encargados, CSRF, sesión, archivos privados, XSS. Se encontraron 21 hallazgos (H1–H21); ninguno crítico en el código.
- **Entrada y cabeceras** (`server/index.js`): 20 KB de JSON (2 MB solo al subir imágenes), `Sec-Fetch-Site`, `Permissions-Policy`, `noindex` en Necutools y `/api`, `no-store` en lo privado, `/.well-known/security.txt`, registro "Revisión de proxy".
- **Sesión** (`server/auth.js`, `server/clientes.js`): cookie `__Host-necutla.sid` en producción, id nuevo al entrar y al salir, 24 h máximas, el servidor no arranca en Render sin `NODE_ENV=production`.
- **Cuentas**: `server/intentos.js` (10 fallos frenan la cuenta 15 min, tabla `intentos_login`), `server/contrasenas.js` (72 bytes, comunes, sin usuario; cliente 10 caracteres), registro sin bcrypt para correos repetidos y 409 contados.
- **Verificación en dos pasos** opcional (`server/totp.js`, rutas `/api/auth/login/codigo` y `/api/admin/2fa/*`, columnas `totp_*` en `admins`): Necutools → Mi cuenta; códigos de respaldo; el dueño la quita en Usuarios.
- **Pedidos** (`server/pedidos.js`): 30 piezas y 15 productos máximo, sin duplicados en 10 minutos (columna `huella`), 500 por hora, "Cancelar pendientes de más de 7 días".
- **Imágenes**: `server/imagenes.js` quita GPS y metadatos (JPEG conserva la orientación) y limpió una vez las ya guardadas (migración `2026-10-20-imagenes-sin-metadatos`, sin borrar ninguna). Las de lo oculto dan 404 al público (`server/api.js`); paquetes con algo oculto ya no se venden.
- **Bitácora** (`server/bitacora.js`, tabla `bitacora`, pestaña "Bitácora" solo dueños, icono `history`).
- **Base**: `DATABASE_SSL=true` verifica el certificado; `no-verify` aparte (`server/db.js`, README, `.env.example` explica `no-verify`).
- `render.yaml` y `README.md` (sección "Seguridad" con la checklist de Render).
- **Verificación**: ataques 184 de 184, XSS 44 de 44, UI nueva 36 de 36, baterías anteriores 9 + 34 + 95 sin fallas, cero errores de consola o CSP, `/security-review` sin vulnerabilidades, `npm audit` 0. Detalle en el informe.
- **Desviaciones**: `/code-review max` se cortó por el límite de uso y no se repitió; el secreto TOTP va sin cifrar en la base; `security.txt` apunta a los avisos privados de GitHub en vez de un correo.

### 2026-10-20: plan de auditoría de seguridad y endurecimiento
- Nuevo plan `plans/planes/2026-10-20-seguridad-auditoria-y-endurecimiento.md` y sus 6 prompts en `plans/prompts/` (mismo nombre). El usuario pidió revisar la página como experto en ciberseguridad con una skill y dejarla lo más segura posible.
- Skills elegidas: `/security-review` (revisa el diff de la rama contra `main`, por eso se trabaja en la rama `seguridad`) y `/code-review max <carpeta>` para auditar el código que ya existe. Además, pruebas de ataque propias en `scripts/seguridad/` y un informe en `plans/auditorias/`.
- Revisión preliminar: SQL parametrizado, CSP, sesión, CSRF y permisos están bien; `npm audit` sin vulnerabilidades; `.env` nunca entró a git. 15 hallazgos (H1–H15), los más graves de configuración en Render (base abierta, `ADMIN_PASSWORD`). No se cambió código.

### 2026-10-20: dashboard de Necutools con pedidos y gráficas (plan `2026-10-20-dashboard-necutools.md`, prompts 1 a 6)

**Base y servidor**
- `db/schema.sql`: tabla `pedidos` (tienda o paquete, `items` JSONB con precios del servidor, total, piezas, estado pendiente/vendido/cancelado, nota) con 2 índices. Sin datos del cliente.
- `server/api.js`: el cuerpo de `POST /carrito/precios` pasó a `calcularCarrito(items)` (misma respuesta; se exporta con `leerCarrito`).
- `server/pedidos.js` (nuevo): `POST /api/pedidos` (recalcula el grupo con `calcularCarrito`, 40 por hora por IP); `GET /api/admin/pedidos` (estado, tienda, 20 por página, contador de pendientes), `PUT /api/admin/pedidos/:id` (estado y nota) y `GET /api/admin/resumen?dias=7|30|90&tienda=` (indicadores contra el periodo anterior, serie diaria en hora de CDMX, por tienda, por estado, 5 productos más pedidos, 5 recientes y "Por hacer"). Encargados: solo sus tiendas; paquetes: solo dueños. `requireAdmin` por ruta para no cargar la sesión dos veces.
- `server/index.js`: monta los routers y sirve `/vendor/chart.umd.js` desde `node_modules/chart.js/dist` (el paquete no exporta ese archivo: la ruta se arma desde su `main`).
- `package.json` / `package-lock.json`: `chart.js` 4.4.7 exacto (trae `@kurkle/color`).

**Frontend**
- `public/js/carrito.js`: registra el pedido al abrir WhatsApp, sin bloquear y una sola vez por grupo; línea "Guardamos el pedido sin tus datos…" (`.cart-privacidad`).
- `public/necutools.html`: las pestañas pasaron a un menú vertical `.dash-nav` (mismo `#admin-tabs`, `data-action="panel"`, `data-panel`, `data-solo-dueno`) con iconos y contadores (pedidos pendientes, opiniones sin responder); encabezado con el título de la sección, saludo, selectores de tienda y periodo (solo en Resumen y Pedidos), "Ver el sitio" y "Cerrar sesión"; paneles nuevos **Resumen** (abre primero) y **Pedidos**. Las 7 pestañas de antes no cambiaron por dentro.
- `public/js/necutools.js`: `renderResumen`, `renderGraficas`, `renderPedidos`, `renderContadores`, filtros y acciones de pedidos (vendido, cancelar con confirmación, volver a pendiente, nota). `recargar` siempre refresca el resumen. `mostrarPanel` alterna `.ghost` en lugar de `.secondary`.
- `public/js/graficas.js` (nuevo): `graficaLinea`, `graficaDona`, `graficaBarras` con colores de los tokens, tooltips en `--tinta`, línea monótona sin relleno, tabla oculta con los datos y sin animación con movimiento reducido.
- `public/iconos.js`: `layout-dashboard`, `receipt`, `trending-up`, `trending-down`, `chart-column`, `circle-check`, `clipboard-list`.
- `public/style.css`: sección "NECUTOOLS: DASHBOARD" (`.dash`, `.kpi`, `.dash-grid`, `.grafica`, estados de pedido). Solo tokens existentes.
- `README.md`: pedidos, privacidad y Chart.js.

**Desviaciones del plan**
- El menú pasa a fila horizontal a ≤ 992px (no a 860px): entre 860 y 992 no cabía con los formularios de 2 columnas.
- No se hizo una página de prueba aparte para Chart.js: se probó directo en Necutools.
- No se preguntó por la animación al cargar (ver pendiente 18).

**Verificación** (servidor real con Node 22.23.3 + PostgreSQL 18.4 de `embedded-postgres` en el puerto 54329, nunca Render; Chrome sin ventana con `puppeteer-core`)
- Schema aplicado 3 veces seguidas sin error.
- 10 pruebas de `POST /api/pedidos`: precio del navegador ignorado, 400 con clave inválida o ajena, 403 sin Origin, 429 al pasar 40 por hora y `/carrito/precios` igual que antes.
- 34 pruebas de la API de administración: 401 sin sesión, estados y notas inválidos, 404, números del resumen que cuadran con pedidos en 4 días distintos, filtros, encargado sin tiendas ajenas ni paquetes.
- 95 pruebas en navegador: carrito → WhatsApp → pedido guardado (sin duplicar); las 9 pestañas a 1280 y 360px sin scroll horizontal; marcar vendido, nota, filtros y "Ventas" que cambia; crear y borrar un producto; animación solo al cambiar el periodo; movimiento reducido sin animación; portada, carrito, promociones, cuenta, producto y tienda sin scroll horizontal; **cero errores de consola o de CSP**.
- Sin hex sueltos, degradados, `backdrop-filter`, `style="`, `onclick`, `uppercase` ni emojis en lo nuevo.
- Se volvió a topar el límite de 300 peticiones cada 15 min por IP (pendiente 12) al correr las pruebas seguidas.

### 2026-10-20: plan del dashboard de Necutools
- Nuevo plan `plans/planes/2026-10-20-dashboard-necutools.md` y sus 6 prompts en `plans/prompts/` (mismo nombre). Se basa en el reel de Instagram de code.xr "Dashboard V14 — Modern & Minimal UI" (DeoxA_vzRbo); solo se pudo leer el texto del post, no los cuadros del video.
- Decisiones del usuario: rediseñar todo Necutools sin quitar nada (menú vertical, encabezado, paneles nuevos Resumen y Pedidos); **registrar pedidos** al tocar "Enviar pedido por WhatsApp" (tabla `pedidos`, sin datos personales, estados pendiente/vendido/cancelado); gráficas con **Chart.js** servido desde el propio servidor. No se cambió código.

### 2026-10-20: caché de CSS y JS después de desplegar (`server/index.js`)
- Problema que vio el usuario en producción justo después del push del plan de la barra lateral: la barra salió sin estilos, con el HTML nuevo pero el `style.css` y el `comun.js` viejos de la caché del navegador.
- Causa: los estáticos se servían con `Cache-Control: max-age=3600`, así que el navegador podía usarlos hasta 1 hora sin preguntar.
- Corrección: HTML, CSS y JS ahora van con `no-cache` (el navegador revalida con ETag y recibe 304 si no cambiaron); las imágenes siguen con 1 hora.
- Verificado en local: cabeceras correctas, 304 al revalidar y 70 de 70 pruebas de API.

### 2026-10-20: barra lateral, login con panel deslizante y animaciones (plan `2026-10-20-barra-lateral-login-animaciones.md`, prompts 1 a 5)

Excepciones a `plans/CLAUDE.md` autorizadas por el usuario solo para este plan: barra lateral, hover que levanta con sombra suave, zoom leve de imagen, secciones que aparecen al bajar y tarjetas escalonadas. `plans/CLAUDE.md` no se tocó.

- **Tokens** (`public/style.css`, `:root`): `--t-media`, `--t-lenta`, `--t-panel`, `--sombra-1`, `--sombra-2` y `--velo` (fondo del cajón). Los tres últimos son `--tinta` con transparencia, no colores nuevos.
- **Iconos** (`public/iconos.js`): `menu`, `house`, `mail`, `lock`, `eye` y `log-in`.
- **Barra lateral** en las 7 páginas (`index`, `tienda`, `producto`, `carrito`, `promociones`, `cuenta`, `necutools`), en lugar de `site-navbar`:
  - Mide 76px cerrada y 264px con hover o foco, y se abre encima del contenido.
  - Lleva marca, buscador (`/?q=`), Inicio, Tiendas, Promociones, Carrito con contador, Mi cuenta y Necutools.
  - **Submenú de Tiendas** con las tiendas de la base: se abre con hover, clic, Enter o →, y se cierra con Escape o ←.
  - **≤ 860px:** barra superior con carrito y botón "Abrir menú", y cajón con foco atrapado. Tiendas entra como un segundo panel con "Volver al menú" (desviación del plan: era un acordeón).
  - JS en `public/js/comun.js` (`initBarraLateral`). La portada (`js/portada.js`) busca con `?q=` y con el buscador de la barra sin recargar. El contador del carrito se oculta en 0 (`.is-cero`).
- **Hover:**
  - Tarjetas: suben 4px con `--sombra-1`, y su imagen hace zoom 1.04.
  - Botones: suben 2px sobre un escalón plano y bajan al presionar; el icono se desliza.
  - Enlaces: el subrayado aparece al pasar el mouse.
  - Filas del tablero: el nombre y la flecha se deslizan.
- **Entradas:**
  - `comun.js` pone `.anim` en `<html>` (solo con JS y sin movimiento reducido).
  - Un `IntersectionObserver` revela los bloques (`.revelar`) y escalona los hijos de los grids (`.revelar-grid`, `:nth-child`). Un `MutationObserver` anima lo que llega después de la API.
- **Login** (`public/cuenta.html`, `public/js/cuenta.js`):
  - Tarjeta `.auth` con los dos formularios y un panel `--tinta` con una ciudad plana en SVG. El panel se desliza al otro lado (0.65s).
  - El formulario que no se ve queda `inert`. `#crear-cuenta` abre el registro.
  - Campos con icono y botón para ver la contraseña.
  - En celular, el panel va arriba y los formularios cambian de lado a lado.
  - Se conservaron los `id` y `name` de los campos y la lógica de entrar, crear cuenta, salir y `?volver=`.
- Se quitaron los estilos de la barra vieja (`.site-navbar`, `.nav-actions`, `.nav-btn`) y de `.cuenta-grid`.

**Verificación**: primero con una API simulada en Python (misma CSP), y después con el **servidor real** (`server/index.js`, Node 22.23.3) contra un PostgreSQL 18.4 de prueba en el puerto 54329, nunca contra Render. Se usaron el Chrome del usuario y Chrome sin ventana.
- **70 pruebas de API**, todas bien:
  - Las 7 páginas con la barra lateral, CSP y sin `style=` ni `onclick`; 404 para `plans/`, `.env`, `server/` y `package.json`; redirección de las direcciones viejas.
  - Tiendas con icono y descripción, búsqueda y carrito con precios del servidor; 403 sin Origin o con Origin ajeno.
  - Registro, login (correo sin importar mayúsculas), logout, opiniones (sin enlaces, 401 sin sesión) y promedio.
  - Necutools: login, crear y borrar producto, opiniones y las sesiones de cliente y admin juntas.
- **Flujos en navegador con el servidor real:**
  - Agregar al carrito y el contador.
  - Botón de WhatsApp (abre `wa.me` con el número de la tienda y aparece "Ya lo envié").
  - Crear cuenta con `?volver=` (regresa al producto) → publicar opinión → cerrar sesión.
  - Necutools: login y sus 7 pestañas, sin errores.
- 7 páginas a 1280px y 360px: cero errores de consola o de CSP y sin scroll horizontal a 360px.
- Barra:
  - Con mouse, el panel de Tiendas abre y cierra.
  - Con teclado, → enfoca la primera tienda y Escape cierra y regresa el foco.
  - En celular, el cajón y el panel de tiendas funcionan, y dos Escape lo cierran todo con el foco de vuelta en "Abrir menú".
- Login: cambio con el panel, foco en el primer campo, ver contraseña, crear cuenta, cerrar sesión y `#crear-cuenta`.
- `prefers-reduced-motion: reduce`: no se pone `.anim`, no se oculta nada y no hay desplazamientos.
- El contador del carrito se oculta en 0 y aparece al agregar.
- Sin hex sueltos, degradados, `backdrop-filter`, `style="`, `onclick` ni emojis nuevos.

### 2026-10-20: plan de barra lateral, login deslizante y animaciones
- Nuevo plan `plans/planes/2026-10-20-barra-lateral-login-animaciones.md` y sus 5 prompts en `plans/prompts/` (mismo nombre). Se basa en dos publicaciones de @frontendjoe: "CSS Sidebars Part 11" (DeVERjTgMRE) y "React Logins Part 13" (DejrmYrABU7).
- Decisiones del usuario: barra lateral como la del post, con el submenú "Tiendas" al pasar el mouse; animaciones "más notorias" (hover con sombra y entradas al bajar); login con el panel deslizante, pero con colores de Necutla. No se cambió código.

### 2026-10-19: ofertas de temporada, remates, cuentas de cliente y opiniones (plan `2026-10-19-ofertas-temporada-y-resenas.md`)

Pedido del usuario: ver hasta abajo las ofertas de temporada ("Temporada de Navidad" con camisas al 30%, chocolates…), que el vendedor marque cada oferta como de temporada, semanal o remate, y calificaciones con comentarios por producto. Decisión del usuario: opinar requiere **cuenta de cliente**.

**Base de datos** (`db/schema.sql`, idempotente; probado 2 veces seguidas sobre el esquema anterior con ofertas existentes: quedan como `semanal`)
- `ofertas`: `clase` (semanal/temporada/remate), `temporada`, `inicio`, `fin`, `piezas`, con restricciones.
- Tablas nuevas `clientes` (correo único sin importar mayúsculas, bcrypt) y `resenas` (una por cliente y producto, 1 a 5, comentario ≤ 500, respuesta del vendedor, `visible`).

**Servidor**
- `server/ofertas.js`: una oferta aplica si está activa, hoy es uno de sus días y la fecha cae entre inicio y fin (`VIGENTE_HOY`, `vigenteHoy`). La tarjeta trae clase, temporada, fin, piezas y % de ahorro.
- `server/api.js`: `/api/vitrina[?tienda=slug]` (bloques: uno por temporada, "semanal" de hoy y remates; máx. 12 por bloque), `/api/productos/:id` (detalle), calificación promedio y total en todas las tarjetas; tienda, portada y carrito ya respetan fechas.
- `server/clientes.js` (nuevo): `/api/clientes/sesion|registro|login|logout`; límites: 10 logins fallidos / 15 min, 30 registros por hora por IP (holgado por la IP compartida de la escuela). La sesión de cliente y la de Necutools conviven en el mismo navegador (`server/auth.js` ya no borra una al entrar o salir de la otra).
- `server/resenas.js` (nuevo): leer opiniones (resumen, distribución, orden recientes/mejores, 10 por página), escribir/editar/borrar la propia; sin enlaces en el comentario; 30 escrituras por hora por IP.
- `server/admin.js`: validación de clase/temporada/fechas/piezas; `/api/admin/resenas` (lista por tiendas del admin) y `PUT /api/admin/resenas/:id` (responder y ocultar; no hay borrar).
- `server/index.js`: `/p/:id` sirve `producto.html`.

**Frontend**
- Portada: la lista "Ofertas de hoy" de arriba se cambió por la sección **"Ofertas de temporada, de hoy y remates" al final**, con tarjetas de producto (6 visibles y "Mostrar N más"). La tienda tiene la misma sección al final, solo con sus productos.
- Tarjetas (`comun.js`): estrellas y número de opiniones, nombre e imagen llevan a `/p/<id>`, "Temporada de Navidad · Hasta el 25 de diciembre", "Quedan 3 piezas", "Ahorras 30%". Etiqueta de remate invertida (texto `--senal` sobre `--tinta`).
- Páginas nuevas: `producto.html` + `js/producto.js` (detalle, resumen con barras, lista paginada, formulario de estrellas, editar/borrar la propia) y `cuenta.html` + `js/cuenta.js` (entrar, crear cuenta, cerrar sesión; `?volver=` regresa al producto).
- Enlace "Cuenta" en la barra y "Mi cuenta" en el pie de todas las páginas. Iconos nuevos: `star`, `star-fill`, `user`.
- Necutools: el formulario de ofertas tiene "Clase de oferta" (semanal muestra días; temporada pide nombre de una lista u "Otra" y fechas; remate pide fecha límite y piezas opcionales), columna "Cuándo", estado "Vencida" y filtro por clase. Pestaña nueva **Opiniones** para responder y ocultar.

**Verificación** (PostgreSQL 17 de prueba en el puerto 54329 + Edge sin ventana; nunca contra Render)
- 87 pruebas de API: validaciones de ofertas, vigencia por fecha (vencidas y futuras fuera), vitrina por bloques y por tienda, precios del carrito (temporada, 2x1, remate), registro/login/logout, 401/403/409, opiniones (límites, enlaces, una por cliente, promedio, orden, ocultas fuera del promedio), permisos del encargado, sesiones de cliente y admin juntas.
- 66 pruebas en navegador: portada, tienda, producto, cuenta, carrito, promociones y Necutools sin errores de consola ni de CSP; flujo completo de crear cuenta → opinar → editar → respuesta del vendedor visible; 360px sin scroll horizontal en todas.
- Se confirmó en las pruebas el pendiente 12: correr las dos baterías seguidas desde una IP pasa de 300 peticiones en 15 min.

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
