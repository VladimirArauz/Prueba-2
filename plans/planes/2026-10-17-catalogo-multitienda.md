# Plan: Necutla como catálogo de varias tiendas (tiendas, servicios, ofertas y promociones)

- **Fecha:** 2026-10-17
- **Estado:** aplicado (fases 1 a 7, 2026-10-17). Detalle, desviaciones y pendientes en `plans/MEMORIA.md`.
- **Prompts asociados:** `plans/prompts/2026-10-17-catalogo-multitienda.md`
- **Alcance:** base de datos, API, Necutools con roles, tiendas dinámicas con subcategorías y servicios, carrito agrupado por tienda, ofertas por día de cada tienda, promociones generales en forma de paquete, portada ordenada. El sistema de diseño de `plans/CLAUDE.md` no cambia.

## Contexto

Ya está desplegado en Render (base con `stands`, `productos`, `admins`, `session`). Hoy las 7 tiendas son
páginas HTML fijas (`public/ropa/playeras/index.html`…) con productos escritos a mano y un carrito por
tienda; Necutools solo crea productos y stands sueltos, y todos los admins pueden hacer todo. Los
pedidos de WhatsApp llegan a los mismos números sin importar la tienda.

Lo que pide el socio, resumido en 6 ideas:
1. **Catálogo de varios negocios**: la portada muestra las tiendas, cada una con nombre propio y su
   catálogo ordenado en subcategorías (Ropa → Playeras, Pantalones…).
2. **Comprar por tienda**: cada tienda tiene sus vendedores; el pedido de Tecnología le llega solo a
   los vendedores de Tecnología (ej. Fer y él).
3. **Necutools con acceso limitado** (él, Axel, Fer y Aura): crear tiendas nuevas y editar su catálogo.
4. **Servicios en cada tienda** (dulceros y piñatas, kits de papelería por presupuesto, reparación de
   aparatos), aparte de los productos.
5. **Ofertas de la tienda**: las fijas de cada día de la semana, todo el año ("lunes 2x1 en barritas").
6. **Promociones generales**: de temporada, más visibles, que pueden mezclar tiendas (Día de Muertos,
   Navidad, "nuestro Buen Fin").
Todo esto con una regla: el catálogo puede ser enorme, pero tiene que estar ordenado y no saturado.

Lo que decidió el usuario:
- **Permisos:** dueños y encargados. El dueño crea tiendas y usuarios y edita todo; el encargado
  solo edita las tiendas que tiene asignadas.
- **Promos que mezclan tiendas:** se manejan como **paquetes**, con precio propio. Al pedir uno se
  avisa a los vendedores de todas las tiendas que incluye.
- **Carrito:** uno solo para todo el sitio, **agrupado por tienda**, con un botón de envío por
  WhatsApp para cada grupo.
- **Productos de ejemplo actuales:** se **importan** una vez a la base y después se quitan las
  páginas fijas.

## Arquitectura nueva

```
public/
├── index.html      portada: tablero de tiendas, promociones vigentes, ofertas de hoy, buscador
├── tienda.html     UNA sola página para todas las tiendas (/t/<slug>)
├── carrito.html    carrito agrupado por tienda
├── necutools.html  panel de administración (sale de index.html)
├── js/comun.js     api(), escapeHTML, money, toast, carrito en localStorage (sale de app.js)
├── js/portada.js, js/tienda.js, js/carrito.js, js/necutools.js
├── iconos.js, style.css
└── imagenes/ejemplos/<tienda>/…   imágenes de los productos importados
```
- Express sirve `/t/:slug` con `tienda.html`. Las rutas viejas (`/ropa/`, `/ropa/playeras/`,
  `/tecnologia/carrito.html`…) redirigen con 301 a `/t/ropa?sub=playeras` o a `/carrito.html`.
- Se borran las 7 carpetas de tiendas (37 HTML y 7 copias de `carrito.js`), `js_carrito.js` y
  la parte de Necutools de `index.html` y `app.js`.
- Sin frameworks ni dependencias nuevas: HTML, CSS y JS sencillos, varios archivos en `public/js/`.

## Base de datos (`db/schema.sql`, todo idempotente)

