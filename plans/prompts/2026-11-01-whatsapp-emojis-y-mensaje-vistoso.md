# Prompts: emojis rotos en WhatsApp Web y mensaje de pedido más vistoso

Plan: `plans/planes/2026-11-01-whatsapp-emojis-y-mensaje-vistoso.md`. Correr en orden.


### Prompt 0 — guardar el plan
Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y este plan. Guarda el plan en `plans/planes/2026-11-01-whatsapp-emojis-y-mensaje-vistoso.md` (sin la sección de prompts) y los prompts en `plans/prompts/2026-11-01-whatsapp-emojis-y-mensaje-vistoso.md`. Agrega la fila a la tabla de planes de `plans/MEMORIA.md` con estado "en curso".

### Prompt 1 — arreglar los emojis
Lee `plans/CLAUDE.md` y `plans/planes/2026-11-01-whatsapp-emojis-y-mensaje-vistoso.md`. Cambia `enlaceWhatsApp()` en `public/js/comun.js` para que use `https://api.whatsapp.com/send?phone=…&text=…` en lugar de `wa.me`, y busca que no quede otro `wa.me` en `public/` ni `app/`. Comprueba con `curl -sI` la diferencia (wa.me cambia el emoji por `%EF%BF%BD`, el nuevo no) y con Chrome sin ventana que el enlace capturado del carrito conserva los emojis actuales.

### Prompt 2 — mensaje del carrito más vistoso
Lee `plans/CLAUDE.md` y el plan. Agrega a `public/js/comun.js` `SEPARADOR_WA`, `fechaMensaje()` y `enlaceSitio()`, y reescribe `mensajeDe(grupo)` en `public/js/carrito.js` con el formato de la sección 3 del plan (tienda y paquete), usando solo los datos que ya devuelve `/api/carrito/precios`. No cambies la API ni la lógica del carrito. Prueba en local con un producto normal, uno con color, uno con oferta y un paquete, decodificando el `text` capturado.

### Prompt 3 — mensaje del servicio
Lee `plans/CLAUDE.md` y el plan. Reescribe `pedirServicio()` en `public/js/producto.js` con el formato de la sección 4, revisando antes qué campos trae `/api/productos/:id`. Prueba en local con un servicio de precio fijo, uno "desde" y uno "a cotizar".

### Prompt 4 — verificación, subida y memoria
Lee `plans/CLAUDE.md` y el plan. Corre la verificación completa del plan (puntos 1 a 5), sube los 3 JS a IONOS por rsync (credenciales solo a variables, nunca impresas) y revisa en vivo. Haz el commit en `main`. Actualiza `plans/MEMORIA.md` (estado del plan, cambios hechos con fecha y archivos, y el pendiente de que el usuario confirme los emojis en WhatsApp Web y en celular) y el estado del plan a "aplicado".
