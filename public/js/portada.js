/**
 * NECUTLA — Portada como tienda en línea (plan 2026-11-24-rediseno-tienda-en-linea): banner de promociones con el
 * tablero, tiendas, ofertas de hoy, lo más pedido, opiniones y Conócenos. El buscador vive en la barra de la tienda.
 */

const MAX_PROMOS_PORTADA = 4;

// Fotos de Unsplash (Unsplash License) para las tarjetas de la portada, por slug de tienda.
// Plan 2026-10-31-fotos-tiendas-portada; origen de cada una en recursos/fotos-unsplash/creditos.md.
// Solo reemplazan la imagen de relleno (SVG): si la tienda subió su portada en Necutools, se usa la suya.
const FOTOS_TIENDAS = {
  ropa: { alt: "Camisas de colores colgadas en un perchero", autor: "Marcus Loke", perfil: "https://unsplash.com/@marcusloke" },
  tecnologia: { alt: "Celular, teclado y mouse sobre un escritorio", autor: "Jakub Żerdzicki", perfil: "https://unsplash.com/@jakubzerdzicki" },
  dulces: { alt: "Caramelos de colores amontonados", autor: "Customerbox", perfil: "https://unsplash.com/@customerbox" },
  propaganda: { alt: "Hojas impresas de colores abiertas en abanico", autor: "Andrew Pons", perfil: "https://unsplash.com/@imandrewpons" },
  papeleria: { alt: "Plumas y marcadores de colores acomodados en filas", autor: "Caroline", perfil: "https://unsplash.com/@carolinentmt" },
  regalos: { alt: "Caja de regalo de papel kraft con moño rosa", autor: "Jess Bailey", perfil: "https://unsplash.com/@jessbaileydesigns" },
  otra: { alt: "Puesto de mercado con artesanías tejidas de colores", autor: "Aron Weerakoon", perfil: "https://unsplash.com/@aron781n" }
};

// Ancho de la foto de cada tienda: 7 en fila, 4 (≤992px) y casi 3 en celular
const TAMANOS_FOTO = "(max-width: 640px) 30vw, (max-width: 992px) 23vw, 160px";

// La foto de Unsplash de la tienda, o null si tiene portada propia o no hay foto para ella
function fotoDe(t) {
  const relleno = !t.imagen_url || /^\/imagenes\/[a-z0-9-]+\.svg$/.test(t.imagen_url);
  return relleno && Object.hasOwn(FOTOS_TIENDAS, t.slug) ? FOTOS_TIENDAS[t.slug] : null;
}

function imagenTarjeta(t) {
  const foto = fotoDe(t);
  if (!foto) {
    return `<span class="tienda-tile-foto"><img src="${escapeHTML(t.imagen_url || "/imagenes/otra.svg")}" alt="" loading="lazy" decoding="async"></span>`;
  }
  const base = `/imagenes/tiendas/${escapeHTML(t.slug)}`;
  return `<span class="tienda-tile-foto"><img src="${base}-640.webp" srcset="${base}-640.webp 640w, ${base}-1280.webp 1280w"
    sizes="${TAMANOS_FOTO}" width="1280" height="800" alt="" loading="lazy" decoding="async"></span>`;
}

// "Fotos de Unsplash: Nombre, Nombre…" con los fotógrafos de las tarjetas que se ven
function pintarCreditos(tiendas) {
  const caja = document.getElementById("creditos-fotos");
  const autores = [];
  tiendas.map(fotoDe).filter(Boolean).forEach(f => { if (!autores.some(a => a.autor === f.autor)) autores.push(f); });
  caja.hidden = !autores.length;
  caja.innerHTML = autores.length
    ? `Fotos de <a href="https://unsplash.com/es" rel="noopener">Unsplash</a>: ${autores.map(a => `<a href="${escapeHTML(a.perfil)}" rel="noopener">${escapeHTML(a.autor)}</a>`).join(", ")}.`
    : "";
}

