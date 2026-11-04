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
| `2026-10-20-servicios-por-tienda.md` | Aplicado y con commit en `main`. Falta el push | 2026-10-20 |
| `2026-10-21-colores-por-producto.md` | Aplicado, probado en local y subido a GitHub (`762ff7f`). Render todavía no lo despliega (ver pendiente 23e) | 2026-10-21 |
| `2026-10-25-migracion-ionos-php-mariadb.md` | Aplicado: el sitio vive en https://necutla.com desde el 2026-10-30. Falta apagar Render (pendiente 25d) | 2026-10-25 |
| `2026-10-25-php85-y-puntos-debiles.md` | Aplicado (PHP 8.5 y puntos débiles de la revisión) | 2026-10-25 |
| `2026-10-26-ionos-sin-https-y-cuentas-en-pausa.md` | Aplicado (prompts 1 y 2). Cuentas reactivadas el 2026-10-29 y HTTPS con `necutla.com` el 2026-10-30 | 2026-10-26 |
| `2026-10-26-pedidos-estados-y-stock.md` | Aplicado, probado en local y subido a IONOS (tablas creadas allá). Falta capturar el stock (pendiente 26) | 2026-10-26 |
| `2026-10-31-mi-cuenta-alto-y-luces.md` | Aplicado y subido a IONOS (2026-10-31) | 2026-10-31 |
| `2026-10-30-codigo-por-correo-y-sesion-permanente.md` | Aplicado (prompts 0 a 5), probado en local y en vivo, subido a IONOS. Commit del 2026-10-30 en `main`; falta el push (token de `gh` vencido) | 2026-10-30 |
| `2026-10-30-vista-previa-por-tienda.md` | Aplicado y subido a IONOS (2026-10-30). Falta probar en WhatsApp (pendiente 27b) | 2026-10-30 |
| `2026-10-29-reels-esqueletos-botones-open-graph.md` | Aplicado, commit `d4a3289` en GitHub y subido a IONOS (2026-10-29). Falta probar el enlace en WhatsApp (pendiente 27) | 2026-10-29 |
| `2026-10-31-seguridad-turnstile-y-cloudflare-aparte.md` | Aplicado (prompts 1 a 7) y subido a IONOS. Falta que el usuario pruebe el captcha en su navegador (pendiente de abajo) | 2026-10-31 |
| `2026-10-31-seo-iconos-contenido-y-legal.md` | Aplicado (prompts 1 a 7) y subido a IONOS. Faltan los `[COMPLETAR]` del aviso y los términos, y Search Console (pendiente de abajo) | 2026-10-31 |
| `2026-10-31-fotos-tiendas-portada.md` | Aplicado (prompts 1 a 4) y subido a IONOS. Falta que el usuario revise las 7 fotos | 2026-10-31 |
| `2026-11-01-whatsapp-emojis-y-mensaje-vistoso.md` | Aplicado (prompts 0 a 4) y subido a IONOS. Falta que el usuario pruebe en WhatsApp Web y en el celular | 2026-11-01 |
| `2026-11-01-avisos-y-confirmaciones-propios.md` | Aplicado (prompts 0 a 4) y subido a IONOS. Falta que el usuario lo revise en su navegador | 2026-11-01 |
| `2026-11-04-cumplimiento-legal-cuenta-y-edad.md` | Aplicado y subido a IONOS (2026-11-04). Faltan los `[COMPLETAR]` y revisar 2 frases de la portada | 2026-11-04 |
| `2026-11-04-filtro-groserias.md` | Aplicado (prompts 1 a 3) y subido a IONOS | 2026-11-04 |

---

## Pendientes

**Filtro de groserías (2026-11-04, aplicado y subido):** (a) la lista está en `app/groserias.php`; si un vendedor o cliente reporta que una palabra normal se bloquea, quitarla o pasarla de `GROSERIAS_RAICES` a `GROSERIAS_PALABRAS` y volver a correr las pruebas unitarias (132 frases, ver el plan). (b) No se tapan ni se dice qué palabra fue: el texto se rechaza completo. (c) Lo que ya estaba publicado en IONOS se revisó: 0 de 123 textos.

**Casilla de edad, eliminar cuenta y textos legales (2026-11-04, aplicado y subido):** (a) (Resuelto 2026-11-04: subido a IONOS, ver "Cambios hechos".) (b) **Faltan los `[COMPLETAR]`**: nombre del responsable y domicilio (o ciudad y estado) en `public/privacidad.html:101`, y ciudad o estado para controversias en `public/terminos.html`. Las fechas ya dicen 4 de noviembre de 2026. (c) **Frases de la portada por revisar con el usuario** (no se cambiaron): el horario "Lun a sáb, 8:00 a 20:00" del tablero (¿lo cumplen todas las tiendas?) y "las opiniones de otros estudiantes" en "Qué es Necutla" (opina cualquiera con cuenta, sin compra verificada). (d) Los 2 clientes reales verán "Completa tu cuenta" con la casilla la próxima vez que entren. (e) Quedan en la base local 28 clientes `@prueba.local` del 2026-10-31 (de una corrida vieja de `ataques.js`, no de esta sesión).

**Avisos y confirmaciones propios (2026-11-01, aplicado):** (a) el usuario revisa en su navegador (compu y celular) cancelar un pedido, marcarlo pagado, la nota y un error en Necutools, y vaciar el carrito. (b) **Excepción de diseño:** la sombra `--sombra-2` de la ventana `.dialogo` la autorizó el usuario solo para este plan; si quiere que sea regla, que pida actualizar `plans/CLAUDE.md`. (c) (Resuelto 2026-11-01: ya se desvanece al cerrar.) Subido a IONOS.

**Emojis en WhatsApp y mensaje nuevo (2026-11-01, aplicado):** (a) el usuario manda un pedido y una solicitud de servicio de prueba por WhatsApp Web y por el celular, y confirma que los emojis se ven y que el mensaje le gusta. (b) Si algún día WhatsApp también rompe `api.whatsapp.com/send`, la otra opción en compu es `web.whatsapp.com/send?phone=…&text=…`.

**Fotos de Unsplash en la portada (2026-10-31, aplicado):** el usuario revisa las 7 fotos en necutla.com y dice cuál cambiar; hay una de respaldo por tienda en `recursos/fotos-unsplash/creditos.md` (ahí está cómo cambiarla). Una tienda nueva no tiene foto (se ve su imagen de relleno) hasta agregarla a `FOTOS_TIENDAS` en `public/js/portada.js`, o hasta que suba su portada en Necutools.

**SEO, iconos, contenido y legal (2026-10-31, aplicado):** (a) **Llenar los `[COMPLETAR]`** de `public/privacidad.html` (responsable, domicilio, fecha, si se permiten cuentas de menores) y `public/terminos.html` (fecha, ciudad o estado) y volver a subirlos; si se puede, que lo lea alguien que sepa de derecho. (b) Revisar el texto nuevo de la portada ("Qué es Necutla", "Cómo funciona", "Preguntas frecuentes": dice que el pago puede ser en efectivo o por transferencia y que para abrir una tienda se escribe a tienda@necutla.com). (c) Google Search Console: propiedad `https://necutla.com` (prefijo de URL), verificación por archivo HTML (pasarle a Claude solo el nombre del archivo para subirlo a `public/`) y enviar `sitemap.xml`. Opcional: Bing Webmaster Tools. (d) Probar "Agregar a inicio" en un celular. (e) Volver a pasar el revisor de IONOS: la CDN seguirá marcada a propósito (no se activa: solo funciona en `www`). (f) **Excepción técnica por confirmar:** `theme-color` y `site.webmanifest` llevan el hex de `--tinta` y `--gis` (no leen variables CSS). (g) Si cambian las tiendas o los productos, el sitemap se actualiza solo (caché de 1 hora).

**Seguridad, Turnstile y Cloudflare aparte (2026-10-31, aplicado):** (a) Cloudflare va **aparte, sin tocar nada de IONOS** (decisión del usuario): solo Turnstile y Web Analytics, **sin protección DDoS de Cloudflare**; el escudo completo (nameservers) queda para un plan futuro. (b) Probar en el navegador del usuario (celular y compu) entrar, crear cuenta, "¿Olvidaste tu contraseña?", opinar y mandar un pedido: Turnstile real rechaza a Chrome automatizado, así que en vivo solo se probó que el servidor rechaza sin token o con token falso. (c) Necutools → Mi cuenta → Servidor (solo dueños): confirmar que "Progreso de subidas de PHP" diga apagado (que IONOS lee `public/.user.ini`). (d) Pedir a IONOS por ticket MariaDB 11.8.9 o más nueva (hoy 11.8.8). (e) Ver las visitas en Cloudflare → Web Analytics (tarda unos minutos en mostrar datos). (f) **Excepción de diseño por confirmar:** el recuadro de Turnstile es un iframe de Cloudflare que no usa los tokens; con `interaction-only` casi nunca se ve. (g) Si se cambia el `secreto` de `app/config.php`, los dueños con 2 pasos tienen que volver a activarla (la llave del cifrado sale del secreto). (h) No se agregó ningún aviso de "contamos visitas" en la página (Web Analytics no usa cookies); si se quiere, es una línea en el pie.

**Mi cuenta (2026-10-31):** excepción de diseño autorizada por el usuario solo para el panel de los edificios de Mi cuenta: algunas ventanas parpadean solas a ratos (no es respuesta a una acción). Si quiere que sea regla, que pida actualizar `plans/CLAUDE.md`.

