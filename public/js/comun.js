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
  document.querySelectorAll(".cart-count").forEach(el => {
    el.textContent = total;
    el.classList.toggle("is-cero", total === 0);
  });
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

// ================= Calificaciones =================
// Estrellas rellenas según el promedio redondeado. Sin opiniones, un texto corto.
function estrellas(promedio, total) {
  if (!total) return `<div class="rating rating-none">Sin opiniones todavía</div>`;
  const llenas = Math.round(promedio);
  const iconos = [1, 2, 3, 4, 5].map(i => (i <= llenas ? icon("star-fill", "star is-on") : icon("star", "star"))).join("");
  const texto = `${Number(promedio).toFixed(1)} de 5 estrellas, ${total} ${total === 1 ? "opinión" : "opiniones"}`;
  return `<div class="rating" role="img" aria-label="${texto}">${iconos}<span>${Number(promedio).toFixed(1)} (${total})</span></div>`;
}

// ================= Ofertas en tarjetas =================
const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function fechaCorta(iso) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-MX", { day: "numeric", month: "long", timeZone: "UTC" });
}

// "Temporada de Navidad · Hasta el 25 de diciembre", "Remate · Quedan 3 piezas"
function detalleOferta(oferta) {
  const partes = [];
  if (oferta.clase === "temporada") partes.push(`Temporada de ${oferta.temporada}`);
  if (oferta.clase === "remate") partes.push("Remate");
  if (oferta.piezas) partes.push(oferta.piezas === 1 ? "Queda 1 pieza" : `Quedan ${oferta.piezas} piezas`);
  if (oferta.fin) partes.push(`Hasta el ${fechaCorta(oferta.fin)}`);
  return partes.join(" · ");
}

// ================= Tarjetas de producto y servicio =================
// Partes que comparten la tarjeta y la página del producto
function etiquetasProducto(p) {
  const oferta = p.oferta;
  return [
    oferta ? `<span class="tag-oferta${oferta.clase === "remate" ? " is-remate" : ""}">${icon("tag")}${escapeHTML(oferta.titulo)}</span>` : "",
    p.disponibilidad && p.disponibilidad !== "Disponible" ? `<span class="status-badge">${escapeHTML(p.disponibilidad)}</span>` : ""
  ].join("");
}

function precioProducto(p) {
  const oferta = p.oferta;
  if (!oferta || oferta.precio_oferta === null) return `<div class="price">${escapeHTML(textoPrecio(p))}</div>`;
  return `<div class="price-row"><span class="price">${money(oferta.precio_oferta)}</span><s class="price-old">${money(p.precio)}</s>${oferta.descuento ? `<span class="price-off">Ahorras ${oferta.descuento}%</span>` : ""}</div>`;
}

// opciones.conTienda: en búsqueda y vitrina los servicios llevan a su tienda
function accionProducto(p, opciones = {}) {
  if (p.tipo === "servicio" && opciones.conTienda) {
    return `<a class="btn secondary" href="/t/${escapeHTML(p.slug)}?tab=servicios">${icon("store")}Ver en ${escapeHTML(p.tienda)}</a>`;
  }
  if (p.tipo === "servicio") {
    return `<button type="button" class="btn wa" data-action="pedir-servicio" data-id="${Number(p.id)}">${icon("message-circle")}Pedir información por WhatsApp</button>`;
  }
  return `<button type="button" class="btn" data-action="agregar" data-tipo="producto" data-id="${Number(p.id)}" data-nombre="${escapeHTML(p.nombre)}">${icon("shopping-cart")}Agregar al carrito</button>`;
}

