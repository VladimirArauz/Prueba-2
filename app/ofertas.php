<?php
/**
 * Ofertas de cada tienda: cuáles aplican hoy y cómo cambian el precio.
 * Es el único lugar que calcula descuentos (tienda, carrito y portada lo usan).
 */

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const ZONA_MX = 'America/Mexico_City';

// Fecha de hoy en Ciudad de México. En desarrollo se puede fijar con hoy_prueba = 'AAAA-MM-DD'.
function hoy(): array
{
    $prueba = !config('produccion') ? (string) config('hoy_prueba') : '';
    $fecha = preg_match('/^\d{4}-\d{2}-\d{2}$/', $prueba)
        ? $prueba
        : (new DateTimeImmutable('now', new DateTimeZone(ZONA_MX)))->format('Y-m-d');
    $dia = (int) (new DateTimeImmutable("$fecha 12:00:00", new DateTimeZone('UTC')))->format('w');
    return ['fecha' => $fecha, 'dia' => $dia];
}

// "Lunes y miércoles", "Todos los días", "De lunes a viernes"
function texto_dias(array $dias): string
{
    $lista = array_values(array_unique(array_map('intval', $dias)));
    sort($lista);
    if (count($lista) === 7) return 'Todos los días';
    if ($lista === [1, 2, 3, 4, 5]) return 'De lunes a viernes';
    $nombres = array_map(fn($d) => DIAS_SEMANA[$d] ?? '', $lista);
    $texto = count($nombres) > 1 ? implode(', ', array_slice($nombres, 0, -1)) . ' y ' . end($nombres) : ($nombres[0] ?? '');
    return mb_strtoupper(mb_substr($texto, 0, 1)) . mb_substr($texto, 1);
}

// Columnas de una oferta para la parte pública
const COLUMNAS_OFERTA = '
  o.id, o.stand_id, o.producto_id, o.subcategoria_id, o.titulo, o.descripcion, o.tipo, o.valor,
  o.dias, o.clase, o.temporada, o.inicio, o.fin, o.piezas';

// Condición SQL de "vigente hoy" para la tabla ofertas con alias o (parámetros: día de la semana, fecha, fecha)
const VIGENTE_HOY = "o.activa AND JSON_CONTAINS(o.dias, CAST(? AS CHAR))
  AND (o.inicio IS NULL OR o.inicio <= ?) AND (o.fin IS NULL OR o.fin >= ?)";

function vigente_params(array $cuando): array
{
    return [(string) $cuando['dia'], $cuando['fecha'], $cuando['fecha']];
}

// Oferta leída de la base → tipos como los daba Node (valor float, dias lista de enteros)
function oferta_de_fila(array $f): array
{
    $f['valor'] = a_float($f['valor']);
    $f['dias'] = array_map('intval', a_lista($f['dias']));
    return $f;
}

// Ofertas vigentes hoy (por día y por fechas), opcionalmente solo de algunas tiendas
function ofertas_de_hoy(?array $standIds = null): array
{
    $cuando = hoy();
    $params = vigente_params($cuando);
    $sql = 'SELECT ' . COLUMNAS_OFERTA . ' FROM ofertas o WHERE ' . VIGENTE_HOY;
    if ($standIds !== null) {
        if (!$standIds) return [];
        $sql .= ' AND o.stand_id IN (' . marcas($standIds) . ')';
        $params = [...$params, ...$standIds];
    }
    return array_map('oferta_de_fila', filas($sql, $params));
}

// ¿Aplica hoy? (para ofertas ya leídas de la base)
function vigente_hoy(array $oferta, array $cuando): bool
{
    return in_array($cuando['dia'], $oferta['dias'], true)
        && (!$oferta['inicio'] || $oferta['inicio'] <= $cuando['fecha'])
        && (!$oferta['fin'] || $oferta['fin'] >= $cuando['fecha']);
}

function aplica_a(array $oferta, array $producto): bool
{
    if ($oferta['stand_id'] !== $producto['stand_id']) return false;
    if ($oferta['producto_id']) return $oferta['producto_id'] === $producto['id'];
    if ($oferta['subcategoria_id']) return $oferta['subcategoria_id'] === $producto['subcategoria_id'];
    return true; // toda la tienda
}

function total_con(array $oferta, float $precio, int $cantidad): float
{
    if ($oferta['tipo'] === 'porcentaje') return redondear($precio * $cantidad * (1 - $oferta['valor'] / 100));
    if ($oferta['tipo'] === 'precio_especial') return $oferta['valor'] < $precio ? redondear($oferta['valor'] * $cantidad) : $precio * $cantidad;
    if ($oferta['tipo'] === 'dos_por_uno') return redondear($precio * ceil($cantidad / 2));
    return $precio * $cantidad;
}

// La mejor oferta para el cliente en esa cantidad: ['total' => …, 'oferta' => …|null]
function mejor_precio(array $producto, array $ofertas, int $cantidad): array
{
    $mejor = ['total' => redondear($producto['precio'] * $cantidad), 'oferta' => null];
    foreach ($ofertas as $oferta) {
        if (!aplica_a($oferta, $producto)) continue;
        $total = total_con($oferta, $producto['precio'], $cantidad);
        if ($total < $mejor['total']) $mejor = ['total' => $total, 'oferta' => $oferta];
    }
    return $mejor;
}

// Lo que se muestra en la tarjeta: precio con descuento (si hay) o la etiqueta del 2x1
function oferta_para_tarjeta(array $producto, array $ofertas): ?array
{
    $aplicables = array_values(array_filter($ofertas, fn($o) => aplica_a($o, $producto)));
    if (!$aplicables || $producto['precio'] === null) return null;
    $unidad = mejor_precio($producto, $aplicables, 1);
    $elegida = $unidad['oferta'];
    if (!$elegida) foreach ($aplicables as $o) if ($o['tipo'] === 'dos_por_uno') { $elegida = $o; break; }
    if (!$elegida) return null;
    return [
        'id' => $elegida['id'],
        'titulo' => $elegida['titulo'],
        'tipo' => $elegida['tipo'],
        'clase' => $elegida['clase'],
        'temporada' => $elegida['temporada'],
        'fin' => $elegida['fin'],
        'piezas' => $elegida['piezas'],
        'descuento' => $unidad['oferta'] ? (int) floor((1 - $unidad['total'] / $producto['precio']) * 100 + 0.5) : null,
        'precio_oferta' => $unidad['oferta'] ? $unidad['total'] : null,
    ];
}

function oferta_publica(array $oferta, ?array $cuando = null): array
{
    $cuando ??= hoy();
    return [
        'id' => $oferta['id'],
        'titulo' => $oferta['titulo'],
        'descripcion' => $oferta['descripcion'],
        'tipo' => $oferta['tipo'],
        'valor' => $oferta['valor'],
        'dias' => $oferta['dias'],
        'dias_texto' => texto_dias($oferta['dias']),
        'hoy' => vigente_hoy($oferta, $cuando),
        'clase' => $oferta['clase'],
        'temporada' => $oferta['temporada'],
        'inicio' => $oferta['inicio'],
        'fin' => $oferta['fin'],
        'piezas' => $oferta['piezas'],
        'producto_id' => $oferta['producto_id'],
        'subcategoria_id' => $oferta['subcategoria_id'],
    ];
}