**Del código por correo (2026-10-30):** (a) excepción de diseño: el brillo verde del código correcto (`--brillo-wa`) lo autorizó el usuario solo para el plan `2026-10-30-codigo-por-correo-y-sesion-permanente.md`; si quiere que sea regla, que pida actualizar `plans/CLAUDE.md`. (b) Los 2 clientes reales necesitan su correo para entrar; si no lo tienen, "¿Olvidaste tu contraseña?" tampoco les sirve. (c) Si el SMTP falla, nadie entra ni se registra (503 con mensaje claro); se puede volver a la pausa con `cuentas_clientes` en false. (d) `scripts/seguridad/ataques.js` se adaptó (11 pruebas nuevas "OTP" y entrar/registrar con código), sin correrlo: no hay Node; la sintaxis se revisó con Chrome. (e) Probar desde un correo de Gmail o Hotmail que el código no caiga en spam (SPF, DKIM s1/s2 y DMARC `p=none` ya están en el DNS).

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
11. **(Resuelto 2026-10-25: el usuario dio permiso y se actualizaron las secciones 1 y 4.)** **`plans/CLAUDE.md` desactualizado:** la sección 1 todavía dice que son 7 tiendas fijas con carpetas propias y que Necutools es una sección de `index.html`. Solo se puede corregir si el usuario lo pide.
12. **Límite de peticiones a la API:** 300 cada 15 minutos por IP. Si muchos estudiantes entran desde la misma red de la escuela (misma IP), podrían toparse con el límite. Vigilar y subirlo en `server/index.js` si pasa.
13. **Ofertas de ejemplo de temporada:** no se agregaron a la base de Render (serían datos falsos). (Excepción del 2026-10-20: el usuario pidió **servicios** de ejemplo en todas las tiendas y esos sí se cargan solos en Render; cada vendedor los edita o borra en Necutools.) Para verlas, crear en Necutools una oferta "De temporada" (ej. Navidad, del 1 al 25 de diciembre) y un "Remate".
14. **(Actualizado 2026-10-30: ya hay "¿Olvidaste tu contraseña?" con código por correo.)** **Moderación de opiniones:** el vendedor solo puede responder u ocultar (no borrar). No hay "compra verificada" porque los pedidos se cierran por WhatsApp y no quedan registrados. Tampoco hay todavía "olvidé mi contraseña" para clientes (no hay servicio de correo); si un cliente la olvida, puede crear otra cuenta.
15. **Las piezas del remate no bajan solas:** el vendedor actualiza el número en Necutools cuando vende.
16. **Excepciones de diseño del plan `2026-10-20-barra-lateral-login-animaciones.md`:** el usuario autorizó la barra lateral, el hover que levanta con sombra suave, el zoom leve de imagen, las secciones que aparecen al bajar y las tarjetas escalonadas. Siguen prohibidos los colores nuevos, los degradados y `backdrop-filter`. Si el usuario quiere que esas excepciones sean regla permanente, tiene que pedir que se actualice `plans/CLAUDE.md`.
17. **(Actualizado 2026-10-20: ya hay Node 22.20 y PostgreSQL 17 en `C:\Program Files\PostgreSQL\17`; con ellos se probó el plan de servicios.)** **En esta máquina no había Node ni servidor de PostgreSQL instalados** (solo el cliente `psql`). Para probar el 2026-10-20 se bajaron Node 22.23.3 (nodejs.org, con su checksum) y PostgreSQL 18.4 (paquete npm `embedded-postgres`) a la carpeta temporal de la sesión. Para correr `npm run dev` aquí hay que instalar Node 22 y PostgreSQL.

18. **Dashboard de Necutools, decisiones por confirmar (plan `2026-10-20-dashboard-necutools.md`):** el usuario pidió correr todo sin detenerse, así que en el prompt 4 no se le preguntó por las excepciones. Se aplicó lo que cumple `plans/CLAUDE.md`: las gráficas **no** se animan al cargar, solo al cambiar tienda o periodo (y nunca con movimiento reducido); los indicadores no cuentan hacia arriba. El menú propio de Necutools sí se hizo (lo implica "rediseñar todo Necutools"). Si quiere la animación al cargar, se cambia `animar` en `renderResumen` (`public/js/necutools.js`).
19. **Subir el dashboard:** commit `c2830ab` hecho; falta el push (el token de `gh` de la cuenta Mor4l3sAx3l04 está vencido: `gh auth login -h github.com` y `git push origin main`). En Render, `npm install` instala `chart.js` solo; la tabla `pedidos` se crea sola al arrancar. Después de desplegar, revisar `/vendor/chart.umd.js` y Necutools → Resumen.
20. **Pedidos que no se cierran:** el pedido se guarda al tocar "Enviar pedido por WhatsApp", aunque el cliente no lo mande en WhatsApp. Por eso "Ventas" solo cuenta los que el vendedor marca como vendidos; los demás se quedan pendientes hasta que alguien los cancele.
21. **Seguridad (plan `2026-10-20-seguridad-auditoria-y-endurecimiento.md`):** unido a `main` el 2026-10-20 (fast-forward a `8d2e868`; la rama local `seguridad` se borró, en GitHub sigue `origin/seguridad`). **Regla del usuario: no crear ramas, trabajar siempre en `main`.** Para publicar: `git push origin main` (también sube el dashboard, pendiente 19). Después, en Render: restringir la IP de la base (pendiente 4), activar los 2 pasos en los dueños y leer en Logs las líneas "Revisión de proxy" (deben decir 1 dirección). Al desplegar, todos tendrán que volver a iniciar sesión una vez (la cookie cambia a `__Host-necutla.sid`). Informe: `plans/auditorias/2026-10-20-seguridad.md`.
22. **Registro y login (plan `2026-10-20-registro-validacion-y-login.md`):** (a) el usuario autorizó usar el verde `--wa` solo para el estado "campo válido" (y para el nivel "súper segura" del medidor y las reglas cumplidas), como excepción a `plans/CLAUDE.md`; si quiere que sea regla permanente, tiene que pedir que se actualice. (b) En producción existen los admins `Axel` (id 1) y `axel` (id 3): mientras existan los dos, el login busca el usuario exacto primero y no se crea el índice único de `lower(usuario)` (el `DO $$` de `db/schema.sql` lo salta). Hay que preguntarle al usuario cuál renombrar o desactivar; al quitar el choque, el índice se crea solo en el siguiente arranque. (c) Falta commit y push.
23. **Colores por producto (plan `2026-10-21-colores-por-producto.md`):** (a) excepción de diseño por confirmar con el usuario: la muestra de la barra lleva el color real del producto (dato del vendedor, en `--muestra`), no un color de interfaz. (b) Revisar en el navegador Necutools → Editar producto → Colores y la barra en `/p/<id>` a 1280 y 360 px. (c) Los paquetes de promociones no piden color: si incluyen un producto con colores, el color se acuerda por WhatsApp. (d) Ojo: el `.env` local apunta a la base de Render; para probar en local se usó `DATABASE_URL` de la línea comentada. (e) Push hecho el 2026-10-21 (`762ff7f`), pero **Render no despliega**: `necutla.onrender.com` sigue sirviendo `8e36c1b`; tampoco llegó `d8bc76d` (servicios, de Vladi). Revisar en Render → servicio `necutla` → Events/Logs si el deploy falló, si el Auto-Deploy está apagado o si el servicio está conectado a otro repo (fork); si no hay error, usar Manual Deploy → Deploy latest commit.

24. **Cambio a IONOS (plan `2026-10-25-migracion-ionos-php-mariadb.md`):** el usuario eligió hosting web compartido (solo PHP + MariaDB). El servidor ya está en PHP 8.5 (prompts 1 a 6); falta el prompt 7, que se hace con el usuario en el panel de IONOS (base, phpMyAdmin, SFTP de `app/` y `public/`, `app/config.php` de producción con permisos 600, dominio a `necutla/public`, SSL, **PHP 8.5**, `/healthz`). (a) (Resuelto 2026-10-25) `plans/CLAUDE.md` secciones 1 y 4 ya dicen IONOS, PHP 8.5 y MariaDB. (b) **Hacer el cambio antes de que caduque la base gratis de Render (creada el 2026-10-17, ~2026-11-16).** (c) El día del cambio, sacar un respaldo nuevo de Render y convertirlo otra vez; `~/necutla-mariadb.sql` es del 2026-10-25. (d) Ese archivo lleva hashes, correos y teléfonos: nunca a git. (e) En XAMPP quedó la base de prueba `necutla_prueba_ionos` con esos datos. (f) Mientras no se haga el cambio, los pasos de Render de abajo siguen valiendo; después ya no. (g) Commit en `main` ("Servidor en PHP 8.5 + MariaDB para el cambio a IONOS"); falta el push (preguntar antes). Al subirlo, Render ya no puede desplegar (no hay Node): subirlo el día del cambio o justo antes. (h) En esta máquina quedó el dueño de prueba `dueno` en las bases locales (PostgreSQL de prueba y MariaDB `necutla`), solo para las pruebas. (i) `.env` y `node_modules/` ya no se usan; se pueden borrar cuando el usuario quiera. (j) XAMPP: el PHP 8.2.12 (`mod_php`) quedó apagado y todo el PHP del Apache de XAMPP va al PHP 8.5 de Ubuntu (copias de antes en `/opt/lampp/etc/extra/*.antes-php85`); el `php` de la terminal sigue siendo el 8.2 de XAMPP: usar `php8.5`. Mantener al día con `sudo apt upgrade`. (k) Puntos de la revisión que se dejaron a propósito: encargado edita su propia tienda (diseño) y `Sec-Fetch-Site` opcional (el `Origin` es obligatorio).

25. **(Actualizado 2026-10-30: (a) resuelto, el sitio va por HTTPS en `https://necutla.com`.) IONOS sin dominio (2026-10-26):** el sitio ya está subido y conectado a la base, pero `https://s1115824141.onlinehome.mx/` (dirección temporal de IONOS, ya apunta a `/public`) no tiene certificado SSL, y el `.htaccess` manda todo a HTTPS, así que no se ve. Falta: (a) (Resuelto 2026-10-30) conectar un dominio o subdominio a `/public` con SSL y aplicar el prompt 2 del plan `2026-10-26-ionos-sin-https-y-cuentas-en-pausa.md` (mientras tanto el sitio va por HTTP y el login de Necutools viaja sin cifrar); (b) revisar en vivo un pedido completo con WhatsApp (lo demás ya se revisó el 2026-10-30) (no se pudo probar por web si PHP lee `app/config.php` con permisos 600; por terminal sí); (c) **cambiar la contraseña de la base en IONOS** (se mostró por error en el chat el 2026-10-26) y después actualizar `app/config.php` en el servidor; (d) cambiar enlaces y QR de `necutla.onrender.com` a `https://necutla.com` y apagar Render unos días después; (e) los datos son del respaldo del 2026-10-25: si se editó algo en Render después, sacar otro respaldo y volver a importar; (f) (Resuelto 2026-10-30: `secrets.md` ahora está en `~/Escritorio/secrets.md` con permisos 600.) poner `chmod 600` a `~/secrets.md`.

26. **Pedidos y stock (plan `2026-10-26-pedidos-estados-y-stock.md`):** (a) **urgente: hoy todos los productos de IONOS salen "Agotado"** porque el stock es obligatorio y ninguno lo tiene; capturarlo en Necutools → Productos (filtro "Falta capturar el stock"). Los productos con colores llevan el stock en cada color. (b) `scripts/seguridad/ataques.js` se actualizó (estados nuevos, stock y 2 pruebas), pero no se pudo correr: en esta máquina no hay Node. Lo mismo se probó con `curl` (60 pruebas) y Chrome sin ventana (35). (c) Si se borra un color con piezas descontadas por un pedido pagado, al regresar ese pedido esas piezas no vuelven (ya no tienen a dónde). (d) El número exacto de stock no se publica, salvo en el carrito cuando se piden más piezas de las que hay (se ajusta la cantidad).

27. **Plan `2026-10-29-reels-esqueletos-botones-open-graph.md` (esqueletos, botones y vista previa en WhatsApp):** (a) (Resuelto 2026-10-30: `url_publica` = `https://necutla.com` en el `config.php` del servidor.) (b) Después, mandar por WhatsApp un enlace de la portada, de una tienda y de un producto. WhatsApp guarda la vista previa en caché, y ya hay HTTPS, así que debería salir la imagen. (c) **Excepción de diseño:** el pulso de opacidad de los esqueletos lo autorizó el usuario solo para este plan; si quiere que sea regla permanente, tiene que pedir que se actualice `plans/CLAUDE.md`. (d) (Actualizado 2026-10-30) Las tiendas sin portada PNG/JPG/WEBP usan su imagen generada con GD (`/api/stands/<id>/vista`, plan `2026-10-30-vista-previa-por-tienda.md`); con una portada real sale la suya. El título general se queda sin lugar (decisión del usuario). (e) `/t/<slug>` y `/p/<id>` consultan la base en cada visita sin el límite de la API (una consulta por índice; vigilar si crece el tráfico). (f) La auditoría de botones no encontró grupos con dos botones amarillos ni rojos fuera de borrar o quitar; "Cancelar" se quedó en `.secondary` porque `.ghost` no tiene borde visible (regla del borde de 2px).

