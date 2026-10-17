# Plan: rediseño visual profesional de Necutla

- **Fecha:** 2026-10-16
- **Estado:** aplicado (2026-10-16). Detalle de lo hecho y pendientes en `plans/MEMORIA.md`.
- **Prompts asociados:** `plans/prompts/2026-10-16-rediseno-visual-profesional.md`
- **Alcance:** solo lo visual (HTML, CSS y el HTML que genera el JS). La lógica del carrito, localStorage, Necutools y el envío a los 3 WhatsApp no se toca.

---

## 1. Diagnóstico: por qué hoy se ve "hecha con IA"

| Síntoma actual | Dónde está |
|---|---|
| Fondo azul marino casi negro con manchas de color difuminadas (radial-gradient) | `style.css` → `body` |
| Brillos de color en todo (`--shadow-glow-*`) y sombras grises iguales en cada tarjeta | botones, tarjetas, navbar, toast |
| Texto con degradado (`background-clip: text`) en el título y la marca | `.header-title`, `.brand-title` |
| Barras de degradado rojo→amarillo→azul de adorno | `.site-navbar::after`, `.site-footer::before`, `.card::before`, `.admin-card::before` |
| Pastilla "✨ Plataforma Oficial…" en mayúsculas sobre el título y 3 "stat chips" | hero |
| Emojis como iconos en botones, títulos, labels, footer y toast (🏬 🛒 ⚡ ✨ 📱 🗑️ 📦 💰…) | 46 archivos HTML/JS |
| Etiquetas en MAYÚSCULAS con espaciado (badge de marca, encabezados de tabla, carrito) | varios |
| Flechas "→" y "←" pegadas al texto de los botones | tarjetas y "Volver" |
| Todo sube y brilla al pasar el mouse (`translateY(-6px)`, zoom de imagen) | `.card:hover`, `.btn:hover`, `.nav-btn:hover` |
| Botones sin borde real, rellenos con degradado | `.btn` |
| Outfit + Plus Jakarta Sans: dos sans parecidas, ninguna con carácter | `@import` |
| 28 `style="…"` inline en `index.html` y más en `app.js` con colores fijos (`#ffffff`, `var(--red-main)`) | `index.html`, `app.js` |
| Subpáginas de tiendas (`*/index.html`, `*/carrito.html`) sin estilos para su `<header>` | 37 páginas internas |
| Frase "Diseño oficial con paleta Amarillo, Rojo y Azul" en el footer | `index.html` |

## 2. Concepto

**Necutla es "la ciudad del estudiante"**: un conjunto de stands (tiendas) que la comunidad recorre para armar un pedido que se confirma por WhatsApp. El lenguaje visual sale de ahí: **la señalética de una ciudad** — los letreros de calle, el directorio de un mercado, los paneles de una estación. Señales planas, colores de seguridad (azul, amarillo, rojo), bordes firmes, letra ancha y legible desde lejos. Nada brilla; todo se lee.

Lo memorable (el único lugar donde se gasta la audacia): **el tablero directorio del hero**, un panel azul tinta con las tiendas listadas como en el directorio de un mercado, cada fila con su icono y su nombre en letra ancha amarilla. Todo lo demás es callado y disciplinado.

## 3. Sistema de diseño (tokens)

### Color

| Token | Hex | Uso |
|---|---|---|
| `--tinta` | `#17295C` | Azul Necutla. Texto principal, bordes de botón, tablero del hero, navbar |
| `--tinta-2` | `#2B4590` | Hover sobre azul, enlaces |
| `--senal` | `#F5B800` | Amarillo señal. Relleno del botón principal, texto sobre el tablero azul, foco |
| `--aviso` | `#C8302B` | Rojo. Contador del carrito, acciones destructivas, errores |
| `--gis` | `#EDF0F4` | Fondo de página (gris azulado frío, no crema) |
| `--hoja` | `#FFFFFF` | Superficies: tarjetas, formularios, tablas |
| `--linea` | `#C5CEDC` | Bordes de tarjetas, divisores, inputs |
| `--texto-2` | `#4A5672` | Texto secundario (contraste AA sobre `--hoja` y `--gis`) |
| `--wa` | `#178A4A` | Solo el botón de WhatsApp (verde oscurecido para contraste AA con texto blanco) |

