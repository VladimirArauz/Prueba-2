/**
 * Opiniones de productos y servicios: calificación de 1 a 5 y comentario.
 * Cualquiera las lee; solo un cliente con sesión escribe, edita o borra la suya (una por producto).
 * Las respuestas del vendedor y ocultar opiniones están en server/admin.js.
 */
const express = require("express");
const rateLimit = require("express-rate-limit");
const { pool } = require("./db");
const { requireCliente, cargarCliente } = require("./clientes");
const v = require("./validar");
const { ErrorDeDatos, ErrorHttp, handle } = v;

const POR_PAGINA = 10;
const ORDENES = {
  recientes: "r.creado_en DESC, r.id DESC",
  mejores: "r.calificacion DESC, r.creado_en DESC, r.id DESC"
};

const escrituraLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Enviaste muchas opiniones seguidas. Espera un rato y vuelve a intentar." }
});

// El producto debe existir y verse en el sitio
async function exigirProducto(id) {
  const productoId = v.idValido(id);
  const { rows } = productoId ? await pool.query(
    `SELECT p.id FROM productos p JOIN stands s ON s.id = p.stand_id
     WHERE p.id = $1 AND p.visible AND s.visible`, [productoId]) : { rows: [] };
  if (!rows[0]) throw new ErrorHttp(404, "Este producto no existe o ya no está disponible.");
  return rows[0].id;
}

function comentarioValido(valor) {
  const comentario = v.texto(valor, "tu comentario", { max: 500, requerido: true });
  if (comentario.length < 3) throw new ErrorDeDatos("Escribe un comentario de al menos 3 letras.");
  // Sin enlaces: es la forma más común de spam
  if (/(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|mx|ly|io)\b)/i.test(comentario)) {
    throw new ErrorDeDatos("Quita los enlaces de tu comentario.");
  }
  return comentario;
}

function resenaPublica(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    calificacion: fila.calificacion,
    comentario: fila.comentario,
    respuesta: fila.respuesta,
    creado_en: fila.creado_en,
    editada: new Date(fila.actualizado_en) - new Date(fila.creado_en) > 60 * 1000
  };
}

const router = express.Router();

router.get("/productos/:id/resenas", handle(async (req, res) => {
  const productoId = await exigirProducto(req.params.id);
  const orden = ORDENES[req.query.orden] ? req.query.orden : "recientes";
  const pagina = v.entero(req.query.pagina, "La página", { min: 1, max: 1000, defecto: 1 });

  const [resumen, lista, cliente] = await Promise.all([
    pool.query(
      `SELECT calificacion, count(*)::int AS total FROM resenas
       WHERE producto_id = $1 AND visible GROUP BY calificacion`, [productoId]),
    pool.query(
      `SELECT r.id, c.nombre, r.calificacion, r.comentario, r.respuesta, r.creado_en, r.actualizado_en
       FROM resenas r JOIN clientes c ON c.id = r.cliente_id
       WHERE r.producto_id = $1 AND r.visible
       ORDER BY ${ORDENES[orden]} LIMIT $2 OFFSET $3`, [productoId, POR_PAGINA, (pagina - 1) * POR_PAGINA]),
    cargarCliente(req)
  ]);

  const distribucion = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  resumen.rows.forEach(f => { distribucion[f.calificacion] = f.total; });
  const total = resumen.rows.reduce((s, f) => s + f.total, 0);
  const suma = resumen.rows.reduce((s, f) => s + f.calificacion * f.total, 0);

  let mia = null;
  if (cliente) {
    const { rows } = await pool.query(
      `SELECT r.id, $2::text AS nombre, r.calificacion, r.comentario, r.respuesta, r.creado_en, r.actualizado_en, r.visible
       FROM resenas r WHERE r.producto_id = $1 AND r.cliente_id = $3`, [productoId, cliente.nombre, cliente.id]);
    if (rows[0]) mia = { ...resenaPublica(rows[0]), visible: rows[0].visible };
  }

  res.json({
    resumen: { promedio: total ? Math.round((suma / total) * 10) / 10 : null, total, distribucion },
    orden,
    pagina,
    paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
    resenas: lista.rows.map(resenaPublica),
    cliente: cliente ? { nombre: cliente.nombre } : null,
    mia
  });
}));

// Crea o reemplaza la opinión del cliente sobre este producto
router.put("/productos/:id/resena", escrituraLimiter, requireCliente, handle(async (req, res) => {
  const productoId = await exigirProducto(req.params.id);
  const calificacion = v.entero(req.body.calificacion, "La calificación", { min: 1, max: 5, defecto: null });
  if (!calificacion) throw new ErrorDeDatos("Elige de 1 a 5 estrellas.");
  const comentario = comentarioValido(req.body.comentario);
  const { rows } = await pool.query(
    `INSERT INTO resenas (producto_id, cliente_id, calificacion, comentario)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (producto_id, cliente_id) DO UPDATE
       SET calificacion = EXCLUDED.calificacion, comentario = EXCLUDED.comentario, actualizado_en = now()
     RETURNING id, (xmax = 0) AS nueva`,
    [productoId, req.cliente.id, calificacion, comentario]);
  res.status(rows[0].nueva ? 201 : 200).json({ id: rows[0].id, nueva: rows[0].nueva });
}));

router.delete("/productos/:id/resena", requireCliente, handle(async (req, res) => {
  const productoId = await exigirProducto(req.params.id);
  await pool.query("DELETE FROM resenas WHERE producto_id = $1 AND cliente_id = $2", [productoId, req.cliente.id]);
  res.status(204).end();
}));

module.exports = { router };