28. **(Actualizado 2026-10-31: ya se cambiaron la del buzón tienda@necutla.com y la de la base de Necutla, y las dos están en el `config.php` del servidor; faltan la base de Estudios y la API key de Gemini, que van en el `config.php` de Estudios.)** **Secretos que se mostraron en el chat el 2026-10-29:** al buscar los datos de SFTP, un filtro mal hecho imprimió líneas de `~/secrets.md`: la **contraseña de la base de Necutla en IONOS** (ya estaba en el pendiente 25c), la **contraseña de la base de Estudios** y **parte de la API key de Gemini**. Hay que cambiar las tres: las dos contraseñas en el panel de IONOS (y después en el `app/config.php` de cada proyecto) y la key en Google AI Studio. La contraseña de SFTP no se mostró. Aparte del aviso de `chmod 600` del pendiente 25f, conviene separar los campos de `secrets.md` siempre con ` : `.
    **Se repitió dos veces el 2026-10-30:** (1) al listar los nombres de los campos, las líneas `Contraseña:` (sin espacio antes de los dos puntos) se imprimieron otra vez: contraseña de la base de Necutla, de la base de Estudios, la API key de Gemini completa y **la contraseña del correo tiendita@necutla.com** (nueva). (2) al agregar `correo` al `config.php` del servidor, un script mal hecho imprimió la **contraseña del buzón tienda@necutla.com** (el archivo usa `return array ( … );` y el script buscaba `];`; se regresó a la copia y se hizo bien). Cambiar las cuatro; al cambiar la del buzón, actualizar `correo.password` en el `app/config.php` del servidor (si no, dejan de llegar los códigos y nadie puede entrar). Las sesiones futuras: nunca imprimir `secrets.md`, ni filtrado; leer solo la línea exacta a una variable.

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

### 2026-11-04: sin groserías en lo que ve todo el mundo (plan `2026-11-04-filtro-groserias.md`, prompts 1 a 3)
- Pedido del usuario: que comentarios, nombres de usuario, productos y todo lo público no acepten groserías en español ni en inglés.
- `app/groserias.php` (nuevo, cargado en `app/arranque.php`): `GROSERIAS_PALABRAS` (palabra completa con plural) y `GROSERIAS_RAICES` (dentro de otra palabra); normaliza minúsculas, acentos (la ñ se queda), números y símbolos (`0→o 1→i 3→e 4→a 5→s 7→t @→a $→s`), letras sueltas separadas y letras repetidas (una doble de la lista sigue pidiendo dos: "as" pasa, "ass" no). `tiene_groserias()` y `sin_groserias()`.
- `app/validar.php`: `v_publico()` (v_texto + sin groserías) y `usuario_valido()` también revisa. Se usa en `app/clientes.php` (nombre), `app/resenas.php` (comentario) y `app/admin.php` (tienda, producto o servicio, color, temporada, oferta, promoción, subcategoría y respuesta). Las notas de pedidos y el usuario de Necutools no (no se publican).
- Pruebas: 132 frases unitarias (sin falsos positivos como computadora, disputa, película, class, Dickens, Scunthorpe, cono, shiitake; con groserías disfrazadas); `ataques.js` 278 de 278 con 14 pruebas nuevas "GRS"; en vivo, registro con groserías en el nombre, el usuario y en inglés → 400, y uno limpio llega hasta el captcha. Revisión de lo ya publicado: 0 de 123 textos en IONOS (0 de 235 en local).
- Subido a IONOS por rsync (6 archivos de `app/`, idénticos; respaldo previo en `~/respaldos/2026-11-04-groserias/` del servidor). `README.md`.

### 2026-11-04: subida a IONOS de la casilla de edad y eliminar mi cuenta
- Con permiso del usuario. Respaldo de `clientes`, `resenas` y `codigos_correo` en `~/respaldos/2026-11-04-antes-legal.sql` del servidor (permisos 600, no se bajó); `db/mariadb/schema.sql` corrido 2 veces sin error (columna `edad_aceptada_en`, `resenas_cliente_fk2`). Respaldo de los 12 archivos en `~/respaldos/2026-11-04-archivos/` y subida por rsync (idénticos).
- En vivo: `/healthz`, páginas y archivos 200; aviso con la fecha nueva; registro sin casilla → 400; eliminar sin sesión → 401; opiniones 200.

### 2026-11-04: casilla de edad, eliminar mi cuenta con código y textos legales (plan `2026-11-04-cumplimiento-legal-cuenta-y-edad.md`, prompts 1 a 4, solo en local)
- **Base** (`db/mariadb/schema.sql`, corrida 2 veces en local): `clientes.edad_aceptada_en`; `resenas.cliente_id` nulo con `resenas_cliente_fk2 ON DELETE SET NULL` (también en el `CREATE TABLE`); propósito `eliminar` con `codigos_correo_proposito_check2`.
- **Servidor**: `app/clientes.php` (`CAMPOS_CLIENTE`, `exigir_edad`, `falta` en la sesión, `completar` solo pide lo que falta, `cerrar_sesion_cliente`, `eliminar_cliente` en transacción, `POST /api/clientes/eliminar` y `/eliminar/codigo`, `/sesion` retoma el paso de eliminar); `app/correo.php` (correo de eliminar con su aviso); `app/resenas.php` y `app/admin.php` (`LEFT JOIN` y `CLIENTE_ANONIMO` = "Cliente de Necutla"); `app/codigos.php` (comentario).
- **Mi cuenta**: `public/cuenta.html` (casilla en el registro y en "Completa tu cuenta", grupos `#completar-telefono-grupo` y `#completar-edad-grupo`, tarjeta "Eliminar mi cuenta" con `.btn.danger`); `public/js/cuenta.js` (paso `eliminar`, ventana de peligro, Volver regresa a la cuenta, retoma al recargar, casillas como booleano); `public/js/validacion.js` (mensaje fuera del `label` de una casilla; pasar con Tab sin marcar no marca error); `public/style.css` (`.casilla-edad`).
- **Textos**: `public/terminos.html` (devoluciones con la tienda, casilla de edad, eliminar cuenta, opiniones sin compra verificada y anónimas, no publicar lo que no se cumple, fecha); `public/privacidad.html` (fecha de la casilla, eliminar desde Mi cuenta, opiniones anónimas, menores, fecha); `public/index.html` (pregunta de datos: se puede eliminar la cuenta). `README.md`.
- **Pruebas** (solo localhost): API 32 + 5 (incluida la lista de Necutools y la sesión de Necutools que sigue al eliminar); Chrome sin ventana con un cliente CDP propio 102 de 102 a 1280, 360 y con movimiento reducido; páginas legales y portada sin scroll horizontal ni errores; `ataques.js` 264 de 264 con Node 22.23.4 bajado aparte (11 pruebas nuevas "LEG"; 3 viejas se ajustaron: buscaban la palabra "telefono" en la respuesta, que ahora trae `falta.telefono` sin el número, y "completar" ya no cambia un teléfono que ya existe). Datos de prueba locales borrados (clientes, opiniones, productos, pedidos, bitácora, admins de hoy, sesiones, límites e intentos).
- Si las pruebas en Chrome se corren después de `ataques.js`, dan 429 (el límite por IP del sitio): vaciar `limites` en la base local antes.

### 2026-11-04: plan de lo que falta de la lista legal del TikTok de @cooked_dev_
- TikTok `vt.tiktok.com/ZSpRuAq9Q` (video 7702821446724226326): TikTok no da el texto con WebFetch (embed 503, página vacía) y bajar la página con `curl` lo bloquea el modo automático; se vio con vidIQ (`vidiq_watch_shortform_content` con la URL completa `/@usuario/video/<id>`, 10 créditos). Es una lista de 20 puntos legales; Necutla ya cumple 14.
- Nuevo plan `plans/planes/2026-11-04-cumplimiento-legal-cuenta-y-edad.md` y sus 4 prompts en `plans/prompts/` (mismo nombre). No se cambió código.
- Decisiones del usuario: casilla obligatoria de edad ("18 o más, o permiso de tu tutor") con la fecha guardada; botón "Eliminar mi cuenta" con código por correo; al eliminar, las opiniones se quedan anónimas ("Cliente de Necutla"). El prompt 3 pide al usuario los datos del responsable para los `[COMPLETAR]`.

### 2026-11-01: la ventana de confirmación se desvanece al cerrar (pendiente (c) del plan `2026-11-01-avisos-y-confirmaciones-propios.md`)
- `public/js/comun.js` (`abrirDialogo`): `cerrar(valor)` pone `.is-cerrando`, espera el `animationend` de la ventana (o 400 ms de respaldo) y luego hace `close()`. Volver, la acción, Escape (tecla y `cancel`), el clic en el fondo y Ctrl+Enter pasan por ahí; un segundo clic mientras se cierra no hace nada. Con movimiento reducido se cierra en seguida.
- `public/style.css`: `.dialogo[open].is-cerrando` y su `::backdrop` con `dialogo-sale` / `dialogo-fondo-sale` (0.18 s, opacidad y `scale(.96)`).
- Probado en local con Chrome sin ventana: 15 de 15 con animación y 15 de 15 con movimiento reducido (cada forma de cerrar devuelve lo correcto, doble clic, nota con Ctrl+Enter, cola de dos ventanas, sin errores de consola). Subido a IONOS por rsync (los 2 archivos, idénticos en vivo); las 15 pruebas también pasan en necutla.com.

