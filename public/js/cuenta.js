/**
 * NECUTLA — Cuenta de cliente: iniciar sesión, crear cuenta y cerrar sesión.
 * ?volver=/p/12 regresa al producto después de entrar.
 */

const $ = id => document.getElementById(id);

// Solo rutas de este sitio ("/p/12"), nunca otra página ("//otro.com")
function destinoDeVuelta() {
  const volver = new URLSearchParams(location.search).get("volver") || "";
  return /^\/[a-z0-9/?=&_-]*$/i.test(volver) && !volver.startsWith("//") ? volver : "";
}

function render(sesion) {
  const dentro = Boolean(sesion && sesion.autenticado);
  $("cuenta-fuera").hidden = dentro;
  $("cuenta-dentro").hidden = !dentro;
  if (!dentro) return;
  $("dentro-title").textContent = `Hola, ${sesion.nombre}`;
  $("dentro-correo").textContent = `Entraste con ${sesion.correo}.`;
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

async function enviarForm(event, ruta, campos, mensaje) {
  event.preventDefault();
  const form = event.currentTarget;
  const boton = form.querySelector('[type="submit"]');
  const body = Object.fromEntries(campos.map(c => [c, form.elements[c].value]));
  boton.disabled = true;
  try {
    const sesion = await api(ruta, { method: "POST", body });
    form.reset();
    entrar(sesion, mensaje(sesion));
  } catch (error) {
    showToast(error.message, "info");
  } finally {
    boton.disabled = false;
  }
}

Object.assign(ACCIONES, {
  salir: async () => {
    try {
      await api("/clientes/logout", { method: "POST" });
    } catch (e) { /* la sesión ya no existe */ }
    render(null);
    showToast("Sesión cerrada.");
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  $("form-entrar").addEventListener("submit", event =>
    enviarForm(event, "/clientes/login", ["correo", "password"], s => `Sesión iniciada: ${s.nombre}`));
  $("form-registro").addEventListener("submit", event =>
    enviarForm(event, "/clientes/registro", ["nombre", "correo", "password"], s => `Cuenta creada. Te damos la bienvenida, ${s.nombre}.`));
  try {
    render(await api("/clientes/sesion"));
  } catch (error) {
    render(null);
  }
});