Reglas de color: no hay degradados, ni brillos, ni texto con degradado. El amarillo nunca va como texto sobre fondo claro (no tiene contraste); sobre claro, el amarillo solo es relleno con borde `--tinta`. El rojo se reserva para el carrito y lo destructivo.

### Tipografía

Una sola familia con eje de ancho: **Archivo** (Google Fonts, variable `wdth 62–125`, `wght 100–900`). Es una grotesca de origen de señalética/periódico; la versión ancha da el tono de letrero.

```
@import url('https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&display=swap');
```

| Rol | Ajuste | Tamaño |
|---|---|---|
| Marca "Necutla" y h1 | `wdth 125`, `wght 800`, `letter-spacing -0.01em` | `clamp(2.5rem, 6vw, 4.25rem)` |
| h2 de sección | `wdth 112`, `wght 700` | `1.75rem` |
| h3 / título de tarjeta | `wdth 100`, `wght 700` | `1.25rem` |
| Botones y navegación | `wdth 100`, `wght 600` | `0.9375rem` |
| Cuerpo | `wdth 100`, `wght 400`, `line-height 1.6` | `1rem` (16px) |
| Pequeño / meta | `wdth 100`, `wght 500` | `0.8125rem` |
| Precios y totales | `font-variant-numeric: tabular-nums`, `wght 700` | según contexto |

Escala modular 1.25. Todo en sentence case: nada de `text-transform: uppercase`. Largo de línea máximo `68ch` en párrafos.

### Forma

- Radios por jerarquía (no uno para todo): botones e inputs `6px`; tarjetas `10px`; tablero del hero y paneles grandes `4px` (letrero).
- Bordes: tarjetas `1px solid var(--linea)`; **botones `2px solid`** siempre.
- Sombras: ninguna en reposo. Única sombra permitida: la del toast y la del navbar al hacer scroll, `0 1px 0 var(--linea)`.

### Botones

| Variante | Fondo | Borde 2px | Texto | Hover |
|---|---|---|---|---|
| `.btn` (principal) | `--senal` | `--tinta` | `--tinta` | fondo `#FFC933` |
| `.btn.secondary` | `--hoja` | `--tinta` | `--tinta` | fondo `--gis` |
| `.btn.danger` | `--hoja` | `--aviso` | `--aviso` | fondo `--aviso`, texto blanco |
| `.btn.wa` | `--wa` | `#0F6636` | blanco | fondo `#0F6636` |
| `.btn.ghost` (nuevo, navegación) | transparente | transparente | `--tinta` | borde `--linea` |

Alto mínimo 44px (`.btn-sm`: 36px). Icono a la izquierda, 18px, `gap: 8px`. Sin `translateY`, sin sombras. `:focus-visible` = `outline: 3px solid var(--senal); outline-offset: 2px` (sobre azul: `outline-color: #fff`). `:active` = fondo un tono más oscuro.

### Iconos

- Set: **Lucide** (trazo 2px, esquinas redondeadas, licencia ISC), copiado como **sprite SVG inline** en un archivo nuevo `iconos.js` en la raíz, que inserta el `<svg>` con los `<symbol>` al cargar. Funciona sin internet y abriendo los HTML con doble clic (`file://`), donde un sprite externo con `<use href="archivo.svg#id">` no carga.
- Uso: `<svg class="icon" aria-hidden="true"><use href="#i-cart"></use></svg>`.
- Tamaño `1.125em`, `stroke: currentColor` → el icono toma el color del texto.
- Iconos mínimos: `store`, `shopping-cart`, `wrench` (Necutools), `arrow-left`, `plus`, `minus`, `trash-2`, `message-circle` (WhatsApp), `info`, `check`, `log-out`, `pencil`, `package`, `clock`, `x`. Por tienda: `shirt` (Ropa), `cpu` (Tecnología), `candy` (Dulces), `megaphone` (Propaganda), `pencil-ruler` (Papelería), `gift` (Regalos), `shapes` (Otra).
- Un icono solo cuando ayuda a reconocer una acción o una tienda. Títulos de sección y labels de formulario van **sin** icono.
- Excepción: los emojis dentro del **texto del mensaje de WhatsApp** (`app.js` líneas ~263–274) se pueden quedar, porque WhatsApp no muestra SVG. Si se quiere sobriedad total, se cambian por texto en negritas de WhatsApp.

