/**
 * NECUTLA — Cuenta de cliente: iniciar sesión (usuario o correo), crear cuenta, completar una cuenta
 * vieja, cambiar contraseña, restablecerla y cerrar sesión. La validación en vivo está en validacion.js.
 * Entrar, crear la cuenta y restablecer piden el código que llega al correo (codigo.js).
 * ?volver=/p/12 regresa al producto después de entrar.
 */

const MIN_PASSWORD_CLIENTE = 10; // igual que server/clientes.js

const $ = id => document.getElementById(id);

// Tarjeta visible fuera de la cuenta: "fuera" (entrar / crear), "codigo", "restablecer" o "nueva"
const VISTAS = { fuera: "cuenta-fuera", codigo: "cuenta-codigo", restablecer: "cuenta-restablecer", nueva: "cuenta-nueva" };

function vista(nombre) {
  for (const [clave, id] of Object.entries(VISTAS)) $(id).hidden = clave !== nombre;
}

// Paso del código: a qué ruta se manda y qué pasa al acertar
const PASOS_CODIGO = {
  login: { ruta: "/clientes/login/codigo", titulo: "Revisa tu correo para entrar" },
  registro: { ruta: "/clientes/registro/codigo", titulo: "Revisa tu correo para crear tu cuenta" },
  restablecer: { ruta: "/clientes/restablecer/codigo", titulo: "Revisa tu correo para cambiar tu contraseña" }
};

let campoCodigo = null;
let pasoCodigo = null;
let cuentaAtras = null;

function estadoCodigo(texto, tipo = "") {
  const estado = $("codigo-estado");
  estado.className = `codigo-estado${tipo ? ` is-${tipo}` : ""}`;
  estado.innerHTML = tipo === "ok" ? `${icon("circle-check")}<span>${escapeHTML(texto)}</span>` : escapeHTML(texto);
}

// "Reenviar código en 45 s" hasta que pase la espera
function esperarReenvio(segundos) {
  const boton = $("codigo-reenviar");
  clearInterval(cuentaAtras);
  let quedan = Math.max(0, Math.round(segundos));
  const pintar = () => {
    boton.disabled = quedan > 0;
    boton.textContent = quedan > 0 ? `Reenviar código en ${quedan} s` : "Reenviar código";
  };
  pintar();
  if (!quedan) return;
  cuentaAtras = setInterval(() => {
    quedan -= 1;
    pintar();
    if (quedan <= 0) clearInterval(cuentaAtras);
  }, 1000);
}

function mostrarCodigo(respuesta) {
  pasoCodigo = respuesta.proposito;
  $("codigo-title").textContent = PASOS_CODIGO[pasoCodigo].titulo;
  $("codigo-desc").textContent = respuesta.correo
    ? `Te mandamos un código de 6 dígitos a ${respuesta.correo}. Vence en 10 minutos.`
    : "Si tienes cuenta, te mandamos un código de 6 dígitos a tu correo. Vence en 10 minutos.";
  campoCodigo.limpiar();
  estadoCodigo("");
  esperarReenvio(respuesta.espera ?? 0);
  vista("codigo");
  campoCodigo.enfocar();
}

// Después de acertar se ve el verde un momento antes de seguir (sin espera con movimiento reducido)
const pausaExito = () => new Promise(listo => setTimeout(listo, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 900));

