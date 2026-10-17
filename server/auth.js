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
  await pool.query("INSERT INTO admins (usuario, password_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING", [usuario, hash]);
  console.log(`Administrador inicial creado: ${usuario}`);
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.adminId) return next();
  res.status(401).json({ error: "Inicia sesión en Necutools para hacer esto." });
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

router.get("/sesion", (req, res) => {
  res.json({ autenticado: Boolean(req.session.adminId), usuario: req.session.usuario || null });
});

router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const usuario = typeof req.body.usuario === "string" ? req.body.usuario.trim() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (!usuario || !password || usuario.length > 50 || password.length > 200) {
      return res.status(400).json({ error: "Escribe tu usuario y contraseña." });
    }
    const { rows } = await pool.query("SELECT id, usuario, password_hash FROM admins WHERE usuario = $1", [usuario]);
    const admin = rows[0];
    const valido = await bcrypt.compare(password, admin ? admin.password_hash : DUMMY_HASH);
    if (!admin || !valido) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
    }
    // Nueva sesión al iniciar (evita fijación de sesión)
    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.adminId = admin.id;
      req.session.usuario = admin.usuario;
      req.session.save(saveErr => {
        if (saveErr) return next(saveErr);
        res.json({ autenticado: true, usuario: admin.usuario });
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

module.exports = { sessionMiddleware, ensureInitialAdmin, requireAdmin, router };
