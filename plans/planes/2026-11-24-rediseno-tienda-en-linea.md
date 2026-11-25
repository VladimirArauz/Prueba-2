# Rediseño de la portada como tienda en línea

- **Fecha:** 2026-11-24
- **Estado:** aplicado en local (2026-11-24); falta subir a IONOS
- **Prompts:** `plans/prompts/2026-11-24-rediseno-tienda-en-linea.md`
- **Alcance:** portada (`public/index.html`, `public/js/portada.js`, `public/style.css`), tarjeta de producto en todas las páginas, ficha de producto (`producto.html`) y app de Android (regla vigente: todo cambio va también a la app con APK nuevo). Sin cambios en la API, el carrito, Necutools ni el envío por WhatsApp.

## Por qué

El usuario siente que la portada no muestra de qué va el sitio: explica mucho y muestra pocos productos. Pide que se vea como página de ventas (Walmart, Mercado Libre, Amazon, Temu, Shein), que lo que hoy explica la portada pase a una sección "Conócenos", que se conserve el carrusel y que **la navegación siga en la barra lateral** (pedido explícito del 2026-11-24).

## Patrones tomados de las tiendas grandes (de memoria de su estructura; no se visitaron los sitios)

- Buscador grande y centrado arriba, con cuenta y carrito a la derecha (Amazon, Mercado Libre, Walmart).
- Fila de departamentos debajo del buscador (Walmart, Amazon).
- Banner de promociones en carrusel al inicio (Mercado Libre, Walmart).
- Franja de beneficios: envío, pago, devoluciones (Mercado Libre). Aquí: WhatsApp, recoger en el CECyT 9, pago al recibir, horario.
- Ofertas del día en riel horizontal con cuenta regresiva (Mercado Libre, Temu, Amazon).
- Departamentos con foto (Amazon, Shein).
- Rejilla densa con precio primero, descuento, calificación y foto cuadrada (todas).
- Ficha con miniaturas, foto grande y caja de compra a la derecha (Amazon, Mercado Libre).
- Lo institucional al final y en el pie (todas).

## Diseño

Sistema de diseño (lienzo privado de Claude): https://claude.ai/artifact/RPsVWmwzqTBCLASfKXMeiS
Vistas: PortadaEscritorio (1280px), PortadaCelular (375px) y cada componente. Fuentes en el scratchpad de la sesión del 2026-11-24.

Orden de la portada: barra lateral (igual que hoy, sin el buscador) → barra de la tienda en `--tinta` (buscador grande, Mi cuenta, Carrito, fila de tiendas) → banner de promociones con el tablero a un lado → beneficios → Ofertas de hoy (riel con reloj) → Compra por tienda → Lo más pedido esta semana (rejilla) → opiniones → Conócenos (Qué es Necutla, Cómo funciona, app, preguntas) → pie.

Mismos tokens de `style.css`: ningún color, letra ni sombra nueva.

## Cambios a las reglas de `plans/CLAUDE.md` que hay que aprobar

1. El tablero deja de ser la única pieza llamativa: productos y banner al frente.
2. Rejilla de productos 5 → 3 (992px) → 2 (640px); hoy 3 → 2 → 1.
3. Fotos de producto cuadradas en tarjetas (hoy 16:10).
4. El buscador sale de la barra lateral y pasa a la barra de la tienda.
5. Reloj de "Ofertas de hoy" que cambia cada segundo (solo números).

## Datos que hacen falta

- "Ofertas de hoy": las ofertas de tipo "de hoy" y los remates que ya existen; si no hay, la sección no se muestra.
- "Lo más pedido esta semana": productos de pedidos `pagado` de los últimos 7 días; si son menos de 10, se completa con los más nuevos. Ruta nueva `/api/portada/productos` (solo lectura, sin datos personales).
- Calificación por producto: ya existe en opiniones.
