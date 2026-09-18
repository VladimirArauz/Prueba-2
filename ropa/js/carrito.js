// ================= WHATSAPP =================
// Cambia estos 3 números por los números reales.
// México: 52 + número, sin +, espacios ni guiones.
const WHATSAPP_NUMBERS = [
  "525500000001",
  "525500000002",
  "525500000003"
];
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
    message.textContent = "✓ " + name + " se agregó al carrito.";
    message.style.display = "block";
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
    box.innerHTML = '<div class="notice">Tu carrito está vacío.</div>';
    if (totalBox) totalBox.textContent = money(0);
    return;
  }

  let total = 0;

  box.innerHTML = cart.map((item, index) => {
    const subtotal = item.price * item.quantity;
    total += subtotal;

    return `
      <div class="cart-row">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <div class="price">${money(item.price)}</div>
        </div>
        <div class="qty">
          <button type="button" onclick="changeQuantity(${index},-1)">−</button>
          <strong>${item.quantity}</strong>
          <button type="button" onclick="changeQuantity(${index},1)">+</button>
        </div>
        <div class="subtotal">${money(subtotal)}</div>
        <button type="button" class="btn secondary" onclick="removeItem(${index})">Eliminar</button>
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
    alert("Configura al menos un número de WhatsApp.");
    return;
  }

  const urls = numbers.map(number =>
    "https://wa.me/" + number + "?text=" + encodeURIComponent(text)
  );

  if (urls.length === 1) {
    window.open(urls[0], "_blank");
    return;
  }

  alert("Se abrirán los 3 chats con el pedido preparado. Debes pulsar «Enviar» en cada chat.");

  urls.forEach((url, index) => {
    setTimeout(() => window.open(url, "_blank"), index * 1000);
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
});