### 2026-11-01: avisos y confirmaciones propios en lugar de `alert`, `confirm` y `prompt` (plan `2026-11-01-avisos-y-confirmaciones-propios.md`, prompts 1 a 4)
- `public/js/comun.js`: `confirmar()` y `pedirTexto()` (una sola `<dialog id="app-dialogo">` con `showModal()`, cola si se piden dos, Escape y clic en el fondo = Volver, foco en Volver si es `peligro`, el foco regresa al botón que la abrió); `showToast(…, { tipo: "error" })` y `avisarError()`; la tienda sin WhatsApp avisa con el toast de error.
- `public/style.css`: secciones del toast de error (insignia roja, temblor `toast-tiembla`, botón cerrar, 6 s) y "VENTANAS DE CONFIRMACIÓN" (`.dialogo`, insignias `is-peligro` / `is-importante` / `is-info` / `is-nota`, entrada `dialogo-entra`, `insignia-pop`; en celular los botones van a lo ancho). `margin: auto` en `.dialogo` porque el reset global quitaba el centrado. `public/iconos.js`: `triangle-alert`.
- `public/js/necutools.js`: los 9 `confirm` (estado de pedido, cancelar viejos, quitar 2 pasos, eliminar tienda, subcategoría, color, producto, oferta, promoción), el `prompt` de la nota y los 5 `alert` (`manejarError`, código de 2 pasos, editor de pedido). `public/js/carrito.js` (vaciar) y `public/js/producto.js` (borrar opinión). Ya no queda ningún `alert(`, `confirm(` ni `prompt(` en `public/`.
- `README.md`: "Preguntar y avisar".
- **Pruebas** en local con Chrome sin ventana (cliente CDP propio, `window.alert/confirm/prompt` como trampa): 33 de 33 a 1280, 360 y con movimiento reducido (vaciar con Escape, clic en el fondo y aceptar; Tab dentro; foco de vuelta; cancelar, pagar y regresar un pedido; nota con contador, Ctrl+Enter, Volver y vacía; nota con `<b>` escapada; error de la API; cola de dos ventanas; sin scroll horizontal ni errores), borrar opinión y eliminar un producto temporal. Datos de prueba borrados (dueño `prueba_dialogos`, pedidos 41 a 43, stock, números, producto 68, su bitácora); también se vaciaron las sesiones y límites locales.
- Subido a IONOS por rsync (6 archivos, idénticos en vivo); en necutla.com la ventana abre centrada con su animación y el toast de error funciona, sin errores de consola.

### 2026-11-01: plan de avisos y confirmaciones propios (sin `alert`, `confirm` ni `prompt`)
- Nuevo plan `plans/planes/2026-11-01-avisos-y-confirmaciones-propios.md` y sus 5 prompts (0 a 4) en `plans/prompts/` (mismo nombre). No se cambió código.
- Hoy hay 11 `confirm`, 1 `prompt` y 6 `alert` (casi todos en `public/js/necutools.js`; también vaciar carrito, borrar opinión y tienda sin WhatsApp).
- Decisiones del usuario: confirmaciones en una ventana centrada (`<dialog>`) con icono por tipo (peligro, importante, info) y animación corta; avisos de error en el toast con tipo (admiración roja, temblor, botón cerrar); **sombra `--sombra-2` en la ventana como excepción solo para este plan**.

### 2026-11-01: emojis bien en WhatsApp Web y mensajes de pedido y servicio más completos (plan `2026-11-01-whatsapp-emojis-y-mensaje-vistoso.md`, prompts 1 a 4)
- **Emojis**: `enlaceWhatsApp()` (`public/js/comun.js`) arma `https://api.whatsapp.com/send?phone=…&text=…` en vez de `wa.me` (la redirección de `wa.me` cambiaba cada emoji por `%EF%BF%BD`). Comprobado con `curl`: con el enlace nuevo, el emoji llega intacto hasta `web.whatsapp.com/send`. No quedaba otro `wa.me` en `public/` ni `app/`.
- `comun.js`: `SEPARADOR_WA`, `fechaMensaje()` (día, fecha y hora de CDMX) y `enlaceSitio()`.
- `public/js/carrito.js` (`mensajeDe`, `piezas`): encabezado, tienda, cliente, fecha, productos numerados con `cantidad × precio = subtotal`, oferta con el precio final, subtotal, ahorro, total, indicaciones, enlace al catálogo (`/t/<slug>`) o a promociones si es un paquete (con la lista de lo que incluye) y despedida.
- `public/js/producto.js` (`pedirServicio`): servicio, precio (`textoPrecio`), fecha, enlace a `/p/<id>` y despedida.
- **Pruebas** en local con Chrome sin ventana (cliente CDP propio), a 1280 y 360 px: carrito con un producto normal, uno con oferta (20 %), uno con color y un paquete de 2 tiendas; 3 grupos, 6 enlaces abiertos y 3 botones "Vendedor N", todos con `api.whatsapp.com`, sin "�", con los emojis, con totales iguales a los de la página, sin errores de consola ni scroll horizontal; los pedidos se siguieron registrando; servicios con precio "desde" y "a cotizar". Los datos de prueba (stock, números, oferta, paquete y pedidos 38 a 40) se borraron.
- Subido a IONOS por rsync (los 3 JS); en vivo, los archivos son idénticos a los locales y `comun.js` ya usa `api.whatsapp.com`.

### 2026-11-01: plan de los emojis rotos en WhatsApp Web y el mensaje de pedido más vistoso
- Nuevo plan `plans/planes/2026-11-01-whatsapp-emojis-y-mensaje-vistoso.md` y sus 5 prompts (0 a 4) en `plans/prompts/` (mismo nombre). No se cambió código.
- Causa comprobada con `curl`: `wa.me` redirige a `api.whatsapp.com/send/` y en la redirección cambia cada emoji por `%EF%BF%BD` ("�"); acentos y ñ pasan bien. Arreglo: armar el enlace directo a `api.whatsapp.com/send` en `enlaceWhatsApp()` (`public/js/comun.js`).
- Decisiones del usuario: estilo vistoso moderado; precio unitario y subtotal, detalle de ofertas y ahorro, enlace a la tienda y fecha con día y hora; el mensaje de servicios también se rediseña.

### 2026-10-31: fotos de Unsplash en las tarjetas de tiendas de la portada (plan `2026-10-31-fotos-tiendas-portada.md`, prompts 1 a 4)
- 20 candidatas buscadas con WebFetch en `unsplash.com/es/s/fotos/…`, todas con "Unsplash License" (las Unsplash+ se descartaron); elegidas 7 con una hoja de contacto (Pillow). Origen, fotógrafo, `alt` y respaldo de cada una en `recursos/fotos-unsplash/creditos.md`.
- `public/imagenes/tiendas/<tienda>-640.webp` y `-1280.webp` (16:10, sin metadatos, 12 a 109 KB).
- `public/js/portada.js`: `FOTOS_TIENDAS`, `fotoDe`, `imagenTarjeta` (con `srcset`, `sizes`, `width`/`height`, `lazy`) y `pintarCreditos`; solo reemplaza el SVG de relleno (la portada propia de Necutools tiene prioridad). `public/index.html`: `#creditos-fotos` debajo de las tarjetas. `public/style.css`: `.card-img-wrap.is-foto` (`cover`) y `.creditos-fotos`.
- Pruebas a 1280, 360 y movimiento reducido, en local y en vivo, sin errores; Lighthouse de la portada en vivo 92 / 100 / 100 / 100.

### 2026-10-31: plan de fotos de Unsplash para las tarjetas de tiendas de la portada
- Nuevo plan `plans/planes/2026-10-31-fotos-tiendas-portada.md` y sus 4 prompts en `plans/prompts/` (mismo nombre). No se cambió código.
- Hoy las 7 tarjetas de "Tiendas" usan un SVG gris con el nombre. Licencia de Unsplash revisada: gratis y comercial, sin crédito obligatorio; las Unsplash+ no se usan. `unsplash.com/photos/<id>/download` bloquea a `curl`, pero `images.unsplash.com` (sacado de la página de la foto con WebFetch) sí descarga.
- Decisiones del usuario: Claude elige una foto por tienda y el usuario las revisa después; línea de créditos con los fotógrafos debajo de las tarjetas; solo en la portada (la portada propia de Necutools tiene prioridad).

### 2026-10-31: recomendaciones de IONOS aplicadas (plan `2026-10-31-seo-iconos-contenido-y-legal.md`, prompts 1 a 7)
- **Títulos, descripciones y JSON-LD** (`app/paginas.php`): `<title>` y descripción por tienda y producto (antes fijos), canonical, `noindex` en carrito, cuenta y Necutools (`necutools.html` con meta), 404 real para tienda o producto que no existe, `WebSite`/`Organization`/`Product`/`Service`/`BreadcrumbList`. Portada: título de 56 y descripción de 157; `OG_GENERAL` igual. `tienda.js` y `producto.js` ya no cambian `document.title`.
- **Sitemap y robots**: `app/sitemap.php` (`GET /sitemap.xml`, solo lo visible), regla en `public/.htaccess`, `public/robots.txt`.
- **Iconos**: `recursos/iconos/icono.html` (fuente) → `public/apple-touch-icon.png`, `public/favicon.ico`, `public/imagenes/favicon-32.png`, `icono-192.png`, `icono-512.png`, `icono-maskable-512.png`; `public/site.webmanifest`; enlaces y `theme-color` en todas las páginas.
- **Portada** (`public/index.html`, `style.css`): "Qué es Necutla", "Cómo funciona" (3 pasos) y "Preguntas frecuentes" (8, `<details>`): 756 palabras en el HTML inicial.
- **Legal y 404**: `public/privacidad.html`, `public/terminos.html` (con `[COMPLETAR]`), `public/404.html` (reemplaza `404.txt`, borrado también en IONOS); enlaces en el pie de todas las páginas y en el registro (`cuenta.html`); `.legal` en `style.css`.
- **Rendimiento**: gzip para texto, fuentes 30 días, `image/x-icon`; fila de esqueleto del tablero a 57 px y `.main-content` con `min-height: 100vh` (CLS); `h2` oculto antes del catálogo de la tienda (orden de títulos).
- **Pruebas**: Lighthouse antes y después (ver plan), Chrome sin ventana a 1280, 360 y movimiento reducido (páginas nuevas, pie, aviso del registro, `<details>` con teclado, sin scroll horizontal ni errores), captcha 17 de 17, ataques 253 de 253; en vivo: títulos, canonical, JSON-LD, sitemap, robots, iconos, gzip, 404, sin errores de consola. Datos de prueba locales borrados.
- Un error que se corrigió en el camino: las páginas nuevas salieron cortadas la primera vez (se calcularon las posiciones del HTML antes de cambiar el título); se volvieron a generar antes de subir.

### 2026-10-31: plan de las recomendaciones de IONOS (SEO, icono touch, contenido) y aviso de privacidad
- Nuevo plan `plans/planes/2026-10-31-seo-iconos-contenido-y-legal.md` y sus 7 prompts en `plans/prompts/` (mismo nombre). No se cambió código.
- Puntos del revisor de IONOS: CDN, `sitemap.xml`, título corto (34), descripción corta (130), poco contenido (364 palabras) e icono touch. Revisión en vivo: tienda y producto con `<title>` fijo, sin `robots.txt`, manifest ni `canonical`, CSS y JS sin comprimir, 404 en texto plano.
- Decisiones del usuario: **no activar la CDN de IONOS** (solo funciona en subdominios como `www` y el sitio usa `necutla.com`; además cambiaría la IP de los visitantes); portada con "Qué es Necutla", "Cómo funciona" y "Preguntas frecuentes"; aviso de privacidad (LFPDPPP) y términos de uso como borrador que el usuario completa.

