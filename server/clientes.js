/**
 * Cuentas de cliente (/api/clientes): registro, inicio y cierre de sesión.
 * Solo sirven para opinar sobre productos; el pedido sigue sin cuenta, por WhatsApp.
 * Se entra con el nombre de usuario o con el correo, en un solo campo. El teléfono es privado:
 * no sale en ninguna respuesta pública (opiniones, tiendas, pedidos).
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
  const { rows } = await pool.query(
    `SELECT id, nombre, usuario, correo, telefono IS NOT NULL AS con_telefono, activo, sesion_version
     FROM clientes WHERE id = $1`, [req.session.clienteId]);
  const cliente = rows[0];
  if (!cliente || !cliente.activo) return null;
  // Sesión iniciada antes del último cambio de contraseña: ya no vale
  if ((req.session.clienteVersion || 0) !== cliente.sesion_version) return null;
  return cliente;
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

const passwordValida = (valor, confirmar, contiene, campo) =>
  validarContrasena(valor, { minimo: MIN_PASSWORD, confirmar: typeof confirmar === "string" ? confirmar : "", contiene, campo });

// Lo que ve el propio cliente de su sesión. incompleta: cuenta de antes del registro con usuario y teléfono
const datosSesion = cliente => ({
  autenticado: true, nombre: cliente.nombre, usuario: cliente.usuario || null, correo: cliente.correo,
  incompleta: !cliente.usuario || !cliente.con_telefono
});

// El freno por cuenta usa el id: así no se esquiva alternando el usuario y el correo
const cuentaFreno = (cliente, escrito) => (cliente ? `id:${cliente.id}` : escrito);

// Cierra la sesión de cliente en los demás navegadores (si ahí también hay un admin, ese sigue dentro).
// Si alguno tenía una petición en curso y vuelve a guardar su sesión, sesion_version la invalida igual.
async function cerrarOtrasSesiones(clienteId, exceptoSid) {
  await pool.query(
    `UPDATE "session" SET sess = (sess::jsonb - 'clienteId')::json
     WHERE (sess->>'clienteId')::int = $1 AND sid <> $2`, [clienteId, exceptoSid]);
}

const DUPLICADO = "Ese nombre de usuario o ese correo ya tienen cuenta. Inicia sesión o usa otros.";

// Nueva sesión al entrar (evita fijación de sesión). Si ya había un admin en este navegador, se conserva.
function iniciarSesion(req, res, next, cliente) {
  renovarSesion(req, ["adminId", "usuario"], err => {
    if (err) return next(err);
    req.session.clienteId = cliente.id;
    req.session.clienteVersion = cliente.sesion_version || 0;
    req.session.creada = Date.now();
    req.session.save(saveErr => {
      if (saveErr) return next(saveErr);
      res.json(datosSesion(cliente));
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

// Revisión del correo mientras se escribe (formato y dominio). Consulta el DNS, por eso tiene su propio límite.
const revisarLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Espera unos minutos para revisar más correos." }
});

const cambiosLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Demasiados cambios seguidos. Espera 15 minutos y vuelve a intentar." }
});

const router = express.Router();

router.get("/sesion", handle(async (req, res) => {
  const cliente = await cargarCliente(req);
  if (!cliente) return res.json({ autenticado: false });
  res.json(datosSesion(cliente));
}));

// Nunca dice si el correo ya tiene cuenta: solo si está bien escrito y si su dominio recibe correos
router.post("/revisar-correo", revisarLimiter, handle(async (req, res) => {
  const { correo, sugerencia } = await v.revisarCorreo(req.body.correo);
  res.json({ valido: true, correo, sugerencia });
}));

router.post("/registro", registroLimiter, handle(async (req, res, next) => {
  const nombre = v.texto(req.body.nombre, "tu nombre", { max: 60, requerido: true });
  if (nombre.length < 2) throw new ErrorDeDatos("Escribe tu nombre con al menos 2 letras.");
  const usuario = v.usuarioValido(req.body.usuario);
  const { pais, telefono } = v.telefono(req.body.pais, req.body.telefono);
  const correo = await v.correoReal(req.body.correo);
  const password = passwordValida(req.body.password, req.body.confirmar, [nombre, usuario, correo.split("@")[0]]);
  // Antes del bcrypt: un usuario o correo repetido no debe gastar CPU. No se dice cuál de los dos.
  const { rows: existe } = await pool.query(
    "SELECT 1 FROM clientes WHERE lower(correo) = $1 OR lower(usuario) = $2", [correo, usuario]);
  if (existe[0]) throw new ErrorHttp(409, DUPLICADO);
  const hash = await bcrypt.hash(password, BCRYPT_COST);
  let cliente;
  try {
    const { rows } = await pool.query(
      `INSERT INTO clientes (nombre, usuario, correo, pais, telefono, password_hash) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nombre, usuario, correo, true AS con_telefono`,
      [nombre, usuario, correo, pais, telefono, hash]);
    cliente = rows[0];
  } catch (err) {
    if (err.code === "23505") throw new ErrorHttp(409, DUPLICADO);
    throw err;
  }
  iniciarSesion(req, res, next, cliente);
}));

// Un solo campo: con "@" es un correo; sin "@", un nombre de usuario. `correo` se sigue aceptando.
router.post("/login", loginLimiter, handle(async (req, res, next) => {
  const crudo = req.body.identificador !== undefined ? req.body.identificador : req.body.correo;
  const identificador = typeof crudo === "string" ? crudo.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!identificador || !password || identificador.length > 120 || password.length > 200) {
    throw new ErrorDeDatos("Escribe tu usuario o correo y tu contraseña.");
  }
  const campos = "SELECT id, nombre, usuario, correo, telefono IS NOT NULL AS con_telefono, password_hash, activo, sesion_version FROM clientes";
  const { rows } = await pool.query(identificador.includes("@")
    ? `${campos} WHERE lower(correo) = $1`
    : `${campos} WHERE lower(usuario) = $1`, [identificador]);
  const cliente = rows[0];
  const freno = cuentaFreno(cliente, identificador);
  await exigirNoFrenada("cliente", freno);
  const valido = await bcrypt.compare(password, cliente ? cliente.password_hash : DUMMY_HASH);
  if (!cliente || !valido) {
    await registrarFallo("cliente", freno);
    throw new ErrorHttp(401, "Usuario, correo o contraseña incorrectos.");
  }
  await limpiarFallos("cliente", freno);
  if (!cliente.activo) throw new ErrorHttp(403, "Esta cuenta está desactivada.");
  iniciarSesion(req, res, next, cliente);
}));

// Cambiar la contraseña: pide la actual (con freno por cuenta) y la nueva dos veces
router.put("/password", cambiosLimiter, requireCliente, handle(async (req, res, next) => {
  const { rows } = await pool.query("SELECT password_hash FROM clientes WHERE id = $1", [req.cliente.id]);
  const freno = `password:${req.cliente.id}`;
  await exigirNoFrenada("cliente", freno);
  const actual = typeof req.body.actual === "string" ? req.body.actual : "";
  if (!actual || actual.length > 200 || !(await bcrypt.compare(actual, rows[0].password_hash))) {
    await registrarFallo("cliente", freno);
    throw new ErrorDeDatos("Tu contraseña actual no es correcta.");
  }
  await limpiarFallos("cliente", freno);
  const contiene = [req.cliente.nombre, req.cliente.usuario, req.cliente.correo.split("@")[0]];
  const nueva = passwordValida(req.body.nueva, req.body.confirmar, contiene, "La contraseña nueva");
  if (nueva === actual) throw new ErrorDeDatos("La contraseña nueva debe ser distinta a la actual.");
  const hash = await bcrypt.hash(nueva, BCRYPT_COST);
  const { rows: [cambio] } = await pool.query(
    "UPDATE clientes SET password_hash = $1, sesion_version = sesion_version + 1 WHERE id = $2 RETURNING sesion_version",
    [hash, req.cliente.id]);
  // Id de sesión nuevo aquí y fuera de los demás navegadores
  renovarSesion(req, ["adminId", "usuario", "clienteId", "clienteVersion", "creada"], err => {
    if (err) return next(err);
    req.session.clienteVersion = cambio.sesion_version;
    cerrarOtrasSesiones(req.cliente.id, req.sessionID)
      .then(() => req.session.save(saveErr => (saveErr ? next(saveErr) : res.json({ ok: true }))))
      .catch(next);
  });
}));

// Cuentas de antes del registro con usuario y teléfono: los completan una vez
router.put("/completar", cambiosLimiter, requireCliente, handle(async (req, res) => {
  const usuario = req.cliente.usuario || v.usuarioValido(req.body.usuario);
  const { pais, telefono } = v.telefono(req.body.pais, req.body.telefono);
  try {
    const { rows } = await pool.query(
      `UPDATE clientes SET usuario = $1, pais = $2, telefono = $3 WHERE id = $4
       RETURNING id, nombre, usuario, correo, true AS con_telefono`,
      [usuario, pais, telefono, req.cliente.id]);
    res.json(datosSesion(rows[0]));
  } catch (err) {
    if (err.code === "23505") throw new ErrorHttp(409, "Ese nombre de usuario ya está ocupado. Elige otro.");
    throw err;
  }
}));

// Si en este navegador también hay una sesión de Necutools, solo se cierra la del cliente (con otro id de sesión)
router.post("/logout", (req, res, next) => {
  if (req.session.adminId) {
    return renovarSesion(req, ["adminId", "usuario", "creada"], err => (err ? next(err) : res.json({ autenticado: false })));
  }
  destruirSesion(req, res, next, { autenticado: false });
});

module.exports = { router, requireCliente, cargarCliente };
