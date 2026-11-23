<?php
/**
 * Crea las llaves VAPID de las notificaciones del navegador (Web Push) y las guarda en app/config.php
 * ('web_push' => ['publica', 'privada', 'contacto']). Solo desde la terminal:
 *
 *   php8.5 scripts/crear-vapid.php            (si ya hay llaves, no las cambia)
 *   php8.5 scripts/crear-vapid.php --nuevas   (las reemplaza: los navegadores suscritos dejan de recibir avisos)
 *
 * No imprime la llave privada. Reescribe config.php con var_export (lo mismo que había, más 'web_push').
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require __DIR__ . '/../app/arranque.php';

$ruta = __DIR__ . '/../app/config.php';
$config = require $ruta;
if (!is_array($config)) {
    fwrite(STDERR, "app/config.php no devuelve un arreglo.\n");
    exit(1);
}
if (!empty($config['web_push']['publica']) && !in_array('--nuevas', $argv, true)) {
    echo "Ya hay llaves VAPID; no se cambiaron. Llave pública: {$config['web_push']['publica']}\n";
    exit(0);
}
[$privada, $publica] = par_p256();
$config['web_push'] = ['publica' => b64u($publica), 'privada' => b64u($privada), 'contacto' => 'mailto:yancore@necutla.com'];

$nuevo = "<?php\n// Configuración de Necutla (secretos: nunca a git; en IONOS con permisos 600)\nreturn " . var_export($config, true) . ";\n";
$tmp = $ruta . '.nuevo';
file_put_contents($tmp, $nuevo, LOCK_EX);
chmod($tmp, 0600);
// Revisión antes de reemplazar: que se lea igual, sin imprimir nada
ob_start();
$prueba = require $tmp;
$salida = ob_get_clean();
if ($salida !== '' || !is_array($prueba) || array_keys($prueba) !== array_keys($config)) {
    unlink($tmp);
    fwrite(STDERR, "El archivo nuevo no se leyó igual; no se cambió app/config.php.\n");
    exit(1);
}
rename($tmp, $ruta);
echo "Listo: llaves VAPID guardadas en app/config.php. Llave pública: " . b64u($publica) . "\n";
