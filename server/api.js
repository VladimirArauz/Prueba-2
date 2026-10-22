/**
 * API pública: tiendas, catálogo, ofertas, promociones, búsqueda y precios del carrito.
 * Todo lo que modifica datos está en server/admin.js.
 */
const express = require("express");
const { pool } = require("./db");
const { cargarAdmin, puedeEditarStand } = require("./auth");
const { ErrorDeDatos, idValido, handle, numerosRespaldo } = require("./validar");
const {
  hoy, ofertasDeHoy, vigenteHoy, mejorPrecio, ofertaParaTarjeta, ofertaPublica, redondear, COLUMNAS_OFERTA, VIGENTE_HOY
} = require("./ofertas");

const router = express.Router();

const MAX_ITEMS_CARRITO = 60;
const MAX_POR_BLOQUE_VITRINA = 12;

// ================= Formato de salida =================
function version(fecha) {
  return new Date(fecha).getTime();
}

function imagenProducto(fila) {
  if (fila.tiene_imagen) return `/api/productos/${fila.id}/imagen?v=${version(fila.actualizado_en)}`;
  return fila.imagen_ruta || null;
}

function imagenTienda(fila) {
  if (fila.tiene_portada) return `/api/stands/${fila.id}/portada?v=${version(fila.actualizado_en)}`;
  return fila.imagen_ruta || null;
}

// Si la tienda no tiene números propios, se usan los de WHATSAPP_NUMBERS
function numerosDe(stand) {
  return stand.whatsapp && stand.whatsapp.length ? stand.whatsapp : numerosRespaldo();
}

function productoPublico(fila, ofertas = []) {
  return {
    id: fila.id,
    tipo: fila.tipo,
    nombre: fila.nombre,
    subcategoria_id: fila.subcategoria_id,
    precio: fila.precio,
    precio_modo: fila.precio_modo,
    disponibilidad: fila.disponibilidad,
    descripcion: fila.descripcion,
    imagen_url: imagenProducto(fila),
    calificacion: fila.calificacion ?? null,
    resenas: fila.total_resenas || 0,
    colores_total: fila.total_colores || 0,
    oferta: fila.tipo === "producto" && fila.precio_modo === "fijo" ? ofertaParaTarjeta(fila, ofertas) : null
  };
}

const COLUMNAS_PRODUCTO = `
  p.id, p.stand_id, p.subcategoria_id, p.tipo, p.nombre, p.precio::float AS precio, p.precio_modo,
  p.disponibilidad, p.descripcion, (p.imagen IS NOT NULL) AS tiene_imagen, p.imagen_ruta, p.actualizado_en,
  (SELECT round(avg(r.calificacion), 1)::float FROM resenas r WHERE r.producto_id = p.id AND r.visible) AS calificacion,
  (SELECT count(*)::int FROM resenas r WHERE r.producto_id = p.id AND r.visible) AS total_resenas,
  (SELECT count(*)::int FROM producto_colores c WHERE c.producto_id = p.id) AS total_colores`;

// ================= Configuración pública =================
router.get("/config", (req, res) => {
  res.json({ whatsapp: numerosRespaldo() });
});

// ================= Tiendas =================
router.get("/stands", handle(async (req, res) => {
  const { dia, fecha } = hoy();
  const { rows } = await pool.query(
    `SELECT s.id, s.nombre, s.slug, s.descripcion, s.icono, s.imagen_ruta, s.actualizado_en,
            (s.portada IS NOT NULL) AS tiene_portada,
            (SELECT count(*)::int FROM productos p WHERE p.stand_id = s.id AND p.visible AND p.tipo = 'producto') AS productos,
            (SELECT count(*)::int FROM productos p WHERE p.stand_id = s.id AND p.visible AND p.tipo = 'servicio') AS servicios,
            (SELECT count(*)::int FROM ofertas o WHERE o.stand_id = s.id AND ${VIGENTE_HOY}) AS ofertas_hoy
     FROM stands s WHERE s.visible ORDER BY s.orden, s.nombre`, [dia, fecha]);
  res.json(rows.map(s => ({
    id: s.id, nombre: s.nombre, slug: s.slug, descripcion: s.descripcion, icono: s.icono,
    imagen_url: imagenTienda(s), productos: s.productos, servicios: s.servicios, ofertas_hoy: s.ofertas_hoy
  })));
}));

