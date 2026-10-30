/**
 * NECUTLA — Página de un producto o servicio (/p/<id>): datos, oferta y opiniones.
 * Leer opiniones es libre; para opinar hace falta una cuenta de cliente (cuenta.html).
 */

const est = { id: 0, producto: null, color: null, opiniones: null, orden: "recientes", pagina: 1, editando: false };
const $ = id => document.getElementById(id);

function idDeLaUrl() {
  const partes = location.pathname.split("/").filter(Boolean);
  return partes[0] === "p" ? Number(partes[1]) || 0 : 0;
}

function fechaLarga(iso) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

// Estrellas de una sola opinión (sin promedio ni conteo)
function estrellasDe(n) {
  const iconos = [1, 2, 3, 4, 5].map(i => (i <= n ? icon("star-fill", "star is-on") : icon("star", "star"))).join("");
  return `<span class="rating" role="img" aria-label="${n} de 5 estrellas">${iconos}</span>`;
}

// ================= Producto =================
function renderProducto() {
  const p = est.producto;
  document.title = `${p.nombre} | Necutla`;
  const volver = $("producto-volver");
  volver.href = `/t/${encodeURIComponent(p.slug)}${p.tipo === "servicio" ? "#servicios" : ""}`;
  volver.innerHTML = `${icon("arrow-left")}Volver a ${escapeHTML(p.tienda)}`;
  $("producto-img").src = imagenDe(p);
  $("producto-img").alt = p.nombre;
  $("producto-tienda").href = `/t/${encodeURIComponent(p.slug)}`;
  $("producto-tienda").textContent = p.subcategoria ? `${p.tienda} · ${p.subcategoria}` : p.tienda;
  $("producto-nombre").textContent = p.nombre;
  $("producto-rating").innerHTML = estrellas(p.calificacion, p.resenas);
  $("producto-tags").innerHTML = etiquetasProducto(p);
  $("producto-oferta").textContent = p.oferta ? detalleOferta(p.oferta) : "";
  $("producto-desc").textContent = p.descripcion;
  $("producto-precio").innerHTML = precioProducto(p);
  $("producto-accion").innerHTML = accionProducto(p, { enDetalle: true });
  renderColores();
}

// ================= Barra de colores =================
// Al entrar se elige el color de la URL (?color=) o el primero disponible
function renderColores() {
  const colores = est.producto.colores || [];
  $("producto-colores").hidden = !colores.length;
  if (!colores.length) return;
  const pedido = Number(new URLSearchParams(location.search).get("color"));
  const inicial = colores.find(c => c.id === pedido && c.disponible) || colores.find(c => c.disponible) || null;
  $("producto-color-opciones").innerHTML = colores.map(c => `
    <input type="radio" class="visually-hidden" id="color-${c.id}" name="color" value="${c.id}"${c.disponible ? "" : " disabled"}${inicial && inicial.id === c.id ? " checked" : ""}>
    <label class="color-opcion" for="color-${c.id}">
      <span class="color-muestra" data-hex="${escapeHTML(c.hex)}"></span>
      <span>${escapeHTML(c.nombre)}${c.disponible ? "" : `<span class="color-agotado"> · Agotado</span>`}</span>
    </label>`).join("");
  pintarMuestras($("producto-color-opciones"));
  elegirColor(inicial);
}

function elegirColor(color) {
  const p = est.producto;
  est.color = color;
  $("producto-color-texto").textContent = color ? `Color: ${color.nombre}` : "Color";
  if (color) {
    $("producto-img").src = color.imagen_url || imagenDe(p);
    $("producto-img").alt = `${p.nombre}, color ${color.nombre.toLowerCase()}`;
    const url = new URL(location.href);
    url.searchParams.set("color", color.id);
    history.replaceState(null, "", url);
  }
  const boton = $("producto-accion").querySelector('[data-action="agregar"]');
  if (!boton) return;
  if (color) {
    boton.dataset.color = color.id;
    boton.dataset.nombre = `${p.nombre} (${color.nombre})`;
  } else {
    // Ningún color disponible
    boton.disabled = true;
    boton.innerHTML = `${icon("shopping-cart")}Agotado en todos los colores`;
  }
}

function pedirServicio() {
  const p = est.producto;
  const mensaje = `¡Hola! Vi en Necutla el servicio *${p.nombre}* de ${p.tienda} ` +
    `(${textoPrecio(p)}). Quisiera más información, por favor.`;
  abrirWhatsApp(p.whatsapp, mensaje, $("producto-wa"));
}

