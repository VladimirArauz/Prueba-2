/**
 * NECUTLA — Página de una tienda (/t/<slug>): productos, servicios y ofertas.
 * ?tab=ofertas abre esa pestaña; ?sub=<slug> filtra por subcategoría.
 * Los servicios van en su propia sección (#servicios); ?tab=servicios y #servicios bajan a ella.
 */

const POR_PAGINA = 12;
const PESTANAS = { productos: "Productos", servicios: "Servicios", ofertas: "Ofertas" };

const estado = { datos: null, tab: "productos", sub: "", visibles: POR_PAGINA, visiblesServicios: POR_PAGINA };
// Las tarjetas se agregan solas al acercarse al final de la lista (plan 2026-11-11). Sin IntersectionObserver
// quedan los botones "Mostrar más" de siempre.
const SOLAS = "IntersectionObserver" in window;
let revisarProductos = () => {};
let revisarServicios = () => {};

function slugDeLaUrl() {
  const partes = location.pathname.split("/").filter(Boolean);
  return partes[0] === "t" && partes[1] ? decodeURIComponent(partes[1]) : "";
}

function actualizarUrl() {
  const params = new URLSearchParams();
  if (estado.tab !== "productos") params.set("tab", estado.tab);
  if (estado.tab === "productos" && estado.sub) params.set("sub", estado.sub);
  const query = params.toString();
  history.replaceState(null, "", location.pathname + (query ? `?${query}` : ""));
}

// Subcategorías que tienen al menos un producto visible
function subcategoriasConProductos() {
  const { subcategorias, productos } = estado.datos;
  return subcategorias.filter(s => productos.some(p => p.subcategoria_id === s.id));
}

// "Servicios" siempre aparece: no cambia la lista, baja a su sección
function pestanasDisponibles() {
  const { ofertas } = estado.datos;
  return Object.keys(PESTANAS).filter(tab => tab !== "ofertas" || ofertas.length);
}

function renderEncabezado() {
  const { tienda } = estado.datos;
  document.getElementById("store-title").innerHTML = `${icon(tienda.icono || "store")}${escapeHTML(tienda.nombre)}`;
  document.getElementById("store-desc").textContent = tienda.descripcion;
  document.getElementById("store-meta").hidden = false;
}

function renderPestanas() {
  const tabs = pestanasDisponibles();
  const contenedor = document.getElementById("store-tabs");
  contenedor.hidden = tabs.length < 2;
  contenedor.innerHTML = tabs.map(tab => {
    const total = tab === "productos" ? estado.datos.productos.length
      : tab === "servicios" ? estado.datos.servicios.length
      : estado.datos.ofertas.length;
    const activa = tab === estado.tab;
    return `<button type="button" class="btn secondary btn-sm" data-action="tab" data-tab="${tab}" aria-pressed="${activa}">${PESTANAS[tab]} (${total})</button>`;
  }).join("");
}

function renderFiltros() {
  const contenedor = document.getElementById("store-filters");
  const subs = subcategoriasConProductos();
  contenedor.hidden = estado.tab !== "productos" || subs.length < 2;
  if (contenedor.hidden) return;
  const boton = (slug, nombre) => {
    const activo = estado.sub === slug;
    return `<button type="button" class="btn secondary btn-sm" data-action="filtrar" data-sub="${escapeHTML(slug)}" aria-pressed="${activo}">${escapeHTML(nombre)}</button>`;
  };
  contenedor.innerHTML = boton("", "Todo") + subs.map(s => boton(s.slug, s.nombre)).join("");
}

function vacio(mensaje, accion = "", icono = "package") {
  return `
    <div class="cart-empty">
      ${icon(icono, "icon-lg")}
      <h3>${escapeHTML(mensaje)}</h3>
      ${accion}
    </div>`;
}

// "Lunes y miércoles", "Temporada de Navidad: del 1 al 25 de diciembre", "Remate · Quedan 3 piezas"
function cuandoAplica(oferta) {
  if (oferta.clase === "temporada") {
    const rango = `del ${fechaCorta(oferta.inicio)} al ${fechaCorta(oferta.fin)}`;
    return `Temporada de ${oferta.temporada}: ${oferta.hoy ? rango : `empieza el ${fechaCorta(oferta.inicio)}`}`;
  }
  if (oferta.clase === "remate") return detalleOferta(oferta) + (oferta.fin || oferta.piezas ? "" : " · Hasta que se acabe");
  return oferta.dias_texto;
}

