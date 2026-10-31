<?php
/**
 * Envío de correo sin Composer: cliente SMTP propio (IONOS, smtp.ionos.mx:465 con SSL) y la plantilla del
 * código de verificación. En local, 'modo' => 'archivo' guarda cada correo en /tmp/necutla-correos/.
 * Configuración en app/config.php, clave 'correo' (ver app/config.ejemplo.php).
 * Plan: plans/planes/2026-10-30-codigo-por-correo-y-sesion-permanente.md
 */

const CARPETA_CORREOS_PRUEBA = '/tmp/necutla-correos';

// Colores de los tokens de public/style.css. Los clientes de correo no leen style.css: el HTML del correo
// lleva estilos en línea (excepción técnica del plan; este HTML no se sirve en el sitio).
const CORREO_COLOR = [
    'tinta' => '#17295C',  // --tinta
    'senal' => '#F5B800',  // --senal
    'gis' => '#EDF0F4',    // --gis
    'hoja' => '#FFFFFF',   // --hoja
    'linea' => '#C5CEDC',  // --linea
    'texto2' => '#4A5672', // --texto-2
];

final class ErrorCorreo extends RuntimeException {}

function config_correo(): array
{
    $c = config('correo');
    if (!is_array($c)) throw new ErrorCorreo('Falta la opción correo en app/config.php');
    return $c + ['modo' => 'smtp', 'puerto' => 465, 'nombre' => 'Necutla'];
}

// Nada de saltos de línea en encabezados (evita que se inyecten otros encabezados)
function sin_saltos(string $s): string
{
    return trim(preg_replace('/[\r\n\t\x00]+/', ' ', $s));
}

// Asunto o nombre con acentos: RFC 2047 en base64
function encabezado_utf8(string $s): string
{
    $s = sin_saltos($s);
    return preg_match('/[^\x20-\x7E]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s;
}

function armar_mensaje(array $c, string $para, string $asunto, string $texto, string $html): string
{
    $limite = 'necutla-' . bin2hex(random_bytes(12));
    $remitente = sin_saltos($c['remitente']);
    $dominio = substr(strrchr($remitente, '@'), 1) ?: 'necutla.com';
    $cabeceras = [
        'Date: ' . date(DATE_RFC2822),
        'From: ' . encabezado_utf8($c['nombre']) . " <$remitente>",
        'To: <' . sin_saltos($para) . '>',
        'Subject: ' . encabezado_utf8($asunto),
        'Message-ID: <' . bin2hex(random_bytes(16)) . "@$dominio>",
        'MIME-Version: 1.0',
        'Auto-Submitted: auto-generated',
        "Content-Type: multipart/alternative; boundary=\"$limite\"",
    ];
    $parte = fn(string $tipo, string $cuerpo) => "--$limite\r\nContent-Type: $tipo; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($cuerpo), 76, "\r\n");
    return implode("\r\n", $cabeceras) . "\r\n\r\n" . $parte('text/plain', $texto) . $parte('text/html', $html) . "--$limite--\r\n";
}

// Lee una respuesta SMTP (puede tener varias líneas "250-…") y revisa el código esperado
function smtp_leer($s, array $esperado): string
{
    $todo = '';
    while (($linea = fgets($s, 1024)) !== false) {
        $todo .= $linea;
        if (strlen($linea) < 4 || $linea[3] !== '-') break;
    }
    $codigo = (int) substr($todo, 0, 3);
    if (!in_array($codigo, $esperado, true)) throw new ErrorCorreo('SMTP respondió ' . sin_saltos(substr($todo, 0, 200)));
    return $todo;
}

function smtp_orden($s, string $orden, array $esperado): string
{
    fwrite($s, $orden . "\r\n");
    return smtp_leer($s, $esperado);
}

function enviar_smtp(array $c, string $para, string $mensaje): void
{
    $puerto = (int) $c['puerto'];
    $contexto = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'peer_name' => $c['host']]]);
    $destino = ($puerto === 465 ? 'ssl://' : 'tcp://') . $c['host'] . ':' . $puerto;
    $s = @stream_socket_client($destino, $num, $error, 15, STREAM_CLIENT_CONNECT, $contexto);
    if (!$s) throw new ErrorCorreo("No se pudo conectar a $destino: $error");
    stream_set_timeout($s, 20);
    try {
        smtp_leer($s, [220]);
        $yo = parse_url((string) config('url_publica'), PHP_URL_HOST) ?: 'necutla.com';
        smtp_orden($s, "EHLO $yo", [250]);
        if ($puerto !== 465) {
            smtp_orden($s, 'STARTTLS', [220]);
            if (!stream_socket_enable_crypto($s, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT)) {
                throw new ErrorCorreo('No se pudo cifrar la conexión (STARTTLS)');
            }
            smtp_orden($s, "EHLO $yo", [250]);
        }
        smtp_orden($s, 'AUTH LOGIN', [334]);
        smtp_orden($s, base64_encode($c['usuario']), [334]);
        smtp_orden($s, base64_encode($c['password']), [235]);
        smtp_orden($s, 'MAIL FROM:<' . sin_saltos($c['remitente']) . '>', [250]);
        smtp_orden($s, 'RCPT TO:<' . sin_saltos($para) . '>', [250, 251]);
        smtp_orden($s, 'DATA', [354]);
        // Un punto al inicio de una línea se duplica (RFC 5321, 4.5.2)
        fwrite($s, preg_replace('/^\./m', '..', $mensaje) . "\r\n.\r\n");
        smtp_leer($s, [250]);
        fwrite($s, "QUIT\r\n");
    } finally {
        fclose($s);
    }
}