// opciones.conTienda: muestra la tienda (búsqueda y vitrina)
function tarjetaProducto(p, opciones = {}) {
  const enlace = `/p/${Number(p.id)}`;
  const etiquetas = etiquetasProducto(p);
  const detalle = p.oferta ? detalleOferta(p.oferta) : "";
  return `
    <article class="card">
      <a class="card-img-wrap" href="${enlace}" tabindex="-1" aria-hidden="true"><img src="${escapeHTML(imagenDe(p))}" alt="" loading="lazy"></a>
      ${opciones.conTienda ? `<a class="card-sub" href="/t/${escapeHTML(p.slug)}">${escapeHTML(p.tienda)}</a>` : ""}
      <h3><a class="card-link" href="${enlace}">${escapeHTML(p.nombre)}</a></h3>
      ${estrellas(p.calificacion, p.resenas)}
      ${etiquetas ? `<div class="card-tags">${etiquetas}</div>` : ""}
      ${detalle ? `<div class="offer-detail">${escapeHTML(detalle)}</div>` : ""}
      <p>${escapeHTML(p.descripcion)}</p>
      ${precioProducto(p)}
      ${accionProducto(p, opciones)}
      <div data-wa-for="${Number(p.id)}"></div>
    </article>`;
}

// ================= Vitrina de ofertas (final de la portada y de cada tienda) =================
const VITRINA_INICIAL = 6;

function textosBloque(bloque, dia, deTienda) {
  if (bloque.clase === "temporada") {
    return {
      titulo: `Temporada de ${bloque.temporada}`,
      desc: deTienda ? "Descuentos de temporada en esta tienda, por tiempo limitado." : "Descuentos de temporada en las tiendas de Necutla, por tiempo limitado."
    };
  }
  if (bloque.clase === "semanal") {
    return { titulo: `Ofertas de este ${DIAS_SEMANA[dia]}`, desc: "Ofertas que se repiten cada semana y hoy sí aplican." };
  }
  return { titulo: "Remates", desc: "Liquidación de piezas: se venden hasta que se acaben." };
}

function bloqueVitrina(bloque, i, dia, deTienda) {
  const { titulo, desc } = textosBloque(bloque, dia, deTienda);
  const tarjetas = bloque.productos.map((p, j) => tarjetaProducto(p, { conTienda: !deTienda })
    .replace('<article class="card">', `<article class="card"${j >= VITRINA_INICIAL ? " hidden" : ""}>`)).join("");
  const ocultas = bloque.productos.length - VITRINA_INICIAL;
  return `
    <section class="vitrina-bloque" aria-labelledby="vitrina-${i}">
      <div class="vitrina-head">
        <h3 id="vitrina-${i}">${escapeHTML(titulo)}</h3>
        <p>${escapeHTML(desc)}</p>
      </div>
      <div class="grid">${tarjetas}</div>
      ${ocultas > 0 ? `
        <div class="list-more">
          <button type="button" class="btn secondary" data-action="vitrina-mas">${icon("chevron-down")}Mostrar ${ocultas} más</button>
        </div>` : ""}
    </section>`;
}

// Llena la sección #vitrina; si no hay ofertas vigentes, se queda oculta
async function cargarVitrina(slugTienda = "") {
  const seccion = document.getElementById("vitrina");
  if (!seccion) return;
  try {
    const { dia, bloques } = await api(`/vitrina${slugTienda ? `?tienda=${encodeURIComponent(slugTienda)}` : ""}`);
    if (!bloques.length) return;
    document.getElementById("vitrina-bloques").innerHTML = bloques.map((b, i) => bloqueVitrina(b, i, dia, Boolean(slugTienda))).join("");
    seccion.hidden = false;
  } catch (e) { /* sin vitrina, la página sigue igual */ }
}

// ================= Promociones de temporada (paquetes) =================
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
  agregar: el => agregarAlCarrito(el.dataset.tipo, Number(el.dataset.id), el.dataset.nombre),
  "vitrina-mas": el => {
    const bloque = el.closest(".vitrina-bloque");
    bloque.querySelectorAll(".card[hidden]").forEach(card => { card.hidden = false; });
    el.closest(".list-more").remove();
  }
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

