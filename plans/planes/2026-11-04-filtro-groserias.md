# Plan: no aceptar groserías (español e inglés) en lo que ve todo el mundo

- **Fecha:** 2026-11-04
- **Estado:** aplicado (prompts 1 a 3, 2026-11-04) y subido a IONOS
- **Prompts:** `plans/prompts/2026-11-04-filtro-groserias.md`
- **Alcance:** `app/groserias.php` (nuevo), `app/arranque.php`, `app/validar.php`, `app/clientes.php`, `app/resenas.php`,
  `app/admin.php`, `scripts/seguridad/ataques.js`, `README.md`. Sin cambios en el carrito, la API de pedidos ni el envío
  a WhatsApp. Sin cambios visuales: el error sale con los avisos que ya existen.

## Contexto

Pedido del usuario (2026-11-04): que en los comentarios, los nombres de usuario, los productos y cualquier texto que se
publique y vea todo el mundo no se acepten groserías, ni en español ni en inglés.

Hoy el servidor valida el largo de cada texto con `v_texto()` y bloquea enlaces en las opiniones, pero no revisa
palabras.

## Decisiones

- **Se rechaza, no se tapa:** el servidor responde 400 con "<Campo> tiene palabras que no se permiten en Necutla.
  Cámbialas para seguir." No se dice qué palabra fue (así no se enseña a esquivar la lista) y no se guarda nada.
- **Solo en el servidor** (una sola lista, en `app/groserias.php`, fuera de `public/`). El navegador ya muestra el
  mensaje de error de la API.
- **Lista corta y con cuidado de los falsos positivos.** Palabras vulgares y ofensas (también las que discriminan) de
  México y de otros países de habla hispana, y las más comunes del inglés. Se dejan fuera palabras con otro significado
  normal (zorra, perra, pito, panocha, coger, nalgas, güey, damn) y los insultos leves (tonto, idiota).
- **Cómo se compara:**
  1. Minúsculas, sin acentos ni diéresis, `ñ` → `n`.
  2. Números y símbolos que se usan para disfrazar letras: `0→o 1→i 3→e 4→a 5→s 7→t @→a $→s`.
  3. Letras repetidas se juntan (`puuuta` → `puta`); la lista se normaliza igual.
  4. Letras sueltas separadas por espacios, puntos o guiones se juntan (`p u t a`, `p.u.t.a`).
  5. Se parte en palabras por todo lo que no sea letra. Hay dos tipos de entrada:
     - **palabra completa** (con su plural o femenino): para las que forman parte de palabras normales
       (`puta` en "computadora" y "disputa", `culo` en "película", `ass` en "class", `dick` en "Dickens").
     - **raíz**: para las que no aparecen dentro de palabras normales (`pendej`, `chingad`, `fuck`), y así también se
       detectan pegadas en un nombre de usuario (`elpendejo99`).
- **Dónde se revisa** (todo lo público):
  - Cuentas de cliente: nombre y nombre de usuario (registro y "Completa tu cuenta").
  - Opiniones: comentario del cliente y respuesta de la tienda.
  - Necutools: nombre y descripción de tiendas, productos y servicios; subcategorías; colores; título, descripción y
    temporada de ofertas; título y descripción de promociones.
  - No se revisan las notas internas de pedidos ni las indicaciones del carrito (no se publican).
- **Lo que ya está guardado** no se borra: se revisa la base de IONOS con la misma función y se le dice al usuario qué
  registros (tabla e id, sin copiar el texto al chat) tendría que cambiar.

## Pruebas

- Unitarias de `tiene_groserias()` con PHP 8.5 en la terminal: frases que deben pasar (computadora, disputa, película,
  clase, Dickens, pinchar, vergüenza, Scunthorpe, "jota", "cabrito", "shiitake", "class", "assessment", nombres comunes)
  y que deben fallar (español e inglés, con acentos, mayúsculas, números, letras repetidas, letras separadas, pegadas en
  un usuario).
- `curl` / Python contra localhost: registro con nombre y usuario con groserías → 400; opinión → 400; Necutools (tienda,
  producto, color, oferta, promoción, subcategoría, respuesta) → 400; los mismos textos limpios → 200.
- `scripts/seguridad/ataques.js`: pruebas nuevas "GRS"; la batería completa sigue pasando.
- Subir a IONOS y probar en vivo una opinión y un registro con groserías (400) sin crear datos.