function filaTablero(t) {
  return `<li><a class="board-row" href="/t/${escapeHTML(t.slug)}">${icon(t.icono || "store")}<span class="board-name">${escapeHTML(t.nombre)}</span>${icon("chevron-right", "board-go")}</a></li>`;
}

// Compra por tienda: foto cuadrada, nombre y cuántos productos tiene (como los departamentos de una tienda en línea)
function tarjetaTienda(t) {
  const partes = [];
  if (t.productos) partes.push(`${t.productos} ${t.productos === 1 ? "producto" : "productos"}`);
  if (t.servicios) partes.push(`${t.servicios} ${t.servicios === 1 ? "servicio" : "servicios"}`);
  return `
    <a class="tienda-tile" href="/t/${escapeHTML(t.slug)}">
      ${imagenTarjeta(t)}
      ${t.ofertas_hoy ? `<span class="tag-oferta">${icon("tag")}${t.ofertas_hoy === 1 ? "1 oferta hoy" : `${t.ofertas_hoy} ofertas hoy`}</span>` : ""}
      <strong>${escapeHTML(t.nombre)}</strong>
      <span>${escapeHTML(partes.join(" · ") || "Catálogo de la tienda")}</span>
    </a>`;
}

// Lugar apartado para las tiendas mientras llegan: tantas como filas trae el tablero (lo pinta el servidor)
function esqueletoTiendas(grid) {
  const n = document.querySelectorAll("#board-list .board-row").length || 7;
  grid.innerHTML = Array.from({ length: n }, () => `
    <span class="tienda-tile esqueleto-tile" aria-hidden="true"><span class="tienda-tile-foto"></span><strong>&nbsp;</strong><span>&nbsp;</span></span>`).join("");
}

async function cargarTiendas() {
  const grid = document.getElementById("stores-grid");
  // El servidor ya manda el tablero pintado (app/paginas.php, con_tablero); los esqueletos solo si no llegó
  if (!document.querySelector("#board-list .board-row")) pintarEsqueletos(document.getElementById("board-list"), 7, "fila");
  esqueletoTiendas(grid);
  try {
    const tiendas = await obtenerTiendas();
    // Si el servidor ya lo pintó igual, no se toca: así las filas no repiten su entrada
    const tablero = document.getElementById("board-list");
    const nuevo = document.createElement("ul");
    nuevo.innerHTML = tiendas.map(filaTablero).join("");
    if (nuevo.innerHTML !== tablero.innerHTML) tablero.innerHTML = nuevo.innerHTML;
    if (tiendas.length > 1) document.getElementById("hero-explorar").textContent = `Explorar las ${tiendas.length} tiendas`;
    grid.innerHTML = tiendas.map(tarjetaTienda).join("");
    pintarCreditos(tiendas);
    if (!tiendas.length) grid.outerHTML = `<p>Todavía no hay tiendas abiertas. Vuelve pronto.</p>`;
  } catch (error) {
    grid.outerHTML = `<div class="notice">${icon("info")}<span>${escapeHTML(error.message)}</span></div>`;
  }
}

// ================= Banner (carrusel de promociones) =================
// La primera diapositiva viene en el HTML (con el h1); las promociones de temporada se agregan detrás.
// Solo cambia cuando el estudiante toca las flechas o los puntos. Todas ocupan el mismo lugar: no hay saltos.
function diapositivaPromo(promo) {
  const vigencia = promo.inicio === promo.fin ? `Solo el ${fechaCorta(promo.fin)}` : `Hasta el ${fechaCorta(promo.fin)}`;
  const foto = promo.imagen_url
    ? `<img src="${escapeHTML(promo.imagen_url)}" alt="${escapeHTML(promo.titulo)}" loading="lazy" decoding="async">`
    : `<img src="/imagenes/tiendas/regalos-640.webp" alt="" loading="lazy" decoding="async">`;
  return `
    <article class="banner-slide" aria-roledescription="diapositiva" aria-hidden="true" inert>
      <div class="banner-texto">
        <span class="tag-oferta">${icon("tag")}Promoción de temporada</span>
        <h2>${escapeHTML(promo.titulo)}</h2>
        ${promo.descripcion ? `<p>${escapeHTML(promo.descripcion)}</p>` : ""}
        <div class="banner-precio"><strong>${money(promo.precio)}</strong>${promo.precio_normal ? `<s>${money(promo.precio_normal)}</s>` : ""}<span>${escapeHTML(vigencia)}</span></div>
        <a class="btn" href="/promociones.html">Ver la promoción</a>
      </div>
      <div class="banner-foto">${foto}</div>
    </article>`;
}

