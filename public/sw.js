/*
 * NECUTLA — Service worker solo para los avisos de pedidos (Web Push, plan 2026-11-22-icono-actualizador-y-notificaciones).
 * No guarda nada en caché: la página funciona igual que siempre. El servidor manda {titulo, cuerpo, url, etiqueta}.
 */
self.addEventListener("push", event => {
  let datos = {};
  try { datos = event.data ? event.data.json() : {}; } catch (e) { datos = { cuerpo: event.data ? event.data.text() : "" }; }
  event.waitUntil(self.registration.showNotification(datos.titulo || "Necutla", {
    body: datos.cuerpo || "",
    icon: "/imagenes/logo.png",
    badge: "/imagenes/aviso-insignia.png",
    tag: datos.etiqueta || undefined,
    lang: "es-MX",
    data: { url: datos.url || "/" }
  }));
});

// Al tocar el aviso: si la página ya está abierta, se enfoca; si no, se abre
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const destino = new URL(event.notification.data && event.notification.data.url || "/", self.location.origin);
  if (destino.origin !== self.location.origin) return;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(ventanas => {
    for (const v of ventanas) {
      if (v.url === destino.href && "focus" in v) return v.focus();
    }
    return self.clients.openWindow(destino.href);
  }));
});
