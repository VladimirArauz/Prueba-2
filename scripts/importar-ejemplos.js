/**
 * Vuelve a cargar los productos y servicios de ejemplo (no duplica los que ya existen).
 * Uso: npm run importar
 */
const { pool, migrate } = require("../server/db");
const { importarEjemplos, importarServicios } = require("../server/ejemplos");

migrate()
  .then(() => importarEjemplos({ forzar: true }))
  .then(() => importarServicios({ forzar: true }))
  .catch(err => {
    console.error("No se pudo importar:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
