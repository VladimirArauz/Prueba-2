# Plan: emojis rotos en WhatsApp Web y mensaje de pedido más vistoso

- **Fecha:** 2026-11-01
- **Estado:** aplicado
- **Archivo del plan (al aplicarlo):** `plans/planes/2026-11-01-whatsapp-emojis-y-mensaje-vistoso.md`
- **Prompts:** `plans/prompts/2026-11-01-whatsapp-emojis-y-mensaje-vistoso.md`
- **Alcance:** solo el enlace a WhatsApp y el texto de los mensajes (`public/js/comun.js`, `public/js/carrito.js`, `public/js/producto.js`). No cambia la API, el carrito, Necutools, el registro del pedido ni el diseño de la página.

## Contexto

Al mandar un pedido por WhatsApp Web, los emojis del mensaje (👤 📅 🛒 💰 …) salen como un símbolo raro. Además el usuario siente el mensaje "muy vacío" y lo quiere más vistoso y con más información.

**Causa (comprobada con `curl` el 2026-11-01):** `enlaceWhatsApp()` (`public/js/comun.js:159`) arma `https://wa.me/<num>?text=…`. `wa.me` responde 302 a `api.whatsapp.com/send/` y **en esa redirección cambia cada emoji por `%EF%BF%BD` (U+FFFD, "�")**; los acentos y la ñ pasan bien:

```
wa.me/...?text=%F0%9F%91%A4%20Hola%20%C3%B1
→ location: api.whatsapp.com/send/?phone=...&text=%EF%BF%BD+Hola+%C3%B1
```

El archivo JS es UTF-8 y Apache lo sirve con `charset=utf-8`, así que el problema no está en el servidor de Necutla. Solución: armar el enlace directo a `https://api.whatsapp.com/send?phone=<num>&text=<texto>` (sin pasar por `wa.me`), que responde 200 y conserva el texto. Funciona en celular (abre la app) y en compu (WhatsApp Web).

## Decisiones del usuario

- Estilo **vistoso moderado**: un emoji por sección, separadores `━━━`, negritas en títulos. Los emojis en el mensaje están permitidos por `plans/CLAUDE.md` (única excepción).
- Contenido nuevo: precio unitario y subtotal por renglón, detalle de ofertas y ahorro, enlace a la tienda, fecha con día y hora.
- El mensaje de "pedir un servicio" (página de producto) también se rediseña con el mismo estilo.

## Cambios

### 1. Enlace sin `wa.me` (`public/js/comun.js`)
- `enlaceWhatsApp(numero, mensaje)` → `https://api.whatsapp.com/send?phone=${digitos}&text=${encodeURIComponent(mensaje)}`. Es la única función que arma enlaces; `abrirWhatsApp()` y los botones "Vendedor 2…" ya la usan.
- Buscar con `grep -rn "wa.me" public app` que no quede otro enlace a `wa.me` (si hay, cambiarlo igual).
- No hace falta tocar la CSP: es una navegación (`window.open` / `<a target=_blank>`), no una petición.

### 2. Piezas compartidas del mensaje (`public/js/comun.js`, sección "WhatsApp")
- `SEPARADOR_WA = "━".repeat(15)`.
- `fechaMensaje()`: `new Date().toLocaleString("es-MX", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" })` → "sábado, 1 de noviembre, 10:42".
- `enlaceSitio(ruta)`: `location.origin + ruta` (en producción siempre es `https://necutla.com` por la redirección del `.htaccess`).
- Reutilizar `money()` (`comun.js:37`) para todos los importes y `textoPrecio()` para el servicio.

### 3. Mensaje del carrito (`mensajeDe(grupo)` en `public/js/carrito.js:134`)
Datos que ya trae `/api/carrito/precios` (`app/api.php`, `calcular_carrito`): por renglón `nombre` (ya con el color), `cantidad`, `precio`, `subtotal_base`, `subtotal`, `oferta`; por grupo `nombre`, `slug`, `subtotal_base`, `descuento`, `total`; paquetes con `incluye` y `tiendas`.

