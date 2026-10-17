-- =========================================================
-- NECUTLA — Esquema de base de datos (PostgreSQL)
-- Es idempotente: el servidor lo ejecuta en cada arranque.
-- Para cambios futuros, agregar sentencias que se puedan
-- repetir sin error (IF NOT EXISTS, ON CONFLICT, etc.).
-- =========================================================

CREATE TABLE IF NOT EXISTS stands (
  id         SERIAL PRIMARY KEY,
  nombre     VARCHAR(50) NOT NULL UNIQUE,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS productos (
  id              SERIAL PRIMARY KEY,
  stand_id        INTEGER NOT NULL REFERENCES stands(id) ON DELETE RESTRICT,
  nombre          VARCHAR(120) NOT NULL,
  categoria       VARCHAR(60) NOT NULL DEFAULT 'General',
  precio          NUMERIC(10, 2) NOT NULL CHECK (precio > 0),
  disponibilidad  VARCHAR(20) NOT NULL DEFAULT 'Disponible'
                  CHECK (disponibilidad IN ('Disponible', 'Pocas piezas', 'Por pedido')),
  descripcion     VARCHAR(1000) NOT NULL DEFAULT '',
  imagen          BYTEA,
  imagen_tipo     VARCHAR(30),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS productos_stand_idx ON productos (stand_id);

CREATE TABLE IF NOT EXISTS admins (
  id             SERIAL PRIMARY KEY,
  usuario        VARCHAR(50) NOT NULL UNIQUE,
  password_hash  VARCHAR(100) NOT NULL,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sesiones de administración (formato de connect-pg-simple)
CREATE TABLE IF NOT EXISTS "session" (
  sid     VARCHAR NOT NULL PRIMARY KEY,
  sess    JSON NOT NULL,
  expire  TIMESTAMP(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" (expire);

-- Stands iniciales (las 7 tiendas del sitio)
INSERT INTO stands (nombre) VALUES
  ('Ropa'), ('Tecnología'), ('Dulces'), ('Propaganda'), ('Papelería'), ('Regalos'), ('Otra')
ON CONFLICT (nombre) DO NOTHING;
