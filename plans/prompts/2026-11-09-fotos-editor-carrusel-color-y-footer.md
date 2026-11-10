# Prompts: fotos completas, editor de productos, carrusel por color, subsecciones y crédito YANCORE

Plan: `plans/planes/2026-11-09-fotos-editor-carrusel-color-y-footer.md`. Se corren en orden, uno por sesión si se quiere. Todos trabajan en `main`, sin ramas. Ninguno sube a IONOS salvo el 7, y solo con permiso.

## Prompt 1: fotos completas sin perder calidad

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y la sección 1 de `plans/planes/2026-11-09-fotos-editor-carrusel-color-y-footer.md`. Cambia el estado del plan a `en curso`.

Haz que las fotos que no caben en su marco se vean completas, sin tocar los archivos guardados (no reproceses ni vuelvas a comprimir; `app/imagenes.php` no cambia).

- En `public/js/comun.js`, crea `ajustarFoto(img)` con la proporción fija de cada marco: `.producto-img img` 4/3; `.card-img-wrap img`, `.card > img` y `.letrero-img img` 16/10; `.admin-thumb` 1/1. No dependas del tamaño en pantalla para la proporción, porque hay imágenes dentro de paneles ocultos.
- Si `cover` recortaría más del 20 % de la imagen, o si `clientWidth` es mayor que 0 y la imagen es más angosta que su marco, agrega `.foto-completa`; si no, quítala. Ignora los `.svg`.
- En `public/style.css`: `.foto-completa { object-fit: scale-down; background: var(--foto-fondo, var(--gis)); }`, con especificidad suficiente para ganarle a los `object-fit: cover` actuales.
- Color de franja: dibuja los bordes en un canvas chico (izquierdo y derecho si la foto es alta; superior e inferior si es ancha). Si el borde es parejo y opaco, asigna el promedio con `img.style.setProperty("--foto-fondo", ...)`. Si es muy variado o transparente, quita la propiedad para que se use `--gis`. Envuelve la lectura en `try/catch`.
- Aplica con un listener de `load` en captura sobre `document` y un barrido inicial para las imágenes que ya cargaron o que pinta el servidor.
- En `crearCarrusel`: ajusta la imagen con los datos de la foto ya decodificada antes de asignar `img.src`, para que no parpadee. La copia que sale debe conservar `.foto-completa` y su fondo: hoy `sale.className = ...` borra las clases. No dependas del atributo `style` clonado, porque la CSP puede bloquearlo: quítalo y vuelve a asignar con `setProperty`.

Esta es una excepción de diseño autorizada solo para este plan (color calculado de la foto).

Prueba en Chrome local a 1280 y 360, con imagen vertical (como 928×1152), cuadrada grande (1440×1440), cuadrada de 40 px, horizontal, de proporción parecida al marco, PNG transparente y `.svg`, en tarjeta de producto, tarjeta de tienda, página del producto, Necutools y durante el carrusel. Comprueba: se ve completa cuando toca, las horizontales siguen llenando, el archivo servido tiene el mismo md5 que el guardado, sin errores de consola ni de CSP, sin scroll horizontal y sin aumento de CLS. Borra los datos de prueba y actualiza `plans/MEMORIA.md`, incluida la excepción de diseño.

## Prompt 2: crédito YANCORE en el pie

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y la sección 2 del plan `plans/planes/2026-11-09-fotos-editor-carrusel-color-y-footer.md`.

Genera `public/imagenes/yancore.png` de 96×96 con GD de `php8.5` a partir de `/home/aumf-ubuntu-080704/Descargas/logo yancore.jpeg`, sin modificar el original y desde un script en la carpeta temporal.

En las 10 páginas con `.footer-bottom` (`index`, `necutools`, `producto`, `privacidad`, `cuenta`, `404`, `promociones`, `carrito`, `terminos`, `tienda`), deja el texto "© 2026 Necutla, la ciudad del estudiante." a la izquierda y pon "By YANCORE" con el logo al extremo derecho. La imagen lleva `src="/imagenes/yancore.png"`, `width="32" height="32"` y `alt=""`. El estilo va en `public/style.css` con clases y tokens: fila flex con `justify-content: space-between` y `flex-wrap: wrap`, logo con `border-radius: var(--r-btn)`. "YANCORE" va en mayúsculas porque es el nombre de la marca.

Prueba a 1280 y 360 en todas las páginas: se ve el logo, sin scroll horizontal, sin CLS nuevo y con contraste AA. Actualiza `plans/MEMORIA.md`.

## Prompt 3: subsecciones con botones

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y la sección 3 del plan `plans/planes/2026-11-09-fotos-editor-carrusel-color-y-footer.md`.

