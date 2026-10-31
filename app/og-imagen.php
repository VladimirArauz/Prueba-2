<?php
/**
 * Imagen de vista previa (Open Graph) de cada tienda, hecha con GD: 1200×630, el mismo diseño que
 * public/imagenes/og-necutla.png con el nombre, la descripción y las subcategorías de la tienda.
 * La usa app/paginas.php en las tiendas sin portada PNG/JPG/WEBP (WhatsApp no muestra SVG).
 * Plan: plans/planes/2026-10-30-vista-previa-por-tienda.md
 */

const OG_ANCHO = 1200;
const OG_ALTO = 630;

// Archivo fija en 3 instancias (GD no lee los ejes de la fuente variable); licencia en app/fuentes/OFL.txt
const OG_FUENTES = [
    'titulo' => __DIR__ . '/fuentes/Archivo-125-800.ttf',
    'tablero' => __DIR__ . '/fuentes/Archivo-112-700.ttf',
    'texto' => __DIR__ . '/fuentes/Archivo-100-500.ttf',
];

// Datos que salen en la imagen. La versión cambia en cuanto cambia cualquiera de ellos.
function datos_vista_tienda(int $id): ?array
{
    $s = fila('SELECT id, nombre, descripcion FROM stands WHERE id = ? AND visible', [$id]);
    if (!$s) return null;
    $filas = array_column(filas('SELECT nombre FROM subcategorias WHERE stand_id = ? ORDER BY orden, nombre LIMIT 5', [$id]), 'nombre');
    $datos = ['nombre' => $s['nombre'], 'descripcion' => $s['descripcion'], 'filas' => $filas ?: ['Productos', 'Servicios', 'Ofertas']];
    return $datos + ['version' => sprintf('%08x', crc32(json_encode($datos)))];
}

function vista_tienda_disponible(): bool
{
    static $ok = null;
    return $ok ??= function_exists('imagettftext') && !in_array(false, array_map('is_readable', OG_FUENTES), true);
}

// GD mide en puntos a 96 ppp: se convierten los px del diseño
function og_texto($img, string $fuente, int $px, int $color, int $x, int $y, string $texto): void
{
    imagettftext($img, $px * 0.75, 0, $x, $y, $color, OG_FUENTES[$fuente], $texto);
}

function og_ancho(string $fuente, int $px, string $texto): int
{
    $caja = imagettfbbox($px * 0.75, 0, OG_FUENTES[$fuente], $texto);
    return $caja[2] - $caja[0];
}

function og_cortar(string $fuente, int $px, string $texto, int $max): string
{
    if (og_ancho($fuente, $px, $texto) <= $max) return $texto;
    while (mb_strlen($texto) > 1 && og_ancho($fuente, $px, $texto . '…') > $max) $texto = rtrim(mb_substr($texto, 0, -1));
    return $texto . '…';
}

// Parte el texto en renglones que caben en $max; el último se corta con "…" si sobra texto
function og_renglones(string $fuente, int $px, string $texto, int $max, int $cuantos): array
{
    $renglones = [];
    $actual = '';
    $palabras = preg_split('/\s+/u', trim($texto), -1, PREG_SPLIT_NO_EMPTY);
    foreach ($palabras as $i => $palabra) {
        $prueba = $actual === '' ? $palabra : "$actual $palabra";
        if ($actual !== '' && og_ancho($fuente, $px, $prueba) > $max) {
            $renglones[] = $actual;
            $actual = $palabra;
            if (count($renglones) === $cuantos - 1) {
                $renglones[] = og_cortar($fuente, $px, implode(' ', array_slice($palabras, $i)), $max);
                return $renglones;
            }
        } else {
            $actual = $prueba;
        }
    }
    if ($actual !== '') $renglones[] = og_cortar($fuente, $px, $actual, $max);
    return $renglones;
}

