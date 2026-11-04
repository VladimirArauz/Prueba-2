# Prompts: eliminar cuenta, casilla de edad y textos legales

Plan: `plans/planes/2026-11-04-cumplimiento-legal-cuenta-y-edad.md`. Se corren en orden. Reglas de todos: no cambiar el
carrito, la API de pedidos, Necutools (fuera de la lista de opiniones) ni el envío a WhatsApp; solo tokens y clases de
`style.css`; nada de JS ni estilos en línea; SQL con `?`; no imprimir secretos (memoria `secrets-md-no-imprimir`); trabajar
en `main`; pruebas solo contra localhost hasta el prompt 4.

## Prompt 1: base y servidor

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan `2026-11-04-cumplimiento-legal-cuenta-y-edad.md`. Aplica las secciones
1 y 2 del plan: agrega a `db/mariadb/schema.sql` las sentencias idempotentes (`clientes.edad_aceptada_en`, `resenas.cliente_id`
nulo con `resenas_cliente_fk2 ON DELETE SET NULL`, propósito `eliminar` con `codigos_correo_proposito_check2`) y córrelas 2
veces en el MariaDB local. En `app/clientes.php` exige `edad` en el registro y en `completar` (cuando falte), marca
`incompleta` si falta la fecha y crea `POST /api/clientes/eliminar` y `POST /api/clientes/eliminar/codigo` (transacción;
borra cliente, sesiones, códigos e intentos; respeta la sesión de Necutools del mismo navegador). Ajusta `app/codigos.php`
(reenviar y paso pendiente con `eliminar`), `app/correo.php` (asunto y texto) y los `LEFT JOIN` con "Cliente de Necutla" en
`app/resenas.php` y `app/admin.php`. Prueba con `curl` todo lo de la sección "Pruebas" que es de la API (en local el correo
cae en `/tmp/necutla-correos/`) y borra los datos de prueba.

## Prompt 2: Mi cuenta

Lee `plans/CLAUDE.md` y el plan. Aplica la sección 3: casilla de edad en el registro y en "Completa tu cuenta", tarjeta
"Eliminar mi cuenta" con `.btn.danger`, `confirmar()` de peligro y el paso del código reutilizando `#cuenta-codigo` con el
modo `eliminar`; toast al terminar y regreso a la pantalla de entrar. Conserva los `id`, `name` y `data-action` que ya usa
`cuenta.js`. Prueba en Chrome sin ventana con el cliente CDP propio (memoria `pruebas-locales-necutla`) a 1280, 360 y con
movimiento reducido: teclado, error bajo la casilla, eliminar completo, Volver a medio paso, recargar a medio paso, sin
scroll horizontal ni errores de consola o CSP. Borra los datos de prueba.

## Prompt 3: textos legales y portada

Lee `plans/CLAUDE.md` y el plan. **Antes de escribir, pregúntame** el nombre del responsable, el domicilio (o ciudad y
estado), la fecha de publicación y la ciudad o estado para controversias; lo que no te dé se queda como `[COMPLETAR]`.
Aplica la sección 4 en `public/terminos.html` y `public/privacidad.html` (cambios y devoluciones, opiniones sin compra
verificada y anónimas al eliminar, casilla de edad, eliminar desde Mi cuenta, menores, fechas). Revisa los textos de
`public/index.html` y dime qué frases prometen algo que Necutla no controla antes de cambiarlas. Tono directo, sentence case,
sin emojis. Revisa a 360 px que se lean bien.

## Prompt 4: pruebas de ataque, documentación y subida

Lee `plans/CLAUDE.md` y el plan. Agrega a `scripts/seguridad/ataques.js` las pruebas de edad y de eliminar (sin sesión,
código equivocado, código de otra cuenta, opinión anónima) y córrelo si hay Node; si no, revisa la sintaxis. Actualiza
`README.md` (eliminar cuenta y casilla de edad). Pregúntame antes de subir: corre el schema en IONOS por SSH (contraseña
solo por stdin), sube por rsync los archivos de `app/` y `public/` que cambiaron y prueba en vivo `/healthz`, el registro sin
casilla (400) y que las opiniones se vean. No elimines cuentas reales. Cambia el estado del plan a `aplicado` y actualiza
`plans/MEMORIA.md`.
