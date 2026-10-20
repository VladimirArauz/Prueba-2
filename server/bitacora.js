/**
 * Bitácora de Necutools: quién hizo qué y cuándo. Sin contraseñas, imágenes ni datos de clientes.
 * Si no se puede anotar, la acción sigue (solo queda el error en los logs).
 */
const { pool } = require("./db");

async function anotar(admin, accion, tabla, registroId, resumen = "") {
  try {
    await pool.query(
      "INSERT INTO bitacora (admin_id, usuario, accion, tabla, registro_id, resumen) VALUES ($1, $2, $3, $4, $5, $6)",
      [admin.id, admin.usuario, accion, tabla, registroId ?? null, String(resumen).slice(0, 200)]);
  } catch (err) {
    console.error("No se pudo anotar en la bitácora:", err.message);
  }
}

module.exports = { anotar };