function imagen_vista_tienda(array $d): string
{
    $img = imagecreatetruecolor(OG_ANCHO, OG_ALTO);
    imagealphablending($img, true);
    // Tokens de public/style.css
    $tinta = imagecolorallocate($img, 0x17, 0x29, 0x5C);    // --tinta
    $tinta2 = imagecolorallocate($img, 0x2B, 0x45, 0x90);   // --tinta-2
    $senal = imagecolorallocate($img, 0xF5, 0xB8, 0x00);    // --senal
    $hoja = imagecolorallocate($img, 0xFF, 0xFF, 0xFF);     // --hoja
    $divisor = imagecolorallocatealpha($img, 0xFF, 0xFF, 0xFF, 104); // --hoja al 18 %, como en og-necutla.svg
    imagefilledrectangle($img, 0, 0, OG_ANCHO - 1, OG_ALTO - 1, $tinta);

    // Marca chica: emblema N y "Necutla"
    imagefilledrectangle($img, 72, 88, 135, 151, $senal);
    $n = og_ancho('titulo', 44, 'N');
    og_texto($img, 'titulo', 44, $tinta, 104 - intdiv($n, 2), 136, 'N');
    og_texto($img, 'titulo', 40, $hoja, 156, 134, 'Necutla');

    // Nombre de la tienda: se achica hasta caber en un renglón; si no, va en 2 y, si tampoco, en 3 más chicos
    // (y la descripción deja un renglón). El último se corta con "…" solo si ni así cabe.
    $columna = 600;
    $px = 96;
    $descripcionDesde = 372;
    $descripcionRenglones = 3;
    while ($px > 64 && og_ancho('titulo', $px, $d['nombre']) > $columna) $px -= 4;
    if (og_ancho('titulo', $px, $d['nombre']) <= $columna) {
        og_texto($img, 'titulo', $px, $hoja, 72, 290, $d['nombre']);
    } else {
        [$px, $desde, $alto] = [60, 236, 68];
        $renglones = og_renglones('titulo', $px, $d['nombre'], $columna, 2);
        if (str_ends_with(end($renglones), '…')) {
            [$px, $desde, $alto] = [46, 214, 54];
            $renglones = og_renglones('titulo', $px, $d['nombre'], $columna, 3);
            [$descripcionDesde, $descripcionRenglones] = [396, 2];
        }
        foreach ($renglones as $i => $renglon) og_texto($img, 'titulo', $px, $hoja, 72, $desde + $i * $alto, $renglon);
    }

    $descripcion = $d['descripcion'] !== '' ? $d['descripcion'] : 'Tienda de la comunidad estudiantil.';
    foreach (og_renglones('texto', 30, $descripcion, $columna, $descripcionRenglones) as $i => $renglon) {
        og_texto($img, 'texto', 30, $hoja, 72, $descripcionDesde + $i * 44, $renglon);
    }
    og_texto($img, 'tablero', 28, $senal, 72, 562, 'Arma tu pedido y mándalo por WhatsApp.');

    // Tablero directorio con las subcategorías, como el del hero
    $alto = 91;
    $filas = array_slice($d['filas'], 0, 5);
    imagefilledrectangle($img, 736, 88, 1127, 88 + count($filas) * $alto - 1, $tinta2);
    imagesetthickness($img, 4);
    foreach ($filas as $i => $fila) {
        $arriba = 88 + $i * $alto;
        if ($i > 0) imagefilledrectangle($img, 736, $arriba - 1, 1127, $arriba, $divisor);
        og_texto($img, 'tablero', 34, $senal, 776, $arriba + 58, og_cortar('tablero', 34, $fila, 280));
        $centro = $arriba + 46;
        imageline($img, 1080, $centro - 14, 1094, $centro, $hoja);
        imageline($img, 1094, $centro, 1080, $centro + 14, $hoja);
    }

    ob_start();
    imagepng($img, null, 9);
    return ob_get_clean();
}

function rutas_og_imagen(): void
{
    // Pública y sin datos privados; la dirección lleva ?v= con la versión, así que se puede guardar un día
    get('/api/stands/:id/vista', function ($id) {
        $id = id_valido($id);
        if (!$id || !vista_tienda_disponible()) return vacia(404);
        $d = datos_vista_tienda($id);
        if (!$d) return vacia(404);
        return binaria(imagen_vista_tienda($d), 'image/png', ['Cache-Control' => 'public, max-age=86400']);
    });
}
