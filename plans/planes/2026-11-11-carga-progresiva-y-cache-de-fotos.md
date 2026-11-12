# Plan: carga progresiva al hacer scroll y fotos guardadas en el navegador

- **Fecha:** 2026-11-11
- **Estado:** en curso (prompts 1 a 4 y la parte local del 5 aplicados el 2026-11-11; falta subir a IONOS)
- **Prompts:** `plans/prompts/2026-11-11-carga-progresiva-y-cache-de-fotos.md`
- **Alcance:** páginas públicas (portada, tienda, producto, promociones) y rutas de fotos de la API. Necutools queda fuera, salvo que sus fotos también se benefician del caché.

## 1. Contexto: qué pidió el usuario y qué pasa hoy

El usuario quiere que la página no cargue todo de golpe: que lo que no se ve al principio se cargue mientras se baja, y que las fotos de los productos se queden guardadas en el navegador para no pedirlas a la base todo el tiempo, revisando solo de vez en cuando si cambiaron. También pidió revisar "lo de las cookies".

Lo que ya existe (revisado en el código):
- Las fotos de las tarjetas ya llevan `loading="lazy"` (`public/js/comun.js:658`, `portada.js:32,36`). El navegador ya las pide solo al acercarse.
- La tienda ya pinta de 12 en 12 (`POR_PAGINA`, `public/js/tienda.js:7`), pero los siguientes salen solo con el botón "Ver más" (`#store-more`, `#servicios-more`). Los datos de la tienda llegan completos en una sola petición (`/api/stands/:slug`); hoy son 15 productos en IONOS, así que el peso real está en las fotos, no en el JSON.
- La portada pide al cargar `/promociones`, `/portada/resumen` y `/vitrina` (`portada.js:247-250`), aunque esas secciones están muy abajo. La tienda pide `/vitrina` igual (`tienda.js:230`).
- **Las fotos viven en la base (BLOB)** y las sirve PHP (`servir_imagen`, `app/api.php:94`) con `Cache-Control: public, max-age=86400`: el navegador las guarda 1 día y luego las baja completas otra vez (no hay `ETag` ni `Last-Modified`, así que no hay 304).
- La versión de la dirección (`?v=`) sale de `actualizado_en` del producto, la tienda, el color o la promoción (`imagen_producto`, `imagen_tienda`, `app/api.php:14,29`): cambiar el precio o el stock cambia la dirección y obliga a bajar otra vez una foto que no cambió.
- **Cada foto cuesta unas 4 consultas a la base además del BLOB:** `limitar('api', 300…)` hace INSERT + SELECT en `limites`, `Sesion::cargar()` lee `sesiones`, y `Sesion::guardar()` hace `UPDATE sesiones SET expira` y manda `Set-Cookie` con cada foto (`app/arranque.php:150-155`, `app/sesiones.php:94`). Además cada foto gasta el límite de 300 peticiones por IP (pendiente abierto del carrusel por la IP compartida de la escuela).

### Sobre las cookies
- Las cookies no sirven para guardar fotos: caben 4 KB y el navegador las manda en cada petición. Lo correcto es la **caché HTTP del navegador**, que se controla con `Cache-Control` desde el servidor.
- La caché HTTP no es una cookie ni guarda datos personales: no cambia el aviso de cookies ni `privacidad.html`.
- Las cookies actuales son la de sesión (necesaria) y las de Google Analytics solo si se aceptan. El problema real es que la cookie de sesión hace que **cada foto** lea y renueve la sesión en la base. El prompt 2 lo quita.

## 2. Decisiones del usuario (2026-11-11)
- **Scroll:** los productos y servicios se cargan solos al acercarse al final, sin tope (scroll infinito). El pie se ve al terminar la lista.
- **Caché:** solo la caché del navegador, sin Service Worker.

## 3. La idea mejorada

En vez de "pedir cada cierto tiempo por si cambió", **la dirección de cada foto lleva su versión** (`?v=` que solo cambia cuando el vendedor sube otra foto). Así:
- Mientras la foto no cambie, el navegador la guarda 1 año y **no hace ninguna petición** (`max-age=31536000, immutable`).
- Si el vendedor la cambia, la página trae la dirección nueva y el navegador la baja al momento, sin esperar a que caduque nada.
- Si alguien pide una dirección vieja o sin versión, el servidor responde con caché corta y `Last-Modified`, y contesta 304 (sin mandar la foto) si no cambió.