Formato (tienda):
```
🛍️ *Nuevo pedido desde Necutla*
━━━━━━━━━━━━━━━
¡Hola, *Ropa*! Vi su catálogo en Necutla y quiero hacer este pedido.

🏪 *Tienda:* Ropa
👤 *Cliente:* Juan            ← solo si escribió su nombre
📅 *Fecha:* sábado, 1 de noviembre, 10:42

🛒 *Productos (3 piezas)*
1. *Playera básica (Negro)*
    2 × $150.00 = $300.00
    🏷️ Oferta: 2x1 → *$150.00*   ← solo si subtotal < subtotal_base
2. *Gorra*
    1 × $90.00 = *$90.00*
━━━━━━━━━━━━━━━
🧾 Subtotal: $390.00           ← solo si hay descuento
✨ Ahorras: $150.00            ← solo si hay descuento
💰 *Total a pagar: $240.00*

📝 *Indicaciones:* …           ← solo si escribió
━━━━━━━━━━━━━━━
🔗 Catálogo: https://necutla.com/t/ropa

Quedo pendiente de su confirmación y de cómo hacemos la entrega y el pago. ¡Gracias! 🙌
```
- Paquete: encabezado igual; `🎁 *Paquete:* <nombre>` con `cantidad × precio = subtotal`, lista "Incluye" (un renglón por artículo: `• 2 × Playera (Ropa)`), total, y enlace a `/promociones.html`.
- Las piezas se cuentan con `items.reduce(cantidad)`; "1 pieza" / "N piezas".
- El texto que escribe el cliente (nombre, indicaciones) va tal cual; quitar `*`, `_`, `~` sueltos no hace falta (WhatsApp solo los formatea en pares).
- Largo máximo: 15 productos (límite del servidor) dan ~2 000 caracteres, bien debajo del límite práctico de la URL.

### 4. Mensaje del servicio (`pedirServicio()` en `public/js/producto.js:85`)
```
🛠️ *Solicitud de servicio desde Necutla*
━━━━━━━━━━━━━━━
¡Hola, *Tecnología*! Vi en Necutla su servicio y quiero más información.

🔧 *Servicio:* Reparación de pantalla
💵 *Precio:* Desde $350.00 / A cotizar
📅 *Fecha:* sábado, 1 de noviembre, 10:42
━━━━━━━━━━━━━━━
🔗 Ver el servicio: https://necutla.com/p/<id>

¿Me pueden decir disponibilidad y cómo lo agendamos? ¡Gracias! 🙌
```
- Revisar qué campos trae `/api/productos/:id` (nombre, tienda, slug de la tienda, precio_modo) y usar `textoPrecio(p)`.

## Archivos

- `public/js/comun.js` — `enlaceWhatsApp`, `SEPARADOR_WA`, `fechaMensaje`, `enlaceSitio`.
- `public/js/carrito.js` — `mensajeDe`.
- `public/js/producto.js` — `pedirServicio`.
- `plans/planes/…`, `plans/prompts/…`, `plans/MEMORIA.md` (tabla de planes, cambios hechos, pendiente de probar en WhatsApp Web).

## Verificación

1. `curl -sI` al enlace nuevo con un emoji: 200 y sin redirección que cambie el texto; el de `wa.me` sigue dando `%EF%BF%BD` (para dejar evidencia).
2. Local (http://localhost:8081, XAMPP + PHP 8.5): Chrome sin ventana con el cliente CDP propio; reemplazar `window.open` para capturar la URL; agregar al carrito un producto normal, uno con color, uno con oferta y un paquete; decodificar `text` y comprobar: sin `�`, emojis presentes, totales iguales a los de la página, enlace a la tienda correcto. Lo mismo con un servicio en `/p/<id>`.
3. Que el botón "Vendedor 2" use el enlace nuevo y que el pedido se siga registrando (`POST /api/pedidos`).
4. Sin errores de consola ni de CSP a 1280 y 360 px.
5. Subir a IONOS por rsync los 3 JS; revisar en vivo que `https://necutla.com/js/comun.js` ya tenga `api.whatsapp.com`.
6. **El usuario** manda un pedido de prueba por WhatsApp Web y por celular y confirma que los emojis se ven (queda como pendiente en `MEMORIA.md` hasta que lo confirme).
7. Commit en `main` (con `runuser` como el usuario); el push lo hace el usuario desde VS Code.

