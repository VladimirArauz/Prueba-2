/**
 * API pública: tiendas, catálogo, ofertas, promociones, búsqueda y precios del carrito.
 * Todo lo que modifica datos está en server/admin.js.
 */
const express = require("express");
const { pool } = require("./db");
const { ErrorDeDatos, idValido, handle, numerosRespaldo } = require("./validar");
const { hoy, ofertasDeHoy, mejorPrecio, ofertaParaTarjeta, ofertaPublica, redondear } = require("./ofertas");

const router = express.Router();

const MAX_ITEMS_CARRITO = 60;

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
    oferta: fila.tipo === "producto" && fila.precio_modo === "fijo" ? ofertaParaTarjeta(fila, ofertas) : null
  };
}

const COLUMNAS_PRODUCTO = `
  p.id, p.stand_id, p.subcategoria_id, p.tipo, p.nombre, p.precio::float AS precio, p.precio_modo,
  p.disponibilidad, p.descripcion, (p.imagen IS NOT NULL) AS tiene_imagen, p.imagen_ruta, p.actualizado_en`;

// ================= Configuración pública =================
router.get("/config", (req, res) => {
  res.json({ whatsapp: numerosRespaldo() });
});

// ================= Tiendas =================
router.get("/stands", handle(async (req, res) => {
  const { dia } = hoy();
  const { rows } = await pool.query(
    `SELECT s.id, s.nombre, s.slug, s.descripcion, s.icono, s.imagen_ruta, s.actualizado_en,
            (s.portada IS NOT NULL) AS tiene_portada,
            (SELECT count(*)::int FROM productos p WHERE p.stand_id = s.id AND p.visible AND p.tipo = 'producto') AS productos,
            (SELECT count(*)::int FROM productos p WHERE p.stand_id = s.id AND p.visible AND p.tipo = 'servicio') AS servicios,
            (SELECT count(*)::int FROM ofertas o WHERE o.stand_id = s.id AND o.activa AND $1 = ANY(o.dias)) AS ofertas_hoy
     FROM stands s WHERE s.visible ORDER BY s.orden, s.nombre`, [dia]);
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

  const { dia } = hoy();
  const [subcategorias, productos, ofertas] = await Promise.all([
    pool.query("SELECT id, nombre, slug FROM subcategorias WHERE stand_id = $1 ORDER BY orden, nombre", [stand.id]),
    pool.query(`SELECT ${COLUMNAS_PRODUCTO} FROM productos p
                WHERE p.stand_id = $1 AND p.visible ORDER BY p.orden, p.creado_en DESC, p.id DESC`, [stand.id]),
    pool.query(`SELECT id, stand_id, producto_id, subcategoria_id, titulo, descripcion, tipo, valor::float AS valor, dias
                FROM ofertas WHERE stand_id = $1 AND activa ORDER BY id`, [stand.id])
  ]);
  const deHoy = ofertas.rows.filter(o => o.dias.includes(dia));

  res.json({
    tienda: {
      id: stand.id, nombre: stand.nombre, slug: stand.slug, descripcion: stand.descripcion, icono: stand.icono,
      imagen_url: imagenTienda(stand), whatsapp: numerosDe(stand)
    },
    subcategorias: subcategorias.rows,
    productos: productos.rows.filter(p => p.tipo === "producto").map(p => productoPublico(p, deHoy)),
    servicios: productos.rows.filter(p => p.tipo === "servicio").map(p => productoPublico(p)),
    ofertas: ofertas.rows.map(o => ofertaPublica(o, dia))
  });
}));

router.get("/stands/:id/portada", handle(async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).end();
  const { rows } = await pool.query("SELECT portada, portada_tipo FROM stands WHERE id = $1", [id]);
  if (!rows[0] || !rows[0].portada) return res.status(404).end();
  res.set("Content-Type", rows[0].portada_tipo);
  res.set("Cache-Control", "public, max-age=86400");
  res.send(rows[0].portada);
}));

