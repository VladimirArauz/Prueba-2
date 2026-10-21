/**
 * API de Necutools (/api/admin): todo requiere sesión.
 * Dueños: todo. Encargados: solo las tiendas que tienen asignadas.
 */
const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("./db");
const { requireAdmin, requireDueno, puedeEditarStand, cerrarSesionesDe, usarCodigo, BCRYPT_COST } = require("./auth");
const { validarContrasena } = require("./contrasenas");
const { exigirNoFrenada, registrarFallo, limpiarFallos } = require("./intentos");
const totp = require("./totp");
const { limpiarMetadatos } = require("./imagenes");
const { anotar } = require("./bitacora");
const v = require("./validar");
const { ErrorDeDatos, ErrorHttp, handle } = v;
const { textoDias } = require("./ofertas");

const router = express.Router();
router.use(requireAdmin);

const DISPONIBILIDAD = ["Disponible", "Pocas piezas", "Por pedido"];
const TIPOS = ["producto", "servicio"];
const PRECIO_MODOS = ["fijo", "desde", "cotizar"];
const TIPOS_OFERTA = ["porcentaje", "precio_especial", "dos_por_uno"];
const CLASES_OFERTA = ["semanal", "temporada", "remate"];
const TODOS_LOS_DIAS = [0, 1, 2, 3, 4, 5, 6];
const ROLES = ["dueno", "encargado"];
// Deben existir en public/iconos.js
const ICONOS_TIENDA = [
  "store", "shirt", "cpu", "candy", "megaphone", "pencil-ruler", "gift", "shapes", "wrench", "smartphone",
  "headphones", "cake", "cookie", "coffee", "book-open", "palette", "scissors", "sparkles", "heart", "party-popper"
];

// ================= Permisos =================
async function exigirStand(req, standId) {
  const id = v.idValido(standId);
  if (!id) throw new ErrorDeDatos("Elige una tienda.");
  const { rows } = await pool.query("SELECT id, nombre FROM stands WHERE id = $1", [id]);
  if (!rows[0]) throw new ErrorHttp(404, "Esa tienda no existe.");
  if (!puedeEditarStand(req, id)) throw new ErrorHttp(403, "No tienes permiso para editar esta tienda.");
  return rows[0];
}

// Filtro SQL de tiendas visibles en Necutools para este admin (null = todas)
function tiendasDe(req) {
  return req.admin.rol === "dueno" ? null : req.admin.tiendas;
}

function standFiltro(req, valor) {
  if (valor === undefined || valor === "") return null;
  const id = v.idValido(valor);
  if (!id) throw new ErrorDeDatos("Elige una tienda.");
  if (!puedeEditarStand(req, id)) throw new ErrorHttp(403, "No tienes permiso para ver esta tienda.");
  return id;
}

// Imagen subida, sin metadatos (ubicación GPS, modelo del celular…)
function imagenDe(body) {
  if (!body.imagen) return null;
  const { buffer, tipo } = v.leerImagen(body.imagen);
  return { buffer: limpiarMetadatos(buffer, tipo), tipo };
}

// ================= Mi sesión =================
router.get("/yo", (req, res) => {
  res.json({ id: req.admin.id, usuario: req.admin.usuario, rol: req.admin.rol, tiendas: req.admin.tiendas, totp_activo: req.admin.totp_activo, correo: req.admin.correo });
});

router.get("/iconos", (req, res) => res.json(ICONOS_TIENDA));

