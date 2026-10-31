# Prompts: imagen de vista previa propia para cada tienda

## Prompt 1: imagen generada por tienda (aplicado el 2026-10-30)

Lee `plans/CLAUDE.md` y el plan `2026-10-30-vista-previa-por-tienda.md`. Saca las 3 instancias fijas de Archivo a
`app/fuentes/`, crea `app/og-imagen.php` con `GET /api/stands/:slug/vista.png` y haz que `app/paginas.php` la use en
las tiendas sin portada real. Pruébalo en local con `php8.5-gd` (las 7 tiendas, nombres largos, tienda oculta),
súbelo a IONOS y revisa con `curl` en vivo. Pide al usuario mandar por WhatsApp el enlace de una tienda.
