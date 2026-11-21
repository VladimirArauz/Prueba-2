# Carrusel de fotos en servicios y mensaje de WhatsApp de servicio

- **Fecha:** 2026-11-21
- **Estado:** en curso
- **Prompts:** `plans/prompts/2026-11-21-servicios-carrusel-y-mensaje-whatsapp.md`
- **Alcance:** (1) que los servicios puedan tener hasta 5 fotos más que la principal, con el mismo carrusel que los productos; (2) un mensaje de WhatsApp para pedir información de un servicio igual de cuidado que el del carrito, y el mismo desde la tienda y desde la página del servicio.

### Contexto (lo que ya hay)

- Los servicios son filas de `productos` con `tipo = 'servicio'`. La tabla `producto_fotos` cuelga de `producto_id`, así que **no hace falta tocar la base**.
- El lado público ya es genérico: `fotos_producto()` (`app/api.php:21`) arma `fotos` para cualquier tipo; `GET /api/productos/:id/fotos/:foto` no revisa el tipo; la página `/p/<id>` (`public/js/producto.js` `iniciarGaleria`), el hover de tarjetas (`public/js/comun.js` `crearCarrusel`, `data-fotos`) y `app/paginas.php` (`varias_fotos`, JSON-LD `Service` con `image`) ya funcionan con varias fotos.
- Lo que lo impide:
  - `app/admin.php:623`: `POST /api/admin/productos/:id/fotos` rechaza con "Las fotos adicionales son solo para productos."
  - `public/js/necutools.js:960` `productoConColores()` devuelve `null` si no es producto, y de ahí cuelgan `renderFotos()` (tarjeta `#fotos-card`), las rutas de fotos y el botón de subsección `#sub-btn-colores` ("Colores y fotos").
- Mensaje de servicio:
  - `public/js/tienda.js:222` `pedirServicio()`: una sola línea ("¡Hola! Vi en Necutla el servicio *X* de Tienda ($…). Quisiera más información, por favor."). Es el que probó el usuario: se ve básico.
  - `public/js/producto.js:131` `pedirServicio()`: ya usa emojis y `SEPARADOR_WA`, pero no lleva cliente, ni descripción, ni explica "Desde"/"Cotiza".
  - Modelo a seguir: `mensajeDe()` de `public/js/carrito.js:174` (encabezado con emoji, separadores, cliente, fecha, enlace y cierre).

### Cambios

**A. Fotos y carrusel en servicios**
1. `app/admin.php`: quitar la restricción por tipo en `POST /api/admin/productos/:id/fotos` (dejar el máximo `MAX_FOTOS_EXTRA` y los mensajes con "producto o servicio"). Las rutas de orden y borrar ya no miran el tipo; revisarlo. Sigue con `requiere_admin()` y el permiso de tienda.
2. `public/js/necutools.js`:
   - Separar en dos funciones: `productoEnEdicion()` (producto **o** servicio, para el carrusel) y `productoConColores()` (solo producto, para colores).
   - `renderFotos()`, subir, ordenar y borrar fotos usan `productoEnEdicion()`. En un servicio solo existe el destino "Producto base" (sin botones de colores; se oculta `#carrusel-destinos` o se nombra "Servicio").
   - El botón de subsección: en productos "Colores y fotos"; en servicios "Fotos" (mismo `id="sub-btn-colores"` y `data-sub="colores"`, para no romper `mostrarSubseccion`). La tarjeta `#colores-card` sigue oculta en servicios.
   - Textos: "Carrusel de {nombre}", "La foto principal se cambia en Editar servicio.", aviso de la barra de guardar sin la palabra "colores" en servicios.
   - Al cambiar un producto a servicio: `app/admin.php:599` ya borra colores; las fotos extra se conservan (son del producto, sirven igual).
