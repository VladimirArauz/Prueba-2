# Plan: apartado de Servicios en cada tienda

- **Fecha:** 2026-10-20
- **Estado:** aplicado
- **Prompts:** `plans/prompts/2026-10-20-servicios-por-tienda.md`
- **Alcance:** página de tienda (`public/tienda.html`, `public/js/tienda.js`), enlaces a servicios en
  `public/js/comun.js` y `public/js/producto.js`, servicios de ejemplo (`db/servicios-ejemplo.json`,
  `server/ejemplos.js`), texto de ayuda en Necutools, `README.md` y `plans/MEMORIA.md`. No cambia la
  base, la API, el carrito ni el mensaje de WhatsApp.

## Qué pidió el usuario y qué ya existía
El usuario quiere que cada tienda tenga, además de sus productos, un **apartado de Servicios**:
armado de dulceros para fiestas infantiles (Dulces), estampado de logos para equipos de futbol o
empresas (Ropa), reparación de aparatos (Tecnología), etc.

Lo que ya existe (plan `2026-10-17-catalogo-multitienda.md`):
- `productos.tipo` = `producto|servicio`, `precio_modo` = `fijo|desde|cotizar` (`db/schema.sql:104-117`).
- Necutools ya deja crear servicios (`public/necutools.html:288-324`, `server/admin.js:212-224`).
- `GET /api/stands/:slug` ya devuelve `servicios` aparte (`server/api.js:110`).
- Tarjeta de servicio con "Pedir información por WhatsApp" (`public/js/comun.js:215-221`, `pedirServicio` en `public/js/tienda.js:156`).

El problema: la pestaña "Servicios" **se esconde si la tienda no tiene servicios**
(`pestanasDisponibles`, `public/js/tienda.js:30-34`) y no hay ningún servicio cargado, así que nadie ve el apartado.

Decisiones del usuario (2026-10-20):
1. **Sección propia** "Servicios" fija debajo de los productos en cada tienda, siempre visible (con aviso si está vacía). La pestaña se queda, pero lleva a esa sección.
2. **Servicios de ejemplo en todas las tiendas** (1–2 por tienda), cargados solos al arrancar, también en Render. Esto cambia lo dicho en el pendiente 13 de `MEMORIA.md` ("no datos falsos en Render") solo para estos servicios, por pedido explícito.

## Cambios

### 1. Docs del proyecto (regla 1–5 de `plans/CLAUDE.md`)
- `plans/planes/2026-10-20-servicios-por-tienda.md` (este plan, estado `propuesto` → `aplicado`).
- `plans/prompts/2026-10-20-servicios-por-tienda.md` (los 3 prompts de abajo).

### 2. Servicios de ejemplo
- Nuevo `db/servicios-ejemplo.json`: por tienda (`slug`) una lista `{nombre, descripcion, precio_modo, precio, orden}`. Propuesta:
  - **dulces**: "Armado de dulceros para fiestas infantiles" (desde $25 por dulcero); "Mesa de dulces para eventos" (a cotizar).
  - **ropa**: "Estampado de logos para equipos de futbol" (desde $120 por playera); "Bordado de logo para empresas" (a cotizar).
  - **tecnologia**: "Reparación de celulares y laptops" (a cotizar, diagnóstico); "Cambio de mica y pila" (desde $80).
  - **propaganda**: "Diseño de logo o volante" (desde $150).
  - **papeleria**: "Impresión y engargolado de trabajos" (desde $15).
  - **regalos**: "Armado de arreglos y cajas de regalo" (desde $90).
  - **otra**: "Encargos a la medida" (a cotizar).
- `server/ejemplos.js`: función `importarServicios()` con su propia migración `servicios-ejemplo-2026-10-20` en la tabla `migraciones`, mismo patrón que `importarEjemplos` (transacción, `NOT EXISTS` por `stand_id + nombre`, tienda inexistente se salta). Inserta `tipo='servicio'`, `precio` `NULL` si es `cotizar`, sin imagen (la tarjeta usa la imagen por defecto). Llamarla donde se llama `importarEjemplos` en `server/index.js` y en `scripts/importar-ejemplos.js`.
  - Así un vendedor que borre un ejemplo no lo ve regresar (corre una sola vez).

### 3. Sección "Servicios" en la página de tienda
- `public/tienda.html`: entre `#store-more` y `#vitrina`, nueva
  `<section class="servicios-tienda" id="servicios" aria-labelledby="servicios-title">` con encabezado de sección (h2 "Servicios", descripción "Se piden por WhatsApp: el vendedor te confirma precio y fecha."), `#servicios-grid` (`.grid`), `#servicios-empty` y `#servicios-more` ("Mostrar más", `data-action="ver-mas-servicios"`). Mismo marcado que `#vitrina`/`section-header-row` (sin estilos nuevos salvo un margen, si hace falta, en `style.css` con tokens).
- `public/js/tienda.js`:
  - `PESTANAS` queda `{ productos, servicios, ofertas }`; la pestaña Servicios **siempre** aparece (con su total, aunque sea 0) y al tocarla hace `scrollIntoView` a `#servicios` y enfoca el h2 (sin cambiar `estado.tab`). La lista principal ya no muestra servicios: solo productos u ofertas.
  - Nuevo `renderServicios()` (usa `tarjetaProducto`, `estado.visiblesServicios`, `POR_PAGINA`); vacío: "Esta tienda todavía no tiene servicios." con texto "Pregúntale al vendedor por WhatsApp si hace trabajos a la medida."
  - Compatibilidad: `?tab=servicios` (enlaces viejos) abre productos y baja a `#servicios`. `#servicios` en la URL hace lo mismo.
- `public/js/comun.js:218` y `public/js/producto.js:29`: enlaces a `/t/<slug>#servicios` en lugar de `?tab=servicios`.
- `public/js/portada.js:14`: sin cambios (ya cuenta servicios).

### 4. Necutools (pequeño)
- `public/necutools.html:292`: el texto de ayuda menciona los ejemplos nuevos ("dulceros, estampado de logos, reparaciones"). Sin cambios de lógica.

### 5. Memoria y README
- `plans/MEMORIA.md`: fila del plan, entrada en "Cambios hechos" y nota en el pendiente 13 (servicios de ejemplo sí van a Render, autorizado por el usuario).
- `README.md`: una línea sobre los servicios de ejemplo y `npm run importar`.

Reglas a respetar: solo tokens y clases existentes, sin `style=`/`onclick`, iconos de `iconos.js`, `escapeHTML` en todo dato, SQL con parámetros, sin dependencias nuevas, trabajar en `main` (pendiente 21).

## Verificación
1. Node 22 + PostgreSQL de prueba (`embedded-postgres` en el puerto 54329, como en sesiones anteriores; nunca Render). `npm run dev` dos veces seguidas: schema e importación sin error ni duplicados.
2. API: `GET /api/stands/dulces` trae los 2 servicios con `tipo: "servicio"`; borrar uno en Necutools y reiniciar → no regresa.
3. Navegador (1280 y 360px): `/t/dulces` muestra productos y debajo la sección Servicios con tarjetas y "Pedir información por WhatsApp" (abre `wa.me` con el mensaje del servicio); pestaña Servicios baja a la sección; tienda nueva sin servicios muestra el aviso; `/t/ropa?tab=servicios` y `/t/ropa#servicios` bajan a la sección; buscador de portada → "Ver en Ropa" llega a la sección.
4. Cero errores de consola/CSP, sin scroll horizontal a 360px, `scripts/seguridad/ataques.js` sin fallas.

## Prompts

En `plans/prompts/2026-10-20-servicios-por-tienda.md`.