### Movimiento

- Solo como respuesta a una acción: el toast entra al agregar al carrito (200 ms) y el contador del carrito hace un pulso de escala 1→1.15→1 una vez.
- Se quitan: `fadeInSection` en cada cambio de sección, el lift de tarjetas, el zoom de imágenes, el `translateX` de los links del footer.
- `@media (prefers-reduced-motion: reduce)` desactiva todo.

## 4. Layout

### Navbar (fondo `--hoja`, borde inferior 1px `--linea`)

```
┌──────────────────────────────────────────────────────────────────┐
│ [N] Necutla                       [▢ Tienda] [🛒 Carrito (3)] [🔧 Necutools] │
│     Ciudad del Estudiante                                           │
└──────────────────────────────────────────────────────────────────┘
```
Emblema "N": cuadro `--tinta` 40px, letra `--senal`, radio 4px (como placa). Botones de navegación en variante `ghost`; el activo lleva borde 2px `--tinta` y fondo `--gis`. Contador del carrito: pastilla roja `--aviso` con número blanco.

### Hero: el tablero directorio (alineado a la izquierda)

```
┌───────────────────────────────┬──────────────────────────────────┐
│ Necutla,                      │ ▓▓▓▓▓▓▓ TABLERO (fondo --tinta) ▓▓▓│
│ la ciudad del estudiante      │  [shirt]   Ropa             ›      │
│                               │  [cpu]     Tecnología       ›      │
│ Ropa, tecnología, dulces,     │  [candy]   Dulces           ›      │
│ papelería y más de los stands │  [mega]    Propaganda       ›      │
│ de la comunidad. Arma tu      │  [ruler]   Papelería        ›      │
│ pedido y lo confirmamos por   │  [gift]    Regalos          ›      │
│ WhatsApp.                     │  [shapes]  Otra             ›      │
│                               │  ───────────────────────────────  │
│ [Ver tiendas] [Ir al carrito] │  Lun a sáb, 8:00 a 20:00           │
└───────────────────────────────┴──────────────────────────────────┘
```
- Columna izquierda: h1 en Archivo ancho, `--tinta`; párrafo `--texto-2`, máx. 44ch; dos botones (principal + secundario).
- Columna derecha: tablero `--tinta`, radio 4px, filas separadas por `1px solid rgba(255,255,255,.14)`; nombre de tienda en Archivo `wdth 112` `--senal`; cada fila es un `<a>` a su tienda. Hover de fila: fondo `--tinta-2`.
- Se eliminan la pastilla "✨ Plataforma Oficial…" y los 3 stat chips.
- En móvil (<760px) el tablero pasa debajo del texto, ancho completo.