### 2026-10-31: actualizaciones de seguridad, Turnstile y Web Analytics (plan `2026-10-31-seguridad-turnstile-y-cloudflare-aparte.md`, prompts 1 a 7)
- **Informe** `plans/auditorias/2026-10-31-seguridad-actualizaciones.md` (hallazgos N1–N14 con fuentes oficiales y su estado). Versiones: IONOS con PHP 8.5.12 (web y terminal), MariaDB 11.8.8, curl, sodium y Argon2; local PHP 8.5.4 de Ubuntu (parchado), sin curl.
- **Servidor**: `app/arranque.php` (8.5.12 mínimo en producción); `app/contrasenas.php` (Argon2id 64 MiB / 4 pasadas, rehash al entrar en `app/auth.php` y `app/clientes.php`, hash falso del mismo tipo); `app/totp.php` (secreto cifrado con sodium, `s1:`; se cifra solo al usarse) + `scripts/cifrar-totp.php`; `db/mariadb/schema.sql` (`totp_secreto` VARCHAR(160), corrido en local y en IONOS; el secreto del dueño con 2 pasos de IONOS ya está cifrado); `app/admin.php` (`GET /api/admin/sistema`, solo dueños); `public/.user.ini`.
- **Captcha**: `app/captcha.php` (siteverify con curl o socket TLS, hostname y action en producción, 5 s, deja pasar si Cloudflare no responde); `exigir_captcha()` en registro, login de clientes, restablecer, reenviar código (`app/clientes.php`), opiniones (`app/resenas.php`) y pedidos (`app/pedidos.php`); `/api/config` con `captcha`. `public/js/captcha.js` (render explícito, `interaction-only`, español) en `cuenta.html`/`cuenta.js`, `producto.html`/`producto.js` y `carrito.html`/`carrito.js` (el pedido se registra después de abrir WhatsApp, como antes). Estilo `.captcha` en `style.css`.
- **Web Analytics**: `app/paginas.php` (`con_web_analytics`) pone el beacon en las páginas públicas si hay token (`cloudflare_analytics`).
- **Front y dependencias**: Archivo alojada en `public/fuentes/` (sin Google Fonts); Chart.js 4.6.1; CSP con Turnstile y Analytics, sin Google, con `frame-src`, `worker-src` y `manifest-src` (`public/.htaccess`); tarjeta "Servidor" en Necutools (`necutools.html`, `necutools.js`, `.lista-sistema`); `security.txt` con `mailto:tienda@necutla.com`.
- **Docs**: `app/config.ejemplo.php` (`turnstile`, `cloudflare_analytics`), `README.md` (configuración, seguridad, checklist), `.gitignore` (`app/config.php.*`). `scripts/seguridad/ataques.js`: token de prueba automático, pruebas del captcha y la prueba de 2 pasos ya no depende del reloj.
- **Local**: XAMPP solo en 127.0.0.1 (copias `*.antes-localhost`); `necutla.conf` permite PUT y DELETE (el `httpd.conf` del proyecto "estudio" los bloqueaba en todo Apache); `app/config.php` local con las llaves de prueba de Turnstile.
- **IONOS**: respaldo previo de `app/` y `public/` en la carpeta temporal; subida por rsync; `config.php` del servidor con `turnstile` y `cloudflare_analytics` (de `~/Escritorio/secrets.md`, líneas 71, 72 y 79, sin imprimirlos; copia `app/config.php.antes-turnstile`, permisos 600); `~/scripts/cifrar-totp.php` en el servidor (fuera de `public/`).
- **Pruebas**: ataques 253 de 253; Chrome sin ventana 17 de 17 a 1280, 360 y movimiento reducido, llave que falla y reto interactivo; Necutools a 1280 y 360; en vivo: salud, páginas, CSP, fuente, Analytics, vista previa, 400 sin token o con token falso. Datos de prueba locales borrados.

### 2026-10-31: plan de actualizaciones de seguridad, Turnstile y Cloudflare aparte
- Nuevo plan `plans/planes/2026-10-31-seguridad-turnstile-y-cloudflare-aparte.md` y sus 7 prompts en `plans/prompts/` (mismo nombre). No se cambió código.
- Investigación preliminar: PHP 8.5.12 (CVE-2026-109618/109619), MariaDB 11.8.8/11.8.9, Apache 2.4.69, Turnstile (siteverify y CSP), Web Analytics sin cambiar el DNS.
- Decisiones del usuario: Turnstile en registro, restablecer, login de clientes, opiniones y pedidos (no en Necutools); Cloudflare solo aparte, sin tocar IONOS; Archivo alojado en `public/` sin Google Fonts. El escudo completo (nameservers) quedó como opción para un plan futuro.

### 2026-10-31: Mi cuenta se ajusta al formulario y luces de los edificios (plan `2026-10-31-mi-cuenta-alto-y-luces.md`)
- Pedido del usuario: en "Iniciar sesión" el panel de los edificios se veía muy alto porque la tarjeta `.auth` siempre medía lo del registro. Ahora mide lo del formulario visible y cambia con la animación del panel; está centrada.
- `public/js/cuenta.js`: `ajustarAlto()` pone `--alto-auth` (CSSOM) al cambiar de modo, con un `ResizeObserver` en los dos formularios y al cambiar el tamaño de la ventana; `alarmaVentanas()` pone `.is-alarma` 1.8 s cuando entrar da 401.
- `public/style.css`: `.auth` con `height: var(--alto-auth, auto)`, `margin-inline: auto` y formularios sin estirarse; el texto del panel se centra arriba de la ciudad (40 % de abajo). En celular las filas van en `max-content` (con alto fijo, la fila del panel se encogía y el formulario tapaba el título) y la ciudad mide 80 px. Ventanas: parpadeo a ratos (`ventana-luz`, excepción) y rojas `--aviso` con 4 parpadeos (`ventana-alarma`) si la contraseña está mal; con movimiento reducido no parpadean (el rojo sí).
- Probado en Chrome sin ventana: 11 + 10 + 11 a 1280, 360 y con movimiento reducido (alto de entrar 458 px y de crear cuenta 982 px, centrada, sin scroll horizontal, alarma y su fin, sin errores), y las 36 + 36 del código por correo siguen bien. Subido a IONOS.

### 2026-10-31: caída de la API en producción por la contraseña de la base
- El usuario vio errores 500 en `/api/stands`, `/api/config`, `/api/promociones` y `/api/vitrina`; `/healthz` daba 503. Causa: cambió la contraseña de la base `dbs16275017` en IONOS (pendiente 28) y el `config.php` del servidor seguía con la vieja (MySQL 1045).
- Se comprobó sin imprimir nada que la de `~/Escritorio/secrets.md` (línea 20) conectaba, y se cambió solo `bd.password` del `config.php` del servidor (`require` + `var_export`, validado y probando la conexión antes; copia `app/config.php.antes-pw-bd`, permisos 600). Todas las rutas volvieron a 200.
- **Para la próxima:** cuando el usuario cambie una contraseña en el panel de IONOS (base o buzón), actualizar en seguida el `app/config.php` del servidor; si no, el sitio se cae (base) o dejan de llegar los códigos (buzón).

### 2026-10-30: contraseña nueva del buzón y regla de no exponer secretos
- El usuario cambió la contraseña de `tienda@necutla.com` y movió `secrets.md` a `~/Escritorio/secrets.md` (permisos 600; el buzón sigue en la línea 56).
- Se cambió solo `correo.password` en el `app/config.php` del servidor: `require` del arreglo, `var_export` a un archivo nuevo, validación y reemplazo (copia en `app/config.php.antes-pw-correo`, permisos 600). La contraseña pasó por stdin y no se imprimió nada. Correo de prueba enviado bien.
- **Regla del usuario: NUNCA volver a exponer una contraseña.** Las tres fugas (2026-10-29 y dos el 2026-10-30) y el procedimiento seguro quedaron en la memoria de Claude (`secrets-md-no-imprimir`): nunca mostrar texto de `secrets.md` ni de `config.php`, ni filtrado; leer secretos solo a variables o stdin; cambiar `config.php` con `require` + `var_export` y validar antes de reemplazar.

### 2026-10-30: título de la portada con nombre y eslogan
- El usuario partió el h1 de la portada en dos (`Necutla` / `La ciudad del estudiante`). Pidió dejarlo separado, con el nombre primero y la frase como eslogan. Para no tener dos h1: `<h1>Necutla <span class="hero-lema">La ciudad del estudiante</span></h1>` en `public/index.html` y `.hero-lema` en `public/style.css` (en bloque, `wdth` 112 / 700, más chico que el nombre). Revisado a 1280 y 360 px y subido a IONOS.

### 2026-10-30: código por correo, sesión de cliente sin vencimiento (plan `2026-10-30-codigo-por-correo-y-sesion-permanente.md`, prompts 1 a 5)
- **Correo** (`app/correo.php`, nuevo): SMTP propio sin Composer (`ssl://smtp.ionos.mx:465`, certificado verificado, `AUTH LOGIN`), mensaje texto + HTML en UTF-8, sin saltos de línea en encabezados. Plantilla del código con el diseño de Necutla (estilos en línea con los hex de los tokens: excepción técnica, los clientes de correo no leen `style.css`). Opción `correo` en `app/config.ejemplo.php` y `README.md`; en local `modo: archivo` → `/tmp/necutla-correos/`. En IONOS se agregó `correo` al `config.php` (permisos 600, copia `app/config.php.antes-correo`) y salió bien un correo de prueba de `tienda@necutla.com` a sí mismo. Ojo: el `php` de la terminal de IONOS es 8.3; usar `php8.5`.
- **Códigos** (`app/codigos.php`, nuevo; tabla `codigos_correo` en `db/mariadb/schema.sql`, corrida 2 veces en local y en IONOS): 6 dígitos con `random_int`, HMAC con el secreto, 10 min, un uso, 5 intentos, ligados a la sesión que los pidió, reenviar cada 60 s y 5 por hora por correo, 20 envíos por hora por IP. Restablecer manda el correo después de responder (`fastcgi_finish_request`) y responde igual exista o no la cuenta.
- **Rutas** (`app/clientes.php`): login y registro responden `{codigo: true, correo: "a***@…", espera}`; nuevas `/login/codigo`, `/registro/codigo` (crea la cuenta e inicia sesión), `/codigo/reenviar`, `/restablecer`, `/restablecer/codigo`, `/restablecer/password` (cierra las demás sesiones y entra); `/sesion` trae `codigoPendiente`.
- **Sesión** (`app/sesiones.php`, `app/auth.php`): con cliente, cookie y base a 400 días renovados en cada visita; `vida_maxima()` solo cierra la parte de Necutools (24 h o 8 h sin uso, clave nueva `adminUso`) y deja al cliente del mismo navegador.
- **Frontend**: `public/js/codigo.js` (nuevo: 6 cajas, avanza solo, Backspace y flechas, pegar reparte, pop, temblor rojo y se vacía, verde con brillo y "Verificado"); `public/cuenta.html` (tarjetas del código, restablecer y contraseña nueva, enlace "¿Olvidaste tu contraseña?"); `public/js/cuenta.js` (pasos, cuenta atrás de "Reenviar código", retoma el paso al recargar); `public/style.css` (token `--brillo-wa` y sección "CÓDIGO POR CORREO"); `public/js/comun.js` ("Reenviando").
- **Verificación local**: `curl` 28 + 23 + 14 (sesión y Necutools) + vencido/reenviar; Chrome sin ventana con cliente CDP propio 36 de 36 a 1280, 360 y con movimiento reducido (registro, error con temblor, pegar, brillo, entrar, restablecer, recargar a medio paso, sin scroll horizontal, sin errores de consola ni CSP). Clientes de prueba borrados.
- **En vivo** (necutla.com, buzón `tienda@necutla.com` leído por IMAP): 12 de 12; el correo llegó en 1.8 s a la bandeja de entrada; cookie `__Host-necutla.sid` con `Secure` a 400 días. La cuenta de prueba se borró (quedan los 2 clientes reales).
- Reels DfBJ5MGtFj_ y DfDuWCKsfqm: ya aplicados, sin cambios.
- Commit "HTTPS en necutla.com, vista previa por tienda y código por correo" en `main` (todo lo del 2026-10-30) y otro con el título de la portada. **Falta el push**: el token de `gh` de Mor4l3sAx3l04 venció (`gh auth login -h github.com`, `gh auth setup-git` y `git push origin main` con el usuario aumf-ubuntu-080704).

