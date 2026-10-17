# Reglas del proyecto Necutla (Prueba-2)

> **Este archivo no se modifica.** Ninguna sesión puede editarlo, reescribirlo, moverlo ni borrarlo
> a menos que el usuario lo pida de forma explícita en esa misma sesión. Si una regla de aquí
> choca con lo que pide el usuario, avísale del choque y pregúntale antes de actuar.

## 1. Qué es el proyecto

**Necutla — La Ciudad del Estudiante** es un directorio comercial estudiantil donde la comunidad
recorre 7 tiendas o "stands" (Ropa, Tecnología, Dulces, Propaganda, Papelería, Regalos y Otra),
agrega productos a un carrito y envía el pedido por WhatsApp para confirmarlo.

Se publica en **Render**: un servidor **Node.js + Express** sirve el sitio y una API, con datos en
**PostgreSQL** (administrable con pgAdmin). Frontend en HTML, CSS y JavaScript sin frameworks.

- `public/`: lo único que se publica. `index.html` + `app.js` + `style.css` + `iconos.js` (página
  principal con secciones Tienda, Carrito y Necutools) y una carpeta por tienda (`ropa/`,
  `tecnologia/`…) con subcategorías, `carrito.html` y `js/carrito.js`.
- `server/`: `index.js` (seguridad y arranque), `db.js` (conexión y migración), `auth.js` (sesiones y
  login), `api.js` (`/api/config`, `/api/stands`, `/api/productos`).
- `db/schema.sql`: estructura de la base; se aplica sola en cada arranque.
- **Necutools**: panel de administración con login real (bcrypt + sesión en PostgreSQL). Productos y
  stands se guardan en la base y los ven todos los visitantes. El carrito vive en el navegador.
- Configuración por variables de entorno (`.env` local, Environment en Render; plantilla en
  `.env.example`). Despliegue definido en `render.yaml`. Guía completa en `README.md`.

La prioridad del proyecto es que un estudiante encuentre la tienda, arme su pedido y lo mande por
WhatsApp sin fricción. Todo lo visual está al servicio de eso.

## 2. Reglas de trabajo con planes y prompts

1. **Todo plan se guarda en `plans/planes/`.** Cada vez que en cualquier sesión se genere un plan
   (de diseño, de funcionalidad, de corrección, de lo que sea), se guarda ahí como archivo Markdown,
   aunque el usuario no lo pida.
2. Nombre del plan: `AAAA-MM-DD-tema-en-kebab-case.md` (ej. `2026-10-16-rediseno-visual-profesional.md`).
3. Cada plan empieza con: fecha, estado (`propuesto`, `en curso`, `aplicado`, `descartado`), ruta del
   archivo de prompts asociado y alcance.
4. **Los prompts de cada plan se guardan en `plans/prompts/`**, con el **mismo nombre de archivo que
   su plan**, para que se relacionen uno a uno.
5. Los prompts van en orden de ejecución y cada uno empieza pidiendo leer `plans/CLAUDE.md` y su plan.
6. Al aplicar un plan, solo se actualiza su campo **estado**; no se reescribe su contenido. Si el plan
   cambia de fondo, se crea un plan nuevo con fecha nueva que diga a cuál reemplaza.
7. Antes de empezar cualquier tarea en este proyecto, lee este archivo, `plans/MEMORIA.md` y revisa en
   `plans/planes/` si ya hay un plan relacionado.
8. **`plans/MEMORIA.md` se actualiza al final de cada sesión que cambie algo:** estado de los planes,
   cambios hechos (con fecha y archivos) y pendientes. Un pendiente resuelto pasa a "Cambios hechos".

## 3. Reglas de diseño (obligatorias para todo lo nuevo)

Toda sección, botón, tarjeta, formulario o página nueva debe usar este sistema. No se inventan
colores, fuentes, sombras ni estilos de botón nuevos: se usan los tokens y clases que ya existen
en `style.css`. Si algo de verdad no cabe, se propone al usuario antes de crearlo.

### Concepto

Señalética de ciudad: letreros planos, colores de seguridad, bordes firmes, letra ancha y legible.
Nada brilla; todo se lee. La única pieza llamativa del sitio es el tablero directorio del hero.
Lo nuevo debe ser sobrio y no competir con él.

### Colores (únicos permitidos)

| Token | Hex | Uso |
|---|---|---|
| `--tinta` | `#17295C` | Texto principal, bordes de botón, tablero, footer |
| `--tinta-2` | `#2B4590` | Hover sobre azul, enlaces |
| `--senal` | `#F5B800` | Relleno del botón principal, texto sobre `--tinta`, foco |
| `--aviso` | `#C8302B` | Contador del carrito, acciones destructivas, errores |
| `--gis` | `#EDF0F4` | Fondo de página |
| `--hoja` | `#FFFFFF` | Tarjetas, formularios, tablas |
| `--linea` | `#C5CEDC` | Bordes y divisores |
| `--texto-2` | `#4A5672` | Texto secundario |
| `--wa` | `#157F44` | Solo el botón de WhatsApp |

- Siempre por variable (`var(--tinta)`), nunca hex sueltos en HTML, CSS o JS.
- El amarillo nunca va como texto sobre fondo claro; solo como relleno con borde `--tinta`, o como
  texto sobre `--tinta`.
- El rojo solo para carrito, borrar/vaciar y errores.
- Prohibido: degradados (`linear-gradient`, `radial-gradient`), texto con degradado
  (`background-clip: text`), brillos de color, `backdrop-filter`, colores nuevos.