// ================= Tiendas =================
router.get("/tiendas", handle(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.id, s.nombre, s.slug, s.descripcion, s.icono, s.whatsapp, s.orden, s.visible, s.imagen_ruta,
            (s.portada IS NOT NULL) AS tiene_portada, s.actualizado_en,
            (SELECT count(*)::int FROM productos p WHERE p.stand_id = s.id) AS productos,
            COALESCE((SELECT json_agg(json_build_object('id', sc.id, 'nombre', sc.nombre, 'slug', sc.slug, 'orden', sc.orden)
                                      ORDER BY sc.orden, sc.nombre)
                      FROM subcategorias sc WHERE sc.stand_id = s.id), '[]') AS subcategorias
     FROM stands s WHERE ($1::int[] IS NULL OR s.id = ANY($1))
     ORDER BY s.orden, s.nombre`, [tiendasDe(req)]);
  res.json(rows.map(s => ({
    ...s,
    imagen_url: s.tiene_portada ? `/api/stands/${s.id}/portada?v=${new Date(s.actualizado_en).getTime()}` : s.imagen_ruta
  })));
}));

function datosTienda(body) {
  const nombre = v.texto(body.nombre, "el nombre de la tienda", { max: 50, requerido: true });
  return {
    nombre,
    slug: v.slug(body.slug, "la dirección de la tienda", nombre),
    descripcion: v.texto(body.descripcion, "la descripción", { max: 300 }),
    icono: ICONOS_TIENDA.includes(body.icono) ? body.icono : "store",
    whatsapp: v.numerosWhatsApp(body.whatsapp),
    orden: v.entero(body.orden, "El orden", { min: 0, max: 9999, defecto: 100 }),
    visible: v.booleano(body.visible, true),
    imagen: imagenDe(body),
    quitarImagen: v.booleano(body.quitar_imagen, false)
  };
}

router.post("/tiendas", requireDueno, handle(async (req, res) => {
  const d = datosTienda(req.body);
  const { rows } = await pool.query(
    `INSERT INTO stands (nombre, slug, descripcion, icono, whatsapp, orden, visible, portada, portada_tipo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, nombre, slug`,
    [d.nombre, d.slug, d.descripcion, d.icono, d.whatsapp, d.orden, d.visible,
     d.imagen ? d.imagen.buffer : null, d.imagen ? d.imagen.tipo : null]).catch(err => {
    if (err.code === "23505") throw new ErrorHttp(409, "Ya existe una tienda con ese nombre o dirección.");
    throw err;
  });
  await anotar(req.admin, "crear", "tiendas", rows[0].id, rows[0].nombre);
  res.status(201).json(rows[0]);
}));

router.put("/tiendas/:id", handle(async (req, res) => {
  const stand = await exigirStand(req, req.params.id);
  const d = datosTienda(req.body);
  await pool.query(
    `UPDATE stands SET nombre = $1, slug = $2, descripcion = $3, icono = $4, whatsapp = $5, orden = $6, visible = $7,
       portada = CASE WHEN $8::bytea IS NOT NULL THEN $8 WHEN $10 THEN NULL ELSE portada END,
       portada_tipo = CASE WHEN $8::bytea IS NOT NULL THEN $9 WHEN $10 THEN NULL ELSE portada_tipo END,
       imagen_ruta = CASE WHEN $10 THEN NULL ELSE imagen_ruta END,
       actualizado_en = now()
     WHERE id = $11`,
    [d.nombre, d.slug, d.descripcion, d.icono, d.whatsapp, d.orden, d.visible,
     d.imagen ? d.imagen.buffer : null, d.imagen ? d.imagen.tipo : null, d.quitarImagen, stand.id]).catch(err => {
    if (err.code === "23505") throw new ErrorHttp(409, "Ya existe una tienda con ese nombre o dirección.");
    throw err;
  });
  await anotar(req.admin, "editar", "tiendas", stand.id, d.nombre);
  res.json({ id: stand.id, nombre: d.nombre, slug: d.slug });
}));

router.delete("/tiendas/:id", requireDueno, handle(async (req, res) => {
  const stand = await exigirStand(req, req.params.id);
  const { rows } = await pool.query("SELECT count(*)::int AS total FROM productos WHERE stand_id = $1", [stand.id]);
  if (rows[0].total > 0) {
    throw new ErrorHttp(409, `Primero borra o mueve los ${rows[0].total} productos y servicios de ${stand.nombre}.`);
  }
  await pool.query("DELETE FROM stands WHERE id = $1", [stand.id]);
  await anotar(req.admin, "borrar", "tiendas", stand.id, stand.nombre);
  res.status(204).end();
}));

// ================= Subcategorías =================
function datosSubcategoria(body) {
  const nombre = v.texto(body.nombre, "el nombre de la subcategoría", { max: 60, requerido: true });
  return { nombre, slug: v.slug(nombre, "el nombre de la subcategoría"), orden: v.entero(body.orden, "El orden", { defecto: 0 }) };
}

async function exigirSubcategoria(req, id) {
  const subId = v.idValido(id);
  const { rows } = subId ? await pool.query("SELECT id, stand_id FROM subcategorias WHERE id = $1", [subId]) : { rows: [] };
  if (!rows[0]) throw new ErrorHttp(404, "Esa subcategoría no existe.");
  await exigirStand(req, rows[0].stand_id);
  return rows[0];
}

const conflictoSubcategoria = err => {
  if (err.code === "23505") throw new ErrorHttp(409, "Esa tienda ya tiene una subcategoría con ese nombre.");
  throw err;
};

router.post("/tiendas/:id/subcategorias", handle(async (req, res) => {
  const stand = await exigirStand(req, req.params.id);
  const d = datosSubcategoria(req.body);
  const { rows } = await pool.query(
    "INSERT INTO subcategorias (stand_id, nombre, slug, orden) VALUES ($1, $2, $3, $4) RETURNING id, nombre, slug, orden",
    [stand.id, d.nombre, d.slug, d.orden]).catch(conflictoSubcategoria);
  await anotar(req.admin, "crear", "subcategorias", rows[0].id, `${d.nombre} (${stand.nombre})`);
  res.status(201).json(rows[0]);
}));

router.put("/subcategorias/:id", handle(async (req, res) => {
  const sub = await exigirSubcategoria(req, req.params.id);
  const d = datosSubcategoria(req.body);
  await pool.query("UPDATE subcategorias SET nombre = $1, slug = $2, orden = $3 WHERE id = $4",
    [d.nombre, d.slug, d.orden, sub.id]).catch(conflictoSubcategoria);
  await anotar(req.admin, "editar", "subcategorias", sub.id, d.nombre);
  res.json({ id: sub.id, ...d });
}));

router.delete("/subcategorias/:id", handle(async (req, res) => {
  const sub = await exigirSubcategoria(req, req.params.id);
  await pool.query("DELETE FROM subcategorias WHERE id = $1", [sub.id]);
  await anotar(req.admin, "borrar", "subcategorias", sub.id);
  res.status(204).end();
}));

// ================= Productos y servicios =================
router.get("/productos", handle(async (req, res) => {
  const stand = standFiltro(req, req.query.stand);
  const { rows } = await pool.query(
    `SELECT p.id, p.stand_id, s.nombre AS stand, p.subcategoria_id, sc.nombre AS subcategoria, p.tipo, p.nombre,
            p.precio::float AS precio, p.precio_modo, p.disponibilidad, p.descripcion, p.visible, p.orden,
            (p.imagen IS NOT NULL) AS tiene_imagen, p.imagen_ruta, p.creado_en, p.actualizado_en
     FROM productos p JOIN stands s ON s.id = p.stand_id
     LEFT JOIN subcategorias sc ON sc.id = p.subcategoria_id
     WHERE ($1::int IS NULL OR p.stand_id = $1) AND ($2::int[] IS NULL OR p.stand_id = ANY($2))
     ORDER BY s.orden, p.tipo, p.orden, p.creado_en DESC, p.id DESC`, [stand, tiendasDe(req)]);
  res.json(rows.map(({ tiene_imagen, imagen_ruta, ...p }) => ({
    ...p,
    imagen_url: tiene_imagen ? `/api/productos/${p.id}/imagen?v=${new Date(p.actualizado_en).getTime()}` : imagen_ruta
  })));
}));

async function datosProducto(req) {
  const body = req.body;
  const stand = await exigirStand(req, body.stand_id);
  const tipo = v.opcion(body.tipo, TIPOS, "si es producto o servicio");
  // Los productos se compran con precio fijo; los servicios pueden ser "desde" o "a cotizar"
  const precioModo = tipo === "producto" ? "fijo" : v.opcion(body.precio_modo, PRECIO_MODOS, "cómo se cobra el servicio");
  const subcategoriaId = v.idOpcional(body.subcategoria_id, "La subcategoría");
  if (subcategoriaId) {
    const { rows } = await pool.query("SELECT 1 FROM subcategorias WHERE id = $1 AND stand_id = $2", [subcategoriaId, stand.id]);
    if (!rows[0]) throw new ErrorDeDatos("Esa subcategoría no es de la tienda elegida.");
  }
  return {
    standId: stand.id,
    subcategoriaId,
    tipo,
    nombre: v.texto(body.nombre, tipo === "producto" ? "el nombre del producto" : "el nombre del servicio", { max: 120, requerido: true }),
    precioModo,
    precio: precioModo === "cotizar" ? null : v.precio(body.precio),
    disponibilidad: DISPONIBILIDAD.includes(body.disponibilidad) ? body.disponibilidad : "Disponible",
    descripcion: v.texto(body.descripcion, "la descripción", { max: 1000 }),
    visible: v.booleano(body.visible, true),
    orden: v.entero(body.orden, "El orden", { defecto: 0 }),
    imagen: imagenDe(body),
    quitarImagen: v.booleano(body.quitar_imagen, false)
  };
}

router.post("/productos", handle(async (req, res) => {
  const d = await datosProducto(req);
  const { rows } = await pool.query(
    `INSERT INTO productos (stand_id, subcategoria_id, tipo, nombre, precio_modo, precio, disponibilidad, descripcion,
                            visible, orden, imagen, imagen_tipo, categoria)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
             COALESCE((SELECT nombre FROM subcategorias WHERE id = $2), 'General'))
     RETURNING id, nombre`,
    [d.standId, d.subcategoriaId, d.tipo, d.nombre, d.precioModo, d.precio, d.disponibilidad, d.descripcion,
     d.visible, d.orden, d.imagen ? d.imagen.buffer : null, d.imagen ? d.imagen.tipo : null]);
  await anotar(req.admin, "crear", "productos", rows[0].id, rows[0].nombre);
  res.status(201).json(rows[0]);
}));

async function exigirProducto(req, id) {
  const productoId = v.idValido(id);
  const { rows } = productoId ? await pool.query("SELECT id, stand_id, nombre FROM productos WHERE id = $1", [productoId]) : { rows: [] };
  if (!rows[0]) throw new ErrorHttp(404, "Ese producto no existe.");
  await exigirStand(req, rows[0].stand_id);
  return rows[0];
}

router.put("/productos/:id", handle(async (req, res) => {
  const producto = await exigirProducto(req, req.params.id);
  const d = await datosProducto(req);
  await pool.query(
    `UPDATE productos SET stand_id = $1, subcategoria_id = $2, tipo = $3, nombre = $4, precio_modo = $5, precio = $6,
       disponibilidad = $7, descripcion = $8, visible = $9, orden = $10,
       imagen = CASE WHEN $11::bytea IS NOT NULL THEN $11 WHEN $13 THEN NULL ELSE imagen END,
       imagen_tipo = CASE WHEN $11::bytea IS NOT NULL THEN $12 WHEN $13 THEN NULL ELSE imagen_tipo END,
       imagen_ruta = CASE WHEN $13 THEN NULL ELSE imagen_ruta END,
       categoria = COALESCE((SELECT nombre FROM subcategorias WHERE id = $2), 'General'),
       actualizado_en = now()
     WHERE id = $14`,
    [d.standId, d.subcategoriaId, d.tipo, d.nombre, d.precioModo, d.precio, d.disponibilidad, d.descripcion,
     d.visible, d.orden, d.imagen ? d.imagen.buffer : null, d.imagen ? d.imagen.tipo : null, d.quitarImagen, producto.id]);
  // Si el producto cambió de tienda, sus ofertas de la tienda anterior ya no aplican
  if (d.standId !== producto.stand_id) {
    await pool.query("DELETE FROM ofertas WHERE producto_id = $1 AND stand_id <> $2", [producto.id, d.standId]);
  }
  await anotar(req.admin, "editar", "productos", producto.id, d.nombre);
  res.json({ id: producto.id, nombre: d.nombre });
}));

router.delete("/productos/:id", handle(async (req, res) => {
  const producto = await exigirProducto(req, req.params.id);
  await pool.query("DELETE FROM productos WHERE id = $1", [producto.id]);
  await anotar(req.admin, "borrar", "productos", producto.id, producto.nombre);
  res.status(204).end();
}));

// ================= Ofertas de la tienda =================
router.get("/ofertas", handle(async (req, res) => {
  const stand = standFiltro(req, req.query.stand);
  const { rows } = await pool.query(
    `SELECT o.id, o.stand_id, s.nombre AS stand, o.producto_id, p.nombre AS producto, o.subcategoria_id,
            sc.nombre AS subcategoria, o.titulo, o.descripcion, o.tipo, o.valor::float AS valor, o.dias, o.activa,
            o.clase, o.temporada, o.inicio::text AS inicio, o.fin::text AS fin, o.piezas
     FROM ofertas o JOIN stands s ON s.id = o.stand_id
     LEFT JOIN productos p ON p.id = o.producto_id
     LEFT JOIN subcategorias sc ON sc.id = o.subcategoria_id
     WHERE ($1::int IS NULL OR o.stand_id = $1) AND ($2::int[] IS NULL OR o.stand_id = ANY($2))
     ORDER BY s.orden, o.id`, [stand, tiendasDe(req)]);
  res.json(rows.map(o => ({ ...o, dias_texto: textoDias(o.dias) })));
}));

async function datosOferta(req) {
  const body = req.body;
  const stand = await exigirStand(req, body.stand_id);
  const tipo = v.opcion(body.tipo, TIPOS_OFERTA, "el tipo de oferta");
  const aplica = v.opcion(body.aplica, ["tienda", "subcategoria", "producto"], "a qué aplica la oferta");
  let productoId = null;
  let subcategoriaId = null;
  let precioProducto = null;

  if (aplica === "producto") {
    productoId = v.idOpcional(body.producto_id, "El producto");
    if (!productoId) throw new ErrorDeDatos("Elige el producto de la oferta.");
    const { rows } = await pool.query(
      "SELECT precio::float AS precio FROM productos WHERE id = $1 AND stand_id = $2 AND tipo = 'producto'", [productoId, stand.id]);
    if (!rows[0]) throw new ErrorDeDatos("Ese producto no es de la tienda elegida.");
    precioProducto = rows[0].precio;
  } else if (aplica === "subcategoria") {
    subcategoriaId = v.idOpcional(body.subcategoria_id, "La subcategoría");
    if (!subcategoriaId) throw new ErrorDeDatos("Elige la subcategoría de la oferta.");
    const { rows } = await pool.query("SELECT 1 FROM subcategorias WHERE id = $1 AND stand_id = $2", [subcategoriaId, stand.id]);
    if (!rows[0]) throw new ErrorDeDatos("Esa subcategoría no es de la tienda elegida.");
  }

  let valor = null;
  if (tipo === "porcentaje") {
    valor = Number(body.valor);
    if (!Number.isInteger(valor) || valor < 1 || valor > 90) throw new ErrorDeDatos("El descuento debe ser de 1 a 90 por ciento.");
  } else if (tipo === "precio_especial") {
    if (aplica !== "producto") throw new ErrorDeDatos("El precio especial solo se puede poner a un producto.");
    valor = v.precio(body.valor, "el precio especial");
    if (Number(valor) >= precioProducto) throw new ErrorDeDatos("El precio especial debe ser menor al precio normal del producto.");
  }

  // Semanal: por días de la semana. Temporada: por fechas, todos los días. Remate: hasta que se acabe o hasta una fecha.
  const clase = v.opcion(body.clase === undefined ? "semanal" : body.clase, CLASES_OFERTA, "la clase de oferta");
  let dias = TODOS_LOS_DIAS;
  let temporada = null;
  let inicio = null;
  let fin = null;
  let piezas = null;
  if (clase === "semanal") {
    dias = Array.isArray(body.dias) ? [...new Set(body.dias.map(Number))].filter(d => Number.isInteger(d) && d >= 0 && d <= 6) : [];
    if (!dias.length) throw new ErrorDeDatos("Elige al menos un día de la semana.");
  } else if (clase === "temporada") {
    temporada = v.texto(body.temporada, "la temporada", { max: 40, requerido: true });
    inicio = v.fecha(body.inicio, "la fecha de inicio");
    fin = v.fecha(body.fin, "la fecha de fin");
  } else {
    fin = body.fin ? v.fecha(body.fin, "la fecha límite") : null;
    piezas = v.entero(body.piezas, "Las piezas del remate", { min: 1, max: 9999, defecto: null });
  }
  if (inicio && fin && fin < inicio) throw new ErrorDeDatos("La fecha de fin debe ser igual o posterior a la de inicio.");

  return {
    standId: stand.id, productoId, subcategoriaId, tipo, valor, dias: [...dias].sort(), clase, temporada, inicio, fin, piezas,
    titulo: v.texto(body.titulo, "el título de la oferta", { max: 80, requerido: true }),
    descripcion: v.texto(body.descripcion, "la descripción", { max: 300 }),
    activa: v.booleano(body.activa, true)
  };
}

router.post("/ofertas", handle(async (req, res) => {
  const d = await datosOferta(req);
  const { rows } = await pool.query(
    `INSERT INTO ofertas (stand_id, producto_id, subcategoria_id, titulo, descripcion, tipo, valor, dias, activa,
                         clase, temporada, inicio, fin, piezas)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id, titulo`,
    [d.standId, d.productoId, d.subcategoriaId, d.titulo, d.descripcion, d.tipo, d.valor, d.dias, d.activa,
     d.clase, d.temporada, d.inicio, d.fin, d.piezas]);
  await anotar(req.admin, "crear", "ofertas", rows[0].id, rows[0].titulo);
  res.status(201).json(rows[0]);
}));

async function exigirOferta(req, id) {
  const ofertaId = v.idValido(id);
  const { rows } = ofertaId ? await pool.query("SELECT id, stand_id FROM ofertas WHERE id = $1", [ofertaId]) : { rows: [] };
  if (!rows[0]) throw new ErrorHttp(404, "Esa oferta no existe.");
  await exigirStand(req, rows[0].stand_id);
  return rows[0];
}

router.put("/ofertas/:id", handle(async (req, res) => {
  const oferta = await exigirOferta(req, req.params.id);
  const d = await datosOferta(req);
  await pool.query(
    `UPDATE ofertas SET stand_id = $1, producto_id = $2, subcategoria_id = $3, titulo = $4, descripcion = $5,
       tipo = $6, valor = $7, dias = $8, activa = $9, clase = $10, temporada = $11, inicio = $12, fin = $13, piezas = $14
     WHERE id = $15`,
    [d.standId, d.productoId, d.subcategoriaId, d.titulo, d.descripcion, d.tipo, d.valor, d.dias, d.activa,
     d.clase, d.temporada, d.inicio, d.fin, d.piezas, oferta.id]);
  await anotar(req.admin, "editar", "ofertas", oferta.id, d.titulo);
  res.json({ id: oferta.id, titulo: d.titulo });
}));

router.delete("/ofertas/:id", handle(async (req, res) => {
  const oferta = await exigirOferta(req, req.params.id);
  await pool.query("DELETE FROM ofertas WHERE id = $1", [oferta.id]);
  await anotar(req.admin, "borrar", "ofertas", oferta.id);
  res.status(204).end();
}));

// ================= Opiniones de los clientes =================
// El vendedor responde y puede ocultar una opinión inapropiada; no puede borrarla ni cambiarla.
router.get("/resenas", handle(async (req, res) => {
  const stand = standFiltro(req, req.query.stand);
  const { rows } = await pool.query(
    `SELECT r.id, r.producto_id, p.nombre AS producto, p.stand_id, s.nombre AS stand, c.nombre AS cliente,
            r.calificacion, r.comentario, r.respuesta, r.visible, r.creado_en
     FROM resenas r
     JOIN productos p ON p.id = r.producto_id
     JOIN stands s ON s.id = p.stand_id
     JOIN clientes c ON c.id = r.cliente_id
     WHERE ($1::int IS NULL OR p.stand_id = $1) AND ($2::int[] IS NULL OR p.stand_id = ANY($2))
     ORDER BY r.creado_en DESC, r.id DESC LIMIT 300`, [stand, tiendasDe(req)]);
  res.json(rows);
}));

router.put("/resenas/:id", handle(async (req, res) => {
  const id = v.idValido(req.params.id);
  const { rows } = id ? await pool.query(
    "SELECT r.id, p.stand_id FROM resenas r JOIN productos p ON p.id = r.producto_id WHERE r.id = $1", [id]) : { rows: [] };
  if (!rows[0]) throw new ErrorHttp(404, "Esa opinión no existe.");
  await exigirStand(req, rows[0].stand_id);
  const respuesta = v.texto(req.body.respuesta, "la respuesta", { max: 500 }) || null;
  const visible = v.booleano(req.body.visible, true);
  await pool.query(
    `UPDATE resenas SET respuesta = $1::text, visible = $2,
       respondida_en = CASE WHEN $1::text IS NULL THEN NULL
                            WHEN $1::text IS DISTINCT FROM respuesta THEN now() ELSE respondida_en END
     WHERE id = $3`, [respuesta, visible, id]);
  await anotar(req.admin, "editar", "opiniones", id, `${respuesta ? "Respondió" : "Sin respuesta"}${visible ? "" : ", oculta"}`);
  res.json({ id });
}));

// ================= Promociones generales (solo dueños) =================
router.get("/promociones", requireDueno, handle(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT pr.id, pr.titulo, pr.descripcion, pr.precio::float AS precio, pr.inicio::text, pr.fin::text,
            pr.destacada, pr.activa, (pr.imagen IS NOT NULL) AS tiene_imagen, pr.actualizado_en,
            COALESCE((SELECT json_agg(json_build_object('producto_id', i.producto_id, 'cantidad', i.cantidad,
                                                        'nombre', p.nombre, 'stand', s.nombre) ORDER BY s.orden, p.nombre)
                      FROM promocion_items i JOIN productos p ON p.id = i.producto_id JOIN stands s ON s.id = p.stand_id
                      WHERE i.promocion_id = pr.id), '[]') AS items
     FROM promociones pr ORDER BY pr.fin DESC, pr.id DESC`);
  res.json(rows.map(({ tiene_imagen, ...p }) => ({
    ...p,
    imagen_url: tiene_imagen ? `/api/promociones/${p.id}/imagen?v=${new Date(p.actualizado_en).getTime()}` : null
  })));
}));

