/**
 * Conexión a PostgreSQL y migración del esquema al arrancar.
 */
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("Falta la variable DATABASE_URL. Copia .env.example a .env y complétala.");
}

// En Render, la "Internal Database URL" no sale a internet y no usa SSL. Para conectarte desde fuera
// (tu computadora, la "External Database URL") pon DATABASE_SSL=true: cifra y verifica el certificado,
// así nadie en medio puede hacerse pasar por la base y leer la contraseña.
// DATABASE_SSL=no-verify cifra sin verificar: solo si el certificado del proveedor no lo reconoce Node.
const SSL = { true: { rejectUnauthorized: true }, "no-verify": { rejectUnauthorized: false } };
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: SSL[process.env.DATABASE_SSL] || false,
  max: 10
});

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8");
  await pool.query(sql);
}

module.exports = { pool, migrate };
