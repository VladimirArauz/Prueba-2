/**
 * NECUTLA — Validación en vivo de formularios (registro, contraseñas, correo, teléfono).
 * Debajo de cada campo aparece qué le falta (rojo) o que ya está bien (verde --wa, excepción
 * autorizada por el usuario solo para este estado). El servidor vuelve a revisar todo.
 *
 * - El primer aviso sale al salir del campo; desde ahí se actualiza con cada tecla.
 * - prepararCampo(input, revisar): revisar(valor) devuelve { ok, mensaje, sugerencia? } o una promesa.
 * - validarFormulario(form): revisa todos los campos preparados y enfoca el primero que esté mal.
 */

// ================= Reglas de contraseña =================
// Mismas reglas y mismo orden que server/contrasenas.js (TIPOS)
const REGLAS_TIPOS = [
  [/\p{Ll}/u, "Una minúscula"],
  [/\p{Lu}/u, "Una mayúscula"],
  [/\p{Nd}/u, "Un número"],
  [/[^\p{L}\p{N}\s]/u, "Un carácter especial (! # $ % & * ?)"]
];
const NIVELES = ["", "Débil", "Media", "Fuerte", "Súper segura"];
const SECUENCIAS = ["0123456789", "abcdefghijklmnopqrstuvwxyz", "qwertyuiop", "asdfghjkl", "zxcvbnm"];

// 4 letras seguidas de una secuencia (1234, abcd, qwer) o el mismo carácter 3 veces
function tienePatron(valor) {
  const minus = valor.toLowerCase();
  if (/(.)\1\1/.test(minus)) return true;
  return SECUENCIAS.some(sec => {
    for (let i = 0; i + 4 <= sec.length; i++) {
      const trozo = sec.slice(i, i + 4);
      if (minus.includes(trozo) || minus.includes([...trozo].reverse().join(""))) return true;
    }
    return false;
  });
}

const bytesUtf8 = valor => new TextEncoder().encode(valor).length;

// nivel: 0 vacío, 1 débil (no cumple), 2 media, 3 fuerte (12+), 4 súper segura (16+ sin patrones)
function evaluarPassword(valor, minimo) {
  const reglas = [[valor.length >= minimo, `${minimo} caracteres o más`],
    ...REGLAS_TIPOS.map(([regla, texto]) => [regla.test(valor), texto])];
  const cumple = reglas.every(([ok]) => ok) && bytesUtf8(valor) <= 72;
  let nivel = 0;
  if (valor) nivel = 1;
  if (cumple) nivel = 2;
  if (cumple && valor.length >= 12) nivel = 3;
  if (cumple && valor.length >= 16 && !tienePatron(valor)) nivel = 4;
  return { reglas, cumple, nivel };
}

// ================= Correo y teléfono =================
// Mismo formato que server/validar.js (FORMATO_CORREO)
const FORMATO_CORREO = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

function formatoCorreo(valor) {
  const correo = valor.trim().toLowerCase();
  if (!correo) return { ok: false, mensaje: "Escribe tu correo." };
  if (!FORMATO_CORREO.test(correo) || correo.includes("..")) {
    return { ok: false, mensaje: "Escribe un correo válido, ej. nombre@gmail.com." };
  }
  return { ok: true };
}

// El dominio se revisa en el servidor (¿recibe correos?, ¿error de dedo?) solo al salir del campo y al
// enviar; mientras se escribe, solo el formato (la escuela comparte IP y el límite es por IP).
// Se guarda la respuesta por correo.
const correosRevisados = new Map();
async function revisarCorreo(valor) {
  const formato = formatoCorreo(valor);
  if (!formato.ok) return formato;
  const correo = valor.trim().toLowerCase();
  if (!correosRevisados.has(correo)) {
    try {
      const { sugerencia } = await api("/clientes/revisar-correo", { method: "POST", body: { correo } });
      // Dominio real pero parecido a uno popular (ymail.com, hotmail.fr): vale, solo se sugiere
      correosRevisados.set(correo, sugerencia
        ? { ok: true, aviso: true, mensaje: `¿Quisiste decir ${sugerencia}? Si tu correo está bien, déjalo así.`, sugerencia }
        : { ok: true, mensaje: "Correo válido." });
    } catch (error) {
      // Sin conexión o límite alcanzado: no se marca como error, el servidor lo revisa al enviar
      if (error.status !== 400) return { ok: true, mensaje: "" };
      correosRevisados.set(correo, { ok: false, mensaje: error.message, sugerencia: error.datos && error.datos.sugerencia });
    }
  }
  return correosRevisados.get(correo);
}