async function datosPromocion(body) {
  const inicio = v.fecha(body.inicio, "la fecha de inicio");
  const fin = v.fecha(body.fin, "la fecha de fin");
  if (fin < inicio) throw new ErrorDeDatos("La fecha de fin debe ser igual o posterior a la de inicio.");
  const lista = Array.isArray(body.items) ? body.items : [];
  if (!lista.length || lista.length > 10) throw new ErrorDeDatos("Agrega de 1 a 10 productos al paquete.");
  const items = new Map();
  for (const item of lista) {
    const productoId = v.idValido(item && item.producto_id);
    if (!productoId) throw new ErrorDeDatos("Elige los productos del paquete.");
    items.set(productoId, v.entero(item.cantidad, "La cantidad", { min: 1, max: 99, defecto: 1 }));
  }
  const { rows } = await pool.query("SELECT id FROM productos WHERE id = ANY($1) AND tipo = 'producto'", [[...items.keys()]]);
  if (rows.length !== items.size) throw new ErrorDeDatos("Algún producto del paquete ya no existe.");
  return {
    titulo: v.texto(body.titulo, "el título de la promoción", { max: 100, requerido: true }),
    descripcion: v.texto(body.descripcion, "la descripción", { max: 600 }),
    precio: v.precio(body.precio, "el precio del paquete"),
    inicio, fin,
    destacada: v.booleano(body.destacada, false),
    activa: v.booleano(body.activa, true),
    items: [...items.entries()],
    imagen: imagenDe(body),
    quitarImagen: v.booleano(body.quitar_imagen, false)
  };
}

