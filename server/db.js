/**
 * Conexión a PostgreSQL y migración del esquema al arrancar.
 */
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("Falta la variable DATABASE_URL. Copia .env.example a .env y complétala.");
}

// En Render, la "Internal Database URL" no usa SSL. Para conectarte desde fuera
// (tu computadora, la "External Database URL") pon DATABASE_SSL=true.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
  max: 10
});

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8");
  await pool.query(sql);
}

module.exports = { pool, migrate };
