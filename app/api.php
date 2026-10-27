<?php
/**
 * API pública: tiendas, catálogo, ofertas, promociones, búsqueda y precios del carrito.
 * Todo lo que modifica datos está en app/admin.php.
 */

const MAX_ITEMS_CARRITO = 60;
const MAX_POR_BLOQUE_VITRINA = 12;

// ================= Formato de salida =================
function imagen_producto(array $f): ?string
{
    if (a_bool($f['tiene_imagen'])) return "/api/productos/{$f['id']}/imagen?v=" . version_ms($f['actualizado_en']);
    return $f['imagen_ruta'] ?: null;
}

function imagen_tienda(array $f): ?string
{
    if (a_bool($f['tiene_portada'])) return "/api/stands/{$f['id']}/portada?v=" . version_ms($f['actualizado_en']);
    return $f['imagen_ruta'] ?: null;
}

// Si la tienda no tiene números propios, se usan los de respaldo de la configuración
function numeros_de(array $stand): array
{
    $propios = is_array($stand['whatsapp']) ? $stand['whatsapp'] : a_lista($stand['whatsapp']);
    return $propios ?: numeros_respaldo();
}

// Fila de COLUMNAS_PRODUCTO → tipos como los daba Node
function producto_de_fila(array $f): array
{
    $f['precio'] = a_float($f['precio']);
    $f['calificacion'] = a_float($f['calificacion']);
    $f['total_resenas'] = (int) $f['total_resenas'];
    $f['total_colores'] = (int) $f['total_colores'];
    return $f;
}

function producto_publico(array $f, array $ofertas = []): array
{
    return [
        'id' => $f['id'],
        'tipo' => $f['tipo'],
        'nombre' => $f['nombre'],
        'subcategoria_id' => $f['subcategoria_id'],
        'precio' => $f['precio'],
        'precio_modo' => $f['precio_modo'],
        'disponibilidad' => $f['disponibilidad'],
        'descripcion' => $f['descripcion'],
        'imagen_url' => imagen_producto($f),
        'calificacion' => $f['calificacion'],
        'resenas' => $f['total_resenas'] ?: 0,
        'colores_total' => $f['total_colores'] ?: 0,
        'agotado' => a_bool($f['agotado']),
        'oferta' => $f['tipo'] === 'producto' && $f['precio_modo'] === 'fijo' ? oferta_para_tarjeta($f, $ofertas) : null,
    ];
}

// Un producto está agotado si no tiene stock (0 o sin capturar) o, si tiene colores, si ningún color disponible
// tiene stock. Los servicios nunca. El número exacto de piezas no se publica.
const SQL_AGOTADO = "(p.tipo = 'producto' AND IF(
    EXISTS (SELECT 1 FROM producto_colores c WHERE c.producto_id = p.id),
    NOT EXISTS (SELECT 1 FROM producto_colores c WHERE c.producto_id = p.id AND c.disponible AND c.stock > 0),
    COALESCE(p.stock, 0) <= 0))";

const COLUMNAS_PRODUCTO = '
  p.id, p.stand_id, p.subcategoria_id, p.tipo, p.nombre, p.precio, p.precio_modo,
  p.disponibilidad, p.descripcion, (p.imagen IS NOT NULL) AS tiene_imagen, p.imagen_ruta, p.actualizado_en,
  (SELECT ROUND(AVG(r.calificacion), 1) FROM resenas r WHERE r.producto_id = p.id AND r.visible) AS calificacion,
  (SELECT COUNT(*) FROM resenas r WHERE r.producto_id = p.id AND r.visible) AS total_resenas,
  (SELECT COUNT(*) FROM producto_colores c WHERE c.producto_id = p.id) AS total_colores,
  ' . SQL_AGOTADO . ' AS agotado';


