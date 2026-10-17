# Prompts: rediseño visual profesional de Necutla

- **Plan:** `plans/planes/2026-10-16-rediseno-visual-profesional.md`
- **Cómo usarlos:** uno por uno, en orden (cada prompt depende del anterior). Al terminar cada uno, revisa la página en el navegador antes de pasar al siguiente. Todos asumen que la sesión se abre en la carpeta `Prueba-2`.

---

## Prompt 1: base del sistema de diseño

```
Lee plans/CLAUDE.md y plans/planes/2026-10-16-rediseno-visual-profesional.md antes de empezar.

Aplica la fase 1 del plan en style.css:
1. Reemplaza el @import de Outfit y Plus Jakarta Sans por Archivo con eje de ancho:
   https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&display=swap
   Usa una sola variable --font: 'Archivo', system-ui, sans-serif.
2. Reemplaza todo el bloque :root por los tokens del plan (--tinta, --tinta-2, --senal, --aviso, --gis,
   --hoja, --linea, --texto-2, --wa) más radios (--r-btn: 6px, --r-card: 10px, --r-panel: 4px).
   Borra --shadow-glow-*, --shadow-sm/md/lg y los colores viejos; si algo los usa, cámbialo al token nuevo.
3. body: fondo var(--gis) plano, sin radial-gradient. Texto var(--tinta).
4. Define la escala tipográfica del plan (h1 a h4, cuerpo, pequeño) con font-variation-settings
   para el ancho ('wdth' 125 / 112 / 100). Párrafos con max-width: 68ch.
5. Reescribe .btn, .btn.secondary, .btn.danger, .btn.wa, .btn.btn-sm y agrega .btn.ghost exactamente
   como la tabla de botones del plan: borde 2px sólido siempre, sin degradados, sin sombras,
   sin translateY. Alto mínimo 44px (36px en .btn-sm). Agrega :focus-visible y :active.
6. Crea iconos.js en la raíz: inserta al inicio del <body> un <svg> oculto con <symbol> de Lucide
   (copia los paths reales de Lucide, trazo 2px, viewBox 0 0 24 24) para la lista de iconos del plan.
   Agrega a style.css la clase .icon (1.125em, stroke currentColor, fill none, flex-shrink 0).
7. Agrega @media (prefers-reduced-motion: reduce) que anule transiciones y animaciones.

No toques todavía index.html ni app.js salvo para incluir <script src="iconos.js"></script>
antes de app.js. No cambies ninguna lógica de JavaScript.
```

## Prompt 2: página principal (index.html)

```
Lee plans/CLAUDE.md y el plan 2026-10-16-rediseno-visual-profesional.md. Aplica la fase 2 en
index.html y style.css:

1. Navbar: fondo var(--hoja), borde inferior 1px var(--linea), sin ::after de degradado ni blur.
   Emblema "N" como placa (fondo --tinta, letra --senal, radio 4px, sin brillo).
   "Necutla" en Archivo ancho 800 color --tinta (sin texto con degradado); "Ciudad del Estudiante"
   en sentence case, --texto-2. Los 3 botones de nav como .btn.ghost con iconos store,
   shopping-cart y wrench del sprite; el activo con borde 2px --tinta y fondo --gis.
   El contador del carrito queda como pastilla --aviso con texto blanco.
2. Hero: reemplázalo por el layout "tablero directorio" del plan, alineado a la izquierda:
   columna de texto (h1 "Necutla, la ciudad del estudiante", párrafo
   "Ropa, tecnología, dulces, papelería y más de los stands de la comunidad. Arma tu pedido y lo
   confirmamos por WhatsApp.", botones "Ver tiendas" (.btn) e "Ir al carrito" (.btn.secondary))
   y a la derecha el tablero --tinta con las 7 tiendas como filas <a> (icono de la tienda +
   nombre en --senal) y al pie "Lun a sáb, 8:00 a 20:00". Sin numeración. Borra la pastilla
   "Plataforma Oficial" y los stat-chips. En <760px el tablero va debajo y a todo el ancho.
3. Tarjetas de tiendas: quita .card-tag, quita "→" de "Ver tienda", añade el icono de la tienda junto
   al h2 (cambia el h2 de la tarjeta por h3). Tarjeta --hoja, borde 1px --linea, radio 10px, sin sombra,
   sin ::before; hover solo cambia el borde a --tinta. Imagen 16:10 sin zoom. "+ Carrito" usa el
   icono plus.
4. Títulos de sección: quita los <span> con emoji. "← Volver…" pasa a .btn.secondary.btn-sm con icono
   arrow-left.
5. Carrito: el resumen con borde 2px --tinta; total en Archivo ancho tabular-nums; botón WhatsApp con
   icono message-circle y texto "Enviar pedido por WhatsApp"; "Vaciar carrito" como .btn.danger con
   trash-2; labels sin emoji; la nota con icono info.
6. Necutools: quita .admin-badge-head y el emoji del título; labels sin emoji; botón guardar con icono
   plus; tabla con encabezados en sentence case.
7. Footer: fondo --tinta, sin barra de degradado, sin emojis en links, horario con icono clock,
   borra la línea "Diseño oficial con paleta…". Links subrayados en hover, sin desplazamiento.
8. Mueve los style="…" inline de index.html a clases en style.css.
9. Elimina de style.css todo linear-gradient, radial-gradient, background-clip:text, text-transform:
   uppercase, backdrop-filter, translateY de hover, zoom de imágenes y la animación fadeInSection.

Conserva todos los id, onclick y clases que usa app.js. Al final corre:
grep -nP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" index.html  (debe salir vacío)
```

