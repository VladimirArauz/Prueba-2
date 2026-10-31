# Plan: recomendaciones de IONOS (SEO, icono touch, contenido), aviso de privacidad y rendimiento

- **Fecha:** 2026-10-31
- **Estado:** aplicado (2026-10-31, prompts 1 a 7, subido a IONOS)
- **Prompts:** `plans/prompts/2026-10-31-seo-iconos-contenido-y-legal.md`
- **Alcance:** `public/` (páginas HTML, `style.css`, `.htaccess`, `robots.txt`, iconos y manifest, páginas nuevas
  `privacidad.html`, `terminos.html` y `404.html`), `app/paginas.php` (títulos, descripciones, canonical y datos
  estructurados por página) y una ruta nueva `app/sitemap.php`, `README.md`. Sin cambios en el carrito, la API de
  pedidos, Necutools ni el envío a WhatsApp. No se toca el DNS ni el dominio.

## Contexto

El revisor de páginas web de IONOS marcó 6 puntos para necutla.com: activar una CDN, crear `sitemap.xml`, título
corto (34 caracteres), descripción corta (130), poco contenido en la portada (364 palabras, pide 500) y falta de
icono touch. El usuario quiere que la página quede "casi perfecta" y cumpla los requisitos de una página web.

Revisión en vivo (2026-10-31):
- `<title>` de la portada: "Necutla — La Ciudad del Estudiante" (34). Tienda y producto salen con el título fijo
  "Tienda | Necutla" y "Producto | Necutla" aunque `app/paginas.php` ya sabe cuál es (solo cambia las etiquetas `og`).
- No hay `sitemap.xml`, `robots.txt`, `apple-touch-icon`, manifest, `theme-color` ni `canonical`.
- La portada trae ~190 palabras en el HTML inicial; el resto (tiendas, ofertas) llega por JS.
- HTML sale con gzip (pasa por PHP), pero **CSS y JS salen sin comprimir**; fuentes e imágenes con caché de 1 hora.
- La página de error es `404.txt` (texto plano).
- `www.necutla.com` redirige bien a `https://necutla.com`.
- La página pide nombre, usuario, correo y teléfono: en México la LFPDPPP exige un **aviso de privacidad** a la
  vista antes de recabar datos.

Decisiones del usuario (2026-10-31):
- **CDN: no se activa por ahora.** La CDN de IONOS (Cloudflare por dentro) solo funciona en subdominios
  (`www.necutla.com`), y el sitio usa `necutla.com` como dirección única (cookie `__Host-`, vista previa, Turnstile).
  Además, todos los visitantes llegarían con IPs de Cloudflare y habría que cambiar `ip_cliente()`. Los visitantes
  son estudiantes de la misma zona: se gana más con compresión y caché (prompt 6). El aviso de IONOS seguirá
  saliendo; queda explicado aquí y en `README.md`.
- **Contenido nuevo en la portada:** "Qué es Necutla", "Cómo funciona" y "Preguntas frecuentes".
- **Aviso de privacidad y términos de uso:** sí, como borrador que el usuario completa con sus datos.

## Línea base (prompt 1, 2026-10-31)

Lighthouse 12.8.2 (Chrome sin ventana, perfil móvil):

| Página | Rendimiento | Accesibilidad | Buenas prácticas | SEO |
|---|---|---|---|---|
| Local `/` | 90 | 100 | 100 | 100 |
| Local `/t/dulces` | 72 | 98 | 100 | 100 |
| Local `/p/16` | 96 | 100 | 100 | 100 |
| necutla.com `/` | 87 | 100 | 100 | 100 |
| necutla.com `/t/ropa` | 74 | 98 | 100 | 100 |
| necutla.com `/p/1` | 93 | 100 | 100 | 100 |

- Portada en vivo: FCP y LCP 2.6 s, CLS 0.158. Tienda: CLS **0.638** (el pie `footer.site-footer` baja cuando
  llegan las tarjetas) y `heading-order` (tarjetas con `h3` sin `h2` antes).
