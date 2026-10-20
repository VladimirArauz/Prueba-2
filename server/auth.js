/**
 * Sesiones y acceso de administración (Necutools).
 */
const express = require("express");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { pool } = require("./db");
const { ErrorHttp, handle } = require("./validar");
const { exigirNoFrenada, registrarFallo, limpiarFallos } = require("./intentos");
const { verificarCodigo, hashRespaldo } = require("./totp");
const { anotar } = require("./bitacora");

const isProd = process.env.NODE_ENV === "production";
// Render define RENDER=true: allá la cookie debe ir siempre con "secure"
if (process.env.RENDER && !isProd) {
  throw new Error("En Render, NODE_ENV debe ser production (la cookie de sesión necesita HTTPS).");
}
// Con HTTPS, el prefijo __Host- obliga al navegador a usar la cookie solo en este dominio, con secure y path=/
const COOKIE = isProd ? "__Host-necutla.sid" : "necutla.sid";
const COOKIE_OPCIONES = { path: "/", httpOnly: true, secure: isProd, sameSite: "strict" };
// La sesión se renueva con cada uso (8 h sin usarla la cierran), pero no dura más de esto en total
const VIDA_MAXIMA = 24 * 60 * 60 * 1000;
const BCRYPT_COST = 12;
// Hash fijo para comparar aunque el usuario no exista (mismo tiempo de respuesta)
const DUMMY_HASH = bcrypt.hashSync("usuario-inexistente", BCRYPT_COST);

function sessionMiddleware() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET debe tener al menos 32 caracteres.");
  }
  return session({
    store: new PgSession({ pool, tableName: "session" }),
    name: COOKIE,
    secret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { ...COOKIE_OPCIONES, maxAge: 8 * 60 * 60 * 1000 } // 8 horas
  });
}

// Duración máxima de una sesión con cuenta (admin o cliente), aunque se siga usando
function vidaMaxima(req, res, next) {
  const s = req.session;
  if (!s || !(s.adminId || s.clienteId)) return next();
  if (!s.creada) {
    s.creada = Date.now();
    return next();
  }
  if (Date.now() - s.creada <= VIDA_MAXIMA) return next();
  s.regenerate(err => next(err));
}

// Nueva sesión (otro id) que conserva solo los datos indicados: al entrar o al salir de una de las dos cuentas
function renovarSesion(req, conservar, listo) {
  const datos = {};
  for (const clave of conservar) if (req.session[clave] !== undefined) datos[clave] = req.session[clave];
  req.session.regenerate(err => {
    if (err) return listo(err);
    Object.assign(req.session, datos);
    listo();
  });
}

// Cierra la sesión del navegador y borra la cookie
function destruirSesion(req, res, next, respuesta) {
  req.session.destroy(err => {
    if (err) return next(err);
    res.clearCookie(COOKIE, COOKIE_OPCIONES);
    res.json(respuesta);
  });
}

// Crea el primer admin con ADMIN_USERNAME / ADMIN_PASSWORD si todavía no hay ninguno
async function ensureInitialAdmin() {
  const { rows } = await pool.query("SELECT count(*)::int AS total FROM admins");
  if (rows[0].total > 0) return;

  const usuario = (process.env.ADMIN_USERNAME || "").trim();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!usuario || password.length < 12) {
    console.warn("No hay administradores. Define ADMIN_USERNAME y ADMIN_PASSWORD (12+ caracteres) para crear el primero.");
    return;
  }
  const hash = await bcrypt.hash(password, BCRYPT_COST);
  await pool.query("INSERT INTO admins (usuario, password_hash, rol) VALUES ($1, $2, 'dueno') ON CONFLICT DO NOTHING", [usuario, hash]);
  console.log(`Administrador inicial creado: ${usuario}`);
}

// Carga al admin en cada petición: si lo desactivaron o cambiaron su rol, se nota de inmediato
async function cargarAdmin(req) {
  if (!req.session || !req.session.adminId) return null;
  const { rows } = await pool.query(
    `SELECT a.id, a.usuario, a.rol, a.activo, a.totp_activo,
            COALESCE(array_agg(s.stand_id) FILTER (WHERE s.stand_id IS NOT NULL), '{}') AS tiendas
     FROM admins a LEFT JOIN admin_stands s ON s.admin_id = a.id
     WHERE a.id = $1 GROUP BY a.id`, [req.session.adminId]);
  const admin = rows[0];
  if (!admin || !admin.activo) return null;
  return admin;
}

async function requireAdmin(req, res, next) {
  try {
    const admin = await cargarAdmin(req);
    if (admin) {
      req.admin = admin;
      return next();
    }
    if (req.session && req.session.adminId) req.session.destroy(() => {});
    res.status(401).json({ error: "Inicia sesión en Necutools para hacer esto." });
  } catch (err) {
    next(err);
  }
}

// Solo dueños (va después de requireAdmin)
function requireDueno(req, res, next) {
  if (req.admin && req.admin.rol === "dueno") return next();
  res.status(403).json({ error: "Solo un dueño puede hacer esto." });
}

// Dueños: todas las tiendas. Encargados: solo las que tienen asignadas.
function puedeEditarStand(req, standId) {
  if (!req.admin) return false;
  return req.admin.rol === "dueno" || req.admin.tiendas.includes(Number(standId));
}

// Cierra las sesiones abiertas de un admin, también los logins a medias (al desactivarlo o cambiar su contraseña)
async function cerrarSesionesDe(adminId, exceptoSid = null) {
  await pool.query(
    `DELETE FROM "session"
     WHERE ((sess->>'adminId')::int = $1 OR (sess->'pendiente'->>'adminId')::int = $1)
       AND ($2::text IS NULL OR sid <> $2)`,
    [adminId, exceptoSid]);
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Demasiados intentos. Espera 15 minutos y vuelve a intentar." }
});

