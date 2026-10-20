/**
 * Verificación en dos pasos (TOTP, RFC 6238) con crypto de Node: la usan Google Authenticator,
 * Microsoft Authenticator y similares. SHA-1, 6 dígitos, cada 30 segundos.
 */
const crypto = require("crypto");

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PERIODO = 30;

function aBase32(buffer) {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let salida = "";
  for (let i = 0; i < bits.length; i += 5) salida += BASE32[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return salida;
}

function deBase32(texto) {
  let bits = "";
  for (const letra of texto.replace(/=+$/, "").toUpperCase()) {
    const valor = BASE32.indexOf(letra);
    if (valor < 0) throw new Error("Clave base32 inválida");
    bits += valor.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

const generarSecreto = () => aBase32(crypto.randomBytes(20));

const pasoActual = () => Math.floor(Date.now() / 1000 / PERIODO);

function codigoDe(secreto, paso) {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(paso));
  const hmac = crypto.createHmac("sha1", deBase32(secreto)).update(contador).digest();
  const corte = hmac[hmac.length - 1] & 0x0f;
  const numero = (hmac.readUInt32BE(corte) & 0x7fffffff) % 1000000;
  return String(numero).padStart(6, "0");
}

// Devuelve el paso aceptado (para no aceptar el mismo código dos veces) o null.
// Acepta el código anterior y el siguiente por si el reloj del celular va un poco desfasado.
function verificarCodigo(secreto, codigo, ultimoPaso = null) {
  if (typeof codigo !== "string" || !/^[0-9]{6}$/.test(codigo)) return null;
  const ahora = pasoActual();
  for (const paso of [ahora - 1, ahora, ahora + 1]) {
    if (ultimoPaso !== null && paso <= Number(ultimoPaso)) continue;
    if (crypto.timingSafeEqual(Buffer.from(codigoDe(secreto, paso)), Buffer.from(codigo))) return paso;
  }
  return null;
}

const enlace = (usuario, secreto) =>
  `otpauth://totp/Necutla:${encodeURIComponent(usuario)}?secret=${secreto}&issuer=Necutla&algorithm=SHA1&digits=6&period=${PERIODO}`;

// Códigos de respaldo de un solo uso: "abcde-fghij". Se guarda solo su hash.
function generarRespaldo(cantidad = 8) {
  return Array.from({ length: cantidad }, () => {
    const t = aBase32(crypto.randomBytes(7)).toLowerCase().slice(0, 10);
    return `${t.slice(0, 5)}-${t.slice(5)}`;
  });
}
const hashRespaldo = codigo => crypto.createHash("sha256").update(String(codigo).trim().toLowerCase().replace(/\s/g, "")).digest("hex");

module.exports = { generarSecreto, verificarCodigo, codigoDe, pasoActual, enlace, generarRespaldo, hashRespaldo };
