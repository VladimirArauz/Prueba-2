# Mejoras de 4 reels y de la revisión de la portada: prueba social, encabezado, botones de WhatsApp, debounce y texto mínimo

- **Fecha:** 2026-11-08
- **Estado:** aplicado
- **Prompts:** `plans/prompts/2026-11-08-reels-botones-debounce-texto-y-portada.md`
- **Alcance:** prueba social con datos reales en la portada, h1 con el beneficio, botones con la acción concreta, lugar y horario de los stands, botón de WhatsApp con 3 estados, debounce en el carrito y en el buscador, y texto de 14 px como mínimo. No cambia la base, el mensaje de WhatsApp ni el registro de pedidos.

## Contexto
El usuario mandó 5 reels y la reseña de un servicio que revisó necutla.com. Se leyeron con `/embed/captioned/`:
- **Desd_coMJ0U** (@jiron.design): un botón de pago necesita 3 estados (al presionar, procesando, terminado); si no responde, la gente da clic varias veces.
- **Dfa-fDlFbry**: ya no existe (Instagram da "publicación eliminada"). Se anota en el plan y no se usa.
- **DfawBGahiv3** (@cuaspro1): "Debounce" (sin texto; el video no se ve).
- **De2zgJsoTcH** (@jiron.design): no usar textos diminutos.
- **Dfax64IOmfU** (@gusxdev_): prueba de 5 segundos en celular: ¿cargó?, ¿se entiende qué vendes sin bajar?, ¿se nota que existes (fotos reales y dirección)?, ¿hay un solo botón de qué hacer?
- **Reseña**: no hay prueba social en la portada; botones genéricos ("Ver tiendas", "Ir al carrito", "Ver todas"); el h1 "La ciudad del estudiante" no dice el beneficio.

Decisiones del usuario (2026-11-08): cifras reales + opiniones (pedidos solo arriba de un mínimo); beneficio en el h1 y la marca en segundo plano (barra, pie y una línea bajo los botones); el lugar de los stands lo pasa al aplicar (`[COMPLETAR]`); texto mínimo 14 px (solo el número del contador del carrito en 12 px).

## Prompts

### 1. Prueba social con datos reales (API + portada)
- `app/api.php`: `GET /api/portada/resumen` → `{ tiendas, productos, servicios, opiniones, pedidos|null, recientes:[3] }`. Conteos solo de lo visible/activo; `pedidos` = pedidos pagados o confirmados, y `null` si son menos de `MINIMO_PEDIDOS_PUBLICOS = 20`. `recientes`: opiniones `visible`, calificación ≥ 4, con comentario, las 3 más nuevas; mismo nombre que ya muestra la página de producto (`CLIENTE_ANONIMO` si se eliminó la cuenta), producto, tienda, `/p/<id>`. SQL con PDO `?`; caché corta como el sitemap.
- `public/index.html` + `public/js/portada.js`: sección "Lo que dicen otros estudiantes" después del directorio: franja de cifras (`tabular-nums`, sin animación de conteo) y 3 tarjetas `.card` con `estrellas()` de `comun.js`, comentario escapado con `escapeHTML` y enlace al producto. Si no hay opiniones, la sección se oculta (`hidden`), no se inventa nada.
- `public/style.css`: solo clases nuevas con tokens existentes (grid 3→2→1). Reservar alto para no regresar el CLS (ver cambio 2026-11-07).
- Quitar de "Qué es Necutla" la frase de "opiniones de otros estudiantes" o ajustarla (pendiente (c) del 2026-11-04: opina cualquiera con cuenta).