### 2026-10-30: plan del código por correo y la sesión de cliente sin vencimiento
- Nuevo plan `plans/planes/2026-10-30-codigo-por-correo-y-sesion-permanente.md` y sus prompts (0 a 5) en `plans/prompts/` (mismo nombre). No se cambió código.
- Reel @anees05it (DfCQB9LMm5Y), leído con WebFetch a `/embed/captioned/`: campo OTP de 6 dígitos con pop, temblor rojo y verde de "verificado".
- Decisiones del usuario: código por correo (desde `tienda@necutla.com`) para entrar, registrarse y restablecer la contraseña, **solo clientes**; sesión de cliente sin vencimiento (Necutools sigue con 8 h / 24 h); el registro sigue iniciando sesión solo; **brillo verde autorizado como excepción solo para este plan**.
- Revisión de los reels DfBJ5MGtFj_ (esqueletos) y DfDuWCKsfqm (botones): ya están aplicados en el código y en vivo; no hace falta nada.
- Ojo: en `~/secrets.md` el encabezado dice `tienda@necutla.com` y la línea `tiendita@necutla.com`; el usuario eligió `tienda@`. Si el SMTP la rechaza, preguntar (prompt 1).

### 2026-10-30: la vista previa salía sin imagen en WhatsApp Web
- Captura del usuario: en WhatsApp Web, `https://necutla.com/` salía con título y descripción pero sin imagen. Causa: `Cross-Origin-Resource-Policy: same-origin` en todo; WhatsApp Web carga la imagen desde `web.whatsapp.com` y el navegador la bloquea.
- `public/.htaccess`: las respuestas `image/png|jpeg|webp|gif` (archivos y las de PHP) van con `cross-origin`; páginas, API y SVG siguen en `same-origin`.
- IONOS tiene una caché delante que guarda cada dirección con sus cabeceras viejas (1 h las imágenes, 1 día las de tienda). Por eso `app/paginas.php` agrega `og=<OG_VERSION>` (hoy `2`) a toda `og:image`; subirlo si vuelven a cambiar las cabeceras de las imágenes.
- Probado en local y en vivo: portada, `/t/tecnologia` y `/p/1` dan su imagen con `cross-origin`. Falta que el usuario lo vea en WhatsApp con un enlace que no haya mandado antes (WhatsApp guarda la vista previa de cada dirección).

### 2026-10-30: imagen de vista previa propia para cada tienda (plan `2026-10-30-vista-previa-por-tienda.md`)
- Pedido del usuario: seguir con el reel de Open Graph (@go.expoose, DfEWnhqMNcp). Revisión en vivo: imagen 1200×630, título y frase ya cumplían. Decisiones: el título general se queda sin "dónde"; cada tienda tiene su imagen generada.
- `app/og-imagen.php` (nuevo): `GET /api/stands/<id>/vista` arma con GD un PNG de 1200×630 con el diseño de `og-necutla.png`: marca, nombre de la tienda (se achica o pasa a 2 o 3 renglones), descripción, frase de WhatsApp y tablero con hasta 5 subcategorías (si no tiene: Productos, Servicios, Ofertas). Colores de los tokens. `?v=` es un crc32 de los datos, así cambia al editar; `Cache-Control` de un día. Tienda oculta o inexistente: 404. Sin GD o sin fuentes, la tienda usa la imagen general.
- `app/paginas.php`: las tiendas sin portada real llevan esa imagen con `og:image:width/height` y alt "Tienda X en Necutla". `app/arranque.php`: carga el archivo y `rutas_og_imagen()`.
- `app/fuentes/`: Archivo fija en 125/800, 112/700 y 100/500 (de la variable de google/fonts, con `fonttools` en un venv temporal) y su `OFL.txt`. `README.md`: cómo se hacen y que hace falta GD.
- Local: se instaló `php8.5-gd` de Ubuntu y se reinició `php8.5-fpm`.
- **Desviaciones del plan:** la ruta es `/api/stands/<id>/vista` (por id, como `/portada`, y sin `.png`) en vez de `/:slug/vista.png`; cómo se sacan las fuentes quedó en `README.md`, no en `recursos/og/`.
- Probado en local (7 tiendas, nombre de 50 caracteres, sin descripción, sin subcategorías, oculta 404, versión que cambia) con tiendas de prueba que se borraron. Subido a IONOS por rsync (3 archivos de `app/` y las fuentes): las 7 tiendas dan PNG 1200×630 de 41 a 53 KB y las páginas siguen en 200.

### 2026-10-30: dominio `https://necutla.com` con HTTPS (prompt 2 del plan `2026-10-26-ionos-sin-https-y-cuentas-en-pausa.md`; cierra el prompt 7 del plan de IONOS)
- El usuario conectó `necutla.com` en IONOS. Certificado Sectigo DV para `necutla.com` y `*.necutla.com`, válido hasta el 2027-04-29.
- `public/.htaccess`: redirección 301 activa otra vez. Todo lo que no sea `https://necutla.com` (HTTP, `www.` y la dirección temporal `s1115824141.onlinehome.mx`) va a `https://necutla.com` con la misma ruta; localhost no cambia. Así la cookie `__Host-` y la vista previa usan una sola dirección.
- `app/config.php` del servidor: `https` en true y `url_publica` = `https://necutla.com` (copia en `app/config.php.antes-https`, permisos 600). `app/config.ejemplo.php`: ejemplo con `necutla.com`.
- **Probado en vivo con `curl`:** 301 desde HTTP, `www` y onlinehome; HSTS y CSP con `upgrade-insecure-requests`; `/healthz` ok; portada, tienda, producto, carrito, cuenta, promociones, Necutools, CSS y API dan 200; `og:url` y `og:image` con `https://necutla.com`; `/app/config.php` 404; login de Necutools y de clientes con datos falsos 401. Registro de un cliente de prueba: cookie `__Host-necutla.sid; HttpOnly; Secure; SameSite=Strict` y sesión válida; se borró después (quedan los 2 clientes reales).
- En local se probó que localhost sigue sin redirección.

### 2026-10-29: cuentas de cliente reactivadas en IONOS
- Pedido del usuario: volver a activar el login y el registro de clientes y que todo el sitio funcione con sesión.
- Solo cambió el `app/config.php` del servidor: `cuentas_clientes` en true (copia en `app/config.php.antes-cuentas`, permisos 600). `https` sigue en false porque no hay certificado: con `Secure` la cookie no se guardaría por HTTP. No cambió el código.
- **Probado en vivo** con Chrome sin ventana (17 pruebas) y una cuenta de prueba `prueba_<hex>` con correo de gmail.com, que se borró después (quedan los 2 clientes reales):
  - `/api/config` da `cuentas: true` y "Mi cuenta" aparece en el menú, sin el aviso de pausa.
  - Registro completo con validación en vivo (el DNS MX funciona en IONOS) y sesión iniciada.
  - Opinión publicada y borrada en `/p/1`.
  - Cerrar sesión; entrar con el usuario y con el correo en mayúsculas; contraseña equivocada da 401.
  - Necutools sigue con su propio login.
- La consola solo muestra 2 avisos de Chrome por servir en HTTP (`Cross-Origin-Opener-Policy` y `Origin-Agent-Cluster` ignorados), que se quitan con SSL.
- **Ojo:** mientras no haya HTTPS, las contraseñas de clientes y de Necutools viajan sin cifrar (pendiente 25a).

### 2026-10-29: esqueletos de carga, estados de botón y vista previa en WhatsApp (plan `2026-10-29-reels-esqueletos-botones-open-graph.md`, prompts 1 a 5)
- **Esqueletos** (reel "Deja de usar spinners"):
  - `public/js/comun.js`: `pintarEsqueletos(contenedor, n, tipo)` con las piezas tarjeta, fila, letrero, grupo, kpi y tabla. Pone `aria-busy` y lo quita solo cuando llega otro contenido.
  - Se llama en `portada.js` (tablero, tiendas, búsqueda), `tienda.js` (12), `promociones.js`, `carrito.js` (solo en la primera carga) y `necutools.js` (`pintarEsqueletosDash`: indicadores y tabla de pedidos al entrar y al cambiar tienda o periodo; si falla, se vuelve a pintar lo de antes).
  - `tienda.html` y `producto.html`: el h1 "Cargando…" es un esqueleto con el texto en `.visually-hidden`.
  - `public/style.css`, sección "ESQUELETOS DE CARGA": bloques `--linea` (`--linea-tinta` sobre el tablero), pulso de opacidad de 1.2 s, sin degradados; no entran animados ni suben con el hover; quietos con movimiento reducido.
- **Botones** (reel "Variantes de un botón"):
  - `style.css`: `.btn:disabled` / `[aria-disabled="true"]` en gris (`--gis`, texto y borde `--texto-2`, contraste 6.41:1) en cualquier variante; `.btn[aria-busy="true"]` con `cursor: progress`.
  - `comun.js`: `botonOcupado()` / `botonListo()` ("Guardar producto" → "Guardando producto", sin spinner; si otra función cambió el texto mientras esperaba, se respeta). Se usan en `cuenta.js`, `producto.js` y `necutools.js` (`enviar`, código de 2 pasos, editor de pedidos).
  - `README.md`: tabla "Qué botón usar".
- **Vista previa del enlace** (reel de Open Graph):
  - `public/imagenes/og-necutla.png` (1200×630, 56 KB), hecha con Chrome sin ventana desde `recursos/og/og-necutla.svg`.
  - `public/.htaccess`: `/`, `index`, `carrito`, `promociones`, `cuenta`, `/t/<slug>` y `/p/<id>` pasan a `api/index.php`.
  - `app/paginas.php` (nuevo, cargado en `app/arranque.php` antes de la API, sin sesión ni límite): cambia el bloque `<!--og:inicio-->…<!--og:fin-->` de cada HTML. La tienda lleva su nombre, descripción y portada (si no es SVG). El producto lleva nombre, precio con la oferta de hoy, tienda, descripción y foto. Todo con `htmlspecialchars`. Si la tienda o el producto no existe, o la base falla, se usa la vista previa general.
  - Opción nueva `url_publica` (`app/config.ejemplo.php`, `README.md`). En el `app/config.php` local quedó `http://localhost:8081`.
