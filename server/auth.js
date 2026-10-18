/**
 * Sesiones y acceso de administración (Necutools).
 */
const express = require("express");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { pool } = require("./db");

const isProd = process.env.NODE_ENV === "production";
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
    name: "necutla.sid",
    secret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: "strict",
      maxAge: 8 * 60 * 60 * 1000 // 8 horas
    }
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
    `SELECT a.id, a.usuario, a.rol, a.activo,
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

// Cierra las sesiones abiertas de un admin (al desactivarlo o cambiar su contraseña)
async function cerrarSesionesDe(adminId, exceptoSid = null) {
  await pool.query(
    `DELETE FROM "session" WHERE (sess->>'adminId')::int = $1 AND ($2::text IS NULL OR sid <> $2)`,
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
    if (!admin) return res.json({ autenticado: false, usuario: null });
    res.json({ autenticado: true, usuario: admin.usuario, rol: admin.rol, tiendas: admin.tiendas });
  } catch (err) {
    next(err);
  }
});

router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const usuario = typeof req.body.usuario === "string" ? req.body.usuario.trim() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (!usuario || !password || usuario.length > 50 || password.length > 200) {
      return res.status(400).json({ error: "Escribe tu usuario y contraseña." });
    }
    const { rows } = await pool.query("SELECT id, usuario, password_hash, rol, activo FROM admins WHERE usuario = $1", [usuario]);
    const admin = rows[0];
    const valido = await bcrypt.compare(password, admin ? admin.password_hash : DUMMY_HASH);
    if (!admin || !valido) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
    }
    if (!admin.activo) {
      return res.status(403).json({ error: "Tu cuenta está desactivada. Pídele a un dueño de Necutla que la active." });
    }
    // Nueva sesión al iniciar (evita fijación de sesión)
    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.adminId = admin.id;
      req.session.usuario = admin.usuario;
      req.session.save(saveErr => {
        if (saveErr) return next(saveErr);
        res.json({ autenticado: true, usuario: admin.usuario, rol: admin.rol });
      });
    });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (req, res, next) => {
  req.session.destroy(err => {
    if (err) return next(err);
    res.clearCookie("necutla.sid");
    res.json({ autenticado: false });
  });
});

module.exports = {
  sessionMiddleware, ensureInitialAdmin, requireAdmin, requireDueno, puedeEditarStand, cerrarSesionesDe,
  BCRYPT_COST, router
};