// ================= Imágenes de productos =================
router.get("/productos/:id/imagen", handle(async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).end();
  const { rows } = await pool.query("SELECT imagen, imagen_tipo FROM productos WHERE id = $1", [id]);
  if (!rows[0] || !rows[0].imagen) return res.status(404).end();
  res.set("Content-Type", rows[0].imagen_tipo);
  res.set("Cache-Control", "public, max-age=86400");
  res.send(rows[0].imagen);
}));

// ================= Ofertas de hoy (portada) =================
router.get("/hoy", handle(async (req, res) => {
  const { dia, fecha } = hoy();
  const { rows } = await pool.query(
    `SELECT o.id, o.titulo, o.descripcion, s.nombre AS tienda, s.slug, s.icono
     FROM ofertas o JOIN stands s ON s.id = o.stand_id
     WHERE o.activa AND s.visible AND $1 = ANY(o.dias)
     ORDER BY s.orden, s.nombre, o.id`, [dia]);
  res.json({ fecha, dia, ofertas: rows });
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
            s.id AS stand_id, s.nombre AS tienda, s.slug, s.whatsapp
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
  }).filter(promo => promo.incluye.length);
}

router.get("/promociones", handle(async (req, res) => {
  const promos = await promocionesVigentes({ soloDestacadas: req.query.destacadas === "1" });
  res.json(promos.map(({ whatsapp, ...promo }) => promo));
}));

router.get("/promociones/:id/imagen", handle(async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).end();
  const { rows } = await pool.query("SELECT imagen, imagen_tipo FROM promociones WHERE id = $1", [id]);
  if (!rows[0] || !rows[0].imagen) return res.status(404).end();
  res.set("Content-Type", rows[0].imagen_tipo);
  res.set("Cache-Control", "public, max-age=86400");
  res.send(rows[0].imagen);
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
    if (!tipo || !id || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 99) {
      throw new ErrorDeDatos("El carrito no es válido.");
    }
    const clave = `${tipo}-${id}`;
    const previo = porClave.get(clave);
    porClave.set(clave, { tipo, id, cantidad: Math.min(99, (previo ? previo.cantidad : 0) + cantidad) });
  }
  return [...porClave.values()];
}

router.post("/carrito/precios", handle(async (req, res) => {
  const items = leerCarrito(req.body);
  const idsProductos = items.filter(i => i.tipo === "producto").map(i => i.id);
  const idsPaquetes = items.filter(i => i.tipo === "paquete").map(i => i.id);

  const { rows: productos } = idsProductos.length ? await pool.query(
    `SELECT p.id, p.stand_id, p.subcategoria_id, p.nombre, p.precio::float AS precio,
            s.nombre AS tienda, s.slug, s.orden, s.whatsapp
     FROM productos p JOIN stands s ON s.id = p.stand_id
     WHERE p.id = ANY($1) AND p.visible AND s.visible AND p.tipo = 'producto' AND p.precio_modo = 'fijo'`,
    [idsProductos]) : { rows: [] };
  const ofertas = productos.length ? await ofertasDeHoy([...new Set(productos.map(p => p.stand_id))]) : [];
  const paquetes = idsPaquetes.length ? await promocionesVigentes({ ids: idsPaquetes }) : [];

  const grupos = new Map();
  const faltantes = [];

  for (const item of items) {
    if (item.tipo === "producto") {
      const p = productos.find(x => x.id === item.id);
      if (!p) { faltantes.push(item); continue; }
      const clave = `tienda-${p.stand_id}`;
      if (!grupos.has(clave)) {
        grupos.set(clave, { clave, tipo: "tienda", nombre: p.tienda, slug: p.slug, orden: p.orden, whatsapp: numerosDe(p), items: [] });
      }
      const { total, oferta } = mejorPrecio(p, ofertas, item.cantidad);
      grupos.get(clave).items.push({
        tipo: "producto", id: p.id, nombre: p.nombre, cantidad: item.cantidad, precio: p.precio,
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

  res.json({ grupos: salida, faltantes });
}));

module.exports = { router };