// ================= Opiniones =================
async function cargarOpiniones() {
  try {
    est.opiniones = await api(`/productos/${est.id}/resenas?orden=${est.orden}&pagina=${est.pagina}`);
  } catch (error) {
    $("opiniones-vacio").innerHTML = `<p>${escapeHTML(error.message)}</p>`;
    $("opiniones").hidden = false;
    return;
  }
  const { resumen } = est.opiniones;
  $("producto-rating").innerHTML = estrellas(resumen.promedio, resumen.total);
  renderResumen();
  renderOpinar();
  renderLista();
  $("opiniones").hidden = false;
}

function renderResumen() {
  const { promedio, total, distribucion } = est.opiniones.resumen;
  if (!total) {
    $("resumen").innerHTML = `<p>Todavía nadie opina sobre este producto. Sé el primero en calificarlo.</p>`;
    return;
  }
  const filas = [5, 4, 3, 2, 1].map(n => `
    <li class="dist-row">
      <span>${n} ${n === 1 ? "estrella" : "estrellas"}</span>
      <progress max="${total}" value="${distribucion[n]}" aria-label="${distribucion[n]} de ${total} opiniones con ${n} ${n === 1 ? "estrella" : "estrellas"}"></progress>
      <span>${distribucion[n]}</span>
    </li>`).join("");
  $("resumen").innerHTML = `
    <div class="resumen-promedio">${promedio.toFixed(1)}</div>
    ${estrellas(promedio, total)}
    <ul class="dist-list">${filas}</ul>`;
}

function formularioOpinion(mia) {
  const radios = [5, 4, 3, 2, 1].map(n => `
    <input type="radio" class="visually-hidden" id="estrella-${n}" name="calificacion" value="${n}"${mia && mia.calificacion === n ? " checked" : ""} required>
    <label for="estrella-${n}" title="${n} ${n === 1 ? "estrella" : "estrellas"}">
      ${icon("star", "star-vacia")}${icon("star-fill", "star-llena")}
      <span class="visually-hidden">${n} ${n === 1 ? "estrella" : "estrellas"}</span>
    </label>`).join("");
  const comentario = mia ? mia.comentario : "";
  return `
    <h3>${mia ? "Editar tu opinión" : "Da tu opinión"}</h3>
    <p class="form-hint">Opinas como ${escapeHTML(est.opiniones.cliente.nombre)}.</p>
    <form id="form-opinion">
      <fieldset class="form-group">
        <legend>Calificación</legend>
        <div class="star-input">${radios}</div>
      </fieldset>
      <div class="form-group">
        <label for="opinion-comentario">Comentario</label>
        <textarea id="opinion-comentario" name="comentario" rows="4" minlength="3" maxlength="500" required placeholder="¿Qué te pareció? ¿Lo recomiendas?">${escapeHTML(comentario)}</textarea>
        <span class="form-hint" id="opinion-cuenta">${comentario.length} de 500 caracteres</span>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn">Publicar opinión</button>
        ${mia ? `<button type="button" class="btn secondary" data-action="cancelar-opinion">Cancelar</button>` : ""}
      </div>
    </form>`;
}

function renderOpinar() {
  const { cliente, mia } = est.opiniones;
  const caja = $("opinar");
  if (est.opiniones.cuentas === false) {
    caja.innerHTML = `
      <h3>Da tu opinión</h3>
      <p>Las opiniones nuevas están en pausa por ahora. Puedes leer las que ya hay.</p>`;
    return;
  }
  if (!cliente) {
    caja.innerHTML = `
      <h3>Da tu opinión</h3>
      <p>Inicia sesión o crea tu cuenta para calificar este producto.</p>
      <div class="form-actions">
        <a class="btn" href="/cuenta.html?volver=${encodeURIComponent(`/p/${est.id}`)}">${icon("user")}Iniciar sesión para opinar</a>
      </div>`;
    return;
  }
  if (mia && !est.editando) {
    caja.innerHTML = `
      <h3>Tu opinión</h3>
      ${estrellasDe(mia.calificacion)}
      <p>${escapeHTML(mia.comentario)}</p>
      ${mia.visible ? "" : `<div class="notice">${icon("eye-off")}<span>La tienda ocultó tu opinión. Puedes editarla para que vuelva a revisarla.</span></div>`}
      <div class="form-actions">
        <button type="button" class="btn secondary btn-sm" data-action="editar-opinion">${icon("pencil")}Editar mi opinión</button>
        <button type="button" class="btn danger btn-sm" data-action="borrar-opinion">${icon("trash-2")}Borrar mi opinión</button>
      </div>`;
    return;
  }
  caja.innerHTML = formularioOpinion(mia);
  $("form-opinion").addEventListener("submit", guardarOpinion);
  $("opinion-comentario").addEventListener("input", event => {
    $("opinion-cuenta").textContent = `${event.target.value.length} de 500 caracteres`;
  });
}

