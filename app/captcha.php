<?php
/**
 * Captcha de Cloudflare Turnstile (plan 2026-10-31-seguridad-turnstile-y-cloudflare-aparte).
 * El navegador resuelve el reto y manda el token en el campo `captcha`; aquí se revisa con Cloudflare
 * (siteverify). El token sirve una sola vez y vence a los 300 s.
 *
 * Configuración en app/config.php: 'turnstile' => ['site_key' => '…', 'secret' => '…']. Vacío = apagado.
 * Si Cloudflare no responde, se deja pasar (con aviso en el log): los límites por IP y por cuenta siguen.
 */

const SITEVERIFY_HOST = 'challenges.cloudflare.com';
const SITEVERIFY_RUTA = '/turnstile/v0/siteverify';
const CAPTCHA_ESPERA = 5; // segundos

function config_captcha(): array
{
    $c = config('turnstile');
    return is_array($c) ? $c : [];
}

function captcha_activo(): bool
{
    $c = config_captcha();
    return ($c['site_key'] ?? '') !== '' && ($c['secret'] ?? '') !== '';
}

// La llave pública para el navegador ("" si está apagado)
function captcha_site_key(): string
{
    return captcha_activo() ? (string) config_captcha()['site_key'] : '';
}

// POST a siteverify. Devuelve el JSON de Cloudflare o null si no respondió.
// Con curl si está (IONOS); si no, con un socket TLS verificado como app/correo.php (en local no hay curl y
// allow_url_fopen está apagado).
function siteverify(array $datos): ?array
{
    $cuerpo = http_build_query($datos);
    if (function_exists('curl_init')) {
        $ch = curl_init('https://' . SITEVERIFY_HOST . SITEVERIFY_RUTA);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $cuerpo,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => CAPTCHA_ESPERA,
            CURLOPT_CONNECTTIMEOUT => CAPTCHA_ESPERA,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        ]);
        $texto = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        if ($texto === false || $status !== 200) return null;
    } else {
        $contexto = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'peer_name' => SITEVERIFY_HOST]]);
        $s = @stream_socket_client('ssl://' . SITEVERIFY_HOST . ':443', $num, $error, CAPTCHA_ESPERA, STREAM_CLIENT_CONNECT, $contexto);
        if (!$s) return null;
        stream_set_timeout($s, CAPTCHA_ESPERA);
        fwrite($s, 'POST ' . SITEVERIFY_RUTA . " HTTP/1.1\r\nHost: " . SITEVERIFY_HOST . "\r\n"
            . "Content-Type: application/x-www-form-urlencoded\r\nContent-Length: " . strlen($cuerpo) . "\r\n"
            . "Connection: close\r\n\r\n" . $cuerpo);
        $crudo = stream_get_contents($s, 65536);
        fclose($s);
        if (!is_string($crudo) || !preg_match('#^HTTP/1\.[01] 200 #', $crudo)) return null;
        [$cabeceras, $texto] = array_pad(explode("\r\n\r\n", $crudo, 2), 2, '');
        if (preg_match('/^transfer-encoding:\s*chunked/im', $cabeceras)) $texto = quitar_chunked($texto);
    }
    $json = json_decode((string) $texto, true);
    return is_array($json) ? $json : null;
}

function quitar_chunked(string $texto): string
{
    $salida = '';
    while (preg_match('/^([0-9a-f]+)\r\n/i', $texto, $m)) {
        $largo = hexdec($m[1]);
        if ($largo === 0) break;
        $salida .= substr($texto, strlen($m[0]), $largo);
        $texto = substr($texto, strlen($m[0]) + $largo + 2);
    }
    return $salida;
}

// Llamar al inicio de cada ruta protegida. $accion es la misma que pone public/js/captcha.js en el widget.
function exigir_captcha(string $accion): void
{
    if (!captcha_activo()) return;
    $token = campo('captcha');
    $mensaje = 'Confirma que no eres un robot y vuelve a intentarlo.';
    if (!is_string($token) || $token === '' || strlen($token) > 2048) throw new ErrorHttp(400, $mensaje);

    $r = siteverify([
        'secret' => config_captcha()['secret'],
        'response' => $token,
        'remoteip' => ip_cliente(),
        'idempotency_key' => uuid_v4(),
    ]);
    if ($r === null) {
        error_log("Necutla: Turnstile no respondió ($accion); se dejó pasar");
        return;
    }
    if (empty($r['success'])) throw new ErrorHttp(400, $mensaje);

    // Las llaves de prueba de Cloudflare responden hostname "example.com" y sin action: solo se revisan en producción
    if (config('produccion')) {
        $host = parse_url((string) config('url_publica'), PHP_URL_HOST);
        if ($host && strcasecmp((string) ($r['hostname'] ?? ''), $host) !== 0) throw new ErrorHttp(400, $mensaje);
        if (($r['action'] ?? '') !== $accion) throw new ErrorHttp(400, $mensaje);
    }
}

function uuid_v4(): string
{
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}
