<?php
/**
 * Crea un dueño de Necutools o le pone una contraseña nueva (si ya existe). Solo desde la terminal:
 *
 *   php scripts/crear-admin.php USUARIO
 *
 * Pide la contraseña dos veces sin mostrarla y usa la base de app/config.php. Reemplaza a
 * ADMIN_USERNAME / ADMIN_PASSWORD de la versión en Node. Si cambias la contraseña de alguien, se
 * cierran sus sesiones abiertas.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require __DIR__ . '/../app/arranque.php';

// Se revisa una sola vez, antes de leer nada (después PHP avisa que se perderían datos del búfer)
define('ES_TERMINAL', DIRECTORY_SEPARATOR === '/' && stream_isatty(STDIN));

function pedir_oculto(string $texto): string
{
    fwrite(STDOUT, $texto);
    $eco = ES_TERMINAL;
    if ($eco) shell_exec('stty -echo');
    $valor = rtrim((string) fgets(STDIN), "\r\n");
    if ($eco) shell_exec('stty echo');
    fwrite(STDOUT, PHP_EOL);
    return $valor;
}

$usuario = mb_strtolower(trim($argv[1] ?? ''));
if (!preg_match('/^[a-z0-9._-]{3,50}$/', $usuario)) {
    fwrite(STDERR, "Uso: php scripts/crear-admin.php USUARIO (3 a 50 letras sin acentos, números, punto, guion o guion bajo)\n");
    exit(1);
}

try {
    $password = pedir_oculto('Contraseña nueva: ');
    $confirmar = pedir_oculto('Repite la contraseña: ');
    contrasena_admin($password, $confirmar, $usuario);
    $existente = fila('SELECT id FROM admins WHERE usuario = ?', [$usuario]);
    if ($existente) {
        q('UPDATE admins SET password_hash = ?, activo = TRUE WHERE id = ?', [cifrar_contrasena($password), $existente['id']]);
        cerrar_sesiones_de($existente['id']);
        echo "Contraseña nueva para $usuario. Se cerraron sus sesiones abiertas.\n";
    } else {
        q("INSERT INTO admins (usuario, password_hash, rol) VALUES (?, ?, 'dueno')", [$usuario, cifrar_contrasena($password)]);
        echo "Dueño creado: $usuario\n";
    }
} catch (Throwable $e) {
    fwrite(STDERR, ($e instanceof ErrorDeDatos ? '' : 'Error: ') . $e->getMessage() . "\n");
    exit(1);
}
