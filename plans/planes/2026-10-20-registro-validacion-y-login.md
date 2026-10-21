# Registro con más datos, validación en vivo y login con usuario o correo

- **Fecha:** 2026-10-20
- **Estado:** aplicado
- **Prompts:** `plans/prompts/2026-10-20-registro-validacion-y-login.md`
- **Alcance:** registro de clientes (usuario, teléfono con lada por país, correo con dominio real), validación en vivo bajo cada campo, medidor de contraseña, reglas de contraseña obligatorias con confirmación en todo cambio, y login con usuario o correo en la tienda y en Necutools. Se trabaja en `main`.

## Contexto

El usuario quiere:
- **Registro más completo:** nombre de usuario, correo, teléfono con lada por país y contraseña.
- **Validación en vivo:** debajo de cada campo aparece qué está mal, y el campo se pone en verde cuando ya es válido.
- **Medidor de contraseña:** débil, media, fuerte o súper segura.
- **Reglas de contraseña:** mayúsculas, minúsculas, números y caracteres especiales son obligatorios en toda contraseña nueva (registro, cambio y restablecimiento), y la nueva se confirma dos veces.
- **Login en un solo campo:** "Usuario o correo", tanto en la tienda como en Necutools.

Decisiones del usuario (2026-10-20):
- **Correo:** se acepta cualquier dominio real. El servidor revisa el formato y que el dominio reciba correo (DNS MX).
- **Verde `--wa` para campos válidos:** excepción a `plans/CLAUDE.md` autorizada solo para ese estado. Se anota en MEMORIA.
- **Usuario y nombre:** se agrega un nombre de usuario único para entrar y se conserva el nombre visible en las opiniones.
- **Teléfono obligatorio:** se guarda solo en la base; no se muestra en opiniones ni a las tiendas.

Lo que encontré en el código:
- `clientes` (`db/schema.sql:243`) no tiene columnas de usuario ni teléfono.
- `admins` no tiene correo.
- El login de admin compara `usuario = $1` y distingue mayúsculas (`server/auth.js:206`). En producción ya existen `Axel` (id 1) y `axel` (id 3).
- `validarContrasena` (`server/contrasenas.js`) ya revisa largo, 72 bytes, contraseñas comunes y que no contenga el usuario. Le falta exigir los tipos de carácter.
- Necutools → Mi cuenta ya tiene "Repite la contraseña nueva" (`necutools.js:1180`). Usuarios, al crear o reiniciar una contraseña, no la pide.
- Los clientes no pueden cambiar su contraseña.
- No hay "olvidé mi contraseña" porque no hay servicio de correo; sigue fuera de alcance (pendiente 14).

## Qué se hace

Se trabaja directo en `main` (regla del usuario: sin ramas nuevas). Usa `contrasenas.js`, `intentos.js` y la sesión nueva del plan de seguridad, que ya está en `main`.

### 1. Base (`db/schema.sql`, idempotente, sin borrar datos)

- **`clientes`:** columnas nuevas, nulas para las cuentas que ya existen:
  - `usuario VARCHAR(30)`, con índice único parcial sobre `lower(usuario)`.
  - `pais CHAR(2)`.
  - `telefono VARCHAR(16)` en formato E.164, ej. `+525512345678`.
- **`admins`:**
  - `correo VARCHAR(120)` nulo, con índice único parcial sobre `lower(correo)`.
  - Índice único sobre `lower(usuario)` **solo si no hay duplicados**. Hoy chocan `Axel` y `axel`: el prompt 2 se detiene y le pregunta al usuario cuál renombrar o desactivar antes de crear el índice.
- **Usuario de cliente:** mismas reglas que los admins (`^[a-z0-9._-]{3,30}$`, en minúsculas). No puede llevar `@`; así el login distingue un usuario de un correo.

### 2. Servidor

- **`public/datos/paises.json` (nuevo):** lista de países con ISO, nombre, lada y largos válidos del número nacional, según el plan de numeración de cada país (estándar E.164: hasta 15 dígitos con la lada).
  - México va primero: +52, 10 dígitos.
  - EE. UU. y Canadá: +1, 10. España: +34, 9. Colombia: +57, 10. Argentina: +54, 10. Perú: +51, 9. Chile: +56, 9.
  - Incluye el resto de Latinoamérica y los países más comunes.
  - El servidor lo lee con `require`, así hay una sola fuente de datos. No se agregan dependencias (sin libphonenumber).