Crea un solo componente en `public/js/comun.js`: `mostrarSubseccion(grupo, sub)` y la acción `subseccion` en `ACCIONES` (revisa antes cómo `necutools.js` registra las suyas). Usa `.tabs` con botones `.btn.secondary.btn-sm`, `aria-pressed` y `role="group"` con `aria-label`. Cada contenido va en un envoltorio nuevo `.subseccion`, con `data-grupo` y `data-sub`, para no pelear con el `hidden` propio de `#tienda-card`, `#card-sistema`, `#colores-card` y `#fotos-card`. Si el botón activo queda oculto, pasa al primero visible. Conserva todos los `id`, `data-action` y clases que usa el JavaScript.

Secciones:

- Necutools → Mi cuenta: Mi correo · Contraseña · Verificación en dos pasos · Servidor (botón con `data-solo-dueno`).
- Necutools → Productos y servicios: Catálogo (abre por omisión) · Agregar producto, que cambia a "Editar producto" al editar · Colores y fotos, visible solo al editar un producto (no un servicio).
- Necutools → Tiendas: Tus tiendas · Crear tienda, que cambia a "Editar tienda" al editar (los encargados solo lo ven al editar) · Subcategorías.
- `public/cuenta.html` y `public/js/cuenta.js`: Mis datos · Contraseña · Eliminar mi cuenta. `#cuenta-completar` queda arriba, fuera de los botones.

Resumen, Pedidos, Ofertas, Opiniones, Promociones, Usuarios y Bitácora no cambian.

"Editar" en una fila abre su subsección y sube al inicio del panel, en lugar del `scrollIntoView` actual. Al crear un producto nuevo, se abre "Colores y fotos". Actualiza los textos que digan "con el formulario de arriba".

Prueba a 1280 y 360 con un dueño y un encargado temporales, en las 4 secciones y con teclado. En `cuenta.html` prueba con cuenta completa e incompleta. Comprueba que siguen funcionando todos los formularios, incluida la activación de 2 pasos, sin errores de consola. Borra lo temporal y actualiza `plans/MEMORIA.md`.

## Prompt 4: guardar a la vista y filas de colores

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y la sección 4 del plan `plans/planes/2026-11-09-fotos-editor-carrusel-color-y-footer.md`. Requiere el prompt 3 aplicado.

- Agrega en el panel de Productos una `.barra-guardar`, común a "Agregar/Editar producto" y "Colores y fotos": `position: sticky; bottom: 0`, fondo `--hoja`, borde superior `--linea`, sin sombra. No se muestra en Catálogo. Comprueba que ningún contenedor padre con `overflow` rompa el sticky.
- La barra dice qué se edita y "Cambios sin guardar" o "Todo guardado" (escucha `input` y `change` del formulario).
- En datos: botón principal "Guardar producto" y "Cancelar edición".
- En Colores y fotos sin cambios pendientes: "Volver al catálogo" y el texto "Los colores y las fotos se guardan al agregarlos". Con cambios pendientes también aparece "Guardar producto".
- El botón va fuera de `#form-producto`, porque `form-color` y `form-foto` no se pueden anidar. Usa `data-action`: si el formulario no es válido, muestra primero la subsección de datos y luego `reportValidity()`; si es válido, `requestSubmit()`.
- `modoEdicion` debe buscar el botón "Cancelar" en `document`, no dentro del form.
- Al salir de la edición con cambios sin guardar (cancelar, editar otro, cambiar de panel), pide confirmar con `confirmar()`.
- Después de guardar un producto existente, vuelve a Catálogo; el aviso actual se conserva.
- Agrega `.form-actions.is-fija` (sticky, mismos tokens) solo en el `.form-actions` final de tienda, oferta, promoción, usuario y editor de pedido. En promoción hay otro `.form-actions` dentro del fieldset que no lleva la clase.
- Filas de colores: en `public/style.css`, `.sub-row.color-row` pasa a `grid-template-columns: 48px 1fr auto auto auto` y `.btn.btn-icon` lleva `flex: none`. Revisa la vista de 640 px o menos.

Prueba a 1280 y 360: la barra sigue visible al final de cada formulario largo, un campo obligatorio vacío desde otra subsección lleva a ese campo, el aviso de cambios funciona, y los botones de color miden 36×36 con 1 y con 12 colores. No debe quedar un formulario tapado por la barra. Actualiza `plans/MEMORIA.md`.

## Prompt 5: carrusel por color, base de datos y API

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y la sección 5 del plan `plans/planes/2026-11-09-fotos-editor-carrusel-color-y-footer.md`.

