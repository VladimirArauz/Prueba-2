/**
 * NECUTLA — Servidor web
 * Sirve el sitio de public/ y la API de Necutools con PostgreSQL.
 */
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { pool, migrate } = require("./db");
const auth = require("./auth");
const api = require("./api");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "..", "public");

// Render pone un proxy delante: necesario para cookies "secure" y la IP real del rate limit
app.set("trust proxy", 1);
app.disable("x-powered-by");

// ================= Cabeceras de seguridad =================
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));

// ================= Salud (health check de Render) =================
app.get("/healthz", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (err) {
    res.status(503).json({ ok: false });
  }
});

// ================= API =================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones. Espera unos minutos." }
});

// Protección CSRF: las peticiones que cambian datos deben venir de este mismo sitio
function sameOrigin(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  try {
    if (origin && new URL(origin).host === req.get("host")) return next();
  } catch (err) { /* Origin mal formado */ }
  res.status(403).json({ error: "Petición no permitida." });
}

app.use("/api", apiLimiter, express.json({ limit: "2mb" }), sameOrigin, auth.sessionMiddleware());
app.use("/api/auth", auth.router);
app.use("/api", api.router);
app.use("/api", (req, res) => res.status(404).json({ error: "Ruta no encontrada." }));

// ================= Sitio estático (solo la carpeta public/) =================
app.use(express.static(PUBLIC_DIR, { dotfiles: "ignore", maxAge: "1h" }));

app.use((req, res) => {
  res.status(404).type("text/plain").send("Página no encontrada.");
});

// ================= Errores (sin detalles al cliente) =================
app.use((err, req, res, next) => {
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "El archivo es demasiado grande. Usa una imagen de hasta 1 MB." });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Datos con formato incorrecto." });
  }
  console.error(err);
  res.status(500).json({ error: "Ocurrió un error en el servidor. Intenta de nuevo." });
});

// ================= Arranque =================
async function start() {
  await migrate();
  await auth.ensureInitialAdmin();
  app.listen(PORT, () => console.log(`Necutla escuchando en el puerto ${PORT}`));
}

start().catch(err => {
  console.error("No se pudo iniciar el servidor:", err.message);
  process.exit(1);
});
