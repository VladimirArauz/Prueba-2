/**
 * Carga los productos de ejemplo de db/ejemplos.json (los que antes estaban escritos
 * a mano en las páginas de cada tienda). Corre sola una vez al arrancar; se puede
 * repetir con `npm run importar` y no duplica nada.
 */
const fs = require("fs");
const path = require("path");
const { pool } = require("./db");

const MIGRACION = "ejemplos-2026-10-17";
const RUTA_VALIDA = /^\/imagenes\/ejemplos\/[a-z0-9-]+\/[a-z0-9-]+\.(svg|png|jpe?g|webp)$/;

async function importarEjemplos({ forzar = false } = {}) {
  if (!forzar) {
    const { rows } = await pool.query("SELECT 1 FROM migraciones WHERE nombre = $1", [MIGRACION]);
    if (rows[0]) return;
  }
  const tiendas = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "db", "ejemplos.json"), "utf8"));
  const cliente = await pool.connect();
  let nuevos = 0;
  try {
    await cliente.query("BEGIN");
    for (const tienda of tiendas) {
      const { rows } = await cliente.query("SELECT id FROM stands WHERE slug = $1", [tienda.tienda]);
      if (!rows[0]) continue; // la tienda se borró o cambió de dirección
      const standId = rows[0].id;

      for (const sub of tienda.subcategorias) {
        await cliente.query(
          "INSERT INTO subcategorias (stand_id, nombre, slug, orden) VALUES ($1, $2, $3, $4) ON CONFLICT (stand_id, slug) DO NOTHING",
          [standId, sub.nombre, sub.slug, sub.orden]);
      }
      for (const p of tienda.productos) {
        const imagen = p.imagen_ruta && RUTA_VALIDA.test(p.imagen_ruta) ? p.imagen_ruta : null;
        const { rowCount } = await cliente.query(
          `INSERT INTO productos (stand_id, subcategoria_id, nombre, categoria, precio, descripcion, orden, imagen_ruta)
           SELECT $1::int, sc.id, $3::text, COALESCE(sc.nombre, 'General'), $4::numeric, $5::text, $6::int, $7::text
           FROM (SELECT 1) x LEFT JOIN subcategorias sc ON sc.stand_id = $1::int AND sc.slug = $2::text
           WHERE NOT EXISTS (SELECT 1 FROM productos WHERE stand_id = $1::int AND nombre = $3::text)`,
          [standId, p.subcategoria, p.nombre, p.precio, p.descripcion, p.orden, imagen]);
        nuevos += rowCount;
      }
    }
    await cliente.query("INSERT INTO migraciones (nombre) VALUES ($1) ON CONFLICT DO NOTHING", [MIGRACION]);
    await cliente.query("COMMIT");
  } catch (err) {
    await cliente.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    cliente.release();
  }
  console.log(`Productos de ejemplo importados: ${nuevos}`);
}

module.exports = { importarEjemplos };