// Manda un correo. Si falla, lo anota en el log (sin el contenido) y lanza ErrorCorreo.
function enviar_correo(string $para, string $asunto, string $texto, string $html): void
{
    $c = config_correo();
    if (!filter_var($para, FILTER_VALIDATE_EMAIL)) throw new ErrorCorreo('Destinatario inválido');
    $mensaje = armar_mensaje($c, $para, $asunto, $texto, $html);
    try {
        if ($c['modo'] === 'archivo' && !config('produccion')) {
            if (!is_dir(CARPETA_CORREOS_PRUEBA)) mkdir(CARPETA_CORREOS_PRUEBA, 0700, true);
            $nombre = CARPETA_CORREOS_PRUEBA . '/' . date('Ymd-His') . '-' . bin2hex(random_bytes(3)) . '.eml';
            file_put_contents($nombre, $mensaje);
            return;
        }
        enviar_smtp($c, $para, $mensaje);
    } catch (ErrorCorreo $e) {
        error_log('Necutla: no se mandó el correo: ' . $e->getMessage());
        throw $e;
    }
}

// Texto y HTML del correo con el código. $proposito: login, registro o restablecer.
function correo_codigo(string $proposito, string $codigo, string $nombre): array
{
    $para = [
        'login' => ['Tu código para entrar a Necutla', 'Usa este código para iniciar sesión en Necutla.'],
        'registro' => ['Tu código para crear tu cuenta en Necutla', 'Usa este código para terminar de crear tu cuenta en Necutla.'],
        'restablecer' => ['Tu código para cambiar tu contraseña de Necutla', 'Usa este código para poner una contraseña nueva en tu cuenta de Necutla.'],
    ][$proposito];
    [$asunto, $frase] = $para;
    $saludo = $nombre !== '' ? 'Hola, ' . rtrim($nombre, '.') . '.' : 'Hola.';
    $aviso = 'Si no fuiste tú, ignora este correo: nadie puede entrar sin el código. Nunca te lo pediremos por WhatsApp ni por teléfono.';
    $texto = "$saludo\n\n$frase\n\n$codigo\n\nVence en 10 minutos y solo sirve una vez.\n\n$aviso\n\nNecutla, la ciudad del estudiante\n";

    $e = fn($v) => htmlspecialchars($v, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $k = CORREO_COLOR;
    $fuente = "font-family:Archivo,Arial,Helvetica,sans-serif";
    $digitos = '';
    foreach (str_split($codigo) as $d) {
        $digitos .= "<td style=\"width:44px;height:56px;border:2px solid {$k['tinta']};border-radius:6px;background:{$k['hoja']};"
            . "color:{$k['tinta']};font-size:28px;font-weight:800;text-align:center;font-variant-numeric:tabular-nums;$fuente\">{$e($d)}</td>"
            . '<td style="width:8px"></td>';
    }
    $html = <<<HTML
<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{$e($asunto)}</title></head>
<body style="margin:0;padding:0;background:{$k['gis']}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{$k['gis']};padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:{$k['hoja']};border:1px solid {$k['linea']};border-radius:10px">
<tr><td style="background:{$k['tinta']};border-radius:10px 10px 0 0;padding:20px 28px;$fuente">
<span style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;background:{$k['senal']};color:{$k['tinta']};font-weight:800;border-radius:4px;font-size:20px">N</span>
<span style="color:{$k['hoja']};font-size:22px;font-weight:800;vertical-align:middle;padding-left:8px">Necutla</span>
</td></tr>
<tr><td style="padding:28px;color:{$k['tinta']};font-size:16px;line-height:1.6;$fuente">
<p style="margin:0 0 8px">{$e($saludo)}</p>
<p style="margin:0 0 20px">{$e($frase)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr>$digitos</tr></table>
<p style="margin:0 0 20px;color:{$k['texto2']}">Vence en 10 minutos y solo sirve una vez.</p>
<p style="margin:0;padding-top:16px;border-top:1px solid {$k['linea']};color:{$k['texto2']};font-size:14px">{$e($aviso)}</p>
</td></tr>
</table>
<p style="margin:16px 0 0;color:{$k['texto2']};font-size:13px;$fuente">Necutla, la ciudad del estudiante</p>
</td></tr></table>
</body></html>
HTML;
    return [$asunto, $texto, $html];
}
