/**
 * NECUTLA — Página de promociones de temporada (todas las vigentes).
 */
document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("promos-grid");
  const vacio = document.getElementById("promos-empty");
  try {
    const promos = await api("/promociones");
    grid.innerHTML = promos.map(tarjetaPromocion).join("");
    if (!promos.length) {
      vacio.innerHTML = `<p>Por ahora no hay promociones de temporada. Mientras, revisa las ofertas de cada tienda.</p>
        <div class="form-actions"><a class="btn" href="/">Ver tiendas</a></div>`;
    }
  } catch (error) {
    vacio.innerHTML = `<p>${escapeHTML(error.message)}</p>`;
  }
});
