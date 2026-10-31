# Plan: código por correo (OTP), sesión de cliente sin vencimiento y revisión de 2 reels

- **Fecha:** 2026-10-30
- **Estado:** aplicado (prompts 0 a 5 el 2026-10-30, subido a IONOS)
- **Prompts:** `plans/prompts/2026-10-30-codigo-por-correo-y-sesion-permanente.md` 
- **Alcance:** solo cuentas de cliente (Mi cuenta). Necutools no cambia: sigue con su login, su 2 pasos por app
  y su sesión de 8 h sin uso / 24 h máximo. Archivos: `app/` (`correo.php` nuevo, `codigos.php` nuevo,
  `clientes.php`, `sesiones.php`, `arranque.php`, `config.ejemplo.php`), `db/mariadb/schema.sql`,
  `public/cuenta.html`, `public/js/cuenta.js`, `public/js/codigo.js` (nuevo), `public/style.css`,
  `public/iconos.js` (si falta algún icono), `README.md`, `scripts/seguridad/ataques.js`.

## Context

El usuario pidió aplicar el reel @anees05it (DfCQB9LMm5Y): un campo de código OTP de 6 cuadritos sin
librerías, donde el cursor avanza solo, cada dígito hace "pop", si el código está mal los cuadros se ponen
rojos, tiemblan y se vacían, y si está bien se ponen verdes con brillo y dicen "verificado". El código
(el usuario lo llama "código opaco") se manda al correo registrado desde **tienda@necutla.com** y hace falta
para **iniciar sesión, registrarse y restablecer la contraseña** ("Olvidé mi contraseña", que hoy no existe:
pendiente 14). Además: la sesión de cliente **no vence** hasta que la persona cierre sesión, y al registrarse
la sesión se inicia sola (eso ya pasa hoy y se conserva después del código).

Decisiones del usuario (2026-10-30): solo clientes; sesión sin vencimiento solo para clientes; **brillo
verde autorizado como excepción a `plans/CLAUDE.md` solo para este plan**; remitente `tienda@necutla.com`
(en `~/secrets.md` la línea dice `tiendita@`: si el SMTP rechaza `tienda@`, se le pregunta al usuario).

**Reels anteriores, revisados (no hace falta aplicar nada):**
- DfBJ5MGtFj_ (esqueletos de carga): aplicado. `pintarEsqueletos` en `comun.js` y se usa en portada,
  tienda, carrito, promociones y Necutools; sección "ESQUELETOS DE CARGA" en `style.css`; en vivo en necutla.com.
- DfDuWCKsfqm (variantes y estados de botón): aplicado. `botonOcupado`/`botonListo` en `comun.js`, usados en
  cuenta, producto y Necutools; `.btn:disabled` y `.btn[aria-busy="true"]` en `style.css`; tabla "Qué botón
  usar" en `README.md`; en vivo. Lo nuevo de este plan los reutiliza (botón "Reenviar código" deshabilitado con
  cuenta atrás, botones ocupados al enviar).

## Diseño

### 1. Envío de correo (`app/correo.php`, sin Composer)
- Cliente SMTP propio con `stream_socket_client('ssl://smtp.ionos.mx:465')` (o 587 + STARTTLS), verificando el
  certificado: `EHLO`, `AUTH LOGIN`, `MAIL FROM`, `RCPT TO`, `DATA`. Mensaje `multipart/alternative` (texto + HTML),
  UTF-8 en base64, `Message-ID`, `Date`, asunto codificado (RFC 2047). Sin CR/LF en nombres ni asuntos.
- `enviar_correo(string $para, string $asunto, string $texto, string $html): void`; si falla, `error_log` sin el
  código y error 503 "No pudimos mandar el correo. Intenta en unos minutos."
- Config nueva `correo` en `app/config.php` (`host`, `puerto`, `usuario`, `password`, `remitente`, `nombre`,
  `modo` = `smtp` | `archivo`). En local `modo: archivo` escribe los correos en `/tmp/necutla-correos/` (fuera
  de `public/`) para las pruebas. Documentar en `app/config.ejemplo.php` y `README.md`. La contraseña del buzón
  se copia de `~/secrets.md` al `config.php` del servidor (permisos 600) **sin imprimirla nunca** (leer la línea
  exacta a una variable; ver memoria "No imprimir secrets.md").
