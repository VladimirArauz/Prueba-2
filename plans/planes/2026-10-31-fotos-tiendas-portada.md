# Plan: fotos profesionales de Unsplash en las tarjetas de tiendas de la portada

- **Fecha:** 2026-10-31
- **Estado:** aplicado (2026-10-31, prompts 1 a 4, subido a IONOS)
- **Prompts:** `plans/prompts/2026-10-31-fotos-tiendas-portada.md`
- **Alcance:** `public/imagenes/tiendas/` (fotos nuevas en WebP), `public/js/portada.js` (qué foto usa cada
  tarjeta y la línea de créditos), `public/index.html` (lugar de los créditos), `public/style.css` (foto que llena
  la tarjeta), `recursos/fotos-unsplash/creditos.md` (de dónde salió cada foto). Solo la portada: la página de cada
  tienda, Necutools, la API, la base y la vista previa de WhatsApp no cambian.

## Contexto

En la portada, la sección "Tiendas" muestra una tarjeta por tienda con una imagen de relleno: un SVG gris con solo
el nombre ("Ropa", "Tecnología"…, `public/imagenes/<slug>.svg`, guardado en `stands.imagen_ruta`). Se ve vacío. El
usuario quiere una foto profesional de https://unsplash.com/es/s/fotos/… para cada tarjeta, solo en la portada.

Lo que se revisó (2026-10-31):
- Las 7 tiendas (ropa, tecnologia, dulces, propaganda, papeleria, regalos, otra) usan su SVG; ninguna tiene una
  portada subida en Necutools (`stands.portada`).
- La tarjeta (`tarjetaTienda` en `public/js/portada.js`) pinta `t.imagen_url` dentro de `.card-img-wrap`
  (proporción 16:10, `object-fit: contain`).
- **Licencia de Unsplash** (unsplash.com/license): uso gratis, también comercial, sin pedir permiso; el crédito no es
  obligatorio pero se agradece; no se pueden vender las fotos sin cambios ni juntar fotos para hacer un servicio
  parecido. Las fotos **Unsplash+** son de pago: **no se usan**.
- `unsplash.com/photos/<id>/download` bloquea a `curl` (protección contra robots). La página de cada foto, leída con
  WebFetch, da la dirección de la imagen en `images.unsplash.com`, y esa sí se descarga con `curl` (probado: 200,
  JPEG de 1600 px).
- La CSP solo deja imágenes del propio sitio (`img-src 'self' data:`): las fotos se descargan y se sirven desde
  `public/`, nunca enlazadas a Unsplash. Se tiene Pillow (Python) y GD con WebP para optimizarlas.

Decisiones del usuario (2026-10-31):
- **Claude elige las fotos** (una por tienda) con los criterios de abajo; el usuario las revisa después y pide
  cambiar las que no le gusten.
- **Créditos:** una línea discreta debajo de las tarjetas: "Fotos de Unsplash: Nombre, Nombre…", con enlace a cada
  fotógrafo.

## Resultado (2026-10-31)

| Tienda | Foto | Fotógrafo | Peso (640 / 1280) |
|---|---|---|---|
| Ropa | Camisas de colores en un perchero (`xXJ6utyoSw0`) | Marcus Loke | 29 / 77 KB |
| Tecnología | Celular, teclado y mouse en un escritorio (`NikjUKUojso`) | Jakub Żerdzicki | 12 / 26 KB |
| Dulces | Caramelos de colores (`k4w2o7TVjks`) | Customerbox | 21 / 49 KB |
| Propaganda | Hojas impresas de colores en abanico (`6-RhsUzKO6g`) | Andrew Pons | 14 / 34 KB |
| Papelería | Plumas y marcadores en filas (`ddAn2tozJvk`) | Caroline | 28 / 64 KB |
| Regalos | Caja kraft con moño rosa (`f94JPVrDbnY`) | Jess Bailey | 13 / 37 KB |
| Otra | Puesto de mercado con artesanías tejidas (`Cm-Jt6d7Sms`) | Aron Weerakoon | 40 / 109 KB |

- Se revisaron 20 candidatas (todas con "Unsplash License") en una hoja de contacto recortada a 16:10; las
  respaldo están en `recursos/fotos-unsplash/creditos.md`. Propaganda quedó con papeles de colores porque las otras
  candidatas tenían texto legible en inglés o francés.
- Lighthouse de la portada en vivo: 91 → 92 en rendimiento, 100 en accesibilidad, buenas prácticas y SEO.
- Pruebas: 7 fotos cargadas y con `object-fit: cover` a 1280, 360 y con movimiento reducido, créditos con los 7
  fotógrafos, sin scroll horizontal ni errores; una tienda con portada propia usa la suya y una tienda nueva sigue
  con su imagen de siempre.

## Criterios para elegir cada foto
- Licencia Unsplash (no Unsplash+), horizontal y que se vea bien recortada a 16:10.
- Que se entienda la tienda de un vistazo: Ropa (ropa en percheros), Tecnología (celular, cables, audífonos),
  Dulces (dulces mexicanos o de colores), Propaganda (impresos, volantes, lonas), Papelería (cuadernos, plumas),
  Regalos (cajas de regalo, envolturas), Otra (variedad de artículos o un puesto).
