/**
 * API pública y de administración: configuración, stands y productos.
 */
const express = require("express");
const { pool } = require("./db");
const { requireAdmin } = require("./auth");

const router = express.Router();

const DISPONIBILIDAD = ["Disponible", "Pocas piezas", "Por pedido"];
const MAX_IMAGEN_BYTES = 1024 * 1024; // 1 MB

// ================= Validación =================
class ErrorDeDatos extends Error {}

function texto(valor, campo, { max, requerido = false, defecto = "" }) {
  if (valor === undefined || valor === null) valor = "";
  if (typeof valor !== "string") throw new ErrorDeDatos(`${campo} no es válido.`);
  const limpio = valor.trim();
  if (requerido && !limpio) throw new ErrorDeDatos(`Escribe ${campo}.`);
  if (limpio.length > max) throw new ErrorDeDatos(`${campo} admite hasta ${max} caracteres.`);
  return limpio || defecto;
}

function idValido(valor) {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 && id < 2147483647 ? id : null;
}

// Acepta un data URL de imagen PNG, JPG, WEBP o GIF y revisa sus bytes reales
function leerImagen(dataUrl) {
  if (typeof dataUrl !== "string") throw new ErrorDeDatos("La imagen no es válida.");
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new ErrorDeDatos("Usa una imagen PNG, JPG, WEBP o GIF.");
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_IMAGEN_BYTES) throw new ErrorDeDatos("La imagen debe pesar hasta 1 MB.");
  const hex = buffer.subarray(0, 12).toString("hex");
  const firmas = {
    "image/png": hex.startsWith("89504e47"),
    "image/jpeg": hex.startsWith("ffd8ff"),
    "image/gif": hex.startsWith("47494638"),
    "image/webp": hex.startsWith("52494646") && hex.slice(16, 24) === "57454250"
  };
  if (!firmas[match[1]]) throw new ErrorDeDatos("El archivo no es una imagen válida.");
  return { buffer, tipo: match[1] };
}

async function datosProducto(body) {
  const nombre = texto(body.nombre, "el nombre del producto", { max: 120, requerido: true });
  const categoria = texto(body.categoria, "la subcategoría", { max: 60, defecto: "General" });
  const descripcion = texto(body.descripcion, "la descripción", { max: 1000 });
  const precio = Number(body.precio);
  if (!Number.isFinite(precio) || precio <= 0 || precio > 99999999) {
    throw new ErrorDeDatos("Escribe un precio mayor a 0.");
  }
  const disponibilidad = DISPONIBILIDAD.includes(body.disponibilidad) ? body.disponibilidad : "Disponible";
  const standNombre = texto(body.stand, "el stand", { max: 50, requerido: true });
  const { rows } = await pool.query("SELECT id FROM stands WHERE nombre = $1", [standNombre]);
  if (!rows[0]) throw new ErrorDeDatos("Ese stand no existe.");
  // La imagen es opcional; en una edición sin imagen nueva se conserva la anterior
  const imagen = body.imagen ? leerImagen(body.imagen) : null;
  return { nombre, categoria, descripcion, precio: precio.toFixed(2), disponibilidad, standId: rows[0].id, imagen };
}

function productoPublico(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    stand: fila.stand,
    categoria: fila.categoria,
    precio: Number(fila.precio),
    disponibilidad: fila.disponibilidad,
    descripcion: fila.descripcion,
    imagen_url: fila.tiene_imagen ? `/api/productos/${fila.id}/imagen?v=${new Date(fila.actualizado_en).getTime()}` : null,
    creado_en: fila.creado_en
  };
}

const SELECT_PRODUCTOS = `
  SELECT p.id, p.nombre, s.nombre AS stand, p.categoria, p.precio, p.disponibilidad, p.descripcion,
         (p.imagen IS NOT NULL) AS tiene_imagen, p.creado_en, p.actualizado_en
  FROM productos p JOIN stands s ON s.id = p.stand_id`;

