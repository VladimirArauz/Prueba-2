# Plan: lo que le falta a Necutla de la lista legal de @cooked_dev_ (eliminar cuenta, edad y textos legales)

- **Fecha:** 2026-11-04
- **Estado:** aplicado en local (prompts 1 a 4, 2026-11-04). Falta subirlo a IONOS (schema y archivos)
- **Prompts:** `plans/prompts/2026-11-04-cumplimiento-legal-cuenta-y-edad.md`
- **Alcance:** `db/mariadb/schema.sql` (consentimiento de edad, opiniones anónimas, código para eliminar), `app/clientes.php`,
  `app/codigos.php`, `app/correo.php`, `app/resenas.php`, `app/admin.php` (lista de opiniones), `public/cuenta.html`,
  `public/js/cuenta.js`, `public/style.css` (solo si hace falta una clase), `public/privacidad.html`, `public/terminos.html`,
  `public/index.html` (revisar textos de la portada), `scripts/seguridad/ataques.js`, `README.md`. Sin cambios en el carrito,
  la API de pedidos, Necutools (fuera de la lista de opiniones) ni el envío a WhatsApp. Continúa el plan
  `2026-10-31-seo-iconos-contenido-y-legal.md` (no lo reemplaza).

## Contexto

TikTok de @cooked_dev_ (video 7702821446724226326, visto con vidIQ el 2026-11-04): "20 cosas que Claude debe hacer para que
no demanden a tu app". Revisión contra Necutla:

- **Ya se cumple (14):** aviso de privacidad y términos; política de cookies (una sola cookie de sesión, Web Analytics sin
  cookies: no hace falta banner); pedir solo lo necesario; terceros declarados (Cloudflare); sin patrones oscuros ni cobros
  escondidos; `alt`, contraste AA y teclado (reglas de diseño); sin correos de publicidad (no hace falta "darse de baja");
  fotos de Unsplash con licencia.
- **Falta o está a medias (6):**
  1. **Datos del responsable** (`public/privacidad.html:101`, `[COMPLETAR]`): la LFPDPPP exige nombre y domicilio.
  2. **Menores de edad** (`public/privacidad.html:148`, `[COMPLETAR]`): no se pide ningún consentimiento.
  3. **Borrar datos:** solo por correo a tienda@necutla.com (derechos ARCO). No hay botón en Mi cuenta.
  4. **Reembolsos y devoluciones:** los términos dicen que el pedido es con la tienda, pero no hablan de devoluciones.
  5. **Opiniones:** no hay "compra verificada" (los pedidos se cierran por WhatsApp); los términos no lo aclaran.
  6. **Promesas sin respaldo:** revisar los textos de la portada y de los legales.
  Además faltan las fechas de los dos documentos y la ciudad o estado de los términos.

## Decisiones del usuario (2026-11-04)

- **Menores:** casilla obligatoria al crear cuenta: "Tengo 18 años o más, o mi madre, padre o tutor me dio permiso de crear
  esta cuenta". El servidor guarda cuándo se aceptó. No se pide fecha de nacimiento.
- **Al eliminar la cuenta, las opiniones se quedan anónimas** (se muestran como "Cliente de Necutla"): las tiendas no
  pierden calificaciones. Se borran la cuenta (nombre, usuario, correo, teléfono, contraseña), sus sesiones, sus códigos y
  sus intentos de login.
- **Para eliminar, código por correo** (como al entrar), además de la ventana de confirmación de peligro.

## Diseño de la solución

### 1. Base (`db/mariadb/schema.sql`, idempotente; se corre en local y en IONOS)

- `clientes.edad_aceptada_en DATETIME(6)` (nulo en las cuentas de antes).
- `resenas.cliente_id` pasa a nulo con la llave foránea `ON DELETE SET NULL`: `ALTER TABLE resenas MODIFY cliente_id INT
  UNSIGNED NULL`, `DROP FOREIGN KEY IF EXISTS resenas_cliente_fk` y `ADD CONSTRAINT resenas_cliente_fk2 … ON DELETE SET
  NULL` (nombre nuevo, como `pedidos_estado_check2`, para que se pueda correr dos veces). El índice único
  `(producto_id, cliente_id)` permite varios nulos, así que las anónimas no chocan.
- `codigos_correo`: propósito nuevo `eliminar` (`DROP CONSTRAINT IF EXISTS codigos_correo_proposito_check` y
  `ADD CONSTRAINT IF NOT EXISTS codigos_correo_proposito_check2 … IN ('login', 'registro', 'restablecer', 'eliminar')`).
  Revisar que la columna `proposito` (VARCHAR(12)) alcance.
- No se borra ningún dato en la migración.

### 2. Servidor

