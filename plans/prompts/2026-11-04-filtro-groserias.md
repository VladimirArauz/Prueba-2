# Prompts: no aceptar groserías en lo que ve todo el mundo

Plan: `plans/planes/2026-11-04-filtro-groserias.md`. Se corren en orden. Reglas de todos: no cambiar el carrito, la API de
pedidos ni el envío a WhatsApp; no imprimir secretos (memoria `secrets-md-no-imprimir`); trabajar en `main`; pruebas
solo contra localhost hasta el prompt 3.

## Prompt 1: la lista y la función

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan `2026-11-04-filtro-groserias.md`. Crea `app/groserias.php` con la
lista (palabras completas y raíces, español e inglés) y `tiene_groserias()` / `sin_groserias()` como dice la sección
"Cómo se compara"; cárgalo en `app/arranque.php`. Escribe las pruebas unitarias de la sección "Pruebas" y córrelas con
`php8.5` hasta que no haya falsos positivos ni groserías que pasen.

## Prompt 2: revisar cada campo público

Lee `plans/CLAUDE.md` y el plan. Agrega `v_publico()` en `app/validar.php` (como `v_texto()` más `sin_groserias()`) y
úsala en todos los campos de "Dónde se revisa" (`app/clientes.php`, `app/resenas.php`, `app/admin.php`); el nombre de
usuario se revisa en `usuario_valido()`. Prueba con la API local (cliente y Necutools con un dueño temporal), agrega las
pruebas "GRS" a `scripts/seguridad/ataques.js`, corre la batería completa y borra los datos de prueba.

## Prompt 3: subir y revisar lo que ya está publicado

Lee `plans/CLAUDE.md` y el plan. Sube por rsync los archivos de `app/` que cambiaron (con respaldo previo en el
servidor) y prueba en vivo que una opinión y un registro con groserías dan 400 sin crear nada. Con la misma función,
revisa los textos públicos que ya están en la base de IONOS y dile al usuario qué tabla e id tienen algo que cambiar,
sin copiar el texto. Actualiza `README.md`, el estado del plan y `plans/MEMORIA.md`, y haz el commit.
