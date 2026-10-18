/**
 * NECUTLA — Funciones compartidas por todas las páginas:
 * API, formato, avisos, carrito (localStorage), WhatsApp y eventos delegados.
 * El carrito solo guarda {tipo, id, cantidad}: nombres y precios siempre los da el servidor.
 */

const CARRITO_KEY = "necutla_carrito";
const CARRITOS_VIEJOS = ["necutla_carrito_global", "carrito_ropa", "carrito_tecnologia", "carrito_dulces",
  "carrito_propaganda", "carrito_papeleria", "carrito_regalos", "carrito_otra"];
const MAX_CANTIDAD = 99;

// ================= API =================
async function api(path, { method = "GET", body } = {}) {
  const options = { method, headers: {}, credentials: "same-origin" };
  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(`/api${path}`, options);
  } catch (e) {
    throw new Error("No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.");
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "No se pudo completar la acción. Intenta de nuevo.");
    error.status = response.status;
    throw error;
  }
  return data;
}

// ================= Formato =================
function money(amount) {
  return "$" + Number(amount).toFixed(2) + " MXN";
}

function escapeHTML(str) {
  return String(str ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}

// "$150.00 MXN", "Desde $150.00 MXN" o "Cotiza tu precio"
function textoPrecio(item) {
  if (item.precio_modo === "cotizar" || item.precio === null) return "Cotiza tu precio";
  return (item.precio_modo === "desde" ? "Desde " : "") + money(item.precio);
}

function imagenDe(item) {
  return item.imagen_url || "/imagenes/producto.svg";
}

// ================= Aviso flotante (toast) =================
function showToast(message, iconName = "check") {
  let toast = document.getElementById("app-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "app-toast";
    toast.className = "toast-notice";
    toast.setAttribute("role", "status");
    document.body.appendChild(toast);
  }
  toast.innerHTML = `${icon(iconName)}<span>${escapeHTML(message)}</span>`;
  toast.classList.add("show");
  clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => toast.classList.remove("show"), 3200);
}

// ================= Carrito =================
function leerCarrito() {
  try {
    const items = JSON.parse(localStorage.getItem(CARRITO_KEY));
    if (!Array.isArray(items)) return [];
    return items.filter(i => i && (i.tipo === "producto" || i.tipo === "paquete")
      && Number.isInteger(i.id) && Number.isInteger(i.cantidad) && i.cantidad > 0);
  } catch (e) {
    return [];
  }
}

function guardarCarrito(items) {
  try {
    localStorage.setItem(CARRITO_KEY, JSON.stringify(items));
  } catch (e) { /* almacenamiento no disponible */ }
  actualizarContador(true);
}

function agregarAlCarrito(tipo, id, nombre) {
  const items = leerCarrito();
  const existente = items.find(i => i.tipo === tipo && i.id === id);
  if (existente) existente.cantidad = Math.min(MAX_CANTIDAD, existente.cantidad + 1);
  else items.push({ tipo, id, cantidad: 1 });
  guardarCarrito(items);
  showToast(`Agregado al carrito: ${nombre}`);
}

function cambiarCantidad(tipo, id, delta) {
  const items = leerCarrito();
  const item = items.find(i => i.tipo === tipo && i.id === id);
  if (!item) return;
  item.cantidad = Math.min(MAX_CANTIDAD, item.cantidad + delta);
  guardarCarrito(items.filter(i => i.cantidad > 0));
}

function quitarDelCarrito(claves) {
  const quitar = new Set(claves);
  guardarCarrito(leerCarrito().filter(i => !quitar.has(`${i.tipo}-${i.id}`)));
}

function actualizarContador(pulso = false) {
  const total = leerCarrito().reduce((suma, i) => suma + i.cantidad, 0);
  document.querySelectorAll(".cart-count").forEach(el => { el.textContent = total; });
  if (!pulso) return;
  document.querySelectorAll(".cart-pill").forEach(pill => {
    pill.classList.remove("pulse");
    void pill.offsetWidth;
    pill.classList.add("pulse");
  });
}

// Los carritos de antes guardaban nombre y precio sin id: no se pueden convertir con seguridad
function migrarCarritoViejo() {
  let teniaProductos = false;
  try {
    for (const key of CARRITOS_VIEJOS) {
      const viejo = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(viejo) && viejo.length) teniaProductos = true;
      localStorage.removeItem(key);
    }
  } catch (e) { /* almacenamiento no disponible */ }
  if (teniaProductos) {
    setTimeout(() => showToast("Actualizamos el carrito. Vuelve a agregar los productos que tenías.", "info"), 400);
  }
}

// ================= WhatsApp =================
function enlaceWhatsApp(numero, mensaje) {
  return `https://wa.me/${String(numero).replace(/\D/g, "")}?text=${encodeURIComponent(mensaje)}`;
}

// Abre el chat con el primer número. Si hay más vendedores, deja botones para escribirles también
// (abrir varias ventanas seguidas lo bloquea el navegador).
function abrirWhatsApp(numeros, mensaje, contenedor) {
  if (!numeros.length) {
    alert("Esta tienda todavía no tiene números de WhatsApp. Intenta más tarde.");
    return false;
  }
  window.open(enlaceWhatsApp(numeros[0], mensaje), "_blank", "noopener");
  if (contenedor) {
    contenedor.innerHTML = numeros.length > 1 ? `
      <div class="notice success">
        ${icon("check")}
        <div>
          <span>Se abrió el chat con el vendedor 1. Pulsa "Enviar" en WhatsApp. También puedes escribirle a:</span>
          <div class="wa-more">
            ${numeros.slice(1).map((n, i) => `<a class="btn wa btn-sm" href="${escapeHTML(enlaceWhatsApp(n, mensaje))}" target="_blank" rel="noopener">${icon("message-circle")}Vendedor ${i + 2}</a>`).join("")}
          </div>
        </div>
      </div>` : `
      <div class="notice success">${icon("check")}<span>Se abrió WhatsApp con tu mensaje. Solo pulsa "Enviar".</span></div>`;
  }
  return true;
}