// Mientras se escribe: si ya se revisó ese correo se usa la respuesta guardada; si no, solo el formato
function revisarCorreoEnVivo(valor) {
  const formato = formatoCorreo(valor);
  if (!formato.ok) return formato;
  // Sin revisar todavía: ni rojo ni verde hasta salir del campo
  return correosRevisados.get(valor.trim().toLowerCase()) || { ok: null, mensaje: "" };
}

let paisesListos = null;
function cargarPaises() {
  if (!paisesListos) {
    paisesListos = fetch("/datos/paises.json", { credentials: "same-origin" })
      .then(r => (r.ok ? r.json() : []))
      .catch(() => []);
  }
  return paisesListos;
}

// México: lo que vale mientras carga la lista (y si no carga, la opción que ya trae el HTML)
const MEXICO = { iso: "MX", nombre: "México", lada: "52", largos: [10] };

// Llena un <select> con "México (+52)"…; México queda elegido. Si la lista no carga, se queda México.
async function llenarPaises(select) {
  const paises = await cargarPaises();
  if (!paises.length) return [MEXICO];
  select.innerHTML = paises.map(p =>
    `<option value="${escapeHTML(p.iso)}">${escapeHTML(p.nombre)} (+${escapeHTML(p.lada)})</option>`).join("");
  select.value = "MX";
  return paises;
}

function revisarTelefono(valor, pais) {
  const digitos = valor.replace(/\D/g, "");
  if (!digitos) return { ok: false, mensaje: "Escribe tu número de teléfono." };
  if (!pais) return { ok: false, mensaje: "Elige el país de tu teléfono." };
  if (pais.largos.includes(digitos.length)) return { ok: true, mensaje: "Número válido." };
  const maximo = Math.max(...pais.largos);
  const minimo = Math.min(...pais.largos);
  if (digitos.length < minimo) {
    const faltan = minimo - digitos.length;
    return { ok: false, mensaje: `Faltan ${faltan} ${faltan === 1 ? "dígito" : "dígitos"} (${pais.nombre}: ${pais.largos.join(" o ")}, sin la lada).` };
  }
  if (digitos.length > maximo) {
    return { ok: false, mensaje: `Sobran dígitos: un teléfono de ${pais.nombre} tiene ${pais.largos.join(" o ")} (sin la lada +${pais.lada}).` };
  }
  return { ok: false, mensaje: `Un teléfono de ${pais.nombre} tiene ${pais.largos.join(" o ")} dígitos.` };
}

// Mismo formato que server/validar.js (usuarioValido)
function revisarUsuario(valor, max = 30) {
  const usuario = valor.trim().toLowerCase();
  if (!usuario) return { ok: false, mensaje: "Escribe un nombre de usuario." };
  if (usuario.includes("@")) return { ok: false, mensaje: "El nombre de usuario no lleva @ (eso es del correo)." };
  if (/\s/.test(usuario)) return { ok: false, mensaje: "Sin espacios: usa punto, guion o guion bajo (ej. ana.g)." };
  if (/[^a-z0-9._-]/.test(usuario)) return { ok: false, mensaje: "Solo letras sin acentos, números, punto, guion o guion bajo." };
  if (usuario.length < 3) return { ok: false, mensaje: "Usa al menos 3 caracteres." };
  if (usuario.length > max) return { ok: false, mensaje: `Usa hasta ${max} caracteres.` };
  return { ok: true, mensaje: "Nombre de usuario válido." };
}

// ================= Campos =================
const CAMPOS = new WeakMap(); // input → { revisar, tocado, version, revisado (último valor revisado) }