async function verificarCodigo(codigo) {
  if (!pasoCodigo || codigo.length !== DIGITOS_CODIGO) {
    estadoCodigo("Escribe los 6 dígitos del código.", "error");
    return;
  }
  const boton = $("form-codigo").querySelector('[type="submit"]');
  if (boton.getAttribute("aria-busy") === "true") return;
  botonOcupado(boton);
  campoCodigo.habilitar(false);
  try {
    const respuesta = await api(PASOS_CODIGO[pasoCodigo].ruta, { method: "POST", body: { codigo } });
    campoCodigo.exito();
    estadoCodigo("Verificado", "ok");
    clearInterval(cuentaAtras);
    await pausaExito();
    const paso = pasoCodigo;
    pasoCodigo = null;
    if (paso === "restablecer") {
      vista("nueva");
      $("nueva-password").focus();
    } else {
      entrar(respuesta, paso === "registro" ? `Cuenta creada. Te damos la bienvenida, ${respuesta.nombre}.` : `Sesión iniciada: ${respuesta.nombre}`);
    }
  } catch (error) {
    campoCodigo.habilitar(true);
    campoCodigo.error();
    estadoCodigo(error.message, "error");
    if (error.status === 410) esperarReenvio(0); // venció o sin intentos: ya se puede pedir otro
  } finally {
    botonListo(boton);
  }
}

function volverDelCodigo() {
  clearInterval(cuentaAtras);
  const paso = pasoCodigo;
  pasoCodigo = null;
  if (location.hash === "#restablecer") history.replaceState(null, "", location.pathname + location.search);
  vista("fuera");
  modoAuth(paso === "registro", true);
}

// Solo rutas de este sitio ("/p/12"), nunca otra página ("//otro.com")
function destinoDeVuelta() {
  const volver = new URLSearchParams(location.search).get("volver") || "";
  return /^\/[a-z0-9/?=&_-]*$/i.test(volver) && !volver.startsWith("//") ? volver : "";
}

// La tarjeta mide lo del formulario visible (en celular, más el panel de arriba); CSS anima el cambio
function ajustarAlto() {
  const auth = $("cuenta-fuera");
  if (auth.hidden) return;
  const form = auth.classList.contains("is-registro") ? $("auth-registro") : $("auth-entrar");
  const panel = matchMedia("(max-width: 760px)").matches ? auth.querySelector(".auth-panel").offsetHeight : 0;
  auth.style.setProperty("--alto-auth", `${form.offsetHeight + panel + 16}px`);
}

// Contraseña equivocada: las ventanas de los edificios se ponen rojas y parpadean un momento
let alarmaAuth = null;
function alarmaVentanas() {
  const auth = $("cuenta-fuera");
  clearTimeout(alarmaAuth);
  auth.classList.remove("is-alarma");
  void auth.offsetWidth; // reinicia el parpadeo si vuelve a fallar
  auth.classList.add("is-alarma");
  alarmaAuth = setTimeout(() => auth.classList.remove("is-alarma"), 1800);
}

// Panel deslizante: muestra "Iniciar sesión" o "Crear cuenta"; el otro formulario queda inerte
function modoAuth(registro, enfocar = false) {
  $("cuenta-fuera").classList.toggle("is-registro", registro);
  $("auth-entrar").inert = registro;
  $("auth-registro").inert = !registro;
  ajustarAlto();
  if (enfocar) {
    const campo = registro ? $("registro-nombre") : $("entrar-identificador");
    campo.focus({ preventScroll: true });
  }
}

function render(sesion) {
  if (sesion && sesion.pausa) {
    $("cuenta-fuera").hidden = true;
    $("cuenta-dentro").hidden = true;
    $("cuenta-pausa").hidden = false;
    return;
  }
  const dentro = Boolean(sesion && sesion.autenticado);
  $("cuenta-dentro").hidden = !dentro;
  if (!dentro) {
    vista("fuera");
    modoAuth(location.hash === "#crear-cuenta");
    // Al recargar a medio paso se retoma (el código ya va en el correo)
    if (sesion && sesion.codigoPendiente) mostrarCodigo({ ...sesion.codigoPendiente, espera: 0 });
    else if (location.hash === "#restablecer") abrirRestablecer(false);
    return;
  }
  vista(null);
  $("dentro-title").textContent = `Hola, ${sesion.nombre}`;
  $("dentro-correo").textContent = sesion.usuario
    ? `Tu usuario es ${sesion.usuario} y tu correo ${sesion.correo}.`
    : `Entraste con ${sesion.correo}.`;
  $("cuenta-completar").hidden = !sesion.incompleta;
  $("completar-usuario-grupo").hidden = Boolean(sesion.usuario);
  const volver = destinoDeVuelta();
  $("dentro-seguir").href = volver || "/";
  $("dentro-seguir").textContent = volver ? "Volver al producto" : "Ver tiendas";
}

