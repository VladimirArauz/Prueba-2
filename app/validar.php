<?php
/**
 * Validación compartida por la API pública y la de administración.
 */

const MAX_IMAGEN_BYTES = 1024 * 1024; // 1 MB

function dato_invalido(string $mensaje, ?string $sugerencia = null): ErrorDeDatos
{
    $e = new ErrorDeDatos($mensaje);
    $e->sugerencia = $sugerencia;
    return $e;
}

function v_texto($valor, string $campo, int $max, bool $requerido = false, ?string $defecto = ''): ?string
{
    if ($valor === null) $valor = '';
    if (!is_string($valor)) throw dato_invalido("$campo no es válido.");
    $limpio = js_trim($valor);
    if ($requerido && $limpio === '') throw dato_invalido("Escribe $campo.");
    if (mb_strlen($limpio) > $max) throw dato_invalido("$campo admite hasta $max caracteres.");
    return $limpio !== '' ? $limpio : $defecto;
}

function id_valido($valor): ?int
{
    $id = js_numero($valor);
    return js_entero($id) && $id > 0 && $id < 2147483647 ? (int) $id : null;
}

// Id opcional: vacío o null → null; cualquier otra cosa debe ser un id válido
function id_opcional($valor, string $campo): ?int
{
    if ($valor === null || $valor === '') return null;
    $id = id_valido($valor);
    if (!$id) throw dato_invalido("$campo no es válido.");
    return $id;
}

function v_entero($valor, string $campo, int $min = 0, int $max = 9999, ?int $defecto = 0): ?int
{
    if ($valor === null || $valor === '') return $defecto;
    $n = js_numero($valor);
    if (!js_entero($n) || $n < $min || $n > $max) throw dato_invalido("$campo debe ser un número entre $min y $max.");
    return (int) $n;
}

function v_booleano($valor, bool $defecto = true): bool
{
    if ($valor === null) return $defecto;
    return $valor === true || $valor === 'true' || $valor === 1 || $valor === 1.0 || $valor === '1';
}

// Precio con 2 decimales como texto ("199.00")
function v_precio($valor, string $campo = 'el precio'): string
{
    $n = js_numero($valor);
    if ($valor === '' || $valor === null || !is_finite($n) || $n <= 0 || $n > 99999999) {
        throw dato_invalido("Escribe $campo mayor a 0.");
    }
    return number_format($n, 2, '.', '');
}

function v_opcion($valor, array $opciones, string $campo)
{
    if (!in_array($valor, $opciones, true)) throw dato_invalido("Elige $campo.");
    return $valor;
}

function v_fecha($valor, string $campo): string
{
    if (!is_string($valor) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $valor, $m) || !checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
        throw dato_invalido("Escribe $campo con formato de fecha.");
    }
    return $valor;
}

// "Papelería Fer" → "papeleria-fer"
function slug_de($valor): string
{
    $s = mb_strtolower((string) $valor);
    if (class_exists('Normalizer')) {
        $s = preg_replace('/[\x{0300}-\x{036f}]/u', '', Normalizer::normalize($s, Normalizer::FORM_D));
    } else {
        $s = strtr($s, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n',
            'à' => 'a', 'è' => 'e', 'ì' => 'i', 'ò' => 'o', 'ù' => 'u', 'ç' => 'c']);
    }
    return trim(preg_replace('/[^a-z0-9]+/', '-', $s), '-');
}

function v_slug($valor, string $campo, ?string $respaldo = null): string
{
    $limpio = slug_de(is_string($valor) && js_trim($valor) !== '' ? $valor : ($respaldo ?? ''));
    if ($limpio === '') throw dato_invalido("Escribe $campo con letras o números.");
    if (strlen($limpio) > 60) throw dato_invalido("$campo admite hasta 60 caracteres.");
    return $limpio;
}

// Números de WhatsApp: México 52 + 10 dígitos (acepta de 10 a 15 dígitos)
function numeros_whatsapp($valor): array
{
    $lista = $valor;
    if ($lista === null || $lista === '') return [];
    if (is_string($lista)) $lista = explode(',', $lista);
    if (!js_lista($lista) || count($lista) > 5) throw dato_invalido('Escribe hasta 5 números de WhatsApp.');
    $numeros = array_values(array_filter(array_map(fn($n) => preg_replace('/\D/', '', is_scalar($n) ? (string) $n : ''), $lista)));
    foreach ($numeros as $n) {
        if (strlen($n) < 10 || strlen($n) > 15) throw dato_invalido('Cada número de WhatsApp debe tener de 10 a 15 dígitos (México: 52 + 10 dígitos).');
    }
    return array_values(array_unique($numeros));
}

