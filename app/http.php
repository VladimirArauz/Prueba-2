<?php
/**
 * Peticiones y respuestas de la API: router mínimo, errores con código HTTP y lectura del JSON.
 * Las rutas, los JSON y los textos de error son los mismos que tenía el servidor de Node.
 */

// Dato inválido del usuario → 400 { error[, sugerencia] }
class ErrorDeDatos extends Exception
{
    public ?string $sugerencia = null;
}

// Error con código HTTP propio (401, 403, 404, 409, 429…)
class ErrorHttp extends Exception
{
    public int $status;

    public function __construct(int $status, string $mensaje)
    {
        parent::__construct($mensaje);
        $this->status = $status;
    }
}

final class Respuesta
{
    public int $status = 200;
    public $cuerpo = null;
    public bool $esJson = true;
    public string $tipo = '';
    public array $cabeceras = [];
}

function json_respuesta($datos, int $status = 200): Respuesta
{
    $r = new Respuesta();
    $r->status = $status;
    $r->cuerpo = $datos;
    return $r;
}

// Sin cuerpo: 204 al borrar, 404 de una imagen que no existe
function vacia(int $status = 204): Respuesta
{
    $r = new Respuesta();
    $r->status = $status;
    $r->esJson = false;
    $r->cuerpo = '';
    return $r;
}

function binaria(string $bytes, string $tipo, array $cabeceras = []): Respuesta
{
    $r = new Respuesta();
    $r->esJson = false;
    $r->cuerpo = $bytes;
    $r->tipo = $tipo;
    $r->cabeceras = $cabeceras;
    return $r;
}

// ================= La petición actual =================
final class Peticion
{
    public static string $metodo = 'GET';
    public static string $ruta = '/';
    public static array $cuerpo = [];
    // Funciones que corren con el código final de la respuesta (límites que solo cuentan fallos)
    public static array $alTerminar = [];
}

function cuerpo(): array
{
    return Peticion::$cuerpo;
}

// Campo del cuerpo JSON; null si no viene (para "no viene" contra null usa existe())
function campo(string $nombre)
{
    return Peticion::$cuerpo[$nombre] ?? null;
}

function existe(string $nombre): bool
{
    return array_key_exists($nombre, Peticion::$cuerpo);
}

function consulta(string $nombre)
{
    return $_GET[$nombre] ?? null;
}

// ================= Conversiones con las reglas de JavaScript =================
// El servidor de Node validaba con Number(), typeof y Array.isArray: aquí se respeta lo mismo.

// Number(valor): NAN si no es un número
function js_numero($v): float
{
    if ($v === null) return 0.0;
    if (is_bool($v)) return $v ? 1.0 : 0.0;
    if (is_int($v) || is_float($v)) return (float) $v;
    if (is_array($v)) {
        if (!$v) return 0.0;
        if (count($v) === 1 && array_is_list($v) && !is_array($v[0])) return js_numero(is_bool($v[0]) ? ($v[0] ? 'true' : 'false') : (string) ($v[0] ?? ''));
        return NAN;
    }
    $s = js_trim((string) $v);
    if ($s === '') return 0.0;
    if (preg_match('/^[+-]?(Infinity)$/', $s)) return $s[0] === '-' ? -INF : INF;
    if (preg_match('/^0x[0-9a-f]+$/i', $s)) return (float) hexdec(substr($s, 2));
    if (preg_match('/^0b[01]+$/i', $s)) return (float) bindec(substr($s, 2));
    if (preg_match('/^0o[0-7]+$/i', $s)) return (float) octdec(substr($s, 2));
    if (preg_match('/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i', $s)) return (float) $s;
    return NAN;
}

function js_entero(float $n): bool
{
    return is_finite($n) && floor($n) === $n;
}

// String.prototype.trim(): también quita los espacios de Unicode
function js_trim(string $s): string
{
    return preg_replace('/^[\s\p{Z}\x{FEFF}]+|[\s\p{Z}\x{FEFF}]+$/u', '', $s) ?? trim($s);
}

function js_lista($v): bool
{
    return is_array($v) && array_is_list($v);
}

