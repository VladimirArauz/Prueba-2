/**
 * NECUTLA — Carrito agrupado por tienda.
 * Los precios y las ofertas los calcula el servidor (/api/carrito/precios);
 * cada grupo se envía por WhatsApp a los vendedores de su tienda.
 */

let grupos = [];
// Pedidos ya registrados en esta visita: no se duplican si se vuelve a tocar el botón
const registrados = new Set();

function filaItem(item) {
  const clave = `${item.tipo}-${item.id}`;
  const descuento = item.subtotal < item.subtotal_base;
  return `
    <div class="cart-row">
      <div>
        <div class="cart-item-title">${escapeHTML(item.nombre)}</div>
        <div class="cart-item-store">${money(item.precio)} c/u</div>
        ${item.oferta ? `<div class="cart-item-tags"><span class="tag-oferta">${icon("tag")}${escapeHTML(item.oferta)}</span></div>` : ""}
      </div>
      <div class="cart-col-center">
        <div class="qty-control">
          <button type="button" data-action="cantidad" data-tipo="${item.tipo}" data-id="${item.id}" data-delta="-1" aria-label="Quitar uno de ${escapeHTML(item.nombre)}">${icon("minus")}</button>
          <span class="qty-value">${item.cantidad}</span>
          <button type="button" data-action="cantidad" data-tipo="${item.tipo}" data-id="${item.id}" data-delta="1" aria-label="Agregar uno de ${escapeHTML(item.nombre)}">${icon("plus")}</button>
        </div>
      </div>
      <div class="cart-col-right subtotal">
        ${money(item.subtotal)}
        ${descuento ? `<div><s class="price-old">${money(item.subtotal_base)}</s></div>` : ""}
      </div>
      <div class="cart-col-center">
        <button type="button" class="btn danger btn-sm btn-icon" data-action="quitar" data-claves="${clave}" aria-label="Eliminar ${escapeHTML(item.nombre)}" title="Eliminar">
          ${icon("trash-2")}
        </button>
      </div>
    </div>`;
}

function grupoHTML(grupo) {
  const esPaquete = grupo.tipo === "paquete";
  const destino = esPaquete
    ? `Paquete de temporada. Se avisa a ${grupo.tiendas.join(" y ")}.`
    : `Pedido para los vendedores de ${grupo.nombre}.`;
  const incluye = esPaquete
    ? `<p>Incluye: ${grupo.incluye.map(i => `${i.cantidad} × ${escapeHTML(i.nombre)}`).join(", ")}</p>` : "";
  return `
    <section class="cart-group" aria-label="${escapeHTML(grupo.nombre)}">
      <div class="cart-group-head">
        <div>
          <h3>${icon(esPaquete ? "gift" : "store")}${escapeHTML(grupo.nombre)}</h3>
          <p>${escapeHTML(destino)}</p>
          ${incluye}
        </div>
        ${grupo.slug ? `<a class="btn ghost btn-sm" href="/t/${escapeHTML(grupo.slug)}">Ver tienda</a>` : ""}
      </div>
      ${grupo.items.map(filaItem).join("")}
      <div class="cart-totals">
        ${grupo.descuento > 0 ? `
          <div class="total-line"><span>Subtotal</span><span>${money(grupo.subtotal_base)}</span></div>
          <div class="total-line"><span>Ofertas de hoy</span><span>−${money(grupo.descuento)}</span></div>` : ""}
        <div class="total-line total-final"><span>Total</span><span>${money(grupo.total)}</span></div>
      </div>
      <div class="cart-group-actions">
        <button type="button" class="btn wa" data-action="enviar" data-clave="${escapeHTML(grupo.clave)}">
          ${icon("message-circle")}Enviar pedido a ${escapeHTML(grupo.nombre)} por WhatsApp
        </button>
      </div>
      <p class="cart-privacidad">Guardamos el pedido sin tus datos para que la tienda le dé seguimiento.</p>
      <div data-enviado="${escapeHTML(grupo.clave)}"></div>
    </section>`;
}

function renderVacio() {
  document.getElementById("cart-summary").hidden = true;
  document.getElementById("cart-groups").innerHTML = `
    <div class="cart-items-card">
      <div class="cart-empty">
        ${icon("shopping-cart", "icon-lg")}
        <h3>Tu carrito está vacío</h3>
        <p>Entra a una tienda y agrega lo que quieras pedir.</p>
        <a class="btn" href="/">Ver tiendas</a>
      </div>
    </div>`;
}

function render() {
  if (!grupos.length) return renderVacio();
  document.getElementById("cart-summary").hidden = false;
  document.getElementById("cart-groups").innerHTML = grupos.map(grupoHTML).join("");
  const total = grupos.reduce((suma, g) => suma + g.total, 0);
  document.getElementById("cart-total-amount").textContent = money(total);
}