let bannerActual = 0;

function irABanner(i) {
  const slides = [...document.querySelectorAll("#banner-pista .banner-slide")];
  if (slides.length < 2) return;
  bannerActual = (i + slides.length) % slides.length;
  slides.forEach((s, j) => {
    const es = j === bannerActual;
    s.classList.toggle("is-actual", es);
    s.toggleAttribute("inert", !es);
    if (es) s.removeAttribute("aria-hidden"); else s.setAttribute("aria-hidden", "true");
    s.setAttribute("aria-label", `${j + 1} de ${slides.length}`);
  });
  document.querySelectorAll("#banner-puntos button").forEach((b, j) => b.setAttribute("aria-current", String(j === bannerActual)));
}

async function cargarPromociones() {
  try {
    let promos = await api("/promociones?destacadas=1");
    if (!promos.length) promos = await api("/promociones");
    if (!promos.length) return;
    const lista = promos.slice(0, MAX_PROMOS_PORTADA);
    document.getElementById("banner-pista").insertAdjacentHTML("beforeend", lista.map(diapositivaPromo).join(""));
    const total = lista.length + 1;
    document.getElementById("banner-puntos").innerHTML = Array.from({ length: total }, (_, j) =>
      `<button type="button" data-action="banner-ir" data-i="${j}" aria-label="Ver diapositiva ${j + 1} de ${total}" aria-current="${j === 0}"></button>`).join("");
    document.getElementById("banner-controles").hidden = false;
    irABanner(0);
  } catch (e) { /* sin promociones, el banner se queda con la bienvenida */ }
}

// ================= Ofertas de hoy (riel) =================
// Junta los productos de la vitrina (temporada, de este día y remates) en una sola fila que se desliza.
const MAX_OFERTAS_HOY = 15;
const CIERRE_STANDS = 22; // Lun a vie, 9:00 a 22:00

// Cuánto falta para que cierren los stands hoy; null si hoy no abren o ya cerraron
function faltaParaCerrar(ahora = new Date()) {
  const dia = ahora.getDay();
  if (dia === 0 || dia === 6) return null;
  const cierre = new Date(ahora);
  cierre.setHours(CIERRE_STANDS, 0, 0, 0);
  const ms = cierre - ahora;
  if (ms <= 0 || ahora.getHours() < 9) return null;
  return ms;
}

let relojHoy = null;

function pintarReloj() {
  const caja = document.getElementById("reloj-hoy");
  const ms = faltaParaCerrar();
  if (ms === null) {
    caja.hidden = true;
    clearInterval(relojHoy);
    return;
  }
  const s = Math.floor(ms / 1000);
  const dos = n => String(n).padStart(2, "0");
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), seg = s % 60;
  caja.innerHTML = `<span class="reloj-texto">Cierran en</span><b>${dos(h)}</b><b>${dos(m)}</b><b>${dos(seg)}</b>`;
  caja.setAttribute("aria-label", `Los stands cierran en ${h} h ${m} min`);
  caja.hidden = false;
}