function tarjetaOferta(oferta) {
  const { productos, subcategorias, tienda } = estado.datos;
  let aplica = `Toda la tienda ${tienda.nombre}`;
  if (oferta.producto_id) {
    const producto = productos.find(p => p.id === oferta.producto_id);
    aplica = producto ? producto.nombre : "Un producto de la tienda";
  } else if (oferta.subcategoria_id) {
    const sub = subcategorias.find(s => s.id === oferta.subcategoria_id);
    aplica = sub ? `Todo en ${sub.nombre}` : "Una subcategoría de la tienda";
  }
  const detalle = oferta.tipo === "porcentaje" ? `${oferta.valor}% de descuento`
    : oferta.tipo === "precio_especial" ? `Precio especial: ${money(oferta.valor)}`
    : "Lleva 2 y paga 1";
  const etiquetas = [
    oferta.hoy ? `<span class="tag-oferta">${icon("tag")}Hoy</span>` : "",
    oferta.clase === "remate" ? `<span class="tag-oferta is-remate">${icon("tag")}Remate</span>` : ""
  ].join("");
  return `
    <article class="card offer-card">
      ${etiquetas ? `<div class="card-tags">${etiquetas}</div>` : ""}
      <h3>${escapeHTML(oferta.titulo)}</h3>
      <p>${escapeHTML(oferta.descripcion || detalle)}</p>
      <div class="offer-days">${icon("calendar")} ${escapeHTML(cuandoAplica(oferta))}</div>
      <div class="card-sub">${escapeHTML(aplica)}${oferta.descripcion ? `. ${escapeHTML(detalle)}` : ""}</div>
    </article>`;
}

function listaActual() {
  const { productos, ofertas } = estado.datos;
  if (estado.tab === "ofertas") return [...ofertas].sort((a, b) => Number(b.hoy) - Number(a.hoy));
  const sub = estado.sub && estado.datos.subcategorias.find(s => s.slug === estado.sub);
  return sub ? productos.filter(p => p.subcategoria_id === sub.id) : productos;
}

// Las primeras 3 tarjetas se ven al abrir: su foto se pide de inmediato
function tarjetasDe(lista, desde, hasta) {
  return lista.slice(desde, hasta).map((x, i) =>
    estado.tab === "ofertas" ? tarjetaOferta(x) : tarjetaProducto(x, { primera: desde + i < 3 })).join("");
}

// "Mostrando 24 de 40 productos" para lectores de pantalla (las tarjetas nuevas no se leen todas en voz alta)
function anunciar(id, mostradas, total, singular, plural) {
  document.getElementById(id).textContent = total > POR_PAGINA
    ? `Mostrando ${Math.min(mostradas, total)} de ${total} ${total === 1 ? singular : plural}.` : "";
}

function renderLista() {
  const lista = listaActual();
  document.getElementById("store-grid").innerHTML = tarjetasDe(lista, 0, estado.visibles);
  finLista(lista);
  document.getElementById("store-empty").innerHTML = lista.length ? "" : vacio(
    "Todavía no hay productos aquí.",
    `<a class="btn" href="/">Ver otras tiendas</a>`);
  revisarProductos();
}

function finLista(lista) {
  document.getElementById("store-more").hidden = SOLAS || lista.length <= estado.visibles;
  anunciar("store-cuenta", estado.visibles, lista.length,
    estado.tab === "ofertas" ? "oferta" : "producto", estado.tab === "ofertas" ? "ofertas" : "productos");
}

// Agrega solo las tarjetas que faltan (no repinta las que ya están, ni sus fotos)
function masProductos() {
  if (!estado.datos) return false;
  const lista = listaActual();
  if (estado.visibles >= lista.length) return false;
  const desde = estado.visibles;
  estado.visibles += POR_PAGINA;
  document.getElementById("store-grid").insertAdjacentHTML("beforeend", tarjetasDe(lista, desde, estado.visibles));
  finLista(lista);
  return true;
}

function renderServicios() {
  const { servicios } = estado.datos;
  document.getElementById("servicios").hidden = false;
  document.getElementById("servicios-grid").innerHTML =
    servicios.slice(0, estado.visiblesServicios).map(p => tarjetaProducto(p)).join("");
  finServicios();
  document.getElementById("servicios-empty").innerHTML = servicios.length ? "" : vacio(
    "Esta tienda todavía no tiene servicios.",
    `<p>Pregúntale al vendedor por WhatsApp si hace trabajos a la medida.</p>`, "wrench");
  revisarServicios();
}

