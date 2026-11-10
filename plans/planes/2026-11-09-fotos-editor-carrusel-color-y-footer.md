# Plan: fotos completas, editor de productos, carrusel por color, subsecciones y crédito YANCORE

- **Fecha:** 2026-11-09
- **Estado:** en curso
- **Prompts:** `plans/prompts/2026-11-09-fotos-editor-carrusel-color-y-footer.md` (7 prompts, en orden)
- **Alcance:** cómo se muestran las fotos (sin reprocesar archivos), crédito YANCORE en el pie, subsecciones con botones en Necutools y en Mi cuenta, barra de guardar en los formularios largos, filas de colores y carrusel propio por color (tabla nueva, API, Necutools y página del producto). No cambia la lógica del carrito ni el envío por WhatsApp.

## Contexto

El usuario pidió 5 mejoras. Lo que se encontró en el código y en las fotos reales de IONOS:

1. **Fotos recortadas.** Desde `09c1e78` todo usa `object-fit: cover`. El cable USB a Lightning (928×1152) y el logo de Goat Brothers pierden mucho alto en marcos de 16:10 y 4:3. Goat Brothers mide 1440×1440: no es chico, el problema es la forma.
2. **Guardar incómodo.** "Guardar" está antes de Colores y Más fotos, que se guardan solos. Eso confunde y obliga a subir.
3. **Botones aplastados.** `.sub-row.color-row` declara 4 columnas, pero la fila tiene 5 hijos. Los botones caen a una fila nueva en la columna de 48 px y dos botones de 36 px se encogen (`public/style.css:4244`).
4. **Carrusel por color.** Hoy el color solo tiene una foto y al elegirlo el carrusel se detiene (`fijar`, `public/js/comun.js`).
5. **Scroll largo** en Mi cuenta, Productos y Tiendas.
6. **Crédito** en el pie, a la derecha de "© 2026 Necutla, la ciudad del estudiante." (el texto no llegó en el mensaje; se toma este, que es el único de esa barra).

## Decisiones del usuario

- Franjas: **color del borde de la propia foto**; si el borde es muy variado o transparente, `--gis`. Es una **excepción de diseño solo para este plan** (color calculado, no un hex en el código); se anota en MEMORIA.
- Subsecciones también en la **página pública Mi cuenta** (`cuenta.html`).

## Cambios

### 1. Fotos completas sin perder calidad (`public/js/comun.js`, `public/style.css`)

No se reprocesa ni se vuelve a comprimir ningún archivo (`app/imagenes.php` no se toca): cambia cómo se muestra.

- `ajustarFoto(img)`, con la proporción de cada marco fija: `.producto-img` 4/3, tarjetas y `.letrero-img` 16/10, `.admin-thumb` 1/1.
- Si `cover` recortaría más del 20 %, o la imagen es más angosta que su marco: clase `.foto-completa` con `object-fit: scale-down` (se ve entera y nunca se agranda de más). Si no, sigue `cover`. Las fotos horizontales siguen llenando el marco, como pidió el usuario el 2026-11-08. Los `.svg` no cambian.
- Color de franja: muestra los bordes en un canvas chico; pone `--foto-fondo` con `style.setProperty` en la imagen; `.foto-completa { background: var(--foto-fondo, var(--gis)); }`.
- Se aplica con un listener de `load` en captura y un barrido al cargar.
- En `crearCarrusel` se ajusta antes de `img.src` (con la imagen ya decodificada) y la copia `.carrusel-sale` conserva `.foto-completa` y su fondo. **Ojo:** hoy `sale.className = …` borra las clases, y el `style` copiado podría chocar con la CSP: asignarlo con `setProperty`.

### 2. Crédito YANCORE (10 páginas con `.footer-bottom`, `public/style.css`)

- `public/imagenes/yancore.png` de 96×96, generado con GD de `php8.5` a partir de `~/Descargas/logo yancore.jpeg` (el original no se toca).
- "By YANCORE" y el logo a 32 px (`width`/`height` puestos, `alt=""`), al extremo derecho con flex; a 360 px baja sin scroll horizontal. Los colores del logo son parte del archivo, igual que el de Necutla.

### 3. Subsecciones con botones (`public/js/comun.js`, `public/necutools.html`, `public/js/necutools.js`, `public/cuenta.html`, `public/js/cuenta.js`, `public/style.css`)

Componente único: `.tabs` con `.btn.secondary.btn-sm` y `aria-pressed` (ya aprobado), `data-action="subseccion"`. Cada contenido va en un **envoltorio nuevo** `.subseccion` para no pelear con el `hidden` propio de `#tienda-card`, `#card-sistema` y compañía.

| Sección | Botones |
|---|---|
| Necutools → Mi cuenta | Mi correo · Contraseña · Verificación en dos pasos · Servidor (solo dueños) |
| Necutools → Productos y servicios | Catálogo · Agregar producto (o "Editar producto") · Colores y fotos (solo al editar un producto) |
| Necutools → Tiendas | Tus tiendas · Crear tienda (o "Editar tienda"; encargados solo al editar) · Subcategorías |
| `cuenta.html` | Mis datos · Contraseña · Eliminar mi cuenta (`#cuenta-completar` queda arriba, fuera de los botones) |

Resumen, Pedidos, Ofertas, Opiniones, Promociones, Usuarios y Bitácora no cambian (2 subsecciones o menos). Si el botón activo se oculta, se pasa al primero visible. "Editar" en una fila abre su subsección y sube al inicio del panel, en lugar de `scrollIntoView`.

