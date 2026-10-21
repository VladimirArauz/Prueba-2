# Prompts: registro con más datos, validación en vivo y login con usuario o correo

Plan: `plans/planes/2026-10-20-registro-validacion-y-login.md`. Correr en orden, siempre en `main` (no se crean ramas).
Probar siempre contra el PostgreSQL local de prueba, nunca contra Render.

---

## Prompt 1: base y validación del servidor

```
Lee plans/CLAUDE.md, plans/MEMORIA.md y plans/planes/2026-10-20-registro-validacion-y-login.md.

1. Confirma que estás en `main` (no crees ramas). Plan → estado "en curso".
2. db/schema.sql (idempotente, sin borrar datos): en clientes, usuario VARCHAR(30), pais CHAR(2),
   telefono VARCHAR(16) (nulos para las cuentas viejas) e índice único parcial en lower(usuario);
   en admins, correo VARCHAR(120) con índice único parcial en lower(correo). Todavía NO crees el
   índice de lower(admins.usuario) (eso es del prompt 2).
3. public/datos/paises.json: ISO, nombre, lada y largos válidos del número nacional (E.164, máx. 15
   dígitos con lada). México primero (+52, 10). Toda Latinoamérica, EE. UU./Canadá, España y los
   países más comunes. Investiga cada largo en el plan de numeración del país; no inventes.
4. server/validar.js: correoReal (formato estricto + dns.promises.resolveMx con 3 s de tiempo y
   caché de 1 h; sin MX → error claro; si el DNS no responde, se acepta; sugerencias de typo como
   gmial.com → gmail.com), telefono(pais, numero) → E.164, usuarioValido (^[a-z0-9._-]{3,30}$).
   Variable solo de desarrollo para simular el DNS en pruebas (como HOY_PRUEBA); documéntala en
   .env.example y README.
5. server/contrasenas.js: exigir minúscula, mayúscula, número y carácter especial, con un mensaje
   que diga qué falta; parámetro confirmar ("Las contraseñas no coinciden."). Mínimos: cliente 10,
   admin 12. Las cuentas viejas siguen entrando.
6. Pruebas de API de cada regla en scripts/seguridad/ (solo localhost). Schema 3 veces sin error.
7. Actualiza plans/MEMORIA.md.
```

---

## Prompt 2: login con usuario o correo y correo de los admins

```
Lee plans/CLAUDE.md, plans/MEMORIA.md y el plan 2026-10-20-registro-validacion-y-login.md.
Trabaja en `main`.

1. ANTES de todo: en producción existen los admins `Axel` (id 1) y `axel` (id 3). Pregúntale al
   usuario cuál renombrar o desactivar. No toques producción sin su permiso explícito. El índice
   único de lower(admins.usuario) solo se crea si no hay duplicados (con un DO $$ que lo revise),
   para que el arranque nunca falle.
2. server/clientes.js: registro con nombre, usuario, correo, pais, telefono, password y confirmar
   (409 "Ese usuario o correo ya tiene cuenta" sin decir cuál); POST /revisar-correo (formato y MX,
   nunca dice si el correo existe, límite 60 por 15 min por IP); login con `identificador` (con @
   busca correo, sin @ usuario, sin importar mayúsculas; sigue aceptando `correo`); el freno de
   intentos.js usa el id de la cuenta encontrada; PUT /password (actual, nueva, confirmar; renueva
   la sesión); PUT /completar (usuario, país, teléfono para cuentas viejas); /sesion devuelve
   usuario e incompleta. El teléfono nunca sale en respuestas públicas.
3. server/auth.js: login de Necutools con `identificador` (correo, usuario exacto o lower(usuario)
   con una sola coincidencia), mismo freno por id.
4. server/admin.js: correo opcional en POST/PUT /usuarios (correoReal, 409 si se repite);
   PUT /mi-correo con contraseña actual; confirmar obligatorio al crear o reiniciar una contraseña y
   en /mi-password. Bitácora sin contraseñas.
5. Pruebas: login con usuario y con correo en las dos formas, freno compartido, cuentas viejas,
   409 sin revelar cuál, teléfono privado. /code-review sobre los cambios sin commit (git diff), con foco en seguridad.
6. Actualiza plans/MEMORIA.md.
```

---