async function guardarItems(cliente, promocionId, items) {
  await cliente.query("DELETE FROM promocion_items WHERE promocion_id = $1", [promocionId]);
  for (const [productoId, cantidad] of items) {
    await cliente.query("INSERT INTO promocion_items (promocion_id, producto_id, cantidad) VALUES ($1, $2, $3)",
      [promocionId, productoId, cantidad]);
  }
}

async function enTransaccion(fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const resultado = await fn(cliente);
    await cliente.query("COMMIT");
    return resultado;
  } catch (err) {
    await cliente.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    cliente.release();
  }
}

router.post("/promociones", requireDueno, handle(async (req, res) => {
  const d = await datosPromocion(req.body);
  const creada = await enTransaccion(async cliente => {
    const { rows } = await cliente.query(
      `INSERT INTO promociones (titulo, descripcion, precio, inicio, fin, destacada, activa, imagen, imagen_tipo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, titulo`,
      [d.titulo, d.descripcion, d.precio, d.inicio, d.fin, d.destacada, d.activa,
       d.imagen ? d.imagen.buffer : null, d.imagen ? d.imagen.tipo : null]);
    await guardarItems(cliente, rows[0].id, d.items);
    return rows[0];
  });
  await anotar(req.admin, "crear", "promociones", creada.id, creada.titulo);
  res.status(201).json(creada);
}));

