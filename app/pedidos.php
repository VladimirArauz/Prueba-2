<?php
/**
 * Pedidos enviados por WhatsApp.
 * Público: guardar el pedido de un grupo del carrito al tocar "Enviar pedido por WhatsApp"
 * (precios del servidor, sin datos del cliente).
 * Necutools (/api/admin): lista de pedidos, estado (en proceso, pagado, cancelado), edición de los artículos
 * mientras está en proceso, stock que se descuenta al pagar y resumen del dashboard.
 */

const ESTADOS_PEDIDO = ['en_proceso', 'pagado', 'cancelado'];
// De qué estado a cuál se puede pasar. Al entrar a "pagado" se descuenta el stock; al salir, regresa.
const TRANSICIONES_PEDIDO = [
    'en_proceso' => ['pagado', 'cancelado'],
    'pagado' => ['en_proceso', 'cancelado'],
    'cancelado' => ['en_proceso'],
];
const PERIODOS = [7, 30, 90];
const PEDIDOS_POR_PAGINA = 20;
// Un pedido de estudiante no pasa de esto; más grande huele a pedido inventado
const MAX_PIEZAS = 30;
const MAX_PRODUCTOS = 15;
// Más pedidos que esto en una hora (todas las IP juntas) ya no se guardan; WhatsApp se abre igual
const MAX_PEDIDOS_POR_HORA = 500;
// México no tiene horario de verano desde 2022: Ciudad de México es siempre UTC-6
const DESFASE_MX = '-06:00';

// ================= Necutools: filtros y permisos =================
// Dueños: todos los pedidos (también paquetes). Encargados: solo los de sus tiendas.
function tiendas_de_admin(): ?array
{
    return Actual::$admin['rol'] === 'dueno' ? null : Actual::$admin['tiendas'];
}

function tienda_filtro($valor): ?int
{
    if ($valor === null || $valor === '' || $valor === 'todas') return null;
    $id = id_valido($valor);
    if (!$id) throw dato_invalido('Elige una tienda.');
    if (!puede_editar_stand($id)) throw new ErrorHttp(403, 'No tienes permiso para ver esta tienda.');
    return $id;
}

// Condición sobre stand_id de la tabla con alias $alias: [sql, parámetros]
function en_alcance(string $alias, ?int $tienda, ?array $tiendas): array
{
    $sql = [];
    $params = [];
    if ($tienda !== null) {
        $sql[] = "$alias.stand_id = ?";
        $params[] = $tienda;
    }
    if ($tiendas !== null) {
        $sql[] = $tiendas ? "$alias.stand_id IN (" . marcas($tiendas) . ')' : 'FALSE';
        $params = [...$params, ...$tiendas];
    }
    return [$sql ? implode(' AND ', $sql) : 'TRUE', $params];
}

const COLUMNAS_PEDIDO = '
  pe.id, pe.stand_id, s.nombre AS tienda, pe.promocion_id, pr.titulo AS paquete, pe.items, pe.total,
  pe.piezas, pe.estado, pe.nota, pe.creado_en';
const UNIR_PEDIDO = '
  FROM pedidos pe
  LEFT JOIN stands s ON s.id = pe.stand_id
  LEFT JOIN promociones pr ON pr.id = pe.promocion_id';

function pedido_admin(array $f, ?array $lineas = null): array
{
    return [
        'id' => $f['id'], 'stand_id' => $f['stand_id'], 'tienda' => $f['tienda'], 'promocion_id' => $f['promocion_id'], 'paquete' => $f['paquete'],
        'items' => $lineas ?? a_lista($f['items']), 'total' => (float) $f['total'], 'piezas' => $f['piezas'], 'estado' => $f['estado'], 'nota' => $f['nota'],
        'creado_en' => fecha_iso($f['creado_en']),
    ];
}