function abrirRestablecer(enfocar = true) {
  vista("restablecer");
  const campo = $("restablecer-identificador");
  if (!campo.value) campo.value = $("entrar-identificador").value;
  if (enfocar) campo.focus();
}

// Respuesta de entrar o crear cuenta: falta el código del correo, o ya hay sesión
function siguientePaso(respuesta, mensaje) {
  if (respuesta && respuesta.codigo) mostrarCodigo(respuesta);
  else entrar(respuesta, mensaje);
}

// Después de entrar o crear la cuenta: de regreso al producto, o se muestra la cuenta
function entrar(sesion, mensaje) {
  const volver = destinoDeVuelta();
  if (volver) {
    location.href = volver;
    return;
  }
  render(sesion);
  showToast(mensaje);
}

// Revisa los campos (si hay errores, enfoca el primero), manda el formulario y llama a listo(respuesta)
async function enviarForm(event, { ruta, metodo = "POST", campos, listo, alFallar }) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(await validarFormulario(form))) return;
  const boton = form.querySelector('[type="submit"]');
  const body = Object.fromEntries(campos.map(c => [c, form.elements[c].value]));
  botonOcupado(boton);
  try {
    const respuesta = await api(ruta, { method: metodo, body });
    form.reset();
    reiniciarCampos(form);
    listo(respuesta);
  } catch (error) {
    showToast(error.message, "info");
    if (alFallar) alFallar(error);
  } finally {
    botonListo(boton);
  }
}

// Teléfono con su país: la regla cambia según la lada elegida
// Se prepara de inmediato con México; cuando llega la lista de países, se usa esa
async function prepararTelefono(select, input) {
  let paises = [MEXICO];
  const pais = () => paises.find(p => p.iso === select.value);
  prepararCampo(input, valor => revisarTelefono(valor, pais()));
  select.addEventListener("change", () => revisarSiTocado(input));
  paises = await llenarPaises(select);
}

function prepararValidacion() {
  prepararCampo($("registro-nombre"), valor => (valor.trim().length >= 2
    ? { ok: true, mensaje: "" }
    : { ok: false, mensaje: "Escribe tu nombre con al menos 2 letras." }));
  prepararCampo($("registro-usuario"), valor => revisarUsuario(valor));
  prepararCampo($("registro-correo"), revisarCorreo, { enVivo: revisarCorreoEnVivo });
  prepararTelefono($("registro-pais"), $("registro-telefono"));
  prepararPassword($("registro-password"), { minimo: MIN_PASSWORD_CLIENTE, confirmar: $("registro-confirmar") });

  prepararCampo($("completar-usuario"), valor => revisarUsuario(valor));
  prepararTelefono($("completar-pais"), $("completar-telefono"));

  prepararCampo($("restablecer-identificador"), valor => (valor.trim() ? { ok: true, mensaje: "" } : { ok: false, mensaje: "Escribe tu usuario o correo." }));
  prepararPassword($("nueva-password"), { minimo: MIN_PASSWORD_CLIENTE, confirmar: $("nueva-confirmar") });

  prepararCampo($("password-actual"), valor => (valor ? { ok: true, mensaje: "" } : { ok: false, mensaje: "Escribe tu contraseña actual." }));
  prepararPassword($("password-nueva"), { minimo: MIN_PASSWORD_CLIENTE, confirmar: $("password-confirmar") });
}

