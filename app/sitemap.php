<?php
/**
 * Mapa del sitio para los buscadores (plan 2026-10-31-seo-iconos-contenido-y-legal).
 * GET /sitemap.xml (public/.htaccess lo manda a api/index.php y app/paginas.php lo atiende sin sesión ni límite).
 * Solo lo público y visible: portada, promociones, aviso de privacidad, términos, cada tienda visible y cada
 * producto o servicio visible de una tienda visible. Nada de carrito, cuenta, Necutools ni la API.
 */

// Páginas fijas que se indexan (si el archivo existe en public/)
const SITEMAP_FIJAS = ['/' => 'index.html', '/promociones.html' => 'promociones.html',
    '/privacidad.html' => 'privacidad.html', '/terminos.html' => 'terminos.html'];

function fecha_sitemap(?string $fecha): ?string
{
    return $fecha ? substr(str_replace(' ', 'T', $fecha), 0, 19) . '+00:00' : null; // la base guarda UTC
}

function respuesta_sitemap(): Respuesta
{
    $base = rtrim((string) config('url_publica'), '/');
    if ($base === '') {
        $vacia = binaria('', 'text/plain; charset=utf-8');
        $vacia->status = 404; // sin url_publica no hay direcciones completas que dar
        return $vacia;
    }

    $urls = [];
    foreach (SITEMAP_FIJAS as $ruta => $archivo) {
        $ruta_archivo = RAIZ . "/public/$archivo";
        if (is_file($ruta_archivo)) $urls[] = [$ruta, gmdate('Y-m-d\TH:i:s+00:00', filemtime($ruta_archivo))];
    }
    foreach (filas('SELECT slug, actualizado_en FROM stands WHERE visible ORDER BY orden, nombre') as $s) {
        $urls[] = ['/t/' . $s['slug'], fecha_sitemap($s['actualizado_en'])];
    }
    foreach (filas('SELECT p.id, p.actualizado_en FROM productos p JOIN stands s ON s.id = p.stand_id
                    WHERE p.visible AND s.visible ORDER BY p.id') as $p) {
        $urls[] = ['/p/' . $p['id'], fecha_sitemap($p['actualizado_en'])];
    }

    $e = fn($v) => htmlspecialchars((string) $v, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
         . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    foreach ($urls as [$ruta, $fecha]) {
        $xml .= '  <url><loc>' . $e($base . $ruta) . '</loc>' . ($fecha ? '<lastmod>' . $e($fecha) . '</lastmod>' : '') . "</url>\n";
    }
    $xml .= "</urlset>\n";
    return binaria($xml, 'application/xml; charset=utf-8', ['Cache-Control' => 'public, max-age=3600']);
}
