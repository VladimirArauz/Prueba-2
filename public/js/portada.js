/**
 * NECUTLA — Portada: tablero de tiendas, promociones de temporada, buscador y vitrina de ofertas al final.
 */

const MAX_PROMOS_PORTADA = 3;

// Fotos de Unsplash (Unsplash License) para las tarjetas de la portada, por slug de tienda.
// Plan 2026-10-31-fotos-tiendas-portada; origen de cada una en recursos/fotos-unsplash/creditos.md.
// Solo reemplazan la imagen de relleno (SVG): si la tienda subió su portada en Necutools, se usa la suya.
const FOTOS_TIENDAS = {
  ropa: { alt: "Camisas de colores colgadas en un perchero", autor: "Marcus Loke", perfil: "https://unsplash.com/@marcusloke" },
  tecnologia: { alt: "Celular, teclado y mouse sobre un escritorio", autor: "Jakub Żerdzicki", perfil: "https://unsplash.com/@jakubzerdzicki" },
  dulces: { alt: "Caramelos de colores amontonados", autor: "Customerbox", perfil: "https://unsplash.com/@customerbox" },
  propaganda: { alt: "Hojas impresas de colores abiertas en abanico", autor: "Andrew Pons", perfil: "https://unsplash.com/@imandrewpons" },
  papeleria: { alt: "Plumas y marcadores de colores acomodados en filas", autor: "Caroline", perfil: "https://unsplash.com/@carolinentmt" },
  regalos: { alt: "Caja de regalo de papel kraft con moño rosa", autor: "Jess Bailey", perfil: "https://unsplash.com/@jessbaileydesigns" },
  otra: { alt: "Puesto de mercado con artesanías tejidas de colores", autor: "Aron Weerakoon", perfil: "https://unsplash.com/@aron781n" }
};

// Ancho que ocupa la foto según la cuadrícula: 3 columnas, 2 (≤992px) y 1 (≤640px)
const TAMANOS_FOTO = "(max-width: 640px) 92vw, (max-width: 992px) 46vw, 384px";

// La foto de Unsplash de la tienda, o null si tiene portada propia o no hay foto para ella
function fotoDe(t) {
  const relleno = !t.imagen_url || /^\/imagenes\/[a-z0-9-]+\.svg$/.test(t.imagen_url);
  return relleno && Object.hasOwn(FOTOS_TIENDAS, t.slug) ? FOTOS_TIENDAS[t.slug] : null;
}

function imagenTarjeta(t) {
  const foto = fotoDe(t);
  if (!foto) {
    return `<div class="card-img-wrap"><img src="${escapeHTML(t.imagen_url || "/imagenes/otra.svg")}" alt="Tienda ${escapeHTML(t.nombre)}" loading="lazy"></div>`;
  }
  const base = `/imagenes/tiendas/${escapeHTML(t.slug)}`;
  return `<div class="card-img-wrap"><img src="${base}-640.webp" srcset="${base}-640.webp 640w, ${base}-1280.webp 1280w"
    sizes="${TAMANOS_FOTO}" width="1280" height="800" alt="${escapeHTML(foto.alt)}" loading="lazy" decoding="async"></div>`;
}

// "Fotos de Unsplash: Nombre, Nombre…" con los fotógrafos de las tarjetas que se ven
function pintarCreditos(tiendas) {
  const caja = document.getElementById("creditos-fotos");
  const autores = [];
  tiendas.map(fotoDe).filter(Boolean).forEach(f => { if (!autores.some(a => a.autor === f.autor)) autores.push(f); });
  caja.hidden = !autores.length;
  caja.innerHTML = autores.length
    ? `Fotos de <a href="https://unsplash.com/es" rel="noopener">Unsplash</a>: ${autores.map(a => `<a href="${escapeHTML(a.perfil)}" rel="noopener">${escapeHTML(a.autor)}</a>`).join(", ")}.`
    : "";
}

function filaTablero(t) {
  return `<li><a class="board-row" href="/t/${escapeHTML(t.slug)}">${icon(t.icono || "store")}<span class="board-name">${escapeHTML(t.nombre)}</span>${icon("chevron-right", "board-go")}</a></li>`;
}

function tarjetaTienda(t) {
  const partes = [];
  if (t.productos) partes.push(`${t.productos} ${t.productos === 1 ? "producto" : "productos"}`);
  if (t.servicios) partes.push(`${t.servicios} ${t.servicios === 1 ? "servicio" : "servicios"}`);
  return `
    <article class="card">
      ${imagenTarjeta(t)}
      <h3>${icon(t.icono || "store")}${escapeHTML(t.nombre)}</h3>
      ${t.ofertas_hoy ? `<span class="tag-oferta">${icon("tag")}${t.ofertas_hoy === 1 ? "1 oferta hoy" : `${t.ofertas_hoy} ofertas hoy`}</span>` : ""}
      <p>${escapeHTML(t.descripcion || "Catálogo de la tienda.")}</p>
      ${partes.length ? `<div class="card-sub">${partes.join(" · ")}</div>` : ""}
      <a class="btn secondary" href="/t/${escapeHTML(t.slug)}">Entrar a ${escapeHTML(t.nombre)}</a>
    </article>`;
}

