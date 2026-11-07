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
  return `<div class="card-img-wrap is-foto"><img src="${base}-640.webp" srcset="${base}-640.webp 640w, ${base}-1280.webp 1280w"
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
      <a class="btn secondary" href="/t/${escapeHTML(t.slug)}">Ver tienda</a>
    </article>`;
}

async function cargarTiendas() {
  const grid = document.getElementById("stores-grid");
  pintarEsqueletos(document.getElementById("board-list"), 7, "fila");
  pintarEsqueletos(grid, 6);
  try {
    const tiendas = await obtenerTiendas();
    document.getElementById("board-list").innerHTML = tiendas.map(filaTablero).join("");
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

async function buscar(event) {
  event.preventDefault();
  const q = document.getElementById("search-input").value.trim();
  const bloque = document.getElementById("search-results");
  const grid = document.getElementById("search-grid");
  const vacio = document.getElementById("search-empty");
  if (q.length < 2) {
    showToast("Escribe al menos 2 letras para buscar.", "info");
    return;
  }
  bloque.hidden = false;
  document.getElementById("search-title").textContent = `Resultados para “${q}”`;
  document.getElementById("search-desc").textContent = "Buscando en todas las tiendas.";
  vacio.innerHTML = "";
  pintarEsqueletos(grid, 3);
  try {
    const resultados = await api(`/buscar?q=${encodeURIComponent(q)}`);
    document.getElementById("search-desc").textContent = resultados.length === 20
      ? "Mostramos los primeros 20. Escribe algo más específico para afinar."
      : `${resultados.length} ${resultados.length === 1 ? "resultado" : "resultados"} en todas las tiendas.`;
    grid.innerHTML = resultados.map(p => tarjetaProducto(p, { conTienda: true })).join("");
    vacio.innerHTML = resultados.length ? "" : `<p>No encontramos nada con “${escapeHTML(q)}”. Prueba con otra palabra o entra a una tienda.</p>`;
  } catch (error) {
    grid.innerHTML = "";
    vacio.innerHTML = `<p>${escapeHTML(error.message)}</p>`;
  }
  bloque.scrollIntoView({ behavior: "smooth", block: "start" });
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
  buscar(new Event("submit"));
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("search-form").addEventListener("submit", buscar);
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
  cargarTiendas();
  cargarPromociones();
  cargarVitrina();
});
