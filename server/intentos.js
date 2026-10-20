/**
 * Límite de intentos por cuenta (además del límite por IP de express-rate-limit).
 * 10 fallos seguidos en 15 minutos frenan la cuenta 15 minutos, vengan de la IP que vengan.
 * Se cuenta igual si la cuenta no existe, para no revelar cuáles existen.
 * Se guarda en la base para que sobreviva a los reinicios del servidor.
 */
const { pool } = require("./db");
const { ErrorHttp } = require("./validar");

const MAX_FALLOS = 10;
const VENTANA = "15 minutes";

const clave = cuenta => String(cuenta).trim().toLowerCase().slice(0, 120);

// Lanza 429 si la cuenta está frenada
async function exigirNoFrenada(tipo, cuenta) {
  const { rows } = await pool.query(
    "SELECT 1 FROM intentos_login WHERE tipo = $1 AND cuenta = $2 AND bloqueado_hasta > now()", [tipo, clave(cuenta)]);
  if (rows[0]) throw new ErrorHttp(429, "Demasiados intentos fallidos con esta cuenta. Espera 15 minutos y vuelve a intentar.");
}

async function registrarFallo(tipo, cuenta) {
  await pool.query(
    `INSERT INTO intentos_login (tipo, cuenta, fallos) VALUES ($1, $2, 1)
     ON CONFLICT (tipo, cuenta) DO UPDATE SET
       fallos = CASE WHEN intentos_login.actualizado_en < now() - $3::interval THEN 1 ELSE intentos_login.fallos + 1 END,
       bloqueado_hasta = CASE
         WHEN intentos_login.actualizado_en >= now() - $3::interval AND intentos_login.fallos + 1 >= $4 THEN now() + $3::interval
         ELSE intentos_login.bloqueado_hasta END,
       actualizado_en = now()`,
    [tipo, clave(cuenta), VENTANA, MAX_FALLOS]);
}

async function limpiarFallos(tipo, cuenta) {
  await pool.query("DELETE FROM intentos_login WHERE tipo = $1 AND cuenta = $2", [tipo, clave(cuenta)]);
}

// Borra lo viejo de vez en cuando para que la tabla no crezca
async function limpiarViejos() {
  await pool.query("DELETE FROM intentos_login WHERE actualizado_en < now() - interval '1 day'");
}

module.exports = { exigirNoFrenada, registrarFallo, limpiarFallos, limpiarViejos };