function estadoDe(input) {
  const grupo = input.closest(".form-group");
  let estado = grupo.querySelector(":scope > .campo-estado");
  if (!estado) {
    estado = document.createElement("p");
    estado.className = "campo-estado";
    estado.id = `${input.id}-estado`;
    estado.setAttribute("aria-live", "polite");
    const despues = grupo.querySelector(":scope > .medidor-bloque") || input.closest(".campo-telefono") || input.closest(".campo-icono") || input;
    despues.after(estado);
    const ids = new Set((input.getAttribute("aria-describedby") || "").split(" ").filter(Boolean));
    ids.add(estado.id);
    input.setAttribute("aria-describedby", [...ids].join(" "));
  }
  return { grupo, estado };
}

function pintar(input, resultado) {
  const { grupo, estado } = estadoDe(input);
  grupo.classList.toggle("is-valido", resultado.ok === true && !resultado.aviso);
  grupo.classList.toggle("is-invalido", resultado.ok === false);
  input.setAttribute("aria-invalid", resultado.ok === false ? "true" : "false");
  estado.innerHTML = "";
  if (resultado.pendiente) {
    estado.textContent = "Revisando…";
    return;
  }
  if (!resultado.mensaje) return;
  estado.insertAdjacentHTML("beforeend", icon(resultado.aviso ? "info" : resultado.ok ? "circle-check" : "circle-alert"));
  estado.append(document.createTextNode(resultado.mensaje));
  if (resultado.sugerencia) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "btn ghost btn-sm campo-sugerencia";
    boton.textContent = `Usar ${resultado.sugerencia}`;
    boton.addEventListener("click", () => {
      input.value = resultado.sugerencia;
      revisarCampo(input);
      input.focus();
    });
    estado.append(boton);
  }
}

function limpiar(input) {
  const grupo = input.closest(".form-group");
  grupo.classList.remove("is-valido", "is-invalido");
  input.removeAttribute("aria-invalid");
  const estado = grupo.querySelector(":scope > .campo-estado");
  if (estado) estado.innerHTML = "";
}

// Corre la revisión del campo y la pinta. Devuelve true si quedó bien.
async function revisarCampo(input) {
  const datos = CAMPOS.get(input);
  if (!datos) return true;
  datos.tocado = true;
  datos.version += 1;
  datos.revisado = input.value;
  const version = datos.version;
  const respuesta = datos.revisar(input.value);
  if (respuesta && typeof respuesta.then === "function") {
    pintar(input, { pendiente: true });
    const final = await respuesta;
    if (version === datos.version) pintar(input, final); // solo la última respuesta cuenta
    return final.ok;
  }
  pintar(input, respuesta);
  return respuesta.ok;
}

// enVivo: revisión más ligera para cada tecla (ej. el correo solo revisa el formato mientras se escribe)
function prepararCampo(input, revisar, { espera = 0, enVivo = null } = {}) {
  CAMPOS.set(input, { revisar, tocado: false, version: 0, revisado: null });
  let temporizador;
  // Si el valor no cambió desde la última revisión, no se repinta (así no desaparece el botón "Usar …" al tocarlo).
  // Si el foco va al botón de enviar, tampoco: el mensaje movería el botón y el clic se perdería; al enviar se revisa todo.
  input.addEventListener("blur", event => {
    const datos = CAMPOS.get(input);
    if (datos.tocado && datos.revisado === input.value) return;
    const destino = event.relatedTarget;
    if (destino && destino.type === "submit" && destino.form === input.form) return;
    clearTimeout(temporizador);
    if (input.value || datos.tocado) revisarCampo(input);
  });
  input.addEventListener("input", () => {
    if (!CAMPOS.get(input).tocado) return;
    clearTimeout(temporizador);
    if (enVivo) {
      const datos = CAMPOS.get(input);
      datos.version += 1; // descarta una revisión del servidor que llegue tarde
      datos.revisado = null;
      pintar(input, enVivo(input.value));
    } else if (espera) temporizador = setTimeout(() => revisarCampo(input), espera);
    else revisarCampo(input);
  });
}

// Revisa otra vez un campo que depende de otro (país → teléfono, contraseña → confirmación)
function revisarSiTocado(input) {
  const datos = CAMPOS.get(input);
  if (datos && datos.tocado) revisarCampo(input);
}

