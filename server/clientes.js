/**
 * Cuentas de cliente (/api/clientes): registro, inicio y cierre de sesión.
 * Solo sirven para opinar sobre productos; el pedido sigue sin cuenta, por WhatsApp.
 * La sesión es la misma cookie que la de Necutools, con clienteId en vez de adminId.
 */
const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { pool } = require("./db");
const { BCRYPT_COST, DUMMY_HASH, renovarSesion, destruirSesion } = require("./auth");
const { validarContrasena } = require("./contrasenas");
const { exigirNoFrenada, registrarFallo, limpiarFallos } = require("./intentos");
const v = require("./validar");
const { ErrorDeDatos, ErrorHttp, handle } = v;

const MIN_PASSWORD = 10;

// Carga al cliente en cada petición: si desactivan su cuenta, se nota de inmediato
async function cargarCliente(req) {
  if (!req.session || !req.session.clienteId) return null;
  const { rows } = await pool.query("SELECT id, nombre, correo, activo FROM clientes WHERE id = $1", [req.session.clienteId]);
  const cliente = rows[0];
  return cliente && cliente.activo ? cliente : null;
}

async function requireCliente(req, res, next) {
  try {
    const cliente = await cargarCliente(req);
    if (cliente) {
      req.cliente = cliente;
      return next();
    }
    res.status(401).json({ error: "Inicia sesión con tu cuenta para opinar." });
  } catch (err) {
    next(err);
  }
}

function correoValido(valor) {
  const correo = v.texto(valor, "tu correo", { max: 120, requerido: true }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) throw new ErrorDeDatos("Escribe un correo válido, ej. nombre@correo.com.");
  return correo;
}

const passwordValida = (valor, nombre, correo) =>
  validarContrasena(valor, { minimo: MIN_PASSWORD, contiene: [nombre, correo.split("@")[0]] });

// Nueva sesión al entrar (evita fijación de sesión). Si ya había un admin en este navegador, se conserva.
function iniciarSesion(req, res, next, cliente) {
  renovarSesion(req, ["adminId", "usuario"], err => {
    if (err) return next(err);
    req.session.clienteId = cliente.id;
    req.session.creada = Date.now();
    req.session.save(saveErr => {
      if (saveErr) return next(saveErr);
      res.json({ autenticado: true, nombre: cliente.nombre, correo: cliente.correo });
    });
  });
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Demasiados intentos. Espera 15 minutos y vuelve a intentar." }
});

// Holgado porque en la escuela muchos estudiantes salen a internet con la misma IP.
// No cuentan los errores de captura (400), pero sí los correos que ya tienen cuenta (409): si no,
// se podrían probar correos sin límite.
const registroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipFailedRequests: true,
  requestWasSuccessful: (req, res) => res.statusCode < 400 || res.statusCode === 409,
  message: { error: "Se crearon muchas cuentas desde esta conexión. Espera una hora y vuelve a intentar." }
});

const router = express.Router();

router.get("/sesion", handle(async (req, res) => {
  const cliente = await cargarCliente(req);
  if (!cliente) return res.json({ autenticado: false });
  res.json({ autenticado: true, nombre: cliente.nombre, correo: cliente.correo });
}));

router.post("/registro", registroLimiter, handle(async (req, res, next) => {
  const nombre = v.texto(req.body.nombre, "tu nombre", { max: 60, requerido: true });
  if (nombre.length < 2) throw new ErrorDeDatos("Escribe tu nombre con al menos 2 letras.");
  const correo = correoValido(req.body.correo);
  const password = passwordValida(req.body.password, nombre, correo);
  // Antes del bcrypt: un correo repetido no debe gastar CPU
  const { rows: existe } = await pool.query("SELECT 1 FROM clientes WHERE lower(correo) = $1", [correo]);
  if (existe[0]) throw new ErrorHttp(409, "Ya hay una cuenta con ese correo. Inicia sesión.");
  const hash = await bcrypt.hash(password, BCRYPT_COST);
  let cliente;
  try {
    const { rows } = await pool.query(
      "INSERT INTO clientes (nombre, correo, password_hash) VALUES ($1, $2, $3) RETURNING id, nombre, correo",
      [nombre, correo, hash]);
    cliente = rows[0];
  } catch (err) {
    if (err.code === "23505") throw new ErrorHttp(409, "Ya hay una cuenta con ese correo. Inicia sesión.");
    throw err;
  }
  iniciarSesion(req, res, next, cliente);
}));

router.post("/login", loginLimiter, handle(async (req, res, next) => {
  const correo = typeof req.body.correo === "string" ? req.body.correo.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!correo || !password || correo.length > 120 || password.length > 200) {
    throw new ErrorDeDatos("Escribe tu correo y tu contraseña.");
  }
  await exigirNoFrenada("cliente", correo);
  const { rows } = await pool.query(
    "SELECT id, nombre, correo, password_hash, activo FROM clientes WHERE lower(correo) = $1", [correo]);
  const cliente = rows[0];
  const valido = await bcrypt.compare(password, cliente ? cliente.password_hash : DUMMY_HASH);
  if (!cliente || !valido) {
    await registrarFallo("cliente", correo);
    throw new ErrorHttp(401, "Correo o contraseña incorrectos.");
  }
  await limpiarFallos("cliente", correo);
  if (!cliente.activo) throw new ErrorHttp(403, "Esta cuenta está desactivada.");
  iniciarSesion(req, res, next, cliente);
}));

// Si en este navegador también hay una sesión de Necutools, solo se cierra la del cliente (con otro id de sesión)
router.post("/logout", (req, res, next) => {
  if (req.session.adminId) {
    return renovarSesion(req, ["adminId", "usuario", "creada"], err => (err ? next(err) : res.json({ autenticado: false })));
  }
  destruirSesion(req, res, next, { autenticado: false });
});

module.exports = { router, requireCliente, cargarCliente };