| Tabla | Cambios / columnas |
|---|---|
| `stands` | + `slug` UNIQUE, `descripcion`, `icono` (nombre de un icono de `iconos.js`), `whatsapp TEXT[]`, `orden`, `visible`, `portada`/`portada_tipo` |
| `subcategorias` (nueva) | `id, stand_id, nombre, slug, orden`, UNIQUE (stand_id, slug) |
| `productos` | + `tipo` (`producto`/`servicio`), `subcategoria_id`, `precio_modo` (`fijo`/`desde`/`cotizar`; con `cotizar` el precio puede ser NULL, así que se reemplaza el CHECK), `visible`, `orden`, `imagen_ruta` (ruta estática de los ejemplos, validada con `^/imagenes/ejemplos/…`). El texto que hoy está en `categoria` se pasa a `subcategorias` |
| `ofertas` (nueva) | `id, stand_id, producto_id` o `subcategoria_id` (o la tienda completa), `titulo`, `tipo` (`porcentaje`/`precio_especial`/`dos_por_uno`), `valor`, `dias SMALLINT[]` (0–6), `activa` |
| `promociones` (nueva) | `id, titulo, descripcion, precio, inicio, fin, destacada, activa, imagen` |
| `promocion_items` (nueva) | `promocion_id, producto_id, cantidad` |
| `admins` | + `rol` (`dueno`/`encargado`, y el admin que ya existe pasa a `dueno`), `activo` |
| `admin_stands` (nueva) | `admin_id, stand_id` (las tiendas de cada encargado) |

- El día de la semana se calcula en el servidor con la zona `America/Mexico_City`.
- `WHATSAPP_NUMBERS` se queda como respaldo para las tiendas que no tengan números propios.

## API (`server/api.js` público, `server/admin.js` nuevo)

**Pública:** `GET /api/stands` (tiendas visibles con su conteo), `GET /api/stands/:slug` (tienda +
subcategorías + productos + servicios + ofertas de hoy), `GET /api/hoy` (ofertas de hoy de todas las
tiendas), `GET /api/promociones` (vigentes), `GET /api/buscar?q=`, `POST /api/carrito/precios`
(recibe ids y devuelve precios con las ofertas aplicadas; **el servidor manda en los precios**).

**Admin (`/api/admin/*`, todo con `requireAdmin`):** CRUD de tiendas, subcategorías, productos,
servicios, ofertas, promociones, usuarios y `PUT /api/admin/mi-password`.
- Helpers nuevos en `server/auth.js`: `requireDueno` y `puedeEditarStand(req, standId)`. Este último
  revisa en `admin_stands`; los dueños pasan siempre.
- Se reutilizan `texto()`, `idValido()`, `leerImagen()`, `handle()` y `ErrorDeDatos` de `server/api.js`.
  Se mueven a `server/validar.js` para que los usen los dos routers.
- Crear o borrar tiendas, usuarios y promociones generales: solo el dueño. Lo demás: dueño o
  encargado de esa tienda.

## Funcionalidades por pantalla

- **Portada:** el tablero del hero ahora sale de la base. Abajo: "Promociones de temporada" (máximo
  3 destacadas, con un enlace a todas), "Ofertas de hoy" (una línea por tienda, máximo 6) y un
  buscador de productos y servicios.
- **Tienda `/t/<slug>`:** encabezado (nombre, descripción, a quién le llega el pedido). Después
  pestañas **Productos | Servicios | Ofertas**, filtro por subcategoría con botones `.btn.secondary
  .btn-sm` y paginación de 12 en 12 para que no se sature.
- **Servicios:** tarjeta con precio fijo, "Desde $X" o "Cotiza tu precio". El botón es "Pedir
  información por WhatsApp": abre WhatsApp con los números de la tienda y no pasa por el carrito.
- **Carrito:** las entradas se guardan como `{tipo, id, cantidad}` en `necutla_carrito`, y el
  carrito viejo se migra una vez. Al abrir, se piden los precios a `/api/carrito/precios`. Se agrupa
  por tienda, con subtotal y descuentos de cada grupo, y cada grupo tiene "Enviar pedido a
  <Tienda> por WhatsApp". Un paquete forma su propio grupo y avisa a los vendedores de cada tienda
  incluida. Al enviar, solo se vacía ese grupo.
- **Necutools (`necutools.html`):** login. Pestañas: Mis tiendas (datos, icono, WhatsApp,
  subcategorías y orden), Productos y servicios (filtrados por tienda), Ofertas de la tienda (días
  de la semana), Promociones generales (solo dueño), Usuarios (solo dueño: crear, desactivar, asignar
  tiendas, reiniciar contraseña) y Mi cuenta (cambiar contraseña).

## Diseño (choque con `plans/CLAUDE.md` que hay que confirmar)

Las reglas dicen que "la única pieza llamativa es el tablero del hero" y que lo nuevo no compite con
él. El socio quiere que las promociones generales sean **más visibles**. Propuesta dentro de las
reglas: un letrero plano en `--tinta` con el título en `--senal`, justo debajo del hero, sin
animación ni degradado. Las ofertas de la tienda usan una etiqueta `--senal` con borde `--tinta`.
**El prompt 6 tiene que enseñar una captura y pedirle visto bueno al usuario antes de dejarlo.**
Todo componente nuevo usa los tokens y clases que ya están en `style.css`.