### 4. Guardar a la vista y filas de colores (`public/necutools.html`, `public/js/necutools.js`, `public/style.css`)

- **Productos:** `.barra-guardar` pegada abajo (`position: sticky`, `--hoja`, borde `--linea`, sin sombra), común a "Agregar/Editar producto" y "Colores y fotos".
  - Dice qué se edita y si hay "Cambios sin guardar" (escucha `input` y `change`).
  - En datos: "Guardar producto" y "Cancelar edición".
  - En colores y fotos, si no hay cambios pendientes: "Volver al catálogo" y el texto "Los colores y las fotos se guardan al agregarlos".
- El botón queda fuera del `<form>` porque `form-color` y `form-foto` no pueden anidarse. Si falta un campo, primero muestra la subsección de datos y luego valida (un campo oculto no puede recibir el foco). `modoEdicion` debe buscar "Cancelar" en `document`.
- Salir con cambios sin guardar pide confirmar con `confirmar()`.
- Otros formularios con el mismo problema: `.form-actions.is-fija` (sticky) en tienda, oferta, promoción, usuario y editor de pedido.
- **Filas de colores:** `grid-template-columns: 48px 1fr auto auto auto` y `.btn.btn-icon { flex: none; }`. Revisar a 360 px.

### 5. Carrusel propio por color: base de datos y API

- `db/mariadb/schema.sql`: `CREATE TABLE IF NOT EXISTS producto_color_fotos` (`color_id` con `ON DELETE CASCADE`, `imagen`, `imagen_tipo`, `orden`). Tabla aparte para no tocar `COLUMNAS_PRODUCTO`. Hasta 5 fotos además de la principal del color (`MAX_FOTOS_EXTRA`).
- `app/admin.php`: `POST /api/admin/colores/:id/fotos`, `PUT .../fotos/orden`, `DELETE /api/admin/color-fotos/:id`, con `requiere_admin()`, permiso de tienda, `imagen_de()` y `anotar()`, igual que las rutas de `producto_fotos` (`app/admin.php:601-640`). El listado de colores agrega `fotos`.
- `app/http.php`: agregar `colores/[0-9]+/fotos` a `CON_IMAGEN` (su ausencia causó el 413 del 2026-11-08).
- `app/api.php`: `GET /api/colores/:id/fotos/:foto` y `fotos` en cada color de `GET /api/productos/:id` (principal primero). SQL con parámetros.
- `scripts/seguridad/ataques.js`: pruebas nuevas (401 sin sesión, 403 encargado ajeno, máximo, archivo falso).

### 6. Carrusel por color: editor y página del producto

- **Necutools → Colores y fotos:** lista de colores y, debajo, una tarjeta "Carrusel" con botones `Producto base · Blanco · Negro`.
  - Texto: "Producto base: lo primero que ve el cliente al entrar. Cada color tiene su propio carrusel, que se ve cuando el cliente elige ese color."
  - `renderFotos`, `guardarFoto`, `moverFoto` y `borrarFoto` se reutilizan con un destino (base o color).
  - La primera fila es la principal, con el aviso de dónde se cambia. Al agregar un color queda elegido para seguir con sus fotos.
- **`public/js/producto.js` y `crearCarrusel`:** método `cambiar(lista)` que reemplaza `fijar`. Al entrar se ve el carrusel base y queda marcado el primer color disponible, como hoy; con `?color=`, el de ese color. Al elegir un color, su carrusel corre (flechas y puntos solo con 2 fotos o más), aunque el base tenga una sola. Las tarjetas siguen con el carrusel base. No cambia la lógica del carrito.
- El movimiento automático amplía la excepción del plan del carrusel; se anota en MEMORIA.

### 7. Pruebas finales, commit y subida

Commit en `main` (sin ramas) con `runuser`; el push lo hace el usuario desde VS Code. Subida a IONOS **solo con permiso en esa petición**: md5 contra el commit anterior, respaldo, crear la tabla **antes** del código, rsync, prueba en vivo. Credenciales solo a variables, sin imprimirlas.

## Orden de prompts

1. Fotos completas · 2. Crédito YANCORE · 3. Subsecciones · 4. Barra de guardar y filas de colores · 5. BD y API del carrusel por color · 6. Editor y página del producto · 7. Pruebas finales y subida.

## Verificación

- Chrome local a 1280 y 360 con movimiento normal y reducido: sin scroll horizontal, sin errores de consola ni CSP, CLS sin aumentar.
- **Fotos:** el archivo servido es idéntico (md5) al original; imagen vertical, cuadrada, de 40 px, horizontal, PNG transparente y `.svg`, en tarjeta, página de producto, tienda y Necutools; el recorte solo pasa en las proporciones parecidas; franjas correctas durante el carrusel.
- **Subsecciones:** con dueño y encargado temporales, en las 4 secciones; los paneles de 2 o menos no cambian.
- **Guardar:** la barra sigue visible al final de cada formulario largo; campo obligatorio vacío desde otra subsección; aviso de cambios sin guardar.
- **Colores:** botones de 36×36 con 1 y 12 colores; carrusel por color de punta a punta; color borrado borra sus fotos; subir fotos de 900 KB reales (sin 413).
- `ataques.js` con el Node del driver de Playwright; datos de prueba borrados al terminar.
- `plans/MEMORIA.md` al final de cada prompt que cambie algo.
