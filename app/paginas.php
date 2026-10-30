<?php
/**
 * Páginas públicas con la vista previa del enlace (Open Graph) que muestran WhatsApp y las redes.
 * public/.htaccess manda aquí la portada, carrito, promociones, cuenta, /t/<slug> y /p/<id>: se lee el HTML de
 * public/ y se cambia el bloque <!--og:inicio-->…<!--og:fin--> por las etiquetas de esa página.
 * Plan: plans/planes/2026-10-29-reels-esqueletos-botones-open-graph.md
 */

const PAGINAS_FIJAS = [
    '/' => 'index.html', '/index.html' => 'index.html', '/carrito.html' => 'carrito.html',
    '/promociones.html' => 'promociones.html', '/cuenta.html' => 'cuenta.html',
];

const OG_GENERAL = [
    'titulo' => 'Necutla — tiendas de estudiantes con pedido por WhatsApp',
    'descripcion' => 'Ropa, tecnología, dulces, papelería y más de la comunidad estudiantil. Arma tu pedido y mándalo por WhatsApp a cada tienda.',
    'imagen' => '/imagenes/og-necutla.png',
    'ancho' => 1200,
    'alto' => 630,
    'alt' => 'Necutla, la ciudad del estudiante: tablero de tiendas',
];

// WhatsApp no muestra SVG en la vista previa: solo se usan fotos de la base o rutas PNG/JPG/WEBP
function imagen_para_vista(?string $ruta): ?string
{
    if (!$ruta) return null;
    if (str_starts_with($ruta, '/api/')) return $ruta;
    return preg_match('#\.(png|jpe?g|webp)$#i', $ruta) ? $ruta : null;
}

function recortar(string $texto, int $largo): string
{
    $texto = trim(preg_replace('/\s+/u', ' ', $texto));
    return mb_strlen($texto) > $largo ? rtrim(mb_substr($texto, 0, $largo - 1)) . '…' : $texto;
}

function og_de_tienda(string $slug): ?array
{
    $s = fila('SELECT id, nombre, descripcion, imagen_ruta, actualizado_en, (portada IS NOT NULL) AS tiene_portada
               FROM stands WHERE slug = ? AND visible', [mb_substr($slug, 0, 60)]);
    if (!$s) return null;
    $imagen = imagen_para_vista(imagen_tienda($s));
    return [
        'titulo' => "{$s['nombre']} en Necutla",
        'descripcion' => recortar($s['descripcion'] ?: "Catálogo de {$s['nombre']}. Arma tu pedido y mándalo por WhatsApp a la tienda.", 150),
    ] + ($imagen ? ['imagen' => $imagen, 'alt' => "Tienda {$s['nombre']}", 'ancho' => null, 'alto' => null] : []);
}

function og_de_producto(int $id): ?array
{
    $f = fila('SELECT ' . COLUMNAS_PRODUCTO . ', s.nombre AS tienda FROM productos p JOIN stands s ON s.id = p.stand_id
               WHERE p.id = ? AND p.visible AND s.visible', [$id]);
    if (!$f) return null;
    $f = producto_de_fila($f);
    $p = producto_publico($f, $f['tipo'] === 'producto' ? ofertas_de_hoy([$f['stand_id']]) : []);
    $precio = '';
    if ($p['precio_modo'] === 'cotizar') {
        $precio = 'a cotizar';
    } elseif ($p['precio'] !== null) {
        $monto = $p['oferta']['precio_oferta'] ?? $p['precio'];
        $precio = ($p['precio_modo'] === 'desde' ? 'desde ' : '') . '$' . number_format((float) $monto, 2) . ' MXN';
    }
    $imagen = imagen_para_vista($p['imagen_url']);
    return [
        'titulo' => $p['nombre'] . ($precio ? " — $precio" : '') . " en {$f['tienda']}",
        'descripcion' => recortar($p['descripcion'] ?: "Pídelo en Necutla y mándale tu pedido por WhatsApp a {$f['tienda']}.", 150),
    ] + ($imagen ? ['imagen' => $imagen, 'alt' => $p['nombre'], 'ancho' => null, 'alto' => null] : []);
}

function etiquetas_og(array $og, string $ruta): string
{
    $og += OG_GENERAL;
    $base = rtrim((string) config('url_publica'), '/');
    $e = fn($v) => htmlspecialchars((string) $v, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8');
    $lineas = [
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="Necutla">',
        '<meta property="og:locale" content="es_MX">',
        '<meta property="og:title" content="' . $e($og['titulo']) . '">',
        '<meta property="og:description" content="' . $e($og['descripcion']) . '">',
        '<meta name="twitter:card" content="summary_large_image">',
    ];
    // Las direcciones de og:url y og:image tienen que ser completas: sin url_publica no se ponen
    if ($base !== '') {
        $lineas[] = '<meta property="og:url" content="' . $e($base . $ruta) . '">';
        $lineas[] = '<meta property="og:image" content="' . $e($base . $og['imagen']) . '">';
        if ($og['ancho']) {
            $lineas[] = '<meta property="og:image:width" content="' . $og['ancho'] . '">';
            $lineas[] = '<meta property="og:image:height" content="' . $og['alto'] . '">';
        }
        $lineas[] = '<meta property="og:image:alt" content="' . $e($og['alt']) . '">';
    }
    return implode("\n  ", $lineas);
}

// Si la tienda o el producto no existe, o la base no responde, la página sale con la vista previa general
function og_sin_fallar(callable $fn): array
{
    try {
        return $fn() ?? [];
    } catch (Throwable $e) {
        error_log('Necutla: vista previa sin datos: ' . $e->getMessage());
        return [];
    }
}

// Devuelve la respuesta de la página, o null si la ruta no es una página (la atiende la API)
function pagina_publica(string $ruta): ?Respuesta
{
    $og = [];
    if (isset(PAGINAS_FIJAS[$ruta])) {
        $archivo = PAGINAS_FIJAS[$ruta];
    } elseif (preg_match('#^/t/([a-z0-9-]{1,60})/?$#', $ruta, $m)) {
        $archivo = 'tienda.html';
        $og = og_sin_fallar(fn() => og_de_tienda($m[1]));
    } elseif (preg_match('#^/p/([1-9][0-9]{0,9})/?$#', $ruta, $m)) {
        $archivo = 'producto.html';
        $og = og_sin_fallar(fn() => og_de_producto((int) $m[1]));
    } else {
        return null;
    }
    $html = file_get_contents(RAIZ . "/public/$archivo");
    $etiquetas = etiquetas_og($og, rtrim($ruta, '/') ?: '/');
    // Con callback: un precio como "$150.00" no debe leerse como referencia ($15) del reemplazo
    $html = preg_replace_callback('#<!--og:inicio-->.*?<!--og:fin-->#s', fn() => "<!--og:inicio-->\n  $etiquetas\n  <!--og:fin-->", $html, 1);
    // Igual que el HTML estático (public/.htaccess): se revalida siempre
    return binaria($html, 'text/html; charset=utf-8', ['Cache-Control' => 'no-cache']);
}