function finServicios() {
  const { servicios } = estado.datos;
  document.getElementById("servicios-more").hidden = SOLAS || servicios.length <= estado.visiblesServicios;
  anunciar("servicios-cuenta", estado.visiblesServicios, servicios.length, "servicio", "servicios");
}

function masServicios() {
  if (!estado.datos) return false;
  const { servicios } = estado.datos;
  if (estado.visiblesServicios >= servicios.length) return false;
  const desde = estado.visiblesServicios;
  estado.visiblesServicios += POR_PAGINA;
  document.getElementById("servicios-grid").insertAdjacentHTML("beforeend",
    servicios.slice(desde, estado.visiblesServicios).map(p => tarjetaProducto(p)).join(""));
  finServicios();
  return true;
}

function irAServicios() {
  // Los productos se agregan solos al pasar por el final de su lista: se pintan todos antes de bajar,
  // si no, la sección de servicios se recorre hacia abajo a medio camino (las fotos siguen esperando a acercarse)
  if (estado.tab !== "ofertas") while (masProductos());
  const seccion = document.getElementById("servicios");
  const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  seccion.scrollIntoView({ behavior: quieto ? "auto" : "smooth", block: "start" });
  document.getElementById("servicios-title").focus({ preventScroll: true });
}

function render() {
  renderPestanas();
  renderFiltros();
  renderLista();
}

function cambiarTab(tab) {
  if (tab === "servicios") return irAServicios();
  if (!pestanasDisponibles().includes(tab)) tab = "productos";
  estado.tab = tab;
  estado.visibles = POR_PAGINA;
  actualizarUrl();
  render();
}

function pedirServicio(boton) {
  const id = Number(boton.dataset.id);
  if (!puedePedir()) return void (location.href = rutaACuenta());
  const servicio = estado.datos.servicios.find(s => s.id === id);
  if (!servicio) return;
  const mensaje = `¡Hola! Vi en Necutla el servicio *${servicio.nombre}* de ${estado.datos.tienda.nombre} ` +
    `(${textoPrecio(servicio)}). Quisiera más información, por favor.`;
  if (enviarPorWhatsApp(boton, estado.datos.tienda.whatsapp, mensaje, document.querySelector(`[data-wa-for="${id}"]`), "Chat abierto en WhatsApp")) {
    medirServicio(servicio, estado.datos.tienda.nombre);
  }
}

Object.assign(ACCIONES, {
  tab: el => cambiarTab(el.dataset.tab),
  filtrar: el => {
    estado.sub = el.dataset.sub;
    estado.visibles = POR_PAGINA;
    actualizarUrl();
    renderFiltros();
    renderLista();
  },
  "ver-mas": () => masProductos(),
  "ver-mas-servicios": () => masServicios(),
  "pedir-servicio": el => pedirServicio(el)
});

document.addEventListener("DOMContentLoaded", async () => {
  const slug = slugDeLaUrl();
  sesionCompra();
  pintarEsqueletos(document.getElementById("store-grid"), POR_PAGINA);
  try {
    estado.datos = await api(`/stands/${encodeURIComponent(slug)}`);
    tiendaDeLaPagina = estado.datos.tienda.nombre;
  } catch (error) {
    document.title = "Tienda no encontrada | Necutla";
    document.getElementById("store-title").textContent = error.status === 404 ? "Tienda no encontrada" : "No se pudo cargar la tienda";
    document.getElementById("store-desc").textContent = error.message;
    document.getElementById("store-grid").innerHTML = "";
    document.getElementById("store-empty").innerHTML = `<a class="btn" href="/">Explorar las tiendas</a>`;
    return;
  }
  const params = new URLSearchParams(location.search);
  estado.sub = params.get("sub") || "";
  const tab = params.get("tab");
  // Enlaces viejos (?tab=servicios) y nuevos (#servicios) bajan a la sección
  const aServicios = tab === "servicios" || location.hash === "#servicios";
  if (SOLAS) {
    revisarProductos = alAcercarse(document.getElementById("store-centinela"), masProductos, { repetir: true, margen: "1000px" });
    revisarServicios = alAcercarse(document.getElementById("servicios-centinela"), masServicios, { repetir: true, margen: "1000px" });
  }
  renderEncabezado();
  renderServicios();
  cambiarTab(aServicios ? "productos" : tab || "productos");
  // La vitrina va al final: se pide cuando el usuario se acerca (con #servicios ya se baja, igual se pide al llegar)
  alAcercarse(document.getElementById("vitrina-centinela"), () => cargarVitrina(estado.datos.tienda.slug), { margen: "800px" });
  if (aServicios) irAServicios();
});
