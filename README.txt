LA CIUDAD DEL ESTUDIANTE — V2
CARRITO + 3 WHATSAPP

CORRECCIÓN:
El botón "Agregar al carrito" ahora utiliza botones con eventos JavaScript
y guarda el producto en localStorage separado por tienda.

FLUJO:
1. Entra a una tienda.
2. Entra a una subcategoría.
3. Pulsa "Agregar al carrito".
4. El contador del carrito aumenta.
5. Entra a Carrito.
6. Cambia cantidades o elimina productos.
7. Pulsa "Enviar pedido a los 3 WhatsApp".
8. El mismo pedido se prepara en los 3 chats.

CONFIGURAR NÚMEROS:
Cada tienda tiene:
tienda/js/carrito.js

Cambia:
const WHATSAPP_NUMBERS = [
  "525500000001",
  "525500000002",
  "525500000003"
];

por los números reales.

IMPORTANTE:
WhatsApp no permite que una página web pulse automáticamente "Enviar".
Los 3 chats se abren con el mensaje preparado y el cliente debe pulsar
"Enviar" en cada uno. Para envío automático real se necesitaría WhatsApp
Business Platform/API.

También puedes reemplazar las imágenes SVG de ejemplo por JPG/PNG reales.
