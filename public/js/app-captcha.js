// =========================================================
// NECUTLA — Captcha para la app de Android (plan 2026-11-22-app-nativa-mis-pedidos-y-descarga)
// La app abre /app/captcha.html?accion=<acción> en un WebView. Aquí se pide el token a Cloudflare
// Turnstile con la misma llave y acción que en la web (public/js/captcha.js) y se entrega a la app por
// window.NecutlaApp (interfaz que pone la app). El servidor revisa el token igual (app/captcha.php).
// =========================================================
(function () {
  const ACCIONES = ["login", "registro", "restablecer", "reenviar", "pedido", "opinion"];
  const accion = new URLSearchParams(location.search).get("accion");
  const estado = document.getElementById("captcha-estado");
  const app = window.NecutlaApp;

  function fallo(mensaje) {
    estado.textContent = mensaje;
    if (app) app.fallo(mensaje);
  }

  if (!app) return fallo("Esta página solo funciona dentro de la app de Necutla.");
  if (!ACCIONES.includes(accion)) return fallo("La revisión de seguridad no es válida. Vuelve a intentarlo.");

  fetch("/api/config", { credentials: "same-origin" })
    .then(r => (r.ok ? r.json() : Promise.reject()))
    .then(config => {
      if (!config.captcha) return app.listo("sin-captcha");
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.addEventListener("error", () => fallo("No se pudo cargar la revisión de seguridad. Revisa tu internet e intenta de nuevo."));
      s.addEventListener("load", () => {
        window.turnstile.render(document.getElementById("captcha"), {
          sitekey: config.captcha,
          action: accion,
          appearance: "interaction-only",
          size: "flexible",
          theme: "light",
          language: "es",
          callback: token => {
            estado.textContent = "Listo.";
            app.listo(token);
          },
          "error-callback": () => {
            fallo("No pudimos confirmar que no eres un robot. Cierra esta ventana y vuelve a intentarlo.");
            return true;
          },
          "timeout-callback": () => fallo("Se acabó el tiempo para la revisión de seguridad. Vuelve a intentarlo.")
        });
      });
      document.head.appendChild(s);
    })
    .catch(() => fallo("No hay conexión con el servidor. Revisa tu internet e intenta de nuevo."));
})();