// Math.round(n * 100) / 100
function redondear(float $n): float
{
    return floor($n * 100 + 0.5) / 100;
}

// String.prototype.localeCompare
function comparar_texto(string $a, string $b): int
{
    static $collator = null;
    if ($collator === null) $collator = class_exists('Collator') ? new Collator('es') : false;
    return $collator ? $collator->compare($a, $b) : strcmp($a, $b);
}

// ================= Router =================
final class Rutas
{
    private static array $lista = [];

    // "/api/productos/:id" → expresión regular (como Express: sin importar mayúsculas y con "/" final opcional)
    public static function agregar(string $metodo, string $patron, callable $fn): void
    {
        $regex = '#^' . preg_replace('#:([a-z]+)#i', '([^/]+)', $patron) . '/?$#i';
        self::$lista[] = [$metodo, $regex, $fn];
    }

    // null si ninguna ruta coincide
    public static function buscar(string $metodo, string $ruta): ?array
    {
        foreach (self::$lista as [$m, $regex, $fn]) {
            if ($m !== $metodo) continue;
            if (preg_match($regex, $ruta, $partes)) {
                return [$fn, array_map('rawurldecode', array_slice($partes, 1))];
            }
        }
        return null;
    }

    public static function metodos(string $ruta): array
    {
        $metodos = [];
        foreach (self::$lista as [$m, $regex]) if (preg_match($regex, $ruta)) $metodos[] = $m;
        return array_values(array_unique($metodos));
    }
}

function get(string $patron, callable $fn): void { Rutas::agregar('GET', $patron, $fn); }
function post(string $patron, callable $fn): void { Rutas::agregar('POST', $patron, $fn); }
function put(string $patron, callable $fn): void { Rutas::agregar('PUT', $patron, $fn); }
function delete(string $patron, callable $fn): void { Rutas::agregar('DELETE', $patron, $fn); }

// ================= Cuerpo JSON =================
// Solo las rutas de Necutools que suben imágenes aceptan cuerpos grandes; el resto, 20 KB
const CON_IMAGEN = '#^/admin/((tiendas|productos|promociones)(/[0-9]+)?|productos/[0-9]+/colores|colores/[0-9]+)$#';

function leer_json(string $rutaApi): array
{
    $tipo = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
    if ($tipo !== 'application/json') return [];
    $conImagen = (bool) preg_match(CON_IMAGEN, $rutaApi);
    $limite = $conImagen ? 2 * 1024 * 1024 : 20 * 1024;
    $demasiado = new ErrorHttp(413, $conImagen
        ? 'El archivo es demasiado grande. Usa una imagen de hasta 1 MB.'
        : 'Mandaste demasiados datos. Revisa el formulario y vuelve a intentar.');
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > $limite) throw $demasiado;
    $crudo = (string) file_get_contents('php://input', false, null, 0, $limite + 1);
    if (strlen($crudo) > $limite) throw $demasiado;
    if (trim($crudo) === '') return [];
    // Como express.json en modo estricto: solo objetos o listas
    $primero = ltrim($crudo, " \t\r\n")[0] ?? '';
    $datos = ($primero === '{' || $primero === '[') ? json_decode($crudo, true, 64) : null;
    if (!is_array($datos)) throw new ErrorHttp(400, 'Datos con formato incorrecto.');
    return array_is_list($datos) && $primero === '[' ? [] : $datos;
}

// ================= Enviar la respuesta =================
function enviar(Respuesta $r): void
{
    http_response_code($r->status);
    header_remove('X-Powered-By');
    foreach ($r->cabeceras as $nombre => $valor) {
        foreach ((array) $valor as $v) header("$nombre: $v", false);
    }
    if ($r->status === 204 || $r->status === 304) return;
    if ($r->esJson) {
        $texto = json_encode($r->cuerpo, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
        header('Content-Type: application/json; charset=utf-8');
        header('Content-Length: ' . strlen($texto));
        echo $texto;
        return;
    }
    if ($r->tipo !== '') header('Content-Type: ' . $r->tipo);
    header('Content-Length: ' . strlen($r->cuerpo));
    echo $r->cuerpo;
}