async function cargarTiendas() {
  const grid = document.getElementById("stores-grid");
  // El servidor ya manda el tablero pintado (app/paginas.php, con_tablero); los esqueletos solo si no llegó
  if (!document.querySelector("#board-list .board-row")) pintarEsqueletos(document.getElementById("board-list"), 7, "fila");
  pintarEsqueletos(grid, 6);
  try {
    const tiendas = await obtenerTiendas();
    // Si el servidor ya lo pintó igual, no se toca: así las filas no repiten su entrada
    const tablero = document.getElementById("board-list");
    const nuevo = document.createElement("ul");
    nuevo.innerHTML = tiendas.map(filaTablero).join("");
    if (nuevo.innerHTML !== tablero.innerHTML) tablero.innerHTML = nuevo.innerHTML;
    if (tiendas.length > 1) document.getElementById("hero-explorar").textContent = `Explorar las ${tiendas.length} tiendas`;
    grid.innerHTML = tiendas.map(tarjetaTienda).join("");
    pintarCreditos(tiendas);
    if (!tiendas.length) grid.outerHTML = `<p>Todavía no hay tiendas abiertas. Vuelve pronto.</p>`;
  } catch (error) {
    grid.outerHTML = `<div class="notice">${icon("info")}<span>${escapeHTML(error.message)}</span></div>`;
  }
}

async function cargarPromociones() {
  try {
    let promos = await api("/promociones?destacadas=1");
    if (!promos.length) promos = await api("/promociones");
    if (!promos.length) return;
    document.getElementById("promos-grid").innerHTML = promos.slice(0, MAX_PROMOS_PORTADA).map(tarjetaPromocion).join("");
    document.getElementById("promos").hidden = false;
  } catch (e) { /* sin promociones, la portada sigue igual */ }
}

// ================= Letrero "Encuentra ___" (plan 2026-11-08-letrero-giratorio-hero) =================
// Pasa por todas las palabras y vuelve a empezar, sin fin. Se pausa con el mouse encima o si la pestaña no se ve. Con movimiento reducido no gira. El lector de pantalla lee la frase fija del HTML.
const PALABRAS_GIRO = ["playeras", "audífonos", "dulces", "volantes", "cuadernos", "regalos", "engargolados", "lo que necesitas"];
const PAUSA_GIRO = 2500;

function iniciarGiro() {
  const palabra = document.getElementById("hero-giro-palabra");
  if (!palabra) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    palabra.textContent = PALABRAS_GIRO.at(-1);
    return;
  }
  const letrero = palabra.closest(".hero-giro");
  let indice = 0;
  let pausado = false;
  letrero.addEventListener("mouseenter", () => { pausado = true; });
  letrero.addEventListener("mouseleave", () => { pausado = false; });
  const siguiente = () => {
    if (pausado || document.hidden) return void setTimeout(siguiente, PAUSA_GIRO);
    indice = (indice + 1) % PALABRAS_GIRO.length;
    palabra.classList.remove("is-entrando");
    palabra.classList.add("is-saliendo");
    palabra.addEventListener("animationend", () => {
      palabra.textContent = PALABRAS_GIRO[indice];
      palabra.classList.remove("is-saliendo");
      palabra.classList.add("is-entrando");
      setTimeout(siguiente, PAUSA_GIRO);
    }, { once: true });
  };
  setTimeout(siguiente, PAUSA_GIRO);
}

// ================= Lo que dicen otros estudiantes (plan 2026-11-08) =================
// Cifras y opiniones reales de /api/portada/resumen. Sin opiniones, la sección se queda oculta: no se inventa nada.
function cifra(valor, uno, varios) {
  return `<div class="cifra"><dt>${valor === 1 ? uno : varios}</dt><dd>${valor.toLocaleString("es-MX")}</dd></div>`;
}

function tarjetaOpinionPortada(r) {
  return `
    <li class="card opinion-portada">
      ${estrellasDe(r.calificacion)}
      <p class="opinion-portada-texto">${escapeHTML(r.comentario)}</p>
      <p class="opinion-portada-autor">
        <span class="opinion-autor">${escapeHTML(r.nombre)}</span>
        sobre <a href="/p/${encodeURIComponent(r.producto.id)}">${escapeHTML(r.producto.nombre)}</a>,
        de ${escapeHTML(r.tienda.nombre)}
      </p>
    </li>`;
}

