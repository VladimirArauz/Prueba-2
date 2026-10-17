/**
 * NECUTLA — LA CIUDAD DEL ESTUDIANTE
 * Lógica principal de navegación, Carrito y Panel Necutools.
 * Productos, stands y sesión de administración vienen del servidor (/api).
 * El carrito vive en el navegador de cada visitante (localStorage).
 */

const CART_STORAGE_KEY = "necutla_carrito_global";
const MAX_IMAGE_BYTES = 1024 * 1024;

// Estado cargado desde la API
let whatsappNumbers = [];
let products = [];
let stores = [];
let adminSession = { autenticado: false, usuario: null };
let editingProductId = null;

// ================= API =================
async function api(path, { method = "GET", body } = {}) {
  const options = { method, headers: {}, credentials: "same-origin" };
  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`/api${path}`, options);
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "No se pudo completar la acción. Intenta de nuevo.");
    error.status = response.status;
    throw error;
  }
  return data;
}

async function loadConfig() {
  try {
    whatsappNumbers = (await api("/config")).whatsapp || [];
  } catch (e) {
    whatsappNumbers = [];
  }
}

async function loadCatalog() {
  try {
    [products, stores] = await Promise.all([api("/productos"), api("/stands")]);
  } catch (e) {
    products = [];
    stores = [];
    showToast("No se pudo cargar el catálogo. Recarga la página.");
  }
  renderStoreOptions();
  renderPublicCatalog();
  renderAdminTable();
}

// ================= CARRITO (localStorage) =================
function getCart() {
  try {
    const cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY));
    return Array.isArray(cart) ? cart : [];
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (e) { /* almacenamiento no disponible */ }
  updateCartCounters();
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
  if (sectionId === "sec-necutools") renderAdminAccess();

  document.querySelectorAll('.app-section').forEach(sec => sec.classList.remove('active-section'));
  document.getElementById(sectionId)?.classList.add('active-section');

  // El hero (tablero directorio) solo se muestra en la sección Tienda
  const hero = document.getElementById('inicio');
  if (hero) hero.hidden = sectionId !== 'sec-tienda';

  // Estado activo en botones de la Navbar
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  if (sectionId === 'sec-tienda') {
    document.getElementById('nav-btn-tienda')?.classList.add('active');
  } else if (sectionId === 'sec-carrito') {
    document.getElementById('nav-btn-carrito')?.classList.add('active');
    renderCart();
  } else if (sectionId === 'sec-necutools') {
    document.getElementById('nav-btn-necutools')?.classList.add('active');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ================= GESTIÓN DEL CARRITO =================
function updateCartCounters() {
  const totalCount = getCart().reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  document.querySelectorAll('.cart-count, #nav-cart-count').forEach(el => {
    el.textContent = totalCount;
  });

  // Pulso del contador de la navbar (definido en style.css)
  const pill = document.querySelector('.cart-pill');
  if (pill) {
    pill.classList.remove("pulse");
    void pill.offsetWidth;
    pill.classList.add("pulse");
  }
}

function addToCartDirect(name, store, price) {
  const cart = getCart();
  const existing = cart.find(item => item.name === name && item.store === store);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ name, store, price: Number(price), qty: 1 });
  }
  saveCart(cart);
  showToast(`Agregado al carrito: ${name}`);
}

function changeCartQty(index, delta) {
  const cart = getCart();
  if (!cart[index]) return;
  cart[index].qty += delta;
  if (cart[index].qty <= 0) cart.splice(index, 1);
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
  showToast(`Eliminado del carrito: ${removedName}`);
}

function clearCartAll() {
  if (!confirm("¿Deseas vaciar todos los productos del carrito?")) return;
  saveCart([]);
  renderCart();
  showToast("Carrito vaciado.");
}

