/**
 * Ofertas de cada tienda: cuáles aplican hoy y cómo cambian el precio.
 * Es el único lugar que calcula descuentos (tienda, carrito y portada lo usan).
 */
const { pool } = require("./db");

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const ZONA = "America/Mexico_City";

// Fecha de hoy en Ciudad de México. En desarrollo se puede fijar con HOY_PRUEBA=AAAA-MM-DD.
function hoy() {
  const prueba = process.env.NODE_ENV !== "production" && process.env.HOY_PRUEBA;
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(prueba || "")
    ? prueba
    : new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());
  return { fecha, dia: new Date(`${fecha}T12:00:00Z`).getUTCDay() };
}

// "Lunes y miércoles", "Todos los días", "De lunes a viernes"
function textoDias(dias) {
  const lista = [...new Set(dias.map(Number))].sort((a, b) => a - b);
  if (lista.length === 7) return "Todos los días";
  if (lista.join() === "1,2,3,4,5") return "De lunes a viernes";
  const nombres = lista.map(d => DIAS[d]);
  const texto = nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}` : nombres[0] || "";
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function redondear(n) {
  return Math.round(n * 100) / 100;
}

// Ofertas activas de hoy, opcionalmente solo de algunas tiendas
async function ofertasDeHoy(standIds = null) {
  const { dia } = hoy();
  const { rows } = await pool.query(
    `SELECT id, stand_id, producto_id, subcategoria_id, titulo, descripcion, tipo, valor::float AS valor, dias
     FROM ofertas
     WHERE activa AND $1 = ANY(dias) AND ($2::int[] IS NULL OR stand_id = ANY($2))`,
    [dia, standIds]);
  return rows;
}

function aplicaA(oferta, producto) {
  if (oferta.stand_id !== producto.stand_id) return false;
  if (oferta.producto_id) return oferta.producto_id === producto.id;
  if (oferta.subcategoria_id) return oferta.subcategoria_id === producto.subcategoria_id;
  return true; // toda la tienda
}

function totalCon(oferta, precio, cantidad) {
  if (oferta.tipo === "porcentaje") return redondear(precio * cantidad * (1 - oferta.valor / 100));
  if (oferta.tipo === "precio_especial") return oferta.valor < precio ? redondear(oferta.valor * cantidad) : precio * cantidad;
  if (oferta.tipo === "dos_por_uno") return redondear(precio * Math.ceil(cantidad / 2));
  return precio * cantidad;
}

// La mejor oferta para el cliente en esa cantidad. Devuelve { total, oferta } (oferta null si ninguna baja el precio).
function mejorPrecio(producto, ofertas, cantidad) {
  const base = redondear(producto.precio * cantidad);
  let mejor = { total: base, oferta: null };
  for (const oferta of ofertas) {
    if (!aplicaA(oferta, producto)) continue;
    const total = totalCon(oferta, producto.precio, cantidad);
    if (total < mejor.total) mejor = { total, oferta };
  }
  return mejor;
}

// Lo que se muestra en la tarjeta: precio con descuento (si hay) o la etiqueta del 2x1
function ofertaParaTarjeta(producto, ofertas) {
  const aplicables = ofertas.filter(o => aplicaA(o, producto));
  if (!aplicables.length || producto.precio === null) return null;
  const unidad = mejorPrecio(producto, aplicables, 1);
  if (unidad.oferta) {
    return { titulo: unidad.oferta.titulo, tipo: unidad.oferta.tipo, precio_oferta: unidad.total };
  }
  const dosPorUno = aplicables.find(o => o.tipo === "dos_por_uno");
  return dosPorUno ? { titulo: dosPorUno.titulo, tipo: "dos_por_uno", precio_oferta: null } : null;
}

function ofertaPublica(oferta, diaHoy) {
  return {
    id: oferta.id,
    titulo: oferta.titulo,
    descripcion: oferta.descripcion,
    tipo: oferta.tipo,
    valor: oferta.valor,
    dias: oferta.dias,
    dias_texto: textoDias(oferta.dias),
    hoy: oferta.dias.includes(diaHoy),
    producto_id: oferta.producto_id,
    subcategoria_id: oferta.subcategoria_id
  };
}

module.exports = { hoy, textoDias, ofertasDeHoy, mejorPrecio, ofertaParaTarjeta, ofertaPublica, redondear, DIAS };
