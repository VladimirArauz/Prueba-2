// =========================================================
// NECUTLA — Panel de permisos de la primera visita (plan 2026-11-25-avisos-errores-y-permisos-al-inicio).
// El único permiso que usa la web es el de notificaciones (cámara, micrófono y ubicación están cerrados en la
// Permissions-Policy). El navegador solo muestra el permiso si la persona toca algo, así que el panel lleva un botón.
// Sale una sola vez, después del aviso de cookies. Sin sesión, el permiso se pide ya y la suscripción se hace sola
// al entrar a Mi cuenta (cuenta.js, marca necutla_avisos_pendiente). Usa las funciones de avisos de comun.js.
// =========================================================

(() => {
  const CLAVE = "necutla_permisos";
  const PENDIENTE = "necutla_avisos_pendiente";

  function leer(clave) {
    try { return localStorage.getItem(clave); } catch { return "no"; } // sin almacenamiento, no se insiste
  }

  function guardar(clave, valor) {
    try { localStorage.setItem(clave, valor); } catch { /* el panel volvería a salir: no pasa nada */ }
  }

  function tocaMostrar() {
    return avisosPosibles() && Notification.permission === "default" && !leer(CLAVE);
  }

  let panel = null;

  function cerrar(valor) {
    guardar(CLAVE, valor);
    panel?.remove();
    panel = null;
  }

  async function permitir(boton) {
    botonOcupado(boton, "Pidiendo el permiso");
    let permiso;
    try {
      permiso = await Notification.requestPermission();
    } catch (e) {
      permiso = "denied";
    }
    if (permiso !== "granted") {
      cerrar(permiso === "denied" ? "no" : "despues"); // "default": cerró el aviso del navegador sin elegir
      if (permiso === "denied") showToast("Listo, no te mandaremos avisos. Puedes activarlos después en Mi cuenta, Mis pedidos.", "bell-off");
      return;
    }
    cerrar("si");
    const sesion = await sesionCompra();
    if (sesion && sesion.autenticado) {
      try {
        await activarAvisos("cliente");
        showToast("Avisos activados en este navegador.", "bell");
      } catch (e) {
        avisarError(e.message);
      }
      pintarTodasLasCajasDeAvisos();
      return;
    }
    guardar(PENDIENTE, "cliente");
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    showToast("Listo. Te avisaremos de tus pedidos cuando entres a tu cuenta.", "bell");
  }

  function mostrar() {
    if (panel || !tocaMostrar()) return;
    panel = document.createElement("section");
    panel.className = "aviso-cookies aviso-permisos";
    panel.setAttribute("aria-labelledby", "aviso-permisos-titulo");
    panel.innerHTML = `
      <div class="container aviso-cookies-interior">
        <div>
          <h2 id="aviso-permisos-titulo">Permisos de Necutla</h2>
          <p>Te avisamos cuando la tienda confirme, pague o cambie tu pedido. Solo pedimos permiso para mandarte notificaciones.</p>
        </div>
        <div class="aviso-cookies-botones">
          <button type="button" class="btn btn-sm" data-permisos="si">${icon("bell")}Permitir notificaciones</button>
          <button type="button" class="btn ghost btn-sm" data-permisos="despues">Ahora no</button>
        </div>
      </div>`;
    panel.addEventListener("click", e => {
      const boton = e.target.closest("[data-permisos]");
      if (!boton) return;
      if (boton.dataset.permisos === "si") permitir(boton);
      else cerrar("despues");
    });
    document.body.appendChild(panel);
  }

  // Igual que el aviso de cookies: sale cuando ya cargó Archivo, para no cambiar de alto al llegar la letra (CLS)
  function cuandoCargueLaLetra(fn) {
    const tope = new Promise(r => setTimeout(r, 2500));
    const letra = document.fonts
      ? document.fonts.load('600 16px "Archivo"').then(() => document.fonts.ready)
      : Promise.resolve();
    Promise.race([letra, tope]).catch(() => {}).then(fn);
  }

  if (!tocaMostrar()) return;
  // Si en esta página hay aviso de cookies y todavía no se decide, el panel espera a que se decida
  const hayCookies = document.querySelector('script[src="/js/etiquetas.js"][data-gtm]');
  const cookies = leer("necutla_cookies");
  if (hayCookies && cookies !== "si" && cookies !== "no") {
    document.addEventListener("necutla:cookies-decididas", () => cuandoCargueLaLetra(mostrar), { once: true });
  } else {
    cuandoCargueLaLetra(mostrar);
  }
})();
