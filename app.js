/**
 * NECUTLA — LA CIUDAD DEL ESTUDIANTE
 * Lógica principal de navegación, Carrito y Panel Necutools
 */

// ================= CONFIGURACIÓN WHATSAPP =================
const WHATSAPP_NUMBERS = [
  "525500000001",
  "525500000002",
  "525500000003"
];
// ==========================================================

const CART_STORAGE_KEY = "necutla_carrito_global";
const ADMIN_STORAGE_KEY = "necutools_productos_admin";

// Inicializar datos del carrito
function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [
      { name: "Playera Estudiantil Necutla", store: "Ropa", price: 250, qty: 1 },
      { name: "Cuaderno Profesional Cuadrícula", store: "Papelería", price: 45, qty: 2 }
    ];
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  updateCartCounters();
}

// Inicializar productos de Necutools
function getAdminProducts() {
  try {
    const saved = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
    return [
      { id: "P-101", name: "Playera Oficial Necutla", store: "Ropa", category: "Playeras", price: 250, stock: "Disponible", date: "Hoy" },
      { id: "P-102", name: "Memoria USB 64GB Kingston", store: "Tecnología", category: "Gadgets", price: 180, stock: "Pocas piezas", date: "Ayer" },
      { id: "P-103", name: "Set Marcatextos Pastel (6 pzas)", store: "Papelería", category: "Escritura", price: 95, stock: "Disponible", date: "16 Sep" },
      { id: "P-104", name: "Caja Chocolates Artesanales", store: "Dulces", category: "Chocolates", price: 120, stock: "Disponible", date: "14 Sep" }
    ];
  } catch (e) {
    return [];
  }
}

function saveAdminProducts(products) {
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(products));
}

// Formateador de moneda MXN
function money(amount) {
  return "$" + Number(amount).toFixed(2) + " MXN";
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}

// ================= NAVEGACIÓN ENTRE SECCIONES =================
function showSection(sectionId) {
  // Ocultar todas las secciones
  const sections = document.querySelectorAll('.app-section');
  sections.forEach(sec => sec.classList.remove('active-section'));

  // Mostrar la sección seleccionada
  const target = document.getElementById(sectionId);
  if (target) {
    target.classList.add('active-section');
  }

  // Actualizar estado activo en botones de la Navbar
  const buttons = document.querySelectorAll('.nav-btn');
  buttons.forEach(btn => btn.classList.remove('active'));

  if (sectionId === 'sec-tienda') {
    document.getElementById('nav-btn-tienda')?.classList.add('active');
  } else if (sectionId === 'sec-carrito') {
    document.getElementById('nav-btn-carrito')?.classList.add('active');
    renderCart();
  } else if (sectionId === 'sec-necutools') {
    document.getElementById('nav-btn-necutools')?.classList.add('active');
    renderAdminTable();
  }

  // Desplazamiento suave al inicio de la sección en móviles si es necesario
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ================= GESTIÓN DEL CARRITO =================
function updateCartCounters() {
  const cart = getCart();
  const totalCount = cart.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  
  // Actualizar todas las insignias de contador en la página
  document.querySelectorAll('.cart-count, #nav-cart-count').forEach(el => {
    el.textContent = totalCount;
  });

  // Animación suave de pulso en el badge de la navbar
  const pill = document.querySelector('.cart-pill');
  if (pill) {
    pill.style.transform = "scale(1.25)";
    setTimeout(() => { pill.style.transform = "scale(1)"; }, 180);
  }
}

function addToCartDirect(name, store, price) {
  const cart = getCart();
  const existing = cart.find(item => item.name === name && item.store === store);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      name: name,
      store: store,
      price: Number(price),
      qty: 1
    });
  }

  saveCart(cart);
  showToast(`🛒 "${name}" agregado al Carrito`);
}

function changeCartQty(index, delta) {
  const cart = getCart();
  if (!cart[index]) return;

  cart[index].qty += delta;
  if (cart[index].qty <= 0) {
    cart.splice(index, 1);
  }

  saveCart(cart);
  renderCart();
}

