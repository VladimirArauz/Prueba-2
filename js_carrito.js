// ================= CONFIGURACIÓN =================
// Reemplaza estos 3 números por los números REALES.
// México: 52 + número, sin +, espacios ni guiones.
const WHATSAPP_NUMBERS = [
  "525500000001",
  "525500000002",
  "525500000003"
];
// ==================================================

const STORE=document.body.dataset.store||"tienda";
const STORE_NAME=document.body.dataset.storeName||STORE;
const KEY="carrito_"+STORE;

function getCart(){try{return JSON.parse(localStorage.getItem(KEY))||[]}catch(e){return[]}}
function saveCart(c){localStorage.setItem(KEY,JSON.stringify(c));updateCount()}
function addToCart(name,price){
 const c=getCart(),x=c.find(p=>p.name===name);
 if(x)x.qty++;else c.push({name,price:Number(price),qty:1});
 saveCart(c); alert("Producto agregado al carrito.");
}
function changeQty(i,n){const c=getCart();if(!c[i])return;c[i].qty+=n;if(c[i].qty<=0)c.splice(i,1);saveCart(c);render()}
function removeItem(i){const c=getCart();c.splice(i,1);saveCart(c);render()}
function clearCart(){localStorage.removeItem(KEY);updateCount();render()}
function updateCount(){const n=getCart().reduce((s,p)=>s+p.qty,0);document.querySelectorAll(".cart-count").forEach(x=>x.textContent=n)}
function money(n){return "$"+Number(n).toFixed(2)+" MXN"}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

function render(){
 const box=document.getElementById("cart-items"),totalBox=document.getElementById("cart-total");if(!box)return;
 const c=getCart();
 if(!c.length){box.innerHTML='<div class="notice">Tu carrito está vacío.</div>';if(totalBox)totalBox.textContent=money(0);return}
 let total=0;
 box.innerHTML=c.map((p,i)=>{let sub=p.price*p.qty;total+=sub;return `<div class="cart-row"><div><strong>${esc(p.name)}</strong><div class="price">${money(p.price)}</div></div><div class="qty"><button onclick="changeQty(${i},-1)">−</button> ${p.qty} <button onclick="changeQty(${i},1)">+</button></div><div class="subtotal">${money(sub)}</div><button class="btn secondary" onclick="removeItem(${i})">Eliminar</button></div>`}).join("");
 if(totalBox)totalBox.textContent=money(total);
}

// IMPORTANTE:
// Un enlace wa.me no puede enviar un mensaje automáticamente a varios números.
// Esta función abre el mismo pedido para LOS 3 números configurados.
// El cliente deberá pulsar "Enviar" en cada chat de WhatsApp.
function sendToAllWhatsApps(){
 const c=getCart();
 if(!c.length){alert("Agrega al menos un producto al carrito.");return}
 const name=document.getElementById("customer-name")?.value.trim()||"";
 const notes=document.getElementById("customer-notes")?.value.trim()||"";
 let total=0;
 let text=`Hola, me interesa hacer un pedido en ${STORE_NAME}.\n\n`;
 if(name)text+=`Nombre: ${name}\n\n`;
 c.forEach(p=>{let sub=p.price*p.qty;total+=sub;text+=`• ${p.name} x${p.qty} — ${money(sub)}\n`});
 text+=`\nTotal aproximado: ${money(total)}`;
 if(notes)text+=`\n\nNotas: ${notes}`;
 text+=`\n\nQuedo pendiente para confirmar disponibilidad y forma de pago.`;

 const urls=WHATSAPP_NUMBERS.map(n=>`https://wa.me/${n.replace(/\D/g,"")}?text=${encodeURIComponent(text)}`);
 if(WHATSAPP_NUMBERS.length===1){window.open(urls[0],"_blank");return}
 alert("Se abrirán los chats de los 3 números. En cada WhatsApp tendrás que pulsar 'Enviar'.");
 urls.forEach((u,i)=>setTimeout(()=>window.open(u,"_blank"),i*700));
}

document.addEventListener("DOMContentLoaded",()=>{updateCount();render()});