- **Verificación local** (`php8.5` + XAMPP, nunca IONOS):
  - `curl`: las 9 rutas dan 200 con sus etiquetas, CSP y `no-cache`; `/necutools.html` sin vista previa; `/api/*` 404 y JSON igual; `/app/config.php` 404; redirección vieja 301; escape de `"<>&` probado.
  - Error que se corrigió en las pruebas: un precio como "$250.00" se leía como referencia `$25` de `preg_replace`. Ahora se usa `preg_replace_callback`.
  - Chrome sin ventana con un cliente CDP propio (deteniendo `/api/` para ver los esqueletos): 32 de 32 a 1280 y 360 px. Esqueletos y su reemplazo en portada, tienda, tienda inexistente, promociones, producto, carrito y búsqueda; pulso sin degradado y quieto con movimiento reducido; botón ocupado, listo, deshabilitado y con `<span>`; login fallido de Necutools deja el botón listo; sin scroll horizontal; cero errores de consola o CSP.
  - Resumen de Necutools con un dueño temporal (`prueba_esqueletos`, borrado después): 4 indicadores y 5 filas de esqueleto mientras carga, y luego los datos.
  - Para el carrito se le puso stock 5 al producto 5 durante la prueba y se regresó a NULL: en la base local ningún producto tiene stock.
- Sin hex sueltos, degradados, `style="`, `onclick`, `uppercase` ni emojis en lo nuevo.
- **Subida** (a pedido del usuario): commit `d4a3289` en `main` y push (hechos con la cuenta del usuario, porque `root` no tiene identidad de git; se le regresaron a su usuario los archivos de `.git` que habían quedado de `root`). Los 20 archivos de `app/` y `public/` se subieron a IONOS por rsync con las credenciales de `~/secrets.md`, sin guardarlas. En el `app/config.php` del servidor se agregó `url_publica` = `http://s1115824141.onlinehome.mx` (sigue con permisos 600; copia en `app/config.php.antes-url`).
- **En vivo:** `/healthz`; portada, carrito, promociones, cuenta, Necutools, `/t/ropa`, `/t/no-existe`, `/p/1` y `/p/999999` dan 200 con sus etiquetas `og` y la CSP; `/t/ropa` lleva la imagen general y `/p/1` la foto del producto (200 sin `Origin`, como la pide WhatsApp); `/app/*.php` da 404 y la API responde igual.

### 2026-10-29: plan de 3 reels (esqueletos de carga, variantes de botón y vista previa en WhatsApp)
- Nuevo plan `plans/planes/2026-10-29-reels-esqueletos-botones-open-graph.md` y sus 5 prompts en `plans/prompts/` (mismo nombre). No se cambió código.
- Reels: @jiron.design "Deja de usar spinners" (DfBJ5MGtFj_), @jiron.design "Variantes de un botón" (DfDuWCKsfqm) y @go.expoose "Open Graph para WhatsApp" (DfEWnhqMNcp). Solo se leyó el texto del post, con WebFetch a `instagram.com/reel/<id>/embed/captioned/` (la dirección normal del reel devuelve solo "Instagram"). Esta sesión no tiene las herramientas de Claude in Chrome: Claude Code corre como `root` y el navegador abierto es Brave.
- Decisiones del usuario: esqueletos con pulso suave de opacidad (excepción a la regla de movimiento, solo para este plan) y vista previa propia para cada tienda y producto (PHP en `app/paginas.php`, opción nueva `url_publica`).

### 2026-10-26: el stock guardado no era el que se escribía (rueda del mouse)
- El usuario escribió 80 de stock y Necutools mostraba 77. En IONOS el servidor sí recibió 77 (`movimientos_stock`, ajuste +77): en Chrome, la rueda del mouse sobre un campo numérico con el foco cambia el valor (3 vueltas: 80 → 77). Se reprodujo en Chrome sin ventana.
- Además, la Playera básica negra bajó de 77 a 69 porque el pedido 1 (8 piezas) se marcó como pagado: eso es correcto.
- `public/js/comun.js`: la rueda sobre un campo numérico con el foco le quita el foco (la página baja y el número no cambia). `public/js/necutools.js`: el aviso al guardar dice el stock guardado ("· 80 en stock"). `public/necutools.html`: ayuda del campo Stock.
- Probado en local con rueda real en Necutools (se queda en 80) y subido a IONOS. **No se tocaron los datos de IONOS**: el usuario debe volver a capturar el stock correcto de Playera básica negra y roja, Playera Universitaria y Memoria USB.

### 2026-10-26: pedidos con estados, edición y stock (plan `2026-10-26-pedidos-estados-y-stock.md`, prompts 1 a 5)
- Pedido del usuario: estados En proceso / Pagado / Cancelado; editar un pedido en proceso (piezas y artículos, solo de las tiendas asignadas); el stock baja al marcarlo pagado. Decisiones: stock por producto y por color, obligatorio, agotado no se puede pedir, pagado puede volver a en proceso (el stock regresa).
- **Base** (`db/mariadb/schema.sql`, idempotente, corrido 2 veces en local 10.4 y en IONOS 11.8): `productos.stock`, `producto_colores.stock`, tablas `pedido_items`, `pedido_paquete_colores` y `movimientos_stock`; estados `pendiente → en_proceso` y `vendido → pagado` (`pedidos_estado_check2`); migración `pedido-items-2026-10-26` del JSON a `pedido_items` (1 pedido en IONOS).
- **Servidor**: `app/pedidos.php` (transiciones con `TRANSICIONES_PEDIDO`, `descontar_stock`/`devolver_stock` en transacción con `FOR UPDATE`, `PUT /api/admin/pedidos/:id/items`, `GET /api/admin/pedidos/articulos`, resumen con los estados nuevos); `app/admin.php` (stock obligatorio, `falta_stock`, ajustes en `movimientos_stock`); `app/api.php` (`SQL_AGOTADO`, `agotado` en tarjetas y paquetes, colores sin stock deshabilitados, carrito con `quedan`).
- **Necutools** (`public/necutools.html`, `public/js/necutools.js`, `public/style.css`): filtros y acciones por estado, editor del pedido, campo Stock en productos y colores, filtro de stock.
- **Público**: `public/js/comun.js` (etiqueta y botón "Agotado", "Paquete agotado"), `public/js/carrito.js` (baja la cantidad a lo que queda y avisa).
- `scripts/seguridad/ataques.js`: estados nuevos, stock en los productos de prueba y 2 pruebas nuevas (sin correr, no hay Node).
- **Verificación local**: 60 pruebas de API con `curl` (permisos por tienda, 409 sin stock sin cambiar nada, devolución exacta, colores, paquetes, carrito) y 35 en Chrome sin ventana con un cliente CDP propio (Pedidos y editor a 1280 y 360 px, sin scroll horizontal ni errores de consola o CSP). Los datos de prueba se borraron después.
- **IONOS**: 8 archivos subidos por rsync; `/healthz`, tienda, carrito y Necutools responden; las rutas de admin piden sesión.

### 2026-10-26: IONOS por HTTP y cuentas de cliente en pausa (plan `2026-10-26-ionos-sin-https-y-cuentas-en-pausa.md`)
- Pedido del usuario: ver el sitio en `http://s1115824141.onlinehome.mx/` (sin SSL) y poner en pausa entrar y registrarse; solo los admins entran a Necutools.
- `public/.htaccess`: redirección a HTTPS comentada. `app/arranque.php`: `cuentas_clientes()` y `con_https()`. `app/sesiones.php`: cookie sin `Secure` ni `__Host-` si `https` es false. `app/clientes.php`: 403 en `/api/clientes/*` salvo `/sesion` (`pausa: true`); `cargar_cliente()` null. `app/api.php` y `app/resenas.php`: campo `cuentas`. `app/config.ejemplo.php` documenta las dos claves.
- `public/cuenta.html` (aviso `#cuenta-pausa`), `public/js/cuenta.js`, `public/js/comun.js` (`revisarCuentas`, quita "Mi cuenta"), `public/js/producto.js`.
- Probado en local con PHP 8.5 por terminal (pausa: 403 en login y registro, `pausa: true`, `cuentas: false`; activas: igual que antes). Subido a IONOS y `config.php` del servidor con `https` y `cuentas_clientes` en false.
- En vivo: páginas, CSS, JS e imágenes dan 200; `/app/config.php` da 404. El usuario cambió el sitio a PHP 8.5 y la API ya responde en vivo: `/healthz` ok, tiendas, producto, opiniones, vitrina, promociones, carrito, imágenes de la base y de ejemplo; login de cliente 403 (pausa) y de Necutools 401 con datos falsos. **Ninguna tienda tiene números de WhatsApp y `whatsapp_respaldo` está vacío**: hay que ponerlos en Necutools → Tiendas → Editar (pendiente 5).

### 2026-10-26: código y base en IONOS (plan `2026-10-25-migracion-ionos-php-mariadb.md`, prompt 7 a medias)
- Pedido del usuario: subir el sitio a IONOS y crear y conectar la base usando sus credenciales de `~/secrets.md`, sin guardarlas en otro lado.
- SSH/SFTP: el servidor tiene PHP 8.5.12, `mysql` y `rsync`. Se subieron por rsync los 79 archivos de `app/` y `public/` que están en git (sin el `app/config.php` local) a la raíz del espacio web (`/app` y `/public`).
- La base MariaDB 11.8 (`dbs16275017`) la creó el usuario en el panel. Se importó `~/necutla-mariadb.sql` (respaldo del 2026-10-25) por SSH con el cliente `mysql`, con la contraseña pasada solo por stdin: 18 tablas, 7 tiendas, 37 productos, 3 admins, 2 clientes.
- `app/config.php` de producción creado directo en el servidor (permisos 600, secreto nuevo, `produccion` en true). Por terminal, `/healthz` da `{"ok":true}` y `/api/stands` lee de la base.
- No se ve en el navegador todavía: ver pendiente 25.

### 2026-10-25: `plans/CLAUDE.md` actualizado (autorizado por el usuario)
- Sección 1: IONOS (hosting compartido), PHP 8.5 y MariaDB en lugar de Render, Node y PostgreSQL; estructura actual (`public/` con `tienda.html` única, `.htaccess` y `api/index.php`; `app/`; `db/mariadb/schema.sql`; `scripts/`); tiendas que crean los dueños; XAMPP + PHP-FPM en local.
- Sección 4: PHP 8.5 con parches al día, sin Composer, CSP en `public/.htaccess`, parámetros `?` de PDO, `requiere_admin()`, secretos en `app/config.php` (nunca a git, permisos 600), respaldos `.sql` fuera de git, migraciones idempotentes en `db/mariadb/schema.sql` corridas en phpMyAdmin, ataques solo contra localhost.
- Secciones 2 y 3 sin cambios. Resuelve los pendientes 11 y 24 (a).

