<?php
/**
 * Pedidos enviados por WhatsApp.
 * Público: guardar el pedido de un grupo del carrito al tocar "Enviar pedido por WhatsApp"
 * (precios del servidor, sin datos del cliente).
 * Necutools (/api/admin): lista de pedidos, cambio de estado y resumen del dashboard.
 */

const ESTADOS_PEDIDO = ['pendiente', 'vendido', 'cancelado'];
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

function pedido_admin(array $f): array
{
    return [
        'id' => $f['id'], 'stand_id' => $f['stand_id'], 'tienda' => $f['tienda'], 'promocion_id' => $f['promocion_id'], 'paquete' => $f['paquete'],
        'items' => a_lista($f['items']), 'total' => (float) $f['total'], 'piezas' => $f['piezas'], 'estado' => $f['estado'], 'nota' => $f['nota'],
        'creado_en' => fecha_iso($f['creado_en']),
    ];
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
        q('INSERT INTO pedidos (stand_id, promocion_id, items, total, piezas, huella) VALUES (?, ?, ?, ?, ?, ?)',
          [$m[1] === 'tienda' ? $id : null, $m[1] === 'paquete' ? $id : null,
           json_encode($items, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $grupo['total'], $piezas, $huella]);
        return json_respuesta(['id' => ultimo_id()], 201);
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
        $pendientes = (int) valor("SELECT COUNT(*) FROM pedidos pe WHERE $alcance AND pe.estado = 'pendiente'", $params);
        $total = (int) valor("SELECT COUNT(*) FROM pedidos pe $filtro", $paramsFiltro);
        return [
            'pedidos' => array_map('pedido_admin', $lista), 'pagina' => $pagina,
            'paginas' => max(1, (int) ceil($total / PEDIDOS_POR_PAGINA)), 'total' => $total, 'pendientes' => $pendientes,
        ];
    });

    // ================= Necutools: cambiar estado o nota =================
    put('/api/admin/pedidos/:id', function ($idRuta) {
        $admin = requiere_admin();
        $id = id_valido($idRuta);
        $pedido = $id ? fila('SELECT id, stand_id, estado, nota FROM pedidos WHERE id = ?', [$id]) : null;
        if (!$pedido) throw new ErrorHttp(404, 'Ese pedido no existe.');
        // Paquetes (sin tienda): solo dueños
        $permitido = $pedido['stand_id'] === null ? $admin['rol'] === 'dueno' : puede_editar_stand($pedido['stand_id']);
        if (!$permitido) throw new ErrorHttp(403, 'No tienes permiso para cambiar este pedido.');
        $estado = !existe('estado') ? $pedido['estado'] : v_opcion(campo('estado'), ESTADOS_PEDIDO, 'un estado');
        $nota = !existe('nota') ? $pedido['nota'] : (v_texto(campo('nota'), 'la nota', 200) ?: null);
        q('UPDATE pedidos SET estado = ?, nota = ?, actualizado_en = UTC_TIMESTAMP(6) WHERE id = ?', [$estado, $nota, $id]);
        anotar($admin, 'editar', 'pedidos', $id, $estado . ($nota ? ", nota: $nota" : ''));
        return ['id' => $id, 'estado' => $estado, 'nota' => $nota];
    });

    // ================= Necutools: cancelar pendientes viejos (solo dueños) =================
    // Los pedidos que nadie cerró en WhatsApp (o inventados) se quedan pendientes para siempre
    post('/api/admin/pedidos/cancelar-viejos', function () {
        $admin = requiere_admin();
        requiere_dueno();
        $cancelados = ejecutar("UPDATE pedidos SET estado = 'cancelado', nota = COALESCE(nota, 'Cancelado por tener más de 7 días pendiente'),
                                  actualizado_en = UTC_TIMESTAMP(6)
                                WHERE estado = 'pendiente' AND creado_en < UTC_TIMESTAMP(6) - INTERVAL 7 DAY");
        anotar($admin, 'editar', 'pedidos', null, "Canceló $cancelados pedidos pendientes de más de 7 días");
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
            $vendido = $p['estado'] === 'vendido';
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
            'pedidos_pendientes' => (int) valor("SELECT COUNT(*) FROM pedidos pe WHERE $alcanceP AND pe.estado = 'pendiente'", $paramsP),
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