3. `public/necutools.html`: si algún texto fijo de `#fotos-card` dice "producto", hacerlo neutro.
4. `README.md`: una línea de que los servicios también tienen carrusel.
5. `scripts/seguridad/ataques.js`: la prueba que espere 400 al subir foto a un servicio (si existe) pasa a esperar 200; agregar una "FOT/SRV" que suba a un servicio de otra tienda con encargado ajeno → 403.

**B. Mensaje de WhatsApp de servicio**
1. `public/js/comun.js`: nueva `mensajeServicio(servicio, tienda)` junto a `SEPARADOR_WA` / `fechaMensaje()` / `enlaceSitio()`, usada por **las dos** `pedirServicio()` (tienda y página del servicio) para que digan lo mismo. Formato propuesto:

```
🛠️ *Solicitud de servicio desde Necutla*
━━━━━━━━━━━━━━━
¡Hola, *{Tienda}*! Vi su servicio en Necutla y me interesa.

🔧 *Servicio:* {Nombre}
💵 *Precio:* {$150.00 MXN | Desde $150.00 MXN | A cotizar}
   {solo con "desde": El precio final depende de lo que necesite.}
   {solo con "cotizar": Me gustaría saber cuánto costaría.}
📝 *Detalles:* {descripción recortada a ~160 caracteres en palabra completa; se omite si está vacía o es de ejemplo}
👤 *Cliente:* {nombre de la sesión, si hay}
📅 *Fecha:* {fechaMensaje()}
━━━━━━━━━━━━━━━
❓ *Me gustaría saber:*
• ¿Tienen disponibilidad?
• ¿Cuánto tarda y qué necesitan de mi parte?
• ¿Cómo lo agendamos y cómo se paga?
━━━━━━━━━━━━━━━
🔗 Ver el servicio: {enlaceSitio(`/p/{id}`)}

¡Gracias! Quedo al pendiente 🙌
```

   - El nombre del cliente sale de `compra.nombre` (ya lo trae `/api/clientes/sesion`, `app/clientes.php:76`); con cuentas en pausa no se pone.
   - La descripción se limpia de saltos de línea y espacios dobles; `*` y `_` del texto del vendedor se quitan para no romper el formato de WhatsApp.
   - Emojis solo dentro del mensaje (excepción permitida por `plans/CLAUDE.md`). Se usan los mismos que ya funcionan en el carrito (plan `2026-11-01-whatsapp-emojis-y-mensaje-vistoso.md`), sin emojis nuevos de riesgo.
2. `public/js/tienda.js` y `public/js/producto.js`: `pedirServicio()` llama a `mensajeServicio()`. No cambia `enviarPorWhatsApp()`, `medirServicio()`, `puedePedir()` ni los números.

### Fuera de alcance
- No se toca la base ni `schema.sql`. No se agregan colores a servicios. No se cambia el carrito ni el mensaje de pedidos de productos.

### Verificación
- `php8.5 -l` de `app/admin.php`.
- Local (http://localhost:8081, Playwright del venv de `~/estudio/tests` con Chrome, 1280, 360 y movimiento reducido), con dueño temporal:
  - Necutools → editar un servicio → botón "Fotos" → subir 2 PNG reales (25 y 200 KB), ordenar, borrar; sin la tarjeta de colores.
  - `/p/<id del servicio>`: carrusel con flechas y puntos; tarjeta del servicio en `/t/<slug>#servicios` cambia de foto al pasar el mouse; CLS < 0.02, sin errores de consola ni de CSP, sin scroll horizontal a 360.
  - Mensaje: capturar la URL de `wa.me`/`api.whatsapp.com` (sin abrirla) desde la tienda y desde `/p/<id>` con los 3 modos de precio, con y sin descripción, con y sin sesión; los dos textos deben ser iguales.
  - `ataques.js` completo (Node del driver de Playwright).
- Borrar de la base local lo que creen las pruebas.
- El usuario manda una solicitud real por WhatsApp Web y celular y confirma que se ve bien.
- Subida a IONOS solo con permiso del usuario (prompt 4).
