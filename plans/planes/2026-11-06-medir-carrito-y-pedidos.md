# Medir carrito y pedidos en Google Analytics

- **Fecha:** 2026-11-06
- **Estado:** en curso
- **Prompts:** `plans/prompts/2026-11-06-medir-carrito-y-pedidos.md`
- **Alcance:** mandar a GA4 lo que se agrega al carrito y los pedidos y servicios enviados por WhatsApp, por tienda, solo con cookies aceptadas.

## Decisiones

- **`add_to_cart`:** al tocar "Agregar al carrito" o "Agregar paquete al carrito".
- **`begin_checkout`:** al abrir WhatsApp con un pedido (uno por tienda) o al pedir información de un servicio. No se usa `purchase`: el pago se acuerda por WhatsApp y Analytics contaría como ingresos pedidos sin pagar.
- **Por tienda:** `item_category` lleva la tienda e `item_category2` el tipo (Producto, Paquete o Servicio). No requiere dimensiones personalizadas.
- **Montos:** `value` en MXN con lo que calcula el servidor. Con ofertas, `price` sale de subtotal entre piezas. Un servicio con precio "desde" o "a cotizar" va sin precio.
- **Sin datos personales:** nunca se manda nombre, correo ni teléfono del cliente.
- **Limitación:** `begin_checkout` cuenta cuando se abre WhatsApp, no cuando la persona pulsa "Enviar" allá.

## Tag Manager

Etiqueta de evento de GA4 con `{{Event}}`, datos de comercio electrónico desde la capa de datos y un activador de evento personalizado `add_to_cart|begin_checkout`. La ayuda de Google consultada documenta la etiqueta de evento, pero no la opción de comercio electrónico: esos nombres se tomaron de lo conocido del producto y el prompt pide detenerse si no aparecen.

## Excepción

Como en `2026-11-06-conectar-google-analytics.md`, el prompt es para la extensión de Claude en Brave y no pide leer `plans/CLAUDE.md`.

## Fuentes

- https://developers.google.com/analytics/devguides/collection/ga4/reference/events
- https://developers.google.com/analytics/devguides/collection/ga4/ecommerce
- https://support.google.com/tagmanager/answer/13034206
- https://support.google.com/analytics/answer/13128484