- Sin compresión en CSS y JS (~90 KiB que se ahorrarían), caché corta en fuentes e imágenes.
- Palabras de la portada: ~190 en el HTML inicial (IONOS contó 364 con lo que pinta el JS).
- IONOS acepta `mod_deflate` (gzip) y `mod_expires` en `.htaccess`; no tiene brotli.
- Se suman al prompt 6: reservar alto del contenido mientras carga para que el pie no salte (CLS) y corregir el
  orden de títulos de la tienda.

## Resultado (prompt 7, 2026-10-31)

Lighthouse en vivo después de los cambios:

| Página | Rendimiento | Accesibilidad | Buenas prácticas | SEO |
|---|---|---|---|---|
| necutla.com `/` | 87 → **92** | 100 | 100 | 100 |
| necutla.com `/t/ropa` | 74 → **98** | 98 → **100** | 100 | 100 |
| necutla.com `/p/1` | 93 → **98** | 100 | 100 | 100 |
| necutla.com `/privacidad.html` | **94** | 100 | 100 | 100 |

- Portada: título de 56 caracteres, descripción de 157 y **756 palabras** en el HTML inicial (antes ~190).
- `sitemap.xml` válido (49 direcciones en vivo), `robots.txt`, iconos y manifest con su tipo, CSS y JS con gzip.
- Desviaciones: los `[COMPLETAR]` del aviso y los términos los llena el usuario; el texto de la portada y los
  textos legales no se le mostraron antes de publicarlos (pidió no parar): quedan para su revisión. La única imagen
  fija (`producto.html`) ya está en un contenedor con proporción fija, así que no se le pusieron `width`/`height`.
  El salto de la portada venía del tablero (filas de esqueleto de 54 px contra 57 px reales) y el de la tienda del
  pie: se igualó la fila y se reservó el alto de `.main-content`.

## Qué se va a hacer (por prompt)

### Prompt 1: línea base (sin cambiar código)
- Lighthouse (SEO, accesibilidad, buenas prácticas, rendimiento) a portada, tienda y producto en local y en vivo,
  con Node 22 y `lighthouse` en la carpeta temporal (nunca como dependencia del proyecto). Guardar los puntajes.
- Contar palabras de la portada como lo hace un buscador (HTML inicial) y ya pintada.
- Revisar si IONOS acepta `mod_deflate` y `mod_expires` en `.htaccess` (probar con una cabecera y `curl`).

