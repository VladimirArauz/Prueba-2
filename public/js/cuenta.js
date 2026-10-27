/**
 * NECUTLA — Cuenta de cliente: iniciar sesión (usuario o correo), crear cuenta, completar una cuenta
 * vieja, cambiar contraseña y cerrar sesión. La validación en vivo está en validacion.js.
 * ?volver=/p/12 regresa al producto después de entrar.
 */

const MIN_PASSWORD_CLIENTE = 10; // igual que server/clientes.js

const $ = id => document.getElementById(id);

// Solo rutas de este sitio ("/p/12"), nunca otra página ("//otro.com")
function destinoDeVuelta() {
  const volver = new URLSearchParams(location.search).get("volver") || "";
  return /^\/[a-z0-9/?=&_-]*$/i.test(volver) && !volver.startsWith("//") ? volver : "";
}

// Panel deslizante: muestra "Iniciar sesión" o "Crear cuenta"; el otro formulario queda inerte
function modoAuth(registro, enfocar = false) {
  $("cuenta-fuera").classList.toggle("is-registro", registro);
  $("auth-entrar").inert = registro;
  $("auth-registro").inert = !registro;
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
  $("cuenta-fuera").hidden = dentro;
  $("cuenta-dentro").hidden = !dentro;
  if (!dentro) {
    modoAuth(location.hash === "#crear-cuenta");
    return;
  }
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
async function enviarForm(event, { ruta, metodo = "POST", campos, listo }) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(await validarFormulario(form))) return;
  const boton = form.querySelector('[type="submit"]');
  const body = Object.fromEntries(campos.map(c => [c, form.elements[c].value]));
  boton.disabled = true;
  try {
    const respuesta = await api(ruta, { method: metodo, body });
    form.reset();
    reiniciarCampos(form);
    listo(respuesta);
  } catch (error) {
    showToast(error.message, "info");
  } finally {
    boton.disabled = false;
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

  prepararCampo($("password-actual"), valor => (valor ? { ok: true, mensaje: "" } : { ok: false, mensaje: "Escribe tu contraseña actual." }));
  prepararPassword($("password-nueva"), { minimo: MIN_PASSWORD_CLIENTE, confirmar: $("password-confirmar") });
}

Object.assign(ACCIONES, {
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
  if (!$("cuenta-fuera").hidden) modoAuth(location.hash === "#crear-cuenta", true);
});

document.addEventListener("DOMContentLoaded", async () => {
  prepararValidacion();
  $("form-entrar").addEventListener("submit", event => enviarForm(event, {
    ruta: "/clientes/login", campos: ["identificador", "password"],
    listo: s => entrar(s, `Sesión iniciada: ${s.nombre}`)
  }));
  $("form-registro").addEventListener("submit", event => enviarForm(event, {
    ruta: "/clientes/registro", campos: ["nombre", "usuario", "correo", "pais", "telefono", "password", "confirmar"],
    listo: s => entrar(s, `Cuenta creada. Te damos la bienvenida, ${s.nombre}.`)
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
