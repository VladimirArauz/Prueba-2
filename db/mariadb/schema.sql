-- =========================================================
-- NECUTLA — Esquema de base de datos (MariaDB 10.4 o más nuevo)
-- Para el hosting compartido de IONOS (plan 2026-10-25-migracion-ionos-php-mariadb).
-- Equivale a db/schema.sql (PostgreSQL) con estos cambios:
--   * Fechas en DATETIME(6) guardadas en UTC (la conexión usa time_zone = '+00:00').
--   * Arreglos de PostgreSQL (whatsapp, dias, totp_respaldo) pasan a JSON.
--   * BYTEA pasa a MEDIUMBLOB (hasta 16 MB; el servidor limita a 2 MB).
--   * Correos y usuarios usan utf8mb4_nopad_bin: comparan byte por byte, sin juntar acentos
--     ("josé" ≠ "jose") ni ignorar espacios al final. El servidor siempre los guarda y los busca
--     en minúsculas, así que lower(...) de los índices únicos de PostgreSQL ya no hace falta.
--     admins.usuario no se pasa a minúsculas para que "Axel" y "axel" sigan siendo cuentas
--     distintas (pendiente 22 de plans/MEMORIA.md).
--   * Sin índices parciales ni de trigramas: la búsqueda usa LIKE.
--   * La tabla "session" de connect-pg-simple se cambia por "sesiones" y se agrega
--     "limites" (contador de peticiones por IP, que en Node vivía en memoria).
-- Es idempotente: se puede correr varias veces sin error.
-- =========================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS stands (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre          VARCHAR(50) NOT NULL,
  creado_en       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  slug            VARCHAR(60) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  descripcion     VARCHAR(300) NOT NULL DEFAULT '',
  icono           VARCHAR(40) NOT NULL DEFAULT 'store',
  whatsapp        JSON NOT NULL DEFAULT '[]',
  orden           INT NOT NULL DEFAULT 0,
  visible         BOOLEAN NOT NULL DEFAULT TRUE,
  portada         MEDIUMBLOB,
  portada_tipo    VARCHAR(30),
  imagen_ruta     VARCHAR(200),
  actualizado_en  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY stands_nombre_idx (nombre),
  UNIQUE KEY stands_slug_idx (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subcategorias (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  stand_id  INT UNSIGNED NOT NULL,
  nombre    VARCHAR(60) NOT NULL,
  slug      VARCHAR(70) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  orden     INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY subcategorias_stand_slug_idx (stand_id, slug),
  CONSTRAINT subcategorias_stand_fk FOREIGN KEY (stand_id) REFERENCES stands (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS productos (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  stand_id         INT UNSIGNED NOT NULL,
  nombre           VARCHAR(120) NOT NULL,
  categoria        VARCHAR(60) NOT NULL DEFAULT 'General',
  precio           DECIMAL(10,2),
  disponibilidad   VARCHAR(20) NOT NULL DEFAULT 'Disponible',
  descripcion      VARCHAR(1000) NOT NULL DEFAULT '',
  imagen           MEDIUMBLOB,
  imagen_tipo      VARCHAR(30),
  creado_en        DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  actualizado_en   DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  tipo             VARCHAR(10) NOT NULL DEFAULT 'producto',
  subcategoria_id  INT UNSIGNED,
  precio_modo      VARCHAR(10) NOT NULL DEFAULT 'fijo',
  visible          BOOLEAN NOT NULL DEFAULT TRUE,
  orden            INT NOT NULL DEFAULT 0,
  imagen_ruta      VARCHAR(200),
  PRIMARY KEY (id),
  KEY productos_stand_idx (stand_id),
  KEY productos_subcategoria_idx (subcategoria_id),
  KEY productos_nombre_idx (nombre),
  CONSTRAINT productos_stand_fk FOREIGN KEY (stand_id) REFERENCES stands (id) ON DELETE RESTRICT,
  CONSTRAINT productos_subcategoria_fk FOREIGN KEY (subcategoria_id) REFERENCES subcategorias (id) ON DELETE SET NULL,
  CONSTRAINT productos_disponibilidad_check CHECK (disponibilidad IN ('Disponible', 'Pocas piezas', 'Por pedido')),
  CONSTRAINT productos_precio_valido CHECK (
    (precio_modo = 'cotizar' AND precio IS NULL) OR (precio_modo IN ('fijo', 'desde') AND precio > 0)),
  CONSTRAINT productos_tipo_valido CHECK (tipo IN ('producto', 'servicio'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admins (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario        VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_nopad_bin NOT NULL,
  password_hash  VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  creado_en      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  rol            VARCHAR(10) NOT NULL DEFAULT 'encargado',
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  totp_secreto   VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin,
  totp_activo    BOOLEAN NOT NULL DEFAULT FALSE,
  totp_ultimo    BIGINT,
  totp_respaldo  JSON NOT NULL DEFAULT '[]',
  correo         VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_nopad_bin,
  PRIMARY KEY (id),
  UNIQUE KEY admins_usuario_idx (usuario),
  UNIQUE KEY admins_correo_idx (correo),
  CONSTRAINT admins_rol_valido CHECK (rol IN ('dueno', 'encargado'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_stands (
  admin_id  INT UNSIGNED NOT NULL,
  stand_id  INT UNSIGNED NOT NULL,
  PRIMARY KEY (admin_id, stand_id),
  KEY admin_stands_stand_idx (stand_id),
  CONSTRAINT admin_stands_admin_fk FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE CASCADE,
  CONSTRAINT admin_stands_stand_fk FOREIGN KEY (stand_id) REFERENCES stands (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migraciones de datos que deben correr una sola vez
CREATE TABLE IF NOT EXISTS migraciones (
  nombre       VARCHAR(80) NOT NULL,
  aplicada_en  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ofertas de cada tienda: semanal (por días, 0 = domingo), temporada (por fechas) o remate
CREATE TABLE IF NOT EXISTS ofertas (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  stand_id         INT UNSIGNED NOT NULL,
  producto_id      INT UNSIGNED,
  subcategoria_id  INT UNSIGNED,
  titulo           VARCHAR(80) NOT NULL,
  descripcion      VARCHAR(300) NOT NULL DEFAULT '',
  tipo             VARCHAR(20) NOT NULL,
  valor            DECIMAL(10,2),
  dias             JSON NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
  activa           BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en        DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  clase            VARCHAR(10) NOT NULL DEFAULT 'semanal',
  temporada        VARCHAR(40),
  inicio           DATE,
  fin              DATE,
  piezas           SMALLINT,
  PRIMARY KEY (id),
  KEY ofertas_stand_idx (stand_id),
  KEY ofertas_producto_idx (producto_id),
  KEY ofertas_subcategoria_idx (subcategoria_id),
  CONSTRAINT ofertas_stand_fk FOREIGN KEY (stand_id) REFERENCES stands (id) ON DELETE CASCADE,
  CONSTRAINT ofertas_producto_fk FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE CASCADE,
  CONSTRAINT ofertas_subcategoria_fk FOREIGN KEY (subcategoria_id) REFERENCES subcategorias (id) ON DELETE CASCADE,
  CONSTRAINT ofertas_tipo_check CHECK (tipo IN ('porcentaje', 'precio_especial', 'dos_por_uno')),
  CONSTRAINT ofertas_clase_valida CHECK (
    clase = 'semanal'
    OR (clase = 'temporada' AND temporada IS NOT NULL AND inicio IS NOT NULL AND fin IS NOT NULL)
    OR clase = 'remate'),
  CONSTRAINT ofertas_fechas_validas CHECK (inicio IS NULL OR fin IS NULL OR fin >= inicio),
  CONSTRAINT ofertas_piezas_validas CHECK (piezas IS NULL OR piezas BETWEEN 1 AND 9999)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Promociones generales (paquetes de temporada)
CREATE TABLE IF NOT EXISTS promociones (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  titulo          VARCHAR(100) NOT NULL,
  descripcion     VARCHAR(600) NOT NULL DEFAULT '',
  precio          DECIMAL(10,2) NOT NULL,
  inicio          DATE NOT NULL,
  fin             DATE NOT NULL,
  destacada       BOOLEAN NOT NULL DEFAULT FALSE,
  activa          BOOLEAN NOT NULL DEFAULT TRUE,
  imagen          MEDIUMBLOB,
  imagen_tipo     VARCHAR(30),
  creado_en       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  actualizado_en  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT promociones_check CHECK (fin >= inicio),
  CONSTRAINT promociones_precio_check CHECK (precio > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promocion_items (
  promocion_id  INT UNSIGNED NOT NULL,
  producto_id   INT UNSIGNED NOT NULL,
  cantidad      SMALLINT NOT NULL DEFAULT 1,
  PRIMARY KEY (promocion_id, producto_id),
  KEY promocion_items_producto_idx (producto_id),
  CONSTRAINT promocion_items_promocion_fk FOREIGN KEY (promocion_id) REFERENCES promociones (id) ON DELETE CASCADE,
  CONSTRAINT promocion_items_producto_fk FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE CASCADE,
  CONSTRAINT promocion_items_cantidad_check CHECK (cantidad BETWEEN 1 AND 99)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cuentas de cliente (para opinar). El teléfono va en E.164 y nunca sale en la API.
CREATE TABLE IF NOT EXISTS clientes (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  correo          VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_nopad_bin NOT NULL,
  nombre          VARCHAR(60) NOT NULL,
  password_hash   VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  usuario         VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_nopad_bin,
  pais            CHAR(2) CHARACTER SET ascii COLLATE ascii_bin,
  telefono        VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin,
  sesion_version  INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY clientes_correo_idx (correo),
  UNIQUE KEY clientes_usuario_idx (usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Opiniones: una por cliente y producto
CREATE TABLE IF NOT EXISTS resenas (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  producto_id     INT UNSIGNED NOT NULL,
  cliente_id      INT UNSIGNED NOT NULL,
  calificacion    SMALLINT NOT NULL,
  comentario      VARCHAR(500) NOT NULL,
  respuesta       VARCHAR(500),
  respondida_en   DATETIME(6),
  visible         BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  actualizado_en  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY resenas_producto_cliente_idx (producto_id, cliente_id),
  KEY resenas_producto_idx (producto_id, visible),
  KEY resenas_cliente_idx (cliente_id),
  CONSTRAINT resenas_producto_fk FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE CASCADE,
  CONSTRAINT resenas_cliente_fk FOREIGN KEY (cliente_id) REFERENCES clientes (id) ON DELETE CASCADE,
  CONSTRAINT resenas_calificacion_check CHECK (calificacion BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pedidos enviados por WhatsApp: precios del servidor y sin datos del cliente
CREATE TABLE IF NOT EXISTS pedidos (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  stand_id        INT UNSIGNED,
  promocion_id    INT UNSIGNED,
  items           JSON NOT NULL,
  total           DECIMAL(10,2) NOT NULL,
  piezas          SMALLINT NOT NULL,
  estado          VARCHAR(12) NOT NULL DEFAULT 'en_proceso',
  nota            VARCHAR(200),
  creado_en       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  actualizado_en  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  huella          CHAR(64) CHARACTER SET ascii COLLATE ascii_bin,
  PRIMARY KEY (id),
  KEY pedidos_stand_fecha_idx (stand_id, creado_en),
  KEY pedidos_fecha_idx (creado_en),
  KEY pedidos_huella_idx (huella, creado_en),
  KEY pedidos_promocion_idx (promocion_id),
  CONSTRAINT pedidos_stand_fk FOREIGN KEY (stand_id) REFERENCES stands (id) ON DELETE SET NULL,
  CONSTRAINT pedidos_promocion_fk FOREIGN KEY (promocion_id) REFERENCES promociones (id) ON DELETE SET NULL,
  CONSTRAINT pedidos_estado_check2 CHECK (estado IN ('en_proceso', 'pagado', 'cancelado')),
  CONSTRAINT pedidos_piezas_check CHECK (piezas > 0),
  CONSTRAINT pedidos_total_check CHECK (total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Intentos fallidos por cuenta (login de admin y de cliente, contraseña actual, código de 2 pasos)
CREATE TABLE IF NOT EXISTS intentos_login (
  tipo             VARCHAR(12) NOT NULL,
  cuenta           VARCHAR(120) NOT NULL,
  fallos           SMALLINT NOT NULL DEFAULT 0,
  bloqueado_hasta  DATETIME(6),
  actualizado_en   DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (tipo, cuenta)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bitácora de Necutools
CREATE TABLE IF NOT EXISTS bitacora (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  creado_en    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  admin_id     INT UNSIGNED,
  usuario      VARCHAR(50) NOT NULL,
  accion       VARCHAR(20) NOT NULL,
  tabla        VARCHAR(30) NOT NULL,
  registro_id  INT,
  resumen      VARCHAR(200) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  KEY bitacora_fecha_idx (creado_en),
  KEY bitacora_admin_idx (admin_id, creado_en),
  CONSTRAINT bitacora_admin_fk FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Colores de un mismo producto: mismo precio y ofertas; cada color con su foto y disponibilidad
CREATE TABLE IF NOT EXISTS producto_colores (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  producto_id     INT UNSIGNED NOT NULL,
  nombre          VARCHAR(30) NOT NULL,
  hex             CHAR(7) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  imagen          MEDIUMBLOB,
  imagen_tipo     VARCHAR(30),
  disponible      BOOLEAN NOT NULL DEFAULT TRUE,
  orden           INT NOT NULL DEFAULT 0,
  creado_en       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  actualizado_en  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY producto_colores_nombre_idx (producto_id, nombre),
  KEY producto_colores_producto_idx (producto_id, orden),
  CONSTRAINT producto_colores_producto_fk FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE CASCADE,
  CONSTRAINT producto_colores_hex_check CHECK (hex REGEXP '^#[0-9a-f]{6}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Nuevas para el servidor en PHP ----------

-- Sesiones (app/sesiones.php). Reemplaza a la tabla "session" de connect-pg-simple; las sesiones de
-- Render no se copian: todos vuelven a iniciar sesión una vez. "id" es el SHA-256 de la cookie (si
-- alguien lee la base, no puede usar las sesiones). admin_id, pendiente_admin_id y cliente_id copian lo
-- que hay en "datos" para cerrar las sesiones de una cuenta sin leerlas todas.
CREATE TABLE IF NOT EXISTS sesiones (
  id                  CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  datos               MEDIUMTEXT NOT NULL,
  expira              DATETIME(6) NOT NULL,
  admin_id            INT UNSIGNED,
  pendiente_admin_id  INT UNSIGNED,
  cliente_id          INT UNSIGNED,
  PRIMARY KEY (id),
  KEY sesiones_expira_idx (expira),
  KEY sesiones_admin_idx (admin_id),
  KEY sesiones_pendiente_idx (pendiente_admin_id),
  KEY sesiones_cliente_idx (cliente_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Caché de 1 hora de "¿este dominio recibe correos?" (en Node vivía en memoria)
CREATE TABLE IF NOT EXISTS dns_correo (
  dominio  VARCHAR(255) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  ok       BOOLEAN NOT NULL,
  hasta    DATETIME NOT NULL,
  PRIMARY KEY (dominio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Límite de peticiones por IP y por regla (en Node lo llevaba express-rate-limit en memoria).
-- La IP se guarda como HMAC, no en claro.
CREATE TABLE IF NOT EXISTS limites (
  regla      VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  clave      CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  cuenta     INT UNSIGNED NOT NULL DEFAULT 0,
  reinicia   DATETIME NOT NULL,
  PRIMARY KEY (regla, clave),
  KEY limites_reinicia_idx (reinicia)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- 2026-10-26: pedidos con estados, edición y stock (plan 2026-10-26-pedidos-estados-y-stock.md) ----------

-- Stock por producto y por color. NULL = falta capturarlo (se trata como agotado). Los servicios no llevan.
ALTER TABLE productos ADD COLUMN IF NOT EXISTS stock INT NULL AFTER disponibilidad;
ALTER TABLE productos ADD CONSTRAINT IF NOT EXISTS productos_stock_check CHECK (stock IS NULL OR stock >= 0);
ALTER TABLE producto_colores ADD COLUMN IF NOT EXISTS stock INT NULL AFTER disponible;
ALTER TABLE producto_colores ADD CONSTRAINT IF NOT EXISTS producto_colores_stock_check CHECK (stock IS NULL OR stock >= 0);

-- Estados: pendiente → en_proceso, vendido → pagado
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_check;
UPDATE pedidos SET estado = 'en_proceso' WHERE estado = 'pendiente';
UPDATE pedidos SET estado = 'pagado' WHERE estado = 'vendido';
ALTER TABLE pedidos ALTER COLUMN estado SET DEFAULT 'en_proceso';
ALTER TABLE pedidos ADD CONSTRAINT IF NOT EXISTS pedidos_estado_check2 CHECK (estado IN ('en_proceso', 'pagado', 'cancelado'));

-- Artículos de cada pedido (se editan mientras el pedido está en proceso). pedidos.items se sigue llenando.
CREATE TABLE IF NOT EXISTS pedido_items (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  pedido_id     INT UNSIGNED NOT NULL,
  tipo          VARCHAR(10) NOT NULL,
  producto_id   INT UNSIGNED,
  color_id      INT UNSIGNED,
  promocion_id  INT UNSIGNED,
  nombre        VARCHAR(160) NOT NULL,
  cantidad      SMALLINT NOT NULL,
  precio        DECIMAL(10,2),
  subtotal      DECIMAL(10,2),
  orden         SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY pedido_items_pedido_idx (pedido_id, orden),
  KEY pedido_items_producto_idx (producto_id),
  KEY pedido_items_color_idx (color_id),
  KEY pedido_items_promocion_idx (promocion_id),
  CONSTRAINT pedido_items_pedido_fk FOREIGN KEY (pedido_id) REFERENCES pedidos (id) ON DELETE CASCADE,
  CONSTRAINT pedido_items_producto_fk FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE SET NULL,
  CONSTRAINT pedido_items_color_fk FOREIGN KEY (color_id) REFERENCES producto_colores (id) ON DELETE SET NULL,
  CONSTRAINT pedido_items_promocion_fk FOREIGN KEY (promocion_id) REFERENCES promociones (id) ON DELETE SET NULL,
  CONSTRAINT pedido_items_tipo_check CHECK (tipo IN ('producto', 'paquete')),
  CONSTRAINT pedido_items_cantidad_check CHECK (cantidad BETWEEN 1 AND 30)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Color elegido para cada producto con colores dentro de un paquete
CREATE TABLE IF NOT EXISTS pedido_paquete_colores (
  pedido_item_id  INT UNSIGNED NOT NULL,
  producto_id     INT UNSIGNED NOT NULL,
  color_id        INT UNSIGNED NOT NULL,
  PRIMARY KEY (pedido_item_id, producto_id),
  KEY pedido_paquete_colores_color_idx (color_id),
  KEY pedido_paquete_colores_producto_idx (producto_id),
  CONSTRAINT pedido_paquete_colores_item_fk FOREIGN KEY (pedido_item_id) REFERENCES pedido_items (id) ON DELETE CASCADE,
  CONSTRAINT pedido_paquete_colores_producto_fk FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE CASCADE,
  CONSTRAINT pedido_paquete_colores_color_fk FOREIGN KEY (color_id) REFERENCES producto_colores (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cada cambio de stock: pago de un pedido (−), reversa al regresarlo (+) o ajuste a mano en Necutools.
-- Al regresar un pedido se devuelve la suma de sus movimientos, aunque el pedido se haya editado.
CREATE TABLE IF NOT EXISTS movimientos_stock (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  producto_id  INT UNSIGNED NOT NULL,
  color_id     INT UNSIGNED,
  pedido_id    INT UNSIGNED,
  cambio       INT NOT NULL,
  motivo       VARCHAR(10) NOT NULL,
  admin_id     INT UNSIGNED,
  creado_en    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY movimientos_stock_pedido_idx (pedido_id),
  KEY movimientos_stock_producto_idx (producto_id, creado_en),
  KEY movimientos_stock_color_idx (color_id),
  KEY movimientos_stock_admin_idx (admin_id),
  CONSTRAINT movimientos_stock_producto_fk FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE CASCADE,
  CONSTRAINT movimientos_stock_color_fk FOREIGN KEY (color_id) REFERENCES producto_colores (id) ON DELETE SET NULL,
  CONSTRAINT movimientos_stock_pedido_fk FOREIGN KEY (pedido_id) REFERENCES pedidos (id) ON DELETE SET NULL,
  CONSTRAINT movimientos_stock_admin_fk FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE SET NULL,
  CONSTRAINT movimientos_stock_motivo_check CHECK (motivo IN ('pago', 'reversa', 'ajuste')),
  CONSTRAINT movimientos_stock_cambio_check CHECK (cambio <> 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Una sola vez: los artículos del JSON de cada pedido pasan a pedido_items (máximo 15 por pedido).
-- Sin JSON_TABLE para que sirva también en MariaDB 10.4.
INSERT INTO pedido_items (pedido_id, tipo, producto_id, color_id, promocion_id, nombre, cantidad, precio, subtotal, orden)
SELECT pe.id, x.tipo,
       IF(x.tipo = 'producto', (SELECT p.id FROM productos p WHERE p.id = x.ref), NULL),
       IF(x.tipo = 'producto', (SELECT c.id FROM producto_colores c WHERE c.id = x.color AND c.producto_id = x.ref), NULL),
       IF(x.tipo = 'paquete', (SELECT pr.id FROM promociones pr WHERE pr.id = x.ref), NULL),
       LEFT(x.nombre, 160), LEAST(GREATEST(x.cantidad, 1), 30),
       IF(x.subtotal IS NULL, NULL, ROUND(x.subtotal / GREATEST(x.cantidad, 1), 2)), x.subtotal, x.i
FROM pedidos pe
JOIN (
  SELECT pe2.id AS pedido, n.i,
         JSON_UNQUOTE(JSON_EXTRACT(pe2.items, CONCAT('$[', n.i, '].tipo'))) AS tipo,
         CAST(JSON_EXTRACT(pe2.items, CONCAT('$[', n.i, '].id')) AS UNSIGNED) AS ref,
         CAST(NULLIF(JSON_EXTRACT(pe2.items, CONCAT('$[', n.i, '].color')), 'null') AS UNSIGNED) AS color,
         JSON_UNQUOTE(JSON_EXTRACT(pe2.items, CONCAT('$[', n.i, '].nombre'))) AS nombre,
         CAST(JSON_EXTRACT(pe2.items, CONCAT('$[', n.i, '].cantidad')) AS SIGNED) AS cantidad,
         CAST(NULLIF(JSON_EXTRACT(pe2.items, CONCAT('$[', n.i, '].subtotal')), 'null') AS DECIMAL(10,2)) AS subtotal
  FROM pedidos pe2
  JOIN (SELECT 0 AS i UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
        UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10
        UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14) n
    ON n.i < JSON_LENGTH(pe2.items)
) x ON x.pedido = pe.id
WHERE x.tipo IN ('producto', 'paquete')
  AND NOT EXISTS (SELECT 1 FROM migraciones WHERE nombre = 'pedido-items-2026-10-26')
  AND NOT EXISTS (SELECT 1 FROM pedido_items pi WHERE pi.pedido_id = pe.id);
INSERT IGNORE INTO migraciones (nombre) VALUES ('pedido-items-2026-10-26');

-- Códigos de verificación por correo de las cuentas de cliente (plan 2026-10-30-codigo-por-correo-y-sesion-permanente).
-- Uno vivo por correo y propósito; el código se guarda como HMAC. En un registro pendiente, `datos` lleva el nombre,
-- usuario, país, teléfono y el hash bcrypt de la contraseña (nunca la contraseña en claro).
CREATE TABLE IF NOT EXISTS codigos_correo (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  proposito    VARCHAR(12) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  correo       VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_nopad_bin NOT NULL,
  cliente_id   INT UNSIGNED,
  codigo_hash  CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  datos        MEDIUMTEXT,
  intentos     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  enviados     TINYINT UNSIGNED NOT NULL DEFAULT 1,
  enviado_en   DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  expira       DATETIME(6) NOT NULL,
  usado_en     DATETIME(6),
  creado_en    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY codigos_correo_proposito_idx (correo, proposito),
  KEY codigos_correo_creado_idx (creado_en),
  CONSTRAINT codigos_correo_proposito_check CHECK (proposito IN ('login', 'registro', 'restablecer'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
