<?php
/**
 * Páginas públicas con la vista previa del enlace (Open Graph) que muestran WhatsApp y las redes.
 * public/.htaccess manda aquí la portada, carrito, promociones, cuenta, /t/<slug> y /p/<id>: se lee el HTML de
 * public/ y se cambia el bloque <!--og:inicio-->…<!--og:fin--> por las etiquetas de esa página.
 * Plan: plans/planes/2026-10-29-reels-esqueletos-botones-open-graph.md
 * Desde el plan 2026-10-31-seo-iconos-contenido-y-legal también pone el <title>, la descripción, la dirección
 * canónica, noindex donde no hace falta indexar y los datos estructurados (JSON-LD) de cada página.
 */

const PAGINAS_FIJAS = [
    '/' => 'index.html', '/index.html' => 'index.html', '/carrito.html' => 'carrito.html',
    '/promociones.html' => 'promociones.html', '/cuenta.html' => 'cuenta.html',
    '/privacidad.html' => 'privacidad.html', '/terminos.html' => 'terminos.html',
];

// Se sube cuando cambian las cabeceras de las imágenes: la caché de IONOS guarda cada dirección con las de antes
const OG_VERSION = '2';

const OG_GENERAL = [
    'titulo' => 'Necutla: tiendas de estudiantes con pedidos por WhatsApp',
    'descripcion' => 'Directorio de tiendas de estudiantes: ropa, tecnología, dulces, papelería, regalos y más. Arma tu carrito y manda tu pedido por WhatsApp directo al vendedor.',
    'imagen' => '/imagenes/og-necutla.png',
    'ancho' => 1200,
    'alto' => 630,
    'alt' => 'Necutla, la ciudad del estudiante: tablero de tiendas',
];

// Páginas que no deben salir en los buscadores (son de cada persona)
const PAGINAS_NOINDEX = ['carrito.html', 'cuenta.html'];

// Largos que recomiendan los buscadores (y el revisor de IONOS)
const LARGO_TITULO = 60;
const LARGO_DESCRIPCION = 160;

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
    $og = [
        'titulo' => "{$s['nombre']} en Necutla",
        'descripcion' => recortar($s['descripcion'] ?: "Catálogo de {$s['nombre']}. Arma tu pedido y mándalo por WhatsApp a la tienda.", 150),
        'pagina' => titulo_pagina("{$s['nombre']}: productos y servicios de estudiantes", $s['nombre']),
        'meta' => descripcion_meta($s['descripcion'] ?: "Catálogo de {$s['nombre']} en Necutla.",
            'Arma tu carrito y manda tu pedido por WhatsApp directo a la tienda.'),
        'jsonld' => [migas([['Inicio', '/'], [$s['nombre'], '/t/' . $slug]])],
    ];
    // Con portada real se usa la portada; si es SVG o no hay, la imagen generada de la tienda (app/og-imagen.php)
    $imagen = imagen_para_vista(imagen_tienda($s));
    if ($imagen) return $og + ['imagen' => $imagen, 'alt' => "Tienda {$s['nombre']}", 'ancho' => null, 'alto' => null];
    if (!vista_tienda_disponible()) return $og;
    $v = datos_vista_tienda((int) $s['id'])['version'] ?? '';
    return $og + ['imagen' => "/api/stands/{$s['id']}/vista?v=$v", 'alt' => "Tienda {$s['nombre']} en Necutla"];
}

