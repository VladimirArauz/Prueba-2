<?php
/**
 * Notificaciones de pedidos (plan 2026-11-22-icono-actualizador-y-notificaciones).
 *
 * - Navegadores: Web Push estándar, sin servicios de pago. Cifrado del RFC 8291 (aes128gcm, RFC 8188) y firma VAPID
 *   del RFC 8292, solo con openssl de PHP.
 * - App de Android: Firebase Cloud Messaging (API HTTP v1), con el token OAuth de una cuenta de servicio (JWT RS256).
 * - Se manda después de responder (fastcgi_finish_request), con 5 s de límite por envío: un fallo nunca rompe el pedido.
 * - Llaves y la ruta del JSON de la cuenta de servicio, solo en app/config.php ('web_push' y 'fcm').
 */

const PUSH_ESPERA = 5;
const PUSH_MAX_POR_CUENTA = 10;
const PUSH_TTL = 86400;
const FCM_ALCANCE = 'https://www.googleapis.com/auth/firebase.messaging';
// Solo se manda a los servicios de push de los navegadores (si no, cualquiera podría hacer que el servidor pida
// direcciones arbitrarias): Chrome/Edge/Brave (FCM), Firefox (Mozilla), Safari (Apple) y Edge viejo (Windows).
const PUSH_HOSTS = '#^(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)$#';
const OID_P256 = "\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07";

function b64u(string $s): string
{
    return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
}

function de_b64u(string $s): string|false
{
    if (!preg_match('/^[A-Za-z0-9_-]*$/', $s)) return false;
    return base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4), true);
}

// ================= Llaves P-256 a partir de los bytes crudos =================
function pem(string $der, string $tipo): string
{
    return "-----BEGIN $tipo-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END $tipo-----\n";
}

// SEC 1 / RFC 5915: d de 32 bytes y el punto público sin comprimir (65 bytes)
function llave_privada_p256(string $d, string $publica): OpenSSLAsymmetricKey
{
    $der = "\x30\x77\x02\x01\x01\x04\x20" . $d . "\xa0\x0a" . OID_P256 . "\xa1\x44\x03\x42\x00" . $publica;
    $k = openssl_pkey_get_private(pem($der, 'EC PRIVATE KEY'));
    if (!$k) throw new RuntimeException('Llave P-256 inválida.');
    return $k;
}

function llave_publica_p256(string $publica): OpenSSLAsymmetricKey
{
    $der = "\x30\x59\x30\x13\x06\x07\x2a\x86\x48\xce\x3d\x02\x01" . OID_P256 . "\x03\x42\x00" . $publica;
    $k = openssl_pkey_get_public(pem($der, 'PUBLIC KEY'));
    if (!$k) throw new RuntimeException('Llave pública P-256 inválida.');
    return $k;
}

/** Par nuevo: [d (32 bytes), pública sin comprimir (65 bytes)] */
function par_p256(): array
{
    $k = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
    $ec = openssl_pkey_get_details($k)['ec'];
    $pad = fn($v) => str_pad($v, 32, "\0", STR_PAD_LEFT);
    return [$pad($ec['d']), "\x04" . $pad($ec['x']) . $pad($ec['y'])];
}

// ================= Cifrado del mensaje (RFC 8291 sobre aes128gcm del RFC 8188) =================
/**
 * Devuelve el cuerpo cifrado. $asPrivada, $asPublica y $sal solo se pasan en las pruebas (ejemplo del RFC 8291);
 * si no, se generan nuevos en cada mensaje. $intermedios recibe CEK y NONCE para comprobarlos.
 */