function renderLista() {
  const { resenas, resumen, pagina, paginas, mia } = est.opiniones;
  const tienda = est.producto.tienda;
  $("opinion-list").innerHTML = resenas.map(r => `
    <li class="opinion${mia && mia.id === r.id ? " is-mia" : ""}">
      <div class="opinion-head">
        <span class="opinion-autor">${escapeHTML(r.nombre)}</span>
        ${estrellasDe(r.calificacion)}
        <span class="opinion-fecha">${escapeHTML(fechaLarga(r.creado_en))}${r.editada ? " · Editada" : ""}</span>
      </div>
      <p>${escapeHTML(r.comentario)}</p>
      ${r.respuesta ? `<div class="opinion-respuesta"><strong>Respuesta de ${escapeHTML(tienda)}</strong>${escapeHTML(r.respuesta)}</div>` : ""}
    </li>`).join("");
  $("opiniones-vacio").innerHTML = resumen.total ? "" : `<p>Aquí aparecerán las opiniones de quienes lo compren.</p>`;
  $("opiniones-orden").hidden = resumen.total < 2;
  $("paginacion").hidden = paginas < 2;
  $("paginacion-texto").textContent = `Página ${pagina} de ${paginas}`;
  document.querySelector('[data-action="pagina"][data-delta="-1"]').disabled = pagina <= 1;
  document.querySelector('[data-action="pagina"][data-delta="1"]').disabled = pagina >= paginas;
}

async function guardarOpinion(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const boton = form.querySelector('[type="submit"]');
  const elegida = form.querySelector('input[name="calificacion"]:checked');
  if (!elegida) {
    showToast("Elige de 1 a 5 estrellas.", "info");
    return;
  }
  const nueva = !est.opiniones.mia;
  botonOcupado(boton);
  try {
    await api(`/productos/${est.id}/resena`, {
      method: "PUT",
      body: { calificacion: Number(elegida.value), comentario: form.elements.comentario.value }
    });
    est.editando = false;
    est.pagina = 1;
    await cargarOpiniones();
    showToast(nueva ? "Opinión publicada. Gracias por opinar." : "Opinión actualizada.");
  } catch (error) {
    if (error.status === 401) await cargarOpiniones();
    showToast(error.message, "info");
  } finally {
    botonListo(boton);
  }
}

async function borrarOpinion() {
  if (!confirm("¿Borrar tu opinión? Ya no se verá en este producto.")) return;
  try {
    await api(`/productos/${est.id}/resena`, { method: "DELETE" });
    est.editando = false;
    await cargarOpiniones();
    showToast("Opinión borrada.");
  } catch (error) {
    showToast(error.message, "info");
  }
}

Object.assign(ACCIONES, {
  "pedir-servicio": () => pedirServicio(),
  "editar-opinion": () => {
    est.editando = true;
    renderOpinar();
    $("opinion-comentario").focus();
  },
  "cancelar-opinion": () => {
    est.editando = false;
    renderOpinar();
  },
  "borrar-opinion": () => borrarOpinion(),
  pagina: el => {
    est.pagina = Math.max(1, est.pagina + Number(el.dataset.delta));
    cargarOpiniones().then(() => $("opiniones").scrollIntoView({ behavior: "smooth", block: "start" }));
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  est.id = idDeLaUrl();
  try {
    est.producto = await api(`/productos/${est.id}`);
  } catch (error) {
    document.title = "Producto no encontrado | Necutla";
    $("producto-nombre").textContent = error.status === 404 ? "Producto no encontrado" : "No se pudo cargar el producto";
    $("producto-desc").textContent = error.message;
    $("producto-accion").innerHTML = `<a class="btn" href="/">Ver tiendas</a>`;
    return;
  }
  renderProducto();
  $("producto-color-opciones").addEventListener("change", event => {
    elegirColor(est.producto.colores.find(c => c.id === Number(event.target.value)) || null);
  });
  $("orden").addEventListener("change", event => {
    est.orden = event.target.value;
    est.pagina = 1;
    cargarOpiniones();
  });
  cargarOpiniones();
});
