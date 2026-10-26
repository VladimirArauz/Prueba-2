<?php
/**
 * API de Necutools (/api/admin): todo requiere sesión.
 * Dueños: todo. Encargados: solo las tiendas que tienen asignadas.
 */

const DISPONIBILIDAD = ['Disponible', 'Pocas piezas', 'Por pedido'];
const TIPOS_PRODUCTO = ['producto', 'servicio'];
const PRECIO_MODOS = ['fijo', 'desde', 'cotizar'];
const TIPOS_OFERTA = ['porcentaje', 'precio_especial', 'dos_por_uno'];
const CLASES_OFERTA = ['semanal', 'temporada', 'remate'];
const TODOS_LOS_DIAS = [0, 1, 2, 3, 4, 5, 6];
const ROLES = ['dueno', 'encargado'];
const MAX_COLORES = 12;
const BITACORA_POR_PAGINA = 50;
const CORREO_REPETIDO = 'Ese correo ya lo usa otro usuario de Necutools.';
// Deben existir en public/iconos.js
const ICONOS_TIENDA = [
    'store', 'shirt', 'cpu', 'candy', 'megaphone', 'pencil-ruler', 'gift', 'shapes', 'wrench', 'smartphone',
    'headphones', 'cake', 'cookie', 'coffee', 'book-open', 'palette', 'scissors', 'sparkles', 'heart', 'party-popper',
];

// ================= Permisos =================
function exigir_stand($standId): array
{
    $id = id_valido($standId);
    if (!$id) throw dato_invalido('Elige una tienda.');
    $stand = fila('SELECT id, nombre FROM stands WHERE id = ?', [$id]);
    if (!$stand) throw new ErrorHttp(404, 'Esa tienda no existe.');
    if (!puede_editar_stand($id)) throw new ErrorHttp(403, 'No tienes permiso para editar esta tienda.');
    return $stand;
}

function stand_filtro($valor): ?int
{
    if ($valor === null || $valor === '') return null;
    $id = id_valido($valor);
    if (!$id) throw dato_invalido('Elige una tienda.');
    if (!puede_editar_stand($id)) throw new ErrorHttp(403, 'No tienes permiso para ver esta tienda.');
    return $id;
}

// "WHERE" de tiendas visibles para este admin: [sql, parámetros] sobre la columna $columna
function filtro_tiendas(string $columna, ?int $stand): array
{
    [$sql, $params] = en_alcance('x', $stand, tiendas_de_admin());
    return [str_replace('x.stand_id', $columna, $sql), $params];
}

// Imagen subida, sin metadatos (ubicación GPS, modelo del celular…)
function imagen_de(array $cuerpo): ?array
{
    if (empty($cuerpo['imagen'])) return null;
    $img = leer_imagen($cuerpo['imagen']);
    return ['bytes' => limpiar_metadatos($img['bytes'], $img['tipo']), 'tipo' => $img['tipo']];
}

function conflicto(Throwable $e, string $mensaje): void
{
    if (error_bd($e) === 1062) throw new ErrorHttp(409, $mensaje);
    throw $e;
}

// ================= Tiendas =================
function datos_tienda(array $b): array
{
    $nombre = v_texto($b['nombre'] ?? null, 'el nombre de la tienda', 50, true);
    return [
        'nombre' => $nombre,
        'slug' => v_slug($b['slug'] ?? null, 'la dirección de la tienda', $nombre),
        'descripcion' => v_texto($b['descripcion'] ?? null, 'la descripción', 300),
        'icono' => in_array($b['icono'] ?? null, ICONOS_TIENDA, true) ? $b['icono'] : 'store',
        'whatsapp' => numeros_whatsapp($b['whatsapp'] ?? null),
        'orden' => v_entero($b['orden'] ?? null, 'El orden', 0, 9999, 100),
        'visible' => v_booleano($b['visible'] ?? null, true),
        'imagen' => imagen_de($b),
        'quitarImagen' => v_booleano($b['quitar_imagen'] ?? null, false),
    ];
}

// ================= Productos =================
function datos_producto(array $b): array
{
    $stand = exigir_stand($b['stand_id'] ?? null);
    $tipo = v_opcion($b['tipo'] ?? null, TIPOS_PRODUCTO, 'si es producto o servicio');
    // Los productos se compran con precio fijo; los servicios pueden ser "desde" o "a cotizar"
    $precioModo = $tipo === 'producto' ? 'fijo' : v_opcion($b['precio_modo'] ?? null, PRECIO_MODOS, 'cómo se cobra el servicio');
    $subcategoriaId = id_opcional($b['subcategoria_id'] ?? null, 'La subcategoría');
    if ($subcategoriaId && !valor('SELECT 1 FROM subcategorias WHERE id = ? AND stand_id = ?', [$subcategoriaId, $stand['id']])) {
        throw dato_invalido('Esa subcategoría no es de la tienda elegida.');
    }
    return [
        'standId' => $stand['id'],
        'subcategoriaId' => $subcategoriaId,
        'tipo' => $tipo,
        'nombre' => v_texto($b['nombre'] ?? null, $tipo === 'producto' ? 'el nombre del producto' : 'el nombre del servicio', 120, true),
        'precioModo' => $precioModo,
        'precio' => $precioModo === 'cotizar' ? null : v_precio($b['precio'] ?? null),
        'disponibilidad' => in_array($b['disponibilidad'] ?? null, DISPONIBILIDAD, true) ? $b['disponibilidad'] : 'Disponible',
        'descripcion' => v_texto($b['descripcion'] ?? null, 'la descripción', 1000),
        'visible' => v_booleano($b['visible'] ?? null, true),
        'orden' => v_entero($b['orden'] ?? null, 'El orden', 0, 9999, 0),
        'imagen' => imagen_de($b),
        'quitarImagen' => v_booleano($b['quitar_imagen'] ?? null, false),
    ];
}

function exigir_producto_admin($id): array
{
    $productoId = id_valido($id);
    $p = $productoId ? fila('SELECT id, stand_id, nombre FROM productos WHERE id = ?', [$productoId]) : null;
    if (!$p) throw new ErrorHttp(404, 'Ese producto no existe.');
    exigir_stand($p['stand_id']);
    return $p;
}

// ================= Colores =================
function datos_color(array $b, bool $nuevo): array
{
    $hex = is_string($b['hex'] ?? null) ? strtolower(js_trim($b['hex'])) : '';
    if (!preg_match('/^#[0-9a-f]{6}$/', $hex)) throw dato_invalido('Elige el color con el selector.');
    $imagen = imagen_de($b);
    if ($nuevo && !$imagen) throw dato_invalido('Sube la foto del producto en ese color.');
    return [
        'nombre' => v_texto($b['nombre'] ?? null, 'el nombre del color', 30, true),
        'hex' => $hex,
        'imagen' => $imagen,
        'disponible' => v_booleano($b['disponible'] ?? null, true),
        'orden' => v_entero($b['orden'] ?? null, 'El orden', 0, 9999, 0),
    ];
}

