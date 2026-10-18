/**
 * Validación compartida por la API pública y la de administración.
 */

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

// Envuelve rutas async para que los errores lleguen al manejador central
const handle = fn => (req, res, next) => fn(req, res, next).catch(err => {
  if (err instanceof ErrorDeDatos) return res.status(400).json({ error: err.message });
  if (err instanceof ErrorHttp) return res.status(err.status).json({ error: err.message });
  // Violaciones de restricciones de la base que vienen de datos del usuario
  if (err.code === "23505") return res.status(409).json({ error: "Ya existe un registro con ese nombre." });
  if (err.code === "23503") return res.status(409).json({ error: "No se puede: otro registro depende de este." });
  next(err);
});

module.exports = {
  ErrorDeDatos, ErrorHttp, texto, idValido, idOpcional, entero, booleano, precio, opcion, fecha,
  slug, slugDe, numerosWhatsApp, numerosRespaldo, leerImagen, handle, MAX_IMAGEN_BYTES
};