// ================= Imágenes guardadas en la base =================
// La de algo oculto solo la ve en Necutools quien puede editarlo, y sin caché pública
function servir_imagen(?array $f, callable $puedeVerla): Respuesta
{
    if (!$f || $f['imagen'] === null) return vacia(404);
    if (a_bool($f['publica'])) {
        $cache = 'public, max-age=86400';
    } else {
        Actual::$admin = cargar_admin();
        if (!Actual::$admin || !$puedeVerla()) return vacia(404);
        $cache = 'private, no-store';
    }
    return binaria($f['imagen'], $f['tipo'], ['Cache-Control' => $cache]);
}

// ================= Promociones generales (paquetes) =================
function promociones_vigentes(?array $ids = null, bool $soloDestacadas = false): array
{
    $cuando = hoy();
    $sql = 'SELECT id, titulo, descripcion, precio, inicio, fin, destacada, (imagen IS NOT NULL) AS tiene_imagen, actualizado_en
            FROM promociones WHERE activa AND inicio <= ? AND fin >= ?';
    $params = [$cuando['fecha'], $cuando['fecha']];
    if ($ids !== null) {
        if (!$ids) return [];
        $sql .= ' AND id IN (' . marcas($ids) . ')';
        $params = [...$params, ...$ids];
    }
    if ($soloDestacadas) $sql .= ' AND destacada';
    $promos = filas("$sql ORDER BY destacada DESC, fin, id", $params);
    if (!$promos) return [];

    $idsPromos = array_column($promos, 'id');
    $items = filas(
        'SELECT i.promocion_id, i.cantidad, p.id AS producto_id, p.nombre, p.precio, p.precio_modo,
                s.id AS stand_id, s.nombre AS tienda, s.slug, s.whatsapp, (p.visible AND s.visible) AS publico,
                IF(EXISTS (SELECT 1 FROM producto_colores c WHERE c.producto_id = p.id),
                   (SELECT COALESCE(MAX(c.stock), 0) FROM producto_colores c WHERE c.producto_id = p.id AND c.disponible),
                   COALESCE(p.stock, 0)) AS stock_max
         FROM promocion_items i
         JOIN productos p ON p.id = i.producto_id
         JOIN stands s ON s.id = p.stand_id
         WHERE i.promocion_id IN (' . marcas($idsPromos) . ') ORDER BY s.orden, p.nombre', $idsPromos);
    foreach ($items as &$i) $i['precio'] = a_float($i['precio']);
    unset($i);

    $salida = [];
    foreach ($promos as $promo) {
        $suyos = array_values(array_filter($items, fn($i) => $i['promocion_id'] === $promo['id']));
        // Un paquete con un producto o una tienda oculta no se vende (ni muestra sus WhatsApp)
        if (!$suyos || array_filter($suyos, fn($i) => !a_bool($i['publico']))) continue;
        $precio = (float) $promo['precio'];
        $normal = 0.0;
        foreach ($suyos as $i) $normal += $i['precio_modo'] === 'fijo' ? $i['precio'] * $i['cantidad'] : 0;
        $tiendas = [];
        foreach ($suyos as $i) $tiendas[$i['stand_id']] ??= $i;
        $whatsapp = [];
        foreach ($tiendas as $t) foreach (numeros_de($t) as $n) $whatsapp[] = $n;
        $salida[] = [
            'id' => $promo['id'],
            'titulo' => $promo['titulo'],
            'descripcion' => $promo['descripcion'],
            'precio' => $precio,
            'precio_normal' => $normal > $precio ? redondear($normal) : null,
            'inicio' => $promo['inicio'],
            'fin' => $promo['fin'],
            'destacada' => a_bool($promo['destacada']),
            'imagen_url' => a_bool($promo['tiene_imagen']) ? "/api/promociones/{$promo['id']}/imagen?v=" . version_ms($promo['actualizado_en']) : null,
            'incluye' => array_map(fn($i) => ['producto_id' => $i['producto_id'], 'nombre' => $i['nombre'], 'cantidad' => $i['cantidad'],
                'tienda' => $i['tienda'], 'slug' => $i['slug']], $suyos),
            'tiendas' => array_values(array_map(fn($t) => $t['tienda'], $tiendas)),
            'whatsapp' => array_values(array_unique($whatsapp)),
            // Algún producto no alcanza (con colores: ningún color tiene las piezas que pide el paquete)
            'agotado' => (bool) array_filter($suyos, fn($i) => (int) $i['stock_max'] < $i['cantidad']),
        ];
    }
    return $salida;
}

// ================= Precios del carrito (el servidor manda) =================
function leer_carrito(array $cuerpo): array
{
    $lista = isset($cuerpo['items']) && js_lista($cuerpo['items']) ? $cuerpo['items'] : null;
    if ($lista === null || count($lista) > MAX_ITEMS_CARRITO) throw dato_invalido('El carrito no es válido.');
    $porClave = [];
    foreach ($lista as $item) {
        $objeto = is_array($item) && !array_is_list($item);
        $tipo = $objeto ? (($item['tipo'] ?? null) === 'paquete' ? 'paquete' : (($item['tipo'] ?? null) === 'producto' ? 'producto' : null)) : null;
        $id = $objeto ? id_valido($item['id'] ?? null) : null;
        $cantidad = $objeto ? js_numero($item['cantidad'] ?? NAN) : 0.0;
        // Color elegido (solo productos con colores)
        $conColor = $objeto && $tipo === 'producto' && isset($item['color']);
        $color = $conColor ? id_valido($item['color']) : null;
        if (!$tipo || !$id || !js_entero($cantidad) || $cantidad < 1 || $cantidad > 99 || ($conColor && !$color)) {
            throw dato_invalido('El carrito no es válido.');
        }
        $clave = $color ? "$tipo-$id-c$color" : "$tipo-$id";
        $previo = $porClave[$clave]['cantidad'] ?? 0;
        $porClave[$clave] = ['tipo' => $tipo, 'id' => $id, 'color' => $color, 'cantidad' => min(99, $previo + (int) $cantidad)];
    }
    return array_values($porClave);
}

// Precios y grupos del carrito (una tienda o un paquete por grupo). También lo usa app/pedidos.php.
function calcular_carrito(array $items): array
{
    $idsProductos = array_values(array_unique(array_column(array_filter($items, fn($i) => $i['tipo'] === 'producto'), 'id')));
    $idsPaquetes = array_values(array_unique(array_column(array_filter($items, fn($i) => $i['tipo'] === 'paquete'), 'id')));

    $productos = $idsProductos ? filas(
        'SELECT p.id, p.stand_id, p.subcategoria_id, p.nombre, p.precio, p.stock, s.nombre AS tienda, s.slug, s.orden, s.whatsapp
         FROM productos p JOIN stands s ON s.id = p.stand_id
         WHERE p.id IN (' . marcas($idsProductos) . ") AND p.visible AND s.visible AND p.tipo = 'producto' AND p.precio_modo = 'fijo'",
        $idsProductos) : [];
    foreach ($productos as &$p) $p['precio'] = (float) $p['precio'];
    unset($p);
    $ofertas = $productos ? ofertas_de_hoy(array_values(array_unique(array_column($productos, 'stand_id')))) : [];
    // Colores de esos productos: si un producto tiene colores, hay que elegir uno disponible
    $idsConPrecio = array_column($productos, 'id');
    $colores = $idsConPrecio ? filas('SELECT id, producto_id, nombre, disponible, stock FROM producto_colores WHERE producto_id IN (' . marcas($idsConPrecio) . ')', $idsConPrecio) : [];
    $paquetes = $idsPaquetes ? promociones_vigentes($idsPaquetes) : [];

    $grupos = [];
    $faltantes = [];
    foreach ($items as $item) {
        if ($item['tipo'] === 'producto') {
            $p = null;
            foreach ($productos as $x) if ($x['id'] === $item['id']) $p = $x;
            if (!$p) { $faltantes[] = $item; continue; }
            $tieneColores = (bool) array_filter($colores, fn($c) => $c['producto_id'] === $p['id']);
            $color = null;
            if ($item['color']) foreach ($colores as $c) if ($c['id'] === $item['color'] && $c['producto_id'] === $p['id']) $color = $c;
            if ($tieneColores ? (!$color || !a_bool($color['disponible'])) : $item['color']) { $faltantes[] = $item; continue; }
            // Stock: agotado (o sin capturar) se quita; si pide más de lo que hay, el carrito baja a lo que queda
            $quedan = max(0, (int) ($color ? $color['stock'] : $p['stock']));
            if ($item['cantidad'] > $quedan) { $faltantes[] = $item + ['quedan' => $quedan]; continue; }
            $clave = "tienda-{$p['stand_id']}";
            $grupos[$clave] ??= ['clave' => $clave, 'tipo' => 'tienda', 'nombre' => $p['tienda'], 'slug' => $p['slug'], 'orden' => $p['orden'],
                'whatsapp' => numeros_de($p), 'items' => []];
            $mejor = mejor_precio($p, $ofertas, $item['cantidad']);
            $grupos[$clave]['items'][] = [
                'tipo' => 'producto', 'id' => $p['id'], 'color' => $color ? ['id' => $color['id'], 'nombre' => $color['nombre']] : null,
                'producto' => $p['nombre'], 'nombre' => $color ? "{$p['nombre']} ({$color['nombre']})" : $p['nombre'],
                'cantidad' => $item['cantidad'], 'precio' => $p['precio'],
                'subtotal_base' => redondear($p['precio'] * $item['cantidad']), 'subtotal' => $mejor['total'],
                'oferta' => $mejor['oferta'] ? $mejor['oferta']['titulo'] : null,
            ];
        } else {
            $promo = null;
            foreach ($paquetes as $x) if ($x['id'] === $item['id']) $promo = $x;
            if (!$promo || $promo['agotado']) { $faltantes[] = $item; continue; }
            $subtotal = redondear($promo['precio'] * $item['cantidad']);
            $grupos["paquete-{$promo['id']}"] = [
                'clave' => "paquete-{$promo['id']}", 'tipo' => 'paquete', 'nombre' => $promo['titulo'], 'orden' => -1,
                'tiendas' => $promo['tiendas'], 'incluye' => $promo['incluye'], 'whatsapp' => $promo['whatsapp'],
                'items' => [['tipo' => 'paquete', 'id' => $promo['id'], 'nombre' => $promo['titulo'], 'cantidad' => $item['cantidad'],
                    'precio' => $promo['precio'], 'subtotal_base' => $subtotal, 'subtotal' => $subtotal, 'oferta' => null]],
            ];
        }
    }

    $lista = array_values($grupos);
    usort($lista, fn($a, $b) => ($a['orden'] <=> $b['orden']) ?: comparar_texto($a['nombre'], $b['nombre']));
    $salida = array_map(function ($g) {
        unset($g['orden']);
        $base = redondear(array_sum(array_column($g['items'], 'subtotal_base')));
        $total = redondear(array_sum(array_column($g['items'], 'subtotal')));
        return [...$g, 'subtotal_base' => $base, 'descuento' => redondear($base - $total), 'total' => $total];
    }, $lista);

    // En el JSON, cada faltante sale como lo leyó leerCarrito en Node
    // "quedan" solo cuando el producto sí tiene piezas pero menos de las pedidas
    return ['grupos' => $salida, 'faltantes' => array_map(fn($i) => ['tipo' => $i['tipo'], 'id' => $i['id'], 'color' => $i['color'], 'cantidad' => $i['cantidad']]
        + (($i['quedan'] ?? 0) > 0 ? ['quedan' => $i['quedan']] : []), $faltantes)];
}

function rutas_api(): void
{
    get('/api/config', fn() => ['whatsapp' => numeros_respaldo(), 'cuentas' => cuentas_clientes()]);

    // ================= Tiendas =================
    get('/api/stands', function () {
        $cuando = hoy();
        $filas = filas(
            "SELECT s.id, s.nombre, s.slug, s.descripcion, s.icono, s.imagen_ruta, s.actualizado_en,
                    (s.portada IS NOT NULL) AS tiene_portada,
                    (SELECT COUNT(*) FROM productos p WHERE p.stand_id = s.id AND p.visible AND p.tipo = 'producto') AS productos,
                    (SELECT COUNT(*) FROM productos p WHERE p.stand_id = s.id AND p.visible AND p.tipo = 'servicio') AS servicios,
                    (SELECT COUNT(*) FROM ofertas o WHERE o.stand_id = s.id AND " . VIGENTE_HOY . ") AS ofertas_hoy
             FROM stands s WHERE s.visible ORDER BY s.orden, s.nombre", vigente_params($cuando));
        return array_map(fn($s) => [
            'id' => $s['id'], 'nombre' => $s['nombre'], 'slug' => $s['slug'], 'descripcion' => $s['descripcion'], 'icono' => $s['icono'],
            'imagen_url' => imagen_tienda($s), 'productos' => (int) $s['productos'], 'servicios' => (int) $s['servicios'],
            'ofertas_hoy' => (int) $s['ofertas_hoy'],
        ], $filas);
    });

    get('/api/stands/:slug', function ($slug) {
        $stand = fila('SELECT id, nombre, slug, descripcion, icono, whatsapp, imagen_ruta, actualizado_en, (portada IS NOT NULL) AS tiene_portada
                       FROM stands WHERE slug = ? AND visible', [mb_substr($slug, 0, 60)]);
        if (!$stand) return json_respuesta(['error' => 'Esta tienda no existe o ya no está disponible.'], 404);

        $cuando = hoy();
        $subcategorias = filas('SELECT id, nombre, slug FROM subcategorias WHERE stand_id = ? ORDER BY orden, nombre', [$stand['id']]);
        $productos = array_map('producto_de_fila', filas('SELECT ' . COLUMNAS_PRODUCTO . ' FROM productos p
            WHERE p.stand_id = ? AND p.visible ORDER BY p.orden, p.creado_en DESC, p.id DESC', [$stand['id']]));
        // Las activas que no han vencido (las de temporada que aún no empiezan se ven como "próximamente")
        $ofertas = array_map('oferta_de_fila', filas('SELECT ' . COLUMNAS_OFERTA . ' FROM ofertas o
            WHERE o.stand_id = ? AND o.activa AND (o.fin IS NULL OR o.fin >= ?) ORDER BY o.id', [$stand['id'], $cuando['fecha']]));
        $deHoy = array_values(array_filter($ofertas, fn($o) => vigente_hoy($o, $cuando)));

        return [
            'tienda' => [
                'id' => $stand['id'], 'nombre' => $stand['nombre'], 'slug' => $stand['slug'], 'descripcion' => $stand['descripcion'],
                'icono' => $stand['icono'], 'imagen_url' => imagen_tienda($stand), 'whatsapp' => numeros_de($stand),
            ],
            'subcategorias' => $subcategorias,
            'productos' => array_values(array_map(fn($p) => producto_publico($p, $deHoy), array_filter($productos, fn($p) => $p['tipo'] === 'producto'))),
            'servicios' => array_values(array_map(fn($p) => producto_publico($p), array_filter($productos, fn($p) => $p['tipo'] === 'servicio'))),
            'ofertas' => array_map(fn($o) => oferta_publica($o, $cuando), $ofertas),
        ];
    });

    // ================= Imágenes =================
    get('/api/stands/:id/portada', function ($id) {
        $id = id_valido($id);
        if (!$id) return vacia(404);
        $f = fila('SELECT portada AS imagen, portada_tipo AS tipo, visible AS publica FROM stands WHERE id = ?', [$id]);
        return servir_imagen($f, fn() => puede_editar_stand($id));
    });

    get('/api/productos/:id/imagen', function ($id) {
        $id = id_valido($id);
        if (!$id) return vacia(404);
        $f = fila('SELECT p.imagen, p.imagen_tipo AS tipo, p.stand_id, (p.visible AND s.visible) AS publica
                   FROM productos p JOIN stands s ON s.id = p.stand_id WHERE p.id = ?', [$id]);
        return servir_imagen($f, fn() => puede_editar_stand($f['stand_id']));
    });

    get('/api/colores/:id/imagen', function ($id) {
        $id = id_valido($id);
        if (!$id) return vacia(404);
        $f = fila('SELECT c.imagen, c.imagen_tipo AS tipo, p.stand_id, (p.visible AND s.visible) AS publica
                   FROM producto_colores c JOIN productos p ON p.id = c.producto_id JOIN stands s ON s.id = p.stand_id
                   WHERE c.id = ?', [$id]);
        return servir_imagen($f, fn() => puede_editar_stand($f['stand_id']));
    });

    // ================= Detalle de un producto o servicio =================
    get('/api/productos/:id', function ($id) {
        $no = json_respuesta(['error' => 'Este producto no existe o ya no está disponible.'], 404);
        $id = id_valido($id);
        if (!$id) return $no;
        $f = fila('SELECT ' . COLUMNAS_PRODUCTO . ', s.nombre AS tienda, s.slug, s.icono, s.whatsapp, sc.nombre AS subcategoria
                   FROM productos p JOIN stands s ON s.id = p.stand_id
                   LEFT JOIN subcategorias sc ON sc.id = p.subcategoria_id
                   WHERE p.id = ? AND p.visible AND s.visible', [$id]);
        if (!$f) return $no;
        $f = producto_de_fila($f);
        $ofertas = $f['tipo'] === 'producto' ? ofertas_de_hoy([$f['stand_id']]) : [];
        $producto = producto_publico($f, $ofertas);
        $colores = filas('SELECT id, nombre, hex, (disponible AND stock > 0) AS disponible, (imagen IS NOT NULL) AS tiene_imagen, actualizado_en
                          FROM producto_colores WHERE producto_id = ? ORDER BY orden, id', [$f['id']]);
        return [
            ...$producto,
            'colores' => array_map(fn($c) => [
                'id' => $c['id'], 'nombre' => $c['nombre'], 'hex' => $c['hex'], 'disponible' => a_bool($c['disponible']),
                'imagen_url' => a_bool($c['tiene_imagen']) ? "/api/colores/{$c['id']}/imagen?v=" . version_ms($c['actualizado_en']) : $producto['imagen_url'],
            ], $colores),
            'tienda' => $f['tienda'], 'slug' => $f['slug'], 'icono' => $f['icono'], 'subcategoria' => $f['subcategoria'],
            'whatsapp' => $f['tipo'] === 'servicio' ? numeros_de($f) : [],
        ];
    });

    // ================= Ofertas de hoy (portada) =================
    get('/api/hoy', function () {
        $cuando = hoy();
        $ofertas = filas('SELECT o.id, o.titulo, o.descripcion, o.clase, s.nombre AS tienda, s.slug, s.icono
                          FROM ofertas o JOIN stands s ON s.id = o.stand_id
                          WHERE ' . VIGENTE_HOY . ' AND s.visible ORDER BY s.orden, s.nombre, o.id', vigente_params($cuando));
        return ['fecha' => $cuando['fecha'], 'dia' => $cuando['dia'], 'ofertas' => $ofertas];
    });

    // ================= Vitrina de ofertas (final de la portada y de cada tienda) =================
    // Productos con oferta vigente hoy, en bloques: uno por temporada, las semanales de hoy y los remates.
    get('/api/vitrina', function () {
        $cuando = hoy();
        $slug = is_string(consulta('tienda')) && consulta('tienda') !== '' ? mb_substr(consulta('tienda'), 0, 60) : null;
        $params = vigente_params($cuando);
        $sql = 'SELECT ' . COLUMNAS_OFERTA . ' FROM ofertas o JOIN stands s ON s.id = o.stand_id WHERE ' . VIGENTE_HOY . ' AND s.visible';
        if ($slug !== null) {
            $sql .= ' AND s.slug = ?';
            $params[] = $slug;
        }
        $ofertas = array_map('oferta_de_fila', filas($sql, $params));
        if (!$ofertas) return ['dia' => $cuando['dia'], 'bloques' => []];

        $standIds = array_values(array_unique(array_column($ofertas, 'stand_id')));
        $productos = array_map('producto_de_fila', filas('SELECT ' . COLUMNAS_PRODUCTO . ', s.nombre AS tienda, s.slug, s.icono
            FROM productos p JOIN stands s ON s.id = p.stand_id
            WHERE p.stand_id IN (' . marcas($standIds) . ") AND p.visible AND p.tipo = 'producto' AND p.precio_modo = 'fijo'
            ORDER BY s.orden, p.orden, p.creado_en DESC, p.id DESC", $standIds));

        // Cada producto va al bloque de la oferta que le da el mejor precio
        $bloques = [];
        foreach ($productos as $f) {
            $producto = producto_publico($f, $ofertas);
            $oferta = $producto['oferta'];
            if (!$oferta) continue;
            $clave = $oferta['clase'] === 'temporada' ? 'temporada-' . mb_strtolower($oferta['temporada']) : $oferta['clase'];
            $bloques[$clave] ??= ['clave' => $clave, 'clase' => $oferta['clase'], 'temporada' => $oferta['temporada'], 'total' => 0, 'productos' => []];
            $bloques[$clave]['total'] += 1;
            if (count($bloques[$clave]['productos']) < MAX_POR_BLOQUE_VITRINA) {
                $bloques[$clave]['productos'][] = [...$producto, 'tienda' => $f['tienda'], 'slug' => $f['slug'], 'icono' => $f['icono']];
            }
        }
        $orden = ['temporada' => 0, 'semanal' => 1, 'remate' => 2];
        $lista = array_values($bloques);
        usort($lista, fn($a, $b) => ($orden[$a['clase']] <=> $orden[$b['clase']])
            ?: comparar_texto((string) ($a['temporada'] ?? 'null'), (string) ($b['temporada'] ?? 'null')));
        return ['dia' => $cuando['dia'], 'bloques' => $lista];
    });

    // ================= Promociones =================
    get('/api/promociones', function () {
        $promos = promociones_vigentes(null, consulta('destacadas') === '1');
        return array_map(function ($p) {
            unset($p['whatsapp']);
            return $p;
        }, $promos);
    });

    get('/api/promociones/:id/imagen', function ($id) {
        $id = id_valido($id);
        if (!$id) return vacia(404);
        $f = fila('SELECT imagen, imagen_tipo AS tipo, activa AS publica FROM promociones WHERE id = ?', [$id]);
        return servir_imagen($f, fn() => Actual::$admin['rol'] === 'dueno');
    });

    // ================= Búsqueda =================
    get('/api/buscar', function () {
        $q = is_string(consulta('q')) ? js_trim(consulta('q')) : '';
        if (mb_strlen($q) < 2 || mb_strlen($q) > 60) throw dato_invalido('Escribe de 2 a 60 letras para buscar.');
        $patron = '%' . addcslashes(mb_strtolower($q), '\\%_') . '%';
        $filas = filas('SELECT ' . COLUMNAS_PRODUCTO . ", s.nombre AS tienda, s.slug, s.icono
            FROM productos p JOIN stands s ON s.id = p.stand_id
            WHERE p.visible AND s.visible AND (LOWER(p.nombre) LIKE ? OR LOWER(p.descripcion) LIKE ?)
            ORDER BY (LOWER(p.nombre) LIKE ?) DESC, s.orden, p.nombre
            LIMIT 20", [$patron, $patron, substr($patron, 1)]);
        return array_map(fn($f) => [...producto_publico(producto_de_fila($f)), 'tienda' => $f['tienda'], 'slug' => $f['slug'], 'icono' => $f['icono']], $filas);
    });

    post('/api/carrito/precios', fn() => calcular_carrito(leer_carrito(cuerpo())));
}