function renderCart() {
  const container = document.getElementById("cart-items-list");
  const totalEl = document.getElementById("cart-total-amount");
  if (!container) return;

  const cart = getCart();

  if (!cart.length) {
    container.innerHTML = `
      <div class="cart-empty">
        ${icon("shopping-cart", "icon-lg")}
        <h3>Tu carrito está vacío</h3>
        <p>Agrega productos desde cualquier tienda.</p>
        <button type="button" class="btn" data-section="sec-tienda">Ver tiendas</button>
      </div>
    `;
    if (totalEl) totalEl.textContent = money(0);
    return;
  }

  let grandTotal = 0;
  let html = `
    <div class="cart-table-head">
      <span>Producto</span>
      <span class="cart-col-center">Cantidad</span>
      <span class="cart-col-right">Subtotal</span>
      <span class="cart-col-center"><span class="visually-hidden">Eliminar</span></span>
    </div>
  `;

  cart.forEach((item, idx) => {
    const subtotal = item.price * item.qty;
    grandTotal += subtotal;

    html += `
      <div class="cart-row">
        <div>
          <div class="cart-item-title">${escapeHTML(item.name)}</div>
          <div class="cart-item-store">${escapeHTML(item.store || "General")}, ${money(item.price)} c/u</div>
        </div>
        <div class="cart-col-center">
          <div class="qty-control">
            <button type="button" data-action="cart-qty" data-index="${idx}" data-delta="-1" aria-label="Quitar uno">${icon("minus")}</button>
            <span class="qty-value">${Number(item.qty) || 0}</span>
            <button type="button" data-action="cart-qty" data-index="${idx}" data-delta="1" aria-label="Agregar uno">${icon("plus")}</button>
          </div>
        </div>
        <div class="cart-col-right subtotal">${money(subtotal)}</div>
        <div class="cart-col-center">
          <button type="button" class="btn danger btn-sm btn-icon" data-action="cart-remove" data-index="${idx}" aria-label="Eliminar ${escapeHTML(item.name)}" title="Eliminar">
            ${icon("trash-2")}
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  if (totalEl) totalEl.textContent = money(grandTotal);
}

// Envío a los WhatsApp configurados en el servidor (WHATSAPP_NUMBERS)
function sendOrderToWhatsApps() {
  const cart = getCart();
  if (!cart.length) {
    alert("El carrito está vacío. Agrega al menos un producto antes de enviar tu pedido.");
    return;
  }
  if (!whatsappNumbers.length) {
    alert("Todavía no hay números de WhatsApp configurados. Intenta más tarde.");
    return;
  }

  const name = document.getElementById("order-customer-name")?.value.trim() || "";
  const notes = document.getElementById("order-customer-notes")?.value.trim() || "";

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

  const urls = whatsappNumbers.map(phone => `https://wa.me/${phone}?text=${encodeURIComponent(message)}`);

  alert(`Se preparó tu pedido por ${money(total)}. Se abrirán ${urls.length} chat(s) de WhatsApp. En cada uno solo pulsa "Enviar".`);
  urls.forEach((u, i) => setTimeout(() => window.open(u, "_blank", "noopener"), i * 650));
}

// ================= PANEL ADMIN NECUTOOLS =================
function renderAdminAccess() {
  const authenticated = adminSession.autenticado;
  document.getElementById("admin-workspace").hidden = !authenticated;
  document.getElementById("admin-auth").hidden = authenticated;
  if (authenticated) renderAdminTable();
}

async function refreshSession() {
  try {
    adminSession = await api("/auth/sesion");
  } catch (e) {
    adminSession = { autenticado: false, usuario: null };
  }
  renderAdminAccess();
}

async function adminLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    adminSession = await api("/auth/login", {
      method: "POST",
      body: {
        usuario: document.getElementById("admin-login-user").value,
        password: document.getElementById("admin-login-password").value
      }
    });
    form.reset();
    renderAdminAccess();
    showToast(`Sesión iniciada: ${adminSession.usuario}`);
  } catch (error) {
    alert(error.message);
  } finally {
    submit.disabled = false;
  }
}

async function adminLogout() {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch (e) { /* la sesión ya no existe */ }
  adminSession = { autenticado: false, usuario: null };
  renderAdminAccess();
  showSection("sec-tienda");
  showToast("Sesión cerrada.");
}

// Si el servidor responde 401, la sesión expiró: volver a pedir login
function handleAdminError(error) {
  if (error.status === 401) {
    adminSession = { autenticado: false, usuario: null };
    renderAdminAccess();
  }
  alert(error.message);
}

function renderAdminTable() {
  const tbody = document.getElementById("admin-products-tbody");
  if (!tbody || !adminSession.autenticado) return;

  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="cell-empty">Todavía no hay productos. Agrega el primero con el formulario de arriba.</td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(prod => `
      <tr>
        <td><strong>P-${Number(prod.id)}</strong></td>
        <td>
          <div class="cell-title">${escapeHTML(prod.nombre)}</div>
          <div class="cell-sub">${escapeHTML(prod.categoria || "-")}</div>
        </td>
        <td>${escapeHTML(prod.stand)}</td>
        <td class="cell-price">${money(prod.precio)}</td>
        <td><span class="status-badge">${escapeHTML(prod.disponibilidad)}</span></td>
        <td>${new Date(prod.creado_en).toLocaleDateString('es-MX')}</td>
        <td class="col-actions">
          <button type="button" class="btn secondary btn-sm btn-icon" data-action="product-edit" data-id="${Number(prod.id)}" aria-label="Editar ${escapeHTML(prod.nombre)}" title="Editar">${icon("pencil")}</button>
          <button type="button" class="btn danger btn-sm btn-icon" data-action="product-delete" data-id="${Number(prod.id)}" aria-label="Eliminar ${escapeHTML(prod.nombre)}" title="Eliminar">${icon("trash-2")}</button>
        </td>
      </tr>
    `).join("");
}

function readImageAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleAddAdminProduct(e) {
  e.preventDefault();

  const nameInput = document.getElementById("admin-prod-name");
  const priceInput = document.getElementById("admin-prod-price");
  const imageInput = document.getElementById("admin-prod-img");

  if (!nameInput.value.trim() || !priceInput.value) {
    alert("Completa al menos el nombre y el precio del producto.");
    return;
  }

  const body = {
    stand: document.getElementById("admin-prod-store").value,
    categoria: document.getElementById("admin-prod-cat").value,
    nombre: nameInput.value,
    precio: priceInput.value,
    disponibilidad: document.getElementById("admin-prod-stock").value,
    descripcion: document.getElementById("admin-prod-desc").value
  };

  const imageFile = imageInput.files[0];
  if (imageFile) {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(imageFile.type) || imageFile.size > MAX_IMAGE_BYTES) {
      alert("Usa una imagen PNG, JPG, WEBP o GIF de hasta 1 MB.");
      return;
    }
    body.imagen = await readImageAsDataURL(imageFile).catch(() => "");
    if (!body.imagen) {
      alert("No se pudo leer la imagen seleccionada.");
      return;
    }
  }

  const submit = document.getElementById("admin-product-submit");
  submit.disabled = true;
  try {
    const wasEditing = Boolean(editingProductId);
    const saved = wasEditing
      ? await api(`/productos/${editingProductId}`, { method: "PUT", body })
      : await api("/productos", { method: "POST", body });
    cancelEditAdminProduct();
    await loadCatalog();
    showToast(`${wasEditing ? "Producto actualizado" : "Producto guardado"}: ${saved.nombre}`);
  } catch (error) {
    handleAdminError(error);
  } finally {
    submit.disabled = false;
  }
}

function editAdminProduct(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;
  editingProductId = id;
  document.getElementById("admin-prod-store").value = product.stand;
  document.getElementById("admin-prod-cat").value = product.categoria || "";
  document.getElementById("admin-prod-name").value = product.nombre || "";
  document.getElementById("admin-prod-price").value = product.precio || "";
  document.getElementById("admin-prod-stock").value = product.disponibilidad || "Disponible";
  document.getElementById("admin-prod-desc").value = product.descripcion || "";
  document.getElementById("admin-product-submit").textContent = "Guardar cambios";
  document.getElementById("admin-product-cancel").hidden = false;
  document.getElementById("admin-add-product-form").scrollIntoView({ behavior: "smooth" });
}

function cancelEditAdminProduct() {
  editingProductId = null;
  document.getElementById("admin-add-product-form")?.reset();
  const submit = document.getElementById("admin-product-submit");
  if (submit) submit.textContent = "Guardar producto";
  const cancel = document.getElementById("admin-product-cancel");
  if (cancel) cancel.hidden = true;
}

async function deleteAdminProduct(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;
  if (!confirm(`¿Eliminar "${product.nombre}" del catálogo?`)) return;
  try {
    await api(`/productos/${id}`, { method: "DELETE" });
    if (editingProductId === id) cancelEditAdminProduct();
    await loadCatalog();
    showToast(`Producto eliminado: ${product.nombre}`);
  } catch (error) {
    handleAdminError(error);
  }
}

function renderStoreOptions() {
  const select = document.getElementById("admin-prod-store");
  if (select) {
    const current = select.value;
    select.innerHTML = stores.map(store => `<option value="${escapeHTML(store.nombre)}">${escapeHTML(store.nombre)}</option>`).join("");
    if (current) select.value = current;
  }
  const list = document.getElementById("admin-stores-list");
  if (list) list.innerHTML = stores.map(store => `<span class="status-badge">${escapeHTML(store.nombre)}</span>`).join(" ");
}

async function addAdminStore(event) {
  event.preventDefault();
  const input = document.getElementById("admin-store-name");
  const name = input.value.trim();
  if (!name) {
    alert("Escribe un nombre para el stand.");
    return;
  }
  try {
    await api("/stands", { method: "POST", body: { nombre: name } });
    input.value = "";
    await loadCatalog();
    showToast(`Stand creado: ${name}`);
  } catch (error) {
    handleAdminError(error);
  }
}