- Plantilla del correo (`plantilla_codigo($proposito, $codigo, $nombre)`): encabezado `--tinta` con "Necutla",
  el código grande con dígitos separados y tabulares, "Vence en 10 minutos", qué hacer si no lo pediste.
  Sentence case, sin emojis. **Excepción técnica:** el HTML del correo lleva estilos en línea y hex (los clientes
  de correo no leen `style.css`); los hex salen de constantes PHP con el nombre de su token. No se sirve en el sitio.

### 2. Códigos (`app/codigos.php` + tabla `codigos_correo`)
- Tabla nueva idempotente en `db/mariadb/schema.sql`: `id`, `proposito` (`login`/`registro`/`restablecer`),
  `correo`, `cliente_id` NULL, `codigo_hash` (HMAC-SHA256 con `config('secreto')`), `datos` JSON (registro
  pendiente: nombre, usuario, país, teléfono y **hash bcrypt** de la contraseña, nunca en claro), `intentos`,
  `expira`, `usado_en`, `creado_en`, `ip`. Índices por `correo` y `expira`. Se borran los vencidos al crear uno.
- `crear_codigo($proposito, $correo, $clienteId, $datos)`: 6 dígitos con `random_int`, invalida el anterior del
  mismo correo y propósito, guarda en la sesión `codigoPendiente = {id, proposito, hasta}` (el código solo vale
  en el navegador que lo pidió) y manda el correo.
- `verificar_codigo($proposito, $codigo)`: `hash_equals`, un solo uso, 10 minutos, 5 intentos y se anula;
  freno por cuenta con `exigir_no_frenada`/`registrar_fallo` (`app/intentos.php`, tipo `codigo`) y por IP con
  `limitar` (`app/seguridad.php`).
- Reenviar: 60 s entre envíos y máximo 5 por hora por correo; además `limitar('correo-ip', …)` por IP.
- Correo enmascarado en las respuestas (`a***@gmail.com`).

### 3. Rutas de cliente (`app/clientes.php`)
Se reutilizan `iniciar_sesion_cliente`, `password_cliente`, `revisar_correo`/`correo_real`, `usuario_valido`,
`v_telefono`, `cerrar_otras_sesiones_cliente` y el patrón `pendiente` del 2 pasos de `app/auth.php`.
- `POST /api/clientes/login`: igual que hoy hasta revisar la contraseña; en vez de entrar, crea el código y
  responde `{codigo: true, correo: "a***@…"}`. `POST /api/clientes/login/codigo` → `iniciar_sesion_cliente`.
- `POST /api/clientes/registro`: valida todo igual que hoy (409 si ya existe), cifra la contraseña y guarda el
  registro pendiente en el código; **no** crea la cuenta. `POST /api/clientes/registro/codigo` inserta en
  `clientes` (409 si alguien la tomó mientras) e inicia sesión sola (`iniciar_sesion_cliente`).
- `POST /api/clientes/restablecer` (`identificador`): siempre responde lo mismo, exista o no la cuenta (no revela
  correos); si existe y está activa, manda el código. `POST /api/clientes/restablecer/codigo` deja en la sesión
  `restablecerOk` por 10 min. `POST /api/clientes/restablecer/password` (`nueva`, `confirmar`, con
  `password_cliente`): cambia la contraseña, `sesion_version + 1`, cierra las demás sesiones e inicia sesión aquí.
- `POST /api/clientes/codigo/reenviar`. Todas pasan por `exigir_mismo_origen()` (ya global en `/api`).
- `GET /api/clientes/sesion` agrega `codigoPendiente` (propósito y correo enmascarado) para retomar el paso.

### 4. Sesión de cliente sin vencimiento (`app/sesiones.php`)
- Duración por sesión: con `clienteId` y sin `adminId`, cookie y `sesiones.expira` a **400 días** (el máximo que
  acepta Chrome), renovados en cada visita: en la práctica no vence. Sin cliente, 8 h como hoy.
