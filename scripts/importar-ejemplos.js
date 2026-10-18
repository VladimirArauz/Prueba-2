/**
 * Vuelve a cargar los productos de ejemplo (no duplica los que ya existen).
 * Uso: npm run importar
 */
const { pool, migrate } = require("../server/db");
const { importarEjemplos } = require("../server/ejemplos");

migrate()
  .then(() => importarEjemplos({ forzar: true }))
  .catch(err => {
    console.error("No se pudo importar:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
