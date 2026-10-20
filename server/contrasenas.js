/**
 * Reglas para contraseñas nuevas (admins y clientes). Las cuentas que ya existen siguen entrando igual.
 */
const { ErrorDeDatos } = require("./validar");

// bcrypt solo usa los primeros 72 bytes: más largo daría una falsa sensación de seguridad
const MAX_BYTES = 72;

// Las más usadas que cumplen el largo mínimo (listas públicas de contraseñas filtradas y variantes en español)
const COMUNES = new Set([
  "1234567890", "12345678910", "123456789a", "1234567890a", "0987654321", "1111111111", "0000000000", "1234512345",
  "qwertyuiop", "qwerty1234", "qwerty12345", "1q2w3e4r5t", "1qaz2wsx3edc", "asdfghjkl1", "asdfghjkl;", "zxcvbnm123",
  "password12", "password123", "password1234", "passw0rd123", "contraseña", "contraseña1", "contraseña12", "contraseña123",
  "contrasena", "contrasena1", "contrasena12", "contrasena123", "iloveyou12", "teamo12345", "teamo123456", "mexico1234",
  "mexico12345", "necutla123", "necutla1234", "necutla12345", "estudiante1", "estudiante123", "abcdefghij", "abc1234567",
  "abcd123456", "superman123", "batman12345", "football123", "princesa123", "chocolate1", "chocolate123", "administrador",
  "administrator", "admin12345", "admin123456", "welcome123", "bienvenido1", "bienvenido123", "changeme123", "cambiame123"
]);

function validarContrasena(valor, { minimo, campo = "La contraseña", contiene = [] }) {
  if (typeof valor !== "string" || valor.length < minimo) {
    throw new ErrorDeDatos(`${campo} debe tener ${minimo} caracteres o más.`);
  }
  if (Buffer.byteLength(valor, "utf8") > MAX_BYTES) {
    throw new ErrorDeDatos(`${campo} es demasiado larga: usa hasta ${MAX_BYTES} letras (menos si llevan acentos).`);
  }
  const minus = valor.toLowerCase();
  if (COMUNES.has(minus) || new Set(minus).size < 4) {
    throw new ErrorDeDatos(`${campo} es de las más usadas y fáciles de adivinar. Elige otra.`);
  }
  for (const dato of contiene) {
    if (dato && dato.length >= 3 && minus.includes(dato.toLowerCase())) {
      throw new ErrorDeDatos(`${campo} no puede llevar tu usuario o tu correo.`);
    }
  }
  return valor;
}

module.exports = { validarContrasena, MAX_BYTES };