function removeCartItem(index) {
  const cart = getCart();
  if (!cart[index]) return;

  const removedName = cart[index].name;
  cart.splice(index, 1);
  saveCart(cart);
  renderCart();
  showToast(`Eliminado: "${removedName}"`);
}

function clearCartAll() {
  if (!confirm("¿Deseas vaciar todos los productos del carrito?")) return;
  saveCart([]);
  renderCart();
  showToast("El carrito ha sido vaciado.");
}

function renderCart() {
  const container = document.getElementById("cart-items-list");
  const totalEl = document.getElementById("cart-total-amount");
  if (!container) return;

  const cart = getCart();

  if (!cart.length) {
    container.innerHTML = `
      <div style="text-align:center; padding: 40px 20px;">
        <div style="font-size: 3.5rem; margin-bottom: 12px;">🛒</div>
        <h3 style="color:#ffffff; margin-bottom: 8px;">Tu carrito está vacío</h3>
        <p style="color:var(--text-muted); margin-bottom: 20px;">Aún no has seleccionado productos. Explora nuestras tiendas y agrega lo que necesites.</p>
        <button class="btn" onclick="showSection('sec-tienda')">Ver Tiendas Disponibles</button>
      </div>
    `;
    if (totalEl) totalEl.textContent = money(0);
    return;
  }

  let grandTotal = 0;
  let html = `
    <div class="cart-table-head">
      <span>Producto</span>
      <span style="text-align:center;">Cantidad</span>
      <span style="text-align:right;">Subtotal</span>
      <span style="text-align:center;">Acción</span>
    </div>
  `;

  cart.forEach((item, idx) => {
    const subtotal = item.price * item.qty;
    grandTotal += subtotal;

    html += `
      <div class="cart-row">
        <div>
          <div class="cart-item-title">${escapeHTML(item.name)}</div>
          <div class="cart-item-store">🏷️ Tienda: ${escapeHTML(item.store || "General")} • ${money(item.price)} c/u</div>
        </div>
        <div style="text-align:center;">
          <div class="qty-control">
            <button type="button" onclick="changeCartQty(${idx}, -1)">−</button>
            <span class="qty-value">${item.qty}</span>
            <button type="button" onclick="changeCartQty(${idx}, 1)">+</button>
          </div>
        </div>
        <div style="text-align:right;" class="subtotal">${money(subtotal)}</div>
        <div style="text-align:center;">
          <button type="button" class="btn secondary btn-sm" onclick="removeCartItem(${idx})" title="Eliminar este producto" style="color:var(--red-main); border-color:rgba(230,57,70,0.3);">
            ✕
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  if (totalEl) totalEl.textContent = money(grandTotal);
}

// Envío a los 3 WhatsApps configurados
function sendOrderToWhatsApps() {
  const cart = getCart();
  if (!cart.length) {
    alert("El carrito está vacío. Agrega al menos un producto antes de enviar tu pedido.");
    return;
  }

  const nameInput = document.getElementById("order-customer-name");
  const notesInput = document.getElementById("order-customer-notes");

  const name = nameInput ? nameInput.value.trim() : "";
  const notes = notesInput ? notesInput.value.trim() : "";

  let total = 0;
  let message = `*¡Hola Necutla! Quisiera realizar el siguiente pedido:*\n\n`;
  if (name) message += `👤 *Cliente:* ${name}\n`;
  message += `📅 *Fecha:* ${new Date().toLocaleDateString('es-MX')}\n\n`;
  message += `🛒 *DETALLE DEL PEDIDO:*\n`;

  cart.forEach(item => {
    const sub = item.price * item.qty;
    total += sub;
    message += `• *${item.name}* (${item.store}) x${item.qty} = ${money(sub)}\n`;
  });

  message += `\n💰 *TOTAL APROXIMADO:* ${money(total)}\n`;
  if (notes) message += `\n📝 *Notas adicionales:* ${notes}\n`;
  message += `\nQuedo a la espera de confirmación y métodos de entrega/pago. ¡Gracias!`;

  const urls = WHATSAPP_NUMBERS.map(phone => 
    `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`
  );

  alert(`Se preparó tu pedido por ${money(total)}. A continuación se abrirán los 3 chats de WhatsApp correspondientes. En cada uno solo pulsa "Enviar".`);
  urls.forEach((u, i) => setTimeout(() => window.open(u, "_blank"), i * 650));
}

// ================= PANEL ADMIN NECUTOOLS =================
function renderAdminTable() {
  const tbody = document.getElementById("admin-products-tbody");
  if (!tbody) return;

  const products = getAdminProducts();
  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 24px; color: var(--text-muted);">No hay productos registrados aún en Necutools.</td></tr>`;
    return;
  }

  let html = "";
  products.forEach((prod, index) => {
    html += `
      <tr>
        <td><strong>${escapeHTML(prod.id || "#" + (index + 1))}</strong></td>
        <td>
          <div style="font-weight:700; color:#ffffff;">${escapeHTML(prod.name)}</div>
          <div style="font-size:0.78rem; color:var(--text-muted);">${escapeHTML(prod.category || "-")}</div>
        </td>
        <td><span style="color:var(--yellow-main); font-weight:600;">${escapeHTML(prod.store)}</span></td>
        <td><strong style="color:#ffffff;">${money(prod.price)}</strong></td>
        <td><span class="status-badge active">${escapeHTML(prod.stock || "Disponible")}</span></td>
        <td>${escapeHTML(prod.date || "Reciente")}</td>
        <td style="text-align:center;">
          <button type="button" class="btn secondary btn-sm" onclick="deleteAdminProduct(${index})" style="color:var(--red-main); border-color:rgba(230,57,70,0.3); padding:4px 10px;">
            Eliminar
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function handleAddAdminProduct(e) {
  e.preventDefault();

  const storeSelect = document.getElementById("admin-prod-store");
  const catInput = document.getElementById("admin-prod-cat");
  const nameInput = document.getElementById("admin-prod-name");
  const priceInput = document.getElementById("admin-prod-price");
  const stockSelect = document.getElementById("admin-prod-stock");
  const descInput = document.getElementById("admin-prod-desc");

  if (!nameInput.value.trim() || !priceInput.value) {
    alert("Por favor completa al menos el nombre y precio del producto.");
    return;
  }

  const newProduct = {
    id: "P-" + Math.floor(100 + Math.random() * 900),
    name: nameInput.value.trim(),
    store: storeSelect.value,
    category: catInput.value.trim() || "General",
    price: parseFloat(priceInput.value),
    stock: stockSelect.value,
    desc: descInput.value.trim(),
    date: "Hoy"
  };

  const products = getAdminProducts();
  products.unshift(newProduct);
  saveAdminProducts(products);

  // Limpiar campos
  nameInput.value = "";
  priceInput.value = "";
  catInput.value = "";
  descInput.value = "";

  renderAdminTable();
  showToast(`⚡ ¡Producto "${newProduct.name}" guardado exitosamente en ${newProduct.store}!`);
}

function deleteAdminProduct(index) {
  const products = getAdminProducts();
  if (!products[index]) return;

  const deletedName = products[index].name;
  if (!confirm(`¿Eliminar "${deletedName}" del catálogo de Necutools?`)) return;

  products.splice(index, 1);
  saveAdminProducts(products);
  renderAdminTable();
  showToast(`Producto "${deletedName}" eliminado de Necutools.`);
}

// ================= NOTIFICACIÓN TOAST =================
function showToast(message) {
  let toast = document.getElementById("app-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "app-toast";
    toast.className = "toast-notice";
    document.body.appendChild(toast);
  }

  toast.innerHTML = `<span style="font-size:1.25rem;">✨</span><span>${escapeHTML(message)}</span>`;
  toast.classList.add("show");

  clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

// ================= INICIALIZACIÓN =================
document.addEventListener("DOMContentLoaded", () => {
  updateCartCounters();
  renderCart();
  renderAdminTable();

  // Listener para el formulario de administración
  const adminForm = document.getElementById("admin-add-product-form");
  if (adminForm) {
    adminForm.addEventListener("submit", handleAddAdminProduct);
  }
});
