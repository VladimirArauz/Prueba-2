<?php
/**
 * NECUTLA — Servidor de la API en PHP (hosting compartido de IONOS).
 * Lo carga public/api/index.php en cada petición a /api/* y /healthz.
 * Plan: plans/planes/2026-10-25-migracion-ionos-php-mariadb.md
 */

const RAIZ = __DIR__ . '/..';

// PHP 8.5 o más nuevo, con los parches al día (PHP2Shell, CVE-2026-109618 y CVE-2026-109619, se corrigió
// en 8.5.12). En IONOS: Hosting → PHP → 8.5. Con una versión vieja la API no arranca y lo dice en el log.
if (PHP_VERSION_ID < 80500) {
    $aviso = 'Necutla necesita PHP 8.5 o más nuevo; este servidor tiene ' . PHP_VERSION;
    if (PHP_SAPI === 'cli') {
        fwrite(STDERR, "$aviso (usa php8.5)\n");
        exit(1);
    }
    error_log($aviso);
    http_response_code(503);
    exit;
}

// Errores al log, nunca a la pantalla; los avisos de PHP se vuelven excepciones (respuesta 500 sin detalles)
ini_set('display_errors', '0');
ini_set('log_errors', '1');
// Números en el JSON con la forma más corta que se lee igual (como JavaScript): 0.3, no 0.299999…
ini_set('serialize_precision', '-1');
error_reporting(E_ALL);
date_default_timezone_set('UTC');
mb_internal_encoding('UTF-8');
set_error_handler(function (int $nivel, string $mensaje, string $archivo, int $linea) {
    if (!(error_reporting() & $nivel)) return false; // llamadas con @
    throw new ErrorException($mensaje, 0, $nivel, $archivo, $linea);
});

function config(string $clave)
{
    static $config = null;
    if ($config === null) {
        $ruta = __DIR__ . '/config.php';
        if (!is_file($ruta)) throw new RuntimeException('Falta app/config.php. Copia app/config.ejemplo.php y complétalo.');
        $config = require $ruta;
        if (strlen($config['secreto'] ?? '') < 32) throw new RuntimeException('El secreto de app/config.php debe tener al menos 32 caracteres.');
    }
    return $config[$clave] ?? null;
}

// Interruptores que valen true si no están en app/config.php
function cuentas_clientes(): bool { return config('cuentas_clientes') !== false; }
function con_https(): bool { return config('produccion') && config('https') !== false; }

require __DIR__ . '/bd.php';
require __DIR__ . '/http.php';
require __DIR__ . '/seguridad.php';
require __DIR__ . '/sesiones.php';
require __DIR__ . '/validar.php';
require __DIR__ . '/contrasenas.php';
require __DIR__ . '/intentos.php';
require __DIR__ . '/totp.php';
require __DIR__ . '/bitacora.php';
require __DIR__ . '/imagenes.php';
require __DIR__ . '/ofertas.php';
require __DIR__ . '/auth.php';
require __DIR__ . '/clientes.php';
require __DIR__ . '/api.php';
require __DIR__ . '/resenas.php';
require __DIR__ . '/pedidos.php';
require __DIR__ . '/admin.php';

// Respuestas con datos privados: que no se guarden en caché
// Sin importar mayúsculas, igual que el router: /API/ADMIN/… también es privado
const PRIVADAS = '#^/(admin|auth|clientes)(/|$)#i';

// Convierte cualquier error en la respuesta que daba Node
function respuesta_de_error(Throwable $e): Respuesta
{
    if ($e instanceof ErrorDeDatos) {
        return json_respuesta($e->sugerencia ? ['error' => $e->getMessage(), 'sugerencia' => $e->sugerencia] : ['error' => $e->getMessage()], 400);
    }
    if ($e instanceof ErrorHttp) return json_respuesta(['error' => $e->getMessage()], $e->status);
    // Violaciones de restricciones de la base que vienen de datos del usuario
    $codigo = error_bd($e);
    if ($codigo === 1062) return json_respuesta(['error' => 'Ya existe un registro con ese nombre.'], 409);
    if ($codigo === 1451 || $codigo === 1452) return json_respuesta(['error' => 'No se puede: otro registro depende de este.'], 409);
    error_log('Necutla: ' . get_class($e) . ': ' . $e->getMessage() . ' en ' . $e->getFile() . ':' . $e->getLine());
    return json_respuesta(['error' => 'Ocurrió un error en el servidor. Intenta de nuevo.'], 500);
}

function atender(): void
{
    $metodo = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $ruta = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    Peticion::$metodo = $metodo;
    Peticion::$ruta = $ruta;

    // Salud (para revisar que el sitio y la base responden)
    if (preg_match('#^/healthz/?$#i', $ruta)) {
        try {
            valor('SELECT 1');
            enviar(json_respuesta(['ok' => true]));
        } catch (Throwable $e) {
            enviar(json_respuesta(['ok' => false], 503));
        }
        return;
    }

    $rutaApi = substr($ruta, 4) ?: '/';
    $cabeceras = ['X-Robots-Tag' => 'noindex, nofollow'];
    if (preg_match(PRIVADAS, $rutaApi)) $cabeceras['Cache-Control'] = 'no-store';
    $conSesion = false;
    try {
        limitar('api', 300, MIN_15, 'Demasiadas peticiones. Espera unos minutos.');
        exigir_mismo_origen();
        Peticion::$cuerpo = leer_json($rutaApi);
        Sesion::cargar();
        $conSesion = true;
        vida_maxima();

        rutas_auth();
        rutas_clientes();
        rutas_resenas();
        rutas_pedidos();
        rutas_api();
        rutas_admin();

        $buscar = $metodo === 'HEAD' ? 'GET' : $metodo;
        $encontrada = Rutas::buscar($buscar, $ruta);
        if ($encontrada) {
            [$fn, $params] = $encontrada;
            $resultado = $fn(...$params);
            $respuesta = $resultado instanceof Respuesta ? $resultado : json_respuesta($resultado);
        } elseif ($metodo === 'OPTIONS' && ($metodos = Rutas::metodos($ruta))) {
            $respuesta = binaria(implode(',', $metodos), 'text/html; charset=utf-8', ['Allow' => implode(',', $metodos)]);
        } else {
            // En Node, todo /api/admin pedía sesión antes de saber si la ruta existía
            if (preg_match('#^/api/admin(/|$)#i', $ruta)) requiere_admin();
            $respuesta = json_respuesta(['error' => 'Ruta no encontrada.'], 404);
        }
    } catch (Throwable $e) {
        $respuesta = respuesta_de_error($e);
    }

    try {
        foreach (Peticion::$alTerminar as $fn) $fn($respuesta->status);
        if ($conSesion) Sesion::guardar($respuesta);
        if (random_int(1, 100) === 1) limpiar_viejos();
    } catch (Throwable $e) {
        $respuesta = respuesta_de_error($e);
    }
    $respuesta->cabeceras = $cabeceras + $respuesta->cabeceras;
    enviar($respuesta);
}
