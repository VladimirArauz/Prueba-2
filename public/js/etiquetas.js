// =========================================================
// NECUTLA — Aviso de cookies y arranque de Google Tag Manager, sin JavaScript en línea (la CSP lo bloquea).
// app/paginas.php pone esta etiqueta con el id del contenedor en data-gtm, solo si 'google_tag_manager' está en
// app/config.php: en local no se mide nada. Google no recibe ninguna petición hasta que la persona acepta.
// La decisión se guarda en este navegador y se cambia con el botón de /privacidad.html#cookies.
// =========================================================

(() => {
  const id = document.currentScript?.dataset.gtm;
  if (!id) return;

  const CLAVE = "necutla_cookies";
  let cargado = false;
  let aviso = null;

  function decisionGuardada() {
    try { return localStorage.getItem(CLAVE); } catch { return null; }
  }

  function guardarDecision(valor) {
    try { localStorage.setItem(CLAVE, valor); } catch { /* sin almacenamiento, el aviso vuelve a salir */ }
  }

  // Lo mismo que hace el fragmento oficial de Google
  function cargarTagManager() {
    if (cargado) return;
    cargado = true;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(id);
    document.head.appendChild(script);
  }

  function borrarCookiesDeAnalytics() {
    const dominio = location.hostname;
    document.cookie.split(";").map(c => c.split("=")[0].trim()).filter(n => /^(_ga|_gid|_gat)/.test(n)).forEach(nombre => {
      ["", `;domain=${dominio}`, `;domain=.${dominio}`].forEach(d => {
        document.cookie = `${nombre}=;max-age=0;path=/${d}`;
      });
    });
  }

  function decidir(valor) {
    const antes = decisionGuardada();
    guardarDecision(valor);
    aviso?.remove();
    aviso = null;
    if (valor === "si") {
      cargarTagManager();
    } else if (antes === "si" || cargado) {
      // Tag Manager ya corre en esta página: recargar es la única forma de detenerlo
      borrarCookiesDeAnalytics();
      location.reload();
    }
  }

  function mostrarAviso() {
    if (aviso) return;
    aviso = document.createElement("section");
    aviso.className = "aviso-cookies";
    aviso.setAttribute("aria-label", "Aviso de cookies");
    aviso.innerHTML = `
      <div class="container aviso-cookies-interior">
        <p>Usamos cookies de Google Analytics para saber qué páginas se visitan y mejorar Necutla. Solo se activan si las aceptas. Lee el <a href="/privacidad.html#cookies">Aviso de privacidad</a>.</p>
        <div class="aviso-cookies-botones">
          <button type="button" class="btn btn-sm" data-cookies="si">Aceptar cookies</button>
          <button type="button" class="btn secondary btn-sm" data-cookies="no">Rechazar cookies</button>
        </div>
      </div>`;
    aviso.addEventListener("click", e => {
      const boton = e.target.closest("[data-cookies]");
      if (boton) decidir(boton.dataset.cookies);
    });
    document.body.appendChild(aviso);
  }

  // Botón del aviso de privacidad para cambiar la decisión
  const lugarBoton = document.getElementById("cookies-decision");
  if (lugarBoton) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "btn secondary";
    boton.textContent = "Cambiar mi decisión sobre cookies";
    boton.addEventListener("click", () => {
      mostrarAviso();
      aviso.querySelector("[data-cookies]").focus();
    });
    lugarBoton.appendChild(boton);
  }

  const decision = decisionGuardada();
  if (decision === "si") cargarTagManager();
  else if (decision !== "no") mostrarAviso();
})();
