/**
 * NECUTLA — Portada: tablero de tiendas, promociones de temporada, buscador y vitrina de ofertas al final.
 */

const MAX_PROMOS_PORTADA = 3;

function filaTablero(t) {
  return `<li><a class="board-row" href="/t/${escapeHTML(t.slug)}">${icon(t.icono || "store")}<span class="board-name">${escapeHTML(t.nombre)}</span>${icon("chevron-right", "board-go")}</a></li>`;
}

function tarjetaTienda(t) {
  const partes = [];
  if (t.productos) partes.push(`${t.productos} ${t.productos === 1 ? "producto" : "productos"}`);
  if (t.servicios) partes.push(`${t.servicios} ${t.servicios === 1 ? "servicio" : "servicios"}`);
  return `
    <article class="card">
      <div class="card-img-wrap"><img src="${escapeHTML(t.imagen_url || "/imagenes/otra.svg")}" alt="Tienda ${escapeHTML(t.nombre)}" loading="lazy"></div>
      <h3>${icon(t.icono || "store")}${escapeHTML(t.nombre)}</h3>
      ${t.ofertas_hoy ? `<span class="tag-oferta">${icon("tag")}${t.ofertas_hoy === 1 ? "1 oferta hoy" : `${t.ofertas_hoy} ofertas hoy`}</span>` : ""}
      <p>${escapeHTML(t.descripcion || "Catálogo de la tienda.")}</p>
      ${partes.length ? `<div class="card-sub">${partes.join(" · ")}</div>` : ""}
      <a class="btn" href="/t/${escapeHTML(t.slug)}">Ver tienda</a>
    </article>`;
}

async function cargarTiendas() {
  const grid = document.getElementById("stores-grid");
  try {
    const tiendas = await obtenerTiendas();
    document.getElementById("board-list").innerHTML = tiendas.map(filaTablero).join("");
    grid.innerHTML = tiendas.map(tarjetaTienda).join("");
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