function og_de_producto(int $id): ?array
{
    $f = fila('SELECT ' . COLUMNAS_PRODUCTO . ', s.nombre AS tienda, s.slug FROM productos p JOIN stands s ON s.id = p.stand_id
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
    $nombre = $p['nombre'] . ($precio ? " — $precio" : '');
    return [
        'titulo' => $nombre . " en {$f['tienda']}",
        'descripcion' => recortar($p['descripcion'] ?: "Pídelo en Necutla y mándale tu pedido por WhatsApp a {$f['tienda']}.", 150),
        'pagina' => titulo_pagina("$nombre en {$f['tienda']}", $p['nombre']),
        'meta' => descripcion_meta($p['descripcion'] ?: "{$p['nombre']} de {$f['tienda']} en Necutla" . ($precio ? ", $precio" : '') . '.',
            "Pídelo en Necutla y manda tu pedido por WhatsApp a {$f['tienda']}."),
        'jsonld' => [
            jsonld_producto($p, $f['tienda'], $imagen),
            migas([['Inicio', '/'], [$f['tienda'], '/t/' . $f['slug']], [$p['nombre'], '/p/' . $id]]),
        ],
    ] + ($imagen ? ['imagen' => $imagen, 'alt' => $p['nombre'], 'ancho' => null, 'alto' => null] : []);
}

// "Ropa: productos y servicios de estudiantes | Necutla"; si no cabe en 60, se acorta
function titulo_pagina(string $largo, string $corto): string
{
    foreach (["$largo | Necutla", $largo, "$corto | Necutla"] as $t) if (mb_strlen($t) <= LARGO_TITULO) return $t;
    return recortar($corto, LARGO_TITULO);
}

// Descripción de 140 a 160 caracteres: la del dato y, si queda corta, frases que expliquen cómo pedir.
// Si se pasa, se corta en la última palabra completa.
function descripcion_meta(string $texto, string $relleno): string
{
    $texto = trim(preg_replace('/\s+/u', ' ', $texto));
    foreach ([$relleno, 'Necutla reúne las tiendas de la comunidad estudiantil.'] as $frase) {
        if (mb_strlen($texto) >= 140) break;
        $texto = rtrim($texto, '. ') . '. ' . $frase;
    }
    if (mb_strlen($texto) <= LARGO_DESCRIPCION) return $texto;
    $corte = mb_substr($texto, 0, LARGO_DESCRIPCION - 1);
    return rtrim(mb_substr($corte, 0, mb_strrpos($corte, ' ') ?: LARGO_DESCRIPCION - 1), ' .,;:') . '…';
}

function url_completa(string $ruta): string
{
    return rtrim((string) config('url_publica'), '/') . $ruta;
}

// Ruta de migas de pan (BreadcrumbList) de schema.org
function migas(array $pasos): array
{
    $lista = [];
    foreach ($pasos as $i => [$nombre, $ruta]) {
        $lista[] = ['@type' => 'ListItem', 'position' => $i + 1, 'name' => $nombre, 'item' => url_completa($ruta)];
    }
    return ['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => $lista];
}

// Producto (o servicio) con su precio de hoy, disponibilidad y calificación, para los resultados de búsqueda
function jsonld_producto(array $p, string $tienda, ?string $imagen): array
{
    $vendedor = ['@type' => 'Organization', 'name' => $tienda];
    $d = [
        '@context' => 'https://schema.org',
        '@type' => $p['tipo'] === 'servicio' ? 'Service' : 'Product',
        'name' => $p['nombre'],
        'url' => url_completa('/p/' . $p['id']),
    ];
    if ($p['descripcion']) $d['description'] = recortar($p['descripcion'], 500);
    if ($imagen) $d['image'] = url_completa($imagen);
    if ($p['tipo'] === 'servicio') $d['provider'] = $vendedor;
    if ($p['precio'] !== null && $p['precio_modo'] !== 'cotizar') {
        $monto = number_format((float) ($p['oferta']['precio_oferta'] ?? $p['precio']), 2, '.', '');
        $d['offers'] = [
            '@type' => $p['precio_modo'] === 'desde' ? 'AggregateOffer' : 'Offer',
            ($p['precio_modo'] === 'desde' ? 'lowPrice' : 'price') => $monto,
            'priceCurrency' => 'MXN',
            'availability' => 'https://schema.org/' . ($p['agotado'] ? 'OutOfStock' : 'InStock'),
            'url' => url_completa('/p/' . $p['id']),
            'seller' => $vendedor,
        ];
    }
    if ($p['resenas'] > 0 && $p['calificacion']) {
        $d['aggregateRating'] = ['@type' => 'AggregateRating', 'ratingValue' => $p['calificacion'], 'reviewCount' => $p['resenas'],
            'bestRating' => 5, 'worstRating' => 1];
    }
    return $d;
}

// Portada: el sitio (con su buscador) y quién lo publica
function jsonld_portada(): array
{
    return [
        [
            '@context' => 'https://schema.org',
            '@type' => 'WebSite',
            'name' => 'Necutla',
            'alternateName' => 'Necutla, la ciudad del estudiante',
            'url' => url_completa('/'),
            'inLanguage' => 'es-MX',
            'potentialAction' => [
                '@type' => 'SearchAction',
                'target' => ['@type' => 'EntryPoint', 'urlTemplate' => url_completa('/?q={search_term_string}')],
                'query-input' => 'required name=search_term_string',
            ],
        ],
        [
            '@context' => 'https://schema.org',
            '@type' => 'Organization',
            'name' => 'Necutla',
            'url' => url_completa('/'),
            'logo' => url_completa('/imagenes/icono-512.png'),
            'email' => 'tienda@necutla.com',
        ],
    ];
}

// <script type="application/ld+json">: son datos, el navegador no los ejecuta. Sin "<" ni "&" en claro.
function bloque_jsonld(array $datos): string
{
    $json = json_encode($datos, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_THROW_ON_ERROR);
    return '<script type="application/ld+json">' . $json . '</script>';
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
        $imagen = $og['imagen'] . (str_contains($og['imagen'], '?') ? '&' : '?') . 'og=' . OG_VERSION;
        $lineas[] = '<meta property="og:image" content="' . $e($base . $imagen) . '">';
        if ($og['ancho']) {
            $lineas[] = '<meta property="og:image:width" content="' . $og['ancho'] . '">';
            $lineas[] = '<meta property="og:image:height" content="' . $og['alto'] . '">';
        }
        $lineas[] = '<meta property="og:image:alt" content="' . $e($og['alt']) . '">';
        if (empty($og['noindex'])) $lineas[] = '<link rel="canonical" href="' . $e($base . $ruta) . '">';
        foreach ($og['jsonld'] ?? [] as $datos) $lineas[] = bloque_jsonld($datos);
    }
    if (!empty($og['noindex'])) $lineas[] = '<meta name="robots" content="noindex">';
    return implode("\n  ", $lineas);
}

// Si la tienda o el producto no existe, la página sale con la vista previa general, noindex y estado 404.
// Si la base no responde, con la vista previa general y 200 (no se sabe si existe).
function og_sin_fallar(callable $fn): array
{
    try {
        return $fn() ?? ['no_existe' => true, 'noindex' => true];
    } catch (Throwable $e) {
        error_log('Necutla: vista previa sin datos: ' . $e->getMessage());
        return [];
    }
}

// Cloudflare Web Analytics (plan 2026-10-31-seguridad-turnstile-y-cloudflare-aparte): cuenta visitas sin cookies.
// Solo en las páginas públicas (Necutools no pasa por aquí) y solo si hay token en app/config.php. No es JS en
// línea: es un <script src> que la CSP permite (static.cloudflareinsights.com y cloudflareinsights.com).
function con_web_analytics(string $html): string
{
    $token = config('cloudflare_analytics');
    if (!is_string($token) || !preg_match('/^[a-f0-9]{32}$/', $token)) return $html;
    $script = '<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon=\'{"token": "' . $token . '"}\'></script>';
    $fin = strrpos($html, '</body>');
    return $fin === false ? $html : substr($html, 0, $fin) . "  $script\n" . substr($html, $fin);
}

// Aviso de cookies y Google Tag Manager, solo si hay id en app/config.php. Google carga hasta que la persona acepta.
// Mi cuenta no lo lleva (contraseñas, teléfono y códigos) y Necutools tampoco (no pasa por aquí).
function con_tag_manager(string $html, string $archivo): string
{
    $id = config('google_tag_manager');
    if ($archivo === 'cuenta.html' || !is_string($id) || !preg_match('/^GTM-[A-Z0-9]{4,12}$/', $id)) return $html;
    $charset = '<meta charset="utf-8">';
    $pos = strpos($html, $charset);
    if ($pos === false) return $html;
    $pos += strlen($charset);
    return substr($html, 0, $pos) . "\n  <script defer src=\"/js/etiquetas.js\" data-gtm=\"$id\"></script>" . substr($html, $pos);
}

// Devuelve la respuesta de la página, o null si la ruta no es una página (la atiende la API)
function pagina_publica(string $ruta): ?Respuesta
{
    if ($ruta === '/sitemap.xml') return respuesta_sitemap();
    $og = [];
    if (isset(PAGINAS_FIJAS[$ruta])) {
        $archivo = PAGINAS_FIJAS[$ruta];
        if (in_array($archivo, PAGINAS_NOINDEX, true)) $og['noindex'] = true;
        if ($archivo === 'index.html') $og['jsonld'] = jsonld_portada();
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
    // La dirección canónica de la portada es "/" (no "/index.html")
    $etiquetas = etiquetas_og($og, $archivo === 'index.html' ? '/' : (rtrim($ruta, '/') ?: '/'));
    // Con callback: un precio como "$150.00" no debe leerse como referencia ($15) del reemplazo
    $html = preg_replace_callback('#<!--og:inicio-->.*?<!--og:fin-->#s', fn() => "<!--og:inicio-->\n  $etiquetas\n  <!--og:fin-->", $html, 1);
    $e = fn($v) => htmlspecialchars((string) $v, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8');
    if (isset($og['pagina'])) {
        $html = preg_replace_callback('#<title>.*?</title>#s', fn() => '<title>' . $e($og['pagina']) . '</title>', $html, 1);
    }
    if (isset($og['meta'])) {
        $html = preg_replace_callback('#<meta name="description" content="[^"]*">#', fn() => '<meta name="description" content="' . $e($og['meta']) . '">', $html, 1);
    }
    $html = con_web_analytics($html);
    $html = con_tag_manager($html, $archivo);
    // Igual que el HTML estático (public/.htaccess): se revalida siempre
    $respuesta = binaria($html, 'text/html; charset=utf-8', ['Cache-Control' => 'no-cache']);
    if (!empty($og['no_existe'])) $respuesta->status = 404; // la página se ve igual ("no encontrada"), pero no cuenta como página
    return $respuesta;
}
