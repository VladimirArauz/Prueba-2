# Prompts: Necutla como catálogo de varias tiendas

- **Plan:** `plans/planes/2026-10-17-catalogo-multitienda.md`
- **Cómo usarlos:** en orden, uno por sesión (o uno tras otro en la misma), con la sesión abierta en `Prueba-2`.
  Cada fase se puede subir a GitHub por separado; Render redespliega y la migración corre sola al arrancar.
- **Antes del prompt 1:** respaldar la base de Render desde pgAdmin (clic derecho en `necutla` → *Backup…*).

---

## Prompt 1: base de datos y permisos

```
Lee plans/CLAUDE.md, plans/MEMORIA.md y plans/planes/2026-10-17-catalogo-multitienda.md.
Aplica la fase 1 del plan:
- En db/schema.sql agrega, de forma idempotente (IF NOT EXISTS, ON CONFLICT, DROP CONSTRAINT IF EXISTS),
  las tablas y columnas de la sección "Base de datos": slug, descripcion, icono, whatsapp, orden, visible y
  portada en stands; tablas subcategorias, ofertas, promociones, promocion_items y admin_stands; tipo,
  subcategoria_id, precio_modo, visible, orden e imagen_ruta en productos (reemplaza el CHECK del precio
  para permitir NULL solo con precio_modo 'cotizar'); rol y activo en admins.
- Migración: slugs de las 7 tiendas, pasar el texto de productos.categoria a subcategorias y enlazarlo,
  y el admin que ya existe queda como 'dueno'. No borres columnas ni datos.
- Mueve texto(), idValido(), leerImagen(), handle() y ErrorDeDatos a server/validar.js y úsalos desde api.js.
- En server/auth.js: guarda el rol en la sesión, agrega requireDueno y puedeEditarStand(req, standId),
  y rechaza el login de admins con activo = false.
- Crea server/admin.js montado en /api/admin con: usuarios (solo dueño: listar, crear, desactivar,
  asignar tiendas, reiniciar contraseña; contraseñas de 12+ caracteres con bcrypt) y PUT /mi-password.
- Las rutas de productos que ya existen deben respetar puedeEditarStand.
Prueba en local con PostgreSQL: corre el esquema dos veces seguidas sin errores; con curl comprueba
401 sin sesión, 403 de un encargado sobre una tienda ajena y sobre /api/admin/usuarios, 400 con datos
inválidos. La página actual debe seguir funcionando igual. Actualiza plans/MEMORIA.md y el estado del
plan, y dame los comandos de git.
```

## Prompt 2: tiendas dinámicas e importación de ejemplos

```
Lee plans/CLAUDE.md, plans/MEMORIA.md y plans/planes/2026-10-17-catalogo-multitienda.md.
Aplica la fase 2 del plan:
- API pública: GET /api/stands (solo visibles, con conteo de productos y servicios, ordenadas por orden)
  y GET /api/stands/:slug (tienda, subcategorías, productos y servicios visibles; números de WhatsApp
  de la tienda o, si no tiene, los de WHATSAPP_NUMBERS).
- En server/index.js sirve /t/:slug con public/tienda.html.
- Crea public/tienda.html y public/js/tienda.js: encabezado de la tienda, pestañas Productos | Servicios
  (la de Ofertas queda lista para la fase 5), filtro por subcategoría con .btn.secondary.btn-sm,
  ?sub=<slug> en la URL y paginación de 12 en 12. Usa solo las clases y tokens de style.css; si algo
  de verdad no cabe, propónmelo antes de crearlo.
- Crea scripts/importar-ejemplos.js (npm run importar): lee las páginas fijas de public/<tienda>/<sub>/,
  copia las imágenes a public/imagenes/ejemplos/<tienda>/, y carga subcategorías y productos con
  imagen_ruta sin duplicar si se corre de nuevo. Córrelo en local.
- Redirige con 301 las rutas viejas: /<tienda>/ → /t/<tienda>, /<tienda>/<sub>/ → /t/<tienda>?sub=<sub>,
  /<tienda>/carrito.html → /carrito.html (por ahora la página actual del carrito).
- Enséñame la lista de archivos a borrar (las 7 carpetas de tiendas y js_carrito.js) y bórralos solo
  cuando te lo confirme.
Prueba en local: cada tienda muestra sus productos importados, el filtro y la paginación funcionan,
las rutas viejas redirigen, cero errores de CSP, capturas a 1280px y 360px. Actualiza plans/MEMORIA.md
y el estado del plan, y dame los comandos de git (incluye cómo correr la importación en Render:
Shell del servicio → npm run importar).
```

## Prompt 3: Necutools nuevo

```
Lee plans/CLAUDE.md, plans/MEMORIA.md y plans/planes/2026-10-17-catalogo-multitienda.md.
Aplica la fase 3 del plan:
- Saca Necutools de index.html y app.js a public/necutools.html + public/js/necutools.js
  (con un enlace en la barra a /necutools.html).
- Pestañas: Mis tiendas (crear y borrar solo dueño; editar nombre, slug, descripción, icono elegido de
  la lista de iconos.js, números de WhatsApp, visible, orden y subcategorías), Productos y servicios
  (filtrados por tienda, con tipo, precio_modo fijo/desde/cotizar, subcategoría, visible e imagen),
  Usuarios (solo dueño) y Mi cuenta (cambiar contraseña).
- API en server/admin.js para tiendas, subcategorías, productos y servicios, validando cada campo
  y usando puedeEditarStand. Un encargado solo ve y edita sus tiendas.
- Sin onclick ni style en línea: data-action con un listener delegado; escapeHTML en todo lo que venga
  de datos.
Prueba en local: el dueño crea una tienda nueva con una subcategoría, un producto y un servicio, y
aparecen en /t/<slug>; un encargado solo ve su tienda y recibe 403 en las demás; cambiar la
contraseña funciona. Actualiza plans/MEMORIA.md y el estado del plan, y dame los comandos de git.
```