router.put("/promociones/:id", requireDueno, handle(async (req, res) => {
  const id = v.idValido(req.params.id);
  const d = await datosPromocion(req.body);
  const actualizada = await enTransaccion(async cliente => {
    const { rowCount } = await cliente.query(
      `UPDATE promociones SET titulo = $1, descripcion = $2, precio = $3, inicio = $4, fin = $5, destacada = $6, activa = $7,
         imagen = CASE WHEN $8::bytea IS NOT NULL THEN $8 WHEN $10 THEN NULL ELSE imagen END,
         imagen_tipo = CASE WHEN $8::bytea IS NOT NULL THEN $9 WHEN $10 THEN NULL ELSE imagen_tipo END,
         actualizado_en = now()
       WHERE id = $11`,
      [d.titulo, d.descripcion, d.precio, d.inicio, d.fin, d.destacada, d.activa,
       d.imagen ? d.imagen.buffer : null, d.imagen ? d.imagen.tipo : null, d.quitarImagen, id]);
    if (!rowCount) throw new ErrorHttp(404, "Esa promoción no existe.");
    await guardarItems(cliente, id, d.items);
    return { id, titulo: d.titulo };
  });
  await anotar(req.admin, "editar", "promociones", id, d.titulo);
  res.json(actualizada);
}));