async function cargarOfertasHoy() {
  try {
    const { bloques } = await api("/vitrina");
    const vistos = new Set();
    const productos = [];
    bloques.forEach(b => b.productos.forEach(p => {
      if (!vistos.has(p.id)) { vistos.add(p.id); productos.push(p); }
    }));
    if (!productos.length) return;
    document.getElementById("ofertas-hoy-pista").innerHTML = productos.slice(0, MAX_OFERTAS_HOY)
      .map(p => tarjetaProducto(p, { conTienda: true })).join("");
    document.getElementById("ofertas-hoy").hidden = false;
    pintarReloj();
    relojHoy = setInterval(pintarReloj, 1000);
  } catch (e) { /* sin ofertas, la sección se queda oculta */ }
}

// ================= Lo más pedido esta semana (o lo nuevo) =================
async function cargarMasPedidos() {
  try {
    const { criterio, productos } = await api("/portada/productos");
    if (!productos.length) return;
    if (criterio === "nuevos") {
      document.getElementById("mas-pedidos-title").textContent = "Lo nuevo en las tiendas";
      document.getElementById("mas-pedidos-desc").textContent = "Lo último que subieron las tiendas de Necutla.";
    }
    document.getElementById("mas-pedidos-grid").innerHTML = productos.map(p => tarjetaProducto(p, { conTienda: true })).join("");
    document.getElementById("mas-pedidos").hidden = false;
  } catch (e) { /* sin productos, la sección se queda oculta */ }
}

// ================= Conócenos =================
const PANELES_CONOCENOS = ["que-es", "como-funciona", "app-android", "preguntas"];

function abrirPanel(id, enfocar = false) {
  if (!PANELES_CONOCENOS.includes(id)) return false;
  PANELES_CONOCENOS.forEach(p => { document.getElementById(p).hidden = p !== id; });
  document.querySelectorAll('[data-action="conocenos"]').forEach(b => b.setAttribute("aria-pressed", String(b.dataset.panel === id)));
  if (id === "app-android") cargarVersionApp();
  if (enfocar) document.getElementById("conocenos").scrollIntoView({ block: "start" });
  return true;
}

// ================= Lo que dicen otros estudiantes (plan 2026-11-08) =================
// Cifras y opiniones reales de /api/portada/resumen. Sin opiniones, la sección se queda oculta: no se inventa nada.
function cifra(valor, uno, varios) {
  return `<div class="cifra"><dt>${valor === 1 ? uno : varios}</dt><dd>${valor.toLocaleString("es-MX")}</dd></div>`;
}

function tarjetaOpinionPortada(r) {
  return `
    <li class="card opinion-portada">
      ${estrellasDe(r.calificacion)}
      <p class="opinion-portada-texto">${escapeHTML(r.comentario)}</p>
      <p class="opinion-portada-autor">
        <span class="opinion-autor">${escapeHTML(r.nombre)}</span>
        sobre <a href="/p/${encodeURIComponent(r.producto.id)}">${escapeHTML(r.producto.nombre)}</a>,
        de ${escapeHTML(r.tienda.nombre)}
      </p>
    </li>`;
}

async function cargarPruebaSocial() {
  try {
    const d = await api("/portada/resumen");
    if (!d.recientes || !d.recientes.length) return;
    const cifras = [
      cifra(d.tiendas, "tienda", "tiendas"),
      cifra(d.productos, "producto", "productos"),
      d.servicios ? cifra(d.servicios, "servicio", "servicios") : "",
      cifra(d.opiniones, "opinión", "opiniones"),
      d.pedidos ? cifra(d.pedidos, "pedido pagado", "pedidos pagados") : ""
    ];
    document.getElementById("cifras-portada").innerHTML = cifras.join("");
    document.getElementById("opiniones-portada").innerHTML = d.recientes.map(tarjetaOpinionPortada).join("");
    document.getElementById("prueba-social").hidden = false;
  } catch (e) { /* sin resumen, la portada sigue igual */ }
}