### Tipografía

- Una sola familia: **Archivo** (Google Fonts, eje `wdth`). No se agregan otras fuentes.
- Jerarquía con el ancho: títulos grandes `wdth 125` / 800; h2 `wdth 112` / 700; resto `wdth 100`.
- Cuerpo 16px, `line-height 1.6`, párrafos de máximo `68ch`.
- Precios y totales con `font-variant-numeric: tabular-nums`.
- **Sentence case siempre.** Prohibido `text-transform: uppercase` y etiquetas en mayúsculas.
- Sin etiquetas pequeñas ("eyebrows") encima de los títulos. Sin resaltar una sola palabra del
  título con otro color o cursiva.

### Botones

- Siempre con clase `.btn` y una variante: `.btn` (principal, amarillo), `.secondary`, `.danger`,
  `.wa`, `.ghost`; tamaño `.btn-sm` si hace falta.
- **Borde de 2px sólido visible siempre.** Sin degradados, sin sombras, sin levantarse en hover.
- Radio 6px. Alto mínimo 44px (36px el chico).
- Un solo botón principal (amarillo) por grupo de acciones.
- Texto = la acción exacta ("Guardar producto", "Enviar pedido por WhatsApp"), sin flechas "→"
  ni "←" en el texto; la dirección se indica con icono.
- Foco visible con `:focus-visible` (outline 3px `--senal`, offset 2px).

### Iconos, no emojis

- **Prohibido usar emojis en la interfaz** (botones, títulos, labels, tarjetas, toasts, footer).
  La única excepción es el texto del mensaje que se envía a WhatsApp.
- Iconos: Lucide, desde el sprite de `iconos.js`, con
  `<svg class="icon" aria-hidden="true"><use href="#i-nombre"></use></svg>`.
- Si falta un icono, se agrega su `<symbol>` de Lucide a `iconos.js`; no se mezclan otros sets.
- Iconos solo donde ayudan a reconocer una acción o una tienda. Títulos de sección y labels sin icono.
- Botón de solo icono = siempre con `aria-label`.

### Forma y layout

- Radios por jerarquía: botones/inputs 6px, tarjetas 10px, paneles grandes/tablero 4px.
- Tarjetas: fondo `--hoja`, borde 1px `--linea`, sin sombra; hover solo cambia el borde a `--tinta`.
- Sin sombras, excepto el toast.
- Contenido alineado a la izquierda. Contenedor `min(1200px, 92%)`.
- Grids: 3 columnas → 2 (≤992px) → 1 (≤640px).
- Encabezado de sección: h2 a la izquierda, descripción debajo, acción a la derecha, divisor 1px `--linea`.
- Sin numeraciones decorativas (01, 02, 03) si el contenido no es una secuencia real.
- Sin `style="…"` inline: todo estilo va en `style.css` como clase.

### Movimiento

- Solo como respuesta a una acción del usuario (toast al agregar, pulso del contador del carrito).
- Prohibido: animaciones de entrada por sección, tarjetas que suben, zoom de imágenes en hover.
- Respetar `prefers-reduced-motion`.

### Textos

- Español, tono directo y cercano, en voz activa.
- Nombrar las cosas como las entiende el estudiante ("Carrito", "Enviar pedido por WhatsApp").
- La misma acción se llama igual en todo el flujo (botón "Agregar al carrito" → aviso
  "Agregado al carrito").
- Errores: qué pasó y cómo arreglarlo, sin disculpas. Estados vacíos: invitar a la acción.

### Accesibilidad mínima

- Contraste AA (4.5:1 en texto).
- Foco visible en todo lo interactivo.
- `alt` en imágenes, `label` en cada campo de formulario.
- Debe verse bien a 360px de ancho sin scroll horizontal.

## 4. Reglas técnicas

- No cambiar la lógica del carrito, la API, Necutools ni el envío a WhatsApp cuando la tarea es solo
  de diseño.
- Conservar los `id`, `data-action`, `data-section` y clases que usa el JavaScript.
- Las 7 tiendas comparten `public/style.css`: un cambio de estilo se hace ahí, no por tienda.
- No agregar frameworks, build tools ni dependencias nuevas sin que el usuario lo pida.
- Todo archivo que deba verse en el navegador va dentro de `public/`. Nada sensible ahí.

### Seguridad (obligatoria)

- **Prohibido** `onclick="…"` y cualquier JavaScript o `<script>` en línea, y `style="…"` en el HTML:
  la CSP del servidor los bloquea. Los eventos se manejan con `data-action` / `data-section` y un
  listener delegado; los estilos, con clases en `style.css`.
- Recursos externos solo si se agregan a la CSP de `server/index.js` (hoy solo Google Fonts).
- Todo texto que venga de datos se escapa (`escapeHTML`) antes de insertarlo con `innerHTML`.
- SQL siempre con parámetros (`$1`, `$2`…), nunca concatenando texto.
- Toda ruta de la API que modifique datos usa `requireAdmin` y valida cada campo en el servidor.
- Secretos y configuración solo en variables de entorno. **`.env` nunca se sube a git**; si se agrega
  una variable nueva, documentarla en `.env.example`, `README.md` y `render.yaml`.
- Cambios a la base: agregar sentencias idempotentes a `db/schema.sql` (`IF NOT EXISTS`,
  `ON CONFLICT`), nunca borrar datos en una migración sin permiso del usuario.
