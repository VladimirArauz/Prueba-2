<?php
/**
 * Opiniones de productos y servicios: calificación de 1 a 5 y comentario.
 * Cualquiera las lee; solo un cliente con sesión escribe, edita o borra la suya (una por producto).
 * Las respuestas del vendedor y ocultar opiniones están en app/admin.php.
 */

const RESENAS_POR_PAGINA = 10;
const ORDENES_RESENAS = [
    'recientes' => 'r.creado_en DESC, r.id DESC',
    'mejores' => 'r.calificacion DESC, r.creado_en DESC, r.id DESC',
];

// El producto debe existir y verse en el sitio
function exigir_producto_publico($id): int
{
    $productoId = id_valido($id);
    $f = $productoId ? fila('SELECT p.id FROM productos p JOIN stands s ON s.id = p.stand_id WHERE p.id = ? AND p.visible AND s.visible', [$productoId]) : null;
    if (!$f) throw new ErrorHttp(404, 'Este producto no existe o ya no está disponible.');
    return $f['id'];
}

function comentario_valido($valor): string
{
    $comentario = v_texto($valor, 'tu comentario', 500, true);
    if (mb_strlen($comentario) < 3) throw dato_invalido('Escribe un comentario de al menos 3 letras.');
    // Sin enlaces: es la forma más común de spam
    if (preg_match('/(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|mx|ly|io)\b)/i', $comentario)) {
        throw dato_invalido('Quita los enlaces de tu comentario.');
    }
    return $comentario;
}

function resena_publica(array $f): array
{
    return [
        'id' => $f['id'],
        'nombre' => $f['nombre'],
        'calificacion' => $f['calificacion'],
        'comentario' => $f['comentario'],
        'respuesta' => $f['respuesta'],
        'creado_en' => fecha_iso($f['creado_en']),
        'editada' => version_ms($f['actualizado_en']) - version_ms($f['creado_en']) > 60 * 1000,
    ];
}

function rutas_resenas(): void
{
    get('/api/productos/:id/resenas', function ($id) {
        $productoId = exigir_producto_publico($id);
        $orden = is_string(consulta('orden')) && isset(ORDENES_RESENAS[consulta('orden')]) ? consulta('orden') : 'recientes';
        $pagina = v_entero(consulta('pagina'), 'La página', 1, 1000, 1);

        $resumen = filas('SELECT calificacion, COUNT(*) AS total FROM resenas WHERE producto_id = ? AND visible GROUP BY calificacion', [$productoId]);
        $lista = filas('SELECT r.id, c.nombre, r.calificacion, r.comentario, r.respuesta, r.creado_en, r.actualizado_en
                        FROM resenas r JOIN clientes c ON c.id = r.cliente_id
                        WHERE r.producto_id = ? AND r.visible
                        ORDER BY ' . ORDENES_RESENAS[$orden] . ' LIMIT ? OFFSET ?', [$productoId, RESENAS_POR_PAGINA, ($pagina - 1) * RESENAS_POR_PAGINA]);
        $cliente = cargar_cliente();

        $distribucion = [1 => 0, 2 => 0, 3 => 0, 4 => 0, 5 => 0];
        $total = 0;
        $suma = 0;
        foreach ($resumen as $f) {
            $distribucion[$f['calificacion']] = (int) $f['total'];
            $total += (int) $f['total'];
            $suma += $f['calificacion'] * (int) $f['total'];
        }

        $mia = null;
        if ($cliente) {
            $f = fila('SELECT r.id, r.calificacion, r.comentario, r.respuesta, r.creado_en, r.actualizado_en, r.visible
                       FROM resenas r WHERE r.producto_id = ? AND r.cliente_id = ?', [$productoId, $cliente['id']]);
            if ($f) $mia = [...resena_publica([...$f, 'nombre' => $cliente['nombre']]), 'visible' => a_bool($f['visible'])];
        }

        return [
            'resumen' => ['promedio' => $total ? floor($suma / $total * 10 + 0.5) / 10 : null, 'total' => $total, 'distribucion' => $distribucion],
            'orden' => $orden,
            'pagina' => $pagina,
            'paginas' => max(1, (int) ceil($total / RESENAS_POR_PAGINA)),
            'resenas' => array_map('resena_publica', $lista),
            'cliente' => $cliente ? ['nombre' => $cliente['nombre']] : null,
            'cuentas' => cuentas_clientes(),
            'mia' => $mia,
        ];
    });

    // Crea o reemplaza la opinión del cliente sobre este producto
    put('/api/productos/:id/resena', function ($id) {
        limitar('resenas', 30, UNA_HORA, 'Enviaste muchas opiniones seguidas. Espera un rato y vuelve a intentar.');
        $cliente = requiere_cliente();
        $productoId = exigir_producto_publico($id);
        $calificacion = v_entero(campo('calificacion'), 'La calificación', 1, 5, null);
        if (!$calificacion) throw dato_invalido('Elige de 1 a 5 estrellas.');
        $comentario = comentario_valido(campo('comentario'));
        $previa = valor('SELECT id FROM resenas WHERE producto_id = ? AND cliente_id = ?', [$productoId, $cliente['id']]);
        q('INSERT INTO resenas (producto_id, cliente_id, calificacion, comentario) VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE calificacion = VALUES(calificacion), comentario = VALUES(comentario), actualizado_en = UTC_TIMESTAMP(6)',
          [$productoId, $cliente['id'], $calificacion, $comentario]);
        $nueva = $previa === null;
        $idResena = $nueva ? ultimo_id() : (int) $previa;
        return json_respuesta(['id' => $idResena, 'nueva' => $nueva], $nueva ? 201 : 200);
    });

    delete('/api/productos/:id/resena', function ($id) {
        $cliente = requiere_cliente();
        $productoId = exigir_producto_publico($id);
        q('DELETE FROM resenas WHERE producto_id = ? AND cliente_id = ?', [$productoId, $cliente['id']]);
        return vacia(204);
    });
}
