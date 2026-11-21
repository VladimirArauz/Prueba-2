# Prompts: carrusel de fotos en servicios y mensaje de WhatsApp de servicio

Plan: `plans/planes/2026-11-21-servicios-carrusel-y-mensaje-whatsapp.md`. Se corren en orden.

### Prompt 1: fotos y carrusel en servicios
Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y `plans/planes/2026-11-21-servicios-carrusel-y-mensaje-whatsapp.md`. Aplica la parte A del plan: quita la restricción de tipo en `POST /api/admin/productos/:id/fotos` (`app/admin.php`), separa en `public/js/necutools.js` el producto en edición (producto o servicio) de `productoConColores()`, muestra el carrusel en servicios con el botón de subsección "Fotos" y textos neutros, y actualiza `README.md`. Sin tocar la base. Prueba en local lo de la sección "Verificación" que toca a las fotos y borra los datos de prueba. Cambia el estado del plan a "en curso".

### Prompt 2: mensaje de WhatsApp de servicio
Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan. Aplica la parte B: crea `mensajeServicio()` en `public/js/comun.js` con el formato del plan y úsala en `pedirServicio()` de `public/js/tienda.js` y `public/js/producto.js`. No cambies `enviarPorWhatsApp()`, `medirServicio()` ni los números. Prueba en local capturando la URL de WhatsApp sin abrirla, con los 3 modos de precio, con y sin descripción y con y sin sesión, desde la tienda y desde la página del servicio; muéstrame un ejemplo del texto final.

### Prompt 3: pruebas completas en local
Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan. Agrega a `scripts/seguridad/ataques.js` las pruebas de fotos en servicios (subir a un servicio propio 200, a uno de otra tienda con encargado ajeno 403, más del máximo 400) y córrelo completo. Repite la verificación del plan a 1280, 360 y movimiento reducido (CLS, consola, CSP, scroll horizontal). Borra lo que creen las pruebas. Haz el commit en `main` (sin push) y actualiza `plans/MEMORIA.md`.

### Prompt 4: subir a IONOS
Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y el plan. Pídeme permiso antes de subir. Compara el md5 de los archivos del servidor (`~/necutla/`) con el commit anterior, respalda en `~/necutla/respaldos/2026-11-21-servicios/antes.tar` (permisos 600), sube por rsync y comprueba que quedaron idénticos. En vivo, sin crear datos: `/healthz`, `/t/<slug>#servicios` y `/p/<id de un servicio>` 200, sin números de WhatsApp sin sesión, sin errores, CLS < 0.02; carrusel simulado en el navegador con fotos reales. Credenciales solo a variables, sin imprimirlas. Cambia el estado del plan a "aplicado" y actualiza `plans/MEMORIA.md` (falta que el usuario agregue fotos a un servicio y pruebe el mensaje en WhatsApp).