router.get("/stands/:slug", handle(async (req, res) => {
  const slug = String(req.params.slug).slice(0, 60);
  const { rows } = await pool.query(
    `SELECT id, nombre, slug, descripcion, icono, whatsapp, imagen_ruta, actualizado_en,
            (portada IS NOT NULL) AS tiene_portada
     FROM stands WHERE slug = $1 AND visible`, [slug]);
  const stand = rows[0];
  if (!stand) return res.status(404).json({ error: "Esta tienda no existe o ya no está disponible." });

  const cuando = hoy();
  const [subcategorias, productos, ofertas] = await Promise.all([
    pool.query("SELECT id, nombre, slug FROM subcategorias WHERE stand_id = $1 ORDER BY orden, nombre", [stand.id]),
    pool.query(`SELECT ${COLUMNAS_PRODUCTO} FROM productos p
                WHERE p.stand_id = $1 AND p.visible ORDER BY p.orden, p.creado_en DESC, p.id DESC`, [stand.id]),
    // Las activas que no han vencido (las de temporada que aún no empiezan se ven como "próximamente")
    pool.query(`SELECT ${COLUMNAS_OFERTA} FROM ofertas o
                WHERE o.stand_id = $1 AND o.activa AND (o.fin IS NULL OR o.fin >= $2::date) ORDER BY o.id`,
               [stand.id, cuando.fecha])
  ]);
  const deHoy = ofertas.rows.filter(o => vigenteHoy(o, cuando));

  res.json({
    tienda: {
      id: stand.id, nombre: stand.nombre, slug: stand.slug, descripcion: stand.descripcion, icono: stand.icono,
      imagen_url: imagenTienda(stand), whatsapp: numerosDe(stand)
    },
    subcategorias: subcategorias.rows,
    productos: productos.rows.filter(p => p.tipo === "producto").map(p => productoPublico(p, deHoy)),
    servicios: productos.rows.filter(p => p.tipo === "servicio").map(p => productoPublico(p)),
    ofertas: ofertas.rows.map(o => ofertaPublica(o, cuando))
  });
}));

// ================= Imágenes guardadas en la base =================
// La de algo oculto solo la ve en Necutools quien puede editarlo, y sin caché pública
async function servirImagen(req, res, fila, puedeVerla) {
  if (!fila || !fila.imagen) return res.status(404).end();
  if (fila.publica) {
    res.set("Cache-Control", "public, max-age=86400");
  } else {
    req.admin = await cargarAdmin(req);
    if (!req.admin || !puedeVerla(req)) return res.status(404).end();
    res.set("Cache-Control", "private, no-store");
  }
  res.set("Content-Type", fila.tipo);
  res.send(fila.imagen);
}

router.get("/stands/:id/portada", handle(async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).end();
  const { rows } = await pool.query(
    "SELECT portada AS imagen, portada_tipo AS tipo, visible AS publica FROM stands WHERE id = $1", [id]);
  await servirImagen(req, res, rows[0], r => puedeEditarStand(r, id));
}));

router.get("/productos/:id/imagen", handle(async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).end();
  const { rows } = await pool.query(
    `SELECT p.imagen, p.imagen_tipo AS tipo, p.stand_id, (p.visible AND s.visible) AS publica
     FROM productos p JOIN stands s ON s.id = p.stand_id WHERE p.id = $1`, [id]);
  await servirImagen(req, res, rows[0], r => puedeEditarStand(r, rows[0].stand_id));
}));

router.get("/colores/:id/imagen", handle(async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).end();
  const { rows } = await pool.query(
    `SELECT c.imagen, c.imagen_tipo AS tipo, p.stand_id, (p.visible AND s.visible) AS publica
     FROM producto_colores c JOIN productos p ON p.id = c.producto_id JOIN stands s ON s.id = p.stand_id
     WHERE c.id = $1`, [id]);
  await servirImagen(req, res, rows[0], r => puedeEditarStand(r, rows[0].stand_id));
}));

