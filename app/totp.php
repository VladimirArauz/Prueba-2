<?php
/**
 * Verificación en dos pasos (TOTP, RFC 6238): la usan Google Authenticator, Microsoft Authenticator
 * y similares. SHA-1, 6 dígitos, cada 30 segundos.
 */

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_PERIODO = 30;

function a_base32(string $bytes): string
{
    $bits = '';
    foreach (str_split($bytes) as $c) $bits .= str_pad(decbin(ord($c)), 8, '0', STR_PAD_LEFT);
    $salida = '';
    for ($i = 0; $i < strlen($bits); $i += 5) $salida .= BASE32[bindec(str_pad(substr($bits, $i, 5), 5, '0'))];
    return $salida;
}

function de_base32(string $texto): string
{
    $bits = '';
    foreach (str_split(strtoupper(rtrim($texto, '='))) as $letra) {
        $valor = strpos(BASE32, $letra);
        if ($valor === false) throw new RuntimeException('Clave base32 inválida');
        $bits .= str_pad(decbin($valor), 5, '0', STR_PAD_LEFT);
    }
    $bytes = '';
    for ($i = 0; $i + 8 <= strlen($bits); $i += 8) $bytes .= chr(bindec(substr($bits, $i, 8)));
    return $bytes;
}

function totp_generar_secreto(): string
{
    return a_base32(random_bytes(20));
}

function totp_paso_actual(): int
{
    return intdiv(time(), TOTP_PERIODO);
}

function totp_codigo(string $secreto, int $paso): string
{
    $hmac = hash_hmac('sha1', pack('J', $paso), de_base32($secreto), true);
    $corte = ord($hmac[19]) & 0x0f;
    $numero = (unpack('N', substr($hmac, $corte, 4))[1] & 0x7fffffff) % 1000000;
    return str_pad((string) $numero, 6, '0', STR_PAD_LEFT);
}

// Devuelve el paso aceptado (para no aceptar el mismo código dos veces) o null.
// Acepta el código anterior y el siguiente por si el reloj del celular va un poco desfasado.
function totp_verificar(?string $secreto, $codigo, $ultimoPaso = null): ?int
{
    if (!$secreto || !is_string($codigo) || !preg_match('/^[0-9]{6}$/', $codigo)) return null;
    $ahora = totp_paso_actual();
    foreach ([$ahora - 1, $ahora, $ahora + 1] as $paso) {
        if ($ultimoPaso !== null && $paso <= (int) $ultimoPaso) continue;
        if (hash_equals(totp_codigo($secreto, $paso), $codigo)) return $paso;
    }
    return null;
}

function totp_enlace(string $usuario, string $secreto): string
{
    return 'otpauth://totp/Necutla:' . rawurlencode($usuario) . "?secret=$secreto&issuer=Necutla&algorithm=SHA1&digits=6&period=" . TOTP_PERIODO;
}

// Códigos de respaldo de un solo uso: "abcde-fghij". Se guarda solo su hash.
function totp_generar_respaldo(int $cantidad = 8): array
{
    $codigos = [];
    for ($i = 0; $i < $cantidad; $i++) {
        $t = substr(strtolower(a_base32(random_bytes(7))), 0, 10);
        $codigos[] = substr($t, 0, 5) . '-' . substr($t, 5);
    }
    return $codigos;
}

function totp_hash_respaldo($codigo): string
{
    return hash('sha256', preg_replace('/\s/u', '', mb_strtolower(js_trim((string) $codigo))));
}
