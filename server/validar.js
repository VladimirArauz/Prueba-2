/**
 * Validación compartida por la API pública y la de administración.
 */
const dns = require("dns");
const PAISES = require("../public/datos/paises.json");

const MAX_IMAGEN_BYTES = 1024 * 1024; // 1 MB

class ErrorDeDatos extends Error {}

// Error con código HTTP propio (403, 404, 409…) que el manejador devuelve tal cual
class ErrorHttp extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

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

// Id opcional: vacío o null → null; cualquier otra cosa debe ser un id válido
function idOpcional(valor, campo) {
  if (valor === undefined || valor === null || valor === "") return null;
  const id = idValido(valor);
  if (!id) throw new ErrorDeDatos(`${campo} no es válido.`);
  return id;
}

function entero(valor, campo, { min = 0, max = 9999, defecto = 0 } = {}) {
  if (valor === undefined || valor === null || valor === "") return defecto;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) throw new ErrorDeDatos(`${campo} debe ser un número entre ${min} y ${max}.`);
  return n;
}

function booleano(valor, defecto = true) {
  if (valor === undefined || valor === null) return defecto;
  return valor === true || valor === "true" || valor === 1 || valor === "1";
}

function precio(valor, campo = "el precio") {
  const n = Number(valor);
  if (valor === "" || valor === null || !Number.isFinite(n) || n <= 0 || n > 99999999) {
    throw new ErrorDeDatos(`Escribe ${campo} mayor a 0.`);
  }
  return n.toFixed(2);
}

function opcion(valor, opciones, campo) {
  if (!opciones.includes(valor)) throw new ErrorDeDatos(`Elige ${campo}.`);
  return valor;
}

function fecha(valor, campo) {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor) || Number.isNaN(Date.parse(valor))) {
    throw new ErrorDeDatos(`Escribe ${campo} con formato de fecha.`);
  }
  return valor;
}

// "Papelería Fer" → "papeleria-fer" (igual que necutla_slug() en db/schema.sql)
function slugDe(valor) {
  return String(valor).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function slug(valor, campo, respaldo) {
  const limpio = slugDe(typeof valor === "string" && valor.trim() ? valor : respaldo || "");
  if (!limpio) throw new ErrorDeDatos(`Escribe ${campo} con letras o números.`);
  if (limpio.length > 60) throw new ErrorDeDatos(`${campo} admite hasta 60 caracteres.`);
  return limpio;
}

// Números de WhatsApp: México 52 + 10 dígitos (acepta de 10 a 15 dígitos)
function numerosWhatsApp(valor) {
  let lista = valor;
  if (lista === undefined || lista === null || lista === "") return [];
  if (typeof lista === "string") lista = lista.split(",");
  if (!Array.isArray(lista) || lista.length > 5) throw new ErrorDeDatos("Escribe hasta 5 números de WhatsApp.");
  const numeros = lista.map(n => String(n).replace(/\D/g, "")).filter(Boolean);
  for (const n of numeros) {
    if (n.length < 10 || n.length > 15) throw new ErrorDeDatos("Cada número de WhatsApp debe tener de 10 a 15 dígitos (México: 52 + 10 dígitos).");
  }
  return [...new Set(numeros)];
}

// Números de respaldo de la variable WHATSAPP_NUMBERS
function numerosRespaldo() {
  return (process.env.WHATSAPP_NUMBERS || "")
    .split(",")
    .map(n => n.replace(/\D/g, ""))
    .filter(n => n.length >= 10 && n.length <= 15);
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

// ================= Cuentas: usuario, correo y teléfono =================
// Usuario para entrar: sin "@", así el login sabe si le escribieron un usuario o un correo
function usuarioValido(valor, { max = 30 } = {}) {
  const usuario = texto(valor, "un nombre de usuario", { max, requerido: true }).toLowerCase();
  if (!new RegExp(`^[a-z0-9._-]{3,${max}}$`).test(usuario)) {
    throw new ErrorDeDatos(`El nombre de usuario debe tener de 3 a ${max} letras sin acentos, números, punto, guion o guion bajo.`);
  }
  return usuario;
}

// Mismo formato que public/js/validacion.js: sin espacios, un solo @, dominio con punto y terminación de 2 letras o más
const FORMATO_CORREO = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

// Proveedores que existen de verdad (nunca se toman como error de dedo) y los más usados, para sugerirlos
const PROVEEDORES = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.es", "hotmail.com.mx", "outlook.com", "outlook.es",
  "live.com", "live.com.mx", "msn.com", "yahoo.com", "yahoo.com.mx", "yahoo.es", "icloud.com", "me.com", "mac.com",
  "proton.me", "protonmail.com", "aol.com", "mail.com", "gmx.com", "zoho.com", "yandex.com"
]);
const POPULARES = ["gmail.com", "hotmail.com", "outlook.com", "live.com", "yahoo.com", "icloud.com", "yahoo.com.mx", "outlook.es", "hotmail.es"];

