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


-- =========================================================
-- Catálogo de varias tiendas (plan 2026-10-17-catalogo-multitienda)
-- =========================================================

-- Migraciones de datos que deben correr una sola vez
CREATE TABLE IF NOT EXISTS migraciones (
  nombre       VARCHAR(80) PRIMARY KEY,
  aplicada_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Texto → slug para URLs ("Papelería Fer" → "papeleria-fer")
CREATE OR REPLACE FUNCTION necutla_slug(valor TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(both '-' from regexp_replace(
    translate(lower(valor), 'áéíóúüñàèìòù', 'aeiouunaeiou'), '[^a-z0-9]+', '-', 'g'))
$$;

-- ---------- Tiendas ----------
ALTER TABLE stands ADD COLUMN IF NOT EXISTS slug VARCHAR(60);
ALTER TABLE stands ADD COLUMN IF NOT EXISTS descripcion VARCHAR(300) NOT NULL DEFAULT '';
ALTER TABLE stands ADD COLUMN IF NOT EXISTS icono VARCHAR(40) NOT NULL DEFAULT 'store';
ALTER TABLE stands ADD COLUMN IF NOT EXISTS whatsapp TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE stands ADD COLUMN IF NOT EXISTS orden INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stands ADD COLUMN IF NOT EXISTS visible BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE stands ADD COLUMN IF NOT EXISTS portada BYTEA;
ALTER TABLE stands ADD COLUMN IF NOT EXISTS portada_tipo VARCHAR(30);
ALTER TABLE stands ADD COLUMN IF NOT EXISTS imagen_ruta VARCHAR(200);
ALTER TABLE stands ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now();

-- Slug para las tiendas que no tienen (si se repite, se le agrega el id)
UPDATE stands s SET slug = CASE
    WHEN EXISTS (SELECT 1 FROM stands o WHERE o.id <> s.id AND (o.slug = necutla_slug(s.nombre)
                 OR (o.slug IS NULL AND o.id < s.id AND necutla_slug(o.nombre) = necutla_slug(s.nombre))))
      OR necutla_slug(s.nombre) = ''
    THEN trim(both '-' from necutla_slug(s.nombre) || '-' || s.id)
    ELSE necutla_slug(s.nombre) END
WHERE s.slug IS NULL;
ALTER TABLE stands ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS stands_slug_idx ON stands (slug);

-- Tiendas iniciales (las 7 del sitio original)
INSERT INTO stands (nombre, slug) VALUES
  ('Ropa', 'ropa'), ('Tecnología', 'tecnologia'), ('Dulces', 'dulces'), ('Propaganda', 'propaganda'),
  ('Papelería', 'papeleria'), ('Regalos', 'regalos'), ('Otra', 'otra')
ON CONFLICT DO NOTHING;

-- ---------- Subcategorías de cada tienda ----------
CREATE TABLE IF NOT EXISTS subcategorias (
  id        SERIAL PRIMARY KEY,
  stand_id  INTEGER NOT NULL REFERENCES stands(id) ON DELETE CASCADE,
  nombre    VARCHAR(60) NOT NULL,
  slug      VARCHAR(70) NOT NULL,
  orden     INTEGER NOT NULL DEFAULT 0,
  UNIQUE (stand_id, slug)
);

-- ---------- Productos y servicios ----------
ALTER TABLE productos ADD COLUMN IF NOT EXISTS tipo VARCHAR(10) NOT NULL DEFAULT 'producto';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS subcategoria_id INTEGER REFERENCES subcategorias(id) ON DELETE SET NULL;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_modo VARCHAR(10) NOT NULL DEFAULT 'fijo';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS visible BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS orden INTEGER NOT NULL DEFAULT 0;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS imagen_ruta VARCHAR(200);
ALTER TABLE productos ALTER COLUMN precio DROP NOT NULL;
ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_precio_check;
ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_precio_valido;
ALTER TABLE productos ADD CONSTRAINT productos_precio_valido CHECK (
  (precio_modo = 'cotizar' AND precio IS NULL) OR (precio_modo IN ('fijo', 'desde') AND precio > 0));
ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_tipo_valido;
ALTER TABLE productos ADD CONSTRAINT productos_tipo_valido CHECK (tipo IN ('producto', 'servicio'));
CREATE INDEX IF NOT EXISTS productos_subcategoria_idx ON productos (subcategoria_id);

-- Búsqueda por nombre: índice de trigramas si la base lo permite (si no, se busca sin índice)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX IF NOT EXISTS productos_nombre_trgm_idx ON productos USING gin (lower(nombre) gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Búsqueda sin índice de trigramas: %', SQLERRM;
END $$;

-- ---------- Ofertas de cada tienda (se repiten por día de la semana) ----------
CREATE TABLE IF NOT EXISTS ofertas (
  id               SERIAL PRIMARY KEY,
  stand_id         INTEGER NOT NULL REFERENCES stands(id) ON DELETE CASCADE,
  producto_id      INTEGER REFERENCES productos(id) ON DELETE CASCADE,
  subcategoria_id  INTEGER REFERENCES subcategorias(id) ON DELETE CASCADE,
  titulo           VARCHAR(80) NOT NULL,
  descripcion      VARCHAR(300) NOT NULL DEFAULT '',
  tipo             VARCHAR(20) NOT NULL CHECK (tipo IN ('porcentaje', 'precio_especial', 'dos_por_uno')),
  valor            NUMERIC(10, 2),
  dias             SMALLINT[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',  -- 0 = domingo
  activa           BOOLEAN NOT NULL DEFAULT true,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ofertas_stand_idx ON ofertas (stand_id);

-- ---------- Promociones generales (paquetes de temporada) ----------
CREATE TABLE IF NOT EXISTS promociones (
  id              SERIAL PRIMARY KEY,
  titulo          VARCHAR(100) NOT NULL,
  descripcion     VARCHAR(600) NOT NULL DEFAULT '',
  precio          NUMERIC(10, 2) NOT NULL CHECK (precio > 0),
  inicio          DATE NOT NULL,
  fin             DATE NOT NULL CHECK (fin >= inicio),
  destacada       BOOLEAN NOT NULL DEFAULT false,
  activa          BOOLEAN NOT NULL DEFAULT true,
  imagen          BYTEA,
  imagen_tipo     VARCHAR(30),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS promocion_items (
  promocion_id  INTEGER NOT NULL REFERENCES promociones(id) ON DELETE CASCADE,
  producto_id   INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  cantidad      SMALLINT NOT NULL DEFAULT 1 CHECK (cantidad BETWEEN 1 AND 99),
  PRIMARY KEY (promocion_id, producto_id)
);

-- ---------- Usuarios de Necutools: dueños y encargados ----------
ALTER TABLE admins ADD COLUMN IF NOT EXISTS rol VARCHAR(10) NOT NULL DEFAULT 'encargado';
ALTER TABLE admins ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE admins DROP CONSTRAINT IF EXISTS admins_rol_valido;
ALTER TABLE admins ADD CONSTRAINT admins_rol_valido CHECK (rol IN ('dueno', 'encargado'));

CREATE TABLE IF NOT EXISTS admin_stands (
  admin_id  INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  stand_id  INTEGER NOT NULL REFERENCES stands(id) ON DELETE CASCADE,
  PRIMARY KEY (admin_id, stand_id)
);

-- ---------- Datos que se acomodan una sola vez ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM migraciones WHERE nombre = '2026-10-17-multitienda') THEN
    -- Los admins que ya existían son dueños
    UPDATE admins SET rol = 'dueno';

    -- Datos de las 7 tiendas originales
    UPDATE stands s SET slug = v.slug, descripcion = v.descripcion, icono = v.icono,
           orden = v.orden, imagen_ruta = v.imagen
    FROM (VALUES
      ('Ropa', 'ropa', 'Playeras, sudaderas, pantalones y prendas para estudiantes.', 'shirt', 1, '/imagenes/ropa.svg'),
      ('Tecnología', 'tecnologia', 'Cables, audífonos, cargadores, micas y accesorios para tus clases.', 'cpu', 2, '/imagenes/tecnologia.svg'),
      ('Dulces', 'dulces', 'Botanas, chocolates, gomitas y antojos para las horas de estudio.', 'candy', 3, '/imagenes/dulces.svg'),
      ('Propaganda', 'propaganda', 'Volantes, stickers, lonas e impresiones para tus proyectos y eventos.', 'megaphone', 4, '/imagenes/propaganda.svg'),
      ('Papelería', 'papeleria', 'Cuadernos, plumas, juegos geométricos y material escolar.', 'pencil-ruler', 5, '/imagenes/papeleria.svg'),
      ('Regalos', 'regalos', 'Tazas, peluches y detalles para fechas especiales.', 'gift', 6, '/imagenes/regalos.svg'),
      ('Otra', 'otra', 'Artículos de temporada y productos de la comunidad.', 'shapes', 7, '/imagenes/otra.svg')
    ) AS v(nombre, slug, descripcion, icono, orden, imagen)
    WHERE s.nombre = v.nombre
      AND NOT EXISTS (SELECT 1 FROM stands o WHERE o.slug = v.slug AND o.id <> s.id);

    -- Las tiendas creadas después van al final
    UPDATE stands SET orden = 100 + id WHERE orden = 0;

    -- El texto de "categoria" pasa a ser una subcategoría de verdad
    INSERT INTO subcategorias (stand_id, nombre, slug)
    SELECT DISTINCT ON (stand_id, necutla_slug(categoria)) stand_id, categoria, necutla_slug(categoria)
    FROM productos
    WHERE categoria <> 'General' AND necutla_slug(categoria) <> ''
    ON CONFLICT (stand_id, slug) DO NOTHING;

    UPDATE productos p SET subcategoria_id = sc.id
    FROM subcategorias sc
    WHERE p.subcategoria_id IS NULL AND sc.stand_id = p.stand_id AND sc.slug = necutla_slug(p.categoria);

    INSERT INTO migraciones (nombre) VALUES ('2026-10-17-multitienda');
  END IF;
END $$;
