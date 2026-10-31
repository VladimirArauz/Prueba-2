<?php
/**
 * Códigos de verificación por correo de las cuentas de cliente: entrar, crear la cuenta y restablecer la contraseña.
 * - 6 dígitos al azar, guardados como HMAC con el secreto de app/config.php.
 * - Vencen a los 10 minutos, sirven una vez y aguantan 5 intentos.
 * - Solo valen en el navegador que los pidió: la sesión guarda el id del código (clave `codigo`).
 * - Reenviar: 60 segundos entre envíos y 5 envíos por hora por correo y propósito; además, límite por IP.
 * Plan: plans/planes/2026-10-30-codigo-por-correo-y-sesion-permanente.md
 */

const CODIGO_VIDA = 10 * 60;
const CODIGO_INTENTOS = 5;
const CODIGO_ESPERA = 60;
const CODIGO_ENVIOS_HORA = 5;

// Liga el paso del código a esta sesión. Un visitante sin sesión todavía no tiene id: se le crea uno.
function guardar_paso(array $paso): void
{
    if (Sesion::id() === null) Sesion::regenerar();
    Sesion::set('codigo', $paso);
}

function hash_codigo(string $correo, string $proposito, string $codigo): string
{
    return hash_hmac('sha256', "$proposito|$correo|$codigo", (string) config('secreto'));
}

// "ana.garcia@gmail.com" → "a***@gmail.com"
function correo_enmascarado(string $correo): string
{
    [$local, $dominio] = array_pad(explode('@', $correo, 2), 2, '');
    return mb_substr($local, 0, 1) . '***@' . $dominio;
}

// Lo que el navegador necesita para mostrar el paso del código
function respuesta_codigo(string $proposito, ?string $correo, int $espera = CODIGO_ESPERA): array
{
    return ['autenticado' => false, 'codigo' => true, 'proposito' => $proposito,
            'correo' => $correo === null ? null : correo_enmascarado($correo), 'espera' => $espera];
}

function mandar_codigo(string $proposito, string $correo, string $codigo, string $nombre): void
{
    [$asunto, $texto, $html] = correo_codigo($proposito, $codigo, $nombre);
    try {
        enviar_correo($correo, $asunto, $texto, $html);
    } catch (ErrorCorreo $e) {
        throw new ErrorHttp(503, 'No pudimos mandar el correo con tu código. Intenta otra vez en unos minutos.');
    }
}

/**
 * Crea (o renueva) el código de un correo y propósito, lo manda y lo liga a esta sesión.
 * Si ya se mandó uno hace menos de 60 segundos, no se manda otro: se liga ese mismo (ya va en camino).
 */
