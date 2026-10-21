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
const admin = require("./admin");
const clientes = require("./clientes");
const resenas = require("./resenas");
const pedidos = require("./pedidos");
const { importarEjemplos, importarServicios } = require("./ejemplos");
const { limpiarViejos } = require("./intentos");
const { limpiarImagenesGuardadas } = require("./imagenes");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "..", "public");

// Render pone un proxy delante: necesario para cookies "secure" y la IP real del rate limit
app.set("trust proxy", 1);
app.disable("x-powered-by");

// Para comprobar en los Logs de Render que "trust proxy 1" es correcto: en las primeras peticiones
// se anota cuántas direcciones trae X-Forwarded-For (debe ser 1; si es 2, hay otro proxy delante)
let proxyRevisiones = process.env.NODE_ENV === "production" ? 3 : 0;
app.use((req, res, next) => {
  if (proxyRevisiones > 0) {
    proxyRevisiones -= 1;
    const n = (req.get("x-forwarded-for") || "").split(",").filter(x => x.trim()).length;
    console.log(`Revisión de proxy: X-Forwarded-For trae ${n} dirección(es); con trust proxy 1 debe ser 1.`);
  }
  next();
});

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

// Funciones del navegador que el sitio no usa: apagadas para cualquier script
app.use((req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()");
  next();
});

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

// Protección CSRF: las peticiones que cambian datos deben venir de este mismo sitio.
// Además del Origin, los navegadores mandan Sec-Fetch-Site: solo se acepta "same-origin" (o "none",
// cuando la persona escribe la dirección).
function sameOrigin(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const sitio = req.get("sec-fetch-site");
  const origin = req.get("origin");
  try {
    if ((!sitio || sitio === "same-origin" || sitio === "none") && origin && new URL(origin).host === req.get("host")) return next();
  } catch (err) { /* Origin mal formado */ }
  res.status(403).json({ error: "Petición no permitida." });
}

// Solo las rutas de Necutools que suben imágenes aceptan cuerpos grandes; el resto, 20 KB
const CON_IMAGEN = /^\/admin\/(tiendas|productos|promociones)(\/[0-9]+)?$/;
const jsonChico = express.json({ limit: "20kb" });
const jsonConImagen = express.json({ limit: "2mb" });
const leerJson = (req, res, next) => (CON_IMAGEN.test(req.path) ? jsonConImagen : jsonChico)(req, res, next);

// Respuestas con datos privados: que no se guarden en caché ni las indexen los buscadores
const PRIVADAS = /^\/(admin|auth|clientes)(\/|$)/;
function cabecerasApi(req, res, next) {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  if (PRIVADAS.test(req.path)) res.setHeader("Cache-Control", "no-store");
  next();
}

app.use("/api", apiLimiter, cabecerasApi, sameOrigin, leerJson, auth.sessionMiddleware(), auth.vidaMaxima);
app.use("/api/auth", auth.router);
app.use("/api/admin", pedidos.adminRouter);
app.use("/api/admin", admin.router);
app.use("/api/clientes", clientes.router);
app.use("/api", resenas.router);
app.use("/api", pedidos.router);
app.use("/api", api.router);
app.use("/api", (req, res) => res.status(404).json({ error: "Ruta no encontrada." }));

// ================= Páginas =================
// Una sola página para todas las tiendas: /t/ropa, /t/tecnologia?sub=cables…
app.get("/t/:slug", (req, res, next) => {
  if (!/^[a-z0-9-]{1,60}$/.test(req.params.slug)) return next();
  res.sendFile(path.join(PUBLIC_DIR, "tienda.html"));
});

// Página de un producto o servicio con sus opiniones: /p/12
app.get("/p/:id", (req, res, next) => {
  if (!/^[1-9][0-9]{0,9}$/.test(req.params.id)) return next();
  res.sendFile(path.join(PUBLIC_DIR, "producto.html"));
});

// Las direcciones de las páginas fijas que había antes siguen funcionando
const TIENDAS_VIEJAS = "(ropa|tecnologia|dulces|propaganda|papeleria|regalos|otra)";
app.get(new RegExp(`^/${TIENDAS_VIEJAS}/carrito\\.html$`), (req, res) => res.redirect(301, "/carrito.html"));
app.get(new RegExp(`^/${TIENDAS_VIEJAS}(?:/(?:index\\.html)?)?$`), (req, res) => res.redirect(301, `/t/${req.params[0]}`));
app.get(new RegExp(`^/${TIENDAS_VIEJAS}/([a-z0-9-]+)(?:/(?:index\\.html)?)?$`), (req, res) =>
  res.redirect(301, `/t/${req.params[0]}?sub=${req.params[1]}`));

// Chart.js (gráficas de Necutools) se sirve desde node_modules: la CSP solo permite scripts propios
// (el paquete no exporta dist/chart.umd.js: se arma la ruta desde su archivo principal, también en dist/)
const CHART_JS = path.join(path.dirname(require.resolve("chart.js")), "chart.umd.js");
app.get("/vendor/chart.umd.js", (req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(CHART_JS);
});

// Contacto para reportar fallas de seguridad (express.static no sirve carpetas que empiezan con punto)
app.get("/.well-known/security.txt", (req, res) => {
  res.type("text/plain; charset=utf-8");
  res.sendFile(path.join(PUBLIC_DIR, ".well-known", "security.txt"));
});

// Necutools no debe aparecer en buscadores
app.get("/necutools.html", (req, res, next) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  next();
});

// ================= Sitio estático (solo la carpeta public/) =================
// HTML, CSS y JS se revalidan siempre (304 si no cambiaron): si no, tras un despliegue el
// navegador mezcla el HTML nuevo con el style.css o comun.js viejo de su caché.
const REVALIDAR = /\.(html|css|js)$/;
app.use(express.static(PUBLIC_DIR, {
  dotfiles: "ignore",
  maxAge: "1h",
  setHeaders: (res, ruta) => {
    if (REVALIDAR.test(ruta)) res.setHeader("Cache-Control", "no-cache");
  }
}));

app.use((req, res) => {
  res.status(404).type("text/plain").send("Página no encontrada.");
});

// ================= Errores (sin detalles al cliente) =================
app.use((err, req, res, next) => {
  if (err.type === "entity.too.large") {
    const conImagen = req.originalUrl.startsWith("/api") && CON_IMAGEN.test(req.originalUrl.slice(4).split("?")[0]);
    return res.status(413).json({ error: conImagen
      ? "El archivo es demasiado grande. Usa una imagen de hasta 1 MB."
      : "Mandaste demasiados datos. Revisa el formulario y vuelve a intentar." });
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
  await importarEjemplos();
  await importarServicios();
  await limpiarImagenesGuardadas(pool);
  setInterval(() => limpiarViejos().catch(err => console.error(err)), 6 * 60 * 60 * 1000).unref();
  app.listen(PORT, () => console.log(`Necutla escuchando en el puerto ${PORT}`));
}

start().catch(err => {
  console.error("No se pudo iniciar el servidor:", err.message);
  process.exit(1);
});