Y para "cargar lo que se ve": las listas se llenan solas al acercarse al final, y las secciones de abajo de la portada y la tienda piden su API solo cuando el usuario se acerca a ellas.

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `db/mariadb/schema.sql` | Columna `imagen_cambio DATETIME(3) NULL` en `productos`, `producto_colores`, `promociones` y `portada_cambio` en `stands`; `UPDATE … SET imagen_cambio = actualizado_en WHERE imagen_cambio IS NULL AND imagen IS NOT NULL` (idempotente). Las fotos extra (`producto_fotos`, `producto_color_fotos`) no la necesitan si su id nunca se reutiliza (verificar en `app/admin.php`). |
| `app/admin.php` | Al guardar o quitar una imagen, `imagen_cambio = UTC_TIMESTAMP(3)`. |
| `app/api.php` | `imagen_producto`, `imagen_tienda`, color principal y promociones usan `imagen_cambio` para `?v=`. `servir_imagen`: si `v` coincide, `public, max-age=31536000, immutable`; si no, `public, max-age=300` + `Last-Modified` y 304 con `If-Modified-Since`, consultando primero sin el BLOB. |
| `app/arranque.php` | Camino rápido para `GET` de fotos públicas (`FOTOS` regex nueva, junto a `FOTOS_INDEXABLES`): sin `Sesion::cargar/guardar` (sin `UPDATE sesiones` ni `Set-Cookie`) y con límite propio `fotos` (p. ej. 2000 / 15 min) en lugar del de 300. Las ocultas siguen pidiendo sesión. |
| `public/js/comun.js` | Utilidad `alAcercarse(elemento, fn, margen)` con `IntersectionObserver` (si no existe, llama `fn` de inmediato). Fotos de tarjetas con `decoding="async"`; las primeras 3 sin `lazy`. |
| `public/js/tienda.js`, `public/tienda.html` | Centinela después de `#store-grid` y `#servicios-grid`: al acercarse (600 px antes) suma `POR_PAGINA` y pinta solo las tarjetas nuevas (`insertAdjacentHTML`, no reescribir todo el grid). Botones "Ver más" se quedan como respaldo sin `IntersectionObserver`. Región `aria-live` discreta: "Mostrando 24 de 40 productos". `cargarVitrina` con `alAcercarse`. |
| `public/js/portada.js` | `cargarPromociones`, `cargarPruebaSocial`, `cargarVitrina` con `alAcercarse` sobre un centinela visible; si la URL trae `#` hacia esa sección, se cargan de inmediato. Tablero y búsqueda sin cambio. |
| `public/js/producto.js`, `public/producto.html` | Foto principal con `fetchpriority="high"` (es el LCP). |
| `public/style.css` | Solo lo necesario para el centinela (sin alto visible). Sin animaciones nuevas. |
| `README.md` | Caché de fotos y carga progresiva. |

Reutilizar: `ANIMAR`/`observadorEntradas` de `comun.js:859-879` como modelo del observador; `pintarEsqueletos`, `tarjetaProducto`, `ACCIONES` (`ver-mas`, `ver-mas-servicios`), `servir_imagen`, `version_ms`, `limitar`.

## 5. Riesgos y cómo se cuidan
- **SEO:** Google renderiza con una ventana muy alta; el prompt 4 lee la guía oficial de Google sobre carga diferida antes de cambiar la portada y la comprueba con la Inspección de URLs.
- **CLS:** lo diferido se carga 600 a 800 px antes de entrar a la pantalla; se mide CLS a 1280 y 360. El prompt 3 investiga de paso el salto ya conocido de `/t/<slug>` (0.13 / 0.33).
- **Foto oculta en caché:** una foto ya vista de un producto que luego se oculta sigue en la caché de ese navegador (ya era pública). Aceptable.
- **Scroll infinito y el pie:** el pie (horario, lugar) solo se ve al final de la lista; decisión del usuario. El horario y lugar también están en el tablero de la portada.
- No cambia la lógica del carrito, pedidos, WhatsApp ni Necutools.

## 6. Otras recomendaciones (no entran en este plan)
1. **Fotos en WebP y en 2 tamaños** al subirlas (GD ya lo permite): es el mayor ahorro de bytes; una tarjeta no necesita la foto de 1280 px. Plan aparte.
2. **Paginar `/api/stands/:slug` en el servidor** cuando una tienda pase de unos 60 productos; hoy no hace falta.
3. **Revisar las subconsultas por producto** de `COLUMNAS_PRODUCTO` (calificación, reseñas, colores, fotos) con `EXPLAIN` e índices cuando crezca el catálogo.
4. **Pintar la tienda desde `sessionStorage` al volver atrás** y refrescar en segundo plano (sin guardar los números de WhatsApp).
5. **Necutools:** la misma carga progresiva en el catálogo y en pedidos, si crecen.

## 7. Prompts

En `plans/prompts/2026-11-11-carga-progresiva-y-cache-de-fotos.md` (5 prompts, en orden).

## 8. Verificación (resumen)
- `curl -I` a una foto: `immutable` con su versión, 304 con `If-Modified-Since`, sin `Set-Cookie`.
- Chrome: segunda visita a una tienda con 0 peticiones de fotos; cambiar el precio no cambia la dirección de la foto; subir otra foto sí.
- Tienda con 40 productos: se llenan solos al bajar, filtros correctos, CLS < 0.02, 360 px sin scroll horizontal.
- Portada: al abrir, sin peticiones a `/vitrina`, `/promociones` ni `/portada/resumen` hasta bajar.
- `ataques.js` sin fallas; Lighthouse igual o mejor que el 2026-11-08 (mediana 99 / 100 / 100 / 100).
