/**
 * NECUTLA — Necutools: administración de tiendas, catálogo, ofertas, promociones y usuarios.
 * El servidor revisa cada permiso; aquí solo se ocultan las secciones que el rol no puede usar.
 */

const MAX_IMAGE_BYTES = 1024 * 1024;
const NOMBRES_ICONOS = {
  "store": "Tienda", "shirt": "Ropa", "cpu": "Tecnología", "candy": "Dulces", "megaphone": "Propaganda",
  "pencil-ruler": "Papelería", "gift": "Regalos", "shapes": "Figuras", "wrench": "Reparaciones",
  "smartphone": "Celulares", "headphones": "Audífonos", "cake": "Pasteles", "cookie": "Galletas", "coffee": "Café",
  "book-open": "Libros", "palette": "Arte", "scissors": "Manualidades", "sparkles": "Belleza", "heart": "Detalles",
  "party-popper": "Fiestas"
};
const NOMBRE_TIPO_OFERTA = { porcentaje: "Descuento", precio_especial: "Precio especial", dos_por_uno: "2x1" };
const NOMBRE_CLASE_OFERTA = { semanal: "Semanal", temporada: "De temporada", remate: "Remate" };
const NOMBRE_ESTADO = { pendiente: "Pendiente", vendido: "Vendido", cancelado: "Cancelado" };
const TITULOS_PANEL = {
  resumen: "Resumen", pedidos: "Pedidos", tiendas: "Tiendas", productos: "Productos y servicios",
  ofertas: "Ofertas de la tienda", resenas: "Opiniones", promociones: "Promociones generales",
  usuarios: "Usuarios", bitacora: "Bitácora", cuenta: "Mi cuenta"
};

const NOMBRE_TABLA = {
  tiendas: "Tienda", subcategorias: "Subcategoría", productos: "Producto", ofertas: "Oferta", opiniones: "Opinión",
  promociones: "Promoción", usuarios: "Usuario", pedidos: "Pedido", sesiones: "Sesión",
  producto_colores: "Color"
};

const st = {
  sesion: null,
  panel: "resumen",
  resumen: null,
  pedidos: { pedidos: [], pagina: 1, paginas: 1, total: 0, pendientes: 0 },
  pedidosEstado: "",
  pedidosPagina: 1,
  bitacora: { registros: [], pagina: 1, paginas: 1, total: 0 },
  bitacoraUsuario: "",
  bitacoraPagina: 1,
  iconos: [],
  tiendas: [],
  productos: [],
  ofertas: [],
  resenas: [],
  promos: [],
  usuarios: [],
  editando: { tienda: null, producto: null, color: null, oferta: null, resena: null, promo: null, usuario: null }
};

const $ = id => document.getElementById(id);
const esDueno = () => st.sesion && st.sesion.rol === "dueno";
const tiendaPorId = id => st.tiendas.find(t => t.id === Number(id));

// ================= Utilidades de formularios =================
function campo(form, nombre) {
  return form.elements[nombre];
}

function marcados(form, nombre) {
  return [...form.querySelectorAll(`input[name="${nombre}"]:checked`)].map(i => i.value);
}

async function leerImagen(input) {
  const archivo = input.files[0];
  if (!archivo) return undefined;
  if (!/^image\/(png|jpeg|webp|gif)$/.test(archivo.type) || archivo.size > MAX_IMAGE_BYTES) {
    throw new Error("Usa una imagen PNG, JPG, WEBP o GIF de hasta 1 MB.");
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se pudo leer la imagen. Elige otra."));
    reader.readAsDataURL(archivo);
  });
}

function modoEdicion(form, nombreForm, editando, titulo, tituloEdicion) {
  form.querySelectorAll("[data-solo-edicion]").forEach(el => { el.hidden = !editando; });
  const cancelar = form.querySelector(`[data-action="cancelar"][data-form="${nombreForm}"]`);
  if (cancelar) cancelar.hidden = !editando;
  const encabezado = $(`form-${nombreForm}-title`);
  if (encabezado) encabezado.textContent = editando ? tituloEdicion : titulo;
}

function opcionesTiendas(seleccion, { todas = false } = {}) {
  return (todas ? `<option value="">Todas mis tiendas</option>` : "") +
    st.tiendas.map(t => `<option value="${t.id}"${Number(seleccion) === t.id ? " selected" : ""}>${escapeHTML(t.nombre)}</option>`).join("");
}

function opcionesSubcategorias(standId, seleccion, vacio = "Sin subcategoría") {
  const tienda = tiendaPorId(standId);
  const subs = tienda ? tienda.subcategorias : [];
  return `<option value="">${vacio}</option>` +
    subs.map(s => `<option value="${s.id}"${Number(seleccion) === s.id ? " selected" : ""}>${escapeHTML(s.nombre)}</option>`).join("");
}

function estadoBadge(activo, si = "Visible", no = "Oculto") {
  return `<span class="status-badge${activo ? "" : " is-off"}">${activo ? si : no}</span>`;
}

function botonesFila(tipo, id, nombre, { borrar = true } = {}) {
  return `
    <button type="button" class="btn secondary btn-sm btn-icon" data-action="editar" data-tipo="${tipo}" data-id="${id}" aria-label="Editar ${escapeHTML(nombre)}" title="Editar">${icon("pencil")}</button>
    ${borrar ? `<button type="button" class="btn danger btn-sm btn-icon" data-action="borrar" data-tipo="${tipo}" data-id="${id}" aria-label="Eliminar ${escapeHTML(nombre)}" title="Eliminar">${icon("trash-2")}</button>` : ""}`;
}

function filaVacia(columnas, mensaje) {
  return `<tr><td colspan="${columnas}" class="cell-empty">${escapeHTML(mensaje)}</td></tr>`;
}

function manejarError(error) {
  if (error.status === 401) {
    st.sesion = null;
    renderAcceso();
  }
  alert(error.message);
}

// Envía un formulario con su botón deshabilitado mientras espera
async function enviar(form, accion) {
  const boton = form.querySelector('[type="submit"]');
  boton.disabled = true;
  try {
    await accion();
  } catch (error) {
    manejarError(error);
  } finally {
    boton.disabled = false;
  }
}

// ================= Sesión =================
function renderAcceso() {
  const dentro = Boolean(st.sesion);
  $("admin-auth").hidden = dentro;
  $("admin-workspace").hidden = !dentro;
  if (!dentro) return;
  const rol = esDueno() ? "Dueño" : "Encargado";
  const tiendas = !esDueno() && st.tiendas.length ? ` · ${st.tiendas.map(t => t.nombre).join(", ")}` : "";
  $("admin-user").innerHTML = `${icon("user")}<span>Hola, ${escapeHTML(st.sesion.usuario)} · ${rol}${escapeHTML(tiendas)}</span>`;
  document.querySelectorAll("[data-solo-dueno]").forEach(el => { el.hidden = !esDueno(); });
  $("tienda-card").hidden = !esDueno() && !st.editando.tienda;
  $("tiendas-intro").textContent = esDueno()
    ? "Crea tiendas nuevas para vender algo distinto, ocúltalas o cambia su orden en el directorio."
    : "Estas son las tiendas que tienes a tu cargo.";
}

async function iniciarSesion(event) {
  event.preventDefault();
  const form = event.currentTarget;
  await enviar(form, async () => {
    const r = await api("/auth/login", {
      method: "POST",
      body: { identificador: $("admin-login-user").value, password: $("admin-login-password").value }
    });
    form.reset();
    if (r.segundoPaso) {
      mostrarCodigo(true);
      return;
    }
    await cargarTodo();
    showToast(`Sesión iniciada: ${st.sesion.usuario}`);
  });
}

// Segundo paso del login: el código de la app de autenticación
function mostrarCodigo(visible) {
  $("admin-login-form").hidden = visible;
  $("admin-codigo-form").hidden = !visible;
  $(visible ? "admin-codigo" : "admin-login-user").focus();
}

async function enviarCodigo(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const boton = form.querySelector('[type="submit"]');
  boton.disabled = true;
  try {
    await api("/auth/login/codigo", { method: "POST", body: { codigo: $("admin-codigo").value } });
    form.reset();
    mostrarCodigo(false);
    await cargarTodo();
    showToast(`Sesión iniciada: ${st.sesion.usuario}`);
  } catch (error) {
    alert(error.message);
    // Si el primer paso venció, se vuelve a pedir usuario y contraseña
    const sesion = await api("/auth/sesion").catch(() => ({}));
    if (!sesion.segundoPaso) mostrarCodigo(false);
  } finally {
    boton.disabled = false;
  }
}

async function cerrarSesion() {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch (e) { /* la sesión ya no existe */ }
  st.sesion = null;
  renderAcceso();
  showToast("Sesión cerrada.");
}

