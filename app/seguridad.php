<?php
/**
 * Mismo origen (CSRF) y límite de peticiones por IP.
 * En Node el límite lo llevaba express-rate-limit en memoria; aquí va en la tabla `limites`,
 * con la IP guardada como HMAC (nunca en claro).
 */

// IP del visitante. En IONOS compartido es REMOTE_ADDR. Solo si la configuración lo pide (local, para
// las pruebas) se toma la última dirección de X-Forwarded-For, como "trust proxy 1" en Express.
function ip_cliente(): string
{
    if (config('confiar_x_forwarded_for') && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $lista = array_filter(array_map('trim', explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])));
        if ($lista) return end($lista);
    }
    return $_SERVER['REMOTE_ADDR'] ?? '';
}

// Las peticiones que cambian datos deben venir de este mismo sitio. Además del Origin, los navegadores
// mandan Sec-Fetch-Site: solo se acepta "same-origin" (o "none", cuando la persona escribe la dirección).
function exigir_mismo_origen(): void
{
    if (in_array(Peticion::$metodo, ['GET', 'HEAD', 'OPTIONS'], true)) return;
    $sitio = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? '';
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $ok = ($sitio === '' || $sitio === 'same-origin' || $sitio === 'none') && $origin !== ''
        && host_de_origin($origin) === strtolower($_SERVER['HTTP_HOST'] ?? '');
    if (!$ok) throw new ErrorHttp(403, 'Petición no permitida.');
}

// "http://localhost:8081" → "localhost:8081"; "https://x.com:443" → "x.com" (como new URL().host)
function host_de_origin(string $origin): ?string
{
    $u = parse_url($origin);
    if (!$u || empty($u['scheme']) || empty($u['host'])) return null;
    $porDefecto = ['http' => 80, 'https' => 443][strtolower($u['scheme'])] ?? null;
    $host = strtolower($u['host']);
    return isset($u['port']) && $u['port'] !== $porDefecto ? "$host:{$u['port']}" : $host;
}

// ================= Límite de peticiones =================
function clave_ip(): string
{
    return hash_hmac('sha256', ip_cliente(), config('secreto'));
}

function limite_sumar(string $regla, int $ventana): int
{
    q("INSERT INTO limites (regla, clave, cuenta, reinicia) VALUES (?, ?, 1, UTC_TIMESTAMP() + INTERVAL ? SECOND)
       ON DUPLICATE KEY UPDATE cuenta = IF(reinicia <= UTC_TIMESTAMP(), 1, cuenta + 1),
         reinicia = IF(reinicia <= UTC_TIMESTAMP(), VALUES(reinicia), reinicia)",
      [$regla, clave_ip(), $ventana]);
    return (int) valor('SELECT cuenta FROM limites WHERE regla = ? AND clave = ?', [$regla, clave_ip()]);
}

function limite_cuenta(string $regla): int
{
    return (int) valor('SELECT cuenta FROM limites WHERE regla = ? AND clave = ? AND reinicia > UTC_TIMESTAMP()', [$regla, clave_ip()]);
}

// Cuenta cada petición: 429 al pasar de $max en la ventana
function limitar(string $regla, int $max, int $ventana, string $mensaje): void
{
    if (limite_sumar($regla, $ventana) > $max) throw new ErrorHttp(429, $mensaje);
}

// Solo cuentan las peticiones que $cuenta(status) acepte (ej. los logins fallidos): se suman al terminar
function limitar_si(string $regla, int $max, int $ventana, string $mensaje, callable $cuenta): void
{
    if (limite_cuenta($regla) >= $max) throw new ErrorHttp(429, $mensaje);
    Peticion::$alTerminar[] = function (int $status) use ($regla, $ventana, $cuenta) {
        if ($cuenta($status)) limite_sumar($regla, $ventana);
    };
}

const MIN_15 = 15 * 60;
const UNA_HORA = 60 * 60;

// Borra lo viejo de vez en cuando (en Node había un temporizador; aquí 1 de cada 100 peticiones)
function limpiar_viejos(): void
{
    q('DELETE FROM limites WHERE reinicia < UTC_TIMESTAMP()');
    q('DELETE FROM sesiones WHERE expira < UTC_TIMESTAMP(6)');
    q('DELETE FROM intentos_login WHERE actualizado_en < UTC_TIMESTAMP(6) - INTERVAL 1 DAY');
    q('DELETE FROM dns_correo WHERE hasta < UTC_TIMESTAMP()');
}
