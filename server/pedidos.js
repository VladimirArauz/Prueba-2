/**
 * Pedidos enviados por WhatsApp.
 * Público: guardar el pedido de un grupo del carrito al tocar "Enviar pedido por WhatsApp"
 * (precios del servidor, sin datos del cliente).
 * Necutools (/api/admin): lista de pedidos, cambio de estado y resumen del dashboard.
 */
const crypto = require("crypto");
const express = require("express");
const rateLimit = require("express-rate-limit");
const { pool } = require("./db");
const { calcularCarrito, leerCarrito } = require("./api");
const { requireAdmin, requireDueno, puedeEditarStand } = require("./auth");
const { hoy, redondear } = require("./ofertas");
const v = require("./validar");
const { anotar } = require("./bitacora");
const { ErrorDeDatos, ErrorHttp, handle } = v;

const router = express.Router();
// Va antes que server/admin.js en /api/admin: requireAdmin por ruta para no cargar la sesión dos veces
const adminRouter = express.Router();

const ESTADOS = ["pendiente", "vendido", "cancelado"];
const PERIODOS = [7, 30, 90];
const POR_PAGINA = 20;
const ZONA = "America/Mexico_City";
// Un pedido de estudiante no pasa de esto; más grande huele a pedido inventado
const MAX_PIEZAS = 30;
const MAX_PRODUCTOS = 15;
// Más pedidos que esto en una hora (todas las IP juntas) ya no se guardan; WhatsApp se abre igual
const MAX_POR_HORA = 500;
const REPETIDO = "10 minutes";

// Holgado porque muchos estudiantes entran desde la misma IP de la escuela
const pedidoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 40,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Enviaste muchos pedidos seguidos. Espera un rato y vuelve a intentar." }
});

