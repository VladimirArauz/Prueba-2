/**
 * NECUTLA — Gráficas del resumen de Necutools (Chart.js, servido en /vendor/chart.umd.js).
 * Colores tomados de los tokens de style.css; sin degradados ni rellenos de área.
 * Cada gráfica lleva una tabla oculta con los mismos datos para lectores de pantalla.
 */

const GRAFICAS = new Map();
const MOVIMIENTO_REDUCIDO = window.matchMedia("(prefers-reduced-motion: reduce)");

function token(nombre) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${nombre}`).trim();
}

// "$1,250" (también lo usan los indicadores de Necutools)
function pesos(valor) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(valor);
}

function tablaOculta(titulo, columnas, filas) {
  return `
    <div class="visually-hidden">
      <table>
        <caption>${escapeHTML(titulo)}</caption>
        <thead><tr>${columnas.map(c => `<th scope="col">${escapeHTML(c)}</th>`).join("")}</tr></thead>
        <tbody>${filas.map(f => `<tr>${f.map(c => `<td>${escapeHTML(String(c))}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>`;
}

// Prepara el contenedor (canvas + tabla) y devuelve el canvas, o null si Chart.js no cargó
function lienzo(contenedor, titulo, columnas, filas) {
  const anterior = GRAFICAS.get(contenedor.id);
  if (anterior) anterior.destroy();
  GRAFICAS.delete(contenedor.id);
  if (!window.Chart) {
    contenedor.innerHTML = `<p class="form-hint">No se pudo cargar la gráfica. Recarga la página.</p>`;
    return null;
  }
  contenedor.innerHTML = `<div class="grafica-lienzo"><canvas role="img" aria-label="${escapeHTML(titulo)}"></canvas></div>
    ${tablaOculta(titulo, columnas, filas)}`;
  return contenedor.querySelector("canvas");
}

// Opciones comunes: fuente Archivo, tooltips con los colores del sitio y animación solo si se pide
function base(animar) {
  Chart.defaults.font.family = token("font") || "Archivo, sans-serif";
  Chart.defaults.color = token("texto-2");
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: animar && !MOVIMIENTO_REDUCIDO.matches ? { duration: 450 } : false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: token("tinta"),
        titleColor: token("hoja"),
        bodyColor: token("hoja"),
        borderColor: token("tinta"),
        borderWidth: 1,
        cornerRadius: 4,
        padding: 10,
        displayColors: false
      }
    }
  };
}

function ejes() {
  return {
    grid: { color: token("linea"), drawTicks: false },
    border: { display: false },
    ticks: { color: token("texto-2"), padding: 8 }
  };
}

/**
 * Línea de pedidos (eje izquierdo) y ventas en pesos (eje derecho).
 * datos: { etiquetas: [...], pedidos: [...], ventas: [...] }
 */
function graficaLinea(contenedor, { titulo, etiquetas, pedidos, ventas }, { animar = false } = {}) {
  const filas = etiquetas.map((e, i) => [e, pedidos[i], pesos(ventas[i])]);
  const canvas = lienzo(contenedor, titulo, ["Día", "Pedidos", "Ventas confirmadas"], filas);
  if (!canvas) return;
  const opciones = base(animar);
  opciones.interaction = { mode: "index", intersect: false };
  opciones.plugins.tooltip.callbacks = {
    label: ctx => ctx.datasetIndex === 0 ? `Pedidos: ${ctx.parsed.y}` : `Ventas: ${pesos(ctx.parsed.y)}`
  };
  opciones.scales = {
    x: { ...ejes(), grid: { display: false }, ticks: { ...ejes().ticks, maxTicksLimit: 8, maxRotation: 0 } },
    y: { ...ejes(), beginAtZero: true, ticks: { ...ejes().ticks, precision: 0 } },
    y1: { ...ejes(), position: "right", beginAtZero: true, grid: { display: false },
          ticks: { ...ejes().ticks, callback: valor => pesos(valor) } }
  };
  GRAFICAS.set(contenedor.id, new Chart(canvas, {
    type: "line",
    data: {
      labels: etiquetas,
      datasets: [
        { label: "Pedidos", data: pedidos, yAxisID: "y", borderColor: token("tinta"), backgroundColor: token("tinta"),
          borderWidth: 2, pointRadius: 2, pointHoverRadius: 5, cubicInterpolationMode: "monotone", fill: false },
        { label: "Ventas confirmadas", data: ventas, yAxisID: "y1", borderColor: token("tinta-2"), backgroundColor: token("tinta-2"),
          borderWidth: 2, borderDash: [6, 4], pointRadius: 0, pointHoverRadius: 5, cubicInterpolationMode: "monotone", fill: false }
      ]
    },
    options: opciones
  }));
}

/**
 * Dona. datos: { etiquetas: [...], valores: [...], colores: ["senal", "tinta", "linea"] } (nombres de token)
 */
function graficaDona(contenedor, { titulo, etiquetas, valores, colores }, { animar = false } = {}) {
  const filas = etiquetas.map((e, i) => [e, valores[i]]);
  const canvas = lienzo(contenedor, titulo, ["Estado", "Pedidos"], filas);
  if (!canvas) return;
  const opciones = base(animar);
  opciones.cutout = "68%";
  GRAFICAS.set(contenedor.id, new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: etiquetas,
      datasets: [{
        data: valores,
        backgroundColor: colores.map(token),
        borderColor: token("tinta"),
        borderWidth: 1.5,
        hoverOffset: 0
      }]
    },
    options: opciones
  }));
}

/**
 * Barras horizontales. datos: { etiquetas: [...], valores: [...], nombre: "Pedidos" }
 */
function graficaBarras(contenedor, { titulo, etiquetas, valores, nombre }, { animar = false } = {}) {
  const filas = etiquetas.map((e, i) => [e, valores[i]]);
  const canvas = lienzo(contenedor, titulo, ["Tienda", nombre], filas);
  if (!canvas) return;
  // La altura crece con el número de tiendas para que las barras no queden enormes
  canvas.parentElement.style.height = `${Math.max(140, 56 + etiquetas.length * 40)}px`;
  const opciones = base(animar);
  opciones.indexAxis = "y";
  opciones.plugins.tooltip.callbacks = { label: ctx => `${nombre}: ${ctx.parsed.x}` };
  opciones.scales = {
    x: { ...ejes(), beginAtZero: true, ticks: { ...ejes().ticks, precision: 0 } },
    y: { ...ejes(), grid: { display: false }, ticks: { ...ejes().ticks, color: token("tinta") } }
  };
  GRAFICAS.set(contenedor.id, new Chart(canvas, {
    type: "bar",
    data: {
      labels: etiquetas,
      datasets: [{ label: nombre, data: valores, backgroundColor: token("tinta"), borderRadius: 4, maxBarThickness: 22 }]
    },
    options: opciones
  }));
}
