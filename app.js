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
const ADMIN_ACCOUNT_KEY = "necutools_admin_account";
const ADMIN_SESSION_KEY = "necutools_admin_session";
const ADMIN_STORES_KEY = "necutools_admin_stores";
const DEFAULT_STORES = ["Ropa", "Tecnología", "Dulces", "Propaganda", "Papelería", "Regalos", "Otra"];
let editingProductId = null;

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

function getAdminStores() {
  try {
    const saved = localStorage.getItem(ADMIN_STORES_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_STORES;
  } catch (e) {
    return DEFAULT_STORES;
  }
}

function saveAdminStores(stores) {
  localStorage.setItem(ADMIN_STORES_KEY, JSON.stringify(stores));
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
  if (sectionId === "sec-necutools" && sessionStorage.getItem(ADMIN_SESSION_KEY) !== "active") {
    renderAdminAccess();
  }
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
    if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "active") renderAdminTable();
  } else if (sectionId === 'sec-productos') {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
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
          <button type="button" class="btn secondary btn-sm" onclick="editAdminProduct('${escapeHTML(prod.id)}')">Editar</button>
          <button type="button" class="btn secondary btn-sm" onclick="deleteAdminProduct(${index})" style="color:var(--red-main); border-color:rgba(230,57,70,0.3); padding:4px 10px;">
            Eliminar
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

async function handleAddAdminProduct(e) {
  e.preventDefault();

  const storeSelect = document.getElementById("admin-prod-store");
  const catInput = document.getElementById("admin-prod-cat");
  const nameInput = document.getElementById("admin-prod-name");
  const priceInput = document.getElementById("admin-prod-price");
  const stockSelect = document.getElementById("admin-prod-stock");
  const descInput = document.getElementById("admin-prod-desc");
  const imageInput = document.getElementById("admin-prod-img");

  if (!nameInput.value.trim() || !priceInput.value) {
    alert("Por favor completa al menos el nombre y precio del producto.");
    return;
  }

  const products = getAdminProducts();
  const existing = editingProductId ? products.find(product => product.id === editingProductId) : null;
  let image = existing?.img || "";
  const imageFile = imageInput.files[0];
  if (imageFile) {
    if (!imageFile.type.startsWith("image/") || imageFile.size > 1024 * 1024) {
      alert("Selecciona una imagen de hasta 1 MB.");
      return;
    }
    image = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(imageFile);
    }).catch(() => "");
    if (!image) {
      alert("No se pudo leer la imagen seleccionada.");
      return;
    }
  }

  const newProduct = {
    id: existing?.id || "P-" + Date.now(),
    name: nameInput.value.trim(),
    store: storeSelect.value,
    category: catInput.value.trim() || "General",
    price: parseFloat(priceInput.value),
    stock: stockSelect.value,
    desc: descInput.value.trim(),
    img: image,
    date: "Hoy"
  };

  if (existing) {
    products[products.findIndex(product => product.id === editingProductId)] = newProduct;
  } else {
    products.unshift(newProduct);
  }
  try {
    saveAdminProducts(products);
  } catch (error) {
    alert("No hay espacio disponible para guardar los cambios. Prueba con una imagen más pequeña.");
    return;
  }

  // Limpiar campos
  nameInput.value = "";
  priceInput.value = "";
  catInput.value = "";
  descInput.value = "";
  imageInput.value = "";

  cancelEditAdminProduct();
  renderAdminTable();
  renderPublicCatalog();
  showToast(`Producto "${newProduct.name}" ${existing ? "actualizado" : "guardado"} en ${newProduct.store}.`);
}

function editAdminProduct(id) {
  const product = getAdminProducts().find(item => item.id === id);
  if (!product) return;
  editingProductId = id;
  document.getElementById("admin-prod-store").value = product.store;
  document.getElementById("admin-prod-cat").value = product.category || "";
  document.getElementById("admin-prod-name").value = product.name || "";
  document.getElementById("admin-prod-price").value = product.price || "";
  document.getElementById("admin-prod-stock").value = product.stock || "Disponible";
  document.getElementById("admin-prod-desc").value = product.desc || "";
  document.getElementById("admin-product-submit").textContent = "Guardar cambios";
  document.getElementById("admin-product-cancel").hidden = false;
  document.getElementById("admin-add-product-form").scrollIntoView({ behavior: "smooth" });
}

function cancelEditAdminProduct() {
  editingProductId = null;
  const form = document.getElementById("admin-add-product-form");
  form?.reset();
  const submit = document.getElementById("admin-product-submit");
  if (submit) submit.textContent = "➕ Guardar Producto en la Tienda";
  const cancel = document.getElementById("admin-product-cancel");
  if (cancel) cancel.hidden = true;
}

function deleteAdminProduct(index) {
  const products = getAdminProducts();
  if (!products[index]) return;

  const deletedName = products[index].name;
  if (!confirm(`¿Eliminar "${deletedName}" del catálogo de Necutools?`)) return;

  products.splice(index, 1);
  saveAdminProducts(products);
  renderAdminTable();
  renderPublicCatalog();
  showToast(`Producto "${deletedName}" eliminado de Necutools.`);
}