// Cada búsqueda lleva su turno: si llega tarde la respuesta de una vieja, no se pinta encima de la nueva
let turnoBusqueda = 0;
let ultimaBusqueda = "";
let conResultados = "";

// Buscador que siempre dice qué está pasando (plan 2026-11-22, reel Df3FZ0BIK66): la línea de estado bajo el
// campo cambia entre "escribe más", "buscando", resultados, sin resultados y error con "Reintentar".
function estadoBusqueda(texto, { error = false } = {}) {
  document.getElementById("search-estado-texto").textContent = texto;
  document.getElementById("search-estado").classList.toggle("is-error", error);
  document.getElementById("search-reintentar").hidden = !error;
}

const ESTADO_INICIAL = "";

// alEscribir: la busca el debounce mientras escribes; no mueve la página
async function buscar(event, alEscribir = false) {
  if (event) event.preventDefault();
  buscarConEspera.cancelar();
  const input = document.getElementById("search-input");
  const q = input.value.trim();
  const bloque = document.getElementById("search-results");
  const grid = document.getElementById("search-grid");
  const vacio = document.getElementById("search-empty");
  if (q.length < 2) {
    estadoBusqueda(q ? "Escribe al menos 2 letras." : ESTADO_INICIAL);
    if (!alEscribir) input.focus();
    return;
  }
  const turno = ++turnoBusqueda;
  ultimaBusqueda = q;
  ocultarRecientes();
  estadoBusqueda(`Buscando «${q}» en todas las tiendas…`);
  // Si ya hay resultados, se quedan atenuados mientras llegan los nuevos; esqueletos solo la primera vez
  const habia = !bloque.hidden && grid.querySelector(".card:not(.esqueleto-card)");
  bloque.hidden = false;
  document.getElementById("search-title").textContent = `Resultados para “${q}”`;
  if (habia) {
    grid.classList.add("is-buscando");
    grid.setAttribute("aria-busy", "true");
  } else {
    document.getElementById("search-desc").textContent = "";
    vacio.innerHTML = "";
    pintarEsqueletos(grid, 3);
  }
  try {
    const resultados = await api(`/buscar?q=${encodeURIComponent(q)}`);
    if (turno !== turnoBusqueda) return;
    const cuantos = resultados.length === 20
      ? "Mostramos los primeros 20. Escribe algo más específico para afinar."
      : `${resultados.length} ${resultados.length === 1 ? "resultado" : "resultados"} en todas las tiendas.`;
    document.getElementById("search-desc").textContent = cuantos;
    grid.innerHTML = resultados.map(p => tarjetaProducto(p, { conTienda: true })).join("");
    vacio.innerHTML = resultados.length ? "" : `<p>No encontramos nada con “${escapeHTML(q)}”. Prueba con otra palabra o entra a una tienda.</p>
      <a class="btn secondary" href="#tiendas-head">${icon("store")}Explorar las tiendas</a>`;
    estadoBusqueda(resultados.length
      ? `${resultados.length === 20 ? "20 o más resultados" : cuantos.replace(" en todas las tiendas.", "")} para «${q}».`
      : `No encontramos «${q}».`);
    // Mientras escribes no se guarda cada pedazo ("ca", "cab"…): se guarda al buscar con el botón o Enter,
    // o al salir del campo (ver el focusout de abajo)
    conResultados = resultados.length ? q : "";
    if (resultados.length && !alEscribir) guardarReciente(q);
  } catch (error) {
    if (turno !== turnoBusqueda) return;
    // El error y "Reintentar" van en la línea de estado; el bloque de resultados vacío solo estorbaría
    grid.innerHTML = "";
    vacio.innerHTML = "";
    bloque.hidden = true;
    estadoBusqueda(`No pudimos buscar: ${error.message}`, { error: true });
  } finally {
    if (turno === turnoBusqueda) {
      grid.classList.remove("is-buscando");
      grid.removeAttribute("aria-busy");
    }
  }
  if (!alEscribir && !bloque.hidden) bloque.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Mientras escribes: busca 400 ms después de la última tecla. Al borrar todo, se quitan los resultados.
const buscarConEspera = conEspera(() => buscar(null, true), 400);

function alEscribirBusqueda() {
  const q = document.getElementById("search-input").value.trim();
  if (!q) {
    buscarConEspera.cancelar();
    turnoBusqueda++;
    document.getElementById("search-results").hidden = true;
    estadoBusqueda(ESTADO_INICIAL);
    mostrarRecientes();
    return;
  }
  ocultarRecientes();
  if (q.length < 2) {
    buscarConEspera.cancelar();
    turnoBusqueda++;
    estadoBusqueda("Escribe al menos 2 letras.");
    return;
  }
  // Se avisa al momento, aunque la petición salga 400 ms después
  estadoBusqueda(`Buscando «${q}» en todas las tiendas…`);
  buscarConEspera();
}

// ================= Búsquedas recientes (plan 2026-11-22): solo en este navegador =================
// Las últimas 5 que dieron resultados. No se mandan al servidor ni a Analytics.
const CLAVE_RECIENTES = "necutla_busquedas";

function leerRecientes() {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE_RECIENTES) || "[]");
    return Array.isArray(lista) ? lista.filter(t => typeof t === "string").slice(0, 5) : [];
  } catch (e) {
    return [];
  }
}