// ================= Artículos de los pedidos (pedido_items) =================
// Líneas de varios pedidos, con el stock de hoy para que el vendedor vea si alcanza:
// [pedido_id => [línea, …]]. En los paquetes, cada producto con colores trae sus colores y el elegido.
function lineas_de_pedidos(array $ids): array
{
    if (!$ids) return [];
    $filas = filas('SELECT pi.id, pi.pedido_id, pi.tipo, pi.producto_id, pi.color_id, pi.promocion_id, pi.nombre, pi.cantidad, pi.precio, pi.subtotal,
                           p.stock AS stock_producto, c.nombre AS color, c.stock AS stock_color,
                           EXISTS (SELECT 1 FROM producto_colores x WHERE x.producto_id = pi.producto_id) AS con_colores
                    FROM pedido_items pi
                    LEFT JOIN productos p ON p.id = pi.producto_id
                    LEFT JOIN producto_colores c ON c.id = pi.color_id
                    WHERE pi.pedido_id IN (' . marcas($ids) . ') ORDER BY pi.pedido_id, pi.orden, pi.id', $ids);
    $promos = array_values(array_unique(array_filter(array_column($filas, 'promocion_id'))));
    $contenido = $promos ? filas('SELECT i.promocion_id, i.producto_id, i.cantidad, p.nombre, p.stock
                                  FROM promocion_items i JOIN productos p ON p.id = i.producto_id
                                  WHERE i.promocion_id IN (' . marcas($promos) . ') ORDER BY p.nombre', $promos) : [];
    $idsProd = array_values(array_unique(array_column($contenido, 'producto_id')));
    $colores = $idsProd ? filas('SELECT id, producto_id, nombre, stock FROM producto_colores WHERE producto_id IN (' . marcas($idsProd) . ') ORDER BY orden, id', $idsProd) : [];
    $idsLineas = array_column(array_filter($filas, fn($f) => $f['tipo'] === 'paquete'), 'id');
    $elegidos = $idsLineas ? filas('SELECT pedido_item_id, producto_id, color_id FROM pedido_paquete_colores WHERE pedido_item_id IN (' . marcas($idsLineas) . ')', $idsLineas) : [];

    $salida = [];
    foreach ($filas as $f) {
        $linea = [
            'linea' => $f['id'], 'tipo' => $f['tipo'], 'id' => $f['tipo'] === 'producto' ? $f['producto_id'] : $f['promocion_id'],
            'color' => $f['color_id'] ? ['id' => $f['color_id'], 'nombre' => $f['color']] : null,
            'nombre' => $f['nombre'], 'cantidad' => $f['cantidad'], 'precio' => a_float($f['precio']), 'subtotal' => a_float($f['subtotal']),
            // Piezas que hay hoy (null: sin capturar o el producto ya no existe)
            'stock' => $f['tipo'] === 'producto' ? ($f['color_id'] ? $f['stock_color'] : (a_bool($f['con_colores']) ? null : $f['stock_producto'])) : null,
            'falta_color' => $f['tipo'] === 'producto' && $f['producto_id'] && !$f['color_id'] && a_bool($f['con_colores']),
        ];
        if ($f['tipo'] === 'paquete') {
            $linea['contenido'] = array_values(array_map(function ($i) use ($colores, $elegidos, $f) {
                $suyos = array_values(array_filter($colores, fn($c) => $c['producto_id'] === $i['producto_id']));
                $elegido = null;
                foreach ($elegidos as $e) if ($e['pedido_item_id'] === $f['id'] && $e['producto_id'] === $i['producto_id']) $elegido = $e['color_id'];
                return ['producto_id' => $i['producto_id'], 'nombre' => $i['nombre'], 'cantidad' => $i['cantidad'] * $f['cantidad'],
                    'stock' => $suyos ? null : $i['stock'], 'color_id' => $elegido,
                    'colores' => array_map(fn($c) => ['id' => $c['id'], 'nombre' => $c['nombre'], 'stock' => $c['stock']], $suyos)];
            }, array_filter($contenido, fn($i) => $i['promocion_id'] === $f['promocion_id'])));
        }
        $salida[$f['pedido_id']][] = $linea;
    }
    return $salida;
}

// Guarda las líneas de un pedido (las anteriores se borran) y actualiza total, piezas y el JSON de respaldo
function guardar_lineas(int $pedidoId, array $lineas): void
{
    q('DELETE FROM pedido_items WHERE pedido_id = ?', [$pedidoId]);
    foreach ($lineas as $orden => $l) {
        q('INSERT INTO pedido_items (pedido_id, tipo, producto_id, color_id, promocion_id, nombre, cantidad, precio, subtotal, orden)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [$pedidoId, $l['tipo'], $l['tipo'] === 'producto' ? $l['id'] : null, $l['color'] ?? null, $l['tipo'] === 'paquete' ? $l['id'] : null,
           mb_substr($l['nombre'], 0, 160), $l['cantidad'], $l['precio'], $l['subtotal'], $orden]);
        $lineaId = ultimo_id();
        foreach ($l['colores_paquete'] ?? [] as $productoId => $colorId) {
            q('INSERT INTO pedido_paquete_colores (pedido_item_id, producto_id, color_id) VALUES (?, ?, ?)', [$lineaId, $productoId, $colorId]);
        }
    }
    // pedidos.items se sigue llenando (el resumen del dashboard lo lee)
    $json = array_map(function ($l) {
        $item = ['tipo' => $l['tipo'], 'id' => $l['id'], 'nombre' => $l['nombre'], 'cantidad' => $l['cantidad'], 'subtotal' => $l['subtotal']];
        if (!empty($l['color'])) $item += ['color' => $l['color'], 'producto' => $l['producto'] ?? $l['nombre']];
        return $item;
    }, $lineas);
    q('UPDATE pedidos SET items = ?, total = ?, piezas = ?, actualizado_en = UTC_TIMESTAMP(6) WHERE id = ?',
      [json_encode($json, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), redondear(array_sum(array_column($lineas, 'subtotal'))),
       array_sum(array_column($lineas, 'cantidad')), $pedidoId]);
}

// ================= Stock al pagar y al regresar un pedido =================
// Piezas que pide el pedido, por producto y color: ['p-c' => [producto, color, piezas, nombre]]
function piezas_del_pedido(int $pedidoId): array
{
    $necesita = [];
    $sumar = function (int $producto, ?int $color, int $piezas, string $nombre) use (&$necesita) {
        $k = "$producto-" . ($color ?? 0);
        $necesita[$k] ??= ['producto' => $producto, 'color' => $color, 'piezas' => 0, 'nombre' => $nombre];
        $necesita[$k]['piezas'] += $piezas;
    };
    foreach (lineas_de_pedidos([$pedidoId])[$pedidoId] ?? [] as $l) {
        if ($l['tipo'] === 'producto') {
            if ($l['id'] === null) continue; // el producto se borró: no hay stock que mover
            if ($l['falta_color']) throw dato_invalido("Elige el color de {$l['nombre']} antes de marcarlo como pagado.");
            $sumar($l['id'], $l['color']['id'] ?? null, $l['cantidad'], $l['nombre']);
            continue;
        }
        foreach ($l['contenido'] ?? [] as $c) {
            if ($c['colores'] && !$c['color_id']) throw dato_invalido("Elige el color de {$c['nombre']} en el paquete {$l['nombre']}.");
            $nombre = $c['nombre'];
            foreach ($c['colores'] as $color) if ($color['id'] === $c['color_id']) $nombre .= " ({$color['nombre']})";
            $sumar($c['producto_id'], $c['color_id'], $c['cantidad'], $nombre);
        }
    }
    return array_values($necesita);
}

// en_proceso → pagado: revisa que alcance todo (con las filas bloqueadas) y descuenta
function descontar_stock(int $pedidoId, array $admin): void
{
    foreach (piezas_del_pedido($pedidoId) as $n) {
        $hay = $n['color']
            ? fila('SELECT stock FROM producto_colores WHERE id = ? AND producto_id = ? FOR UPDATE', [$n['color'], $n['producto']])
            : fila('SELECT stock FROM productos WHERE id = ? FOR UPDATE', [$n['producto']]);
        if (!$hay) throw new ErrorHttp(409, "{$n['nombre']} ya no existe. Quítalo del pedido antes de marcarlo como pagado.");
        $stock = $hay['stock'];
        if ($stock === null) throw new ErrorHttp(409, "{$n['nombre']} no tiene stock capturado. Captúralo en Productos y vuelve a intentar.");
        if ($stock < $n['piezas']) throw new ErrorHttp(409, "Solo quedan $stock de {$n['nombre']} y el pedido pide {$n['piezas']}.");
        if ($n['color']) q('UPDATE producto_colores SET stock = stock - ? WHERE id = ?', [$n['piezas'], $n['color']]);
        else q('UPDATE productos SET stock = stock - ? WHERE id = ?', [$n['piezas'], $n['producto']]);
        q("INSERT INTO movimientos_stock (producto_id, color_id, pedido_id, cambio, motivo, admin_id) VALUES (?, ?, ?, ?, 'pago', ?)",
          [$n['producto'], $n['color'], $pedidoId, -$n['piezas'], $admin['id']]);
    }
}

// pagado → en proceso o cancelado: regresa exactamente lo que se descontó (aunque el pedido se haya editado)
function devolver_stock(int $pedidoId, array $admin): void
{
    $saldos = filas("SELECT m.producto_id, m.color_id, SUM(m.cambio) AS saldo,
                            EXISTS (SELECT 1 FROM producto_colores c WHERE c.producto_id = m.producto_id) AS con_colores
                     FROM movimientos_stock m WHERE m.pedido_id = ? AND m.motivo IN ('pago', 'reversa')
                     GROUP BY m.producto_id, m.color_id HAVING SUM(m.cambio) <> 0", [$pedidoId]);
    foreach ($saldos as $s) {
        $regresa = -(int) $s['saldo'];
        // Si el color se borró (color_id quedó en NULL), esas piezas ya no tienen a dónde volver
        if ($s['color_id'] === null && a_bool($s['con_colores'])) continue;
        if ($s['color_id']) q('UPDATE producto_colores SET stock = GREATEST(0, COALESCE(stock, 0) + ?) WHERE id = ?', [$regresa, $s['color_id']]);
        else q('UPDATE productos SET stock = GREATEST(0, COALESCE(stock, 0) + ?) WHERE id = ?', [$regresa, $s['producto_id']]);
        q("INSERT INTO movimientos_stock (producto_id, color_id, pedido_id, cambio, motivo, admin_id) VALUES (?, ?, ?, ?, 'reversa', ?)",
          [$s['producto_id'], $s['color_id'], $pedidoId, $regresa, $admin['id']]);
    }
}

// Pedido que puede ver y cambiar quien está en Necutools (paquetes: solo dueños)
function exigir_pedido_admin(array $admin, $idRuta, bool $bloquear = false): array
{
    $id = id_valido($idRuta);
    $pedido = $id ? fila('SELECT id, stand_id, promocion_id, estado, nota FROM pedidos WHERE id = ?' . ($bloquear ? ' FOR UPDATE' : ''), [$id]) : null;
    if (!$pedido) throw new ErrorHttp(404, 'Ese pedido no existe.');
    $permitido = $pedido['stand_id'] === null ? $admin['rol'] === 'dueno' : puede_editar_stand($pedido['stand_id']);
    if (!$permitido) throw new ErrorHttp(403, 'No tienes permiso para cambiar este pedido.');
    return $pedido;
}

// Lista nueva de artículos de un pedido en proceso. El servidor pone precios y revisa que cada artículo sea
// de la tienda del pedido (que es de quien edita). Un pedido de paquete solo lleva paquetes.
function leer_lineas_nuevas(array $pedido, $lista): array
{
    if (!js_lista($lista)) throw dato_invalido('La lista de artículos no es válida.');
    if (!$lista) throw dato_invalido('Un pedido necesita al menos un artículo. Si ya no lo quieren, cancela el pedido.');
    if (count($lista) > MAX_PRODUCTOS) throw dato_invalido('Un pedido puede tener hasta ' . MAX_PRODUCTOS . ' artículos.');
    $deTienda = $pedido['stand_id'] !== null;
    $porClave = [];
    foreach ($lista as $item) {
        $objeto = is_array($item) && !array_is_list($item);
        $tipo = $objeto ? ($item['tipo'] ?? null) : null;
        $id = $objeto ? id_valido($item['id'] ?? null) : null;
        $cantidad = $objeto ? js_numero($item['cantidad'] ?? NAN) : NAN;
        if ($tipo !== ($deTienda ? 'producto' : 'paquete') || !$id || !js_entero($cantidad) || $cantidad < 1 || $cantidad > MAX_PIEZAS) {
            throw dato_invalido($deTienda ? 'Revisa los artículos: cada uno necesita una cantidad de 1 a ' . MAX_PIEZAS . '.'
                                          : 'Un pedido de paquete solo puede llevar paquetes.');
        }
        $color = isset($item['color']) ? id_valido($item['color']) : null;
        if (isset($item['color']) && !$color) throw dato_invalido('El color no es válido.');
        $colores = [];
        if (!$deTienda && isset($item['colores'])) {
            if (!is_array($item['colores']) || array_is_list($item['colores']) && $item['colores']) throw dato_invalido('Los colores del paquete no son válidos.');
            foreach ($item['colores'] as $prod => $col) {
                $p = id_valido($prod);
                $c = $col === null || $col === '' ? null : id_valido($col);
                if (!$p || ($col !== null && $col !== '' && !$c)) throw dato_invalido('Los colores del paquete no son válidos.');
                if ($c) $colores[$p] = $c;
            }
        }
        $clave = "$tipo-$id-" . ($color ?? 0);
        $previo = $porClave[$clave]['cantidad'] ?? 0;
        $porClave[$clave] = ['tipo' => $tipo, 'id' => $id, 'color' => $color, 'cantidad' => $previo + (int) $cantidad, 'colores' => $colores];
    }
    $items = array_values($porClave);
    if (array_sum(array_column($items, 'cantidad')) > MAX_PIEZAS) throw dato_invalido('Un pedido puede tener hasta ' . MAX_PIEZAS . ' piezas.');

    $ids = array_values(array_unique(array_column($items, 'id')));
    $lineas = [];
    if ($deTienda) {
        $productos = filas("SELECT id, stand_id, subcategoria_id, nombre, precio FROM productos
                            WHERE id IN (" . marcas($ids) . ") AND tipo = 'producto' AND precio_modo = 'fijo'", $ids);
        foreach ($productos as &$p) $p['precio'] = (float) $p['precio'];
        unset($p);
        $colores = filas('SELECT id, producto_id, nombre FROM producto_colores WHERE producto_id IN (' . marcas($ids) . ')', $ids);
        $ofertas = ofertas_de_hoy([$pedido['stand_id']]);
        foreach ($items as $i) {
            $p = null;
            foreach ($productos as $x) if ($x['id'] === $i['id']) $p = $x;
            if (!$p) throw dato_invalido('Uno de los artículos ya no existe o no se vende con precio fijo.');
            // Solo artículos de la tienda del pedido: un encargado de Ropa no agrega nada de Regalos
            if ($p['stand_id'] !== $pedido['stand_id'] || !puede_editar_stand($p['stand_id'])) {
                throw new ErrorHttp(403, "{$p['nombre']} no es de la tienda de este pedido.");
            }
            $suyos = array_values(array_filter($colores, fn($c) => $c['producto_id'] === $p['id']));
            $color = null;
            foreach ($suyos as $c) if ($c['id'] === $i['color']) $color = $c;
            if ($suyos && !$color) throw dato_invalido("Elige el color de {$p['nombre']}.");
            if (!$suyos && $i['color']) throw dato_invalido("{$p['nombre']} no tiene colores.");
            $mejor = mejor_precio($p, $ofertas, $i['cantidad']);
            $lineas[] = ['tipo' => 'producto', 'id' => $p['id'], 'color' => $color['id'] ?? null, 'producto' => $p['nombre'],
                'nombre' => $color ? "{$p['nombre']} ({$color['nombre']})" : $p['nombre'], 'cantidad' => $i['cantidad'],
                'precio' => $p['precio'], 'subtotal' => $mejor['total']];
        }
        return $lineas;
    }
    $promos = filas('SELECT id, titulo, precio FROM promociones WHERE id IN (' . marcas($ids) . ')', $ids);
    $contenido = filas('SELECT i.promocion_id, i.producto_id FROM promocion_items i WHERE i.promocion_id IN (' . marcas($ids) . ')', $ids);
    $idsProd = array_values(array_unique(array_column($contenido, 'producto_id')));
    $colores = $idsProd ? filas('SELECT id, producto_id FROM producto_colores WHERE producto_id IN (' . marcas($idsProd) . ')', $idsProd) : [];
    foreach ($items as $i) {
        $promo = null;
        foreach ($promos as $x) if ($x['id'] === $i['id']) $promo = $x;
        if (!$promo) throw dato_invalido('Uno de los paquetes ya no existe.');
        $suyos = array_column(array_filter($contenido, fn($c) => $c['promocion_id'] === $promo['id']), 'producto_id');
        foreach ($i['colores'] as $prod => $col) {
            $valido = in_array($prod, $suyos, true) && array_filter($colores, fn($c) => $c['id'] === $col && $c['producto_id'] === $prod);
            if (!$valido) throw dato_invalido("Un color elegido no es de un producto del paquete {$promo['titulo']}.");
        }
        $precio = (float) $promo['precio'];
        $lineas[] = ['tipo' => 'paquete', 'id' => $promo['id'], 'nombre' => $promo['titulo'], 'cantidad' => $i['cantidad'],
            'precio' => $precio, 'subtotal' => redondear($precio * $i['cantidad']), 'colores_paquete' => $i['colores']];
    }
    return $lineas;
}

function cambio_porcentaje(float $actual, float $anterior): ?int
{
    if (!$anterior) return $actual ? null : 0; // null = no hay con qué comparar
    return (int) floor((($actual - $anterior) / $anterior) * 100 + 0.5);
}

// Fecha local (CDMX) de un DATETIME en UTC
function dia_local(string $utc): string
{
    return (new DateTimeImmutable($utc, new DateTimeZone('UTC')))->setTimezone(new DateTimeZone(DESFASE_MX))->format('Y-m-d');
}

function rutas_pedidos(): void
{
    // ================= Guardar un pedido (público) =================
    post('/api/pedidos', function () {
        // Holgado porque muchos estudiantes entran desde la misma IP de la escuela
        limitar('pedidos', 40, UNA_HORA, 'Enviaste muchos pedidos seguidos. Espera un rato y vuelve a intentar.');
        $clave = is_string(campo('clave')) ? campo('clave') : '';
        if (!preg_match('/^(tienda|paquete)-([1-9][0-9]{0,9})$/', $clave, $m)) throw dato_invalido('El pedido no es válido.');

        $grupo = null;
        foreach (calcular_carrito(leer_carrito(cuerpo()))['grupos'] as $g) if ($g['clave'] === $clave) $grupo = $g;
        if (!$grupo) throw dato_invalido('Ese pedido ya no está disponible. Recarga el carrito.');

        $items = array_map(function ($i) {
            $item = ['tipo' => $i['tipo'], 'id' => $i['id'], 'nombre' => $i['nombre'], 'cantidad' => $i['cantidad'], 'subtotal' => $i['subtotal']];
            if (!empty($i['color'])) $item += ['color' => $i['color']['id'], 'producto' => $i['producto']];
            return $item;
        }, $grupo['items']);
        $piezas = array_sum(array_column($items, 'cantidad'));
        if ($piezas > MAX_PIEZAS || count($items) > MAX_PRODUCTOS) {
            throw dato_invalido('Un pedido puede tener hasta ' . MAX_PIEZAS . ' piezas y ' . MAX_PRODUCTOS . ' productos. Para más, escríbele a la tienda.');
        }

        // El mismo pedido desde la misma conexión en 10 minutos es el mismo (se tocó dos veces el botón).
        // Se guarda una huella con HMAC, no la IP.
        $huella = hash_hmac('sha256', json_encode([ip_cliente(), $clave,
            array_map(fn($i) => [$i['tipo'], $i['id'], $i['color'] ?? null, $i['cantidad']], $items)], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), config('secreto'));
        $previo = valor('SELECT id FROM pedidos WHERE huella = ? AND creado_en > UTC_TIMESTAMP(6) - INTERVAL 10 MINUTE ORDER BY id DESC LIMIT 1', [$huella]);
        if ($previo) return ['id' => (int) $previo, 'repetido' => true];

        $ultimaHora = (int) valor('SELECT COUNT(*) FROM pedidos WHERE creado_en > UTC_TIMESTAMP(6) - INTERVAL 1 HOUR');
        if ($ultimaHora >= MAX_PEDIDOS_POR_HORA) throw new ErrorHttp(429, 'Hay demasiados pedidos en este momento. Tu pedido se manda igual por WhatsApp.');

        $id = (int) $m[2];
        $nuevo = en_transaccion(function () use ($m, $id, $items, $grupo, $piezas, $huella) {
            q('INSERT INTO pedidos (stand_id, promocion_id, items, total, piezas, huella) VALUES (?, ?, ?, ?, ?, ?)',
              [$m[1] === 'tienda' ? $id : null, $m[1] === 'paquete' ? $id : null,
               json_encode($items, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $grupo['total'], $piezas, $huella]);
            $pedidoId = ultimo_id();
            foreach ($grupo['items'] as $orden => $i) {
                q('INSERT INTO pedido_items (pedido_id, tipo, producto_id, color_id, promocion_id, nombre, cantidad, precio, subtotal, orden)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                  [$pedidoId, $i['tipo'], $i['tipo'] === 'producto' ? $i['id'] : null, $i['color']['id'] ?? null, $i['tipo'] === 'paquete' ? $i['id'] : null,
                   mb_substr($i['nombre'], 0, 160), $i['cantidad'], $i['precio'], $i['subtotal'], $orden]);
            }
            return $pedidoId;
        });
        return json_respuesta(['id' => $nuevo], 201);
    });

    // ================= Necutools: lista de pedidos =================
    get('/api/admin/pedidos', function () {
        requiere_admin();
        $tienda = tienda_filtro(consulta('tienda'));
        $estado = consulta('estado') !== null && consulta('estado') !== '' ? v_opcion(consulta('estado'), ESTADOS_PEDIDO, 'un estado') : null;
        $pagina = v_entero(consulta('pagina'), 'La página', 1, 9999, 1);
        [$alcance, $params] = en_alcance('pe', $tienda, tiendas_de_admin());
        $filtro = "WHERE $alcance";
        $paramsFiltro = $params;
        if ($estado !== null) {
            $filtro .= ' AND pe.estado = ?';
            $paramsFiltro[] = $estado;
        }
        $lista = filas('SELECT ' . COLUMNAS_PEDIDO . ' ' . UNIR_PEDIDO . " $filtro ORDER BY pe.creado_en DESC, pe.id DESC LIMIT " . PEDIDOS_POR_PAGINA . ' OFFSET ?',
            [...$paramsFiltro, ($pagina - 1) * PEDIDOS_POR_PAGINA]);
        // "pendientes" = pedidos en proceso (el contador del menú de Necutools)
        $pendientes = (int) valor("SELECT COUNT(*) FROM pedidos pe WHERE $alcance AND pe.estado = 'en_proceso'", $params);
        $total = (int) valor("SELECT COUNT(*) FROM pedidos pe $filtro", $paramsFiltro);
        $lineas = lineas_de_pedidos(array_column($lista, 'id'));
        return [
            'pedidos' => array_map(fn($f) => pedido_admin($f, $lineas[$f['id']] ?? []), $lista), 'pagina' => $pagina,
            'paginas' => max(1, (int) ceil($total / PEDIDOS_POR_PAGINA)), 'total' => $total, 'pendientes' => $pendientes,
        ];
    });

    // ================= Necutools: cambiar estado o nota =================
    put('/api/admin/pedidos/:id', function ($idRuta) {
        $admin = requiere_admin();
        $estadoNuevo = existe('estado') ? v_opcion(campo('estado'), ESTADOS_PEDIDO, 'un estado') : null;
        $notaNueva = existe('nota') ? (v_texto(campo('nota'), 'la nota', 200) ?: null) : null;
        return en_transaccion(function () use ($admin, $idRuta, $estadoNuevo, $notaNueva) {
            $pedido = exigir_pedido_admin($admin, $idRuta, true);
            $id = $pedido['id'];
            $antes = $pedido['estado'];
            $estado = $estadoNuevo ?? $antes;
            $nota = existe('nota') ? $notaNueva : $pedido['nota'];
            if ($estado !== $antes) {
                if (!in_array($estado, TRANSICIONES_PEDIDO[$antes] ?? [], true)) {
                    throw new ErrorHttp(409, 'Un pedido cancelado primero se reabre (pasa a en proceso) y después se marca como pagado.');
                }
                if ($antes === 'pagado') devolver_stock($id, $admin);
                if ($estado === 'pagado') descontar_stock($id, $admin);
            }
            q('UPDATE pedidos SET estado = ?, nota = ?, actualizado_en = UTC_TIMESTAMP(6) WHERE id = ?', [$estado, $nota, $id]);
            anotar($admin, 'editar', 'pedidos', $id, ($estado !== $antes ? "$antes → $estado" : $estado) . ($nota ? ", nota: $nota" : ''));
            return ['id' => $id, 'estado' => $estado, 'nota' => $nota];
        });
    });

    // ================= Necutools: cambiar los artículos de un pedido en proceso =================
    put('/api/admin/pedidos/:id/items', function ($idRuta) {
        $admin = requiere_admin();
        $lista = campo('items');
        return en_transaccion(function () use ($admin, $idRuta, $lista) {
            $pedido = exigir_pedido_admin($admin, $idRuta, true);
            if ($pedido['estado'] !== 'en_proceso') throw new ErrorHttp(409, 'Solo se puede editar un pedido en proceso. Si está pagado, regrésalo a en proceso.');
            $lineas = leer_lineas_nuevas($pedido, $lista);
            $antes = array_map(fn($l) => "{$l['cantidad']} × {$l['nombre']}", lineas_de_pedidos([$pedido['id']])[$pedido['id']] ?? []);
            guardar_lineas($pedido['id'], $lineas);
            $despues = array_map(fn($l) => "{$l['cantidad']} × {$l['nombre']}", $lineas);
            anotar($admin, 'editar', 'pedido_items', $pedido['id'], 'Antes: ' . implode(', ', $antes) . '. Ahora: ' . implode(', ', $despues));
            $f = fila('SELECT ' . COLUMNAS_PEDIDO . ' ' . UNIR_PEDIDO . ' WHERE pe.id = ?', [$pedido['id']]);
            return pedido_admin($f, lineas_de_pedidos([$pedido['id']])[$pedido['id']] ?? []);
        });
    });

    // ================= Necutools: artículos que se pueden agregar a un pedido de una tienda =================
    get('/api/admin/pedidos/articulos', function () {
        requiere_admin();
        $tienda = id_valido(consulta('tienda'));
        if (!$tienda) throw dato_invalido('Elige una tienda.');
        if (!puede_editar_stand($tienda)) throw new ErrorHttp(403, 'No tienes permiso para ver esta tienda.');
        $productos = filas("SELECT id, nombre, precio, stock, visible FROM productos
                            WHERE stand_id = ? AND tipo = 'producto' AND precio_modo = 'fijo' ORDER BY orden, nombre", [$tienda]);
        $ids = array_column($productos, 'id');
        $colores = $ids ? filas('SELECT id, producto_id, nombre, stock, disponible FROM producto_colores WHERE producto_id IN (' . marcas($ids) . ') ORDER BY orden, id', $ids) : [];
        return array_map(fn($p) => [
            'id' => $p['id'], 'nombre' => $p['nombre'], 'precio' => (float) $p['precio'], 'stock' => $p['stock'], 'visible' => a_bool($p['visible']),
            'colores' => array_values(array_map(fn($c) => ['id' => $c['id'], 'nombre' => $c['nombre'], 'stock' => $c['stock'], 'disponible' => a_bool($c['disponible'])],
                array_filter($colores, fn($c) => $c['producto_id'] === $p['id']))),
        ], $productos);
    });

    // ================= Necutools: cancelar pendientes viejos (solo dueños) =================
    // Los pedidos que nadie cerró en WhatsApp (o inventados) se quedan pendientes para siempre
    post('/api/admin/pedidos/cancelar-viejos', function () {
        $admin = requiere_admin();
        requiere_dueno();
        $cancelados = ejecutar("UPDATE pedidos SET estado = 'cancelado', nota = COALESCE(nota, 'Cancelado por tener más de 7 días en proceso'),
                                  actualizado_en = UTC_TIMESTAMP(6)
                                WHERE estado = 'en_proceso' AND creado_en < UTC_TIMESTAMP(6) - INTERVAL 7 DAY");
        anotar($admin, 'editar', 'pedidos', null, "Canceló $cancelados pedidos en proceso de más de 7 días");
        return ['cancelados' => $cancelados];
    });

    // ================= Necutools: resumen del dashboard =================
    get('/api/admin/resumen', function () {
        requiere_admin();
        $dias = v_entero(consulta('dias'), 'El periodo', 1, 90, 30);
        if (!in_array($dias, PERIODOS, true)) throw dato_invalido('Elige un periodo de 7, 30 o 90 días.');
        $tienda = tienda_filtro(consulta('tienda'));
        $fecha = hoy()['fecha'];
        $hasta = new DateTimeImmutable($fecha, new DateTimeZone('UTC'));
        $desde = $hasta->modify('-' . ($dias - 1) . ' days')->format('Y-m-d');
        $desdeAnterior = $hasta->modify('-' . (2 * $dias - 1) . ' days')->format('Y-m-d');
        [$alcanceP, $paramsP] = en_alcance('pe', $tienda, tiendas_de_admin());
        [$alcanceProd, $paramsProd] = en_alcance('p', $tienda, tiendas_de_admin());
        [$alcanceO, $paramsO] = en_alcance('o', $tienda, tiendas_de_admin());
        $diaLocal = "DATE(CONVERT_TZ(pe.creado_en, '+00:00', '" . DESFASE_MX . "'))";

        // Pedidos de los dos periodos (el actual y el anterior); lo demás se cuenta aquí en PHP
        $pedidos = filas("SELECT pe.id, pe.stand_id, s.nombre AS tienda, pe.items, pe.total, pe.estado, $diaLocal AS dia
                          FROM pedidos pe LEFT JOIN stands s ON s.id = pe.stand_id
                          WHERE $alcanceP AND $diaLocal BETWEEN ? AND ?", [...$paramsP, $desdeAnterior, $fecha]);

        $vacio = ['pedidos' => 0, 'vendidos' => 0, 'ventas' => 0.0];
        $ind = ['actual' => $vacio, 'anterior' => $vacio];
        $serie = [];
        for ($d = new DateTimeImmutable($desde, new DateTimeZone('UTC')); $d <= $hasta; $d = $d->modify('+1 day')) {
            $serie[$d->format('Y-m-d')] = ['fecha' => $d->format('Y-m-d'), 'pedidos' => 0, 'ventas' => 0.0];
        }
        $porTienda = [];
        $porEstado = array_fill_keys(ESTADOS_PEDIDO, 0);
        $top = [];
        foreach ($pedidos as $p) {
            $total = (float) $p['total'];
            $vendido = $p['estado'] === 'pagado';
            $cual = $p['dia'] >= $desde ? 'actual' : 'anterior';
            $ind[$cual]['pedidos'] += 1;
            if ($vendido) {
                $ind[$cual]['vendidos'] += 1;
                $ind[$cual]['ventas'] += $total;
            }
            if ($cual !== 'actual') continue;
            $serie[$p['dia']]['pedidos'] += 1;
            if ($vendido) $serie[$p['dia']]['ventas'] += $total;
            $clave = $p['stand_id'] ?? 'paquetes';
            $porTienda[$clave] ??= ['stand_id' => $p['stand_id'], 'nombre' => $p['tienda'] ?? 'Paquetes', 'pedidos' => 0, 'ventas' => 0.0];
            $porTienda[$clave]['pedidos'] += 1;
            if ($vendido) $porTienda[$clave]['ventas'] += $total;
            $porEstado[$p['estado']] += 1;
            if ($p['estado'] === 'cancelado') continue;
            foreach (a_lista($p['items']) as $i) {
                $k = ($i['tipo'] ?? '') . '-' . ($i['id'] ?? '');
                $nombre = $i['producto'] ?? $i['nombre'] ?? '';
                $top[$k] ??= ['tipo' => $i['tipo'] ?? null, 'id' => isset($i['id']) ? (int) $i['id'] : null, 'nombre' => $nombre, 'piezas' => 0, 'total' => 0.0];
                if (strcmp($nombre, (string) $top[$k]['nombre']) > 0) $top[$k]['nombre'] = $nombre; // max() de SQL
                $top[$k]['piezas'] += (int) ($i['cantidad'] ?? 0);
                $top[$k]['total'] += (float) ($i['subtotal'] ?? 0);
            }
        }
        $porTienda = array_values($porTienda);
        usort($porTienda, fn($a, $b) => ($b['pedidos'] <=> $a['pedidos']) ?: comparar_texto($a['nombre'], $b['nombre']));
        $top = array_values($top);
        usort($top, fn($a, $b) => ($b['piezas'] <=> $a['piezas']) ?: ($b['total'] <=> $a['total']));

        $recientes = filas('SELECT ' . COLUMNAS_PEDIDO . ' ' . UNIR_PEDIDO . " WHERE $alcanceP ORDER BY pe.creado_en DESC, pe.id DESC LIMIT 5", $paramsP);
        $op = fila("SELECT ROUND(AVG(r.calificacion), 1) AS promedio, COUNT(*) AS total,
                           SUM(CASE WHEN r.respuesta IS NULL THEN 1 ELSE 0 END) AS sin_responder,
                           SUM(CASE WHEN DATE(CONVERT_TZ(r.creado_en, '+00:00', '" . DESFASE_MX . "')) BETWEEN ? AND ? THEN 1 ELSE 0 END) AS nuevas
                    FROM resenas r JOIN productos p ON p.id = r.producto_id
                    WHERE r.visible AND $alcanceProd", [$desde, $fecha, ...$paramsProd]);
        $porHacer = [
            'pedidos_pendientes' => (int) valor("SELECT COUNT(*) FROM pedidos pe WHERE $alcanceP AND pe.estado = 'en_proceso'", $paramsP),
            'sin_foto' => (int) valor("SELECT COUNT(*) FROM productos p WHERE $alcanceProd
                AND p.imagen IS NULL AND (p.imagen_ruta IS NULL OR p.imagen_ruta LIKE '/imagenes/ejemplos/%')", $paramsProd),
            'texto_ejemplo' => (int) valor("SELECT COUNT(*) FROM productos p WHERE $alcanceProd
                AND (p.descripcion LIKE 'Producto de ejemplo.%' OR p.descripcion = 'Producto destacado de la tienda.')", $paramsProd),
            'ofertas_por_vencer' => (int) valor("SELECT COUNT(*) FROM ofertas o WHERE $alcanceO
                AND o.activa AND o.fin BETWEEN ? AND ? + INTERVAL 7 DAY", [...$paramsO, $fecha, $fecha]),
        ];

        $actual = $ind['actual'];
        $anterior = $ind['anterior'];
        $ticket = fn($f) => $f['vendidos'] ? redondear($f['ventas'] / $f['vendidos']) : 0;
        return [
            'dias' => $dias, 'desde' => $desde, 'hasta' => $fecha,
            'indicadores' => [
                'pedidos' => ['valor' => $actual['pedidos'], 'anterior' => $anterior['pedidos'], 'cambio' => cambio_porcentaje($actual['pedidos'], $anterior['pedidos'])],
                'ventas' => ['valor' => redondear($actual['ventas']), 'anterior' => redondear($anterior['ventas']), 'cambio' => cambio_porcentaje($actual['ventas'], $anterior['ventas'])],
                'ticket' => ['valor' => $ticket($actual), 'anterior' => $ticket($anterior), 'cambio' => cambio_porcentaje($ticket($actual), $ticket($anterior))],
                'calificacion' => ['valor' => a_float($op['promedio']), 'opiniones' => (int) $op['total'], 'nuevas' => (int) $op['nuevas']],
            ],
            'serie' => array_values($serie),
            'por_tienda' => array_slice($porTienda, 0, 10),
            'por_estado' => array_map(fn($e) => ['estado' => $e, 'pedidos' => $porEstado[$e]], ESTADOS_PEDIDO),
            'productos' => array_slice($top, 0, 5),
            'recientes' => array_map('pedido_admin', $recientes),
            'por_hacer' => [...$porHacer, 'opiniones_sin_responder' => (int) $op['sin_responder']],
        ];
    });
}