// ================= Medidor de contraseña =================
// opcional(): true cuando dejarla vacía es válido (ej. editar un usuario sin cambiarle la contraseña)
function prepararPassword(input, { minimo, confirmar, opcional = () => false }) {
  const grupo = input.closest(".form-group");
  const bloque = document.createElement("div");
  bloque.className = "medidor-bloque";
  bloque.innerHTML = `
    <div class="medidor" role="meter" aria-label="Seguridad de la contraseña" aria-valuemin="0" aria-valuemax="4" aria-valuenow="0" data-nivel="0">
      <span></span><span></span><span></span><span></span>
    </div>
    <p class="medidor-texto" aria-live="polite"></p>
    <ul class="reglas-password" aria-label="Lo que necesita la contraseña"></ul>`;
  (input.closest(".campo-icono") || input).after(bloque);
  const medidor = bloque.querySelector(".medidor");
  const texto = bloque.querySelector(".medidor-texto");
  const lista = bloque.querySelector(".reglas-password");
  lista.id = `${input.id}-reglas`;
  input.setAttribute("aria-describedby", lista.id);

  const actualizar = () => {
    const { reglas, nivel } = evaluarPassword(input.value, minimo);
    medidor.dataset.nivel = nivel;
    medidor.setAttribute("aria-valuenow", nivel);
    medidor.setAttribute("aria-valuetext", NIVELES[nivel] || "Vacía");
    texto.textContent = nivel ? `Seguridad: ${NIVELES[nivel]}` : "";
    lista.innerHTML = reglas.map(([ok, regla]) =>
      `<li class="${ok ? "is-ok" : ""}">${icon(ok ? "check" : "x")}<span>${escapeHTML(regla)}</span><span class="visually-hidden">${ok ? ": listo" : ": falta"}</span></li>`).join("");
  };
  actualizar();
  input.addEventListener("input", () => {
    actualizar();
    if (confirmar) revisarSiTocado(confirmar);
  });
  grupo.dataset.medidor = "1";

  prepararCampo(input, valor => {
    const { reglas, cumple } = evaluarPassword(valor, minimo);
    if (!valor && opcional()) return { ok: true, mensaje: "" };
    if (!valor) return { ok: false, mensaje: "Escribe una contraseña." };
    if (bytesUtf8(valor) > 72) return { ok: false, mensaje: "Es demasiado larga: usa hasta 72 letras (menos si llevan acentos)." };
    if (!cumple) {
      const faltan = reglas.filter(([ok]) => !ok).map(([, regla]) => regla.toLowerCase());
      return { ok: false, mensaje: `Le falta: ${faltan.join(", ")}.` };
    }
    return { ok: true, mensaje: "La contraseña cumple con todo." };
  });

  if (confirmar) {
    prepararCampo(confirmar, valor => {
      if (!valor && !input.value && opcional()) return { ok: true, mensaje: "" };
      if (!valor) return { ok: false, mensaje: "Escribe otra vez la contraseña." };
      return valor === input.value
        ? { ok: true, mensaje: "Las contraseñas coinciden." }
        : { ok: false, mensaje: "Las contraseñas no coinciden." };
    });
  }
  // Después de enviar el formulario (reset) el medidor vuelve a cero
  input.form.addEventListener("reset", () => setTimeout(() => {
    actualizar();
    for (const campo of [input, confirmar].filter(Boolean)) limpiar(campo);
  }));
}

// ================= Formulario =================
// Revisa todos los campos preparados del formulario; si alguno está mal, lo enfoca y devuelve false
async function validarFormulario(form) {
  const campos = [...form.elements].filter(el => CAMPOS.has(el) && !el.disabled && !el.closest("[hidden]"));
  const resultados = await Promise.all(campos.map(revisarCampo));
  const primero = campos.find((_, i) => !resultados[i]);
  if (primero) {
    primero.focus();
    return false;
  }
  return true;
}

// Después de un reset, los campos vuelven a "no tocados"
function reiniciarCampos(form) {
  for (const el of form.elements) {
    const datos = CAMPOS.get(el);
    if (!datos) continue;
    datos.tocado = false;
    datos.version += 1;
    datos.revisado = null;
    limpiar(el);
  }
}