function renderAdminAccess() {
  const account = localStorage.getItem(ADMIN_ACCOUNT_KEY);
  const authenticated = sessionStorage.getItem(ADMIN_SESSION_KEY) === "active";
  document.getElementById("admin-login-form").hidden = !account;
  document.getElementById("admin-setup-form").hidden = Boolean(account);
  document.getElementById("admin-auth-title").textContent = account ? "Iniciar sesión" : "Crear cuenta de administrador";
  document.getElementById("admin-auth-description").textContent = account
    ? "Ingresa tu usuario y contraseña para abrir Necutools."
    : "Configura tu cuenta personal para administrar el catálogo.";
  document.getElementById("admin-workspace").hidden = !authenticated;
  document.getElementById("admin-auth").hidden = authenticated;
  if (authenticated) renderAdminTable();
}

async function hashAdminPassword(password) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function adminLogout() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  renderAdminAccess();
  showSection("sec-tienda");
}

function renderStoreOptions() {
  const select = document.getElementById("admin-prod-store");
  if (select) select.innerHTML = getAdminStores().map(store => `<option value="${escapeHTML(store)}">${escapeHTML(store)}</option>`).join("");
  const list = document.getElementById("admin-stores-list");
  if (list) list.innerHTML = getAdminStores().map(store => `<span class="status-badge active">${escapeHTML(store)}</span>`).join(" ");
}

function addAdminStore(event) {
  event.preventDefault();
  const input = document.getElementById("admin-store-name");
  const name = input.value.trim();
  const stores = getAdminStores();
  if (!name || stores.some(store => store.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    alert("Escribe un nombre nuevo para el stand.");
    return;
  }
  stores.push(name);
  saveAdminStores(stores);
  input.value = "";
  renderStoreOptions();
  renderPublicCatalog();
  showToast(`Stand "${name}" agregado.`);
}

function renderPublicCatalog(storeFilter = "") {
  const allProducts = getAdminProducts();
  const renderProducts = products => products.length ? products.map(product => `
    <article class="card public-product-card">
      <img src="${product.img || "imagenes/ropa.svg"}" alt="${escapeHTML(product.name)}" loading="lazy">
      <h2>${escapeHTML(product.name)}</h2>
      <p>${escapeHTML(product.desc || product.category || product.store)}</p>
      <div class="price">${money(product.price)}</div>
      <button type="button" class="btn public-add-cart" data-name="${escapeHTML(product.name)}" data-store="${escapeHTML(product.store)}" data-price="${Number(product.price) || 0}">🛒 Agregar al carrito</button>
    </article>`).join("") : `<p class="notice">Todavía no hay productos publicados${storeFilter ? ` en ${escapeHTML(storeFilter)}` : ""}.</p>`;
  const allProductsGrid = document.getElementById("public-products-grid");
  if (allProductsGrid) allProductsGrid.innerHTML = renderProducts(allProducts);
  const storeProducts = document.getElementById("store-products-grid");
  if (storeProducts) storeProducts.innerHTML = renderProducts(allProducts.filter(product => !storeFilter || product.store === storeFilter));
  const storeTitle = document.getElementById("public-store-title");
  if (storeTitle) storeTitle.textContent = storeFilter;
  const customStores = getAdminStores().filter(store => !DEFAULT_STORES.includes(store));
  const storeCards = document.getElementById("custom-store-cards");
  if (storeCards) storeCards.innerHTML = customStores.map(store => `
    <article class="card">
      <div class="card-img-wrap"><span class="card-tag">Stand</span><img src="imagenes/otra.svg" alt="Stand ${escapeHTML(store)}"></div>
      <h2>${escapeHTML(store)}</h2><p>Productos disponibles de este stand.</p>
      <button class="btn public-store-button" type="button" data-store="${escapeHTML(store)}">Ver productos →</button>
    </article>`).join("");
}

function showStoreProducts(store) {
  renderPublicCatalog(store);
  showSection("sec-productos");
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
  renderAdminAccess();
  renderStoreOptions();
  renderPublicCatalog();

  // Listener para el formulario de administración
  const adminForm = document.getElementById("admin-add-product-form");
  if (adminForm) {
    adminForm.addEventListener("submit", handleAddAdminProduct);
  }

  document.getElementById("admin-login-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const account = JSON.parse(localStorage.getItem(ADMIN_ACCOUNT_KEY) || "null");
    const username = document.getElementById("admin-login-user").value.trim();
    const passwordHash = await hashAdminPassword(document.getElementById("admin-login-password").value);
    if (account && account.username === username && account.passwordHash === passwordHash) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, "active");
      document.getElementById("admin-auth").hidden = true;
      document.getElementById("admin-workspace").hidden = false;
      renderAdminTable();
    } else {
      alert("Usuario o contraseña incorrectos.");
    }
  });

  document.getElementById("admin-setup-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!crypto?.subtle) {
      alert("No se puede configurar la cuenta en este modo. Abre el sitio desde localhost o un sitio HTTPS.");
      return;
    }
    const username = document.getElementById("admin-setup-user").value.trim();
    const password = document.getElementById("admin-setup-password").value;
    if (!username || password.length < 8) return;
    localStorage.setItem(ADMIN_ACCOUNT_KEY, JSON.stringify({ username, passwordHash: await hashAdminPassword(password) }));
    sessionStorage.setItem(ADMIN_SESSION_KEY, "active");
    document.getElementById("admin-auth").hidden = true;
    document.getElementById("admin-workspace").hidden = false;
    renderAdminTable();
  });

  document.getElementById("admin-add-store-form")?.addEventListener("submit", addAdminStore);
  document.addEventListener("click", event => {
    const button = event.target.closest(".public-add-cart");
    if (button) addToCartDirect(button.dataset.name, button.dataset.store, button.dataset.price);
    const storeButton = event.target.closest(".public-store-button");
    if (storeButton) showStoreProducts(storeButton.dataset.store);
  });
});
