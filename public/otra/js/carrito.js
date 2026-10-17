// ================= WHATSAPP =================
// Los números vienen del servidor (variable WHATSAPP_NUMBERS en Render).
let WHATSAPP_NUMBERS = [];

fetch("/api/config", { credentials: "same-origin" })
  .then(response => response.ok ? response.json() : { whatsapp: [] })
  .then(config => { WHATSAPP_NUMBERS = config.whatsapp || []; })
  .catch(() => { WHATSAPP_NUMBERS = []; });
// ===============================================

const STORE = document.body.dataset.store || "tienda";
const STORE_NAME = document.body.dataset.storeName || STORE;
const CART_KEY = "carrito_" + STORE;

function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch (e) { return []; }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
}

function addToCart(name, price) {
  const cart = getCart();
  const existing = cart.find(item => item.name === name);

  if (existing) {
    existing.quantity++;
  } else {
    cart.push({ name: name, price: Number(price), quantity: 1 });
  }

  saveCart(cart);
  renderCart();

  const message = document.getElementById("cart-message");
  if (message) {
    message.innerHTML = (typeof icon === "function" ? icon("check") : "") + "<span>Agregado al carrito: " + escapeHtml(name) + "</span>";
    message.classList.add("show");
  }
}

function changeQuantity(index, amount) {
  const cart = getCart();
  if (!cart[index]) return;

  cart[index].quantity += amount;
  if (cart[index].quantity <= 0) cart.splice(index, 1);

  saveCart(cart);
  renderCart();
}

function removeItem(index) {
  const cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
  renderCart();
}

function clearCart() {
  if (!confirm("¿Deseas vaciar todos los productos del carrito?")) return;
  localStorage.removeItem(CART_KEY);
  updateCartCount();
  renderCart();
}

function updateCartCount() {
  const total = getCart().reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll(".cart-count").forEach(el => el.textContent = total);
}

function money(value) {
  return "$" + Number(value).toFixed(2) + " MXN";
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[char]));
}

function renderCart() {
  const box = document.getElementById("cart-items");
  const totalBox = document.getElementById("cart-total");
  if (!box) return;

  const cart = getCart();

  if (!cart.length) {
    box.innerHTML = '<div class="cart-empty"><h3>Tu carrito está vacío</h3><p>Agrega productos desde las categorías de ' + escapeHtml(STORE_NAME) + '.</p><a class="btn" href="index.html">Ver ' + escapeHtml(STORE_NAME) + '</a></div>';
    if (totalBox) totalBox.textContent = money(0);
    return;
  }

  let total = 0;

  const ico = name => (typeof icon === "function" ? icon(name) : "");

  box.innerHTML = cart.map((item, index) => {
    const subtotal = item.price * item.quantity;
    total += subtotal;

    return `
      <div class="cart-row">
        <div>
          <div class="cart-item-title">${escapeHtml(item.name)}</div>
          <div class="cart-item-store">${money(item.price)} c/u</div>
        </div>
        <div class="qty-control">
          <button type="button" data-action="qty" data-index="${index}" data-delta="-1" aria-label="Quitar uno">${ico("minus")}</button>
          <span class="qty-value">${Number(item.quantity) || 0}</span>
          <button type="button" data-action="qty" data-index="${index}" data-delta="1" aria-label="Agregar uno">${ico("plus")}</button>
        </div>
        <div class="cart-col-right subtotal">${money(subtotal)}</div>
        <button type="button" class="btn danger btn-sm btn-icon" data-action="remove" data-index="${index}" aria-label="Eliminar ${escapeHtml(item.name)}" title="Eliminar">${ico("trash-2")}</button>
      </div>
    `;
  }).join("");

  if (totalBox) totalBox.textContent = money(total);
}

// Abre el mismo pedido en los 3 WhatsApp.
// El cliente debe pulsar "Enviar" en cada chat.
function sendToAllWhatsApps() {
  const cart = getCart();

  if (!cart.length) {
    alert("Primero agrega un producto al carrito.");
    return;
  }

  const customerName = document.getElementById("customer-name")?.value.trim() || "";
  const notes = document.getElementById("customer-notes")?.value.trim() || "";

  let total = 0;
  let text = "Hola, me interesa hacer un pedido en " + STORE_NAME + ".\n\n";

  if (customerName) text += "Nombre: " + customerName + "\n\n";

  cart.forEach(item => {
    const subtotal = item.price * item.quantity;
    total += subtotal;
    text += "• " + item.name + " x" + item.quantity + " — " + money(subtotal) + "\n";
  });

  text += "\nTotal aproximado: " + money(total);
  if (notes) text += "\n\nNotas: " + notes;
  text += "\n\nQuedo pendiente para confirmar disponibilidad y forma de pago.";

  const numbers = WHATSAPP_NUMBERS
    .map(n => String(n).replace(/\D/g, ""))
    .filter(Boolean);

  if (!numbers.length) {
    alert("Todavía no hay números de WhatsApp configurados. Intenta más tarde.");
    return;
  }

  const urls = numbers.map(number =>
    "https://wa.me/" + number + "?text=" + encodeURIComponent(text)
  );

  if (urls.length === 1) {
    window.open(urls[0], "_blank", "noopener");
    return;
  }

  alert("Se abrirán " + urls.length + " chats con el pedido preparado. Debes pulsar «Enviar» en cada chat.");

  urls.forEach((url, index) => {
    setTimeout(() => window.open(url, "_blank", "noopener"), index * 1000);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();
  renderCart();

  document.querySelectorAll(".add-cart-button").forEach(button => {
    button.addEventListener("click", () => {
      addToCart(button.dataset.product, Number(button.dataset.price));
    });
  });

  // Eventos delegados (sin onclick en el HTML)
  document.addEventListener("click", event => {
    const el = event.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;
    if (action === "qty") changeQuantity(Number(el.dataset.index), Number(el.dataset.delta));
    else if (action === "remove") removeItem(Number(el.dataset.index));
    else if (action === "cart-clear") clearCart();
    else if (action === "send-order") sendToAllWhatsApps();
  });
});
