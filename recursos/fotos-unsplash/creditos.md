# Fotos de Unsplash de las tarjetas de tiendas de la portada

Plan: `plans/planes/2026-10-31-fotos-tiendas-portada.md`. Todas con **Unsplash License** (gratis, también comercial;
el crédito no es obligatorio, pero la portada lo muestra). Ninguna es Unsplash+. Revisadas el 2026-10-31.
Archivos: `public/imagenes/tiendas/<tienda>-640.webp` y `<tienda>-1280.webp` (recorte 16:10, sin metadatos).

| Tienda | Foto elegida | Fotógrafo | Texto alternativo | Respaldo |
|---|---|---|---|---|
| Ropa | [xXJ6utyoSw0](https://unsplash.com/photos/xXJ6utyoSw0) | [Marcus Loke](https://unsplash.com/@marcusloke) | Camisas de colores colgadas en un perchero | [pt3EBzQcxP0](https://unsplash.com/photos/pt3EBzQcxP0) (Polina Kuzovkova) |
| Tecnología | [NikjUKUojso](https://unsplash.com/photos/NikjUKUojso) | [Jakub Żerdzicki](https://unsplash.com/@jakubzerdzicki) | Celular, teclado y mouse sobre un escritorio | [_RpPMkqTTTg](https://unsplash.com/photos/_RpPMkqTTTg) (Onur Binay) |
| Dulces | [k4w2o7TVjks](https://unsplash.com/photos/k4w2o7TVjks) | [Customerbox](https://unsplash.com/@customerbox) | Caramelos de colores amontonados | [xBTnaTgleQE](https://unsplash.com/photos/xBTnaTgleQE) (Glen Carrie) |
| Propaganda | [6-RhsUzKO6g](https://unsplash.com/photos/6-RhsUzKO6g) | [Andrew Pons](https://unsplash.com/@imandrewpons) | Hojas impresas de colores abiertas en abanico | [FaIwAogR7eE](https://unsplash.com/photos/FaIwAogR7eE) (Lola Waligora-Thomas) |
| Papelería | [ddAn2tozJvk](https://unsplash.com/photos/ddAn2tozJvk) | [Caroline](https://unsplash.com/@carolinentmt) | Plumas y marcadores de colores acomodados en filas | [KigTvXqetXA](https://unsplash.com/photos/KigTvXqetXA) (Tim Gouw) |
| Regalos | [f94JPVrDbnY](https://unsplash.com/photos/f94JPVrDbnY) | [Jess Bailey](https://unsplash.com/@jessbaileydesigns) | Caja de regalo de papel kraft con moño rosa | [PxM8aeJbzvk](https://unsplash.com/photos/PxM8aeJbzvk) (freestocks) |
| Otra | [Cm-Jt6d7Sms](https://unsplash.com/photos/Cm-Jt6d7Sms) | [Aron Weerakoon](https://unsplash.com/@aron781n) | Puesto de mercado con artesanías tejidas de colores | [1L6u2vnLEWA](https://unsplash.com/photos/1L6u2vnLEWA) (Janice Liao) |

Dirección de descarga de cada una (CDN de Unsplash; `unsplash.com/photos/<id>/download` bloquea a `curl`):

| Tienda | Imagen |
|---|---|
| Ropa | `https://images.unsplash.com/photo-1532453288672-3a27e9be9efd` |
| Tecnología | `https://images.unsplash.com/photo-1702390740712-ce6daf1673be` |
| Dulces | `https://images.unsplash.com/photo-1588755821761-a4d1eafe2b19` |
| Propaganda | `https://images.unsplash.com/photo-1422036306541-00138cae4dbc` |
| Papelería | `https://images.unsplash.com/photo-1774878520736-6cacbcce1b7b` |
| Regalos | `https://images.unsplash.com/photo-1513201099705-a9746e1e201f` |
| Otra | `https://images.unsplash.com/photo-1788102264117-94e5bffea0db` |

Para cambiar una: buscar otra con "Unsplash License", descargarla con `?fm=jpg&q=85&w=1600`, recortarla a 16:10,
guardarla en WebP a 640 y 1280 px con el mismo nombre y actualizar esta tabla y `FOTOS_TIENDAS` en
`public/js/portada.js`.