router.delete("/promociones/:id", requireDueno, handle(async (req, res) => {
  const id = v.idValido(req.params.id);
  const { rowCount } = id ? await pool.query("DELETE FROM promociones WHERE id = $1", [id]) : { rowCount: 0 };
  if (!rowCount) throw new ErrorHttp(404, "Esa promoción no existe.");
  await anotar(req.admin, "borrar", "promociones", id);
  res.status(204).end();
}));

// ================= Usuarios de Necutools (solo dueños) =================
// confirmar: "Repite la contraseña" (obligatorio en toda contraseña nueva). Tampoco puede llevar el
// usuario ni la parte del correo antes de la @.
const contrasena = (valor, confirmar, usuario, campo = "La contraseña", correo = null) =>
  validarContrasena(valor, {
    minimo: 12, campo, contiene: [usuario, correo ? correo.split("@")[0] : ""],
    confirmar: typeof confirmar === "string" ? confirmar : ""
  });

// Correo opcional del admin (para entrar con él en vez del usuario). Vacío = sin correo.
async function correoOpcional(valor) {
  if (valor === undefined || valor === null || (typeof valor === "string" && !valor.trim())) return null;
  return v.correoReal(valor, "el correo");
}

const CORREO_REPETIDO = "Ese correo ya lo usa otro usuario de Necutools.";

async function tiendasValidas(lista) {
  if (lista === undefined || lista === null) return [];
  if (!Array.isArray(lista)) throw new ErrorDeDatos("Las tiendas asignadas no son válidas.");
  const ids = [...new Set(lista.map(v.idValido))];
  if (ids.includes(null)) throw new ErrorDeDatos("Las tiendas asignadas no son válidas.");
  if (!ids.length) return [];
  const { rows } = await pool.query("SELECT id FROM stands WHERE id = ANY($1)", [ids]);
  if (rows.length !== ids.length) throw new ErrorDeDatos("Alguna tienda asignada ya no existe.");
  return ids;
}

async function asignarTiendas(cliente, adminId, tiendas) {
  await cliente.query("DELETE FROM admin_stands WHERE admin_id = $1", [adminId]);
  for (const standId of tiendas) {
    await cliente.query("INSERT INTO admin_stands (admin_id, stand_id) VALUES ($1, $2)", [adminId, standId]);
  }
}