// ================= Detalle de un producto o servicio =================
router.get("/productos/:id", handle(async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).json({ error: "Este producto no existe o ya no está disponible." });
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS_PRODUCTO}, s.nombre AS tienda, s.slug, s.icono, s.whatsapp, sc.nombre AS subcategoria
     FROM productos p JOIN stands s ON s.id = p.stand_id
     LEFT JOIN subcategorias sc ON sc.id = p.subcategoria_id
     WHERE p.id = $1 AND p.visible AND s.visible`, [id]);
  const fila = rows[0];
  if (!fila) return res.status(404).json({ error: "Este producto no existe o ya no está disponible." });
  const ofertas = fila.tipo === "producto" ? await ofertasDeHoy([fila.stand_id]) : [];
  const producto = productoPublico(fila, ofertas);
  const { rows: colores } = await pool.query(
    `SELECT id, nombre, hex, disponible, (imagen IS NOT NULL) AS tiene_imagen, actualizado_en
     FROM producto_colores WHERE producto_id = $1 ORDER BY orden, id`, [fila.id]);
  res.json({
    ...producto,
    colores: colores.map(c => ({
      id: c.id, nombre: c.nombre, hex: c.hex, disponible: c.disponible,
      imagen_url: c.tiene_imagen ? `/api/colores/${c.id}/imagen?v=${version(c.actualizado_en)}` : producto.imagen_url
    })),
    tienda: fila.tienda, slug: fila.slug, icono: fila.icono, subcategoria: fila.subcategoria,
    whatsapp: fila.tipo === "servicio" ? numerosDe(fila) : []
  });
}));

// ================= Ofertas de hoy (portada) =================
router.get("/hoy", handle(async (req, res) => {
  const { dia, fecha } = hoy();
  const { rows } = await pool.query(
    `SELECT o.id, o.titulo, o.descripcion, o.clase, s.nombre AS tienda, s.slug, s.icono
     FROM ofertas o JOIN stands s ON s.id = o.stand_id
     WHERE ${VIGENTE_HOY} AND s.visible
     ORDER BY s.orden, s.nombre, o.id`, [dia, fecha]);
  res.json({ fecha, dia, ofertas: rows });
}));

// ================= Vitrina de ofertas (final de la portada y de cada tienda) =================
// Productos con oferta vigente hoy, en bloques: uno por temporada, las semanales de hoy y los remates.
const ORDEN_CLASES = { temporada: 0, semanal: 1, remate: 2 };

router.get("/vitrina", handle(async (req, res) => {
  const cuando = hoy();
  const slug = typeof req.query.tienda === "string" && req.query.tienda ? req.query.tienda.slice(0, 60) : null;
  const { rows: ofertas } = await pool.query(
    `SELECT ${COLUMNAS_OFERTA} FROM ofertas o JOIN stands s ON s.id = o.stand_id
     WHERE ${VIGENTE_HOY} AND s.visible AND ($3::text IS NULL OR s.slug = $3)`,
    [cuando.dia, cuando.fecha, slug]);
  if (!ofertas.length) return res.json({ dia: cuando.dia, bloques: [] });

  const { rows: productos } = await pool.query(
    `SELECT ${COLUMNAS_PRODUCTO}, s.nombre AS tienda, s.slug, s.icono
     FROM productos p JOIN stands s ON s.id = p.stand_id
     WHERE p.stand_id = ANY($1) AND p.visible AND p.tipo = 'producto' AND p.precio_modo = 'fijo'
     ORDER BY s.orden, p.orden, p.creado_en DESC, p.id DESC`,
    [[...new Set(ofertas.map(o => o.stand_id))]]);

  // Cada producto va al bloque de la oferta que le da el mejor precio
  const bloques = new Map();
  for (const fila of productos) {
    const producto = productoPublico(fila, ofertas);
    const oferta = producto.oferta;
    if (!oferta) continue;
    const clave = oferta.clase === "temporada" ? `temporada-${oferta.temporada.toLowerCase()}` : oferta.clase;
    if (!bloques.has(clave)) bloques.set(clave, { clave, clase: oferta.clase, temporada: oferta.temporada, total: 0, productos: [] });
    const bloque = bloques.get(clave);
    bloque.total += 1;
    if (bloque.productos.length < MAX_POR_BLOQUE_VITRINA) {
      bloque.productos.push({ ...producto, tienda: fila.tienda, slug: fila.slug, icono: fila.icono });
    }
  }

  res.json({
    dia: cuando.dia,
    bloques: [...bloques.values()].sort((a, b) =>
      ORDEN_CLASES[a.clase] - ORDEN_CLASES[b.clase] || String(a.temporada).localeCompare(String(b.temporada)))
  });
}));

// ================= Promociones generales (paquetes) =================
async function promocionesVigentes({ ids = null, soloDestacadas = false } = {}) {
  const { fecha } = hoy();
  const { rows: promos } = await pool.query(
    `SELECT id, titulo, descripcion, precio::float AS precio, inicio::text, fin::text, destacada,
            (imagen IS NOT NULL) AS tiene_imagen, actualizado_en
     FROM promociones
     WHERE activa AND inicio <= $1::date AND fin >= $1::date
       AND ($2::int[] IS NULL OR id = ANY($2)) AND (NOT $3 OR destacada)
     ORDER BY destacada DESC, fin, id`, [fecha, ids, soloDestacadas]);
  if (!promos.length) return [];

  const { rows: items } = await pool.query(
    `SELECT i.promocion_id, i.cantidad, p.id AS producto_id, p.nombre, p.precio::float AS precio, p.precio_modo,
            s.id AS stand_id, s.nombre AS tienda, s.slug, s.whatsapp, (p.visible AND s.visible) AS publico
     FROM promocion_items i
     JOIN productos p ON p.id = i.producto_id
     JOIN stands s ON s.id = p.stand_id
     WHERE i.promocion_id = ANY($1) ORDER BY s.orden, p.nombre`, [promos.map(p => p.id)]);

  return promos.map(promo => {
    const suyos = items.filter(i => i.promocion_id === promo.id);
    const normal = suyos.reduce((suma, i) => suma + (i.precio_modo === "fijo" ? i.precio * i.cantidad : 0), 0);
    const tiendas = [...new Map(suyos.map(i => [i.stand_id, i])).values()];
    return {
      id: promo.id,
      titulo: promo.titulo,
      descripcion: promo.descripcion,
      precio: promo.precio,
      precio_normal: normal > promo.precio ? redondear(normal) : null,
      inicio: promo.inicio,
      fin: promo.fin,
      destacada: promo.destacada,
      imagen_url: promo.tiene_imagen ? `/api/promociones/${promo.id}/imagen?v=${version(promo.actualizado_en)}` : null,
      incluye: suyos.map(i => ({ producto_id: i.producto_id, nombre: i.nombre, cantidad: i.cantidad, tienda: i.tienda, slug: i.slug })),
      tiendas: tiendas.map(t => t.tienda),
      whatsapp: [...new Set(tiendas.flatMap(t => numerosDe(t)))]
    };
  // Un paquete con un producto o una tienda oculta no se vende (ni muestra sus WhatsApp)
  }).filter(promo => promo.incluye.length && items.every(i => i.promocion_id !== promo.id || i.publico));
}

router.get("/promociones", handle(async (req, res) => {
  const promos = await promocionesVigentes({ soloDestacadas: req.query.destacadas === "1" });
  res.json(promos.map(({ whatsapp, ...promo }) => promo));
}));

router.get("/promociones/:id/imagen", handle(async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).end();
  const { rows } = await pool.query("SELECT imagen, imagen_tipo AS tipo, activa AS publica FROM promociones WHERE id = $1", [id]);
  await servirImagen(req, res, rows[0], r => r.admin.rol === "dueno");
}));

// ================= Búsqueda =================
router.get("/buscar", handle(async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 2 || q.length > 60) throw new ErrorDeDatos("Escribe de 2 a 60 letras para buscar.");
  const patron = `%${q.toLowerCase().replace(/[\\%_]/g, m => "\\" + m)}%`;
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS_PRODUCTO}, s.nombre AS tienda, s.slug, s.icono
     FROM productos p JOIN stands s ON s.id = p.stand_id
     WHERE p.visible AND s.visible AND (lower(p.nombre) LIKE $1 OR lower(p.descripcion) LIKE $1)
     ORDER BY (lower(p.nombre) LIKE $2) DESC, s.orden, p.nombre
     LIMIT 20`, [patron, patron.slice(1)]);
  res.json(rows.map(p => ({ ...productoPublico(p), tienda: p.tienda, slug: p.slug, icono: p.icono })));
}));