function crear_codigo(string $proposito, string $correo, ?int $clienteId, ?array $datos, string $nombre, bool $despues = false): array
{
    limitar('codigo-envio', 20, UNA_HORA, 'Pediste muchos códigos desde esta conexión. Espera una hora y vuelve a intentar.');
    $previo = fila('SELECT id, enviados, TIMESTAMPDIFF(SECOND, enviado_en, UTC_TIMESTAMP(6)) AS hace,
                           creado_en > UTC_TIMESTAMP(6) - INTERVAL 1 HOUR AS reciente, usado_en IS NULL AND expira > UTC_TIMESTAMP(6) AS vivo
                    FROM codigos_correo WHERE correo = ? AND proposito = ?', [$correo, $proposito]);
    $json = $datos === null ? null : json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    if ($previo && a_bool($previo['vivo']) && (int) $previo['hace'] < CODIGO_ESPERA) {
        q('UPDATE codigos_correo SET cliente_id = ?, datos = ? WHERE id = ?', [$clienteId, $json, $previo['id']]);
        guardar_paso(['id' => (int) $previo['id'], 'proposito' => $proposito, 'correo' => $correo]);
        return respuesta_codigo($proposito, $correo, CODIGO_ESPERA - (int) $previo['hace']);
    }
    if ($previo && a_bool($previo['reciente']) && (int) $previo['enviados'] >= CODIGO_ENVIOS_HORA) {
        throw new ErrorHttp(429, 'Ya te mandamos 5 códigos en la última hora. Espera un rato y vuelve a intentar.');
    }

    $codigo = sprintf('%06d', random_int(0, 999999));
    $hash = hash_codigo($correo, $proposito, $codigo);
    if ($previo && a_bool($previo['reciente'])) {
        q('UPDATE codigos_correo SET cliente_id = ?, codigo_hash = ?, datos = ?, intentos = 0, enviados = enviados + 1,
                  enviado_en = UTC_TIMESTAMP(6), expira = UTC_TIMESTAMP(6) + INTERVAL ? SECOND, usado_en = NULL WHERE id = ?',
          [$clienteId, $hash, $json, CODIGO_VIDA, $previo['id']]);
        $id = (int) $previo['id'];
    } else {
        // Cada hora la cuenta de envíos empieza de cero; de paso se borran los códigos viejos de todos
        q('DELETE FROM codigos_correo WHERE (correo = ? AND proposito = ?) OR creado_en < UTC_TIMESTAMP(6) - INTERVAL 1 DAY', [$correo, $proposito]);
        q('INSERT INTO codigos_correo (proposito, correo, cliente_id, codigo_hash, datos, expira)
           VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(6) + INTERVAL ? SECOND)', [$proposito, $correo, $clienteId, $hash, $json, CODIGO_VIDA]);
        $id = ultimo_id();
    }
    guardar_paso(['id' => $id, 'proposito' => $proposito, 'correo' => $correo]);
    if ($despues) {
        // Restablecer: el correo sale después de responder, así el tiempo de respuesta no dice si la cuenta existe
        register_shutdown_function(function () use ($proposito, $correo, $codigo, $nombre) {
            if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
            try {
                mandar_codigo($proposito, $correo, $codigo, $nombre);
            } catch (Throwable $e) {
                error_log('Necutla: no se mandó el código de restablecer');
            }
        });
        return respuesta_codigo($proposito, $correo);
    }
    try {
        mandar_codigo($proposito, $correo, $codigo, $nombre);
    } catch (ErrorHttp $e) {
        // Sin correo no hay código: se anula para que no cuente como enviado
        q('UPDATE codigos_correo SET expira = UTC_TIMESTAMP(6), enviados = GREATEST(enviados - 1, 0) WHERE id = ?', [$id]);
        Sesion::quitar('codigo');
        throw $e;
    }
    return respuesta_codigo($proposito, $correo);
}

// Restablecer con una cuenta que no existe: la sesión queda igual que con una que sí (id 0, ningún código sirve)
function codigo_falso(string $proposito, ?string $correo): void
{
    guardar_paso(['id' => 0, 'proposito' => $proposito, 'correo' => $correo, 'visible' => $correo !== null]);
}

/**
 * Revisa el código que escribió la persona. Devuelve la fila del código (cliente_id y datos) si es correcto.
 * 401: código equivocado (quedan intentos). 410: no hay código, venció, ya se usó o se acabaron los intentos.
 */
function verificar_codigo(string $proposito, $codigo): array
{
    limitar('codigo-ip', 30, MIN_15, 'Demasiados intentos desde esta conexión. Espera 15 minutos y vuelve a intentar.');
    $p = Sesion::get('codigo');
    if (!$p || ($p['proposito'] ?? '') !== $proposito) throw new ErrorHttp(410, 'Pide un código nuevo para seguir.');
    $codigo = is_string($codigo) ? preg_replace('/\s+/', '', $codigo) : '';
    if (!preg_match('/^\d{6}$/', $codigo)) throw dato_invalido('Escribe los 6 dígitos del código.');

    $f = $p['id'] ? fila('SELECT id, correo, cliente_id, codigo_hash, datos, intentos, usado_en IS NULL AND expira > UTC_TIMESTAMP(6) AS vivo
                          FROM codigos_correo WHERE id = ? AND proposito = ?', [$p['id'], $proposito]) : null;
    // Vencido o sin intentos: la sesión conserva el paso para que "Reenviar código" mande uno nuevo
    if ($p['id'] && (!$f || !a_bool($f['vivo']))) throw new ErrorHttp(410, 'El código venció. Pide otro.');
    if ($f && (int) $f['intentos'] >= CODIGO_INTENTOS) throw new ErrorHttp(410, 'Ya intentaste 5 veces con este código. Pide otro.');
    if (!$f || !hash_equals($f['codigo_hash'], hash_codigo($f['correo'], $proposito, $codigo))) {
        if ($f) q('UPDATE codigos_correo SET intentos = intentos + 1 WHERE id = ?', [$f['id']]);
        throw new ErrorHttp(401, 'El código no es correcto. Revisa el último correo de Necutla.');
    }
    // Un solo uso, aunque lleguen dos peticiones a la vez
    if (ejecutar('UPDATE codigos_correo SET usado_en = UTC_TIMESTAMP(6) WHERE id = ? AND usado_en IS NULL', [$f['id']]) !== 1) {
        Sesion::quitar('codigo');
        throw new ErrorHttp(410, 'Ese código ya se usó. Pide otro.');
    }
    Sesion::quitar('codigo');
    $f['datos'] = $f['datos'] === null ? null : json_decode($f['datos'], true);
    return $f;
}

// Manda otro código para el paso que esté pendiente en esta sesión
function reenviar_codigo(): array
{
    $p = Sesion::get('codigo');
    if (!$p) throw new ErrorHttp(410, 'Vuelve a empezar para pedir un código nuevo.');
    if (!$p['id']) {
        limitar('codigo-envio', 20, UNA_HORA, 'Pediste muchos códigos desde esta conexión. Espera una hora y vuelve a intentar.');
        return respuesta_codigo($p['proposito'], $p['correo']);
    }
    $f = fila('SELECT correo, cliente_id, datos, proposito FROM codigos_correo WHERE id = ?', [$p['id']]);
    if (!$f) {
        Sesion::quitar('codigo');
        throw new ErrorHttp(410, 'Vuelve a empezar para pedir un código nuevo.');
    }
    $datos = $f['datos'] === null ? null : json_decode($f['datos'], true);
    $nombre = $datos['nombre'] ?? (string) valor('SELECT nombre FROM clientes WHERE id = ?', [(int) $f['cliente_id']]);
    $restablecer = $f['proposito'] === 'restablecer';
    $r = crear_codigo($f['proposito'], $f['correo'], $f['cliente_id'] === null ? null : (int) $f['cliente_id'], $datos, $nombre, $restablecer);
    // En restablecer solo se muestra el correo si la persona lo escribió (con su usuario no se revela)
    if ($restablecer) {
        Sesion::set('codigo', Sesion::get('codigo') + ['visible' => $p['visible'] ?? false]);
        if (!($p['visible'] ?? false)) $r['correo'] = null;
    }
    return $r;
}

// Paso pendiente de esta sesión, para retomarlo al recargar la página
function codigo_pendiente(): ?array
{
    $p = Sesion::get('codigo');
    if (!$p) return null;
    $correo = $p['proposito'] === 'restablecer' && !($p['visible'] ?? false) ? null : $p['correo'];
    return ['proposito' => $p['proposito'], 'correo' => $correo === null ? null : correo_enmascarado($correo)];
}