- **Registro** (`POST /api/clientes/registro`): campo nuevo `edad` (booleano, obligatorio; 400 "Marca la casilla de edad
  para crear tu cuenta."). Va en `datos` del código y `registro/codigo` guarda `edad_aceptada_en = NOW(6)`.
- **Cuentas de antes:** `incompleta` también es true si `edad_aceptada_en` es nulo; `PUT /api/clientes/completar` acepta y
  exige `edad` en ese caso. (Así los 2 clientes reales la aceptan la próxima vez que entren.)
- **Eliminar cuenta:**
  - `POST /api/clientes/eliminar` (`requiere_cliente()`, `limitar_cambios_cliente()`): manda un código `eliminar` al correo
    de la cuenta con `crear_codigo` (mismos límites: 10 min, un uso, 5 intentos, reenviar cada 60 s). Responde
    `{codigo: true, correo: "a***@…", espera}` como el login.
  - `POST /api/clientes/eliminar/codigo`: `verificar_codigo('eliminar', …)`, revisa que el código sea de la cuenta de la
    sesión, y en una transacción borra los códigos del correo, los `intentos_login` de esa cuenta, las sesiones del
    cliente y la fila de `clientes` (las opiniones quedan con `cliente_id` nulo). Cierra la sesión de cliente con
    `Sesion::regenerar`/`destruir` como `logout` (respeta la sesión de Necutools del mismo navegador). Responde
    `{eliminada: true}`.
  - `/codigo/reenviar` y el paso pendiente de `/sesion` (`codigoPendiente`) también entienden `eliminar`.
  - `app/correo.php`: asunto "Tu código para eliminar tu cuenta de Necutla" y texto que diga que, si no lo pidió, cambie su
    contraseña.
- **Opiniones anónimas:** `app/resenas.php:56` y `app/admin.php:691` pasan a `LEFT JOIN clientes` con
  `COALESCE(c.nombre, 'Cliente de Necutla')`. Una opinión anónima no la puede editar nadie; la tienda la puede seguir
  respondiendo u ocultando.

### 3. Mi cuenta (`public/cuenta.html`, `public/js/cuenta.js`)

- Registro: casilla `#registro-edad` (con `label`, `required`) antes del captcha; el texto de aviso de términos se queda.
  Mensaje de error bajo la casilla con el mismo estilo de la validación en vivo.
- "Completa tu cuenta": la misma casilla cuando falta (`#completar-edad-grupo`).
- Tarjeta nueva al final de la sesión: h2 "Eliminar mi cuenta", descripción "Se borran tu nombre, usuario, correo y
  teléfono. Tus opiniones se quedan sin tu nombre. No se puede deshacer.", botón `.btn.danger` "Eliminar mi cuenta".
  Al tocarlo: `confirmar()` con `peligro` → `POST /eliminar` → se reutiliza la tarjeta `#cuenta-codigo` con un modo
  `eliminar` en el objeto de pasos (`ruta: "/clientes/eliminar/codigo"`, título "Revisa tu correo para eliminar tu
  cuenta"). Al terminar: toast "Eliminamos tu cuenta" y se muestra la pantalla de entrar.
- Solo tokens y clases existentes; iconos de Lucide (`trash-2` si ya está en `iconos.js`, si no se agrega su `<symbol>`).

### 4. Textos legales

- `public/terminos.html`:
  - "Tu pedido es con la tienda": párrafo de **cambios y devoluciones**: Necutla no cobra ni recibe pagos; los cambios,
    devoluciones y reembolsos se acuerdan con la tienda, que debe decir sus condiciones antes de confirmar el pedido.
  - "Tu cuenta": la casilla de edad y que puedes eliminarla desde Mi cuenta.
  - "Opiniones": las publican clientes con cuenta, Necutla no comprueba que hayan comprado; las opiniones de cuentas
    eliminadas se quedan sin nombre.
  - "Las tiendas": no publicar ofertas, descuentos o características que no puedan cumplir.
  - Fecha y ciudad o estado (`[COMPLETAR]`).
- `public/privacidad.html`:
  - Responsable y domicilio (`[COMPLETAR]`), fecha.
  - "Qué datos guardamos": la fecha en que aceptaste la casilla de edad.
  - "Cuánto tiempo los guardamos" y "Tus derechos": eliminar la cuenta desde Mi cuenta (además del correo); qué se borra y
    que las opiniones quedan anónimas.
  - "Menores de edad": el texto final con la casilla (quitar el `[COMPLETAR]`).
- `public/index.html`: revisar "Qué es Necutla", "Cómo funciona" y las preguntas frecuentes para que no prometan lo que
  Necutla no controla (entrega, precios fijos, respuesta inmediata).

**Datos que solo el usuario puede dar (prompt 3):** nombre del responsable, domicilio o ciudad y estado, fecha de
publicación y ciudad o estado para controversias. Si no los tiene, se dejan los `[COMPLETAR]` y se avisa.

## Fuera de alcance

- Banner de cookies (no hace falta mientras no haya cookies de publicidad o rastreo).
- "Compra verificada" (los pedidos no guardan quién compró).
- Revisión de un abogado (se recomienda, no se hace aquí).

## Pruebas

- Schema corrido 2 veces seguidas sin error en local; revisar que la opinión de una cuenta borrada se quede.
- `curl`: registro sin `edad` 400; con `edad` guarda la fecha; cuenta vieja `incompleta` hasta aceptar; eliminar sin
  sesión 401; código equivocado 5 veces; código de otra cuenta no sirve; al eliminar se borran cliente, sesiones, códigos e
  intentos y la opinión sale como "Cliente de Necutla" en la tienda y en Necutools; el mismo correo puede registrarse otra
  vez.
- Chrome sin ventana (cliente CDP propio) a 1280, 360 y con movimiento reducido: casilla con teclado, error bajo la casilla,
  flujo completo de eliminar (ventana, código, toast, pantalla de entrar), sin scroll horizontal ni errores de consola.
- `scripts/seguridad/ataques.js`: pruebas nuevas (sin correrlas si no hay Node; revisar sintaxis).
- Datos de prueba borrados al terminar.