function escribirRecientes(lista) {
  try {
    if (lista.length) localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(lista));
    else localStorage.removeItem(CLAVE_RECIENTES);
  } catch (e) { /* sin almacenamiento, no se guardan */ }
}

function guardarReciente(q) {
  const lista = leerRecientes().filter(t => t.toLowerCase() !== q.toLowerCase());
  escribirRecientes([q.slice(0, 60), ...lista].slice(0, 5));
}

function mostrarRecientes() {
  const caja = document.getElementById("search-recientes");
  const input = document.getElementById("search-input");
  const lista = leerRecientes();
  if (!lista.length || input.value.trim()) { caja.hidden = true; return; }
  caja.innerHTML = `<p class="search-recientes-titulo">Búsquedas recientes</p>
    <ul class="search-recientes-lista">${lista.map(t => `
      <li>
        <button type="button" class="btn ghost btn-sm" data-action="buscar-reciente" data-q="${escapeHTML(t)}">${icon("history")}${escapeHTML(t)}</button>
        <button type="button" class="btn ghost btn-sm btn-icon" data-action="quitar-reciente" data-q="${escapeHTML(t)}" aria-label="Quitar «${escapeHTML(t)}» de las recientes">${icon("x")}</button>
      </li>`).join("")}
    </ul>
    <button type="button" class="btn ghost btn-sm" data-action="borrar-recientes">${icon("trash-2")}Borrar historial</button>`;
  caja.hidden = false;
}

function ocultarRecientes() {
  document.getElementById("search-recientes").hidden = true;
}

Object.assign(ACCIONES, {
  "banner-anterior": () => irABanner(bannerActual - 1),
  "banner-siguiente": () => irABanner(bannerActual + 1),
  "banner-ir": el => irABanner(Number(el.dataset.i)),
  "riel-anterior": el => { const p = el.closest(".riel").querySelector(".riel-pista"); p.scrollBy({ left: -p.clientWidth, behavior: "smooth" }); },
  "riel-siguiente": el => { const p = el.closest(".riel").querySelector(".riel-pista"); p.scrollBy({ left: p.clientWidth, behavior: "smooth" }); },
  conocenos: el => abrirPanel(el.dataset.panel),
  "limpiar-busqueda": () => {
    const input = document.getElementById("search-input");
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  },
  "reintentar-busqueda": () => {
    document.getElementById("search-input").value = ultimaBusqueda || document.getElementById("search-input").value;
    buscar(null, true);
  },
  "buscar-reciente": el => {
    document.getElementById("search-input").value = el.dataset.q;
    document.getElementById("search-input").dispatchEvent(new Event("input", { bubbles: true }));
    buscar(null);
  },
  "quitar-reciente": el => {
    escribirRecientes(leerRecientes().filter(t => t !== el.dataset.q));
    mostrarRecientes();
    const sigue = document.querySelector("#search-recientes [data-action='buscar-reciente']");
    (sigue || document.getElementById("search-input")).focus();
  },
  "borrar-recientes": () => {
    escribirRecientes([]);
    ocultarRecientes();
    document.getElementById("search-input").focus();
  }
});