// ================= Entradas al bajar (plan 2026-10-20) =================
// Sin JS o con movimiento reducido no se oculta nada: la clase .anim solo se pone aquí.
const BLOQUES_REVELAR = ".page-head, .section-header-row, .hero-copy, .board, .letrero-head, .vitrina-head, "
  + ".search-form, .filters, .store-meta, .admin-card, .cart-items-card, .cart-summary-card, .cart-group, "
  + ".producto-detalle, .opiniones-resumen, .auth, .footer-grid";
const GRIDS_REVELAR = ".grid, .board-list, .letrero-grid, .today-list, .opinion-list";
const ANIMAR = "IntersectionObserver" in window
  && window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
let observadorEntradas = null;

function marcarEntradas(raiz) {
  const marcar = (selector, clase) => {
    const encontrados = [...raiz.querySelectorAll(selector)];
    if (raiz.matches && raiz.matches(selector)) encontrados.push(raiz);
    encontrados.forEach(el => {
      if (el.classList.contains(clase) || el.closest(".sidebar")) return;
      el.classList.add(clase);
      observadorEntradas.observe(el);
    });
  };
  marcar(BLOQUES_REVELAR, "revelar");
  marcar(GRIDS_REVELAR, "revelar-grid");
}

function initEntradas() {
  if (!ANIMAR) return;
  observadorEntradas = new IntersectionObserver(entradas => {
    entradas.forEach(entrada => {
      if (!entrada.isIntersecting) return;
      entrada.target.classList.add("visible");
      observadorEntradas.unobserve(entrada.target);
    });
  }, { rootMargin: "0px 0px -6% 0px", threshold: 0.05 });
  marcarEntradas(document.body);
  // Lo que llega después de la API (vitrina, tarjetas, resultados) también entra animado
  new MutationObserver(cambios => {
    cambios.forEach(c => c.addedNodes.forEach(nodo => {
      if (nodo.nodeType === 1) marcarEntradas(nodo);
    }));
  }).observe(document.body, { childList: true, subtree: true });
}

// comun.js se carga al final del <body>: se marca antes del primer pintado para que no parpadee
if (ANIMAR) {
  document.documentElement.classList.add("anim");
  initEntradas();
}

// ================= Barra lateral (plan 2026-10-20) =================
// Escritorio: se abre con hover o foco (CSS); "Tiendas" abre un panel con hover, clic, Enter o →.
// ≤ 860px: cajón que abre el botón "Abrir menú"; "Tiendas" entra como segundo panel.
const CON_MOUSE = window.matchMedia("(hover: hover) and (min-width: 861px)");
const ES_CAJON = window.matchMedia("(max-width: 860px)");
let cierreTiendas = null;

function abrirTiendas(abrir, enfocar = false) {
  const nav = document.getElementById("main-navbar");
  const boton = document.getElementById("side-tiendas-btn");
  if (!nav || !boton || !boton.dataset.action) return;
  clearTimeout(cierreTiendas);
  nav.classList.toggle("is-open", abrir);
  boton.setAttribute("aria-expanded", String(abrir));
  if (abrir && enfocar) {
    const primero = document.querySelector(ES_CAJON.matches ? ".side-volver" : ".side-tienda");
    if (primero) primero.focus();
  }
}

function abrirCajon(abrir) {
  const nav = document.getElementById("main-navbar");
  const boton = document.getElementById("menu-abrir");
  if (!nav) return;
  nav.classList.toggle("is-drawer", abrir);
  document.getElementById("side-fondo").classList.toggle("is-visible", abrir);
  document.body.classList.toggle("sin-scroll", abrir);
  if (boton) boton.setAttribute("aria-expanded", String(abrir));
  if (abrir) {
    nav.querySelector(".side-brand").focus();
  } else {
    abrirTiendas(false);
    if (boton && ES_CAJON.matches) boton.focus();
  }
}

// Lo que se puede enfocar dentro del cajón (para que Tab no salga de él)
function enfocablesCajon(nav) {
  return [...nav.querySelectorAll("a[href], button, input")]
    .filter(el => el.checkVisibility ? el.checkVisibility({ visibilityProperty: true }) : el.offsetParent !== null);
}