// Números de respaldo de la configuración (whatsapp_respaldo)
function numeros_respaldo(): array
{
    $lista = array_map(fn($n) => preg_replace('/\D/', '', $n), explode(',', (string) config('whatsapp_respaldo')));
    return array_values(array_filter($lista, fn($n) => strlen($n) >= 10 && strlen($n) <= 15));
}

// Acepta un data URL de imagen PNG, JPG, WEBP o GIF y revisa sus bytes reales
function leer_imagen($dataUrl): array
{
    if (!is_string($dataUrl)) throw dato_invalido('La imagen no es válida.');
    if (!preg_match('#^data:(image/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$#', $dataUrl, $m)) {
        throw dato_invalido('Usa una imagen PNG, JPG, WEBP o GIF.');
    }
    $bytes = base64_decode($m[2]);
    if (strlen($bytes) > MAX_IMAGEN_BYTES) throw dato_invalido('La imagen debe pesar hasta 1 MB.');
    $hex = bin2hex(substr($bytes, 0, 12));
    $firmas = [
        'image/png' => str_starts_with($hex, '89504e47'),
        'image/jpeg' => str_starts_with($hex, 'ffd8ff'),
        'image/gif' => str_starts_with($hex, '47494638'),
        'image/webp' => str_starts_with($hex, '52494646') && substr($hex, 16, 8) === '57454250',
    ];
    if (!$firmas[$m[1]]) throw dato_invalido('El archivo no es una imagen válida.');
    return ['bytes' => $bytes, 'tipo' => $m[1]];
}

// ================= Cuentas: usuario, correo y teléfono =================
// Usuario para entrar: sin "@", así el login sabe si le escribieron un usuario o un correo
function usuario_valido($valor, int $max = 30): string
{
    $usuario = mb_strtolower(v_texto($valor, 'un nombre de usuario', $max, true));
    if (!preg_match('/^[a-z0-9._-]{3,' . $max . '}$/', $usuario)) {
        throw dato_invalido("El nombre de usuario debe tener de 3 a $max letras sin acentos, números, punto, guion o guion bajo.");
    }
    return $usuario;
}

// Mismo formato que public/js/validacion.js: sin espacios, un solo @, dominio con punto y terminación de 2 letras o más
const FORMATO_CORREO = '/^[a-z0-9.!#$%&\'*+\/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/';

// Proveedores que existen de verdad (nunca se toman como error de dedo) y los más usados, para sugerirlos
const PROVEEDORES = [
    'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.es', 'hotmail.com.mx', 'outlook.com', 'outlook.es',
    'live.com', 'live.com.mx', 'msn.com', 'yahoo.com', 'yahoo.com.mx', 'yahoo.es', 'icloud.com', 'me.com', 'mac.com',
    'proton.me', 'protonmail.com', 'aol.com', 'mail.com', 'gmx.com', 'zoho.com', 'yandex.com',
];
const POPULARES = ['gmail.com', 'hotmail.com', 'outlook.com', 'live.com', 'yahoo.com', 'icloud.com', 'yahoo.com.mx', 'outlook.es', 'hotmail.es'];

// Distancia de edición con transposición (gmial ↔ gmail cuenta como 1)
function distancia(string $a, string $b): int
{
    $la = strlen($a);
    $lb = strlen($b);
    $d = [];
    for ($i = 0; $i <= $la; $i++) $d[$i] = array_fill(0, $lb + 1, 0);
    for ($i = 0; $i <= $la; $i++) $d[$i][0] = $i;
    for ($j = 1; $j <= $lb; $j++) $d[0][$j] = $j;
    for ($i = 1; $i <= $la; $i++) {
        for ($j = 1; $j <= $lb; $j++) {
            $costo = $a[$i - 1] === $b[$j - 1] ? 0 : 1;
            $d[$i][$j] = min($d[$i - 1][$j] + 1, $d[$i][$j - 1] + 1, $d[$i - 1][$j - 1] + $costo);
            if ($i > 1 && $j > 1 && $a[$i - 1] === $b[$j - 2] && $a[$i - 2] === $b[$j - 1]) $d[$i][$j] = min($d[$i][$j], $d[$i - 2][$j - 2] + 1);
        }
    }
    return $d[$la][$lb];
}