### Prompt 2: títulos, descripciones y etiquetas por página
- Portada: título de 50 a 60 caracteres (propuesta: "Necutla: tiendas de estudiantes con pedidos por WhatsApp",
  56) y descripción de 150 a 160 (propuesta: "Directorio de tiendas de estudiantes: ropa, tecnología, dulces,
  papelería, regalos y más. Arma tu carrito y manda tu pedido por WhatsApp directo al vendedor.", ~155).
  `og:title` y `og:description` generales iguales (`OG_GENERAL` en `app/paginas.php`).
- `app/paginas.php`: además del bloque `og`, cambiar `<title>` y `<meta name="description">` en tienda
  ("Ropa en Necutla: playeras, sudaderas… | pedidos por WhatsApp") y producto ("Nombre — $precio | Tienda en
  Necutla"), recortados a 60 y 160, todo con `htmlspecialchars`.
- `<link rel="canonical">` en cada página pública (con `url_publica`; `/t/<slug>` y `/p/<id>` sin parámetros).
- `<meta name="robots" content="noindex">` en `carrito.html`, `cuenta.html` y `necutools.html` (ya tiene
  `X-Robots-Tag`); tienda inexistente o producto oculto: `noindex`.
- Datos estructurados JSON-LD (`<script type="application/ld+json">`, no se ejecuta; revisar que la CSP no lo
  marque): `WebSite` + `Organization` en la portada, `Product` con `Offer` (precio en MXN, disponibilidad según
  stock) en producto, `BreadcrumbList` en tienda y producto. Los arma PHP con `json_encode` (escapa `<`, `>` y `&`
  con `JSON_HEX_TAG | JSON_HEX_AMP`).
- `<meta name="theme-color">` con el valor de `--tinta`.

### Prompt 3: `sitemap.xml` y `robots.txt`
- `app/sitemap.php` (nuevo, cargado en `app/arranque.php`): `GET /sitemap.xml` arma el XML con la portada,
  promociones, privacidad, términos, cada tienda visible (`/t/<slug>`, `lastmod` = `actualizado_en`) y cada
  producto o servicio visible de una tienda visible (`/p/<id>`). Sin carrito, cuenta, Necutools ni API.
  Caché de 1 hora; con `url_publica` vacía, 404.
- `public/.htaccess`: `^sitemap\.xml$` → `api/index.php`.
- `public/robots.txt`: permitir todo salvo `/api/`, `/necutools.html`, `/carrito.html`, `/cuenta.html`;
  `Sitemap: https://necutla.com/sitemap.xml`.

### Prompt 4: icono touch, iconos de app y manifest
- Desde `public/imagenes/favicon.svg` (Chrome sin ventana, como se hizo `og-necutla.png`): `apple-touch-icon.png`
  (180×180, fondo sólido `--tinta`, sin transparencia), `icono-192.png`, `icono-512.png` y `icono-maskable-512.png`
  (con margen de seguridad), `favicon-32.png` y `favicon.ico` en la raíz (algunos navegadores y buscadores lo piden
  ahí sin preguntar).
- `public/site.webmanifest`: nombre, nombre corto, `start_url: "/"`, `display: "browser"`, `lang: "es-MX"`,
  `theme_color` y `background_color` (`--tinta` y `--gis`).
- `<link rel="apple-touch-icon">`, `<link rel="icon" sizes="32x32">` y `<link rel="manifest">` en las páginas.
- **Excepción técnica a confirmar:** el manifest y `theme-color` necesitan el color en hex (no leen variables CSS);
  se usan exactamente los valores de `--tinta` y `--gis`, como en los correos.

### Prompt 5: contenido de la portada
- Tres secciones nuevas en `index.html`, después de "Tiendas" y antes del pie, con el encabezado de sección de
  siempre (h2, descripción, divisor) y solo clases y tokens existentes:
  - **Qué es Necutla** (1 o 2 párrafos, máx. 68ch): directorio de la comunidad estudiantil, tiendas de alumnos,
    el pedido se cierra con el vendedor.
  - **Cómo funciona**: 3 pasos reales (elige una tienda → arma tu carrito → manda tu pedido por WhatsApp y acuerda
    entrega y pago). Es una secuencia real, así que sí lleva números; iconos de Lucide del sprite.
  - **Preguntas frecuentes**: 6 a 8 preguntas en `<details>`/`<summary>` (¿necesito cuenta?, ¿cómo pago?, ¿cómo me
    entregan?, ¿qué pasa después de mandar el pedido?, ¿por qué un pedido por tienda?, ¿qué guardan de mí?, ¿cómo
    abro mi tienda?). Estilo nuevo `.faq` en `style.css` solo con tokens (borde `--linea`, foco visible, sin
    animación salvo respetar `prefers-reduced-motion`).
- Texto en el HTML (no por JS) para que lo lean los buscadores: meta de 550+ palabras en el HTML inicial.
- Revisar a 1280 y 360 px, que el tablero del hero siga siendo lo único llamativo y que no haya scroll horizontal.

### Prompt 6: aviso de privacidad, términos, página 404 y rendimiento
- `public/privacidad.html` (aviso integral LFPDPPP): responsable, datos que se recaban (nombre, usuario, correo,
  teléfono, opiniones, pedidos sin datos del cliente), finalidades, que no se venden, transferencias (Cloudflare para
  el captcha y las visitas, IONOS como hosting y correo), derechos ARCO y cómo ejercerlos, cookies (solo la de
  sesión), cambios al aviso. Campos que el usuario completa marcados `[COMPLETAR]`.
- `public/terminos.html`: qué es Necutla, que la venta se cierra entre estudiante y vendedor, responsabilidades,
  reglas de opiniones, cuentas, cambios.
- Enlaces en el pie de todas las páginas y una línea en el registro ("Al crear tu cuenta aceptas los Términos de uso
  y el Aviso de privacidad") y junto al carrito (el pedido se guarda sin datos personales, ya existe la línea).
- Las dos páginas pasan por `app/paginas.php` (título, descripción, canonical) y entran al sitemap.
- `public/404.html` con el diseño del sitio (título, texto que invita a volver a la portada o buscar), en vez de
  `404.txt`; `ErrorDocument 404 /404.html` (403 igual). La API sigue respondiendo JSON.
- `.htaccess`: `mod_deflate` para HTML, CSS, JS, SVG, JSON, XML y TXT (si IONOS lo acepta); fuentes con caché de
  30 días; `robots.txt`, `sitemap.xml` y `site.webmanifest` con su tipo correcto.
- Atributos `width`/`height` en las imágenes fijas para que la página no salte al cargar.

### Prompt 7: subir, probar y cerrar
- Subir por rsync a IONOS. Probar en vivo: `/sitemap.xml` válido, `/robots.txt`, iconos (200 y tipo), manifest,
  títulos y descripciones con su largo, canonical, JSON-LD válido (revisar con el validador de schema.org), CSP sin
  errores, 404 HTML, compresión de CSS y JS, vista previa de WhatsApp.
- Lighthouse otra vez y comparar con la línea base.
- Estado del plan, `plans/MEMORIA.md`, `README.md` (sección de SEO y la decisión de la CDN), commit en `main`
  (el usuario hace push desde VS Code).

## Lo que reutiliza
- `app/paginas.php` (`pagina_publica`, `etiquetas_og`, `og_de_tienda`, `og_de_producto`, `recortar`,
  `PAGINAS_FIJAS`, `con_web_analytics`).
- `app/api.php` (consultas de tiendas y productos visibles, `SQL_AGOTADO` para la disponibilidad).
- `public/style.css` (encabezado de sección, tarjetas, tokens), `public/iconos.js` (Lucide).
- `recursos/og/` y el procedimiento de Chrome sin ventana para generar PNG; memoria `pruebas-locales-necutla`.

## Verificación
- Local: `curl` de cada página (título 50–60, descripción 150–160, canonical, robots, JSON-LD que pase
  `json_decode`), `/sitemap.xml` con `xmllint --noout` y que solo traiga lo visible (ocultar una tienda de prueba y
  ver que sale), `/robots.txt`, iconos y manifest; Chrome sin ventana a 1280 y 360 px y con movimiento reducido
  (secciones nuevas, `<details>` con teclado, sin scroll horizontal, sin errores de consola ni CSP); conteo de
  palabras ≥ 500 en el HTML inicial.
- En vivo: lo mismo con `curl`, Lighthouse, y que el usuario vuelva a pasar el revisor de IONOS.

## Pasos del usuario (lo que Claude no puede hacer)
1. **Completar el aviso de privacidad y los términos:** nombre del responsable (tú o el grupo), domicilio o forma
   de contacto, correo para derechos ARCO (puede ser `tienda@necutla.com`). Claude marca cada hueco con
   `[COMPLETAR]`. Si quieres más seguridad legal, que lo lea alguien que sepa de derecho.
2. **Google Search Console** (https://search.google.com/search-console): agregar la propiedad `https://necutla.com`
   como "Prefijo de URL", elegir verificación por **archivo HTML** y pasarle a Claude solo el **nombre del archivo**
   (ej. `google1234abcd.html`; no es secreto) para que lo suba a `public/`. Después, en Sitemaps, enviar
   `sitemap.xml`.
3. (Opcional) **Bing Webmaster Tools** (https://www.bing.com/webmasters): "Importar desde Google Search Console".
4. En un iPhone o Android: abrir necutla.com → Compartir → "Agregar a inicio" y revisar que salga el icono.
5. Volver a pasar el revisor de IONOS. El punto de la CDN seguirá apareciendo: es a propósito (ver Contexto).
