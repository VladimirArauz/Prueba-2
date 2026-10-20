# Plan: barra lateral, login con panel deslizante y animaciones

- **Fecha:** 2026-10-20
- **Estado:** aplicado
- **Prompts:** `plans/prompts/2026-10-20-barra-lateral-login-animaciones.md`
- **Alcance:** solo diseño e interacción del frontend (`public/`). Cambia la navegación de las 7 páginas
  (`index`, `tienda`, `producto`, `carrito`, `promociones`, `cuenta`, `necutools`), la página `cuenta.html`
  y el movimiento de tarjetas, botones y secciones. No toca la API, la base, el carrito, el envío a WhatsApp
  ni la lógica de Necutools.

## Qué pidió el usuario

Tomar como referencia dos publicaciones de Instagram de @frontendjoe:

1. **"CSS Sidebars Part 11"** (https://www.instagram.com/p/DeVERjTgMRE/): barra lateral blanca, fija a
   la izquierda, que muestra solo iconos y **se ensancha al pasar el mouse** (de 84px a 280px) para mostrar
   los nombres. Tiene perfil arriba, buscador, opciones con icono dentro de una "pastilla", la opción activa
   rellena de color, puntos rojos de aviso, una sección de abajo y transiciones de ancho y de opacidad
   (0.35s el ancho y los textos aparecen con un pequeño retraso).
   - Pedido extra: **al pasar el mouse por "Tiendas" se despliegan todas las tiendas** (Tecnología, Ropa, Dulces…).
2. **"React Logins Part 13"** (https://www.instagram.com/p/DejrmYrABU7/): tarjeta de login dividida en dos.
   Un lado tiene el formulario y el otro un panel de color con un saludo y un botón para cambiar.
   Al cambiar entre "Login" y "Sign up", **el panel se desliza al otro lado** (`translate 100%`, 0.65s
   ease-in-out) y el formulario contrario aparece donde estaba el panel.
3. Que todo se vea **elegante, con animaciones suaves pero notorias**, y que productos y botones tengan
   un **hover con animación tenue que se note**.

## Decisiones del usuario (2026-10-20)

| Pregunta | Respuesta |
|---|---|
| ¿Barra arriba con el estilo del post o lateral como el post? | **Barra lateral como el post** |
| ¿Qué excepción de movimiento se autoriza? | **"Más notorio"**: hover que levanta con sombra suave, zoom leve de imagen, y además secciones que aparecen con fundido al bajar y tarjetas que entran escalonadas |
| ¿Login con colores de Necutla o igual al post? | **Con colores de Necutla**: el mismo efecto, pero el panel es `--tinta` liso con un dibujo plano de ciudad (sin degradado ni efecto vidrio) |

### Excepciones a `plans/CLAUDE.md` que autorizó el usuario

`plans/CLAUDE.md` no se modifica en este plan (solo el usuario puede pedirlo). Estas excepciones valen para
lo que hace este plan y quedan anotadas en `plans/MEMORIA.md`:

- **Movimiento** (sección "Movimiento" y "Botones"): se permite que tarjetas y botones se levanten en hover,
  el zoom leve de imágenes en hover, las secciones que aparecen al hacer scroll y las tarjetas escalonadas.
- **Sombras** (sección "Forma y layout"): se permiten dos sombras nuevas, solo para hover, la barra lateral
  abierta, el submenú de tiendas y la tarjeta de login.
- **Navegación:** barra lateral en lugar de la barra superior.

Lo que **sigue prohibido**: colores nuevos, degradados, `backdrop-filter`, texto en mayúsculas, emojis,
fuentes nuevas, JS o estilos en línea (CSP) y cambiar la lógica.

## Diseño

### 1. Tokens nuevos de movimiento y sombra (`style.css`, en `:root`)

Se derivan de `--tinta`, así que no son colores nuevos:

```css
--t-media: 0.25s cubic-bezier(.2, .7, .2, 1);   /* hover y menús */
--t-lenta: 0.45s cubic-bezier(.2, .7, .2, 1);   /* barra lateral y entradas */
--t-panel: 0.65s cubic-bezier(.65, 0, .35, 1);  /* panel del login (ease-in-out del post) */
--sombra-1: 0 6px 18px rgba(23, 41, 92, .10);   /* hover de tarjetas */
--sombra-2: 0 24px 60px rgba(23, 41, 92, .16);  /* barra abierta, submenú, tarjeta de login */
```

Todo el movimiento nuevo va dentro de `@media (prefers-reduced-motion: no-preference)` o se apaga en el
bloque `prefers-reduced-motion: reduce` que ya existe.

### 2. Barra lateral (`.sidebar`, reemplaza a `.site-navbar`)

**Escritorio (> 860px)**

- `position: fixed` a la izquierda, con 16px de margen, fondo `--hoja`, borde 1px `--linea`, radio 10px y
  ancho cerrado de **76px**. El `body` lleva `padding-left` de 76px + margen, así que el contenido no queda
  debajo.
- Al pasar el mouse **o con `:focus-within`** (teclado), se ensancha a **264px** con `--t-lenta` y
  `--sombra-2`. Se abre **encima del contenido** (no lo empuja, para que la página no salte).
- Los textos van con `opacity: 0` y aparecen con un retraso de 0.1s después del ancho, como en el post.
- Contenido, de arriba hacia abajo:
  1. Marca: emblema "N" + "Necutla / Ciudad del Estudiante" (se ve al abrir).
  2. Buscador: botón con lupa; abierto se vuelve un campo que manda a `/?q=…` (la portada lee `q` y busca).
  3. **Inicio**, **Tiendas** (con submenú), **Promociones**, **Carrito** (con contador `cart-count`;
     cerrado se ve como punto rojo `--aviso` sobre el icono, como los avisos del post), **Mi cuenta**.
  4. Abajo, separado por un divisor: **Necutools**.
- Opción: alto 48px, radio 6px. El icono va en una caja de 44×44. En hover: fondo `--gis` y el icono se
  desliza 2px. La opción activa (`aria-current="page"`) va rellena de `--tinta`, con texto y icono
  `--hoja` y una marca `--senal` de 3px a la izquierda.

**Submenú "Tiendas"**

- Es un `<button>` con `aria-expanded` y `aria-controls`. Se abre al pasar el mouse (con 120ms de
  tolerancia al salir, para que no se cierre al cruzar el hueco), con clic, con Enter o con la flecha
  derecha, y se cierra con Escape.
- Panel flotante a la derecha de la barra: fondo `--hoja`, borde `--linea`, radio 10px, `--sombra-2`.
  Sale con fundido y desplazamiento de 8px (`--t-media`).
- Lista: icono de la tienda + nombre + descripción corta, cargada de `/api/stands` con `obtenerTiendas()`
  de `comun.js` (las tiendas nuevas aparecen solas). Cada una enlaza a `/t/<slug>`. Abajo, "Ver todas las
  tiendas" (`/#tiendas`).
- Las tiendas entran escalonadas (30ms entre una y otra).
- Si la API falla, el botón lleva a `/#tiendas` como enlace normal.

**Celular y tableta (≤ 860px)**

- Barra superior delgada: marca + contador del carrito + botón "Abrir menú" (icono `menu`, con
  `aria-label`).
- El botón abre la barra lateral como cajón desde la izquierda (`translateX`, `--t-lenta`) con un fondo
  `--tinta` al 40% que la cierra al tocarlo. Se cierra también con Escape o con el botón `x`, y se devuelve
  el foco al botón.
- "Tiendas" se vuelve acordeón (se despliega hacia abajo dentro del cajón, sin flotar).
- A 360px no debe haber scroll horizontal.

**Estructura**: el HTML de la barra queda **escrito en cada página** (funciona sin JS y conserva los
enlaces). El JS de `comun.js` solo llena el submenú, abre y cierra el cajón y marca la opción activa. Se
conservan la clase `cart-count` y los `id` que use el JS. `necutools.html` lleva la misma barra.

### 3. Hover y animaciones de entrada

**Hover (escritorio, `@media (hover: hover)`)**

| Elemento | Efecto |
|---|---|
| Tarjeta de producto, tienda o promoción | Sube 4px, `--sombra-1` y el borde pasa a `--tinta` (`--t-media`) |
| Imagen dentro de la tarjeta | `scale(1.04)`, recortada por la tarjeta |
| `.btn` (todas las variantes) | Sube 2px y la sombra se vuelve un "escalón" plano del color del borde (`0 3px 0 var(--tinta)`). Al presionar baja a 0 |
| Icono dentro del botón | Se desliza 2px (las flechas, en su dirección) |
| Enlaces de texto | Subrayado que crece de izquierda a derecha |
| Filas del tablero del hero | El nombre se desliza 4px y la flecha aparece |

**Entradas (solo con `prefers-reduced-motion: no-preference` y con JS)**

- `comun.js` agrega la clase `anim` a `<html>`. Sin JS o con movimiento reducido, todo se ve normal desde el
  principio.
- Secciones (`.section-head`, grids, letrero, vitrina): aparecen con fundido y suben 16px cuando entran a la
  pantalla (`IntersectionObserver`, una sola vez, `--t-lenta`).
- Tarjetas de un grid: escalonadas con `:nth-child` (60ms entre cada una, máximo 8 pasos), sin estilos en
  línea.
- El tablero del hero aparece primero y sus filas entran escalonadas (es la pieza principal).
- Lo que se carga con la API (tarjetas, vitrina, resultados de búsqueda) también se anima al insertarse.
- Se mantienen el toast y el pulso del contador.

### 4. Login con panel deslizante (`cuenta.html` + `js/cuenta.js`)

- Una tarjeta `.auth` de 880×560 como máximo, centrada, fondo `--hoja`, borde `--linea`, radio 10px y
  `--sombra-2`, con un borde blanco interior de 8px como en el post.
- Dos formularios a cada lado: **Iniciar sesión** (izquierda) y **Crear cuenta** (derecha). Se conservan
  `form-entrar`, `form-registro` y los `id` y `name` de los campos.
- **Panel** `.auth-panel` (50% de ancho, fondo `--tinta`, radio 6px) con un **dibujo plano de la ciudad**
  (SVG inline en el HTML, siluetas de edificios en `--tinta-2` y ventanas `--senal`, sin degradado):
  - Con login visible: el panel está a la derecha y dice "¿Primera vez en Necutla?" + "Crea tu cuenta para
    calificar y opinar sobre los productos." + botón **Crear cuenta**.
  - Con registro visible: el panel está a la izquierda y dice "¿Ya tienes cuenta?" + "Entra para ver y
    editar tus opiniones." + botón **Iniciar sesión**.
  - Los botones del panel son `.btn` (amarillo sobre `--tinta`).
- Al cambiar: el panel se desliza al otro lado (`translate: 100%` ↔ `0`, `--t-panel`). El formulario que
  sale se desvanece y se corre hacia el lado contrario, y el que entra aparece con 0.2s de retraso. El texto
  del panel cambia con fundido a la mitad del recorrido.
- El formulario oculto lleva `inert` y `aria-hidden`; el foco pasa al primer campo del que entra. El cambio
  se hace con `data-action="auth-cambiar"`. `#crear-cuenta` en la URL abre directamente el registro.
- Extras del post adaptados: campos con icono dentro (`mail`, `lock`, `user`) y botón para ver la contraseña
  (`eye` / `eye-off`, con `aria-label` "Mostrar contraseña" / "Ocultar contraseña"). Sin "Continuar con
  Google" ni "Recordarme" (no existen en el servidor).
- **≤ 760px:** la tarjeta se apila. El panel queda arriba como franja de 180px y el cambio desliza los
  formularios en horizontal dentro de la tarjeta, con el mismo tiempo.
- La vista "Hola, <nombre>" (`cuenta-dentro`) sigue igual, dentro de la misma tarjeta, con fundido.

### 5. Iconos nuevos (`iconos.js`, de Lucide)

`menu`, `house`, `mail`, `lock`, `eye` y `log-in`. Ya existen y se reutilizan: `wrench` (Necutools),
`chevron-right`, `eye-off`, `search`, `user`, `store`, `tag` y `x`.

## Riesgos y cuidados

- **Las páginas no deben saltar:** la barra se abre encima del contenido. El `padding-left` del `body` es
  fijo.
- **El hero y la barra:** el tablero sigue siendo la pieza principal; la barra es blanca y sobria.
- **Rendimiento:** solo se animan `transform` y `opacity`, nunca `width` en las tarjetas. El ancho de la
  barra sí se anima, pero va en una capa fija y no reacomoda la página.
- **Teclado y lectores de pantalla:** `:focus-within` abre la barra, el submenú tiene `aria-expanded`, el
  cajón atrapa el foco mientras está abierto y Escape cierra todo.
- **CSP:** nada de `style=""` ni `onclick`. El escalonado va con `:nth-child`, no con estilos en línea.
- **Necutools:** solo cambia la barra; sus tablas y formularios se quedan como están.

## Criterios de terminado

- La barra lateral funciona igual en las 7 páginas: hover, teclado, submenú de tiendas con las tiendas de la
  base y cajón en celular.
- En `cuenta.html`, el login y el registro cambian con el panel deslizante; entrar, crear cuenta, cerrar
  sesión y `?volver=` funcionan igual que antes.
- Las tarjetas y los botones tienen hover visible y las secciones aparecen al bajar. Con
  `prefers-reduced-motion: reduce`, nada se mueve y todo se ve.
- Cero errores de consola o de CSP. A 360px no hay scroll horizontal. Hay foco visible en todo.
- No hay colores, degradados, fuentes ni emojis nuevos.