// ================= CATÁLOGO PÚBLICO =================
const DEFAULT_STORES = ["Ropa", "Tecnología", "Dulces", "Propaganda", "Papelería", "Regalos", "Otra"];

function renderPublicCatalog(storeFilter = "") {
  const renderProducts = list => list.length ? list.map(product => `
    <article class="card public-product-card">
      <div class="card-img-wrap"><img src="${escapeHTML(product.imagen_url || "imagenes/producto.svg")}" alt="${escapeHTML(product.nombre)}" loading="lazy"></div>
      <h3>${escapeHTML(product.nombre)}</h3>
      <p>${escapeHTML(product.descripcion || product.categoria || product.stand)}</p>
      <div class="price">${money(product.precio)}</div>
      <button type="button" class="btn" data-action="public-add-cart" data-name="${escapeHTML(product.nombre)}" data-store="${escapeHTML(product.stand)}" data-price="${Number(product.precio) || 0}">${icon("shopping-cart")}Agregar al carrito</button>
    </article>`).join("") : `<p class="notice">${icon("info")}<span>Todavía no hay productos publicados${storeFilter ? ` en ${escapeHTML(storeFilter)}` : ""}.</span></p>`;

  const allProductsGrid = document.getElementById("public-products-grid");
  if (allProductsGrid) allProductsGrid.innerHTML = renderProducts(products);
  const storeProducts = document.getElementById("store-products-grid");
  if (storeProducts) storeProducts.innerHTML = renderProducts(products.filter(product => !storeFilter || product.stand === storeFilter));
  const storeTitle = document.getElementById("public-store-title");
  if (storeTitle && storeFilter) storeTitle.textContent = storeFilter;

  const customStores = stores.map(store => store.nombre).filter(store => !DEFAULT_STORES.includes(store));
  const storeCards = document.getElementById("custom-store-cards");
  if (storeCards) storeCards.innerHTML = customStores.map(store => `
    <article class="card">
      <div class="card-img-wrap"><img src="imagenes/otra.svg" alt="Stand ${escapeHTML(store)}"></div>
      <h3>${icon("store")}${escapeHTML(store)}</h3><p>Productos publicados por este stand.</p>
      <button class="btn" type="button" data-action="show-store" data-store="${escapeHTML(store)}">Ver productos</button>
    </article>`).join("");
  const customBlock = document.getElementById("custom-stores-block");
  if (customBlock) customBlock.hidden = customStores.length === 0;
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
    toast.setAttribute("role", "status");
    document.body.appendChild(toast);
  }

  toast.innerHTML = `${icon("check")}<span>${escapeHTML(message)}</span>`;
  toast.classList.add("show");

  clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => toast.classList.remove("show"), 3200);
}

// ================= EVENTOS (delegados, sin onclick en el HTML) =================
const ACTIONS = {
  "add-direct": el => addToCartDirect(el.dataset.name, el.dataset.store, el.dataset.price),
  "public-add-cart": el => addToCartDirect(el.dataset.name, el.dataset.store, el.dataset.price),
  "cart-qty": el => changeCartQty(Number(el.dataset.index), Number(el.dataset.delta)),
  "cart-remove": el => removeCartItem(Number(el.dataset.index)),
  "cart-clear": () => clearCartAll(),
  "send-order": () => sendOrderToWhatsApps(),
  "admin-logout": () => adminLogout(),
  "product-edit": el => editAdminProduct(Number(el.dataset.id)),
  "product-delete": el => deleteAdminProduct(Number(el.dataset.id)),
  "product-cancel": () => cancelEditAdminProduct(),
  "show-store": el => showStoreProducts(el.dataset.store)
};

document.addEventListener("click", event => {
  const sectionLink = event.target.closest("[data-section]");
  if (sectionLink) {
    showSection(sectionLink.dataset.section);
    return;
  }
  const actionEl = event.target.closest("[data-action]");
  if (actionEl && ACTIONS[actionEl.dataset.action]) ACTIONS[actionEl.dataset.action](actionEl);
});

// ================= INICIALIZACIÓN =================
document.addEventListener("DOMContentLoaded", () => {
  updateCartCounters();
  renderCart();

  document.getElementById("admin-add-product-form")?.addEventListener("submit", handleAddAdminProduct);
  document.getElementById("admin-login-form")?.addEventListener("submit", adminLogin);
  document.getElementById("admin-add-store-form")?.addEventListener("submit", addAdminStore);

  loadConfig();
  refreshSession().then(loadCatalog);
});