router.get("/usuarios", requireDueno, handle(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.id, a.usuario, a.correo, a.rol, a.activo, a.totp_activo, a.creado_en,
            COALESCE(array_agg(s.stand_id ORDER BY s.stand_id) FILTER (WHERE s.stand_id IS NOT NULL), '{}') AS tiendas
     FROM admins a LEFT JOIN admin_stands s ON s.admin_id = a.id
     GROUP BY a.id ORDER BY a.rol DESC, a.usuario`);
  res.json(rows);
}));

router.post("/usuarios", requireDueno, handle(async (req, res) => {
  const usuario = v.texto(req.body.usuario, "el usuario", { max: 50, requerido: true }).toLowerCase();
  if (!/^[a-z0-9._-]{3,50}$/.test(usuario)) {
    throw new ErrorDeDatos("El usuario debe tener de 3 a 50 letras sin acentos, números, punto, guion o guion bajo.");
  }
  const correo = await correoOpcional(req.body.correo);
  const password = contrasena(req.body.password, req.body.confirmar, usuario, "La contraseña", correo);
  const rol = v.opcion(req.body.rol, ROLES, "el rol");
  const tiendas = rol === "encargado" ? await tiendasValidas(req.body.tiendas) : [];
  // Sin importar mayúsculas: "Axel" y "axel" serían la misma persona al entrar
  const { rows: existe } = await pool.query("SELECT 1 FROM admins WHERE lower(usuario) = $1", [usuario]);
  if (existe[0]) throw new ErrorHttp(409, "Ya existe un usuario con ese nombre.");
  const hash = await bcrypt.hash(password, BCRYPT_COST);
  const creado = await enTransaccion(async cliente => {
    let rows;
    try {
      ({ rows } = await cliente.query(
        "INSERT INTO admins (usuario, correo, password_hash, rol) VALUES ($1, $2, $3, $4) ON CONFLICT (usuario) DO NOTHING RETURNING id, usuario, rol",
        [usuario, correo, hash, rol]));
    } catch (err) {
      if (err.code === "23505") throw new ErrorHttp(409, err.constraint === "admins_correo_idx" ? CORREO_REPETIDO : "Ya existe un usuario con ese nombre.");
      throw err;
    }
    if (!rows[0]) throw new ErrorHttp(409, "Ya existe un usuario con ese nombre.");
    await asignarTiendas(cliente, rows[0].id, tiendas);
    return rows[0];
  });
  await anotar(req.admin, "crear", "usuarios", creado.id, `${creado.usuario} (${rol})`);
  res.status(201).json(creado);
}));

router.put("/usuarios/:id", requireDueno, handle(async (req, res) => {
  const id = v.idValido(req.params.id);
  const { rows } = id ? await pool.query("SELECT id, usuario, correo, rol, activo FROM admins WHERE id = $1", [id]) : { rows: [] };
  const usuario = rows[0];
  if (!usuario) throw new ErrorHttp(404, "Ese usuario no existe.");

  const rol = v.opcion(req.body.rol, ROLES, "el rol");
  const activo = v.booleano(req.body.activo, true);
  const tiendas = rol === "encargado" ? await tiendasValidas(req.body.tiendas) : [];
  // correo: undefined = no se toca; "" = se quita
  const cambiaCorreo = req.body.correo !== undefined;
  const correo = cambiaCorreo ? await correoOpcional(req.body.correo) : null;
  const password = req.body.password
    ? contrasena(req.body.password, req.body.confirmar, usuario.usuario, "La contraseña nueva", cambiaCorreo ? correo : usuario.correo)
    : null;
  // Un dueño puede quitarle la verificación en dos pasos a otro usuario que perdió su celular
  const quitar2fa = v.booleano(req.body.quitar_2fa, false);
  if (quitar2fa && usuario.id === req.admin.id) {
    throw new ErrorHttp(409, "Para quitar tu propia verificación en dos pasos usa Mi cuenta.");
  }

  if (usuario.id === req.admin.id && (rol !== "dueno" || !activo)) {
    throw new ErrorHttp(409, "No puedes quitarte el rol de dueño ni desactivar tu propia cuenta.");
  }
  if (usuario.rol === "dueno" && (rol !== "dueno" || !activo)) {
    const { rows: duenos } = await pool.query("SELECT count(*)::int AS total FROM admins WHERE rol = 'dueno' AND activo AND id <> $1", [usuario.id]);
    if (!duenos[0].total) throw new ErrorHttp(409, "Debe quedar al menos un dueño activo.");
  }

  const hash = password ? await bcrypt.hash(password, BCRYPT_COST) : null;
  await enTransaccion(async cliente => {
    try {
      await cliente.query(
        `UPDATE admins SET rol = $1, activo = $2, password_hash = COALESCE($3, password_hash),
           totp_activo = totp_activo AND NOT $5, totp_secreto = CASE WHEN $5 THEN NULL ELSE totp_secreto END,
           totp_respaldo = CASE WHEN $5 THEN '{}' ELSE totp_respaldo END,
           correo = CASE WHEN $6 THEN $7 ELSE correo END
         WHERE id = $4`,
        [rol, activo, hash, usuario.id, quitar2fa, cambiaCorreo, correo]);
    } catch (err) {
      if (err.code === "23505") throw new ErrorHttp(409, CORREO_REPETIDO);
      throw err;
    }
    await asignarTiendas(cliente, usuario.id, tiendas);
  });
  if (!activo || password) await cerrarSesionesDe(usuario.id);
  const cambios = [rol, activo ? "activa" : "desactivada", password ? "contraseña nueva" : "", quitar2fa ? "sin 2 pasos" : "",
    cambiaCorreo ? (correo ? "correo nuevo" : "sin correo") : ""];
  await anotar(req.admin, "editar", "usuarios", usuario.id, `${usuario.usuario}: ${cambios.filter(Boolean).join(", ")}`);
  res.json({ id: usuario.id, usuario: usuario.usuario, rol, activo });
}));

// ================= Bitácora (solo dueños) =================
router.get("/bitacora", requireDueno, handle(async (req, res) => {
  const pagina = v.entero(req.query.pagina, "La página", { min: 1, max: 9999, defecto: 1 });
  const adminId = v.idOpcional(req.query.usuario, "El usuario");
  const POR_PAGINA_BITACORA = 50;
  const [lista, total] = await Promise.all([
    pool.query(
      `SELECT id, creado_en, admin_id, usuario, accion, tabla, registro_id, resumen FROM bitacora
       WHERE ($1::int IS NULL OR admin_id = $1) ORDER BY creado_en DESC, id DESC LIMIT $2 OFFSET $3`,
      [adminId, POR_PAGINA_BITACORA, (pagina - 1) * POR_PAGINA_BITACORA]),
    pool.query("SELECT count(*)::int AS total FROM bitacora WHERE ($1::int IS NULL OR admin_id = $1)", [adminId])
  ]);
  res.json({
    registros: lista.rows, pagina, total: total.rows[0].total,
    paginas: Math.max(1, Math.ceil(total.rows[0].total / POR_PAGINA_BITACORA))
  });
}));

// ================= Mi cuenta =================
// Revisa la contraseña actual con límite por cuenta: una sesión robada no sirve para adivinarla
async function exigirPasswordActual(req, valor) {
  await exigirNoFrenada("password", req.admin.id);
  const actual = typeof valor === "string" ? valor : "";
  const { rows } = await pool.query("SELECT password_hash FROM admins WHERE id = $1", [req.admin.id]);
  if (!actual || actual.length > 200 || !(await bcrypt.compare(actual, rows[0].password_hash))) {
    await registrarFallo("password", req.admin.id);
    throw new ErrorDeDatos("Tu contraseña actual no es correcta.");
  }
  await limpiarFallos("password", req.admin.id);
  return actual;
}

router.put("/mi-password", handle(async (req, res) => {
  const nueva = contrasena(req.body.nueva, req.body.confirmar, req.admin.usuario, "La contraseña nueva", req.admin.correo);
  const actual = await exigirPasswordActual(req, req.body.actual);
  if (actual === nueva) throw new ErrorDeDatos("La contraseña nueva debe ser distinta a la actual.");
  const hash = await bcrypt.hash(nueva, BCRYPT_COST);
  await pool.query("UPDATE admins SET password_hash = $1 WHERE id = $2", [hash, req.admin.id]);
  await cerrarSesionesDe(req.admin.id, req.sessionID);
  await anotar(req.admin, "contraseña", "usuarios", req.admin.id, "Cambió su contraseña");
  res.json({ ok: true });
}));

// Correo para entrar con él (opcional). Pide la contraseña actual: con una sesión robada no se cambia.
router.put("/mi-correo", handle(async (req, res) => {
  const correo = await correoOpcional(req.body.correo);
  await exigirPasswordActual(req, req.body.password);
  try {
    await pool.query("UPDATE admins SET correo = $1 WHERE id = $2", [correo, req.admin.id]);
  } catch (err) {
    if (err.code === "23505") throw new ErrorHttp(409, CORREO_REPETIDO);
    throw err;
  }
  await anotar(req.admin, "editar", "usuarios", req.admin.id, correo ? "Cambió su correo" : "Quitó su correo");
  res.json({ correo });
}));

// ================= Verificación en dos pasos =================
// 1) Con la contraseña, se genera una clave que solo vive en la sesión hasta confirmarla con un código
router.post("/2fa/iniciar", handle(async (req, res) => {
  if (req.admin.totp_activo) throw new ErrorHttp(409, "Ya tienes activa la verificación en dos pasos.");
  await exigirPasswordActual(req, req.body.password);
  const secreto = totp.generarSecreto();
  req.session.totpNuevo = { secreto, hasta: Date.now() + 10 * 60 * 1000 };
  res.json({ secreto, enlace: totp.enlace(req.admin.usuario, secreto) });
}));

// 2) El código de la app confirma que quedó bien guardada; se entregan los códigos de respaldo una sola vez
router.post("/2fa/activar", handle(async (req, res) => {
  const nuevo = req.session.totpNuevo;
  if (!nuevo || nuevo.hasta < Date.now()) {
    delete req.session.totpNuevo;
    throw new ErrorDeDatos("Pasaron más de 10 minutos. Vuelve a empezar la activación.");
  }
  await exigirNoFrenada("totp", req.admin.id);
  const codigo = typeof req.body.codigo === "string" ? req.body.codigo.replace(/\s/g, "") : "";
  const paso = totp.verificarCodigo(nuevo.secreto, codigo);
  if (paso === null) {
    await registrarFallo("totp", req.admin.id);
    throw new ErrorDeDatos("El código no coincide. Revisa que la hora de tu celular sea automática y escribe el código que aparece ahora.");
  }
  await limpiarFallos("totp", req.admin.id);
  const respaldo = totp.generarRespaldo();
  await pool.query(
    "UPDATE admins SET totp_secreto = $1, totp_activo = true, totp_ultimo = $2, totp_respaldo = $3 WHERE id = $4",
    [nuevo.secreto, paso, respaldo.map(totp.hashRespaldo), req.admin.id]);
  delete req.session.totpNuevo;
  await cerrarSesionesDe(req.admin.id, req.sessionID);
  await anotar(req.admin, "2 pasos", "usuarios", req.admin.id, "Activó la verificación en dos pasos");
  res.json({ respaldo });
}));

router.post("/2fa/desactivar", handle(async (req, res) => {
  if (!req.admin.totp_activo) throw new ErrorHttp(409, "No tienes activa la verificación en dos pasos.");
  await exigirPasswordActual(req, req.body.password);
  await exigirNoFrenada("totp", req.admin.id);
  const { rows } = await pool.query("SELECT id, totp_secreto, totp_ultimo FROM admins WHERE id = $1", [req.admin.id]);
  if (!(await usarCodigo(rows[0], req.body.codigo))) {
    await registrarFallo("totp", req.admin.id);
    throw new ErrorDeDatos("El código no es correcto. Escribe el que muestra la app o uno de respaldo.");
  }
  await limpiarFallos("totp", req.admin.id);
  await pool.query(
    "UPDATE admins SET totp_activo = false, totp_secreto = NULL, totp_ultimo = NULL, totp_respaldo = '{}' WHERE id = $1",
    [req.admin.id]);
  await anotar(req.admin, "2 pasos", "usuarios", req.admin.id, "Desactivó la verificación en dos pasos");
  res.json({ ok: true });
}));

module.exports = { router, ICONOS_TIENDA };