async function cargarPruebaSocial() {
  try {
    const d = await api("/portada/resumen");
    if (!d.recientes || !d.recientes.length) return;
    const cifras = [
      cifra(d.tiendas, "tienda", "tiendas"),
      cifra(d.productos, "producto", "productos"),
      d.servicios ? cifra(d.servicios, "servicio", "servicios") : "",
      cifra(d.opiniones, "opinión", "opiniones"),
      d.pedidos ? cifra(d.pedidos, "pedido pagado", "pedidos pagados") : ""
    ];
    document.getElementById("cifras-portada").innerHTML = cifras.join("");
    document.getElementById("opiniones-portada").innerHTML = d.recientes.map(tarjetaOpinionPortada).join("");
    document.getElementById("prueba-social").hidden = false;
  } catch (e) { /* sin resumen, la portada sigue igual */ }
}

// Cada búsqueda lleva su turno: si llega tarde la respuesta de una vieja, no se pinta encima de la nueva
let turnoBusqueda = 0;

// alEscribir: la busca el debounce mientras escribes; no mueve la página ni avisa si faltan letras
async function buscar(event, alEscribir = false) {
  if (event) event.preventDefault();
  buscarConEspera.cancelar();
  const q = document.getElementById("search-input").value.trim();
  const bloque = document.getElementById("search-results");
  const grid = document.getElementById("search-grid");
  const vacio = document.getElementById("search-empty");
  if (q.length < 2) {
    if (!alEscribir) showToast("Escribe al menos 2 letras para buscar.", "info");
    return;
  }
  const turno = ++turnoBusqueda;
  bloque.hidden = false;
  document.getElementById("search-title").textContent = `Resultados para “${q}”`;
  document.getElementById("search-desc").textContent = "Buscando en todas las tiendas.";
  vacio.innerHTML = "";
  pintarEsqueletos(grid, 3);
  try {
    const resultados = await api(`/buscar?q=${encodeURIComponent(q)}`);
    if (turno !== turnoBusqueda) return;
    document.getElementById("search-desc").textContent = resultados.length === 20
      ? "Mostramos los primeros 20. Escribe algo más específico para afinar."
      : `${resultados.length} ${resultados.length === 1 ? "resultado" : "resultados"} en todas las tiendas.`;
    grid.innerHTML = resultados.map(p => tarjetaProducto(p, { conTienda: true })).join("");
    vacio.innerHTML = resultados.length ? "" : `<p>No encontramos nada con “${escapeHTML(q)}”. Prueba con otra palabra o entra a una tienda.</p>`;
  } catch (error) {
    if (turno !== turnoBusqueda) return;
    grid.innerHTML = "";
    vacio.innerHTML = `<p>${escapeHTML(error.message)}</p>`;
  }
  if (!alEscribir) bloque.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Mientras escribes: busca 400 ms después de la última tecla. Al borrar todo, se quitan los resultados.
const buscarConEspera = conEspera(() => buscar(null, true), 400);

function alEscribirBusqueda() {
  const q = document.getElementById("search-input").value.trim();
  if (!q) {
    buscarConEspera.cancelar();
    turnoBusqueda++;
    document.getElementById("search-results").hidden = true;
    return;
  }
  if (q.length >= 2) buscarConEspera();
}

Object.assign(ACCIONES, {
  "limpiar-busqueda": () => {
    document.getElementById("search-results").hidden = true;
    document.getElementById("search-input").value = "";
    document.getElementById("search-input").focus();
  }
});

// El buscador de la barra lateral manda a /?q=…; en la portada busca sin recargar
function buscarDesdeBarra(q) {
  document.getElementById("search-input").value = q;
  buscar(null);
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("search-form").addEventListener("submit", buscar);
  document.getElementById("search-input").addEventListener("input", alEscribirBusqueda);
  const barra = document.querySelector(".side-search");
  if (barra) {
    barra.addEventListener("submit", event => {
      event.preventDefault();
      abrirCajon(false);
      buscarDesdeBarra(barra.elements.q.value.trim());
    });
  }
  const q = (new URLSearchParams(location.search).get("q") || "").trim();
  if (q) buscarDesdeBarra(q);
  iniciarGiro();
  const tiendas = cargarTiendas();
  cargarPromociones();
  // Opiniones y vitrina van debajo del directorio: se piden al acercarse (plan 2026-11-11). Con un #ancla o una
  // búsqueda en la dirección se piden de una vez, para que no aparezcan arriba de donde salta la página.
  let pedidas = false;
  const abajo = () => {
    if (pedidas) return;
    pedidas = true;
    cargarPruebaSocial();
    cargarVitrina();
  };
  // Se empieza a observar ya con las tarjetas de tiendas pintadas: antes, la marca queda arriba y se pediría de una vez
  if (location.hash || q) abajo();
  else Promise.resolve(tiendas).finally(() => alAcercarse(document.getElementById("portada-centinela"), abajo, { margen: "800px" }));
  // Un salto sin scroll suave (#como-funciona con movimiento reducido) puede brincarse la marca
  window.addEventListener("hashchange", abajo);
});