- Agrega a `db/mariadb/schema.sql`, de forma idempotente, `CREATE TABLE IF NOT EXISTS producto_color_fotos` (`id`, `color_id` con FK a `producto_colores` y `ON DELETE CASCADE`, `imagen` MEDIUMBLOB, `imagen_tipo`, `orden`, `creado_en`, índice por `color_id, orden`). Córrela en la base local. No toques `producto_fotos` ni `COLUMNAS_PRODUCTO`.
- `app/admin.php`: `POST /api/admin/colores/:id/fotos`, `PUT /api/admin/colores/:id/fotos/orden` y `DELETE /api/admin/color-fotos/:id`, imitando las rutas de `producto_fotos`: `requiere_admin()`, permiso de la tienda, `imagen_de()`, máximo `MAX_FOTOS_EXTRA`, `anotar()`, validación de que los ids del orden pertenezcan a ese color. El listado de colores agrega `fotos: [{id, imagen_url}]`, sin mandar los blobs.
- `app/http.php`: agrega `colores/[0-9]+/fotos` a `CON_IMAGEN`. Sin esto, la subida da 413 como pasó el 2026-11-08.
- `app/api.php`: `GET /api/colores/:id/fotos/:foto` con la misma revisión de visibilidad que `/api/productos/:id/fotos/:foto` (producto y tienda visibles), y `fotos` en cada color de `GET /api/productos/:id`: primero la principal del color y luego las demás en orden. SQL siempre con parámetros.
- `public/js/necutools.js`: agrega la tabla nueva al mapa de nombres de la bitácora.
- `scripts/seguridad/ataques.js`: pruebas de 401 sin sesión, 403 de encargado ajeno, máximo de fotos, archivo falso y color oculto. Córrelo solo contra localhost, con el Node del driver de Playwright.

Prueba con PNG reales de 25, 200 y 900 KB (sin 413), más de 1 MB (400), color borrado (sus fotos se borran) y las respuestas de la API. Borra los datos de prueba y actualiza `plans/MEMORIA.md`, avisando que en IONOS la tabla debe crearse antes que el código.

## Prompt 6: carrusel por color, editor y página del producto

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y la sección 6 del plan `plans/planes/2026-11-09-fotos-editor-carrusel-color-y-footer.md`. Requiere los prompts 3, 4 y 5 aplicados.

Necutools → Colores y fotos:

- Debajo de la lista de colores, una tarjeta "Carrusel" con botones `Producto base` y uno por color (`.btn.secondary.btn-sm` con `aria-pressed`).
- Texto: "Producto base: lo primero que ve el cliente al entrar. Cada color tiene su propio carrusel, que se ve cuando el cliente elige ese color."
- Reutiliza `renderFotos`, `guardarFoto`, `moverFoto` y `borrarFoto` con un destino (base o color) guardado en `st`.
- La primera fila muestra la foto principal, sin botones, con el aviso de dónde se cambia (en datos del producto o al editar el color).
- Al agregar un color, queda elegido para seguir con sus fotos. Si se borra el color elegido, vuelve a Producto base.

Página del producto (`public/js/producto.js`, `crearCarrusel` en `public/js/comun.js`):

- Agrega `cambiar(lista)`, que reemplaza `fijar`: cambia la lista, vuelve a la primera foto y sigue corriendo si hay 2 o más.
- El carrusel debe existir también si el base tiene una sola foto pero algún color tiene varias.
- Flechas y puntos solo con 2 fotos o más; regenera los puntos al cambiar de lista.
- Al entrar se ve el carrusel base y queda marcado el primer color disponible, como hoy. Con `?color=`, el de ese color.
- Al elegir un color se ve su carrusel. Las tarjetas siguen con el carrusel base.
- No cambies la lógica del carrito: el `data-color` y el nombre del botón siguen igual.
- Con movimiento reducido no cambia solo.

El movimiento automático amplía la excepción del plan `2026-11-08-carrusel-fotos-producto.md`: anótalo en la memoria.

Prueba a 1280 y 360 con un dueño temporal: base con 1 y con varias fotos, colores con 1 y con 6, cambio entre colores, `?color=`, flechas, puntos, pausa, movimiento reducido, agregar al carrito con el color correcto, CLS y consola. Borra lo temporal y actualiza `plans/MEMORIA.md`.

## Prompt 7: pruebas finales, commit y subida a IONOS

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan `plans/planes/2026-11-09-fotos-editor-carrusel-color-y-footer.md`.

Corre la verificación completa del plan en local y `scripts/seguridad/ataques.js` solo contra localhost. Haz el commit en `main` con `runuser`, sin ramas. El push lo hace el usuario desde VS Code.

Pregunta si se sube a IONOS y sube solo si el usuario lo autoriza en esa petición:

1. Compara el md5 de los archivos del servidor con el commit anterior.
2. Respalda archivos y base en `~/respaldos/2026-11-09-.../` con permisos 600.
3. Crea `producto_color_fotos` **antes** de subir el código y compara los conteos de tiendas, productos, colores y pedidos.
4. Sube con rsync y comprueba que los archivos quedaron idénticos.
5. Prueba en vivo sin crear datos, simulando en el navegador lo que haga falta, a 1280 y 360. Revisa CLS, consola y que nada llegue a Google sin aceptar cookies, y espacia las pruebas por el límite de 300 peticiones de la API.

Lee las credenciales solo a variables, sin imprimirlas. Al terminar, cambia el estado del plan a `aplicado` y actualiza `plans/MEMORIA.md`; la subida real de fotos con sesión la prueba el usuario.