function mostrarPanel(panel) {
  st.panel = panel;
  document.querySelectorAll(".admin-panel").forEach(sec => { sec.hidden = sec.id !== `panel-${panel}`; });
  document.querySelectorAll('#admin-tabs [data-action="panel"]').forEach(btn => {
    const activo = btn.dataset.panel === panel;
    btn.classList.toggle("ghost", !activo);
    btn.setAttribute("aria-pressed", String(activo));
    // En celular el menú es una fila con scroll: la sección elegida queda a la vista
    if (activo) btn.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
  $("dash-titulo").textContent = TITULOS_PANEL[panel];
  $("dash-filtros").hidden = panel !== "resumen" && panel !== "pedidos";
  // Las gráficas se dibujan con el panel visible para que tomen su tamaño real
  if (panel === "resumen" && st.resumen) renderGraficas();
  if (panel === "bitacora") cargarBitacora();
}

// ================= Carga de datos =================
async function cargarTodo() {
  try {
    const sesion = await api("/auth/sesion");
    st.sesion = sesion.autenticado ? await api("/admin/yo") : null;
    if (!st.sesion && sesion.segundoPaso) mostrarCodigo(true);
  } catch (error) {
    st.sesion = null;
  }
  if (!st.sesion) {
    renderAcceso();
    return;
  }
  renderAcceso();
  render2fa();
  try {
    const [iconos, tiendas, productos, ofertas, resenas, resumen, pedidos] = await Promise.all([
      api("/admin/iconos"), api("/admin/tiendas"), api("/admin/productos"), api("/admin/ofertas"), api("/admin/resenas"),
      api(rutaResumen()), api(rutaPedidos())
    ]);
    Object.assign(st, { iconos, tiendas, productos, ofertas, resenas, resumen, pedidos });
    if (esDueno()) {
      [st.promos, st.usuarios] = await Promise.all([api("/admin/promociones"), api("/admin/usuarios")]);
    }
  } catch (error) {
    manejarError(error);
    return;
  }
  renderTodo();
}

// El resumen se recarga siempre: sus pendientes dependen de productos, ofertas y opiniones
async function recargar(...que) {
  const rutas = { tiendas: "/admin/tiendas", productos: "/admin/productos", ofertas: "/admin/ofertas", resenas: "/admin/resenas",
    promos: "/admin/promociones", usuarios: "/admin/usuarios", resumen: rutaResumen(), pedidos: rutaPedidos() };
  if (!que.includes("resumen")) que.push("resumen");
  const datos = await Promise.all(que.map(clave => api(rutas[clave])));
  que.forEach((clave, i) => { st[clave] = datos[i]; });
  renderTodo();
}

function renderTodo({ animar = false } = {}) {
  renderAcceso();
  renderFiltrosDash();
  renderResumen({ animar });
  renderPedidos();
  renderContadores();
  renderTiendas();
  renderSubcategorias();
  renderProductos();
  renderOfertas();
  renderResenas();
  if (esDueno()) {
    renderPromos();
    renderUsuarios();
  }
}

// ================= Resumen (dashboard) =================
function rutaResumen() {
  const tienda = $("dash-tienda").value || "todas";
  return `/admin/resumen?dias=${encodeURIComponent($("dash-periodo").value)}&tienda=${encodeURIComponent(tienda)}`;
}

function rutaPedidos() {
  const params = new URLSearchParams({ pagina: st.pedidosPagina });
  if ($("dash-tienda").value) params.set("tienda", $("dash-tienda").value);
  if (st.pedidosEstado) params.set("estado", st.pedidosEstado);
  return `/admin/pedidos?${params}`;
}

function renderFiltrosDash() {
  const select = $("dash-tienda");
  const actual = select.value;
  select.innerHTML = `<option value="">${esDueno() ? "Todas las tiendas" : "Todas mis tiendas"}</option>`
    + st.tiendas.map(t => `<option value="${t.id}">${escapeHTML(t.nombre)}</option>`).join("");
  select.value = st.tiendas.some(t => String(t.id) === actual) ? actual : "";
}

// Pedidos pendientes y opiniones sin responder en el menú
function renderContadores() {
  const pendientes = st.pedidos.pendientes;
  const sinResponder = st.resenas.filter(r => r.visible && !r.respuesta).length;
  [["nav-pedidos", pendientes], ["nav-resenas", sinResponder]].forEach(([id, n]) => {
    $(id).textContent = n > 99 ? "99+" : String(n);
    $(id).classList.toggle("is-cero", !n);
  });
}

function fechaCorta(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function fechaPedido(iso) {
  return new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function estadoPedido(estado) {
  return `<span class="status-badge is-${estado}">${NOMBRE_ESTADO[estado]}</span>`;
}

function tiendaPedido(p) {
  return p.stand_id ? (p.tienda || "Tienda borrada") : `Paquete: ${p.paquete || "promoción borrada"}`;
}

// "12% más que los 30 días anteriores"
function textoCambio(indicador, dias) {
  const periodo = `los ${dias} días anteriores`;
  if (indicador.cambio === null) return `<div class="kpi-cambio"><span>Sin datos de ${periodo}</span></div>`;
  if (indicador.cambio === 0) return `<div class="kpi-cambio"><span>Igual que ${periodo}</span></div>`;
  const sube = indicador.cambio > 0;
  return `<div class="kpi-cambio ${sube ? "is-sube" : "is-baja"}">${icon(sube ? "trending-up" : "trending-down")}
    <span><strong>${Math.abs(indicador.cambio)}%</strong> ${sube ? "más" : "menos"} que ${periodo}</span></div>`;
}

function kpi(titulo, icono, valor, pie) {
  return `
    <div class="kpi">
      <div class="kpi-head"><span>${titulo}</span><span class="kpi-ico">${icon(icono)}</span></div>
      <div class="kpi-valor">${valor}</div>
      ${pie}
    </div>`;
}

function renderResumen({ animar = false } = {}) {
  const r = st.resumen;
  if (!r) return;
  const i = r.indicadores;
  const cal = i.calificacion;
  $("resumen-kpis").innerHTML = [
    kpi("Pedidos", "receipt", i.pedidos.valor, textoCambio(i.pedidos, r.dias)),
    kpi("Ventas confirmadas", "chart-column", pesos(i.ventas.valor), textoCambio(i.ventas, r.dias)),
    kpi("Ticket promedio", "shopping-cart", pesos(i.ticket.valor), textoCambio(i.ticket, r.dias)),
    kpi("Calificación promedio", "star", cal.valor ? `${cal.valor} de 5` : `<span class="kpi-sin-dato">Sin opiniones</span>`,
      `<div class="kpi-cambio"><span>${cal.nuevas === 1 ? "1 opinión nueva" : `${cal.nuevas} opiniones nuevas`} en el periodo</span></div>`)
  ].join("");

  const totalEstados = r.por_estado.reduce((suma, e) => suma + e.pedidos, 0);
  $("leyenda-estados").innerHTML = totalEstados ? r.por_estado.map(e => `
    <li><span class="punto is-${e.estado}" aria-hidden="true"></span>${NOMBRE_ESTADO[e.estado]}<strong>${e.pedidos}</strong></li>`).join("") : "";

  $("resumen-productos").innerHTML = r.productos.length ? r.productos.map((p, n) => `
    <li>
      <span class="dash-lista-num">${n + 1}</span>
      <span class="dash-lista-nombre">${escapeHTML(p.nombre)}</span>
      <span class="dash-lista-dato"><strong>${p.piezas} ${p.piezas === 1 ? "pieza" : "piezas"}</strong>${money(p.total)}</span>
    </li>`).join("") : `<li class="dash-vacio">Cuando lleguen pedidos, aquí verás lo que más se pide.</li>`;

  $("resumen-recientes").innerHTML = r.recientes.length ? r.recientes.map(p => `
    <tr>
      <td><div class="cell-title">Pedido ${p.id}</div><div class="cell-sub">${escapeHTML(fechaPedido(p.creado_en))}</div></td>
      <td>${escapeHTML(tiendaPedido(p))}</td>
      <td class="cell-price">${money(p.total)}</td>
      <td>${estadoPedido(p.estado)}</td>
    </tr>`).join("") : filaVacia(4, "Aún no hay pedidos. Comparte el enlace de tu tienda para recibir los primeros.");

  const t = r.por_hacer;
  const tareas = [
    [t.pedidos_pendientes, "pedidos", "pedido pendiente de confirmar", "pedidos pendientes de confirmar"],
    [t.opiniones_sin_responder, "resenas", "opinión sin responder", "opiniones sin responder"],
    [t.sin_foto, "productos", "producto con imagen de ejemplo", "productos con imagen de ejemplo"],
    [t.texto_ejemplo, "productos", "producto con texto de ejemplo", "productos con texto de ejemplo"],
    [t.ofertas_por_vencer, "ofertas", "oferta que vence esta semana", "ofertas que vencen esta semana"]
  ].filter(([n]) => n > 0);
  $("resumen-tareas").innerHTML = tareas.length ? tareas.map(([n, panel, uno, varios]) => `
    <li><button type="button" class="btn secondary" data-action="panel" data-panel="${panel}">
      <span><span class="dash-tarea-num">${n}</span> ${n === 1 ? uno : varios}</span>${icon("chevron-right")}
    </button></li>`).join("") : `<li class="dash-vacio">${icon("circle-check")} Todo al día en tus tiendas.</li>`;

  if (st.panel === "resumen") renderGraficas({ animar });
}

// Solo se animan cuando el usuario cambia de tienda o de periodo (plans/CLAUDE.md: movimiento como respuesta)
function renderGraficas({ animar = false } = {}) {
  const r = st.resumen;
  const vacio = mensaje => `<p class="dash-vacio">${mensaje}</p>`;
  const totalPedidos = r.serie.reduce((suma, d) => suma + d.pedidos, 0);

  if (totalPedidos) {
    graficaLinea($("grafica-dias"), {
      titulo: `Pedidos y ventas confirmadas por día, del ${fechaCorta(r.desde)} al ${fechaCorta(r.hasta)}`,
      etiquetas: r.serie.map(d => fechaCorta(d.fecha)),
      pedidos: r.serie.map(d => d.pedidos),
      ventas: r.serie.map(d => d.ventas)
    }, { animar });
  } else {
    $("grafica-dias").innerHTML = vacio("Aún no hay pedidos en este periodo. Comparte el enlace de tu tienda para recibir los primeros.");
  }

  if (r.por_estado.some(e => e.pedidos)) {
    graficaDona($("grafica-estados"), {
      titulo: "Pedidos del periodo por estado",
      etiquetas: r.por_estado.map(e => NOMBRE_ESTADO[e.estado]),
      valores: r.por_estado.map(e => e.pedidos),
      colores: ["senal", "tinta", "linea"]
    }, { animar });
  } else {
    $("grafica-estados").innerHTML = vacio("Sin pedidos en el periodo.");
  }

  if (r.por_tienda.length) {
    graficaBarras($("grafica-tiendas"), {
      titulo: "Pedidos del periodo por tienda",
      etiquetas: r.por_tienda.map(t => t.nombre),
      valores: r.por_tienda.map(t => t.pedidos),
      nombre: "Pedidos"
    }, { animar });
  } else {
    $("grafica-tiendas").innerHTML = vacio("Cuando lleguen pedidos, aquí verás qué tienda vende más.");
  }
}

async function cambiarFiltrosDash() {
  st.pedidosPagina = 1;
  try {
    [st.resumen, st.pedidos] = await Promise.all([api(rutaResumen()), api(rutaPedidos())]);
  } catch (error) {
    return manejarError(error);
  }
  renderResumen({ animar: true });
  renderPedidos();
  renderContadores();
}

// ================= Pedidos =================
function renderPedidos() {
  document.querySelectorAll('#pedidos-estados [data-action="pedidos-estado"]').forEach(btn => {
    const activo = btn.dataset.estado === st.pedidosEstado;
    btn.classList.toggle("secondary", !activo);
    btn.setAttribute("aria-pressed", String(activo));
  });
  const { pedidos, pagina, paginas, total } = st.pedidos;
  $("pedidos-tbody").innerHTML = pedidos.length ? pedidos.map(p => `
    <tr>
      <td>
        <div class="cell-title">Pedido ${p.id}</div>
        <div class="cell-sub">${escapeHTML(fechaPedido(p.creado_en))}</div>
        <div class="cell-sub">${escapeHTML(tiendaPedido(p))}</div>
      </td>
      <td><ul class="pedido-items">${p.items.map(i => `<li>${i.cantidad} × ${escapeHTML(i.nombre)}</li>`).join("")}</ul></td>
      <td class="cell-price">${money(p.total)}<div class="cell-sub">${p.piezas} ${p.piezas === 1 ? "pieza" : "piezas"}</div></td>
      <td>${estadoPedido(p.estado)}${p.nota ? `<div class="pedido-nota">${escapeHTML(p.nota)}</div>` : ""}</td>
      <td class="col-actions"><div class="pedido-acciones">
        ${p.estado !== "vendido" ? `<button type="button" class="btn btn-sm" data-action="pedido-estado" data-id="${p.id}" data-estado="vendido">${icon("check")}Marcar como vendido</button>` : ""}
        ${p.estado === "pendiente" ? `<button type="button" class="btn danger btn-sm" data-action="pedido-estado" data-id="${p.id}" data-estado="cancelado">Cancelar pedido</button>` : ""}
        ${p.estado !== "pendiente" ? `<button type="button" class="btn secondary btn-sm" data-action="pedido-estado" data-id="${p.id}" data-estado="pendiente">Volver a pendiente</button>` : ""}
        <button type="button" class="btn secondary btn-sm btn-icon" data-action="pedido-nota" data-id="${p.id}" aria-label="Agregar nota al pedido ${p.id}" title="Agregar nota">${icon("pencil")}</button>
      </div></td>
    </tr>`).join("") : filaVacia(5, st.pedidosEstado
      ? "No hay pedidos con este estado."
      : "Aún no hay pedidos. Cuando un cliente envíe su carrito por WhatsApp, aparecerá aquí.");
  $("pedidos-paginas").innerHTML = paginas > 1 ? `
    <button type="button" class="btn secondary btn-sm" data-action="pedidos-pagina" data-pagina="${pagina - 1}" ${pagina <= 1 ? "disabled" : ""}>${icon("arrow-left")}Anteriores</button>
    <span>Página ${pagina} de ${paginas} · ${total} pedidos</span>
    <button type="button" class="btn secondary btn-sm" data-action="pedidos-pagina" data-pagina="${pagina + 1}" ${pagina >= paginas ? "disabled" : ""}>Siguientes${icon("chevron-right")}</button>` : "";
}

async function cargarPedidos() {
  try {
    st.pedidos = await api(rutaPedidos());
  } catch (error) {
    return manejarError(error);
  }
  renderPedidos();
  renderContadores();
}

async function guardarPedido(id, cambios, aviso) {
  try {
    await api(`/admin/pedidos/${id}`, { method: "PUT", body: cambios });
    await recargar("pedidos");
    showToast(aviso);
  } catch (error) {
    manejarError(error);
  }
}

function notaPedido(id) {
  const pedido = st.pedidos.pedidos.find(p => p.id === id);
  if (!pedido) return;
  const nota = prompt(`Nota del pedido ${id} (hasta 200 caracteres). Déjala vacía para quitarla.`, pedido.nota || "");
  if (nota === null) return;
  guardarPedido(id, { nota: nota.slice(0, 200) }, nota.trim() ? `Nota guardada en el pedido ${id}` : `Nota quitada del pedido ${id}`);
}

// ================= Tiendas =================
function renderTiendas() {
  const form = $("form-tienda");
  $("tienda-icono").innerHTML = st.iconos.map(n => `<option value="${n}">${escapeHTML(NOMBRES_ICONOS[n] || n)}</option>`).join("");
  if (st.editando.tienda) campo(form, "icono").value = st.editando.tienda.icono;

  $("tiendas-tbody").innerHTML = st.tiendas.length ? st.tiendas.map(t => `
    <tr>
      <td><div class="cell-title">${icon(t.icono)} ${escapeHTML(t.nombre)}</div><div class="cell-sub">${escapeHTML(t.whatsapp.length ? `${t.whatsapp.length} número(s) de WhatsApp` : "Usa los números generales")}</div></td>
      <td><a href="/t/${escapeHTML(t.slug)}">/t/${escapeHTML(t.slug)}</a></td>
      <td>${estadoBadge(t.visible, "Visible", "Oculta")}</td>
      <td>${Number(t.productos)}</td>
      <td class="col-actions">${botonesFila("tienda", t.id, t.nombre, { borrar: esDueno() })}</td>
    </tr>`).join("") : filaVacia(5, esDueno() ? "Todavía no hay tiendas. Crea la primera abajo." : "No tienes tiendas asignadas. Pídele a un dueño que te asigne una.");

  // Selects de tienda en todos los formularios
  const selects = [["sub-tienda", false], ["prod-tienda", false], ["prod-filtro", true], ["oferta-tienda", false], ["oferta-filtro", true], ["resena-filtro", true]];
  for (const [id, todas] of selects) {
    const select = $(id);
    const actual = select.value;
    select.innerHTML = opcionesTiendas(actual, { todas });
    if (actual && [...select.options].some(o => o.value === actual)) select.value = actual;
  }
}

function editarTienda(id) {
  const t = tiendaPorId(id);
  if (!t) return;
  const form = $("form-tienda");
  st.editando.tienda = t;
  campo(form, "nombre").value = t.nombre;
  campo(form, "slug").value = t.slug;
  campo(form, "descripcion").value = t.descripcion;
  campo(form, "icono").value = t.icono;
  campo(form, "whatsapp").value = t.whatsapp.join(", ");
  campo(form, "orden").value = t.orden;
  campo(form, "visible").checked = t.visible;
  campo(form, "quitar_imagen").checked = false;
  modoEdicion(form, "tienda", true, "Crear tienda", `Editar tienda: ${t.nombre}`);
  $("tienda-card").hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelarTienda() {
  st.editando.tienda = null;
  const form = $("form-tienda");
  form.reset();
  modoEdicion(form, "tienda", false, "Crear tienda", "");
  renderAcceso();
}

async function guardarTienda(event) {
  event.preventDefault();
  const form = event.currentTarget;
  await enviar(form, async () => {
    const body = {
      nombre: campo(form, "nombre").value,
      slug: campo(form, "slug").value,
      descripcion: campo(form, "descripcion").value,
      icono: campo(form, "icono").value,
      whatsapp: campo(form, "whatsapp").value,
      orden: campo(form, "orden").value,
      visible: campo(form, "visible").checked,
      quitar_imagen: campo(form, "quitar_imagen").checked,
      imagen: await leerImagen(campo(form, "imagen"))
    };
    const editando = st.editando.tienda;
    const guardada = editando
      ? await api(`/admin/tiendas/${editando.id}`, { method: "PUT", body })
      : await api("/admin/tiendas", { method: "POST", body });
    cancelarTienda();
    await recargar("tiendas");
    showToast(`${editando ? "Tienda actualizada" : "Tienda creada"}: ${guardada.nombre}`);
  });
}

async function borrarTienda(id) {
  const t = tiendaPorId(id);
  if (!t || !confirm(`¿Eliminar la tienda "${t.nombre}"? Solo se puede si ya no tiene productos.`)) return;
  try {
    await api(`/admin/tiendas/${t.id}`, { method: "DELETE" });
    await recargar("tiendas");
    showToast(`Tienda eliminada: ${t.nombre}`);
  } catch (error) {
    manejarError(error);
  }
}

// ================= Subcategorías =================
function renderSubcategorias() {
  const tienda = tiendaPorId($("sub-tienda").value) || st.tiendas[0];
  const lista = $("sub-list");
  $("form-subcategoria").hidden = !tienda;
  if (!tienda) {
    lista.innerHTML = "";
    return;
  }
  lista.innerHTML = tienda.subcategorias.length ? tienda.subcategorias.map(s => `
    <li>
      <div class="sub-row">
        <div class="form-group"><label class="visually-hidden" for="sub-n-${s.id}">Nombre</label><input id="sub-n-${s.id}" value="${escapeHTML(s.nombre)}" maxlength="60"></div>
        <div class="form-group"><label class="visually-hidden" for="sub-o-${s.id}">Orden</label><input id="sub-o-${s.id}" type="number" min="0" max="9999" value="${Number(s.orden)}" title="Orden"></div>
        <div class="sub-actions">
          <button type="button" class="btn secondary btn-sm" data-action="sub-guardar" data-id="${s.id}">Guardar</button>
          <button type="button" class="btn danger btn-sm btn-icon" data-action="sub-borrar" data-id="${s.id}" aria-label="Eliminar ${escapeHTML(s.nombre)}" title="Eliminar">${icon("trash-2")}</button>
        </div>
      </div>
    </li>`).join("") : `<li><div class="sub-row"><span class="form-hint">Esta tienda todavía no tiene subcategorías.</span></div></li>`;
}

async function agregarSubcategoria(event) {
  event.preventDefault();
  const form = event.currentTarget;
  await enviar(form, async () => {
    const standId = $("sub-tienda").value;
    const sub = await api(`/admin/tiendas/${standId}/subcategorias`, {
      method: "POST", body: { nombre: campo(form, "nombre").value, orden: 0 }
    });
    form.reset();
    await recargar("tiendas");
    showToast(`Subcategoría creada: ${sub.nombre}`);
  });
}

async function guardarSubcategoria(id) {
  try {
    await api(`/admin/subcategorias/${id}`, {
      method: "PUT", body: { nombre: $(`sub-n-${id}`).value, orden: $(`sub-o-${id}`).value }
    });
    await recargar("tiendas", "productos");
    showToast("Subcategoría guardada.");
  } catch (error) {
    manejarError(error);
  }
}

async function borrarSubcategoria(id) {
  if (!confirm("¿Eliminar esta subcategoría? Sus productos se quedan en la tienda, sin subcategoría.")) return;
  try {
    await api(`/admin/subcategorias/${id}`, { method: "DELETE" });
    await recargar("tiendas", "productos", "ofertas");
    showToast("Subcategoría eliminada.");
  } catch (error) {
    manejarError(error);
  }
}

// ================= Productos y servicios =================
function actualizarFormProducto() {
  const form = $("form-producto");
  const servicio = campo(form, "tipo").value === "servicio";
  $("prod-modo-group").hidden = !servicio;
  if (!servicio) campo(form, "precio_modo").value = "fijo";
  const cotizar = servicio && campo(form, "precio_modo").value === "cotizar";
  $("prod-precio-group").hidden = cotizar;
  campo(form, "precio").required = !cotizar;
}

function renderProductos() {
  const form = $("form-producto");
  const sub = campo(form, "subcategoria_id");
  const actualSub = st.editando.producto ? st.editando.producto.subcategoria_id : sub.value;
  sub.innerHTML = opcionesSubcategorias(campo(form, "stand_id").value, actualSub);
  actualizarFormProducto();

  const filtro = Number($("prod-filtro").value) || null;
  const lista = st.productos.filter(p => !filtro || p.stand_id === filtro);
  $("productos-tbody").innerHTML = lista.length ? lista.map(p => `
    <tr>
      <td><img class="admin-thumb" src="${escapeHTML(imagenDe(p))}" alt=""></td>
      <td><div class="cell-title">${escapeHTML(p.nombre)}</div><div class="cell-sub">${p.tipo === "servicio" ? "Servicio" : "Producto"}${p.subcategoria ? ` · ${escapeHTML(p.subcategoria)}` : ""}${p.colores.length ? ` · ${p.colores.length} ${p.colores.length === 1 ? "color" : "colores"}` : ""}</div></td>
      <td>${escapeHTML(p.stand)}</td>
      <td class="cell-price">${escapeHTML(textoPrecio(p))}</td>
      <td>${estadoBadge(p.visible)}${p.disponibilidad !== "Disponible" ? ` <span class="status-badge">${escapeHTML(p.disponibilidad)}</span>` : ""}</td>
      <td class="col-actions">${botonesFila("producto", p.id, p.nombre)}</td>
    </tr>`).join("") : filaVacia(6, "Todavía no hay productos aquí. Agrega el primero con el formulario de arriba.");
  renderColores();
}

// ================= Colores de un producto =================
// Solo mientras se edita un producto (no servicio): se agregan uno por uno, cada uno con su foto
function productoConColores() {
  const editando = st.editando.producto;
  if (!editando) return null;
  const p = st.productos.find(x => x.id === editando.id);
  return p && p.tipo === "producto" ? p : null;
}

function renderColores() {
  const p = productoConColores();
  $("colores-card").hidden = !p;
  if (!p) return;
  $("colores-title").textContent = `Colores de ${p.nombre}`;
  $("color-list").innerHTML = p.colores.length ? p.colores.map(c => `
    <li class="sub-row color-row">
      <img class="admin-thumb" src="${escapeHTML(c.imagen_url || imagenDe(p))}" alt="">
      <span class="color-nombre"><span class="color-muestra" data-hex="${escapeHTML(c.hex)}"></span><span class="cell-title">${escapeHTML(c.nombre)}</span></span>
      ${estadoBadge(c.disponible, "Disponible", "Agotado")}
      <span class="sub-actions">
        <button type="button" class="btn secondary btn-sm btn-icon" data-action="color-editar" data-id="${c.id}" aria-label="Editar el color ${escapeHTML(c.nombre)}" title="Editar">${icon("pencil")}</button>
        <button type="button" class="btn danger btn-sm btn-icon" data-action="color-borrar" data-id="${c.id}" aria-label="Eliminar el color ${escapeHTML(c.nombre)}" title="Eliminar">${icon("trash-2")}</button>
      </span>
    </li>`).join("") : `<li class="sub-row color-row-vacia"><span class="form-hint">Este producto todavía no tiene colores. Agrega el primero abajo.</span></li>`;
  pintarMuestras($("color-list"));
}

function modoColor(editando) {
  $("color-submit-texto").textContent = editando ? "Guardar color" : "Agregar color";
  $("color-imagen-hint").textContent = editando ? "Déjala vacía para conservar la foto actual." : "Obligatoria para un color nuevo.";
  document.querySelector('[data-action="color-cancelar"]').hidden = !editando;
}

function editarColor(id) {
  const p = productoConColores();
  const c = p && p.colores.find(x => x.id === id);
  if (!c) return;
  st.editando.color = c;
  const form = $("form-color");
  campo(form, "nombre").value = c.nombre;
  campo(form, "hex").value = c.hex;
  campo(form, "orden").value = c.orden;
  campo(form, "disponible").checked = c.disponible;
  campo(form, "imagen").value = "";
  modoColor(true);
  campo(form, "nombre").focus();
}

function cancelarColor() {
  st.editando.color = null;
  const form = $("form-color");
  form.reset();
  const p = productoConColores();
  campo(form, "orden").value = p ? p.colores.length : 0;
  modoColor(false);
}

async function guardarColor(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const p = productoConColores();
  if (!p) return;
  await enviar(form, async () => {
    const body = {
      nombre: campo(form, "nombre").value,
      hex: campo(form, "hex").value,
      orden: campo(form, "orden").value,
      disponible: campo(form, "disponible").checked,
      imagen: await leerImagen(campo(form, "imagen"))
    };
    const editando = st.editando.color;
    if (!editando && !body.imagen) throw new Error("Sube la foto del producto en ese color.");
    const guardado = editando
      ? await api(`/admin/colores/${editando.id}`, { method: "PUT", body })
      : await api(`/admin/productos/${p.id}/colores`, { method: "POST", body });
    await recargar("productos");
    cancelarColor();
    showToast(`${editando ? "Color actualizado" : "Color agregado"}: ${guardado.nombre}`);
  });
}

async function borrarColor(id) {
  const p = productoConColores();
  const c = p && p.colores.find(x => x.id === id);
  if (!c || !confirm(`¿Eliminar el color "${c.nombre}" de ${p.nombre}?`)) return;
  try {
    await api(`/admin/colores/${c.id}`, { method: "DELETE" });
    if (st.editando.color && st.editando.color.id === c.id) cancelarColor();
    await recargar("productos");
    showToast(`Color eliminado: ${c.nombre}`);
  } catch (error) {
    manejarError(error);
  }
}

function editarProducto(id) {
  const p = st.productos.find(x => x.id === id);
  if (!p) return;
  const form = $("form-producto");
  st.editando.producto = p;
  campo(form, "stand_id").value = p.stand_id;
  campo(form, "tipo").value = p.tipo;
  campo(form, "nombre").value = p.nombre;
  campo(form, "precio_modo").value = p.precio_modo;
  campo(form, "precio").value = p.precio ?? "";
  campo(form, "disponibilidad").value = p.disponibilidad;
  campo(form, "orden").value = p.orden;
  campo(form, "descripcion").value = p.descripcion;
  campo(form, "visible").checked = p.visible;
  campo(form, "quitar_imagen").checked = false;
  renderProductos();
  cancelarColor();
  modoEdicion(form, "producto", true, "Agregar producto o servicio", `Editar: ${p.nombre}`);
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelarProducto() {
  st.editando.producto = null;
  st.editando.color = null;
  const form = $("form-producto");
  const tienda = campo(form, "stand_id").value;
  form.reset();
  campo(form, "stand_id").value = tienda;
  modoEdicion(form, "producto", false, "Agregar producto o servicio", "");
  renderProductos();
}

async function guardarProducto(event) {
  event.preventDefault();
  const form = event.currentTarget;
  await enviar(form, async () => {
    const body = {
      stand_id: campo(form, "stand_id").value,
      tipo: campo(form, "tipo").value,
      nombre: campo(form, "nombre").value,
      subcategoria_id: campo(form, "subcategoria_id").value,
      precio_modo: campo(form, "precio_modo").value,
      precio: campo(form, "precio").value,
      disponibilidad: campo(form, "disponibilidad").value,
      orden: campo(form, "orden").value,
      descripcion: campo(form, "descripcion").value,
      visible: campo(form, "visible").checked,
      quitar_imagen: campo(form, "quitar_imagen").checked,
      imagen: await leerImagen(campo(form, "imagen"))
    };
    const editando = st.editando.producto;
    const guardado = editando
      ? await api(`/admin/productos/${editando.id}`, { method: "PUT", body })
      : await api("/admin/productos", { method: "POST", body });
    cancelarProducto();
    await recargar("productos", "tiendas");
    showToast(`${editando ? "Actualizado" : "Guardado"}: ${guardado.nombre}`);
    // Un producto nuevo se queda abierto para agregarle sus colores
    if (!editando && body.tipo === "producto") {
      editarProducto(guardado.id);
      $("colores-card").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

async function borrarProducto(id) {
  const p = st.productos.find(x => x.id === id);
  if (!p || !confirm(`¿Eliminar "${p.nombre}"? También se quita de sus ofertas y promociones.`)) return;
  try {
    await api(`/admin/productos/${p.id}`, { method: "DELETE" });
    if (st.editando.producto && st.editando.producto.id === p.id) cancelarProducto();
    await recargar("productos", "tiendas", "ofertas", ...(esDueno() ? ["promos"] : []));
    showToast(`Eliminado: ${p.nombre}`);
  } catch (error) {
    manejarError(error);
  }
}

// ================= Ofertas de la tienda =================
function actualizarFormOferta() {
  const form = $("form-oferta");
  const standId = campo(form, "stand_id").value;
  const aplica = campo(form, "aplica").value;
  const tipo = campo(form, "tipo").value;
  const editando = st.editando.oferta;

  $("oferta-sub-group").hidden = aplica !== "subcategoria";
  $("oferta-prod-group").hidden = aplica !== "producto";
  const sub = campo(form, "subcategoria_id");
  const subActual = editando ? editando.subcategoria_id : sub.value;
  sub.innerHTML = opcionesSubcategorias(standId, subActual, "Elige una subcategoría");
  const prod = campo(form, "producto_id");
  const prodActual = editando ? editando.producto_id : prod.value;
  prod.innerHTML = `<option value="">Elige un producto</option>` + st.productos
    .filter(p => p.stand_id === Number(standId) && p.tipo === "producto")
    .map(p => `<option value="${p.id}"${Number(prodActual) === p.id ? " selected" : ""}>${escapeHTML(p.nombre)} (${money(p.precio)})</option>`).join("");

  // Semanal: días. Temporada: nombre y fechas. Remate: fecha límite y piezas (opcionales).
  const clase = campo(form, "clase").value;
  $("oferta-dias-group").hidden = clase !== "semanal";
  $("oferta-temporada-group").hidden = clase !== "temporada";
  $("oferta-temporada-otra-group").hidden = clase !== "temporada" || $("oferta-temporada").value !== "otra";
  $("oferta-inicio-group").hidden = clase !== "temporada";
  $("oferta-fin-group").hidden = clase === "semanal";
  $("oferta-piezas-group").hidden = clase !== "remate";
  $("oferta-fin-label").textContent = clase === "remate" ? "Fecha límite (opcional)" : "Fecha de fin";
  campo(form, "inicio").required = clase === "temporada";
  campo(form, "fin").required = clase === "temporada";
  $("oferta-temporada-otra").required = !$("oferta-temporada-otra-group").hidden;

  const valor = campo(form, "valor");
  $("oferta-valor-group").hidden = tipo === "dos_por_uno";
  if (tipo === "porcentaje") {
    $("oferta-valor-label").textContent = "Descuento (%)";
    Object.assign(valor, { min: 1, max: 90, step: 1, placeholder: "Ej. 15" });
  } else {
    $("oferta-valor-label").textContent = "Precio especial (MXN)";
    Object.assign(valor, { min: 1, max: 99999999, step: 0.5, placeholder: "Ej. 25.00" });
  }
  valor.required = tipo !== "dos_por_uno";
}

function textoAplica(o) {
  if (o.producto) return o.producto;
  if (o.subcategoria) return `Subcategoría: ${o.subcategoria}`;
  return "Toda la tienda";
}

function textoValor(o) {
  if (o.tipo === "porcentaje") return `${o.valor}% de descuento`;
  if (o.tipo === "precio_especial") return `Precio especial: ${money(o.valor)}`;
  return "2x1";
}

// "Lunes y miércoles", "Navidad: 1 de diciembre al 25 de diciembre", "Hasta que se acabe · 5 piezas"
function textoCuando(o) {
  if (o.clase === "temporada") return `${o.temporada}: ${fechaCorta(o.inicio)} al ${fechaCorta(o.fin)}`;
  if (o.clase === "remate") {
    return [o.fin ? `Hasta el ${fechaCorta(o.fin)}` : "Hasta que se acabe", o.piezas ? `${o.piezas} piezas` : ""].filter(Boolean).join(" · ");
  }
  return o.dias_texto;
}

function estadoOferta(o) {
  if (o.fin && o.fin < hoyISO()) return estadoBadge(false, "", "Vencida");
  return estadoBadge(o.activa, "Activa", "Pausada");
}

function renderOfertas() {
  actualizarFormOferta();
  const filtro = Number($("oferta-filtro").value) || null;
  const clase = $("oferta-clase-filtro").value;
  const lista = st.ofertas.filter(o => (!filtro || o.stand_id === filtro) && (!clase || o.clase === clase));
  $("ofertas-tbody").innerHTML = lista.length ? lista.map(o => `
    <tr>
      <td><div class="cell-title">${escapeHTML(o.titulo)}</div><div class="cell-sub">${escapeHTML(NOMBRE_CLASE_OFERTA[o.clase])} · ${escapeHTML(textoValor(o))}</div></td>
      <td>${escapeHTML(o.stand)}</td>
      <td>${escapeHTML(textoAplica(o))}</td>
      <td>${escapeHTML(textoCuando(o))}</td>
      <td>${estadoOferta(o)}</td>
      <td class="col-actions">${botonesFila("oferta", o.id, o.titulo)}</td>
    </tr>`).join("") : filaVacia(6, st.ofertas.length ? "No hay ofertas con ese filtro." : "Todavía no hay ofertas. Crea la primera con el formulario de arriba.");
}

function editarOferta(id) {
  const o = st.ofertas.find(x => x.id === id);
  if (!o) return;
  const form = $("form-oferta");
  st.editando.oferta = o;
  campo(form, "stand_id").value = o.stand_id;
  campo(form, "titulo").value = o.titulo;
  campo(form, "aplica").value = o.producto_id ? "producto" : o.subcategoria_id ? "subcategoria" : "tienda";
  campo(form, "tipo").value = o.tipo;
  campo(form, "clase").value = o.clase;
  const conocida = [...$("oferta-temporada").options].some(op => op.value === o.temporada);
  $("oferta-temporada").value = !o.temporada || conocida ? (o.temporada || "Navidad") : "otra";
  $("oferta-temporada-otra").value = o.temporada && !conocida ? o.temporada : "";
  campo(form, "inicio").value = o.inicio || "";
  campo(form, "fin").value = o.fin || "";
  campo(form, "piezas").value = o.piezas ?? "";
  campo(form, "valor").value = o.valor ?? "";
  campo(form, "descripcion").value = o.descripcion;
  campo(form, "activa").checked = o.activa;
  form.querySelectorAll('input[name="dias"]').forEach(c => { c.checked = o.dias.includes(Number(c.value)); });
  actualizarFormOferta();
  modoEdicion(form, "oferta", true, "Crear oferta de la tienda", `Editar oferta: ${o.titulo}`);
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelarOferta() {
  st.editando.oferta = null;
  const form = $("form-oferta");
  const tienda = campo(form, "stand_id").value;
  form.reset();
  campo(form, "stand_id").value = tienda;
  modoEdicion(form, "oferta", false, "Crear oferta de la tienda", "");
  actualizarFormOferta();
}

async function guardarOferta(event) {
  event.preventDefault();
  const form = event.currentTarget;
  await enviar(form, async () => {
    const body = {
      stand_id: campo(form, "stand_id").value,
      titulo: campo(form, "titulo").value,
      aplica: campo(form, "aplica").value,
      subcategoria_id: campo(form, "subcategoria_id").value,
      producto_id: campo(form, "producto_id").value,
      tipo: campo(form, "tipo").value,
      valor: campo(form, "valor").value,
      clase: campo(form, "clase").value,
      temporada: $("oferta-temporada").value === "otra" ? $("oferta-temporada-otra").value : $("oferta-temporada").value,
      inicio: campo(form, "inicio").value,
      fin: campo(form, "fin").value,
      piezas: campo(form, "piezas").value,
      dias: marcados(form, "dias").map(Number),
      descripcion: campo(form, "descripcion").value,
      activa: campo(form, "activa").checked
    };
    const editando = st.editando.oferta;
    const guardada = editando
      ? await api(`/admin/ofertas/${editando.id}`, { method: "PUT", body })
      : await api("/admin/ofertas", { method: "POST", body });
    cancelarOferta();
    await recargar("ofertas");
    showToast(`${editando ? "Oferta actualizada" : "Oferta creada"}: ${guardada.titulo}`);
  });
}

async function borrarOferta(id) {
  const o = st.ofertas.find(x => x.id === id);
  if (!o || !confirm(`¿Eliminar la oferta "${o.titulo}"?`)) return;
  try {
    await api(`/admin/ofertas/${o.id}`, { method: "DELETE" });
    if (st.editando.oferta && st.editando.oferta.id === o.id) cancelarOferta();
    await recargar("ofertas");
    showToast(`Oferta eliminada: ${o.titulo}`);
  } catch (error) {
    manejarError(error);
  }
}

// ================= Opiniones de los clientes =================
function estrellasFila(n) {
  const iconos = [1, 2, 3, 4, 5].map(i => (i <= n ? icon("star-fill", "star is-on") : icon("star", "star"))).join("");
  return `<span class="rating" role="img" aria-label="${n} de 5 estrellas">${iconos}</span>`;
}

function fechaOpinion(iso) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

function recortar(texto, max) {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}

function renderResenas() {
  const filtro = Number($("resena-filtro").value) || null;
  const lista = st.resenas.filter(r => !filtro || r.stand_id === filtro);
  $("resenas-tbody").innerHTML = lista.length ? lista.map(r => `
    <tr>
      <td>${estrellasFila(r.calificacion)}<div class="cell-sub">${escapeHTML(recortar(r.comentario, 140))}</div></td>
      <td><div class="cell-title"><a href="/p/${Number(r.producto_id)}">${escapeHTML(r.producto)}</a></div><div class="cell-sub">${escapeHTML(r.stand)}</div></td>
      <td><div class="cell-title">${escapeHTML(r.cliente)}</div><div class="cell-sub">${escapeHTML(fechaOpinion(r.creado_en))}</div></td>
      <td>${estadoBadge(r.visible, "Visible", "Oculta")}${r.respuesta ? `<div class="cell-sub">Respondida</div>` : ""}</td>
      <td class="col-actions">
        <button type="button" class="btn secondary btn-sm btn-icon" data-action="editar" data-tipo="resena" data-id="${r.id}" aria-label="Responder la opinión de ${escapeHTML(r.cliente)}" title="Responder">${icon("message-circle")}</button>
      </td>
    </tr>`).join("") : filaVacia(5, "Todavía no hay opiniones de clientes en tus tiendas.");
}

function editarResena(id) {
  const r = st.resenas.find(x => x.id === id);
  if (!r) return;
  st.editando.resena = r;
  const form = $("form-resena");
  $("resena-detalle").innerHTML = `
    <div class="opinion-head">
      <span class="opinion-autor">${escapeHTML(r.cliente)}</span>
      ${estrellasFila(r.calificacion)}
      <span class="opinion-fecha">${escapeHTML(r.producto)} · ${escapeHTML(fechaOpinion(r.creado_en))}</span>
    </div>
    <p>${escapeHTML(r.comentario)}</p>`;
  campo(form, "respuesta").value = r.respuesta || "";
  campo(form, "visible").checked = r.visible;
  $("resena-card").hidden = false;
  $("resena-card").scrollIntoView({ behavior: "smooth", block: "start" });
  campo(form, "respuesta").focus({ preventScroll: true });
}

function cancelarResena() {
  st.editando.resena = null;
  $("form-resena").reset();
  $("resena-card").hidden = true;
}

async function guardarResena(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const r = st.editando.resena;
  if (!r) return;
  await enviar(form, async () => {
    await api(`/admin/resenas/${r.id}`, {
      method: "PUT",
      body: { respuesta: campo(form, "respuesta").value, visible: campo(form, "visible").checked }
    });
    cancelarResena();
    await recargar("resenas");
    showToast(`Opinión de ${r.cliente} guardada`);
  });
}

// ================= Promociones generales =================
function hoyISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
}

function filaItemPaquete(item = {}) {
  const opciones = st.tiendas.map(t => {
    const productos = st.productos.filter(p => p.stand_id === t.id && p.tipo === "producto");
    if (!productos.length) return "";
    return `<optgroup label="${escapeHTML(t.nombre)}">${productos.map(p =>
      `<option value="${p.id}"${item.producto_id === p.id ? " selected" : ""}>${escapeHTML(p.nombre)} (${money(p.precio)})</option>`).join("")}</optgroup>`;
  }).join("");
  const n = document.querySelectorAll("#promo-items .pack-row").length + 1;
  return `
    <div class="pack-row">
      <div class="form-group"><label class="visually-hidden" for="pack-p-${n}">Producto</label><select id="pack-p-${n}" data-item="producto" required><option value="">Elige un producto</option>${opciones}</select></div>
      <div class="form-group"><label class="visually-hidden" for="pack-c-${n}">Cantidad</label><input id="pack-c-${n}" data-item="cantidad" type="number" min="1" max="99" value="${Number(item.cantidad) || 1}" title="Cantidad"></div>
      <button type="button" class="btn danger btn-sm btn-icon" data-action="promo-item-quitar" aria-label="Quitar producto del paquete" title="Quitar">${icon("x")}</button>
    </div>`;
}

function estadoPromo(p) {
  const hoy = hoyISO();
  if (!p.activa) return estadoBadge(false, "", "Pausada");
  if (p.fin < hoy) return estadoBadge(false, "", "Terminó");
  if (p.inicio > hoy) return `<span class="status-badge">Programada</span>`;
  return estadoBadge(true, "Vigente");
}

function renderPromos() {
  $("promos-tbody").innerHTML = st.promos.length ? st.promos.map(p => `
    <tr>
      <td><div class="cell-title">${escapeHTML(p.titulo)}</div><div class="cell-sub">${p.destacada ? "Destacada en la portada" : "Solo en Promociones"}</div></td>
      <td>${escapeHTML(fechaCorta(p.inicio))} al ${escapeHTML(fechaCorta(p.fin))}</td>
      <td class="cell-price">${money(p.precio)}</td>
      <td>${p.items.map(i => `${i.cantidad} × ${escapeHTML(i.nombre)} <span class="cell-sub">(${escapeHTML(i.stand)})</span>`).join("<br>")}</td>
      <td>${estadoPromo(p)}</td>
      <td class="col-actions">${botonesFila("promo", p.id, p.titulo)}</td>
    </tr>`).join("") : filaVacia(6, "Todavía no hay promociones. Crea la primera con el formulario de arriba.");
  const items = $("promo-items");
  if (!items.children.length) items.innerHTML = filaItemPaquete();
}

function editarPromo(id) {
  const p = st.promos.find(x => x.id === id);
  if (!p) return;
  const form = $("form-promo");
  st.editando.promo = p;
  campo(form, "titulo").value = p.titulo;
  campo(form, "precio").value = p.precio;
  campo(form, "inicio").value = p.inicio;
  campo(form, "fin").value = p.fin;
  campo(form, "descripcion").value = p.descripcion;
  campo(form, "destacada").checked = p.destacada;
  campo(form, "activa").checked = p.activa;
  campo(form, "quitar_imagen").checked = false;
  $("promo-items").innerHTML = "";
  p.items.forEach(item => $("promo-items").insertAdjacentHTML("beforeend", filaItemPaquete(item)));
  modoEdicion(form, "promo", true, "Crear promoción de temporada", `Editar promoción: ${p.titulo}`);
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelarPromo() {
  st.editando.promo = null;
  const form = $("form-promo");
  form.reset();
  campo(form, "inicio").value = hoyISO();
  $("promo-items").innerHTML = filaItemPaquete();
  modoEdicion(form, "promo", false, "Crear promoción de temporada", "");
}

async function guardarPromo(event) {
  event.preventDefault();
  const form = event.currentTarget;
  await enviar(form, async () => {
    const items = [...document.querySelectorAll("#promo-items .pack-row")].map(fila => ({
      producto_id: Number(fila.querySelector('[data-item="producto"]').value),
      cantidad: Number(fila.querySelector('[data-item="cantidad"]').value)
    })).filter(i => i.producto_id);
    const body = {
      titulo: campo(form, "titulo").value,
      precio: campo(form, "precio").value,
      inicio: campo(form, "inicio").value,
      fin: campo(form, "fin").value,
      descripcion: campo(form, "descripcion").value,
      destacada: campo(form, "destacada").checked,
      activa: campo(form, "activa").checked,
      quitar_imagen: campo(form, "quitar_imagen").checked,
      imagen: await leerImagen(campo(form, "imagen")),
      items
    };
    const editando = st.editando.promo;
    const guardada = editando
      ? await api(`/admin/promociones/${editando.id}`, { method: "PUT", body })
      : await api("/admin/promociones", { method: "POST", body });
    cancelarPromo();
    await recargar("promos");
    showToast(`${editando ? "Promoción actualizada" : "Promoción creada"}: ${guardada.titulo}`);
  });
}

async function borrarPromo(id) {
  const p = st.promos.find(x => x.id === id);
  if (!p || !confirm(`¿Eliminar la promoción "${p.titulo}"?`)) return;
  try {
    await api(`/admin/promociones/${p.id}`, { method: "DELETE" });
    if (st.editando.promo && st.editando.promo.id === p.id) cancelarPromo();
    await recargar("promos");
    showToast(`Promoción eliminada: ${p.titulo}`);
  } catch (error) {
    manejarError(error);
  }
}

// ================= Usuarios =================
function actualizarFormUsuario() {
  const form = $("form-usuario");
  $("usuario-tiendas-group").hidden = campo(form, "rol").value !== "encargado";
}

function renderUsuarios() {
  const form = $("form-usuario");
  const asignadas = st.editando.usuario ? st.editando.usuario.tiendas : marcados(form, "tiendas").map(Number);
  $("usuario-tiendas").innerHTML = st.tiendas.map(t =>
    `<label><input type="checkbox" name="tiendas" value="${t.id}"${asignadas.includes(t.id) ? " checked" : ""}> ${escapeHTML(t.nombre)}</label>`).join("");
  actualizarFormUsuario();

  $("usuarios-tbody").innerHTML = st.usuarios.map(u => `
    <tr>
      <td><div class="cell-title">${escapeHTML(u.usuario)}</div>${u.correo ? `<div class="cell-sub">${escapeHTML(u.correo)}</div>` : ""}${u.id === st.sesion.id ? `<div class="cell-sub">Tú</div>` : ""}</td>
      <td>${u.rol === "dueno" ? "Dueño" : "Encargado"}</td>
      <td>${u.rol === "dueno" ? "Todas" : escapeHTML(u.tiendas.map(id => (tiendaPorId(id) || {}).nombre).filter(Boolean).join(", ") || "Ninguna")}</td>
      <td>${estadoBadge(u.activo, "Activa", "Desactivada")}${u.totp_activo ? `<div class="cell-sub">Con verificación en dos pasos</div>` : ""}</td>
      <td class="col-actions">${botonesFila("usuario", u.id, u.usuario, { borrar: false })}</td>
    </tr>`).join("");
}

function editarUsuario(id) {
  const u = st.usuarios.find(x => x.id === id);
  if (!u) return;
  const form = $("form-usuario");
  st.editando.usuario = u;
  reiniciarCampos(form);
  campo(form, "usuario").value = u.usuario;
  campo(form, "usuario").disabled = true;
  campo(form, "correo").value = u.correo || "";
  campo(form, "password").value = "";
  campo(form, "confirmar").value = "";
  campo(form, "password").dispatchEvent(new Event("input"));
  campo(form, "password").required = false;
  $("usuario-password-label").textContent = "Contraseña nueva (opcional)";
  $("usuario-confirmar-label").textContent = "Repite la contraseña nueva";
  campo(form, "rol").value = u.rol;
  campo(form, "activo").checked = u.activo;
  campo(form, "quitar_2fa").checked = false;
  $("usuario-2fa-group").hidden = !u.totp_activo || u.id === st.sesion.id;
  renderUsuarios();
  modoEdicion(form, "usuario", true, "Crear usuario", `Editar usuario: ${u.usuario}`);
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelarUsuario() {
  st.editando.usuario = null;
  const form = $("form-usuario");
  form.reset();
  reiniciarCampos(form);
  campo(form, "usuario").disabled = false;
  campo(form, "password").required = true;
  $("usuario-password-label").textContent = "Contraseña";
  $("usuario-confirmar-label").textContent = "Repite la contraseña";
  $("usuario-2fa-group").hidden = true;
  modoEdicion(form, "usuario", false, "Crear usuario", "");
  renderUsuarios();
}

async function guardarUsuario(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(await validarFormulario(form))) return;
  await enviar(form, async () => {
    const editando = st.editando.usuario;
    const password = campo(form, "password").value;
    const body = {
      rol: campo(form, "rol").value,
      tiendas: marcados(form, "tiendas").map(Number),
      password: password || undefined,
      confirmar: password ? campo(form, "confirmar").value : undefined
    };
    // Al editar, el correo solo se manda si cambió (si no, el servidor no lo vuelve a revisar)
    const correo = campo(form, "correo").value.trim();
    if (!editando || correo !== (editando.correo || "")) body.correo = correo;
    const guardado = editando
      ? await api(`/admin/usuarios/${editando.id}`, {
        method: "PUT", body: { ...body, activo: campo(form, "activo").checked, quitar_2fa: campo(form, "quitar_2fa").checked }
      })
      : await api("/admin/usuarios", { method: "POST", body: { ...body, usuario: campo(form, "usuario").value } });
    cancelarUsuario();
    await recargar("usuarios");
    showToast(`${editando ? "Usuario actualizado" : "Usuario creado"}: ${guardado.usuario}`);
  });
}

// ================= Mi cuenta =================
async function cambiarPassword(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(await validarFormulario(form))) return;
  await enviar(form, async () => {
    await api("/admin/mi-password", {
      method: "PUT",
      body: { actual: campo(form, "actual").value, nueva: campo(form, "nueva").value, confirmar: campo(form, "confirmar").value }
    });
    form.reset();
    reiniciarCampos(form);
    showToast("Contraseña cambiada.");
  });
}

async function guardarMiCorreo(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(await validarFormulario(form))) return;
  await enviar(form, async () => {
    const { correo } = await api("/admin/mi-correo", {
      method: "PUT", body: { correo: campo(form, "correo").value.trim(), password: campo(form, "password").value }
    });
    st.sesion.correo = correo;
    campo(form, "password").value = "";
    reiniciarCampos(form);
    renderMiCorreo();
    showToast(correo ? "Correo guardado." : "Correo quitado.");
  });
}

// Validación en vivo de Usuarios y Mi cuenta (validacion.js). Contraseñas de admin: 12 caracteres o más.
const MIN_PASSWORD_ADMIN = 12; // igual que server/admin.js
const correoOpcional = valor => (valor.trim() ? revisarCorreo(valor) : { ok: true, mensaje: "" });
const correoOpcionalEnVivo = valor => (valor.trim() ? revisarCorreoEnVivo(valor) : { ok: null, mensaje: "" });

function prepararValidacion() {
  const usuario = $("form-usuario");
  prepararCampo(campo(usuario, "usuario"), valor => revisarUsuario(valor, 50));
  // Al editar, el correo que ya tenía no se vuelve a revisar (si su dominio dejó de existir, igual se puede guardar)
  const sinCambio = valor => st.editando.usuario && valor.trim().toLowerCase() === (st.editando.usuario.correo || "");
  prepararCampo(campo(usuario, "correo"), valor => (sinCambio(valor) ? { ok: true, mensaje: "" } : correoOpcional(valor)),
    { enVivo: valor => (sinCambio(valor) ? { ok: true, mensaje: "" } : correoOpcionalEnVivo(valor)) });
  prepararPassword(campo(usuario, "password"), {
    minimo: MIN_PASSWORD_ADMIN, confirmar: campo(usuario, "confirmar"), opcional: () => Boolean(st.editando.usuario)
  });
  const cuenta = $("form-cuenta");
  prepararCampo(campo(cuenta, "actual"), valor => (valor ? { ok: true, mensaje: "" } : { ok: false, mensaje: "Escribe tu contraseña actual." }));
  prepararPassword(campo(cuenta, "nueva"), { minimo: MIN_PASSWORD_ADMIN, confirmar: campo(cuenta, "confirmar") });
  const correo = $("form-mi-correo");
  prepararCampo(campo(correo, "correo"), correoOpcional, { enVivo: correoOpcionalEnVivo });
  prepararCampo(campo(correo, "password"), valor => (valor ? { ok: true, mensaje: "" } : { ok: false, mensaje: "Escribe tu contraseña para confirmar el cambio." }));
}

// ================= Bitácora (solo dueños) =================
async function cargarBitacora() {
  try {
    const params = new URLSearchParams({ pagina: st.bitacoraPagina });
    if (st.bitacoraUsuario) params.set("usuario", st.bitacoraUsuario);
    st.bitacora = await api(`/admin/bitacora?${params}`);
    renderBitacora();
  } catch (error) {
    manejarError(error);
  }
}

function renderBitacora() {
  const select = $("bitacora-usuario");
  select.innerHTML = `<option value="">Todos</option>` + (st.usuarios || []).map(u =>
    `<option value="${u.id}"${String(u.id) === st.bitacoraUsuario ? " selected" : ""}>${escapeHTML(u.usuario)}</option>`).join("");
  const { registros, pagina, paginas, total } = st.bitacora;
  $("bitacora-tbody").innerHTML = registros.length ? registros.map(r => `
    <tr>
      <td>${escapeHTML(fechaPedido(r.creado_en))}</td>
      <td>${escapeHTML(r.usuario)}</td>
      <td>${escapeHTML(r.accion.charAt(0).toUpperCase() + r.accion.slice(1))} · ${escapeHTML(NOMBRE_TABLA[r.tabla] || r.tabla)}${r.registro_id ? ` ${r.registro_id}` : ""}</td>
      <td>${escapeHTML(r.resumen)}</td>
    </tr>`).join("") : filaVacia(4, "Aún no hay movimientos registrados.");
  $("bitacora-paginas").innerHTML = paginas > 1 ? `
    <button type="button" class="btn secondary btn-sm" data-action="bitacora-pagina" data-pagina="${pagina - 1}" ${pagina <= 1 ? "disabled" : ""}>${icon("arrow-left")}Anteriores</button>
    <span>Página ${pagina} de ${paginas} · ${total} movimientos</span>
    <button type="button" class="btn secondary btn-sm" data-action="bitacora-pagina" data-pagina="${pagina + 1}" ${pagina >= paginas ? "disabled" : ""}>Siguientes${icon("chevron-right")}</button>` : "";
}

async function cancelarPedidosViejos() {
  if (!confirm("¿Cancelar todos los pedidos pendientes de más de 7 días? Puedes volver a ponerlos como pendientes uno por uno.")) return;
  try {
    const { cancelados } = await api("/admin/pedidos/cancelar-viejos", { method: "POST" });
    await recargar("pedidos");
    showToast(cancelados ? `Pedidos cancelados: ${cancelados}` : "No había pedidos pendientes de más de 7 días.");
  } catch (error) {
    manejarError(error);
  }
}

// ================= Verificación en dos pasos =================
function renderMiCorreo() {
  const correo = st.sesion && st.sesion.correo;
  $("mi-correo").value = correo || "";
  $("mi-correo-estado").textContent = correo
    ? `Puedes iniciar sesión con tu usuario o con ${correo}. Para quitarlo, deja el campo vacío.`
    : "Con tu correo también puedes iniciar sesión en Necutools. Es opcional.";
}

function render2fa() {
  renderMiCorreo();
  const activa = Boolean(st.sesion && st.sesion.totp_activo);
  $("estado-2fa").textContent = activa
    ? "Está activa: al entrar, Necutools te pide el código de tu celular. Para quitarla escribe tu contraseña y un código."
    : "Además de tu contraseña, Necutools te pedirá un código de tu celular. Así nadie entra aunque sepa tu contraseña.";
  $("form-2fa-iniciar").hidden = activa;
  $("form-2fa-desactivar").hidden = !activa;
  $("form-2fa-activar").hidden = true;
  $("tfa-respaldo").hidden = true;
}

async function iniciar2fa(event) {
  event.preventDefault();
  const form = event.currentTarget;
  await enviar(form, async () => {
    const { secreto, enlace } = await api("/admin/2fa/iniciar", { method: "POST", body: { password: campo(form, "password").value } });
    form.reset();
    form.hidden = true;
    $("tfa-secreto").textContent = secreto.match(/.{1,4}/g).join(" ");
    $("tfa-enlace").href = enlace;
    $("form-2fa-activar").hidden = false;
    $("tfa-codigo").focus();
  });
}

async function activar2fa(event) {
  event.preventDefault();
  const form = event.currentTarget;
  await enviar(form, async () => {
    const { respaldo } = await api("/admin/2fa/activar", { method: "POST", body: { codigo: campo(form, "codigo").value } });
    form.reset();
    form.hidden = true;
    st.sesion.totp_activo = true;
    $("estado-2fa").textContent = "Está activa: al entrar, Necutools te pedirá el código de tu celular.";
    $("tfa-respaldo-lista").innerHTML = respaldo.map(c => `<li>${escapeHTML(c)}</li>`).join("");
    $("tfa-respaldo").hidden = false;
    showToast("Verificación en dos pasos activada.");
  });
}

async function desactivar2fa(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!confirm("¿Desactivar la verificación en dos pasos? Tu cuenta quedará protegida solo con la contraseña.")) return;
  await enviar(form, async () => {
    await api("/admin/2fa/desactivar", {
      method: "POST", body: { password: campo(form, "password").value, codigo: campo(form, "codigo").value }
    });
    form.reset();
    st.sesion.totp_activo = false;
    render2fa();
    showToast("Verificación en dos pasos desactivada.");
  });
}

// ================= Eventos =================
const EDITAR = { tienda: editarTienda, producto: editarProducto, oferta: editarOferta, resena: editarResena, promo: editarPromo, usuario: editarUsuario };
const BORRAR = { tienda: borrarTienda, producto: borrarProducto, oferta: borrarOferta, promo: borrarPromo };
const CANCELAR = { tienda: cancelarTienda, producto: cancelarProducto, oferta: cancelarOferta, resena: cancelarResena, promo: cancelarPromo, usuario: cancelarUsuario };

Object.assign(ACCIONES, {
  logout: () => cerrarSesion(),
  "codigo-volver": () => mostrarCodigo(false),
  "2fa-cancelar": () => render2fa(),
  "2fa-guardados": () => {
    $("tfa-respaldo-lista").innerHTML = "";
    render2fa();
  },
  panel: el => mostrarPanel(el.dataset.panel),
  "pedidos-estado": el => {
    st.pedidosEstado = el.dataset.estado;
    st.pedidosPagina = 1;
    cargarPedidos();
  },
  "pedidos-pagina": el => {
    st.pedidosPagina = Number(el.dataset.pagina);
    cargarPedidos();
  },
  "pedido-estado": el => {
    const id = Number(el.dataset.id);
    const estado = el.dataset.estado;
    if (estado === "cancelado" && !confirm(`¿Cancelar el pedido ${id}? Puedes volver a ponerlo como pendiente después.`)) return;
    const avisos = { vendido: "Pedido marcado como vendido", cancelado: "Pedido cancelado", pendiente: "Pedido marcado como pendiente" };
    guardarPedido(id, { estado }, `${avisos[estado]}: ${id}`);
  },
  "pedido-nota": el => notaPedido(Number(el.dataset.id)),
  "pedidos-cancelar-viejos": () => cancelarPedidosViejos(),
  "bitacora-pagina": el => {
    st.bitacoraPagina = Number(el.dataset.pagina);
    cargarBitacora();
  },
  editar: el => EDITAR[el.dataset.tipo](Number(el.dataset.id)),
  borrar: el => BORRAR[el.dataset.tipo](Number(el.dataset.id)),
  cancelar: el => CANCELAR[el.dataset.form](),
  "color-editar": el => editarColor(Number(el.dataset.id)),
  "color-borrar": el => borrarColor(Number(el.dataset.id)),
  "color-cancelar": () => cancelarColor(),
  "sub-guardar": el => guardarSubcategoria(Number(el.dataset.id)),
  "sub-borrar": el => borrarSubcategoria(Number(el.dataset.id)),
  "promo-item-agregar": () => $("promo-items").insertAdjacentHTML("beforeend", filaItemPaquete()),
  "promo-item-quitar": el => {
    if (document.querySelectorAll("#promo-items .pack-row").length > 1) el.closest(".pack-row").remove();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  $("admin-login-form").addEventListener("submit", iniciarSesion);
  $("form-tienda").addEventListener("submit", guardarTienda);
  $("form-subcategoria").addEventListener("submit", agregarSubcategoria);
  $("form-producto").addEventListener("submit", guardarProducto);
  $("form-color").addEventListener("submit", guardarColor);
  $("form-oferta").addEventListener("submit", guardarOferta);
  $("form-resena").addEventListener("submit", guardarResena);
  $("form-promo").addEventListener("submit", guardarPromo);
  $("form-usuario").addEventListener("submit", guardarUsuario);
  $("form-cuenta").addEventListener("submit", cambiarPassword);
  $("form-mi-correo").addEventListener("submit", guardarMiCorreo);
  prepararValidacion();
  $("admin-codigo-form").addEventListener("submit", enviarCodigo);
  $("form-2fa-iniciar").addEventListener("submit", iniciar2fa);
  $("form-2fa-activar").addEventListener("submit", activar2fa);
  $("form-2fa-desactivar").addEventListener("submit", desactivar2fa);

  $("sub-tienda").addEventListener("change", renderSubcategorias);
  $("prod-filtro").addEventListener("change", renderProductos);
  $("oferta-filtro").addEventListener("change", renderOfertas);
  $("oferta-clase-filtro").addEventListener("change", renderOfertas);
  $("resena-filtro").addEventListener("change", renderResenas);
  $("dash-tienda").addEventListener("change", cambiarFiltrosDash);
  $("dash-periodo").addEventListener("change", cambiarFiltrosDash);
  $("oferta-temporada").addEventListener("change", actualizarFormOferta);
  $("oferta-clase").addEventListener("change", () => {
    const form = $("form-oferta");
    if (campo(form, "clase").value === "temporada" && !campo(form, "inicio").value) campo(form, "inicio").value = hoyISO();
    actualizarFormOferta();
  });
  $("prod-tienda").addEventListener("change", () => {
    if (st.editando.producto) st.editando.producto = { ...st.editando.producto, subcategoria_id: null };
    renderProductos();
  });
  $("prod-tipo").addEventListener("change", actualizarFormProducto);
  $("prod-modo").addEventListener("change", actualizarFormProducto);
  ["oferta-tienda", "oferta-aplica", "oferta-tipo"].forEach(id => $(id).addEventListener("change", () => {
    if (st.editando.oferta) st.editando.oferta = { ...st.editando.oferta, producto_id: null, subcategoria_id: null };
    actualizarFormOferta();
  }));
  $("usuario-rol").addEventListener("change", actualizarFormUsuario);
  $("bitacora-usuario").addEventListener("change", event => {
    st.bitacoraUsuario = event.target.value;
    st.bitacoraPagina = 1;
    cargarBitacora();
  });
  $("tienda-nombre").addEventListener("input", event => {
    if (!st.editando.tienda) {
      $("tienda-slug").placeholder = event.target.value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "Se arma sola con el nombre";
    }
  });

  campo($("form-promo"), "inicio").value = hoyISO();
  mostrarPanel("resumen");
  cargarTodo();
});