## Prompt 4: carrito agrupado por tienda

```
Lee plans/CLAUDE.md, plans/MEMORIA.md y plans/planes/2026-10-17-catalogo-multitienda.md.
Aplica la fase 4 del plan:
- Crea public/js/comun.js con api(), escapeHTML, money, showToast y el carrito: guarda
  {tipo, id, cantidad} en localStorage con la clave necutla_carrito, migra una vez el carrito viejo
  (necutla_carrito_global y carrito_<tienda>) y actualiza el contador de la barra.
- Agrega POST /api/carrito/precios: recibe ids y cantidades, y devuelve nombre, tienda, precio y
  números de WhatsApp desde la base (el precio que mande el navegador se ignora).
- Rehaz public/carrito.html + public/js/carrito.js: grupos por tienda con subtotal, cambiar cantidad,
  quitar, vaciar con confirmación, y en cada grupo "Enviar pedido a <Tienda> por WhatsApp" que abre los
  números de esa tienda con noopener y vacía solo ese grupo.
- En tienda.js, el botón "Agregar al carrito" para productos y "Pedir información por WhatsApp"
  para servicios (sin pasar por el carrito).
- Quita la sección Carrito de index.html y el código que sobre en app.js.
Prueba en local: agrega productos de dos tiendas → el carrito muestra 2 grupos → cada botón abre
WhatsApp con los números correctos; cambiar el precio en localStorage no cambia el total. Actualiza
plans/MEMORIA.md y el estado del plan, y dame los comandos de git.
```

## Prompt 5: ofertas de la tienda (por día)

```
Lee plans/CLAUDE.md, plans/MEMORIA.md y plans/planes/2026-10-17-catalogo-multitienda.md.
Aplica la fase 5 del plan:
- CRUD de ofertas en server/admin.js y en la pestaña "Ofertas de la tienda" de Necutools: a qué aplica
  (un producto, una subcategoría o toda la tienda), tipo (porcentaje, precio especial o 2x1), valor,
  días de la semana y activa. Encargados solo en sus tiendas.
- Hay un solo lugar en el servidor que calcula las ofertas de hoy (zona America/Mexico_City).
  Úsalo en GET /api/stands/:slug, en el nuevo GET /api/hoy y en POST /api/carrito/precios.
- En tienda.js: pestaña Ofertas con las de toda la semana (resaltando la de hoy) y etiqueta en la
  tarjeta del producto. Para la etiqueta propón una clase con --senal y borde --tinta, y enséñamela
  antes de dejarla.
- En el carrito: muestra el descuento por grupo y agrégalo al mensaje de WhatsApp.
Prueba en local cambiando el día (variable de prueba o fecha simulada): porcentaje, precio especial y
2x1 con cantidades pares e impares. Actualiza plans/MEMORIA.md y el estado del plan, y dame los
comandos de git.
```

## Prompt 6: promociones generales (paquetes de temporada)

```
Lee plans/CLAUDE.md, plans/MEMORIA.md y plans/planes/2026-10-17-catalogo-multitienda.md.
Aplica la fase 6 del plan:
- CRUD de promociones en server/admin.js (solo dueño): título, descripción, imagen, precio del paquete,
  productos incluidos con cantidad, fecha de inicio y fin, destacada y activa.
- GET /api/promociones con solo las vigentes. En el carrito un paquete es {tipo:'paquete', id}: forma
  su propio grupo, su precio viene del servidor y el mensaje de WhatsApp se manda a los vendedores de
  todas las tiendas incluidas (lista de números sin repetir).
- En la portada, "Promociones de temporada" justo debajo del hero (máximo 3 destacadas) y una página
  public/promociones.html con todas.
- Diseño: plans/CLAUDE.md dice que solo el tablero del hero es llamativo, pero el socio quiere que las
  promociones se vean más. Haz la propuesta del plan (letrero plano en --tinta con título en --senal,
  sin animación ni degradado), enséñame capturas a 1280px y 360px y espera mi visto bueno.
Prueba en local: una promoción fuera de fechas no aparece; un paquete de Ropa + Dulces avisa a los
vendedores de las dos tiendas. Actualiza plans/MEMORIA.md y el estado del plan, y dame los comandos de git.
```

## Prompt 7: portada ordenada, buscador y cierre

```
Lee plans/CLAUDE.md, plans/MEMORIA.md y plans/planes/2026-10-17-catalogo-multitienda.md.
Aplica la fase 7 del plan:
- El tablero del hero y las tarjetas de tiendas salen de /api/stands (las tiendas nuevas aparecen solas).
- En la portada, "Ofertas de hoy" con una línea por tienda (máximo 6) que enlaza a /t/<slug>.
- Buscador: GET /api/buscar?q= (de 2 a 60 caracteres, máximo 20 resultados, SQL con parámetros e
  índice en productos.nombre) y caja de búsqueda en la portada con resultados agrupados por tienda.
- Ordena app.js en public/js/portada.js y borra el código que ya no se use.
- Actualiza README.md, .env.example y render.yaml si cambió alguna variable.
- Revisión final del plan entero: sin emojis en la interfaz, sin style="" ni onclick, sin degradados ni
  mayúsculas, que se vea bien a 360px, cero errores de CSP y todos los puntos de "Verificación" del plan.
Cambia el estado del plan a "aplicado", actualiza plans/MEMORIA.md (resuelve los pendientes 8, 9 y 11) y
dame los comandos de git.
```