- **`server/validar.js`:**
  - `correoReal(valor)`: formato estricto (sin espacios, un solo `@`, dominio con punto y TLD de 2 o más letras, largo ≤ 120). Luego `dns.promises.resolveMx` con 3 s de tiempo y una caché de 1 h por dominio.
    - Sin MX, o con `NXDOMAIN`: "Ese dominio no recibe correos. Revisa que esté bien escrito."
    - Si falla el DNS (tiempo agotado): se acepta, para no bloquear el registro.
    - Sugiere el dominio correcto en errores comunes: gmial.com → gmail.com, hotmial.com → hotmail.com, outlok.com → outlook.com.
  - `telefono(pais, numero)`: deja solo dígitos, revisa que el largo sea uno de los del país y devuelve E.164.
  - `usuarioValido(valor)`.
- **`server/contrasenas.js`:** `validarContrasena` además exige minúscula, mayúscula, número y carácter especial, con un mensaje que dice exactamente qué falta. Se agrega `confirmar`: si no coincide, "Las contraseñas no coinciden." Mínimos: clientes 10, admins 12. Las cuentas que ya existen siguen entrando igual.
- **`server/clientes.js`:**
  - **Registro:** recibe `nombre`, `usuario`, `correo`, `pais`, `telefono`, `password` y `confirmar`. Con usuario o correo repetido responde 409 sin decir cuál de los dos ("Ese usuario o correo ya tiene cuenta").
  - **`POST /revisar-correo` (nuevo):** solo formato y MX, nunca dice si el correo ya tiene cuenta. Tiene su propio límite de 60 por 15 min por IP y es la que usa la validación en vivo.
  - **Login:** recibe `identificador` (y sigue aceptando `correo` para no romper). Si lleva `@`, busca por `lower(correo)`; si no, por `lower(usuario)`. El freno por cuenta (`intentos.js`) usa el id de la cuenta encontrada, así no se puede esquivar alternando usuario y correo. Si no hay cuenta, usa el texto escrito.
  - **`PUT /password` (nuevo):** actual, nueva y confirmar. Aplica las reglas, el freno y renueva la sesión.
  - **`PUT /completar` (nuevo):** usuario, país y teléfono para las cuentas viejas a las que les falten.
  - `/sesion` devuelve `usuario` y `incompleta`.
- **`server/auth.js`:** el login de Necutools recibe `identificador`. Con `@` busca por `lower(correo)`. Sin `@` busca primero el usuario exacto y, si no lo encuentra, por `lower(usuario)` cuando hay una sola coincidencia. Mismo freno por id.
- **`server/admin.js`:**
  - `POST/PUT /usuarios` aceptan `correo` opcional, con `correoReal` y 409 si se repite.
  - `PUT /mi-correo` (nuevo) pide la contraseña actual.
  - `confirmar` es obligatorio al crear una contraseña o al reiniciarla, y también en `/mi-password`.
  - Todo queda en la bitácora sin escribir la contraseña.

### 3. Validación en vivo (`public/js/validacion.js`, nuevo, compartido)

- `validarCampo(input, regla)`: la primera validación es al salir del campo (`blur`) y desde ahí en cada `input`, para no marcar error mientras se escribe la primera vez.
- Debajo del campo va un mensaje con `aria-live="polite"` y `aria-describedby`, más `aria-invalid`.
  - Error: texto `--aviso` con el icono `circle-alert`.
  - Válido: borde y texto `--wa` con el icono `circle-check` y un texto corto ("Correo válido").
- **Correo:** el formato se revisa en el navegador. Al salir del campo se llama a `/api/clientes/revisar-correo` (con debounce de 500 ms) y aparece "Revisando…" mientras responde. Si hay sugerencia, se ofrece un botón "Usar ana@gmail.com".
- **Teléfono:** un `<select>` "México (+52)" sin banderas, porque no se permiten emojis, y un campo `inputmode="tel"`. Muestra "Faltan 3 dígitos" o "Número válido" según el país, y al cambiar de país vuelve a validar.
- **Contraseña:**
  - Medidor de 4 tramos con `role="meter"`:
    - **Débil:** no cumple las reglas. Color `--aviso`.
    - **Media:** cumple las reglas y tiene menos de 12 caracteres. Relleno `--senal` con borde `--tinta`, nunca texto amarillo.
    - **Fuerte:** 12 o más caracteres. Color `--tinta-2`.
    - **Súper segura:** 16 o más, sin secuencias (`1234`, `abcd`, `qwer`) ni repeticiones. Color `--wa`.
  - Debajo, la lista de reglas con palomita o tache: 10 (o 12) caracteres, mayúscula, minúscula, número y carácter especial.
  - La lógica de las reglas es la misma que en el servidor, copiada en un solo bloque comentado.