- `vida_maxima()`: el límite de 24 h y el de 8 h sin uso solo aplican a la parte de Necutools. Si en el mismo
  navegador hay cliente y admin, al vencer el admin se regenera la sesión conservando solo las claves del cliente
  (nueva clave `adminUso` con la última petición del admin).
- Sigue cerrándose: al tocar "Cerrar sesión", al cambiar o restablecer la contraseña (`sesion_version`) y si se
  desactiva la cuenta (`cargar_cliente`).

### 5. Componente OTP (`public/js/codigo.js` + `style.css`, sección "CÓDIGO POR CORREO")
- `crearCampoCodigo(contenedor, {alCompletar})`: 6 `<input>` `inputmode="numeric"`, `autocomplete="one-time-code"`
  (el primero), `maxlength=1`, cada uno con `<label class="visually-hidden">Dígito N de 6</label>`, dentro de un
  `role="group"`. Avanza solo, Backspace regresa, flechas, pegar reparte los 6 dígitos, al completar envía solo.
- Efectos (respuesta a una acción, permitidos): **pop** (`scale` 1 → 1.12 → 1) al escribir cada dígito;
  **error**: borde y texto `--aviso`, **temblor** horizontal 400 ms, se vacía y el foco vuelve al primero, mensaje
  en `aria-live`; **acierto**: borde `--wa`, icono `circle-check` y "Verificado", con **brillo verde**
  (`box-shadow` con `--wa` transparente en un token nuevo `--brillo-wa`, como `--velo` con `--tinta`; excepción
  autorizada solo para este plan). Con `prefers-reduced-motion`: sin pop, sin temblor y sin brillo animado.
- Botón "Reenviar código" `.btn.secondary` deshabilitado con cuenta atrás ("Reenviar código en 45 s"), con
  `botonOcupado`/`botonListo`. Enlace "Cambiar correo" / "Volver" para regresar al formulario.
- Sin `style=""`, sin `onclick`, eventos con `data-action` y el listener delegado; sin hex sueltos.

### 6. Pantallas (`public/cuenta.html`, `public/js/cuenta.js`)
- Entrar: formulario de hoy → paso "Revisa tu correo" (correo enmascarado + campo OTP) → sesión iniciada
  (respeta `?volver=`). Enlace "¿Olvidaste tu contraseña?" debajo de la contraseña.
- Crear cuenta: formulario de hoy → paso del código → sesión iniciada y "Tu cuenta está lista".
- Restablecer: usuario o correo → código → contraseña nueva dos veces con el medidor de `public/js/validacion.js`
  → sesión iniciada. Se conservan todos los `id`, `name` y `data-action` actuales y el panel deslizante.
- Textos: "Te mandamos un código a a***@gmail.com", "El código no es correcto. Revisa el último correo de
  Necutla.", "El código venció. Pide otro.".

## Prompts

En `plans/prompts/2026-10-30-codigo-por-correo-y-sesion-permanente.md` (prompts 0 a 5, en orden).

## Verificación (resumen)
- Local con `php8.5` + XAMPP y correos en `/tmp/necutla-correos/`; nunca ataques contra IONOS.
- `curl`: los casos del prompt 2 y 3, 401/429 donde toca, ninguna respuesta revela si un correo existe en
  restablecer, el código nunca aparece en respuestas ni en el log.
- Navegador: los casos del prompt 4.
- En vivo: correo real recibido desde `tienda@necutla.com` (revisar que no caiga en spam; si cae, ver SPF/DKIM
  del dominio en IONOS), flujo completo y cookie `__Host-necutla.sid` con `Expires` a 400 días.

## Riesgos y notas
- Los 2 clientes reales necesitarán su correo para entrar; si no tienen acceso, usan "Olvidé mi contraseña" o se
  les ayuda desde la base.
- Si el correo falla (SMTP caído), nadie puede entrar ni registrarse: el error lo dice claro y se puede volver
  a la pausa con `cuentas_clientes` en false.
- Una sesión de 400 días en un celular perdido queda abierta: la persona la cierra cambiando la contraseña
  desde otro dispositivo (cierra las demás sesiones).