Object.assign(ACCIONES, {
  "codigo-volver": () => volverDelCodigo(),
  "codigo-reenviar": async el => {
    botonOcupado(el);
    try {
      const respuesta = await api("/clientes/codigo/reenviar", { method: "POST" });
      botonListo(el);
      campoCodigo.limpiar();
      esperarReenvio(respuesta.espera ?? 60);
      estadoCodigo("Te mandamos otro código. Usa el del último correo.");
      campoCodigo.enfocar();
    } catch (error) {
      botonListo(el);
      if (error.status === 410) {
        volverDelCodigo();
        showToast(error.message, "info");
      } else {
        estadoCodigo(error.message, "error");
      }
    }
  },
  "auth-cambiar": () => modoAuth(!$("cuenta-fuera").classList.contains("is-registro"), true),
  "ver-password": el => {
    const campo = $(el.getAttribute("aria-controls"));
    const ver = campo.type === "password";
    campo.type = ver ? "text" : "password";
    el.setAttribute("aria-label", ver ? "Ocultar contraseña" : "Mostrar contraseña");
    el.innerHTML = icon(ver ? "eye-off" : "eye");
  },
  salir: async () => {
    try {
      await api("/clientes/logout", { method: "POST" });
    } catch (e) { /* la sesión ya no existe */ }
    render(null);
    showToast("Sesión cerrada.");
  }
});

// Un enlace a #crear-cuenta desde esta misma página también abre el registro
window.addEventListener("hashchange", () => {
  if (!$("cuenta-dentro").hidden) return;
  if (location.hash === "#restablecer") abrirRestablecer();
  else if (!$("cuenta-fuera").hidden) modoAuth(location.hash === "#crear-cuenta", true);
});

document.addEventListener("DOMContentLoaded", async () => {
  prepararValidacion();
  campoCodigo = crearCampoCodigo($("codigo-campo"), { alCompletar: verificarCodigo });
  // Los mensajes de validación cambian el alto del formulario: la tarjeta lo sigue
  const observador = new ResizeObserver(() => ajustarAlto());
  observador.observe($("auth-entrar"));
  observador.observe($("auth-registro"));
  window.addEventListener("resize", ajustarAlto);
  $("form-codigo").addEventListener("submit", event => {
    event.preventDefault();
    verificarCodigo(campoCodigo.valor());
  });
  $("form-entrar").addEventListener("submit", event => enviarForm(event, {
    ruta: "/clientes/login", campos: ["identificador", "password"],
    listo: s => siguientePaso(s, `Sesión iniciada: ${s.nombre}`),
    alFallar: error => { if (error.status === 401) alarmaVentanas(); }
  }));
  $("form-registro").addEventListener("submit", event => enviarForm(event, {
    ruta: "/clientes/registro", campos: ["nombre", "usuario", "correo", "pais", "telefono", "password", "confirmar"],
    listo: s => siguientePaso(s, `Cuenta creada. Te damos la bienvenida, ${s.nombre}.`)
  }));
  $("form-restablecer").addEventListener("submit", event => enviarForm(event, {
    ruta: "/clientes/restablecer", campos: ["identificador"],
    listo: s => mostrarCodigo(s)
  }));
  $("form-nueva").addEventListener("submit", event => enviarForm(event, {
    ruta: "/clientes/restablecer/password", campos: ["nueva", "confirmar"],
    listo: s => entrar(s, "Contraseña cambiada. Ya entraste a tu cuenta.")
  }));
  $("form-completar").addEventListener("submit", event => enviarForm(event, {
    ruta: "/clientes/completar", metodo: "PUT", campos: ["usuario", "pais", "telefono"],
    listo: s => {
      render(s);
      showToast("Datos guardados.");
    }
  }));
  $("form-password").addEventListener("submit", event => enviarForm(event, {
    ruta: "/clientes/password", metodo: "PUT", campos: ["actual", "nueva", "confirmar"],
    listo: () => showToast("Contraseña cambiada.")
  }));
  try {
    render(await api("/clientes/sesion"));
  } catch (error) {
    render(null);
  }
});