// Envuelve rutas async para que los errores lleguen al manejador central
const handle = fn => (req, res, next) => fn(req, res, next).catch(err => {
  if (err instanceof ErrorDeDatos) return res.status(400).json({ error: err.message });
  next(err);
});

// ================= Configuración pública =================
router.get("/config", (req, res) => {
  const whatsapp = (process.env.WHATSAPP_NUMBERS || "")
    .split(",")
    .map(n => n.replace(/\D/g, ""))
    .filter(n => n.length >= 10 && n.length <= 15);
  res.json({ whatsapp });
});

// ================= Stands =================
router.get("/stands", handle(async (req, res) => {
  const { rows } = await pool.query("SELECT id, nombre FROM stands ORDER BY id");
  res.json(rows);
}));

router.post("/stands", requireAdmin, handle(async (req, res) => {
  const nombre = texto(req.body.nombre, "el nombre del stand", { max: 50, requerido: true });
  const { rows } = await pool.query(
    "INSERT INTO stands (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING RETURNING id, nombre", [nombre]);
  if (!rows[0]) return res.status(409).json({ error: "Ya existe un stand con ese nombre." });
  res.status(201).json(rows[0]);
}));

// ================= Productos =================
router.get("/productos", handle(async (req, res) => {
  const { rows } = await pool.query(`${SELECT_PRODUCTOS} ORDER BY p.creado_en DESC`);
  res.json(rows.map(productoPublico));
}));

router.get("/productos/:id/imagen", handle(async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).end();
  const { rows } = await pool.query("SELECT imagen, imagen_tipo FROM productos WHERE id = $1", [id]);
  if (!rows[0] || !rows[0].imagen) return res.status(404).end();
  res.set("Content-Type", rows[0].imagen_tipo);
  res.set("Cache-Control", "public, max-age=86400");
  res.send(rows[0].imagen);
}));

router.post("/productos", requireAdmin, handle(async (req, res) => {
  const d = await datosProducto(req.body);
  const { rows } = await pool.query(
    `INSERT INTO productos (stand_id, nombre, categoria, precio, disponibilidad, descripcion, imagen, imagen_tipo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [d.standId, d.nombre, d.categoria, d.precio, d.disponibilidad, d.descripcion,
     d.imagen ? d.imagen.buffer : null, d.imagen ? d.imagen.tipo : null]);
  const creado = await pool.query(`${SELECT_PRODUCTOS} WHERE p.id = $1`, [rows[0].id]);
  res.status(201).json(productoPublico(creado.rows[0]));
}));

router.put("/productos/:id", requireAdmin, handle(async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).json({ error: "Ese producto no existe." });
  const d = await datosProducto(req.body);
  // Si no llega imagen nueva se conserva la anterior
  const { rowCount } = await pool.query(
    `UPDATE productos SET stand_id = $1, nombre = $2, categoria = $3, precio = $4, disponibilidad = $5,
       descripcion = $6, imagen = COALESCE($7, imagen), imagen_tipo = COALESCE($8, imagen_tipo), actualizado_en = now()
     WHERE id = $9`,
    [d.standId, d.nombre, d.categoria, d.precio, d.disponibilidad, d.descripcion,
     d.imagen ? d.imagen.buffer : null, d.imagen ? d.imagen.tipo : null, id]);
  if (!rowCount) return res.status(404).json({ error: "Ese producto no existe." });
  const actualizado = await pool.query(`${SELECT_PRODUCTOS} WHERE p.id = $1`, [id]);
  res.json(productoPublico(actualizado.rows[0]));
}));

router.delete("/productos/:id", requireAdmin, handle(async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).json({ error: "Ese producto no existe." });
  const { rowCount } = await pool.query("DELETE FROM productos WHERE id = $1", [id]);
  if (!rowCount) return res.status(404).json({ error: "Ese producto no existe." });
  res.status(204).end();
}));

module.exports = { router };