// ================= Tarjetas de producto y servicio =================
// opciones.conTienda: muestra la tienda (búsqueda); los servicios llevan a su tienda
function tarjetaProducto(p, opciones = {}) {
  const esServicio = p.tipo === "servicio";
  const oferta = p.oferta;
  const etiquetas = [
    oferta ? `<span class="tag-oferta">${icon("tag")}${escapeHTML(oferta.titulo)}</span>` : "",
    p.disponibilidad && p.disponibilidad !== "Disponible" ? `<span class="status-badge">${escapeHTML(p.disponibilidad)}</span>` : ""
  ].join("");
  const precio = oferta && oferta.precio_oferta !== null
    ? `<div class="price-row"><span class="price">${money(oferta.precio_oferta)}</span><s class="price-old">${money(p.precio)}</s></div>`
    : `<div class="price">${escapeHTML(textoPrecio(p))}</div>`;

  let accion;
  if (esServicio && opciones.conTienda) {
    accion = `<a class="btn secondary" href="/t/${escapeHTML(p.slug)}?tab=servicios">${icon("store")}Ver en ${escapeHTML(p.tienda)}</a>`;
  } else if (esServicio) {
    accion = `<button type="button" class="btn wa" data-action="pedir-servicio" data-id="${Number(p.id)}">${icon("message-circle")}Pedir información por WhatsApp</button>`;
  } else {
    accion = `<button type="button" class="btn" data-action="agregar" data-tipo="producto" data-id="${Number(p.id)}" data-nombre="${escapeHTML(p.nombre)}">${icon("shopping-cart")}Agregar al carrito</button>`;
  }

  return `
    <article class="card">
      <div class="card-img-wrap"><img src="${escapeHTML(imagenDe(p))}" alt="${escapeHTML(p.nombre)}" loading="lazy"></div>
      ${opciones.conTienda ? `<a class="card-sub" href="/t/${escapeHTML(p.slug)}">${escapeHTML(p.tienda)}</a>` : ""}
      <h3>${escapeHTML(p.nombre)}</h3>
      ${etiquetas ? `<div class="card-tags">${etiquetas}</div>` : ""}
      <p>${escapeHTML(p.descripcion)}</p>
      ${precio}
      ${accion}
      <div data-wa-for="${Number(p.id)}"></div>
    </article>`;
}

// ================= Promociones de temporada (paquetes) =================
function fechaCorta(iso) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-MX", { day: "numeric", month: "long", timeZone: "UTC" });
}

function tarjetaPromocion(promo) {
  const vigencia = promo.inicio === promo.fin ? `Solo el ${fechaCorta(promo.fin)}` : `Hasta el ${fechaCorta(promo.fin)}`;
  return `
    <article class="letrero-item">
      ${promo.imagen_url ? `<div class="letrero-img"><img src="${escapeHTML(promo.imagen_url)}" alt="${escapeHTML(promo.titulo)}" loading="lazy"></div>` : ""}
      <h3>${escapeHTML(promo.titulo)}</h3>
      ${promo.descripcion ? `<p>${escapeHTML(promo.descripcion)}</p>` : ""}
      <ul>
        ${promo.incluye.map(i => `<li>${i.cantidad} × ${escapeHTML(i.nombre)} <span class="letrero-dates">(${escapeHTML(i.tienda)})</span></li>`).join("")}
      </ul>
      <div class="price-row">
        <span class="price">${money(promo.precio)}</span>
        ${promo.precio_normal ? `<s class="price-old">${money(promo.precio_normal)}</s>` : ""}
      </div>
      <div class="letrero-dates">${escapeHTML(vigencia)}</div>
      <button type="button" class="btn" data-action="agregar" data-tipo="paquete" data-id="${Number(promo.id)}" data-nombre="${escapeHTML(promo.titulo)}">
        ${icon("shopping-cart")}Agregar paquete al carrito
      </button>
    </article>`;
}

// ================= Eventos (delegados, sin onclick en el HTML) =================
const ACCIONES = {
  agregar: el => agregarAlCarrito(el.dataset.tipo, Number(el.dataset.id), el.dataset.nombre)
};

document.addEventListener("click", event => {
  const el = event.target.closest("[data-action]");
  if (el && ACCIONES[el.dataset.action]) ACCIONES[el.dataset.action](el, event);
});

// ================= Tiendas (una sola petición por página) =================
let tiendasPromesa = null;
function obtenerTiendas() {
  tiendasPromesa = tiendasPromesa || api("/stands").catch(err => { tiendasPromesa = null; throw err; });
  return tiendasPromesa;
}

// ================= Pie de página: lista de tiendas =================
async function cargarTiendasPie() {
  const lista = document.getElementById("footer-stores");
  if (!lista) return;
  try {
    const tiendas = await obtenerTiendas();
    lista.innerHTML = tiendas.map(t => `<li><a href="/t/${escapeHTML(t.slug)}">${escapeHTML(t.nombre)}</a></li>`).join("");
  } catch (e) { /* el pie se queda sin la lista */ }
}

document.addEventListener("DOMContentLoaded", () => {
  migrarCarritoViejo();
  actualizarContador();
  cargarTiendasPie();
});