async function cargar() {
  const items = leerCarrito();
  if (!items.length) {
    grupos = [];
    return render();
  }
  try {
    const respuesta = await api("/carrito/precios", { method: "POST", body: { items } });
    grupos = respuesta.grupos;
    if (respuesta.faltantes.length) {
      quitarDelCarrito(respuesta.faltantes.map(f => `${f.tipo}-${f.id}`));
      document.getElementById("cart-alert").innerHTML = `
        <div class="notice">${icon("info")}<span>Quitamos ${respuesta.faltantes.length === 1 ? "1 producto que ya no está disponible" : `${respuesta.faltantes.length} productos que ya no están disponibles`}.</span></div>`;
    }
    render();
  } catch (error) {
    document.getElementById("cart-groups").innerHTML = `
      <div class="notice">${icon("info")}<span>${escapeHTML(error.message)}</span></div>`;
  }
}

function mensajeDe(grupo) {
  const nombre = document.getElementById("order-customer-name").value.trim();
  const notas = document.getElementById("order-customer-notes").value.trim();
  let mensaje = `*¡Hola ${grupo.nombre}! Vi su catálogo en Necutla y quisiera hacer este pedido:*\n\n`;
  if (nombre) mensaje += `👤 *Cliente:* ${nombre}\n`;
  mensaje += `📅 *Fecha:* ${new Date().toLocaleDateString("es-MX")}\n\n`;
  if (grupo.tipo === "paquete") {
    mensaje += `🎁 *Paquete:* ${grupo.nombre} x${grupo.items[0].cantidad} = ${money(grupo.total)}\n`;
    mensaje += `Incluye: ${grupo.incluye.map(i => `${i.cantidad} × ${i.nombre} (${i.tienda})`).join(", ")}\n`;
  } else {
    mensaje += `🛒 *Pedido:*\n`;
    grupo.items.forEach(item => {
      mensaje += `• *${item.nombre}* x${item.cantidad} = ${money(item.subtotal)}`;
      if (item.oferta) mensaje += ` (oferta: ${item.oferta})`;
      mensaje += "\n";
    });
    if (grupo.descuento > 0) mensaje += `\n🏷️ *Ahorro por ofertas de hoy:* ${money(grupo.descuento)}\n`;
  }
  mensaje += `\n💰 *Total:* ${money(grupo.total)}\n`;
  if (notas) mensaje += `\n📝 *Indicaciones:* ${notas}\n`;
  mensaje += `\nQuedo a la espera de confirmación y de cómo hacemos la entrega y el pago. ¡Gracias!`;
  return mensaje;
}

// Guarda el pedido para el resumen de Necutools. No bloquea ni avisa si falla: WhatsApp ya se abrió.
function registrarPedido(grupo) {
  const items = grupo.items.map(i => ({ tipo: i.tipo, id: i.id, cantidad: i.cantidad }));
  const firma = `${grupo.clave}|${items.map(i => `${i.tipo}-${i.id}x${i.cantidad}`).join(",")}`;
  if (registrados.has(firma)) return;
  registrados.add(firma);
  api("/pedidos", { method: "POST", body: { clave: grupo.clave, items } }).catch(() => registrados.delete(firma));
}

function enviar(clave) {
  const grupo = grupos.find(g => g.clave === clave);
  if (!grupo) return;
  const contenedor = document.querySelector(`[data-enviado="${CSS.escape(clave)}"]`);
  if (!abrirWhatsApp(grupo.whatsapp, mensajeDe(grupo), contenedor)) return;
  registrarPedido(grupo);
  const claves = grupo.items.map(i => `${i.tipo}-${i.id}`).join(",");
  contenedor.insertAdjacentHTML("beforeend", `
    <div class="form-actions">
      <button type="button" class="btn secondary btn-sm" data-action="quitar" data-claves="${escapeHTML(claves)}">
        ${icon("check")}Ya lo envié: quitar del carrito
      </button>
    </div>`);
}

Object.assign(ACCIONES, {
  cantidad: el => {
    cambiarCantidad(el.dataset.tipo, Number(el.dataset.id), Number(el.dataset.delta));
    cargar();
  },
  quitar: el => {
    quitarDelCarrito(el.dataset.claves.split(","));
    cargar();
  },
  vaciar: () => {
    if (!confirm("¿Quieres vaciar todo el carrito?")) return;
    guardarCarrito([]);
    cargar();
    showToast("Carrito vaciado.");
  },
  enviar: el => enviar(el.dataset.clave)
});

document.addEventListener("DOMContentLoaded", cargar);