// El buscador de la barra lateral manda a /?q=…; en la portada busca sin recargar
function buscarDesdeBarra(q) {
  document.getElementById("search-input").value = q;
  buscar(null);
}

// Versión y tamaño del APK de Android (public/app/version.json, plan 2026-11-22-app-nativa-mis-pedidos-y-descarga)
async function cargarVersionApp() {
  const texto = document.getElementById("app-version");
  if (!texto) return;
  try {
    const r = await fetch("/app/version.json", { cache: "no-cache" });
    if (!r.ok) return;
    const v = await r.json();
    const mb = (Number(v.tamano) / 1048576).toLocaleString("es-MX", { maximumFractionDigits: 1 });
    texto.innerHTML = `Versión <span class="precio-num">${escapeHTML(String(v.version))}</span>, ` +
      `<span class="precio-num">${escapeHTML(mb)}</span> MB, para Android ${escapeHTML(String(v.minimo_android))} o más nuevo.`;
  } catch (e) {
    // Se queda el texto del HTML
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("search-form").addEventListener("submit", buscar);
  const campo = document.getElementById("search-input");
  campo.addEventListener("input", alEscribirBusqueda);
  campo.addEventListener("focus", mostrarRecientes);
  campo.addEventListener("blur", () => {
    if (conResultados && campo.value.trim() === conResultados) guardarReciente(conResultados);
  });
  // Al salir del buscador (y de sus recientes) se esconden las recientes
  // Se van al pasar el foco o tocar fuera del buscador (con pointerdown: en Safari un botón no toma el foco)
  document.getElementById("search-form").parentElement.addEventListener("focusout", event => {
    if (event.relatedTarget && !event.relatedTarget.closest("#search-form, #search-recientes")) ocultarRecientes();
  });
  document.addEventListener("pointerdown", event => {
    if (!event.target.closest("#search-form, #search-recientes")) ocultarRecientes();
  });
  const q = (new URLSearchParams(location.search).get("q") || "").trim();
  if (q) buscarDesdeBarra(q);
  // Un enlace a una parte de Conócenos (/#como-funciona, /#preguntas) abre su panel
  const abrirDesdeHash = () => { if (abrirPanel(location.hash.slice(1))) document.getElementById(location.hash.slice(1)).scrollIntoView({ block: "start" }); };
  abrirDesdeHash();
  const tiendas = cargarTiendas();
  cargarPromociones();
  cargarOfertasHoy();
  // Opiniones y vitrina van debajo del directorio: se piden al acercarse (plan 2026-11-11). Con un #ancla o una
  // búsqueda en la dirección se piden de una vez, para que no aparezcan arriba de donde salta la página.
  let pedidas = false;
  const abajo = () => {
    if (pedidas) return;
    pedidas = true;
    cargarMasPedidos();
    cargarPruebaSocial();
  };
  // Se empieza a observar ya con las tarjetas de tiendas pintadas: antes, la marca queda arriba y se pediría de una vez
  if (location.hash || q) abajo();
  else Promise.resolve(tiendas).finally(() => alAcercarse(document.getElementById("portada-centinela"), abajo, { margen: "800px" }));
  // Un salto sin scroll suave (#como-funciona con movimiento reducido) puede brincarse la marca
  window.addEventListener("hashchange", () => { abajo(); abrirDesdeHash(); });
});