### 2. Hero que se entiende en 5 segundos
- `public/index.html`: h1 = "Las tiendas de estudiantes en un solo lugar" + párrafo "Ropa, tecnología, dulces, papelería y más. Arma tu pedido y cada tienda te lo confirma por WhatsApp." La marca "Necutla, la ciudad del estudiante" ya está en la barra (logo) y en el pie; en el hero va como línea de texto normal **debajo** de los botones (`p.hero-marca`, `--texto-2`), nunca encima del h1, porque `plans/CLAUDE.md` prohíbe las etiquetas encima de los títulos.
- Botones: principal "Explorar las 7 tiendas" (número desde `obtenerTiendas()`; el HTML trae "Explorar las tiendas" y el JS cambia solo el número), secundario "Cómo pedir por WhatsApp" → `#como-funciona` (el carrito ya está en la barra). Un solo amarillo.
- Tarjetas de tienda: "Ver tienda" → "Entrar a {nombre}" (`portada.js` `tarjetaTienda`). "Ver todas" del menú → "Ver todas las tiendas" (`comun.js`/HTML de las 10 páginas, mismo patrón).
- Lugar: `[COMPLETAR]` junto al horario del tablero (`.board-foot`, icono `map-pin` de Lucide si falta en `iconos.js`) y en el pie; pedir el dato al usuario al empezar el prompt. Revisar también "Lun a sáb, 8:00 a 20:00" (pendiente del 2026-11-04).
- Actualizar `<title>`/`description`/OG si dicen otra cosa (`app/paginas.php`, subir `OG_VERSION` solo si cambia la imagen).
- Comprobar a 360 px: h1, párrafo y botón principal visibles sin bajar.

### 3. Botón de WhatsApp con 3 estados y debounce
- **3 estados** en "Enviar pedido por WhatsApp" (`public/js/carrito.js` `enviar`) y "Pedir servicio" (`public/js/producto.js`, `tienda.js`): al tocar, `botonOcupado(boton, "Abriendo WhatsApp")` (ya existe en `comun.js:490`); al abrir, el botón queda en estado terminado ("Pedido abierto en WhatsApp", icono `check`, clase nueva `.is-hecho` con estilo de `.secondary`) y el aviso de `abrirWhatsApp` sigue; un segundo toque no vuelve a abrir WhatsApp (hoy sí lo abre). "Volver a abrir WhatsApp" queda como enlace secundario. Sin cambiar el mensaje ni `registrarPedido`.
- **Debounce** (`comun.js`: helper `conEspera(fn, ms)` nuevo):
  - Carrito: los botones +/− cambian la cantidad en pantalla al momento y `cargar()` (que hace `POST /api/carrito/precios`) espera 350 ms sin clics; respuestas viejas se descartan (`AbortController` o contador). Menos peticiones contra el límite de 300/15 min.
  - Buscador de la portada mientras escribes: 400 ms, mínimo 2 letras, cancela la búsqueda anterior; Enter sigue funcionando. Mismo `buscar()` de `portada.js`.
- Respetar `prefers-reduced-motion` (sin animación nueva).

### 4. Texto mínimo de 14 px
- `public/style.css`: todo `font-size` menor a `0.875rem` (hay ~45: 0.6875, 0.75, 0.8125) sube a `0.875rem`, salvo el número del contador `.cart-pill` (sube a 0.75rem). Revisar que no rompan: etiquetas `.tag-oferta`, créditos de fotos, notas de formulario, tablas de Necutools, tablero, pie.
- Revisar a 1280 y 360 que no haya scroll horizontal ni textos cortados; Lighthouse accesibilidad sigue en 100.

### 5. Pruebas, subida a IONOS y memoria
- Local (http://localhost:8081, Chrome/CDP como en `pruebas-locales-necutla`): portada a 1280/360/movimiento reducido; resumen con 0 y con opiniones; doble clic en WhatsApp abre 1 sola vez; 5 clics rápidos en + hacen 1 petición; búsqueda al escribir; CLS ≤ 0.01; sin errores de consola. `ataques.js` con la ruta nueva (pruebas "PRT": sin datos privados en `/api/portada/resumen`, sin correos ni teléfonos).
- IONOS con permiso: respaldo en `~/respaldos/2026-11-08-portada/`, rsync de los archivos, comprobar en vivo (`/healthz`, ruta nueva, archivos idénticos). Sin cambios de base (no hay `schema.sql` nuevo).
- Commit en `main` (sin ramas); el push lo hace el usuario desde VS Code. Estado del plan → `aplicado`; `plans/MEMORIA.md` con cambios y pendientes (fotos reales de productos siguen pendientes de octubre; la reseña lo menciona).

## Verificación
Ver prompt 5. Criterio de los 5 segundos a 360 px en vivo: carga sin blanco (esqueletos), beneficio y "Explorar las 7 tiendas" visibles sin bajar, lugar y horario a la vista, cifras y opiniones reales más abajo.