### 2026-10-25: PHP 8.5 y cierre de los puntos débiles (plan `2026-10-25-php85-y-puntos-debiles.md`)
- Pedido del usuario: revisar los puntos débiles de la revisión de seguridad, cerrarlos y usar la versión más reciente de PHP por la vulnerabilidad PHP2Shell (CVE-2026-109618/109619, corregida el 2026-10-21 en 8.5.12).
- **Local:** `php8.5-fpm`, `-cli`, `-mysql`, `-mbstring`, `-intl` de Ubuntu (`8.5.4-0ubuntu1.5`, ya parchado, USN-8948-1). Pools `/etc/php/8.5/fpm/pool.d/necutla.conf` (como el dueño de la carpeta, `open_basedir`, sin funciones de comandos ni `allow_url_fopen`) y `xampp.conf`. `/opt/lampp/etc/extra/httpd-xampp.conf` (sin `mod_php`) y `necutla.conf` mandan los `.php` a FPM. phpMyAdmin y el dashboard de XAMPP siguen abriendo (200).
- `app/arranque.php`: la API exige PHP 8.5 (503 y aviso en el log; en terminal, mensaje y salida 1); `PRIVADAS` sin importar mayúsculas. `app/bd.php`: `Pdo\Mysql::ATTR_FOUND_ROWS` (lo de antes es obsoleto en 8.5).
- Correos y usuarios en `utf8mb4_nopad_bin` (`db/mariadb/schema.sql`; `app/auth.php` busca el correo del admin en minúsculas): ya no se juntan acentos ni espacios al final. Se cambiaron las bases locales con `ALTER TABLE` y se volvió a generar `~/necutla-mariadb.sql` (importa bien, 37 productos, 2 clientes, 3 admins).
- `public/.htaccess`: la redirección a HTTPS ya no se salta con una cabecera `X-Forwarded-Proto` falsa (probado: 301).
- `scripts/seguridad/ataques.js`: 5 pruebas nuevas. `README.md`: PHP 8.5, FPM en local, checklist de IONOS con PHP 8.5 y permisos 600.
- **Verificación con PHP 8.5:** ataques 232 de 232; Node contra PHP con los mismos datos 54 de 54 iguales; navegador 94 de 94 (solo el aviso de consola de siempre, que también sale con Node); `crear-admin.php` con `php8.5` bien y con el PHP 8.2 da el aviso.

### 2026-10-25: servidor en PHP para IONOS (plan `2026-10-25-migracion-ionos-php-mariadb.md`, prompts 1 a 6)
- `app/` (nuevo, fuera de `public/`): las 63 rutas de `server/` pasadas a PHP sin Composer, con el mismo JSON (`arranque.php`, `bd.php`, `http.php`, `seguridad.php`, `sesiones.php`, `validar.php`, `contrasenas.php`, `intentos.php`, `totp.php`, `bitacora.php`, `imagenes.php`, `ofertas.php`, `auth.php`, `clientes.php`, `api.php`, `resenas.php`, `pedidos.php`, `admin.php`, `config.ejemplo.php`). `app/config.php` local, ignorado por git.
- `public/.htaccess` (direcciones, redirecciones, cabeceras, caché), `public/api/index.php`, `public/404.txt`, `public/vendor/chart.umd.js` (Chart.js 4.4.7, mismo sha512 que el `package-lock`).
- `scripts/crear-admin.php` (reemplaza `ADMIN_USERNAME`/`ADMIN_PASSWORD`); `scripts/seguridad/totp.js` (antes `server/totp.js`); `ataques.js` apunta a `http://localhost:8081`.
- Se borraron `server/`, `package.json`, `package-lock.json`, `.node-version`, `render.yaml`, `db/schema.sql`, `scripts/importar-ejemplos.js`, `db/ejemplos.json`, `db/servicios-ejemplo.json` y `.env.example` (siguen en el historial de git). `README.md` reescrito para XAMPP e IONOS.
- XAMPP: virtual host en el puerto 8081 (`/opt/lampp/etc/extra/necutla.conf`) y permiso de paso (`setfacl`) al usuario `daemon` en la carpeta personal.
- **Verificación** (nunca contra Render ni IONOS): Node viejo (puerto 3077, PostgreSQL de prueba 54329) contra PHP con los mismos datos, 54 de 54 respuestas iguales; ataques 225 de 225; navegador 94 de 94 a 1280 y 360 px; `/security-review` sin vulnerabilidades de confianza alta (los 8 puntos que se descartaron se revisaron en la entrada de arriba).

### 2026-10-25: base para IONOS en MariaDB y plan del cambio de hoster (plan `2026-10-25-migracion-ionos-php-mariadb.md`)
- Pedido del usuario: preparar el cambio de Render a IONOS (hosting compartido, MariaDB, sin PostgreSQL) y un query para crear la base nueva con los datos del respaldo `~/Descargas/necutla` (pg_dump custom de Render).
- `db/mariadb/schema.sql` (nuevo): las 15 tablas en MariaDB 10.4+ más `sesiones` y `limites` para el servidor en PHP. Equivalencias en la sección 2 del plan.
- `scripts/migracion/pg-a-mariadb.py` (nuevo): convierte un respaldo de PostgreSQL al `.sql` de MariaDB (fechas a UTC, booleanos, bytea en hex, arreglos a JSON, sin `session`).
- `~/necutla-mariadb.sql` (fuera del repo, permisos 600): esquema + datos (7 tiendas, 24 subcategorías, 37 productos, 3 admins, 2 clientes, 4 migraciones, 2 de bitácora).
- Verificado en el MariaDB 10.4.32 de XAMPP (base `necutla_prueba_ionos`): importa sin error, conteos iguales, foto idéntica (MD5), acentos, esquema 2 veces sin error, CHECK del color, correo único sin importar mayúsculas, `Axel`/`AXEL` distintos.
- Plan y 7 prompts nuevos (`plans/planes/` y `plans/prompts/`). No se cambió el servidor ni el frontend.
- Se arrancó el `apache2` del sistema para pgAdmin (http://localhost:8080/pgadmin4); XAMPP ya estaba corriendo.

### 2026-10-21: colores de un mismo producto (plan `2026-10-21-colores-por-producto.md`, prompts 1 a 4)
- Pedido del usuario: no crear el mismo producto varias veces por color; agregar solo los colores que se manejan, cada uno con su foto, y que el cliente vea una barra con los colores.
- **Base**: tabla `producto_colores` en `db/schema.sql` (nombre, hex, foto, disponible, orden; nombre único por producto sin importar mayúsculas).
- **API Necutools** (`server/admin.js`): `GET /admin/productos` trae `colores`; `POST /admin/productos/:id/colores`, `PUT /admin/colores/:id`, `DELETE /admin/colores/:id` con permisos de tienda, foto sin metadatos, máximo 12 y bitácora (`producto_colores`). Al volverse servicio se borran sus colores. `server/index.js`: esas rutas aceptan cuerpo de 2 MB.
- **API pública** (`server/api.js`): `/api/colores/:id/imagen`, `colores_total` en tarjetas y `colores` en `/api/productos/:id`. El carrito acepta `color`: un producto con colores sin color elegido, con color agotado o de otro producto va a faltantes; el nombre del renglón lleva el color ("Audífonos (Rojo)"). `server/pedidos.js` guarda el color y el resumen sigue agrupando por producto.
- **Necutools** (`public/necutools.html`, `public/js/necutools.js`): tarjeta "Colores de …" al editar un producto (lista, agregar, editar, borrar, disponible); un producto nuevo se queda abierto para agregar colores; "· N colores" en el catálogo.
- **Público**: barra de colores en `public/producto.html` / `public/js/producto.js` (cambia la foto, `?color=`, agotados deshabilitados); en las tarjetas, etiqueta "N colores" y botón "Elegir color" (`public/js/comun.js`); `claveItem()` y `pintarMuestras()` en `comun.js`; `public/js/carrito.js` maneja un renglón por color. Estilos en `public/style.css`.
- **Pruebas** (base local, puerto 3077, nunca Render): 29 pruebas de API de colores (permisos de encargado, validaciones, carrito, pedido) y `scripts/seguridad/ataques.js` 225 de 225 (con `CORREO_DNS_PRUEBA=1`; en una primera corrida falló una vez una prueba de 2 pasos por el reloj del código). No se revisó en navegador (sin herramienta de navegador en la sesión).

### 2026-10-20: apartado de Servicios en cada tienda (plan `2026-10-20-servicios-por-tienda.md`, prompts 1 a 3)
- Pedido del usuario: que cada tienda tenga, aparte de los productos, un apartado de servicios (dulceros en Dulces, estampado de logos en Ropa, reparaciones en Tecnología). Los servicios ya existían en la base y en Necutools, pero la pestaña se escondía si la tienda no tenía ninguno y no había ninguno cargado.
- Decisiones del usuario: sección propia siempre visible (la pestaña se queda y baja a ella) y servicios de ejemplo en todas las tiendas, también en Render (ver pendiente 13).
- **Ejemplos**: `db/servicios-ejemplo.json` (10 servicios en las 7 tiendas, "desde" o "a cotizar") y `importarServicios()` en `server/ejemplos.js` con la migración `servicios-ejemplo-2026-10-20` (una sola vez: si el vendedor borra uno, no regresa). Se llama en `server/index.js` y `scripts/importar-ejemplos.js`.
- **Tienda**: `public/tienda.html` con la sección `#servicios` (h2, descripción, grid, aviso de vacío con icono `wrench`, "Mostrar más servicios"). `public/js/tienda.js`: `renderServicios()`, `irAServicios()` (scroll suave o directo con movimiento reducido, foco en el título); la pestaña "Servicios (n)" siempre aparece y baja a la sección; la lista principal solo muestra productos u ofertas; `?tab=servicios` y `#servicios` bajan a la sección.
- Enlaces a `/t/<slug>#servicios` en `public/js/comun.js` (búsqueda y vitrina) y `public/js/producto.js` (Volver). Imagen por defecto `public/imagenes/servicio.svg` para servicios sin foto (`imagenDe`).
- `public/style.css`: `.servicios-tienda` (margen 56px, `scroll-margin-top` 24px y 88px en celular por la barra superior). Solo tokens existentes.
- Texto de ayuda de Necutools y `README.md`.
- **Verificación** (servidor local + PostgreSQL 17 instalado en la máquina, base temporal en el puerto 54329, nunca Render; Edge sin ventana con `puppeteer-core`): 3 arranques sin duplicar (10 servicios); un servicio borrado no regresa; 24 pruebas en navegador a 1280 y 360px (sección, pestaña que baja y enfoca, WhatsApp con el servicio, aviso de tienda sin servicios, `?tab=servicios`, `#servicios`, buscador → "Ver en Ropa", Volver desde el servicio, sin scroll horizontal, cero errores de consola o CSP); ataques 225 de 225.

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

En local (XAMPP con el PHP 8.5 de Ubuntu, ver `README.md`): arrancar XAMPP (`sudo /opt/lampp/lampp start`;
`php8.5-fpm` arranca solo) y abrir http://localhost:8081/

En producción: hasta el cambio a IONOS, la URL de Render (`necutla.onrender.com`); después, el dominio de IONOS.