function cifrar_push(string $texto, string $uaPublica, string $authSecreto, ?string $asPrivada = null, ?string $asPublica = null, ?string $sal = null, ?array &$intermedios = null): string
{
    if ($asPrivada === null) [$asPrivada, $asPublica] = par_p256();
    $sal ??= random_bytes(16);
    $ecdh = openssl_pkey_derive(llave_publica_p256($uaPublica), llave_privada_p256($asPrivada, $asPublica));
    if ($ecdh === false || strlen($ecdh) !== 32) throw new RuntimeException('No se pudo derivar el secreto ECDH.');
    $prkClave = hash_hmac('sha256', $ecdh, $authSecreto, true);
    $ikm = hash_hmac('sha256', "WebPush: info\0" . $uaPublica . $asPublica . "\x01", $prkClave, true);
    $prk = hash_hmac('sha256', $ikm, $sal, true);
    $cek = substr(hash_hmac('sha256', "Content-Encoding: aes128gcm\0\x01", $prk, true), 0, 16);
    $nonce = substr(hash_hmac('sha256', "Content-Encoding: nonce\0\x01", $prk, true), 0, 12);
    $intermedios = ['ecdh' => $ecdh, 'ikm' => $ikm, 'prk' => $prk, 'cek' => $cek, 'nonce' => $nonce];
    // Un solo registro: el delimitador 0x02 marca el último, sin relleno
    $cifrado = openssl_encrypt($texto . "\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $etiqueta, '', 16);
    if ($cifrado === false) throw new RuntimeException('No se pudo cifrar el aviso.');
    return $sal . pack('N', 4096) . chr(strlen($asPublica)) . $asPublica . $cifrado . $etiqueta;
}

// ================= Firmas (JWT) =================
// openssl_sign con EC devuelve DER; JWS ES256 pide r || s de 32 bytes cada uno
function der_a_rs(string $der): string
{
    $pos = 2;
    if (ord($der[1]) & 0x80) $pos += ord($der[1]) & 0x7f;
    $partes = [];
    for ($i = 0; $i < 2; $i++) {
        $largo = ord($der[$pos + 1]);
        $v = substr($der, $pos + 2, $largo);
        $partes[] = str_pad(ltrim($v, "\0"), 32, "\0", STR_PAD_LEFT);
        $pos += 2 + $largo;
    }
    return $partes[0] . $partes[1];
}

function jwt(array $reclamos, OpenSSLAsymmetricKey $llave, string $alg): string
{
    $base = b64u(json_encode(['typ' => 'JWT', 'alg' => $alg])) . '.' . b64u(json_encode($reclamos, JSON_UNESCAPED_SLASHES));
    if (!openssl_sign($base, $firma, $llave, OPENSSL_ALGO_SHA256)) throw new RuntimeException('No se pudo firmar.');
    return $base . '.' . b64u($alg === 'ES256' ? der_a_rs($firma) : $firma);
}

// ================= Configuración =================
/** ['publica' => 65 bytes, 'privada' => 32 bytes, 'contacto' => 'mailto:…'] o null si no está configurado */
function vapid(): ?array
{
    $c = config('web_push');
    if (!is_array($c)) return null;
    $pub = de_b64u((string) ($c['publica'] ?? ''));
    $priv = de_b64u((string) ($c['privada'] ?? ''));
    if ($pub === false || $priv === false || strlen($pub) !== 65 || strlen($priv) !== 32) return null;
    return ['publica' => $pub, 'privada' => $priv, 'contacto' => (string) ($c['contacto'] ?? 'mailto:yancore@necutla.com')];
}

/** ['proyecto', 'correo', 'llave', 'token_uri'] de la cuenta de servicio, o null */
function cuenta_fcm(): ?array
{
    static $cuenta = false;
    if ($cuenta !== false) return $cuenta;
    $c = config('fcm');
    $cuenta = null;
    if (!is_array($c) || empty($c['proyecto']) || empty($c['cuenta'])) return null;
    $ruta = str_starts_with($c['cuenta'], '/') ? $c['cuenta'] : __DIR__ . '/' . $c['cuenta'];
    $json = is_readable($ruta) ? json_decode((string) file_get_contents($ruta), true) : null;
    if (!is_array($json) || empty($json['client_email']) || empty($json['private_key'])) {
        error_log('Necutla: falta o no se puede leer el JSON de la cuenta de servicio de Firebase');
        return null;
    }
    return $cuenta = ['proyecto' => (string) $c['proyecto'], 'correo' => $json['client_email'], 'llave' => $json['private_key'],
        'token_uri' => $json['token_uri'] ?? 'https://oauth2.googleapis.com/token'];
}

// ================= HTTP saliente =================
/**
 * POST con curl (IONOS) o con un socket TLS verificado (en local no hay curl). Devuelve [status, cuerpo].
 * http:// solo se acepta hacia 127.0.0.1 fuera de producción (servidor de prueba).
 */
function post_saliente(string $url, array $cabeceras, string $cuerpo): array
{
    $p = parse_url($url);
    $prueba = ($p['scheme'] ?? '') === 'http' && ($p['host'] ?? '') === '127.0.0.1' && !config('produccion');
    if (($p['scheme'] ?? '') !== 'https' && !$prueba) throw new RuntimeException('Solo HTTPS.');
    $lineas = [];
    foreach ($cabeceras as $k => $v) $lineas[] = "$k: $v";
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true, CURLOPT_POSTFIELDS => $cuerpo, CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => PUSH_ESPERA, CURLOPT_CONNECTTIMEOUT => PUSH_ESPERA,
            CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_PROTOCOLS => $prueba ? CURLPROTO_HTTP : CURLPROTO_HTTPS, CURLOPT_HTTPHEADER => $lineas,
        ]);
        $texto = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        return [$texto === false ? 0 : $status, (string) $texto];
    }
    $host = $p['host'];
    $puerto = $p['port'] ?? ($prueba ? 80 : 443);
    $ruta = ($p['path'] ?? '/') . (isset($p['query']) ? '?' . $p['query'] : '');
    $contexto = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'peer_name' => $host]]);
    $s = @stream_socket_client(($prueba ? 'tcp://' : 'ssl://') . "$host:$puerto", $num, $error, PUSH_ESPERA, STREAM_CLIENT_CONNECT, $contexto);
    if (!$s) return [0, ''];
    stream_set_timeout($s, PUSH_ESPERA);
    fwrite($s, "POST $ruta HTTP/1.1\r\nHost: $host\r\n" . implode("\r\n", $lineas) . "\r\nContent-Length: " . strlen($cuerpo)
        . "\r\nConnection: close\r\n\r\n" . $cuerpo);
    $crudo = (string) stream_get_contents($s, 262144);
    fclose($s);
    if (!preg_match('#^HTTP/1\.[01] (\d{3})#', $crudo, $m)) return [0, ''];
    [$cab, $texto] = array_pad(explode("\r\n\r\n", $crudo, 2), 2, '');
    if (preg_match('/^transfer-encoding:\s*chunked/im', $cab)) $texto = quitar_chunked($texto);
    return [(int) $m[1], $texto];
}