## Prompt 3: HTML generado por app.js

```
Lee plans/CLAUDE.md. Aplica la fase 3 del plan 2026-10-16-rediseno-visual-profesional.md en app.js
y style.css, sin cambiar la lógica (solo las plantillas HTML que se insertan con innerHTML y los textos):

1. Carrito vacío: icono shopping-cart 48px color --linea, h3 "Tu carrito está vacío", párrafo
   "Agrega productos desde cualquier tienda." y botón "Ver tiendas". Sin style inline.
2. Filas del carrito: quita 🏷️, botones de cantidad con iconos minus/plus y aria-label
   ("Quitar uno", "Agregar uno"), eliminar como botón de solo icono trash-2 con clase .btn.danger.btn-sm
   y aria-label "Eliminar producto". Mueve los style inline a clases (.cart-empty, .cart-col-center,
   .cart-col-right, etc.).
3. Tabla de Necutools: quita estilos inline de colores fijos (#ffffff, --yellow-main); usa clases.
   Acciones con iconos pencil y trash-2 + aria-label.
4. Tarjetas de producto público: "Agregar al carrito" con icono shopping-cart, sin emoji.
5. Toast: icono check en vez de ✨; texto "Agregado al carrito: <nombre>". Fondo --tinta, texto blanco,
   radio 6px, la única sombra permitida del sitio.
6. Los emojis dentro del mensaje que se manda a WhatsApp se pueden quedar (WhatsApp no muestra SVG).
7. Asegúrate de que los iconos se rendericen: las plantillas usan <svg class="icon"><use href="#i-..."></use></svg>.

Al final corre: grep -nP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" app.js  y confirma que solo
quedan los del mensaje de WhatsApp.
```

## Prompt 4: subpáginas de tiendas

```
Lee plans/CLAUDE.md. Aplica la fase 4 del plan 2026-10-16-rediseno-visual-profesional.md a las
37 páginas internas: */index.html, */*/index.html y */carrito.html (ropa, tecnologia, dulces,
propaganda, papeleria, regalos, otra).

1. Primero rediseña UNA (ropa/index.html, ropa/playeras/index.html y ropa/carrito.html) y muéstrame
   el resultado antes de seguir.
2. Estructura común del <header>: barra superior igual a la navbar del index (emblema N + "Necutla",
   botón .btn.secondary.btn-sm con arrow-left para volver, y botón de carrito con icono y contador
   .cart-count), y debajo un encabezado de página con h1 y descripción. Agrega en style.css las clases
   .page-bar y .page-head para esto (no reutilices .site-header del index).
3. Cambia 🛒 y 📱 por iconos del sprite; "← Tiendas" pasa a icono + "Tiendas".
4. Incluye <script src="../iconos.js"></script> (o ../../ según profundidad) antes del carrito.js de cada página.
5. Los productos usan las mismas tarjetas y botones del index; el precio con .price en tabular-nums
   color --tinta.
6. Después de aprobar el ejemplo, aplica lo mismo a las demás tiendas con un script (las páginas son
   casi idénticas), y revisa un par de cada tienda.

No cambies js/carrito.js salvo textos con emoji que se muestren en la página.
```

## Prompt 5: QA final

```
Lee plans/CLAUDE.md. Haz la fase 5 (QA) del plan 2026-10-16-rediseno-visual-profesional.md:

1. Revisa index.html, una tienda, una subcategoría y un carrito a 360px, 768px y 1280px:
   sin scroll horizontal, tablero del hero debajo del texto en móvil, grid 3/2/1.
2. Navega todo con teclado: foco visible en cada botón, link, input y fila del tablero.
3. Verifica contraste AA de: --texto-2 sobre --gis y --hoja, --tinta sobre --senal, blanco sobre --wa
   y sobre --aviso, --senal sobre --tinta.
4. Corre los criterios de aceptación del plan (greps de emojis, gradientes, uppercase, glow, style=).
5. Prueba el flujo: agregar al carrito desde el index y desde una tienda, cambiar cantidades, vaciar,
   enviar a WhatsApp (que abra los 3 chats), crear cuenta e iniciar sesión en Necutools, crear un
   producto, editarlo, borrarlo y crear un stand.
6. Dame una lista de lo que quedó pendiente o se ve raro, con archivo y línea.
```
