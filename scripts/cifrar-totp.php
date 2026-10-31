<?php
/**
 * Cifra los secretos de verificación en dos pasos que quedaron en claro en la base (de antes del plan
 * 2026-10-31-seguridad-turnstile-y-cloudflare-aparte). Solo desde la terminal; se puede correr las veces que sea:
 *
 *   php8.5 scripts/cifrar-totp.php
 *
 * Antes hay que correr en la base el ALTER de db/mariadb/schema.sql (totp_secreto VARCHAR(160)).
 * No muestra ningún secreto: solo cuántos cifró.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require __DIR__ . '/../app/arranque.php';

$cifrados = 0;
foreach (filas('SELECT id, totp_secreto FROM admins WHERE totp_secreto IS NOT NULL') as $admin) {
    if (str_starts_with($admin['totp_secreto'], TOTP_PREFIJO)) continue;
    $cifrados += ejecutar('UPDATE admins SET totp_secreto = ? WHERE id = ? AND totp_secreto = ?',
        [totp_cifrar($admin['totp_secreto']), $admin['id'], $admin['totp_secreto']]);
}
echo "Secretos cifrados: $cifrados\n";