function exigir_color($id): array
{
    $colorId = id_valido($id);
    $c = $colorId ? fila('SELECT c.id, c.nombre, c.producto_id, p.stand_id, p.nombre AS producto
                         FROM producto_colores c JOIN productos p ON p.id = c.producto_id WHERE c.id = ?', [$colorId]) : null;
    if (!$c) throw new ErrorHttp(404, 'Ese color no existe.');
    exigir_stand($c['stand_id']);
    return $c;
}

function tocar_producto(int $id): void
{
    q('UPDATE productos SET actualizado_en = UTC_TIMESTAMP(6) WHERE id = ?', [$id]);
}

// ================= Ofertas =================
function datos_oferta(array $b): array
{
    $stand = exigir_stand($b['stand_id'] ?? null);
    $tipo = v_opcion($b['tipo'] ?? null, TIPOS_OFERTA, 'el tipo de oferta');
    $aplica = v_opcion($b['aplica'] ?? null, ['tienda', 'subcategoria', 'producto'], 'a qué aplica la oferta');
    $productoId = null;
    $subcategoriaId = null;
    $precioProducto = null;

    if ($aplica === 'producto') {
        $productoId = id_opcional($b['producto_id'] ?? null, 'El producto');
        if (!$productoId) throw dato_invalido('Elige el producto de la oferta.');
        $p = fila("SELECT precio FROM productos WHERE id = ? AND stand_id = ? AND tipo = 'producto'", [$productoId, $stand['id']]);
        if (!$p) throw dato_invalido('Ese producto no es de la tienda elegida.');
        $precioProducto = a_float($p['precio']);
    } elseif ($aplica === 'subcategoria') {
        $subcategoriaId = id_opcional($b['subcategoria_id'] ?? null, 'La subcategoría');
        if (!$subcategoriaId) throw dato_invalido('Elige la subcategoría de la oferta.');
        if (!valor('SELECT 1 FROM subcategorias WHERE id = ? AND stand_id = ?', [$subcategoriaId, $stand['id']])) {
            throw dato_invalido('Esa subcategoría no es de la tienda elegida.');
        }
    }

    $valor = null;
    if ($tipo === 'porcentaje') {
        $n = js_numero($b['valor'] ?? null);
        if (!js_entero($n) || $n < 1 || $n > 90) throw dato_invalido('El descuento debe ser de 1 a 90 por ciento.');
        $valor = (int) $n;
    } elseif ($tipo === 'precio_especial') {
        if ($aplica !== 'producto') throw dato_invalido('El precio especial solo se puede poner a un producto.');
        $valor = v_precio($b['valor'] ?? null, 'el precio especial');
        if ((float) $valor >= $precioProducto) throw dato_invalido('El precio especial debe ser menor al precio normal del producto.');
    }

    // Semanal: por días de la semana. Temporada: por fechas, todos los días. Remate: hasta que se acabe o hasta una fecha.
    $clase = v_opcion(array_key_exists('clase', $b) ? $b['clase'] : 'semanal', CLASES_OFERTA, 'la clase de oferta');
    $dias = TODOS_LOS_DIAS;
    $temporada = null;
    $inicio = null;
    $fin = null;
    $piezas = null;
    if ($clase === 'semanal') {
        $dias = [];
        if (js_lista($b['dias'] ?? null)) {
            foreach ($b['dias'] as $d) {
                $n = js_numero($d);
                if (js_entero($n) && $n >= 0 && $n <= 6 && !in_array((int) $n, $dias, true)) $dias[] = (int) $n;
            }
        }
        if (!$dias) throw dato_invalido('Elige al menos un día de la semana.');
    } elseif ($clase === 'temporada') {
        $temporada = v_texto($b['temporada'] ?? null, 'la temporada', 40, true);
        $inicio = v_fecha($b['inicio'] ?? null, 'la fecha de inicio');
        $fin = v_fecha($b['fin'] ?? null, 'la fecha de fin');
    } else {
        $fin = !empty($b['fin']) ? v_fecha($b['fin'], 'la fecha límite') : null;
        $piezas = v_entero($b['piezas'] ?? null, 'Las piezas del remate', 1, 9999, null);
    }
    if ($inicio && $fin && $fin < $inicio) throw dato_invalido('La fecha de fin debe ser igual o posterior a la de inicio.');
    sort($dias);

    return [
        'standId' => $stand['id'], 'productoId' => $productoId, 'subcategoriaId' => $subcategoriaId, 'tipo' => $tipo, 'valor' => $valor,
        'dias' => json_encode($dias), 'clase' => $clase, 'temporada' => $temporada, 'inicio' => $inicio, 'fin' => $fin, 'piezas' => $piezas,
        'titulo' => v_texto($b['titulo'] ?? null, 'el título de la oferta', 80, true),
        'descripcion' => v_texto($b['descripcion'] ?? null, 'la descripción', 300),
        'activa' => v_booleano($b['activa'] ?? null, true),
    ];
}

function exigir_oferta($id): array
{
    $ofertaId = id_valido($id);
    $o = $ofertaId ? fila('SELECT id, stand_id FROM ofertas WHERE id = ?', [$ofertaId]) : null;
    if (!$o) throw new ErrorHttp(404, 'Esa oferta no existe.');
    exigir_stand($o['stand_id']);
    return $o;
}

// ================= Promociones =================
function datos_promocion(array $b): array
{
    $inicio = v_fecha($b['inicio'] ?? null, 'la fecha de inicio');
    $fin = v_fecha($b['fin'] ?? null, 'la fecha de fin');
    if ($fin < $inicio) throw dato_invalido('La fecha de fin debe ser igual o posterior a la de inicio.');
    $lista = js_lista($b['items'] ?? null) ? $b['items'] : [];
    if (!$lista || count($lista) > 10) throw dato_invalido('Agrega de 1 a 10 productos al paquete.');
    $items = [];
    foreach ($lista as $item) {
        $productoId = is_array($item) ? id_valido($item['producto_id'] ?? null) : null;
        if (!$productoId) throw dato_invalido('Elige los productos del paquete.');
        $items[$productoId] = v_entero($item['cantidad'] ?? null, 'La cantidad', 1, 99, 1);
    }
    $ids = array_keys($items);
    $encontrados = filas('SELECT id FROM productos WHERE id IN (' . marcas($ids) . ") AND tipo = 'producto'", $ids);
    if (count($encontrados) !== count($items)) throw dato_invalido('Algún producto del paquete ya no existe.');
    return [
        'titulo' => v_texto($b['titulo'] ?? null, 'el título de la promoción', 100, true),
        'descripcion' => v_texto($b['descripcion'] ?? null, 'la descripción', 600),
        'precio' => v_precio($b['precio'] ?? null, 'el precio del paquete'),
        'inicio' => $inicio, 'fin' => $fin,
        'destacada' => v_booleano($b['destacada'] ?? null, false),
        'activa' => v_booleano($b['activa'] ?? null, true),
        'items' => $items,
        'imagen' => imagen_de($b),
        'quitarImagen' => v_booleano($b['quitar_imagen'] ?? null, false),
    ];
}

function guardar_items(int $promocionId, array $items): void
{
    q('DELETE FROM promocion_items WHERE promocion_id = ?', [$promocionId]);
    foreach ($items as $productoId => $cantidad) {
        q('INSERT INTO promocion_items (promocion_id, producto_id, cantidad) VALUES (?, ?, ?)', [$promocionId, $productoId, $cantidad]);
    }
}

// ================= Usuarios =================
// $confirmar: "Repite la contraseña" (obligatorio en toda contraseña nueva). Tampoco puede llevar el
// usuario ni la parte del correo antes de la @.
function contrasena_admin($valor, $confirmar, string $usuario, string $campo = 'La contraseña', ?string $correo = null): string
{
    return validar_contrasena($valor, 12, $campo, [$usuario, $correo ? explode('@', $correo)[0] : ''], is_string($confirmar) ? $confirmar : '');
}

// Correo opcional del admin (para entrar con él en vez del usuario). Vacío = sin correo.
function correo_opcional($valor): ?string
{
    if ($valor === null || (is_string($valor) && js_trim($valor) === '')) return null;
    return correo_real($valor, 'el correo');
}

function tiendas_validas($lista): array
{
    if ($lista === null) return [];
    if (!js_lista($lista)) throw dato_invalido('Las tiendas asignadas no son válidas.');
    $ids = array_values(array_unique(array_map(fn($x) => id_valido($x) ?? 0, $lista)));
    if (in_array(0, $ids, true)) throw dato_invalido('Las tiendas asignadas no son válidas.');
    if (!$ids) return [];
    if (count(filas('SELECT id FROM stands WHERE id IN (' . marcas($ids) . ')', $ids)) !== count($ids)) {
        throw dato_invalido('Alguna tienda asignada ya no existe.');
    }
    return $ids;
}

function asignar_tiendas(int $adminId, array $tiendas): void
{
    q('DELETE FROM admin_stands WHERE admin_id = ?', [$adminId]);
    foreach ($tiendas as $standId) q('INSERT INTO admin_stands (admin_id, stand_id) VALUES (?, ?)', [$adminId, $standId]);
}

// Revisa la contraseña actual con límite por cuenta: una sesión robada no sirve para adivinarla
function exigir_password_actual(array $admin, $valor): string
{
    exigir_no_frenada('password', $admin['id']);
    $actual = is_string($valor) ? $valor : '';
    $hash = valor('SELECT password_hash FROM admins WHERE id = ?', [$admin['id']]);
    if ($actual === '' || mb_strlen($actual) > 200 || !password_verify($actual, $hash)) {
        registrar_fallo('password', $admin['id']);
        throw dato_invalido('Tu contraseña actual no es correcta.');
    }
    limpiar_fallos('password', $admin['id']);
    return $actual;
}

function url_imagen(string $ruta, int $id, string $actualizado): string
{
    return "/api/$ruta/$id/" . ($ruta === 'stands' ? 'portada' : 'imagen') . '?v=' . version_ms($actualizado);
}

function rutas_admin(): void
{
    // ================= Mi sesión =================
    get('/api/admin/yo', function () {
        $a = requiere_admin();
        return ['id' => $a['id'], 'usuario' => $a['usuario'], 'rol' => $a['rol'], 'tiendas' => $a['tiendas'], 'totp_activo' => $a['totp_activo'], 'correo' => $a['correo']];
    });

    get('/api/admin/iconos', function () {
        requiere_admin();
        return ICONOS_TIENDA;
    });

    // ================= Tiendas =================
    get('/api/admin/tiendas', function () {
        requiere_admin();
        [$filtro, $params] = filtro_tiendas('s.id', null);
        $tiendas = filas("SELECT s.id, s.nombre, s.slug, s.descripcion, s.icono, s.whatsapp, s.orden, s.visible, s.imagen_ruta,
                                 (s.portada IS NOT NULL) AS tiene_portada, s.actualizado_en,
                                 (SELECT COUNT(*) FROM productos p WHERE p.stand_id = s.id) AS productos
                          FROM stands s WHERE $filtro ORDER BY s.orden, s.nombre", $params);
        $ids = array_column($tiendas, 'id');
        $subs = $ids ? filas('SELECT id, stand_id, nombre, slug, orden FROM subcategorias WHERE stand_id IN (' . marcas($ids) . ') ORDER BY orden, nombre', $ids) : [];
        return array_map(function ($s) use ($subs) {
            $tienePortada = a_bool($s['tiene_portada']);
            return [
                'id' => $s['id'], 'nombre' => $s['nombre'], 'slug' => $s['slug'], 'descripcion' => $s['descripcion'], 'icono' => $s['icono'],
                'whatsapp' => a_lista($s['whatsapp']), 'orden' => $s['orden'], 'visible' => a_bool($s['visible']), 'imagen_ruta' => $s['imagen_ruta'],
                'tiene_portada' => $tienePortada, 'actualizado_en' => fecha_iso($s['actualizado_en']), 'productos' => (int) $s['productos'],
                'subcategorias' => array_values(array_map(fn($sc) => ['id' => $sc['id'], 'nombre' => $sc['nombre'], 'slug' => $sc['slug'], 'orden' => $sc['orden']],
                    array_filter($subs, fn($sc) => $sc['stand_id'] === $s['id']))),
                'imagen_url' => $tienePortada ? url_imagen('stands', $s['id'], $s['actualizado_en']) : $s['imagen_ruta'],
            ];
        }, $tiendas);
    });

    post('/api/admin/tiendas', function () {
        $admin = requiere_admin();
        requiere_dueno();
        $d = datos_tienda(cuerpo());
        try {
            q('INSERT INTO stands (nombre, slug, descripcion, icono, whatsapp, orden, visible, portada, portada_tipo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [$d['nombre'], $d['slug'], $d['descripcion'], $d['icono'], json_encode($d['whatsapp']), $d['orden'], $d['visible'],
               $d['imagen']['bytes'] ?? null, $d['imagen']['tipo'] ?? null]);
        } catch (PDOException $e) {
            conflicto($e, 'Ya existe una tienda con ese nombre o dirección.');
        }
        $id = ultimo_id();
        anotar($admin, 'crear', 'tiendas', $id, $d['nombre']);
        return json_respuesta(['id' => $id, 'nombre' => $d['nombre'], 'slug' => $d['slug']], 201);
    });

    put('/api/admin/tiendas/:id', function ($idRuta) {
        $admin = requiere_admin();
        $stand = exigir_stand($idRuta);
        $d = datos_tienda(cuerpo());
        $img = $d['imagen'];
        try {
            q('UPDATE stands SET nombre = ?, slug = ?, descripcion = ?, icono = ?, whatsapp = ?, orden = ?, visible = ?,
                 portada = CASE WHEN ? THEN ? WHEN ? THEN NULL ELSE portada END,
                 portada_tipo = CASE WHEN ? THEN ? WHEN ? THEN NULL ELSE portada_tipo END,
                 imagen_ruta = CASE WHEN ? THEN NULL ELSE imagen_ruta END,
                 actualizado_en = UTC_TIMESTAMP(6)
               WHERE id = ?',
              [$d['nombre'], $d['slug'], $d['descripcion'], $d['icono'], json_encode($d['whatsapp']), $d['orden'], $d['visible'],
               (bool) $img, $img['bytes'] ?? null, $d['quitarImagen'],
               (bool) $img, $img['tipo'] ?? null, $d['quitarImagen'],
               $d['quitarImagen'], $stand['id']]);
        } catch (PDOException $e) {
            conflicto($e, 'Ya existe una tienda con ese nombre o dirección.');
        }
        anotar($admin, 'editar', 'tiendas', $stand['id'], $d['nombre']);
        return ['id' => $stand['id'], 'nombre' => $d['nombre'], 'slug' => $d['slug']];
    });

    delete('/api/admin/tiendas/:id', function ($idRuta) {
        $admin = requiere_admin();
        requiere_dueno();
        $stand = exigir_stand($idRuta);
        $total = (int) valor('SELECT COUNT(*) FROM productos WHERE stand_id = ?', [$stand['id']]);
        if ($total > 0) throw new ErrorHttp(409, "Primero borra o mueve los $total productos y servicios de {$stand['nombre']}.");
        q('DELETE FROM stands WHERE id = ?', [$stand['id']]);
        anotar($admin, 'borrar', 'tiendas', $stand['id'], $stand['nombre']);
        return vacia(204);
    });

    // ================= Subcategorías =================
    $datosSub = function (array $b): array {
        $nombre = v_texto($b['nombre'] ?? null, 'el nombre de la subcategoría', 60, true);
        return ['nombre' => $nombre, 'slug' => v_slug($nombre, 'el nombre de la subcategoría'), 'orden' => v_entero($b['orden'] ?? null, 'El orden', 0, 9999, 0)];
    };
    $exigirSub = function ($id): array {
        $subId = id_valido($id);
        $sub = $subId ? fila('SELECT id, stand_id FROM subcategorias WHERE id = ?', [$subId]) : null;
        if (!$sub) throw new ErrorHttp(404, 'Esa subcategoría no existe.');
        exigir_stand($sub['stand_id']);
        return $sub;
    };
    $subRepetida = 'Esa tienda ya tiene una subcategoría con ese nombre.';

    post('/api/admin/tiendas/:id/subcategorias', function ($idRuta) use ($datosSub, $subRepetida) {
        $admin = requiere_admin();
        $stand = exigir_stand($idRuta);
        $d = $datosSub(cuerpo());
        try {
            q('INSERT INTO subcategorias (stand_id, nombre, slug, orden) VALUES (?, ?, ?, ?)', [$stand['id'], $d['nombre'], $d['slug'], $d['orden']]);
        } catch (PDOException $e) {
            conflicto($e, $subRepetida);
        }
        $id = ultimo_id();
        anotar($admin, 'crear', 'subcategorias', $id, "{$d['nombre']} ({$stand['nombre']})");
        return json_respuesta(['id' => $id, 'nombre' => $d['nombre'], 'slug' => $d['slug'], 'orden' => $d['orden']], 201);
    });

    put('/api/admin/subcategorias/:id', function ($idRuta) use ($datosSub, $exigirSub, $subRepetida) {
        $admin = requiere_admin();
        $sub = $exigirSub($idRuta);
        $d = $datosSub(cuerpo());
        try {
            q('UPDATE subcategorias SET nombre = ?, slug = ?, orden = ? WHERE id = ?', [$d['nombre'], $d['slug'], $d['orden'], $sub['id']]);
        } catch (PDOException $e) {
            conflicto($e, $subRepetida);
        }
        anotar($admin, 'editar', 'subcategorias', $sub['id'], $d['nombre']);
        return ['id' => $sub['id'], ...$d];
    });

    delete('/api/admin/subcategorias/:id', function ($idRuta) use ($exigirSub) {
        $admin = requiere_admin();
        $sub = $exigirSub($idRuta);
        q('DELETE FROM subcategorias WHERE id = ?', [$sub['id']]);
        anotar($admin, 'borrar', 'subcategorias', $sub['id']);
        return vacia(204);
    });

    // ================= Productos y servicios =================
    get('/api/admin/productos', function () {
        requiere_admin();
        [$filtro, $params] = filtro_tiendas('p.stand_id', stand_filtro(consulta('stand')));
        $productos = filas("SELECT p.id, p.stand_id, s.nombre AS stand, p.subcategoria_id, sc.nombre AS subcategoria, p.tipo, p.nombre,
                                   p.precio, p.precio_modo, p.disponibilidad, p.descripcion, p.visible, p.orden,
                                   (p.imagen IS NOT NULL) AS tiene_imagen, p.imagen_ruta, p.creado_en, p.actualizado_en
                            FROM productos p JOIN stands s ON s.id = p.stand_id
                            LEFT JOIN subcategorias sc ON sc.id = p.subcategoria_id
                            WHERE $filtro
                            ORDER BY s.orden, p.tipo, p.orden, p.creado_en DESC, p.id DESC", $params);
        $ids = array_column($productos, 'id');
        $colores = $ids ? filas('SELECT id, producto_id, nombre, hex, disponible, orden, (imagen IS NOT NULL) AS tiene_imagen, actualizado_en
                                 FROM producto_colores WHERE producto_id IN (' . marcas($ids) . ') ORDER BY orden, id', $ids) : [];
        return array_map(function ($p) use ($colores) {
            $imagenUrl = a_bool($p['tiene_imagen']) ? url_imagen('productos', $p['id'], $p['actualizado_en']) : $p['imagen_ruta'];
            $suyos = array_values(array_filter($colores, fn($c) => $c['producto_id'] === $p['id']));
            return [
                'id' => $p['id'], 'stand_id' => $p['stand_id'], 'stand' => $p['stand'], 'subcategoria_id' => $p['subcategoria_id'],
                'subcategoria' => $p['subcategoria'], 'tipo' => $p['tipo'], 'nombre' => $p['nombre'], 'precio' => a_float($p['precio']),
                'precio_modo' => $p['precio_modo'], 'disponibilidad' => $p['disponibilidad'], 'descripcion' => $p['descripcion'],
                'visible' => a_bool($p['visible']), 'orden' => $p['orden'], 'creado_en' => fecha_iso($p['creado_en']),
                'actualizado_en' => fecha_iso($p['actualizado_en']),
                'imagen_url' => $imagenUrl,
                'colores' => array_map(fn($c) => [
                    'id' => $c['id'], 'nombre' => $c['nombre'], 'hex' => $c['hex'], 'disponible' => a_bool($c['disponible']), 'orden' => $c['orden'],
                    'imagen_url' => a_bool($c['tiene_imagen']) ? "/api/colores/{$c['id']}/imagen?v=" . version_ms($c['actualizado_en']) : $imagenUrl,
                ], $suyos),
            ];
        }, $productos);
    });

    post('/api/admin/productos', function () {
        $admin = requiere_admin();
        $d = datos_producto(cuerpo());
        q("INSERT INTO productos (stand_id, subcategoria_id, tipo, nombre, precio_modo, precio, disponibilidad, descripcion,
                                  visible, orden, imagen, imagen_tipo, categoria)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT nombre FROM subcategorias WHERE id = ?), 'General'))",
          [$d['standId'], $d['subcategoriaId'], $d['tipo'], $d['nombre'], $d['precioModo'], $d['precio'], $d['disponibilidad'], $d['descripcion'],
           $d['visible'], $d['orden'], $d['imagen']['bytes'] ?? null, $d['imagen']['tipo'] ?? null, $d['subcategoriaId']]);
        $id = ultimo_id();
        anotar($admin, 'crear', 'productos', $id, $d['nombre']);
        return json_respuesta(['id' => $id, 'nombre' => $d['nombre']], 201);
    });

    put('/api/admin/productos/:id', function ($idRuta) {
        $admin = requiere_admin();
        $producto = exigir_producto_admin($idRuta);
        $d = datos_producto(cuerpo());
        $img = $d['imagen'];
        q("UPDATE productos SET stand_id = ?, subcategoria_id = ?, tipo = ?, nombre = ?, precio_modo = ?, precio = ?,
             disponibilidad = ?, descripcion = ?, visible = ?, orden = ?,
             imagen = CASE WHEN ? THEN ? WHEN ? THEN NULL ELSE imagen END,
             imagen_tipo = CASE WHEN ? THEN ? WHEN ? THEN NULL ELSE imagen_tipo END,
             imagen_ruta = CASE WHEN ? THEN NULL ELSE imagen_ruta END,
             categoria = COALESCE((SELECT nombre FROM subcategorias WHERE id = ?), 'General'),
             actualizado_en = UTC_TIMESTAMP(6)
           WHERE id = ?",
          [$d['standId'], $d['subcategoriaId'], $d['tipo'], $d['nombre'], $d['precioModo'], $d['precio'],
           $d['disponibilidad'], $d['descripcion'], $d['visible'], $d['orden'],
           (bool) $img, $img['bytes'] ?? null, $d['quitarImagen'],
           (bool) $img, $img['tipo'] ?? null, $d['quitarImagen'],
           $d['quitarImagen'], $d['subcategoriaId'], $producto['id']]);
        // Los servicios no tienen colores
        if ($d['tipo'] === 'servicio') q('DELETE FROM producto_colores WHERE producto_id = ?', [$producto['id']]);
        // Si el producto cambió de tienda, sus ofertas de la tienda anterior ya no aplican
        if ($d['standId'] !== $producto['stand_id']) q('DELETE FROM ofertas WHERE producto_id = ? AND stand_id <> ?', [$producto['id'], $d['standId']]);
        anotar($admin, 'editar', 'productos', $producto['id'], $d['nombre']);
        return ['id' => $producto['id'], 'nombre' => $d['nombre']];
    });

    delete('/api/admin/productos/:id', function ($idRuta) {
        $admin = requiere_admin();
        $producto = exigir_producto_admin($idRuta);
        q('DELETE FROM productos WHERE id = ?', [$producto['id']]);
        anotar($admin, 'borrar', 'productos', $producto['id'], $producto['nombre']);
        return vacia(204);
    });

    // ================= Colores de un producto =================
    // Cada color va en su propia petición: el cuerpo con imagen tiene límite de 2 MB
    $colorRepetido = 'Ese color ya está en el producto.';

    post('/api/admin/productos/:id/colores', function ($idRuta) use ($colorRepetido) {
        $admin = requiere_admin();
        $producto = exigir_producto_admin($idRuta);
        $info = fila('SELECT p.tipo, (SELECT COUNT(*) FROM producto_colores c WHERE c.producto_id = p.id) AS colores FROM productos p WHERE p.id = ?', [$producto['id']]);
        if ($info['tipo'] !== 'producto') throw dato_invalido('Los colores son solo para productos.');
        if ((int) $info['colores'] >= MAX_COLORES) throw dato_invalido('Un producto puede tener hasta ' . MAX_COLORES . ' colores.');
        $d = datos_color(cuerpo(), true);
        try {
            q('INSERT INTO producto_colores (producto_id, nombre, hex, imagen, imagen_tipo, disponible, orden) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [$producto['id'], $d['nombre'], $d['hex'], $d['imagen']['bytes'], $d['imagen']['tipo'], $d['disponible'], $d['orden']]);
        } catch (PDOException $e) {
            conflicto($e, $colorRepetido);
        }
        $id = ultimo_id();
        tocar_producto($producto['id']);
        anotar($admin, 'crear', 'producto_colores', $id, "{$producto['nombre']}: {$d['nombre']}");
        return json_respuesta(['id' => $id, 'nombre' => $d['nombre']], 201);
    });

    put('/api/admin/colores/:id', function ($idRuta) use ($colorRepetido) {
        $admin = requiere_admin();
        $color = exigir_color($idRuta);
        $d = datos_color(cuerpo(), false);
        try {
            q('UPDATE producto_colores SET nombre = ?, hex = ?, disponible = ?, orden = ?,
                 imagen = COALESCE(?, imagen), imagen_tipo = COALESCE(?, imagen_tipo), actualizado_en = UTC_TIMESTAMP(6)
               WHERE id = ?',
              [$d['nombre'], $d['hex'], $d['disponible'], $d['orden'], $d['imagen']['bytes'] ?? null, $d['imagen']['tipo'] ?? null, $color['id']]);
        } catch (PDOException $e) {
            conflicto($e, $colorRepetido);
        }
        tocar_producto($color['producto_id']);
        anotar($admin, 'editar', 'producto_colores', $color['id'], "{$color['producto']}: {$d['nombre']}");
        return ['id' => $color['id'], 'nombre' => $d['nombre']];
    });

    delete('/api/admin/colores/:id', function ($idRuta) {
        $admin = requiere_admin();
        $color = exigir_color($idRuta);
        q('DELETE FROM producto_colores WHERE id = ?', [$color['id']]);
        tocar_producto($color['producto_id']);
        anotar($admin, 'borrar', 'producto_colores', $color['id'], "{$color['producto']}: {$color['nombre']}");
        return vacia(204);
    });

    // ================= Ofertas de la tienda =================
    get('/api/admin/ofertas', function () {
        requiere_admin();
        [$filtro, $params] = filtro_tiendas('o.stand_id', stand_filtro(consulta('stand')));
        $ofertas = filas("SELECT o.id, o.stand_id, s.nombre AS stand, o.producto_id, p.nombre AS producto, o.subcategoria_id,
                                 sc.nombre AS subcategoria, o.titulo, o.descripcion, o.tipo, o.valor, o.dias, o.activa,
                                 o.clase, o.temporada, o.inicio, o.fin, o.piezas
                          FROM ofertas o JOIN stands s ON s.id = o.stand_id
                          LEFT JOIN productos p ON p.id = o.producto_id
                          LEFT JOIN subcategorias sc ON sc.id = o.subcategoria_id
                          WHERE $filtro ORDER BY s.orden, o.id", $params);
        return array_map(function ($o) {
            $o = oferta_de_fila($o);
            $o['activa'] = a_bool($o['activa']);
            $o['dias_texto'] = texto_dias($o['dias']);
            return $o;
        }, $ofertas);
    });

    post('/api/admin/ofertas', function () {
        $admin = requiere_admin();
        $d = datos_oferta(cuerpo());
        q('INSERT INTO ofertas (stand_id, producto_id, subcategoria_id, titulo, descripcion, tipo, valor, dias, activa, clase, temporada, inicio, fin, piezas)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [$d['standId'], $d['productoId'], $d['subcategoriaId'], $d['titulo'], $d['descripcion'], $d['tipo'], $d['valor'], $d['dias'], $d['activa'],
           $d['clase'], $d['temporada'], $d['inicio'], $d['fin'], $d['piezas']]);
        $id = ultimo_id();
        anotar($admin, 'crear', 'ofertas', $id, $d['titulo']);
        return json_respuesta(['id' => $id, 'titulo' => $d['titulo']], 201);
    });

    put('/api/admin/ofertas/:id', function ($idRuta) {
        $admin = requiere_admin();
        $oferta = exigir_oferta($idRuta);
        $d = datos_oferta(cuerpo());
        q('UPDATE ofertas SET stand_id = ?, producto_id = ?, subcategoria_id = ?, titulo = ?, descripcion = ?, tipo = ?, valor = ?, dias = ?,
             activa = ?, clase = ?, temporada = ?, inicio = ?, fin = ?, piezas = ? WHERE id = ?',
          [$d['standId'], $d['productoId'], $d['subcategoriaId'], $d['titulo'], $d['descripcion'], $d['tipo'], $d['valor'], $d['dias'],
           $d['activa'], $d['clase'], $d['temporada'], $d['inicio'], $d['fin'], $d['piezas'], $oferta['id']]);
        anotar($admin, 'editar', 'ofertas', $oferta['id'], $d['titulo']);
        return ['id' => $oferta['id'], 'titulo' => $d['titulo']];
    });

    delete('/api/admin/ofertas/:id', function ($idRuta) {
        $admin = requiere_admin();
        $oferta = exigir_oferta($idRuta);
        q('DELETE FROM ofertas WHERE id = ?', [$oferta['id']]);
        anotar($admin, 'borrar', 'ofertas', $oferta['id']);
        return vacia(204);
    });

    // ================= Opiniones de los clientes =================
    // El vendedor responde y puede ocultar una opinión inapropiada; no puede borrarla ni cambiarla.
    get('/api/admin/resenas', function () {
        requiere_admin();
        [$filtro, $params] = filtro_tiendas('p.stand_id', stand_filtro(consulta('stand')));
        $lista = filas("SELECT r.id, r.producto_id, p.nombre AS producto, p.stand_id, s.nombre AS stand, c.nombre AS cliente,
                               r.calificacion, r.comentario, r.respuesta, r.visible, r.creado_en
                        FROM resenas r
                        JOIN productos p ON p.id = r.producto_id
                        JOIN stands s ON s.id = p.stand_id
                        JOIN clientes c ON c.id = r.cliente_id
                        WHERE $filtro
                        ORDER BY r.creado_en DESC, r.id DESC LIMIT 300", $params);
        return array_map(fn($r) => [...$r, 'visible' => a_bool($r['visible']), 'creado_en' => fecha_iso($r['creado_en'])], $lista);
    });

    put('/api/admin/resenas/:id', function ($idRuta) {
        $admin = requiere_admin();
        $id = id_valido($idRuta);
        $r = $id ? fila('SELECT r.id, p.stand_id FROM resenas r JOIN productos p ON p.id = r.producto_id WHERE r.id = ?', [$id]) : null;
        if (!$r) throw new ErrorHttp(404, 'Esa opinión no existe.');
        exigir_stand($r['stand_id']);
        $respuesta = v_texto(campo('respuesta'), 'la respuesta', 500) ?: null;
        $visible = v_booleano(campo('visible'), true);
        // respondida_en primero: compara con la respuesta de antes
        q('UPDATE resenas SET
             respondida_en = CASE WHEN ? IS NULL THEN NULL WHEN NOT (? <=> respuesta) THEN UTC_TIMESTAMP(6) ELSE respondida_en END,
             respuesta = ?, visible = ?
           WHERE id = ?', [$respuesta, $respuesta, $respuesta, $visible, $id]);
        anotar($admin, 'editar', 'opiniones', $id, ($respuesta ? 'Respondió' : 'Sin respuesta') . ($visible ? '' : ', oculta'));
        return ['id' => $id];
    });

    // ================= Promociones generales (solo dueños) =================
    get('/api/admin/promociones', function () {
        requiere_admin();
        requiere_dueno();
        $promos = filas('SELECT pr.id, pr.titulo, pr.descripcion, pr.precio, pr.inicio, pr.fin, pr.destacada, pr.activa,
                                (pr.imagen IS NOT NULL) AS tiene_imagen, pr.actualizado_en
                         FROM promociones pr ORDER BY pr.fin DESC, pr.id DESC');
        $items = filas('SELECT i.promocion_id, i.producto_id, i.cantidad, p.nombre, s.nombre AS stand
                        FROM promocion_items i JOIN productos p ON p.id = i.producto_id JOIN stands s ON s.id = p.stand_id
                        ORDER BY s.orden, p.nombre');
        return array_map(fn($p) => [
            'id' => $p['id'], 'titulo' => $p['titulo'], 'descripcion' => $p['descripcion'], 'precio' => (float) $p['precio'],
            'inicio' => $p['inicio'], 'fin' => $p['fin'], 'destacada' => a_bool($p['destacada']), 'activa' => a_bool($p['activa']),
            'actualizado_en' => fecha_iso($p['actualizado_en']),
            'items' => array_values(array_map(fn($i) => ['producto_id' => $i['producto_id'], 'cantidad' => $i['cantidad'], 'nombre' => $i['nombre'], 'stand' => $i['stand']],
                array_filter($items, fn($i) => $i['promocion_id'] === $p['id']))),
            'imagen_url' => a_bool($p['tiene_imagen']) ? url_imagen('promociones', $p['id'], $p['actualizado_en']) : null,
        ], $promos);
    });

    post('/api/admin/promociones', function () {
        $admin = requiere_admin();
        requiere_dueno();
        $d = datos_promocion(cuerpo());
        $id = en_transaccion(function () use ($d) {
            q('INSERT INTO promociones (titulo, descripcion, precio, inicio, fin, destacada, activa, imagen, imagen_tipo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [$d['titulo'], $d['descripcion'], $d['precio'], $d['inicio'], $d['fin'], $d['destacada'], $d['activa'],
               $d['imagen']['bytes'] ?? null, $d['imagen']['tipo'] ?? null]);
            $id = ultimo_id();
            guardar_items($id, $d['items']);
            return $id;
        });
        anotar($admin, 'crear', 'promociones', $id, $d['titulo']);
        return json_respuesta(['id' => $id, 'titulo' => $d['titulo']], 201);
    });

    put('/api/admin/promociones/:id', function ($idRuta) {
        $admin = requiere_admin();
        requiere_dueno();
        $id = id_valido($idRuta);
        $d = datos_promocion(cuerpo());
        $img = $d['imagen'];
        en_transaccion(function () use ($d, $img, $id) {
            $encontradas = ejecutar('UPDATE promociones SET titulo = ?, descripcion = ?, precio = ?, inicio = ?, fin = ?, destacada = ?, activa = ?,
                 imagen = CASE WHEN ? THEN ? WHEN ? THEN NULL ELSE imagen END,
                 imagen_tipo = CASE WHEN ? THEN ? WHEN ? THEN NULL ELSE imagen_tipo END,
                 actualizado_en = UTC_TIMESTAMP(6)
               WHERE id = ?',
              [$d['titulo'], $d['descripcion'], $d['precio'], $d['inicio'], $d['fin'], $d['destacada'], $d['activa'],
               (bool) $img, $img['bytes'] ?? null, $d['quitarImagen'], (bool) $img, $img['tipo'] ?? null, $d['quitarImagen'], $id]);
            if (!$encontradas) throw new ErrorHttp(404, 'Esa promoción no existe.');
            guardar_items($id, $d['items']);
        });
        anotar($admin, 'editar', 'promociones', $id, $d['titulo']);
        return ['id' => $id, 'titulo' => $d['titulo']];
    });

    delete('/api/admin/promociones/:id', function ($idRuta) {
        $admin = requiere_admin();
        requiere_dueno();
        $id = id_valido($idRuta);
        if (!$id || !ejecutar('DELETE FROM promociones WHERE id = ?', [$id])) throw new ErrorHttp(404, 'Esa promoción no existe.');
        anotar($admin, 'borrar', 'promociones', $id);
        return vacia(204);
    });

    // ================= Usuarios de Necutools (solo dueños) =================
    get('/api/admin/usuarios', function () {
        requiere_admin();
        requiere_dueno();
        $admins = filas('SELECT id, usuario, correo, rol, activo, totp_activo, creado_en FROM admins ORDER BY rol DESC, LOWER(usuario), usuario DESC');
        $asignadas = filas('SELECT admin_id, stand_id FROM admin_stands ORDER BY stand_id');
        return array_map(fn($a) => [
            'id' => $a['id'], 'usuario' => $a['usuario'], 'correo' => $a['correo'], 'rol' => $a['rol'], 'activo' => a_bool($a['activo']),
            'totp_activo' => a_bool($a['totp_activo']), 'creado_en' => fecha_iso($a['creado_en']),
            'tiendas' => array_values(array_map(fn($t) => $t['stand_id'], array_filter($asignadas, fn($t) => $t['admin_id'] === $a['id']))),
        ], $admins);
    });

    post('/api/admin/usuarios', function () {
        $admin = requiere_admin();
        requiere_dueno();
        $usuario = mb_strtolower(v_texto(campo('usuario'), 'el usuario', 50, true));
        if (!preg_match('/^[a-z0-9._-]{3,50}$/', $usuario)) {
            throw dato_invalido('El usuario debe tener de 3 a 50 letras sin acentos, números, punto, guion o guion bajo.');
        }
        $correo = correo_opcional(campo('correo'));
        $password = contrasena_admin(campo('password'), campo('confirmar'), $usuario, 'La contraseña', $correo);
        $rol = v_opcion(campo('rol'), ROLES, 'el rol');
        $tiendas = $rol === 'encargado' ? tiendas_validas(campo('tiendas')) : [];
        // Sin importar mayúsculas: "Axel" y "axel" serían la misma persona al entrar
        if (valor('SELECT 1 FROM admins WHERE LOWER(usuario) = ?', [$usuario])) throw new ErrorHttp(409, 'Ya existe un usuario con ese nombre.');
        $hash = cifrar_contrasena($password);
        $id = en_transaccion(function () use ($usuario, $correo, $hash, $rol, $tiendas) {
            try {
                q('INSERT INTO admins (usuario, correo, password_hash, rol) VALUES (?, ?, ?, ?)', [$usuario, $correo, $hash, $rol]);
            } catch (PDOException $e) {
                if (error_bd($e) === 1062) throw new ErrorHttp(409, indice_repetido($e) === 'admins_correo_idx' ? CORREO_REPETIDO : 'Ya existe un usuario con ese nombre.');
                throw $e;
            }
            $id = ultimo_id();
            asignar_tiendas($id, $tiendas);
            return $id;
        });
        anotar($admin, 'crear', 'usuarios', $id, "$usuario ($rol)");
        return json_respuesta(['id' => $id, 'usuario' => $usuario, 'rol' => $rol], 201);
    });

    put('/api/admin/usuarios/:id', function ($idRuta) {
        $admin = requiere_admin();
        requiere_dueno();
        $id = id_valido($idRuta);
        $usuario = $id ? fila('SELECT id, usuario, correo, rol, activo FROM admins WHERE id = ?', [$id]) : null;
        if (!$usuario) throw new ErrorHttp(404, 'Ese usuario no existe.');

        $rol = v_opcion(campo('rol'), ROLES, 'el rol');
        $activo = v_booleano(campo('activo'), true);
        $tiendas = $rol === 'encargado' ? tiendas_validas(campo('tiendas')) : [];
        // correo: si no viene, no se toca; "" = se quita
        $cambiaCorreo = existe('correo');
        $correo = $cambiaCorreo ? correo_opcional(campo('correo')) : null;
        $password = campo('password')
            ? contrasena_admin(campo('password'), campo('confirmar'), $usuario['usuario'], 'La contraseña nueva', $cambiaCorreo ? $correo : $usuario['correo'])
            : null;
        // Un dueño puede quitarle la verificación en dos pasos a otro usuario que perdió su celular
        $quitar2fa = v_booleano(campo('quitar_2fa'), false);
        if ($quitar2fa && $usuario['id'] === $admin['id']) throw new ErrorHttp(409, 'Para quitar tu propia verificación en dos pasos usa Mi cuenta.');
        if ($usuario['id'] === $admin['id'] && ($rol !== 'dueno' || !$activo)) {
            throw new ErrorHttp(409, 'No puedes quitarte el rol de dueño ni desactivar tu propia cuenta.');
        }
        if ($usuario['rol'] === 'dueno' && ($rol !== 'dueno' || !$activo)) {
            $duenos = (int) valor("SELECT COUNT(*) FROM admins WHERE rol = 'dueno' AND activo AND id <> ?", [$usuario['id']]);
            if (!$duenos) throw new ErrorHttp(409, 'Debe quedar al menos un dueño activo.');
        }

        $hash = $password ? cifrar_contrasena($password) : null;
        en_transaccion(function () use ($rol, $activo, $hash, $usuario, $quitar2fa, $cambiaCorreo, $correo, $tiendas) {
            try {
                q("UPDATE admins SET rol = ?, activo = ?, password_hash = COALESCE(?, password_hash),
                     totp_activo = totp_activo AND NOT ?, totp_secreto = CASE WHEN ? THEN NULL ELSE totp_secreto END,
                     totp_respaldo = CASE WHEN ? THEN '[]' ELSE totp_respaldo END,
                     correo = CASE WHEN ? THEN ? ELSE correo END
                   WHERE id = ?",
                  [$rol, $activo, $hash, $quitar2fa, $quitar2fa, $quitar2fa, $cambiaCorreo, $correo, $usuario['id']]);
            } catch (PDOException $e) {
                conflicto($e, CORREO_REPETIDO);
            }
            asignar_tiendas($usuario['id'], $tiendas);
        });
        if (!$activo || $password) cerrar_sesiones_de($usuario['id']);
        $cambios = [$rol, $activo ? 'activa' : 'desactivada', $password ? 'contraseña nueva' : '', $quitar2fa ? 'sin 2 pasos' : '',
            $cambiaCorreo ? ($correo ? 'correo nuevo' : 'sin correo') : ''];
        anotar($admin, 'editar', 'usuarios', $usuario['id'], "{$usuario['usuario']}: " . implode(', ', array_filter($cambios)));
        return ['id' => $usuario['id'], 'usuario' => $usuario['usuario'], 'rol' => $rol, 'activo' => $activo];
    });

    // ================= Bitácora (solo dueños) =================
    get('/api/admin/bitacora', function () {
        requiere_admin();
        requiere_dueno();
        $pagina = v_entero(consulta('pagina'), 'La página', 1, 9999, 1);
        $adminId = id_opcional(consulta('usuario'), 'El usuario');
        $filtro = $adminId ? 'WHERE admin_id = ?' : '';
        $params = $adminId ? [$adminId] : [];
        $registros = filas("SELECT id, creado_en, admin_id, usuario, accion, tabla, registro_id, resumen FROM bitacora $filtro
                            ORDER BY creado_en DESC, id DESC LIMIT ? OFFSET ?", [...$params, BITACORA_POR_PAGINA, ($pagina - 1) * BITACORA_POR_PAGINA]);
        $total = (int) valor("SELECT COUNT(*) FROM bitacora $filtro", $params);
        return [
            'registros' => array_map(fn($r) => [...$r, 'creado_en' => fecha_iso($r['creado_en'])], $registros), 'pagina' => $pagina, 'total' => $total,
            'paginas' => max(1, (int) ceil($total / BITACORA_POR_PAGINA)),
        ];
    });

    // ================= Mi cuenta =================
    put('/api/admin/mi-password', function () {
        $admin = requiere_admin();
        $nueva = contrasena_admin(campo('nueva'), campo('confirmar'), $admin['usuario'], 'La contraseña nueva', $admin['correo']);
        $actual = exigir_password_actual($admin, campo('actual'));
        if ($actual === $nueva) throw dato_invalido('La contraseña nueva debe ser distinta a la actual.');
        q('UPDATE admins SET password_hash = ? WHERE id = ?', [cifrar_contrasena($nueva), $admin['id']]);
        cerrar_sesiones_de($admin['id'], Sesion::id());
        anotar($admin, 'contraseña', 'usuarios', $admin['id'], 'Cambió su contraseña');
        return ['ok' => true];
    });

    // Correo para entrar con él (opcional). Pide la contraseña actual: con una sesión robada no se cambia.
    put('/api/admin/mi-correo', function () {
        $admin = requiere_admin();
        $correo = correo_opcional(campo('correo'));
        exigir_password_actual($admin, campo('password'));
        try {
            q('UPDATE admins SET correo = ? WHERE id = ?', [$correo, $admin['id']]);
        } catch (PDOException $e) {
            conflicto($e, CORREO_REPETIDO);
        }
        anotar($admin, 'editar', 'usuarios', $admin['id'], $correo ? 'Cambió su correo' : 'Quitó su correo');
        return ['correo' => $correo];
    });

    // ================= Verificación en dos pasos =================
    // 1) Con la contraseña, se genera una clave que solo vive en la sesión hasta confirmarla con un código
    post('/api/admin/2fa/iniciar', function () {
        $admin = requiere_admin();
        if ($admin['totp_activo']) throw new ErrorHttp(409, 'Ya tienes activa la verificación en dos pasos.');
        exigir_password_actual($admin, campo('password'));
        $secreto = totp_generar_secreto();
        Sesion::set('totpNuevo', ['secreto' => $secreto, 'hasta' => ahora_ms() + 10 * 60 * 1000]);
        return ['secreto' => $secreto, 'enlace' => totp_enlace($admin['usuario'], $secreto)];
    });

    // 2) El código de la app confirma que quedó bien guardada; se entregan los códigos de respaldo una sola vez
    post('/api/admin/2fa/activar', function () {
        $admin = requiere_admin();
        $nuevo = Sesion::get('totpNuevo');
        if (!$nuevo || $nuevo['hasta'] < ahora_ms()) {
            Sesion::quitar('totpNuevo');
            throw dato_invalido('Pasaron más de 10 minutos. Vuelve a empezar la activación.');
        }
        exigir_no_frenada('totp', $admin['id']);
        $codigo = is_string(campo('codigo')) ? preg_replace('/\s/u', '', campo('codigo')) : '';
        $paso = totp_verificar($nuevo['secreto'], $codigo);
        if ($paso === null) {
            registrar_fallo('totp', $admin['id']);
            throw dato_invalido('El código no coincide. Revisa que la hora de tu celular sea automática y escribe el código que aparece ahora.');
        }
        limpiar_fallos('totp', $admin['id']);
        $respaldo = totp_generar_respaldo();
        q('UPDATE admins SET totp_secreto = ?, totp_activo = TRUE, totp_ultimo = ?, totp_respaldo = ? WHERE id = ?',
          [$nuevo['secreto'], $paso, json_encode(array_map('totp_hash_respaldo', $respaldo)), $admin['id']]);
        Sesion::quitar('totpNuevo');
        cerrar_sesiones_de($admin['id'], Sesion::id());
        anotar($admin, '2 pasos', 'usuarios', $admin['id'], 'Activó la verificación en dos pasos');
        return ['respaldo' => $respaldo];
    });

    post('/api/admin/2fa/desactivar', function () {
        $admin = requiere_admin();
        if (!$admin['totp_activo']) throw new ErrorHttp(409, 'No tienes activa la verificación en dos pasos.');
        exigir_password_actual($admin, campo('password'));
        exigir_no_frenada('totp', $admin['id']);
        $datos = fila('SELECT id, totp_secreto, totp_ultimo FROM admins WHERE id = ?', [$admin['id']]);
        if (!usar_codigo($datos, campo('codigo'))) {
            registrar_fallo('totp', $admin['id']);
            throw dato_invalido('El código no es correcto. Escribe el que muestra la app o uno de respaldo.');
        }
        limpiar_fallos('totp', $admin['id']);
        q("UPDATE admins SET totp_activo = FALSE, totp_secreto = NULL, totp_ultimo = NULL, totp_respaldo = '[]' WHERE id = ?", [$admin['id']]);
        anotar($admin, '2 pasos', 'usuarios', $admin['id'], 'Desactivó la verificación en dos pasos');
        return ['ok' => true];
    });
}