## Fases y prompts (van a `plans/prompts/2026-10-17-catalogo-multitienda.md`)

Todos los prompts empiezan con: *"Lee plans/CLAUDE.md, plans/MEMORIA.md y
plans/planes/2026-10-17-catalogo-multitienda.md."* Todos terminan con: *"Prueba en local con
PostgreSQL, actualiza plans/MEMORIA.md y el estado del plan, y dame los comandos de git."*

1. **Base de datos y permisos.** Agregar a `db/schema.sql` las tablas y columnas de la sección
   "Base de datos", con migración idempotente: `categoria` → `subcategorias`, slugs de las 7 tiendas
   y el admin actual como `dueno`. Crear `server/validar.js`, `requireDueno` y `puedeEditarStand`.
   Agregar la API de usuarios y de cambio de contraseña. Probar con curl que un encargado recibe 403
   en una tienda que no es suya.
2. **Tiendas dinámicas e importación.** Agregar `GET /api/stands/:slug` y `/t/:slug` con
   `public/tienda.html` + `js/tienda.js` (pestañas, filtro por subcategoría, paginación). Hacer
   `scripts/importar-ejemplos.js`: lee las páginas fijas, mueve las imágenes a
   `public/imagenes/ejemplos/` y carga productos y subcategorías sin duplicar si se corre otra vez.
   Agregar los redirects 301 de las rutas viejas. Al final, borrar las carpetas de tiendas y
   `js_carrito.js` **después de enseñar al usuario la lista de archivos y que la confirme**.
3. **Necutools nuevo.** Sacar el panel a `public/necutools.html` + `js/necutools.js`. Incluye:
   tiendas (crear/editar/ocultar, icono, WhatsApp, subcategorías), productos y servicios con
   `tipo` y `precio_modo`, usuarios y "Mi cuenta". Cada pestaña muestra solo lo que el rol permite.
4. **Carrito agrupado por tienda.** Hacer `public/js/comun.js` con un carrito que guarde ids y migre
   el viejo, agregar `POST /api/carrito/precios`, rehacer `carrito.html` agrupado y enviar por tienda
   con los números de esa tienda. En servicios, el botón "Pedir información por WhatsApp". Quitar el
   carrito de `index.html` y dejar el contador en la barra.
5. **Ofertas de la tienda.** Hacer el CRUD en Necutools (producto, subcategoría o tienda completa;
   porcentaje, precio especial o 2x1; días de la semana) y calcular las ofertas en el servidor.
   Mostrarlas en la pestaña Ofertas y como etiqueta en la tarjeta, aplicarlas en el carrito y
   ponerlas en el mensaje de WhatsApp. Probar con distintos días.
6. **Promociones generales (paquetes).** Hacer el CRUD (solo dueño) con productos incluidos,
   precio, fechas y destacada. Agregar "Promociones de temporada" en la portada y en
   `/promociones.html`. Al agregarla, el paquete va al carrito como su propio grupo y avisa a cada
   tienda incluida. **Enseñar una captura del letrero y pedir visto bueno** (ver "Diseño").
7. **Portada ordenada, buscador y cierre.** Hacer que el tablero salga de `/api/stands`, poner "Ofertas
   de hoy" y el buscador (`/api/buscar`, máximo 20 resultados). Agregar índices para buscar y
   actualizar `README.md`, `.env.example` y `render.yaml` si cambia alguna variable. Revisar las reglas
   de diseño: sin emojis ni `style=""`, que se vea bien a 360px y que la CSP no marque errores.

Cada fase se puede subir sola. Con un push a `main` Render vuelve a desplegar, y la migración corre
al arrancar. **Antes de la fase 1, respaldar la base de Render desde pgAdmin.**

## Verificación (al final de cada fase y completa en la 7)

- Local: `npm run dev` con PostgreSQL de prueba. Correr `db/schema.sql` dos veces seguidas sin errores.
- curl: endpoints públicos con 200; admin sin sesión con 401; encargado en una tienda ajena con 403;
  datos inválidos con 400; precio del carrito calculado en el servidor aunque el navegador mande otro.
- Navegador (capturas a 1280px y 360px): portada → tienda → filtrar subcategoría → agregar de dos
  tiendas → el carrito muestra 2 grupos → cada botón abre WhatsApp con los números correctos y el
  mensaje con la oferta del día; servicio → "Pedir información"; paquete → avisa a las dos tiendas.
- Necutools: el dueño crea una tienda nueva con subcategoría y servicio y aparece en la portada; un
  encargado solo ve sus tiendas; cambiar contraseña funciona.
- Las rutas viejas (`/ropa/playeras/`) redirigen bien. Cero violaciones de CSP en la consola.