// ================= Guardar un pedido (público) =================
router.post("/pedidos", pedidoLimiter, handle(async (req, res) => {
  const clave = typeof req.body.clave === "string" ? req.body.clave : "";
  const match = /^(tienda|paquete)-([1-9][0-9]{0,9})$/.exec(clave);
  if (!match) throw new ErrorDeDatos("El pedido no es válido.");

  const { grupos } = await calcularCarrito(leerCarrito(req.body));
  const grupo = grupos.find(g => g.clave === clave);
  if (!grupo) throw new ErrorDeDatos("Ese pedido ya no está disponible. Recarga el carrito.");

  const items = grupo.items.map(i => ({ tipo: i.tipo, id: i.id, nombre: i.nombre, cantidad: i.cantidad, subtotal: i.subtotal }));
  const piezas = items.reduce((suma, i) => suma + i.cantidad, 0);
  if (piezas > MAX_PIEZAS || items.length > MAX_PRODUCTOS) {
    throw new ErrorDeDatos(`Un pedido puede tener hasta ${MAX_PIEZAS} piezas y ${MAX_PRODUCTOS} productos. Para más, escríbele a la tienda.`);
  }

  // El mismo pedido desde la misma conexión en 10 minutos es el mismo (se tocó dos veces el botón).
  // Se guarda una huella con HMAC, no la IP.
  const huella = crypto.createHmac("sha256", process.env.SESSION_SECRET)
    .update(JSON.stringify([req.ip, clave, items.map(i => [i.tipo, i.id, i.cantidad])])).digest("hex");
  const { rows: previo } = await pool.query(
    "SELECT id FROM pedidos WHERE huella = $1 AND creado_en > now() - $2::interval ORDER BY id DESC LIMIT 1", [huella, REPETIDO]);
  if (previo[0]) return res.status(200).json({ id: previo[0].id, repetido: true });

  const { rows: [{ ultimaHora }] } = await pool.query(
    "SELECT count(*)::int AS \"ultimaHora\" FROM pedidos WHERE creado_en > now() - interval '1 hour'");
  if (ultimaHora >= MAX_POR_HORA) throw new ErrorHttp(429, "Hay demasiados pedidos en este momento. Tu pedido se manda igual por WhatsApp.");

  const id = Number(match[2]);
  const { rows } = await pool.query(
    `INSERT INTO pedidos (stand_id, promocion_id, items, total, piezas, huella)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [match[1] === "tienda" ? id : null, match[1] === "paquete" ? id : null, JSON.stringify(items), grupo.total, piezas, huella]);
  res.status(201).json({ id: rows[0].id });
}));

// ================= Necutools: filtros y permisos =================
// Dueños: todos los pedidos (también paquetes). Encargados: solo los de sus tiendas.
function tiendasDe(req) {
  return req.admin.rol === "dueno" ? null : req.admin.tiendas;
}

function tiendaFiltro(req, valor) {
  if (valor === undefined || valor === "" || valor === "todas") return null;
  const id = v.idValido(valor);
  if (!id) throw new ErrorDeDatos("Elige una tienda.");
  if (!puedeEditarStand(req, id)) throw new ErrorHttp(403, "No tienes permiso para ver esta tienda.");
  return id;
}

// Condición sobre la columna stand_id de la tabla con alias `alias` ($1 = tienda, $2 = tiendas del admin)
const EN_ALCANCE = alias => `($1::int IS NULL OR ${alias}.stand_id = $1) AND ($2::int[] IS NULL OR ${alias}.stand_id = ANY($2))`;

function pedidoAdmin(fila) {
  return {
    id: fila.id, stand_id: fila.stand_id, tienda: fila.tienda, promocion_id: fila.promocion_id, paquete: fila.paquete,
    items: fila.items, total: fila.total, piezas: fila.piezas, estado: fila.estado, nota: fila.nota, creado_en: fila.creado_en
  };
}

const COLUMNAS_PEDIDO = `
  pe.id, pe.stand_id, s.nombre AS tienda, pe.promocion_id, pr.titulo AS paquete, pe.items, pe.total::float AS total,
  pe.piezas, pe.estado, pe.nota, pe.creado_en`;
const UNIR_PEDIDO = `
  FROM pedidos pe
  LEFT JOIN stands s ON s.id = pe.stand_id
  LEFT JOIN promociones pr ON pr.id = pe.promocion_id`;

// ================= Necutools: lista de pedidos =================
adminRouter.get("/pedidos", requireAdmin, handle(async (req, res) => {
  const tienda = tiendaFiltro(req, req.query.tienda);
  const estado = req.query.estado ? v.opcion(req.query.estado, ESTADOS, "un estado") : null;
  const pagina = v.entero(req.query.pagina, "La página", { min: 1, max: 9999, defecto: 1 });
  const params = [tienda, tiendasDe(req), estado];
  const filtro = `WHERE ${EN_ALCANCE("pe")} AND ($3::text IS NULL OR pe.estado = $3)`;
  const [{ rows }, { rows: conteo }] = await Promise.all([
    pool.query(`SELECT ${COLUMNAS_PEDIDO} ${UNIR_PEDIDO} ${filtro}
                ORDER BY pe.creado_en DESC, pe.id DESC LIMIT ${POR_PAGINA} OFFSET $4`, [...params, (pagina - 1) * POR_PAGINA]),
    pool.query(`SELECT count(*) FILTER (WHERE pe.estado = 'pendiente')::int AS pendientes
                FROM pedidos pe WHERE ${EN_ALCANCE("pe")}`, [tienda, tiendasDe(req)])
  ]);
  const { rows: [{ total }] } = await pool.query(`SELECT count(*)::int AS total FROM pedidos pe ${filtro}`, params);
  res.json({
    pedidos: rows.map(pedidoAdmin), pagina, paginas: Math.max(1, Math.ceil(total / POR_PAGINA)), total,
    pendientes: conteo[0].pendientes
  });
}));

// ================= Necutools: cambiar estado o nota =================
adminRouter.put("/pedidos/:id", requireAdmin, handle(async (req, res) => {
  const id = v.idValido(req.params.id);
  const { rows } = id ? await pool.query("SELECT id, stand_id, estado, nota FROM pedidos WHERE id = $1", [id]) : { rows: [] };
  const pedido = rows[0];
  if (!pedido) throw new ErrorHttp(404, "Ese pedido no existe.");
  // Paquetes (sin tienda): solo dueños
  const permitido = pedido.stand_id === null ? req.admin.rol === "dueno" : puedeEditarStand(req, pedido.stand_id);
  if (!permitido) throw new ErrorHttp(403, "No tienes permiso para cambiar este pedido.");
  const estado = req.body.estado === undefined ? pedido.estado : v.opcion(req.body.estado, ESTADOS, "un estado");
  const nota = req.body.nota === undefined ? pedido.nota : (v.texto(req.body.nota, "la nota", { max: 200 }) || null);
  await pool.query("UPDATE pedidos SET estado = $1, nota = $2, actualizado_en = now() WHERE id = $3", [estado, nota, id]);
  await anotar(req.admin, "editar", "pedidos", id, `${estado}${nota ? `, nota: ${nota}` : ""}`);
  res.json({ id, estado, nota });
}));

// ================= Necutools: cancelar pendientes viejos (solo dueños) =================
// Los pedidos que nadie cerró en WhatsApp (o inventados) se quedan pendientes para siempre
adminRouter.post("/pedidos/cancelar-viejos", requireAdmin, requireDueno, handle(async (req, res) => {
  const { rowCount } = await pool.query(
    `UPDATE pedidos SET estado = 'cancelado', nota = COALESCE(nota, 'Cancelado por tener más de 7 días pendiente'),
       actualizado_en = now()
     WHERE estado = 'pendiente' AND creado_en < now() - interval '7 days'`);
  await anotar(req.admin, "editar", "pedidos", null, `Canceló ${rowCount} pedidos pendientes de más de 7 días`);
  res.json({ cancelados: rowCount });
}));

// ================= Necutools: resumen del dashboard =================
function cambio(actual, anterior) {
  if (!anterior) return actual ? null : 0; // null = no hay con qué comparar
  return Math.round(((actual - anterior) / anterior) * 100);
}

adminRouter.get("/resumen", requireAdmin, handle(async (req, res) => {
  const dias = v.entero(req.query.dias, "El periodo", { min: 1, max: 90, defecto: 30 });
  if (!PERIODOS.includes(dias)) throw new ErrorDeDatos("Elige un periodo de 7, 30 o 90 días.");
  const tienda = tiendaFiltro(req, req.query.tienda);
  const { fecha } = hoy();
  // $1 tienda, $2 tiendas del admin, $3 hoy, $4 días del periodo
  const base = [tienda, tiendasDe(req), fecha, dias];
  const dia = `(pe.creado_en AT TIME ZONE '${ZONA}')::date`;
  const periodo = `${dia} BETWEEN $3::date - ($4::int - 1) AND $3::date`;

  const [indicadores, serie, porTienda, porEstado, top, recientes, opiniones, porHacer] = await Promise.all([
    pool.query(
      `SELECT CASE WHEN ${periodo} THEN 'actual' ELSE 'anterior' END AS cual,
              count(*)::int AS pedidos,
              count(*) FILTER (WHERE pe.estado = 'vendido')::int AS vendidos,
              COALESCE(sum(pe.total) FILTER (WHERE pe.estado = 'vendido'), 0)::float AS ventas
       FROM pedidos pe
       WHERE ${EN_ALCANCE("pe")} AND ${dia} BETWEEN $3::date - (2 * $4::int - 1) AND $3::date
       GROUP BY 1`, base),
    pool.query(
      `SELECT d::date::text AS fecha, count(pe.id)::int AS pedidos,
              COALESCE(sum(pe.total) FILTER (WHERE pe.estado = 'vendido'), 0)::float AS ventas
       FROM generate_series($3::date - ($4::int - 1), $3::date, interval '1 day') AS d
       LEFT JOIN pedidos pe ON ${dia} = d::date AND ${EN_ALCANCE("pe")}
       GROUP BY d ORDER BY d`, base),
    pool.query(
      `SELECT pe.stand_id, COALESCE(s.nombre, 'Paquetes') AS nombre, count(*)::int AS pedidos,
              COALESCE(sum(pe.total) FILTER (WHERE pe.estado = 'vendido'), 0)::float AS ventas
       FROM pedidos pe LEFT JOIN stands s ON s.id = pe.stand_id
       WHERE ${EN_ALCANCE("pe")} AND ${periodo}
       GROUP BY pe.stand_id, s.nombre ORDER BY pedidos DESC, nombre LIMIT 10`, base),
    pool.query(
      `SELECT pe.estado, count(*)::int AS pedidos FROM pedidos pe
       WHERE ${EN_ALCANCE("pe")} AND ${periodo} GROUP BY pe.estado`, base),
    pool.query(
      `SELECT i->>'tipo' AS tipo, (i->>'id')::int AS id, max(i->>'nombre') AS nombre,
              sum((i->>'cantidad')::int)::int AS piezas, sum((i->>'subtotal')::numeric)::float AS total
       FROM pedidos pe CROSS JOIN LATERAL jsonb_array_elements(pe.items) AS i
       WHERE ${EN_ALCANCE("pe")} AND ${periodo} AND pe.estado <> 'cancelado'
       GROUP BY 1, 2 ORDER BY piezas DESC, total DESC LIMIT 5`, base),
    pool.query(
      `SELECT ${COLUMNAS_PEDIDO} ${UNIR_PEDIDO} WHERE ${EN_ALCANCE("pe")}
       ORDER BY pe.creado_en DESC, pe.id DESC LIMIT 5`, [tienda, tiendasDe(req)]),
    pool.query(
      `SELECT round(avg(r.calificacion), 1)::float AS promedio, count(*)::int AS total,
              count(*) FILTER (WHERE r.respuesta IS NULL)::int AS sin_responder,
              count(*) FILTER (WHERE (r.creado_en AT TIME ZONE '${ZONA}')::date BETWEEN $3::date - ($4::int - 1) AND $3::date)::int AS nuevas
       FROM resenas r JOIN productos p ON p.id = r.producto_id
       WHERE r.visible AND ${EN_ALCANCE("p")}`, base),
    pool.query(
      `SELECT
         (SELECT count(*)::int FROM pedidos pe WHERE ${EN_ALCANCE("pe")} AND pe.estado = 'pendiente') AS pedidos_pendientes,
         (SELECT count(*)::int FROM productos p WHERE ${EN_ALCANCE("p")}
            AND p.imagen IS NULL AND (p.imagen_ruta IS NULL OR p.imagen_ruta LIKE '/imagenes/ejemplos/%')) AS sin_foto,
         (SELECT count(*)::int FROM productos p WHERE ${EN_ALCANCE("p")}
            AND (p.descripcion LIKE 'Producto de ejemplo.%' OR p.descripcion = 'Producto destacado de la tienda.')) AS texto_ejemplo,
         (SELECT count(*)::int FROM ofertas o WHERE ${EN_ALCANCE("o")}
            AND o.activa AND o.fin BETWEEN $3::date AND $3::date + 7) AS ofertas_por_vencer`, [tienda, tiendasDe(req), fecha])
  ]);

  const fila = cual => indicadores.rows.find(r => r.cual === cual) || { pedidos: 0, vendidos: 0, ventas: 0 };
  const actual = fila("actual");
  const anterior = fila("anterior");
  const ticket = f => (f.vendidos ? redondear(f.ventas / f.vendidos) : 0);
  const op = opiniones.rows[0];
  const tareas = porHacer.rows[0];

  res.json({
    dias, desde: serie.rows[0].fecha, hasta: fecha,
    indicadores: {
      pedidos: { valor: actual.pedidos, anterior: anterior.pedidos, cambio: cambio(actual.pedidos, anterior.pedidos) },
      ventas: { valor: redondear(actual.ventas), anterior: redondear(anterior.ventas), cambio: cambio(actual.ventas, anterior.ventas) },
      ticket: { valor: ticket(actual), anterior: ticket(anterior), cambio: cambio(ticket(actual), ticket(anterior)) },
      calificacion: { valor: op.promedio, opiniones: op.total, nuevas: op.nuevas }
    },
    serie: serie.rows,
    por_tienda: porTienda.rows,
    por_estado: ESTADOS.map(estado => ({ estado, pedidos: (porEstado.rows.find(r => r.estado === estado) || { pedidos: 0 }).pedidos })),
    productos: top.rows,
    recientes: recientes.rows.map(pedidoAdmin),
    por_hacer: { ...tareas, opiniones_sin_responder: op.sin_responder }
  });
}));

module.exports = { router, adminRouter };