- El botón de enviar no se deshabilita. Si hay errores, enfoca el primer campo inválido. El servidor vuelve a validar todo.
- Estilos en `public/style.css`, solo con tokens: `.campo-estado`, `.is-valido`, `.is-invalido`, `.medidor` y `.reglas-password`. Iconos de Lucide en `iconos.js` (`circle-alert`, `x`, `check`, si faltan). Sin `style=` ni JS en línea.

### 4. Pantallas

- **`public/cuenta.html` y `public/js/cuenta.js`:**
  - Iniciar sesión: "Usuario o correo" (`autocomplete="username"`).
  - Crear cuenta:
    - Nombre visible.
    - Nombre de usuario.
    - Correo.
    - País y teléfono.
    - Contraseña con medidor.
    - Repite la contraseña: muestra "Coinciden" o "No coinciden".
  - Dentro de la cuenta:
    - "Cambiar contraseña": actual, nueva con medidor y confirmar.
    - Si la cuenta está incompleta, "Completa tu cuenta" (usuario y teléfono) arriba.
  - A 360px sin scroll horizontal, con el panel deslizante tal como está.
- **`public/necutools.html` y `public/js/necutools.js`:**
  - Login: "Usuario o correo".
  - Usuarios: campo de correo, y al crear o reiniciar la contraseña, medidor y "Repite la contraseña".
  - Mi cuenta: "Mi correo" y medidor en la contraseña nueva.

### 5. Pruebas (`scripts/seguridad/ataques.js` y las baterías anteriores)

Las contraseñas de prueba se actualizan a las reglas nuevas.

Casos nuevos:
- **Correo:** correo sin MX, dominio inventado, sugerencia de typo.
- **Teléfono:** largo por país.
- **Contraseña:** cada regla que falta y confirmación distinta.
- **Registro:** 409 con usuario o correo repetido, sin revelar cuál.
- **Login:**
  - Con usuario y con correo, sin importar mayúsculas.
  - Freno compartido entre las dos formas.
  - Las cuentas viejas siguen entrando.
- **Datos privados:** el teléfono no sale en ninguna respuesta pública (opiniones, `/sesion` de otro usuario).
- **`revisar-correo`:** no revela si el correo ya tiene cuenta.

## Prompts

1. **Base y validación del servidor:** schema, `paises.json`, `correoReal`, `telefono`, `usuarioValido`, reglas de contraseña con `confirmar`, pruebas de API.
2. **Login con usuario o correo y correo de admins:** `clientes.js`, `auth.js` y `admin.js` (usuarios, mi-correo, confirmar). Antes del índice de `lower(usuario)`, preguntarle al usuario qué hacer con `Axel`/`axel`.
3. **Validación en vivo y medidor:** `validacion.js`, estilos e iconos, y el formulario de registro completo en `cuenta.html`.
4. **Contraseñas en todos lados:** cambiar contraseña y completar cuenta para clientes; Usuarios y Mi cuenta de Necutools con medidor y confirmación.
5. **Verificación y cierre:** pruebas completas, README (registro, datos que se guardan, teléfono privado), estado del plan `aplicado` y MEMORIA.

## Verificación (prompt 5)

- Se prueba con el servidor real local (Node 22 + `embedded-postgres` en el puerto 54329, pendiente 17). **Nunca contra Render.** Para que el DNS MX no dependa de internet, en desarrollo se puede simular con una variable solo de desarrollo, igual que `HOY_PRUEBA`.
- Schema aplicado 3 veces seguidas sin error, sobre una base con clientes y admins viejos.
- Batería de ataques completa más los casos nuevos de la sección 5. Las baterías p1, p2, XSS y Necutools siguen pasando.
- **En navegador** (puppeteer):
  - Registro con cada error mostrándose bajo su campo, verde al corregirlo y el medidor pasando por los 4 niveles.
  - Teléfono de México y de España.
  - Login con usuario y con correo, en la tienda y en Necutools.
  - Cambiar contraseña con confirmación distinta, que no se acepta.
  - Completar cuenta vieja.
  - A 1280px y 360px sin scroll horizontal, cero errores de consola o CSP, y con lector de pantalla los mensajes salen por `aria-live`.
- Buscar en lo nuevo: hex sueltos, degradados, `style="`, `onclick`, `uppercase` y emojis. El único verde nuevo es `--wa` en el estado válido.