// ================= Envío =================
/** Devuelve el status del servicio de push (201 = entregado; 404/410 = el navegador ya no existe). */
function enviar_web_push(array $destino, array $carga): int
{
    $v = vapid();
    if (!$v) return 0;
    $ua = de_b64u((string) $destino['p256dh']);
    $auth = de_b64u((string) $destino['auth']);
    if ($ua === false || $auth === false) return 410;
    $cuerpo = cifrar_push(json_encode($carga, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $ua, $auth);
    $p = parse_url($destino['endpoint']);
    $origen = $p['scheme'] . '://' . $p['host'] . (isset($p['port']) ? ':' . $p['port'] : '');
    $firma = jwt(['aud' => $origen, 'exp' => time() + 12 * 3600, 'sub' => $v['contacto']], llave_privada_p256($v['privada'], $v['publica']), 'ES256');
    [$status] = post_saliente($destino['endpoint'], [
        'Content-Type' => 'application/octet-stream', 'Content-Encoding' => 'aes128gcm', 'TTL' => (string) PUSH_TTL,
        'Urgency' => 'normal', 'Authorization' => 'vapid t=' . $firma . ', k=' . b64u($v['publica']),
    ], $cuerpo);
    return $status;
}

// Token OAuth de la cuenta de servicio, guardado hasta 5 minutos antes de que caduque (una hora)
function token_fcm(array $c): ?string
{
    $archivo = sys_get_temp_dir() . '/necutla-fcm-' . substr(hash('sha256', $c['correo'] . config('secreto')), 0, 16) . '.json';
    $guardado = is_readable($archivo) ? json_decode((string) file_get_contents($archivo), true) : null;
    if (is_array($guardado) && ($guardado['vence'] ?? 0) > time() + 300) return $guardado['token'];
    $llave = openssl_pkey_get_private($c['llave']);
    if (!$llave) { error_log('Necutla: la llave de la cuenta de servicio de Firebase no es válida'); return null; }
    $ahora = time();
    $afirmacion = jwt(['iss' => $c['correo'], 'scope' => FCM_ALCANCE, 'aud' => $c['token_uri'], 'iat' => $ahora, 'exp' => $ahora + 3600], $llave, 'RS256');
    [$status, $texto] = post_saliente($c['token_uri'], ['Content-Type' => 'application/x-www-form-urlencoded'],
        http_build_query(['grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer', 'assertion' => $afirmacion]));
    $json = json_decode($texto, true);
    if ($status !== 200 || empty($json['access_token'])) { error_log("Necutla: Firebase no dio token OAuth ($status)"); return null; }
    file_put_contents($archivo, json_encode(['token' => $json['access_token'], 'vence' => $ahora + (int) ($json['expires_in'] ?? 3600)]), LOCK_EX);
    @chmod($archivo, 0600);
    return $json['access_token'];
}

/** Status de FCM; 404 (UNREGISTERED) = la app ya no está o cambió de token. */
function enviar_fcm(array $destino, array $carga): int
{
    $c = cuenta_fcm();
    if (!$c) return 0;
    $token = token_fcm($c);
    if (!$token) return 0;
    // Mensaje solo de datos y prioridad alta: la app arma la notificación con su canal y su destino al tocarla
    $mensaje = ['message' => ['token' => $destino['endpoint'], 'android' => ['priority' => 'high', 'ttl' => PUSH_TTL . 's'],
        'data' => array_map('strval', $carga)]];
    [$status, $texto] = post_saliente("https://fcm.googleapis.com/v1/projects/{$c['proyecto']}/messages:send",
        ['Content-Type' => 'application/json', 'Authorization' => "Bearer $token"], json_encode($mensaje, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    if ($status === 400 && str_contains($texto, 'registration token')) return 404;
    return $status;
}

// ================= Cola: se manda después de responder =================
final class AvisosPendientes
{
    /** @var array<int, callable> */
    public static array $lista = [];
}

function encolar_aviso(callable $fn): void
{
    if (!AvisosPendientes::$lista) {
        register_shutdown_function(function () {
            // La respuesta ya se fue: quien cambió el pedido no espera a los servicios de push
            if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
            foreach (AvisosPendientes::$lista as $f) {
                try { $f(); } catch (Throwable $e) { error_log('Necutla: aviso sin mandar: ' . $e->getMessage()); }
            }
        });
    }
    AvisosPendientes::$lista[] = $fn;
}

/** Manda $carga a cada destino. Los que el servicio da por muertos (404 o 410) se borran. */
function mandar_a(array $destinos, array $carga): void
{
    foreach ($destinos as $d) {
        try {
            $status = $d['tipo'] === 'fcm' ? enviar_fcm($d, $carga) : enviar_web_push($d, $carga);
        } catch (Throwable $e) {
            error_log('Necutla: aviso sin mandar: ' . $e->getMessage());
            continue;
        }
        if ($status === 404 || $status === 410) q('DELETE FROM notificaciones_destinos WHERE id = ?', [$d['id']]);
        elseif ($status >= 200 && $status < 300) q('UPDATE notificaciones_destinos SET usado_en = UTC_TIMESTAMP(6) WHERE id = ?', [$d['id']]);
        elseif ($status !== 0) error_log("Necutla: el servicio de push respondió $status");
    }
}

function nombre_tienda_pedido(array $p): string
{
    return $p['tienda'] ?? ($p['promocion'] ? 'la promoción ' . $p['promocion'] : 'la tienda');
}

function pedido_para_aviso(int $id): ?array
{
    return fila('SELECT pe.id, pe.cliente_id, pe.stand_id, pe.estado, pe.nota, pe.total, pe.piezas, s.nombre AS tienda, pr.titulo AS promocion
                 FROM pedidos pe LEFT JOIN stands s ON s.id = pe.stand_id LEFT JOIN promociones pr ON pr.id = pe.promocion_id
                 WHERE pe.id = ?', [$id]);
}

/** Al cliente del pedido: 'estado', 'nota' o 'articulos'. Sin cuenta ligada, no hay a quién avisar. */
function avisar_cliente(int $pedidoId, string $tipo): void
{
    encolar_aviso(function () use ($pedidoId, $tipo) {
        $p = pedido_para_aviso($pedidoId);
        if (!$p || !$p['cliente_id']) return;
        $destinos = filas("SELECT id, tipo, endpoint, p256dh, auth FROM notificaciones_destinos WHERE para = 'cliente' AND cliente_id = ?", [$p['cliente_id']]);
        if (!$destinos) return;
        $tienda = nombre_tienda_pedido($p);
        $titulo = match ($tipo) {
            'estado' => "Tu pedido #{$p['id']} de $tienda " . match ($p['estado']) {
                'pagado' => 'ya está pagado', 'cancelado' => 'fue cancelado', default => 'volvió a estar en proceso',
            },
            'nota' => "$tienda te dejó una nota en tu pedido #{$p['id']}",
            default => "$tienda ajustó las piezas de tu pedido #{$p['id']}",
        };
        $cuerpo = match ($tipo) {
            'nota' => mb_strimwidth((string) $p['nota'], 0, 120, '…'),
            'estado' => $p['estado'] === 'cancelado' && $p['nota'] ? mb_strimwidth((string) $p['nota'], 0, 120, '…') : 'Toca para ver el pedido en Mis pedidos.',
            default => 'Toca para ver cómo quedó en Mis pedidos.',
        };
        mandar_a($destinos, ['titulo' => $titulo, 'cuerpo' => $cuerpo, 'url' => '/cuenta.html?sub=pedidos', 'destino' => 'mis-pedidos',
            'canal' => 'pedidos', 'etiqueta' => "pedido-{$p['id']}"]);
    });
}

/** A los dueños y a los encargados de la tienda del pedido (los paquetes de promociones, solo a los dueños). */
function avisar_tienda(int $pedidoId): void
{
    encolar_aviso(function () use ($pedidoId) {
        $p = pedido_para_aviso($pedidoId);
        if (!$p) return;
        $destinos = filas("SELECT d.id, d.tipo, d.endpoint, d.p256dh, d.auth FROM notificaciones_destinos d JOIN admins a ON a.id = d.admin_id
                           WHERE d.para = 'admin' AND a.activo AND (a.rol = 'dueno'
                             OR (? IS NOT NULL AND EXISTS (SELECT 1 FROM admin_stands x WHERE x.admin_id = a.id AND x.stand_id = ?)))",
            [$p['stand_id'], $p['stand_id']]);
        if (!$destinos) return;
        $piezas = (int) $p['piezas'];
        $titulo = "Pedido nuevo #{$p['id']} en " . nombre_tienda_pedido($p) . ": $piezas " . ($piezas === 1 ? 'pieza' : 'piezas') . ', $' . number_format((float) $p['total'], 2);
        mandar_a($destinos, ['titulo' => $titulo, 'cuerpo' => 'Toca para verlo en Necutools.', 'url' => '/necutools.html?seccion=pedidos',
            'destino' => 'necutools-pedidos', 'canal' => 'tienda', 'etiqueta' => "nuevo-{$p['id']}"]);
    });
}

// ================= Rutas =================
// Quien se suscribe: el cliente o el admin con sesión (los dos pueden estar en el mismo navegador)
function dueno_aviso(string $para): array
{
    if ($para === 'admin') return ['admin_id' => requiere_admin()['id'], 'cliente_id' => null];
    return ['cliente_id' => requiere_cliente('Inicia sesión con tu cuenta para recibir avisos de tus pedidos.')['id'], 'admin_id' => null];
}

/** Valida el destino que manda el navegador o la app. Devuelve [tipo, endpoint, p256dh, auth]. */
function leer_destino(): array
{
    $tipo = campo('tipo');
    if ($tipo === 'web') {
        $endpoint = campo('endpoint');
        $p = is_string($endpoint) && strlen($endpoint) <= 700 ? parse_url($endpoint) : false;
        if (!$p || ($p['scheme'] ?? '') !== 'https' || isset($p['user']) || isset($p['port']) || !preg_match(PUSH_HOSTS, strtolower($p['host'] ?? ''))) {
            throw dato_invalido('Tu navegador mandó una dirección de avisos que no reconocemos. Usa Chrome, Firefox, Edge o Safari.');
        }
        $p256dh = campo('p256dh');
        $auth = campo('auth');
        $ua = is_string($p256dh) ? de_b64u($p256dh) : false;
        $sec = is_string($auth) ? de_b64u($auth) : false;
        if ($ua === false || strlen($ua) !== 65 || $ua[0] !== "\x04" || $sec === false || strlen($sec) !== 16) {
            throw dato_invalido('Tu navegador mandó llaves de avisos que no son válidas. Vuelve a activar los avisos.');
        }
        return ['web', $endpoint, $p256dh, $auth];
    }
    if ($tipo === 'fcm') {
        $token = campo('token');
        if (!is_string($token) || !preg_match('/^[A-Za-z0-9_:\-]{20,500}$/', $token)) throw dato_invalido('La app mandó un token de avisos que no es válido.');
        return ['fcm', $token, null, null];
    }
    throw dato_invalido('Elige el tipo de aviso: web o fcm.');
}

function rutas_notificaciones(): void
{
    // Lo que el navegador necesita para suscribirse (la llave pública VAPID no es secreta)
    get('/api/notificaciones/llave', function () {
        $v = vapid();
        return ['llave' => $v ? b64u($v['publica']) : null];
    });

    post('/api/notificaciones/suscribir', function () {
        $para = v_opcion(campo('para') ?? 'cliente', ['cliente', 'admin'], 'para quién son los avisos');
        $dueno = dueno_aviso($para);
        [$tipo, $endpoint, $p256dh, $auth] = leer_destino();
        if ($tipo === 'web' && !vapid()) throw new ErrorHttp(503, 'Los avisos en el navegador todavía no están listos. Inténtalo más tarde.');
        q('INSERT INTO notificaciones_destinos (para, cliente_id, admin_id, tipo, endpoint, huella, p256dh, auth)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE cliente_id = VALUES(cliente_id), admin_id = VALUES(admin_id), tipo = VALUES(tipo), endpoint = VALUES(endpoint),
             p256dh = VALUES(p256dh), auth = VALUES(auth), usado_en = UTC_TIMESTAMP(6)',
          [$para, $dueno['cliente_id'], $dueno['admin_id'], $tipo, $endpoint, hash('sha256', $endpoint), $p256dh, $auth]);
        // Hasta 10 navegadores o celulares por cuenta: se van los que llevan más tiempo sin usarse
        $col = $para === 'admin' ? 'admin_id' : 'cliente_id';
        $id = $dueno[$col];
        $sobran = filas("SELECT id FROM notificaciones_destinos WHERE para = ? AND $col = ? ORDER BY usado_en DESC, id DESC LIMIT 1000 OFFSET " . PUSH_MAX_POR_CUENTA, [$para, $id]);
        if ($sobran) q('DELETE FROM notificaciones_destinos WHERE id IN (' . marcas(array_column($sobran, 'id')) . ')', array_column($sobran, 'id'));
        return ['ok' => true];
    });

    post('/api/notificaciones/quitar', function () {
        $para = v_opcion(campo('para') ?? 'cliente', ['cliente', 'admin'], 'para quién son los avisos');
        $dueno = dueno_aviso($para);
        $endpoint = campo(campo('tipo') === 'fcm' ? 'token' : 'endpoint');
        if (!is_string($endpoint) || $endpoint === '' || strlen($endpoint) > 700) throw dato_invalido('Falta el destino de los avisos.');
        $col = $para === 'admin' ? 'admin_id' : 'cliente_id';
        q("DELETE FROM notificaciones_destinos WHERE huella = ? AND para = ? AND $col = ?", [hash('sha256', $endpoint), $para, $dueno[$col]]);
        return ['ok' => true];
    });
}