async function cargarTiendasMenu() {
  const lista = document.getElementById("side-tiendas-list");
  const boton = document.getElementById("side-tiendas-btn");
  if (!lista || !boton) return;
  try {
    const tiendas = await obtenerTiendas();
    const actual = (location.pathname.match(/^\/t\/([^/]+)/) || [])[1] || "";
    lista.innerHTML = tiendas.map(t => `
      <li><a class="side-tienda" href="/t/${escapeHTML(t.slug)}"${t.slug === actual ? ' aria-current="page"' : ""}>
        <span class="side-ico">${icon(t.icono || "store")}</span>
        <span><strong>${escapeHTML(t.nombre)}</strong>${t.descripcion ? `<small>${escapeHTML(t.descripcion)}</small>` : ""}</span>
      </a></li>`).join("");
  } catch (e) {
    // Sin la lista, "Tiendas" funciona como enlace normal a las tiendas de la portada
    boton.removeAttribute("data-action");
    boton.removeAttribute("aria-expanded");
  }
}

function initBarraLateral() {
  const nav = document.getElementById("main-navbar");
  if (!nav) return;
  const boton = document.getElementById("side-tiendas-btn");

  // Hover: abre al entrar a "Tiendas" o al panel; cierra con una pequeña tolerancia al salir
  nav.addEventListener("mouseover", event => {
    if (!CON_MOUSE.matches) return;
    if (event.target.closest(".side-tiendas, .side-flyout")) {
      abrirTiendas(true);
    } else if (nav.classList.contains("is-open")) {
      clearTimeout(cierreTiendas);
      cierreTiendas = setTimeout(() => abrirTiendas(false), 150);
    }
  });
  nav.addEventListener("mouseleave", () => {
    if (!CON_MOUSE.matches || !nav.classList.contains("is-open")) return;
    clearTimeout(cierreTiendas);
    cierreTiendas = setTimeout(() => abrirTiendas(false), 150);
  });

  // Teclado fuera del cajón: al salir de la barra con Tab se cierra el panel
  nav.addEventListener("focusout", event => {
    if (!ES_CAJON.matches && !nav.contains(event.relatedTarget)) abrirTiendas(false);
  });

  nav.addEventListener("keydown", event => {
    if (event.key === "ArrowRight" && event.target === boton) {
      event.preventDefault();
      abrirTiendas(true, true);
    } else if (event.key === "ArrowLeft" && event.target.closest(".side-flyout")) {
      event.preventDefault();
      abrirTiendas(false);
      boton.focus();
    } else if (event.key === "Tab" && nav.classList.contains("is-drawer")) {
      const enfocables = enfocablesCajon(nav);
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      if (event.shiftKey && document.activeElement === primero) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primero.focus();
      }
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (nav.classList.contains("is-open")) {
      abrirTiendas(false);
      boton.focus();
    } else if (nav.classList.contains("is-drawer")) {
      abrirCajon(false);
    }
  });

  // Clic fuera de la barra cierra el panel
  document.addEventListener("click", event => {
    if (nav.classList.contains("is-open") && !nav.contains(event.target)) abrirTiendas(false);
  });

  // Al pasar de celular a escritorio, el cajón no se queda abierto
  ES_CAJON.addEventListener("change", () => {
    if (!ES_CAJON.matches && nav.classList.contains("is-drawer")) abrirCajon(false);
  });

  cargarTiendasMenu();
}

Object.assign(ACCIONES, {
  "menu-tiendas": (el, event) => {
    event.preventDefault();
    const nav = document.getElementById("main-navbar");
    const abrir = !nav.classList.contains("is-open");
    abrirTiendas(abrir, abrir && event.detail === 0);
    if (!abrir && ES_CAJON.matches) document.getElementById("side-tiendas-btn").focus();
  },
  "menu-abrir": () => abrirCajon(true),
  "menu-cerrar": () => abrirCajon(false)
});

document.addEventListener("DOMContentLoaded", () => {
  migrarCarritoViejo();
  actualizarContador();
  cargarTiendasPie();
  initBarraLateral();
});
