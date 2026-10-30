/**
 * NECUTLA — Página de una tienda (/t/<slug>): productos, servicios y ofertas.
 * ?tab=ofertas abre esa pestaña; ?sub=<slug> filtra por subcategoría.
 * Los servicios van en su propia sección (#servicios); ?tab=servicios y #servicios bajan a ella.
 */

const POR_PAGINA = 12;
const PESTANAS = { productos: "Productos", servicios: "Servicios", ofertas: "Ofertas" };

const estado = { datos: null, tab: "productos", sub: "", visibles: POR_PAGINA, visiblesServicios: POR_PAGINA };

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
  document.title = `${tienda.nombre} | Necutla`;
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
    return `<button type="button" class="btn btn-sm${activa ? "" : " secondary"}" data-action="tab" data-tab="${tab}" aria-pressed="${activa}">${PESTANAS[tab]} (${total})</button>`;
  }).join("");
}

function renderFiltros() {
  const contenedor = document.getElementById("store-filters");
  const subs = subcategoriasConProductos();
  contenedor.hidden = estado.tab !== "productos" || subs.length < 2;
  if (contenedor.hidden) return;
  const boton = (slug, nombre) => {
    const activo = estado.sub === slug;
    return `<button type="button" class="btn btn-sm${activo ? "" : " secondary"}" data-action="filtrar" data-sub="${escapeHTML(slug)}" aria-pressed="${activo}">${escapeHTML(nombre)}</button>`;
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

function renderLista() {
  const grid = document.getElementById("store-grid");
  const vacioEl = document.getElementById("store-empty");
  const mas = document.getElementById("store-more");
  const { productos, ofertas } = estado.datos;

  let lista;
  let html;
  if (estado.tab === "ofertas") {
    lista = [...ofertas].sort((a, b) => Number(b.hoy) - Number(a.hoy));
    html = lista.slice(0, estado.visibles).map(tarjetaOferta).join("");
  } else {
    lista = productos;
    if (estado.sub) {
      const sub = estado.datos.subcategorias.find(s => s.slug === estado.sub);
      lista = sub ? lista.filter(p => p.subcategoria_id === sub.id) : lista;
    }
    html = lista.slice(0, estado.visibles).map(p => tarjetaProducto(p)).join("");
  }

  grid.innerHTML = html;
  mas.hidden = lista.length <= estado.visibles;
  vacioEl.innerHTML = lista.length ? "" : vacio(
    "Todavía no hay productos aquí.",
    `<a class="btn" href="/">Ver otras tiendas</a>`);
}

function renderServicios() {
  const { servicios } = estado.datos;
  document.getElementById("servicios").hidden = false;
  document.getElementById("servicios-grid").innerHTML =
    servicios.slice(0, estado.visiblesServicios).map(p => tarjetaProducto(p)).join("");
  document.getElementById("servicios-more").hidden = servicios.length <= estado.visiblesServicios;
  document.getElementById("servicios-empty").innerHTML = servicios.length ? "" : vacio(
    "Esta tienda todavía no tiene servicios.",
    `<p>Pregúntale al vendedor por WhatsApp si hace trabajos a la medida.</p>`, "wrench");
}

function irAServicios() {
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

function pedirServicio(id) {
  const servicio = estado.datos.servicios.find(s => s.id === id);
  if (!servicio) return;
  const mensaje = `¡Hola! Vi en Necutla el servicio *${servicio.nombre}* de ${estado.datos.tienda.nombre} ` +
    `(${textoPrecio(servicio)}). Quisiera más información, por favor.`;
  abrirWhatsApp(estado.datos.tienda.whatsapp, mensaje, document.querySelector(`[data-wa-for="${id}"]`));
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
  "ver-mas": () => {
    estado.visibles += POR_PAGINA;
    renderLista();
  },
  "ver-mas-servicios": () => {
    estado.visiblesServicios += POR_PAGINA;
    renderServicios();
  },
  "pedir-servicio": el => pedirServicio(Number(el.dataset.id))
});

document.addEventListener("DOMContentLoaded", async () => {
  const slug = slugDeLaUrl();
  pintarEsqueletos(document.getElementById("store-grid"), POR_PAGINA);
  try {
    estado.datos = await api(`/stands/${encodeURIComponent(slug)}`);
  } catch (error) {
    document.title = "Tienda no encontrada | Necutla";
    document.getElementById("store-title").textContent = error.status === 404 ? "Tienda no encontrada" : "No se pudo cargar la tienda";
    document.getElementById("store-desc").textContent = error.message;
    document.getElementById("store-grid").innerHTML = "";
    document.getElementById("store-empty").innerHTML = `<a class="btn" href="/">Ver tiendas</a>`;
    return;
  }
  const params = new URLSearchParams(location.search);
  estado.sub = params.get("sub") || "";
  const tab = params.get("tab");
  // Enlaces viejos (?tab=servicios) y nuevos (#servicios) bajan a la sección
  const aServicios = tab === "servicios" || location.hash === "#servicios";
  renderEncabezado();
  renderServicios();
  cambiarTab(aServicios ? "productos" : tab || "productos");
  cargarVitrina(estado.datos.tienda.slug);
  if (aServicios) irAServicios();
});