// ================= Precios del carrito (el servidor manda) =================
function leerCarrito(body) {
  const lista = body && Array.isArray(body.items) ? body.items : null;
  if (!lista || lista.length > MAX_ITEMS_CARRITO) throw new ErrorDeDatos("El carrito no es válido.");
  const porClave = new Map();
  for (const item of lista) {
    const tipo = item && (item.tipo === "paquete" ? "paquete" : item.tipo === "producto" ? "producto" : null);
    const id = item ? idValido(item.id) : null;
    const cantidad = item ? Number(item.cantidad) : 0;
    // Color elegido (solo productos con colores)
    const color = tipo === "producto" && item.color !== undefined && item.color !== null ? idValido(item.color) : null;
    if (!tipo || !id || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 99
        || (tipo === "producto" && item.color != null && !color)) {
      throw new ErrorDeDatos("El carrito no es válido.");
    }
    const clave = color ? `${tipo}-${id}-c${color}` : `${tipo}-${id}`;
    const previo = porClave.get(clave);
    porClave.set(clave, { tipo, id, color, cantidad: Math.min(99, (previo ? previo.cantidad : 0) + cantidad) });
  }
  return [...porClave.values()];
}

// Precios y grupos del carrito (una tienda o un paquete por grupo). También lo usa server/pedidos.js.
async function calcularCarrito(items) {
  const idsProductos = items.filter(i => i.tipo === "producto").map(i => i.id);
  const idsPaquetes = items.filter(i => i.tipo === "paquete").map(i => i.id);

  const { rows: productos } = idsProductos.length ? await pool.query(
    `SELECT p.id, p.stand_id, p.subcategoria_id, p.nombre, p.precio::float AS precio,
            s.nombre AS tienda, s.slug, s.orden, s.whatsapp
     FROM productos p JOIN stands s ON s.id = p.stand_id
     WHERE p.id = ANY($1) AND p.visible AND s.visible AND p.tipo = 'producto' AND p.precio_modo = 'fijo'`,
    [idsProductos]) : { rows: [] };
  const ofertas = productos.length ? await ofertasDeHoy([...new Set(productos.map(p => p.stand_id))]) : [];
  // Colores de esos productos: si un producto tiene colores, hay que elegir uno disponible
  const { rows: colores } = productos.length ? await pool.query(
    "SELECT id, producto_id, nombre, disponible FROM producto_colores WHERE producto_id = ANY($1)",
    [productos.map(p => p.id)]) : { rows: [] };
  const paquetes = idsPaquetes.length ? await promocionesVigentes({ ids: idsPaquetes }) : [];

  const grupos = new Map();
  const faltantes = [];

  for (const item of items) {
    if (item.tipo === "producto") {
      const p = productos.find(x => x.id === item.id);
      if (!p) { faltantes.push(item); continue; }
      const tieneColores = colores.some(c => c.producto_id === p.id);
      const color = item.color ? colores.find(c => c.id === item.color && c.producto_id === p.id) : null;
      if (tieneColores ? !color || !color.disponible : item.color) { faltantes.push(item); continue; }
      const clave = `tienda-${p.stand_id}`;
      if (!grupos.has(clave)) {
        grupos.set(clave, { clave, tipo: "tienda", nombre: p.tienda, slug: p.slug, orden: p.orden, whatsapp: numerosDe(p), items: [] });
      }
      const { total, oferta } = mejorPrecio(p, ofertas, item.cantidad);
      grupos.get(clave).items.push({
        tipo: "producto", id: p.id, color: color ? { id: color.id, nombre: color.nombre } : null, producto: p.nombre,
        nombre: color ? `${p.nombre} (${color.nombre})` : p.nombre, cantidad: item.cantidad, precio: p.precio,
        subtotal_base: redondear(p.precio * item.cantidad), subtotal: total, oferta: oferta ? oferta.titulo : null
      });
    } else {
      const promo = paquetes.find(x => x.id === item.id);
      if (!promo) { faltantes.push(item); continue; }
      const subtotal = redondear(promo.precio * item.cantidad);
      grupos.set(`paquete-${promo.id}`, {
        clave: `paquete-${promo.id}`, tipo: "paquete", nombre: promo.titulo, orden: -1,
        tiendas: promo.tiendas, incluye: promo.incluye, whatsapp: promo.whatsapp,
        items: [{ tipo: "paquete", id: promo.id, nombre: promo.titulo, cantidad: item.cantidad, precio: promo.precio,
                  subtotal_base: subtotal, subtotal, oferta: null }]
      });
    }
  }

  const salida = [...grupos.values()]
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre))
    .map(({ orden, ...grupo }) => {
      const base = redondear(grupo.items.reduce((s, i) => s + i.subtotal_base, 0));
      const total = redondear(grupo.items.reduce((s, i) => s + i.subtotal, 0));
      return { ...grupo, subtotal_base: base, descuento: redondear(base - total), total };
    });

  return { grupos: salida, faltantes };
}

router.post("/carrito/precios", handle(async (req, res) => {
  res.json(await calcularCarrito(leerCarrito(req.body)));
}));

module.exports = { router, calcularCarrito, leerCarrito };