// Distancia de edición con transposición (gmial ↔ gmail cuenta como 1)
function distancia(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// "gmial.com" → "gmail.com"; null si el dominio no parece un error de dedo
function sugerenciaDominio(dominio) {
  if (PROVEEDORES.has(dominio)) return null;
  const cerca = POPULARES.find(p => distancia(dominio, p) === 1)
    || POPULARES.find(p => distancia(dominio, p) === 2 && dominio.split(".")[0].length >= 5);
  return cerca || null;
}

// ¿El dominio recibe correos? (registro MX). Caché de 1 hora; si el DNS no contesta, se da por bueno.
// En desarrollo, CORREO_DNS_PRUEBA=1 no consulta internet: solo los dominios que terminan en .invalid o
// empiezan con "sin-correo." se toman como dominios sin correo.
const cacheMx = new Map();
const MX_CACHE_MS = 60 * 60 * 1000;

async function recibeCorreo(dominio) {
  if (process.env.NODE_ENV !== "production" && process.env.CORREO_DNS_PRUEBA === "1") {
    return !dominio.endsWith(".invalid") && !dominio.startsWith("sin-correo.");
  }
  const guardado = cacheMx.get(dominio);
  if (guardado && guardado.hasta > Date.now()) return guardado.ok;
  let ok;
  try {
    const resolver = new dns.promises.Resolver({ timeout: 3000, tries: 1 });
    const mx = await resolver.resolveMx(dominio);
    ok = mx.some(r => r.exchange && r.exchange !== "."); // "MX 0 ." = el dominio dice que no recibe correo
  } catch (err) {
    if (err.code === "ENODATA") {
      // Sin MX, el correo se entrega al A/AAAA del dominio (RFC 5321, 5.1)
      const resolver = new dns.promises.Resolver({ timeout: 3000, tries: 1 });
      const direcciones = await Promise.all([resolver.resolve4(dominio), resolver.resolve6(dominio)]
        .map(p => p.then(r => r.length, () => 0)));
      ok = direcciones.some(Boolean);
    } else if (err.code === "ENOTFOUND" || err.code === "NXDOMAIN") {
      ok = false;
    } else {
      return true; // tiempo agotado o DNS caído: no se bloquea el registro
    }
  }
  if (cacheMx.size > 2000) cacheMx.clear();
  cacheMx.set(dominio, { ok, hasta: Date.now() + MX_CACHE_MS });
  return ok;
}

// Correo con formato correcto y de un dominio que sí recibe correos. Si el dominio no recibe correos
// y parece un error de dedo, el ErrorDeDatos trae .sugerencia ("ana@gmail.com"). Un dominio parecido
// a uno popular que sí recibe correos (ymail.com, email.com, hotmail.fr) se acepta: solo se sugiere.
async function correoReal(valor, campo = "tu correo") {
  return (await revisarCorreo(valor, campo)).correo;
}

async function revisarCorreo(valor, campo = "tu correo") {
  const correo = texto(valor, campo, { max: 120, requerido: true }).toLowerCase();
  if (!FORMATO_CORREO.test(correo) || correo.includes("..") || correo.split("@")[0].length > 64) {
    throw new ErrorDeDatos("Escribe un correo válido, ej. nombre@gmail.com.");
  }
  const [nombre, dominio] = correo.split("@");
  const sugerido = sugerenciaDominio(dominio);
  const sugerencia = sugerido ? `${nombre}@${sugerido}` : null;
  if (!(await recibeCorreo(dominio))) {
    const error = new ErrorDeDatos(sugerencia
      ? `Ese dominio no recibe correos. ¿Quisiste decir ${sugerencia}?`
      : "Ese dominio no recibe correos. Revisa que esté bien escrito.");
    error.sugerencia = sugerencia;
    throw error;
  }
  return { correo, sugerencia };
}

// Teléfono con lada del país, guardado en formato internacional E.164 ("+525512345678")
const PAIS_POR_ISO = new Map(PAISES.map(p => [p.iso, p]));

function telefono(pais, numero) {
  const datos = PAIS_POR_ISO.get(typeof pais === "string" ? pais.toUpperCase() : "");
  if (!datos) throw new ErrorDeDatos("Elige el país de tu teléfono.");
  const digitos = typeof numero === "string" || typeof numero === "number" ? String(numero).replace(/\D/g, "") : "";
  if (!digitos) throw new ErrorDeDatos("Escribe tu número de teléfono.");
  if (!datos.largos.includes(digitos.length)) {
    const largos = datos.largos.join(" o ");
    throw new ErrorDeDatos(`El teléfono de ${datos.nombre} debe tener ${largos} dígitos (sin la lada +${datos.lada}).`);
  }
  return { pais: datos.iso, telefono: `+${datos.lada}${digitos}` };
}

// Envuelve rutas async para que los errores lleguen al manejador central
const handle = fn => (req, res, next) => fn(req, res, next).catch(err => {
  if (err instanceof ErrorDeDatos) {
    return res.status(400).json(err.sugerencia ? { error: err.message, sugerencia: err.sugerencia } : { error: err.message });
  }
  if (err instanceof ErrorHttp) return res.status(err.status).json({ error: err.message });
  // Violaciones de restricciones de la base que vienen de datos del usuario
  if (err.code === "23505") return res.status(409).json({ error: "Ya existe un registro con ese nombre." });
  if (err.code === "23503") return res.status(409).json({ error: "No se puede: otro registro depende de este." });
  next(err);
});

module.exports = {
  ErrorDeDatos, ErrorHttp, texto, idValido, idOpcional, entero, booleano, precio, opcion, fecha,
  slug, slugDe, numerosWhatsApp, numerosRespaldo, leerImagen, handle, MAX_IMAGEN_BYTES,
  usuarioValido, correoReal, revisarCorreo, telefono, PAISES
};