## Prompt 3: validación en vivo, medidor y formulario de registro

```
Lee plans/CLAUDE.md, plans/MEMORIA.md y el plan 2026-10-20-registro-validacion-y-login.md.
Trabaja en `main`.

1. public/js/validacion.js (nuevo, compartido): validarCampo(input, regla). Valida por primera vez
   al salir del campo y después en cada tecla; mensaje bajo el campo con aria-live="polite",
   aria-describedby y aria-invalid. Error en --aviso con circle-alert; válido en --wa con
   circle-check (excepción autorizada por el usuario solo para este estado).
2. Correo: formato en el navegador y /api/clientes/revisar-correo al salir del campo (debounce
   500 ms, "Revisando…", botón "Usar …" con la sugerencia).
3. Teléfono: <select> "México (+52)" sin banderas ni emojis (lee public/datos/paises.json) +
   input inputmode="tel"; "Faltan N dígitos" / "Número válido"; revalida al cambiar de país.
4. Contraseña: medidor de 4 tramos (role="meter"): débil --aviso, media relleno --senal con
   borde --tinta (nunca texto amarillo), fuerte --tinta-2, súper segura --wa. Lista de reglas con
   palomita o tache. Misma lógica que server/contrasenas.js. "Repite la contraseña": Coinciden /
   No coinciden.
5. public/cuenta.html y public/js/cuenta.js: login "Usuario o correo"; registro con nombre
   visible, usuario, correo, país + teléfono, contraseña con medidor y confirmación. Si hay
   errores al enviar, enfoca el primero (el botón no se deshabilita).
6. Estilos en style.css solo con tokens (.campo-estado, .is-valido, .is-invalido, .medidor,
   .reglas-password); iconos Lucide que falten en iconos.js. Sin style=, sin JS en línea.
7. Prueba en Chrome sin ventana: cada error bajo su campo, verde al corregir, los 4 niveles del
   medidor, 1280 y 360 px sin scroll horizontal, cero errores de consola o CSP.
8. Actualiza plans/MEMORIA.md.
```

---

## Prompt 4: contraseñas en todos lados

```
Lee plans/CLAUDE.md, plans/MEMORIA.md y el plan 2026-10-20-registro-validacion-y-login.md.
Trabaja en `main`.

1. Cuenta del cliente (cuenta.html, dentro): "Cambiar contraseña" (actual, nueva con medidor,
   confirmar) y, si la cuenta está incompleta, "Completa tu cuenta" (usuario, país y teléfono)
   arriba. Usa validacion.js.
2. Necutools: login "Usuario o correo"; Usuarios con campo de correo y, al crear o reiniciar la
   contraseña, medidor y "Repite la contraseña"; Mi cuenta con "Mi correo" (pide contraseña
   actual) y medidor en la contraseña nueva. Conserva los id y data-action existentes.
3. Pruebas en navegador de cada formulario (confirmación distinta no se acepta) y de las baterías
   de Necutools anteriores.
4. Actualiza plans/MEMORIA.md.
```

---

## Prompt 5: verificación y cierre

```
Lee plans/CLAUDE.md, plans/MEMORIA.md y el plan 2026-10-20-registro-validacion-y-login.md.
Trabaja en `main`.

1. Schema 3 veces seguidas sin error sobre una base con clientes y admins viejos.
2. Actualiza las contraseñas de prueba de scripts/seguridad/ y de las baterías anteriores a las
   reglas nuevas; corre todo (ataques, XSS, p1, p2, Necutools) más los casos nuevos del plan.
3. Navegador: registro completo, teléfono de México y España, login con usuario y con correo en la
   tienda y en Necutools, cambiar contraseña, completar cuenta vieja; 1280 y 360 px; cero errores
   de consola o CSP.
4. Busca en lo nuevo: hex sueltos, degradados, style=", onclick, uppercase, emojis. El único verde
   es --wa en el estado válido.
5. /code-review sobre los cambios sin commit (foco en seguridad) y npm audit --omit=dev.
6. README (registro, qué datos se guardan, teléfono privado, variable de DNS de desarrollo).
   Plan → "aplicado". plans/MEMORIA.md con cambios y pendientes.
7. No hagas merge ni push: dile al usuario que pida "haz commit y push".
```