- Sin caras en primer plano, sin marcas ni logos legibles, sin texto en otro idioma que distraiga.
- Las 7 con un tono parecido (luz natural, fondos limpios) para que la cuadrícula se vea pareja; ninguna debe
  competir con el tablero del hero (nada de neón ni colores saturados).

## Qué se va a hacer (por prompt)

### Prompt 1: buscar y elegir
- Buscar en Unsplash en español (`unsplash.com/es/s/fotos/<tema>`) con WebFetch, 2 o 3 búsquedas por tienda.
- Abrir la página de las candidatas para confirmar "Unsplash License", fotógrafo, perfil y la dirección en
  `images.unsplash.com`.
- Descargar las candidatas a la carpeta temporal y armar una hoja de contacto (Pillow) para verlas juntas y elegir
  una por tienda, más una de respaldo.
- Anotar todo en `recursos/fotos-unsplash/creditos.md`: tienda, id y enlace de la foto, fotógrafo y su perfil,
  licencia, fecha y el texto `alt` en español.

### Prompt 2: descargar y optimizar
- Descargar la elegida a 1600 px de ancho desde `images.unsplash.com` (`fm=jpg&q=85`).
- Con Pillow: recortar a 16:10 (centro, o el punto que mejor muestre el tema), quitar metadatos y guardar en WebP
  calidad ~78 a dos tamaños: `public/imagenes/tiendas/<slug>-640.webp` (640×400) y `<slug>-1280.webp`
  (1280×800). Meta: menos de 60 KB la chica y 150 KB la grande.
- Revisar cada archivo (tamaño, dimensiones, que se vea bien).

### Prompt 3: usarlas en la portada
- `public/js/portada.js`: `FOTOS_TIENDAS = { ropa: { foto, alt, autor, perfil }, … }`. En `tarjetaTienda`, si la tienda
  tiene foto en esa lista **y su imagen es el SVG de relleno**, usa la foto con `srcset` (640w y 1280w),
  `sizes` según la cuadrícula (3 → 2 → 1 columnas), `width="1280" height="800"`, `loading="lazy"`,
  `decoding="async"` y su `alt`. Si un dueño ya subió una portada propia en Necutools, se respeta la suya. Una tienda
  nueva sin foto sigue con su imagen de siempre.
- Clase `.card-img-wrap.is-foto` en `style.css`: la foto llena la tarjeta (`object-fit: cover`), sin colores ni
  sombras nuevas. El zoom leve al pasar el mouse ya es una excepción autorizada (plan del 2026-10-20) y se queda.
- Créditos: `<p class="creditos-fotos">` debajo de `#stores-grid` en `index.html`, que `portada.js` llena con los
  fotógrafos de las tarjetas que se ven: "Fotos de Unsplash: <a>Nombre</a>, <a>Nombre</a>…" (texto `--texto-2`,
  chico, enlaces con `rel="noopener"`). Todo texto pasa por `escapeHTML`.
- La página de cada tienda (`/t/<slug>`), la vista previa de WhatsApp y Necutools **no cambian**.

### Prompt 4: probar, subir y cerrar
- Chrome sin ventana a 1280, 360 y con movimiento reducido: las 7 fotos cargan (la de 640 en celular), los
  créditos salen, sin scroll horizontal ni errores de consola o CSP; simular una tienda con portada propia y una
  tienda nueva sin foto.
- Lighthouse de la portada antes y después (no debe bajar de 90 en rendimiento ni de 100 en lo demás).
- Subir por rsync a IONOS y revisar en vivo. Estado del plan, `plans/MEMORIA.md` y commit en `main` (el usuario
  hace push desde VS Code).

## Lo que reutiliza
- `tarjetaTienda` y la carga de tiendas de `public/js/portada.js`; `escapeHTML` de `public/js/comun.js`.
- `.card`, `.card-img-wrap` y la cuadrícula de `public/style.css`.
- Pillow y Chrome sin ventana (memoria `pruebas-locales-necutla`), rsync a IONOS (memoria `secrets-md-no-imprimir`).

## Verificación
- Local: las 7 tarjetas con su foto WebP (`naturalWidth` 640 a 360 px y 1280 a 1280 px), `alt` en español, créditos
  con 7 nombres y enlaces, `object-fit: cover`, Lighthouse ≥ 90 / 100 / 100 / 100, sin errores.
- En vivo: las fotos dan 200 `image/webp` con caché, la portada se ve igual que en local.

## Pasos del usuario
1. Abrir https://necutla.com y revisar las 7 fotos. Si alguna no te gusta, dime cuál (o pásame el enlace de otra foto
   de Unsplash que prefieras) y la cambio.
2. No necesitas cuenta de Unsplash ni pagar nada: solo se usan fotos con la licencia gratis.
3. Si una tienda sube su propia portada en Necutools → Tiendas → Editar, la portada mostrará esa en lugar de la de
   Unsplash.