### Directorio de tiendas (grid)

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  imagen 16:10│ │              │ │              │
├──────────────┤ │              │ │              │
│ [icon] Ropa  │ │              │ │              │
│ Playeras…    │ │              │ │              │
│ [Ver tienda] [+ Carrito]      │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
```
- Tarjeta `--hoja`, borde 1px `--linea`, radio 10px, sin sombra. Hover: solo el borde cambia a `--tinta`.
- La "card-tag" flotante sobre la imagen ("Moda & Estilo") se elimina; esa idea se integra en la descripción.
- Grid 3 → 2 (≤992px) → 1 (≤640px).

### Encabezado de sección

h2 a la izquierda, descripción debajo en `--texto-2`, acción ("Volver") a la derecha como `.btn.secondary.btn-sm` con icono `arrow-left`. Divisor inferior 1px `--linea`. Sin icono en el h2.

### Carrito

Dos columnas (lista 1.7fr / resumen 1fr). Resumen en `--hoja` con borde 2px `--tinta` (es la pieza de acción). Total grande en Archivo ancho `tabular-nums`. Botón WhatsApp ancho completo; "Vaciar carrito" como `.btn.danger`. Estado vacío: icono `shopping-cart` 48px en `--linea`, texto "Tu carrito está vacío" y botón "Ver tiendas".

### Necutools (admin)

Mismo sistema, sin "badge" amarillo en mayúsculas. Tabla con encabezados en sentence case, `--texto-2`, `wght 600`, fondo `--gis`. Acciones de fila: botones con solo icono (`pencil`, `trash-2`) + `aria-label`.

### Footer

Fondo `--tinta`, texto blanco/`#C9D3EA`, links con subrayado al hover (sin desplazamiento). Se quita la frase "Diseño oficial con paleta…". Horario en texto plano con icono `clock`.

### Subpáginas de tiendas (`*/index.html`, `*/*/index.html`, `*/carrito.html`)

Comparten `style.css` pero su `<header>` no tiene estilos. Se les agrega una barra superior igual a la navbar (marca + "Volver" + carrito) y un encabezado de página con h1 + descripción, más las mismas tarjetas y botones.

## 5. Revisión del plan contra el brief y contra lo genérico

| Primera idea | Por qué se descartó | Cambio |
|---|---|---|
| Mantener el fondo azul oscuro y solo quitar brillos | El "navy oscuro + acento brillante" es justo uno de los looks genéricos; seguiría viéndose igual | Fondo claro frío `--gis`; el azul se concentra en el tablero, navbar activa y footer |
| Fondo crema tipo papel | Crema + serif es otro cliché de páginas generadas | Gris azulado frío, más de señalética que de revista |
| Numerar las tiendas 01–07 en el tablero | Las tiendas no son una secuencia; el número sería decoración | Cada fila lleva el icono de su tienda |
| Dos fuentes (display + cuerpo) | Mezclar sans parecidas es lo que ya falla hoy | Una familia (Archivo) usando su eje de ancho para la jerarquía |
| Eyebrow en mayúsculas sobre cada título | Es la marca más común de plantilla | Sentence case en todo, sin etiquetas sobre los títulos |
| Hero con número grande + stats | Es el hero por defecto | El hero es el directorio real de tiendas, útil y navegable |

## 6. Fases

1. **Base:** tokens, fuente, reset, botones con borde, foco, `iconos.js`.
2. **Página principal (`index.html`):** navbar, hero-tablero, grid de tiendas, secciones, footer; quitar emojis e inline styles.
3. **HTML generado por `app.js`:** carrito, tabla admin, productos públicos, toast; quitar emojis de la UI y estilos inline.
4. **Subpáginas de tiendas** (37 archivos): estructura de header común, iconos, botones.
5. **QA:** responsive 360 / 768 / 1280 px, teclado, contraste, reduced motion, que el carrito y WhatsApp sigan funcionando.

## 7. Criterios de aceptación

- `grep -rP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]"` sobre `*.html` y `*.js` solo encuentra los emojis del texto del mensaje de WhatsApp (o nada).
- No queda ningún `linear-gradient`, `radial-gradient`, `background-clip: text` ni `--shadow-glow` en `style.css`.
- No queda `text-transform: uppercase`.
- Todos los `.btn` tienen borde de 2px visible.
- Contraste AA en texto (≥ 4.5:1) y foco visible en todo elemento interactivo.
- `index.html` sin `style="…"` salvo casos justificados.
- Agregar al carrito, cambiar cantidades, vaciar, enviar a WhatsApp, login de Necutools, crear producto y crear stand siguen funcionando igual.