// "gmial.com" → "gmail.com"; null si el dominio no parece un error de dedo
function sugerencia_dominio(string $dominio): ?string
{
    if (in_array($dominio, PROVEEDORES, true)) return null;
    foreach (POPULARES as $p) if (distancia($dominio, $p) === 1) return $p;
    foreach (POPULARES as $p) if (distancia($dominio, $p) === 2 && strlen(explode('.', $dominio)[0]) >= 5) return $p;
    return null;
}

// ¿El dominio recibe correos? (registro MX). Caché de 1 hora; si el DNS no contesta, se da por bueno.
// En desarrollo, correo_dns_prueba no consulta internet: solo los dominios que terminan en .invalid o
// empiezan con "sin-correo." se toman como dominios sin correo.
function recibe_correo(string $dominio): bool
{
    if (!config('produccion') && config('correo_dns_prueba')) {
        return !str_ends_with($dominio, '.invalid') && !str_starts_with($dominio, 'sin-correo.');
    }
    $guardado = valor('SELECT ok FROM dns_correo WHERE dominio = ? AND hasta > UTC_TIMESTAMP()', [$dominio]);
    if ($guardado !== null) return a_bool($guardado);
    $mx = @dns_get_record($dominio, DNS_MX);
    if ($mx === false) return true; // tiempo agotado o DNS caído: no se bloquea el registro
    if ($mx) {
        // "MX 0 ." = el dominio dice que no recibe correo
        $ok = (bool) array_filter($mx, fn($r) => ($r['target'] ?? '') !== '' && ($r['target'] ?? '') !== '.');
    } else {
        // Sin MX (o el dominio no existe), el correo se entrega al A/AAAA del dominio (RFC 5321, 5.1)
        $direcciones = @dns_get_record($dominio, DNS_A + DNS_AAAA);
        if ($direcciones === false) return true;
        $ok = (bool) $direcciones;
    }
    q('INSERT INTO dns_correo (dominio, ok, hasta) VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL 1 HOUR)
       ON DUPLICATE KEY UPDATE ok = VALUES(ok), hasta = VALUES(hasta)', [$dominio, $ok]);
    return $ok;
}

// Correo con formato correcto y de un dominio que sí recibe correos. Si el dominio no recibe correos
// y parece un error de dedo, el ErrorDeDatos trae la sugerencia ("ana@gmail.com"). Un dominio parecido
// a uno popular que sí recibe correos (ymail.com, email.com, hotmail.fr) se acepta: solo se sugiere.
function correo_real($valor, string $campo = 'tu correo'): string
{
    return revisar_correo($valor, $campo)['correo'];
}

function revisar_correo($valor, string $campo = 'tu correo'): array
{
    $correo = mb_strtolower(v_texto($valor, $campo, 120, true));
    if (!preg_match(FORMATO_CORREO, $correo) || str_contains($correo, '..') || strlen(explode('@', $correo)[0]) > 64) {
        throw dato_invalido('Escribe un correo válido, ej. nombre@gmail.com.');
    }
    [$nombre, $dominio] = explode('@', $correo);
    $sugerido = sugerencia_dominio($dominio);
    $sugerencia = $sugerido ? "$nombre@$sugerido" : null;
    if (!recibe_correo($dominio)) {
        throw dato_invalido($sugerencia
            ? "Ese dominio no recibe correos. ¿Quisiste decir $sugerencia?"
            : 'Ese dominio no recibe correos. Revisa que esté bien escrito.', $sugerencia);
    }
    return ['correo' => $correo, 'sugerencia' => $sugerencia];
}

function paises(): array
{
    static $paises = null;
    if ($paises === null) $paises = json_decode(file_get_contents(RAIZ . '/public/datos/paises.json'), true);
    return $paises;
}

// Teléfono con lada del país, guardado en formato internacional E.164 ("+525512345678")
function v_telefono($pais, $numero): array
{
    $datos = null;
    foreach (paises() as $p) if (is_string($pais) && $p['iso'] === strtoupper($pais)) $datos = $p;
    if (!$datos) throw dato_invalido('Elige el país de tu teléfono.');
    $digitos = is_string($numero) || is_int($numero) || is_float($numero) ? preg_replace('/\D/', '', (string) $numero) : '';
    if ($digitos === '') throw dato_invalido('Escribe tu número de teléfono.');
    if (!in_array(strlen($digitos), $datos['largos'], true)) {
        $largos = implode(' o ', $datos['largos']);
        throw dato_invalido("El teléfono de {$datos['nombre']} debe tener $largos dígitos (sin la lada +{$datos['lada']}).");
    }
    return ['pais' => $datos['iso'], 'telefono' => "+{$datos['lada']}$digitos"];
}