const router = express.Router();

router.get("/sesion", async (req, res, next) => {
  try {
    const admin = await cargarAdmin(req);
    if (!admin) {
      const p = req.session.pendiente;
      return res.json({ autenticado: false, usuario: null, segundoPaso: Boolean(p && p.hasta > Date.now()) });
    }
    res.json({ autenticado: true, usuario: admin.usuario, rol: admin.rol, tiendas: admin.tiendas });
  } catch (err) {
    next(err);
  }
});

// Entra a Necutools: sesión nueva (evita fijación de sesión). Si había un cliente en este navegador, se conserva.
function entrar(req, res, next, admin) {
  anotar(admin, "entrar", "sesiones", null, "Inició sesión en Necutools");
  renovarSesion(req, ["clienteId"], err => {
    if (err) return next(err);
    req.session.adminId = admin.id;
    req.session.usuario = admin.usuario;
    req.session.creada = Date.now();
    req.session.save(saveErr => {
      if (saveErr) return next(saveErr);
      res.json({ autenticado: true, usuario: admin.usuario, rol: admin.rol });
    });
  });
}

// Código de 2 pasos o de respaldo. Se marca como usado en la misma consulta (no sirve dos veces).
async function usarCodigo(admin, valor) {
  const codigo = typeof valor === "string" ? valor.replace(/\s/g, "") : "";
  if (!codigo || codigo.length > 20) return false;
  const paso = verificarCodigo(admin.totp_secreto, codigo, admin.totp_ultimo);
  if (paso !== null) {
    const { rowCount } = await pool.query(
      "UPDATE admins SET totp_ultimo = $1 WHERE id = $2 AND (totp_ultimo IS NULL OR totp_ultimo < $1)", [paso, admin.id]);
    return rowCount === 1;
  }
  const { rowCount } = await pool.query(
    "UPDATE admins SET totp_respaldo = array_remove(totp_respaldo, $1) WHERE id = $2 AND $1 = ANY(totp_respaldo)",
    [hashRespaldo(codigo), admin.id]);
  return rowCount === 1;
}

const PENDIENTE_MS = 5 * 60 * 1000;

router.post("/login", loginLimiter, handle(async (req, res, next) => {
  const usuario = typeof req.body.usuario === "string" ? req.body.usuario.trim() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!usuario || !password || usuario.length > 50 || password.length > 200) {
    return res.status(400).json({ error: "Escribe tu usuario y contraseña." });
  }
  await exigirNoFrenada("admin", usuario);
  const { rows } = await pool.query(
    "SELECT id, usuario, password_hash, rol, activo, totp_activo FROM admins WHERE usuario = $1", [usuario]);
  const admin = rows[0];
  const valido = await bcrypt.compare(password, admin ? admin.password_hash : DUMMY_HASH);
  if (!admin || !valido) {
    await registrarFallo("admin", usuario);
    return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
  }
  await limpiarFallos("admin", usuario);
  if (!admin.activo) {
    return res.status(403).json({ error: "Tu cuenta está desactivada. Pídele a un dueño de Necutla que la active." });
  }
  if (!admin.totp_activo) return entrar(req, res, next, admin);
  // Con verificación en dos pasos: la sesión queda a medias (sin adminId) hasta mandar el código
  renovarSesion(req, ["clienteId"], err => {
    if (err) return next(err);
    req.session.pendiente = { adminId: admin.id, hasta: Date.now() + PENDIENTE_MS };
    res.json({ autenticado: false, segundoPaso: true });
  });
}));

router.post("/login/codigo", loginLimiter, handle(async (req, res, next) => {
  const pendiente = req.session.pendiente;
  if (!pendiente || pendiente.hasta < Date.now()) {
    delete req.session.pendiente;
    throw new ErrorHttp(401, "Tu inicio de sesión venció. Escribe otra vez tu usuario y contraseña.");
  }
  await exigirNoFrenada("totp", pendiente.adminId);
  const { rows } = await pool.query(
    "SELECT id, usuario, rol, activo, totp_secreto, totp_ultimo FROM admins WHERE id = $1 AND totp_activo", [pendiente.adminId]);
  const admin = rows[0];
  if (!admin || !admin.activo) {
    delete req.session.pendiente;
    throw new ErrorHttp(401, "Escribe otra vez tu usuario y contraseña.");
  }
  if (!(await usarCodigo(admin, req.body.codigo))) {
    await registrarFallo("totp", admin.id);
    throw new ErrorHttp(401, "El código no es correcto. Escribe el que muestra la app en este momento o uno de respaldo.");
  }
  await limpiarFallos("totp", admin.id);
  entrar(req, res, next, admin);
}));

// Si en este navegador también hay una cuenta de cliente, solo se cierra la de Necutools (con otro id de sesión)
router.post("/logout", (req, res, next) => {
  if (req.session.clienteId) {
    return renovarSesion(req, ["clienteId", "creada"], err => (err ? next(err) : res.json({ autenticado: false })));
  }
  destruirSesion(req, res, next, { autenticado: false });
});

module.exports = {
  sessionMiddleware, vidaMaxima, renovarSesion, destruirSesion, usarCodigo, cargarAdmin, ensureInitialAdmin, requireAdmin, requireDueno, puedeEditarStand, cerrarSesionesDe,
  BCRYPT_COST, DUMMY_HASH, router
};
