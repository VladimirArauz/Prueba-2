# Prompts: mejoras de 4 reels y de la revisión de la portada

Plan: `plans/planes/2026-11-08-reels-botones-debounce-texto-y-portada.md`. Van en orden; cada uno se corre en Claude Code.

## Prompt 1: prueba social con datos reales

```text
Lee plans/CLAUDE.md, plans/MEMORIA.md y plans/planes/2026-11-08-reels-botones-debounce-texto-y-portada.md (sección "1. Prueba social").

Agrega a la portada una sección "Lo que dicen otros estudiantes" con datos reales, sin inventar nada:
1. app/api.php: GET /api/portada/resumen con tiendas, productos y servicios activos, opiniones visibles, pedidos (pagados o confirmados; null si son menos de MINIMO_PEDIDOS_PUBLICOS = 20) y recientes: las 3 opiniones visibles más nuevas con calificación de 4 o más y comentario. Usa el mismo nombre que ya muestra la página del producto (CLIENTE_ANONIMO si la cuenta se eliminó), más producto, tienda y enlace /p/<id>. Nada de correos, teléfonos ni usuarios. SQL con parámetros de PDO y caché corta, como el sitemap.
2. public/index.html y public/js/portada.js: la sección va después del directorio. Pon una franja de cifras con tabular-nums y sin animación de conteo, y 3 tarjetas .card con estrellas() de comun.js. Escapa todo con escapeHTML. Si no hay opiniones, deja la sección oculta (hidden).
3. public/style.css: usa solo clases nuevas con los tokens que ya existen y un grid de 3 → 2 → 1 columnas. Reserva el alto para que el CLS de la portada siga cerca de 0 (ver el cambio del 2026-11-07).
4. En "Qué es Necutla", ajusta la frase "las opiniones de otros estudiantes": opina cualquiera con cuenta, sin compra verificada.

Prueba en local a 1280 y 360 px, con opiniones y sin ellas. No subas a IONOS todavía. Actualiza el estado del plan a "en curso" y plans/MEMORIA.md.
```

## Prompt 2: hero que se entiende en 5 segundos

```text
Lee plans/CLAUDE.md, plans/MEMORIA.md y plans/planes/2026-11-08-reels-botones-debounce-texto-y-portada.md (sección "2. Hero").

Antes de cambiar nada, pregúntame dónde están los stands (escuela, edificio, explanada) y si el horario "Lun a sáb, 8:00 a 20:00" lo cumplen todas las tiendas. Si no te lo doy, deja [COMPLETAR].

1. public/index.html: h1 "Las tiendas de estudiantes en un solo lugar" y debajo el párrafo del beneficio (pedido por WhatsApp). La marca "Necutla, la ciudad del estudiante" va como línea normal debajo de los botones (p.hero-marca), nunca encima del h1.
2. Botones del hero: el principal dice "Explorar las 7 tiendas" (el número sale de obtenerTiendas(); el HTML trae "Explorar las tiendas"). El secundario dice "Cómo pedir por WhatsApp" y lleva a #como-funciona. Solo un botón amarillo.
3. En portada.js, cambia "Ver tienda" de las tarjetas por "Entrar a {nombre}". En el menú de las 10 páginas, cambia "Ver todas" por "Ver todas las tiendas".
4. Pon el lugar junto al horario del tablero y en el pie. Si falta el icono map-pin de Lucide, agrégalo a iconos.js.
5. Revisa que <title>, description y Open Graph (app/paginas.php) digan lo mismo.

Comprueba a 360 px que el h1, el párrafo y el botón principal se vean sin bajar, sin scroll horizontal y con el CLS cerca de 0. Actualiza plans/MEMORIA.md.
```

## Prompt 3: botón de WhatsApp con 3 estados y debounce

```text
Lee plans/CLAUDE.md, plans/MEMORIA.md y plans/planes/2026-11-08-reels-botones-debounce-texto-y-portada.md (sección "3").

1. Da 3 estados a "Enviar pedido por WhatsApp" (public/js/carrito.js, enviar) y a pedir un servicio (producto.js y tienda.js):
   - Al tocarlo: botonOcupado(boton, "Abriendo WhatsApp").
   - Al abrir WhatsApp: estado terminado, "Pedido abierto en WhatsApp" con el icono check y la clase .is-hecho, que se ve como .secondary.
   - Un segundo toque no vuelve a abrir WhatsApp. Pon un enlace secundario "Volver a abrir WhatsApp".
   No cambies el mensaje, abrirWhatsApp ni registrarPedido, salvo lo mínimo para los estados.
2. Agrega conEspera(fn, ms) a comun.js.
   - En el carrito, + y − cambian la cantidad en pantalla al momento. cargar() (POST /api/carrito/precios) espera 350 ms sin clics y descarta las respuestas viejas.
   - El buscador de la portada busca mientras escribes: espera 400 ms, pide al menos 2 letras y cancela la búsqueda anterior. Enter sigue funcionando.
3. No agregues ninguna animación nueva.

Prueba en local: doble clic en WhatsApp abre 1 sola pestaña, 5 clics rápidos en + hacen 1 petición y el total es correcto. Actualiza plans/MEMORIA.md.
```

## Prompt 4: texto mínimo de 14 px

```text
Lee plans/CLAUDE.md, plans/MEMORIA.md y plans/planes/2026-11-08-reels-botones-debounce-texto-y-portada.md (sección "4").

En public/style.css, sube a 0.875rem todo font-size menor (0.6875, 0.75 y 0.8125rem). La única excepción es el número del contador .cart-pill, que sube a 0.75rem. Revisa en el navegador, a 1280 y 360 px, las páginas públicas y Necutools: etiquetas de oferta, créditos de fotos, notas de formulario, tablas, tablero y pie. Que no haya textos cortados ni scroll horizontal. Lista lo que tuviste que ajustar. Actualiza plans/MEMORIA.md.
```

## Prompt 5: pruebas, subida a IONOS y memoria

```text
Lee plans/CLAUDE.md, plans/MEMORIA.md y plans/planes/2026-11-08-reels-botones-debounce-texto-y-portada.md (sección "5" y "Verificación").

1. Local: Chrome a 1280, 360 y con movimiento reducido en portada, tienda, producto, carrito y Necutools. Revisa el CLS de la portada (≤ 0.01) y que no haya errores de consola. Agrega a scripts/seguridad/ataques.js pruebas "PRT" de /api/portada/resumen (sin correos, teléfonos ni usuarios) y córrelo solo contra localhost. Vacía la tabla limites antes de las pruebas de navegador y borra los datos de prueba al terminar.
2. Pídeme permiso antes de subir. Respaldo en ~/respaldos/2026-11-08-portada/ y rsync de los archivos cambiados, sin imprimir credenciales. No hay cambios de base.
3. En vivo: /healthz 200, /api/portada/resumen sin datos privados, archivos idénticos y la prueba de los 5 segundos a 360 px. Espacia las peticiones por el límite de 300 cada 15 min.
4. Haz el commit en main, sin ramas; yo hago el push desde VS Code. Cambia el estado del plan a "aplicado" y actualiza plans/MEMORIA.md con los cambios y los pendientes.
```
