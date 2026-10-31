<?php
/**
 * Sesiones en la tabla `sesiones`, con el mismo comportamiento que express-session tenía en Node:
 * - Cookie __Host-necutla.sid en producción con HTTPS (necutla.sid en local o sin HTTPS), HttpOnly, SameSite=Strict, Secure.
 * - Se renueva con cada uso. Con cuenta de cliente dura 400 días (el máximo que acepta Chrome) y en la práctica no vence:
 *   solo se cierra al tocar "Cerrar sesión" o al cambiar la contraseña. Sin cliente, 8 horas sin usarla la cierran.
 * - Necutools (adminId) sigue cerrándose a las 8 horas sin uso o a las 24 horas, aunque el cliente siga dentro (vida_maxima).
 * - No se guarda una sesión vacía (sin cuenta ni nada pendiente).
 * - regenerar() cambia el id al entrar y al salir (evita la fijación de sesión).
 * La cookie es un valor al azar de 256 bits; en la base solo se guarda su SHA-256.
 */

final class Sesion
{
    public const DURACION = 8 * 60 * 60;
    public const DURACION_CLIENTE = 400 * 24 * 60 * 60;

    private static array $datos = [];
    private static ?string $token = null;  // valor de la cookie
    private static bool $guardada = false; // ya existe en la base
    private static string $original = '';  // JSON tal como se leyó (para saber si cambió)
    private static bool $borrarCookie = false;

    public static function nombreCookie(): string
    {
        return con_https() ? '__Host-necutla.sid' : 'necutla.sid';
    }

    public static function cargar(): void
    {
        $token = leer_cookie(self::nombreCookie());
        if ($token === null || !preg_match('/^[A-Za-z0-9_-]{43}$/', $token)) return;
        $f = fila('SELECT datos FROM sesiones WHERE id = ? AND expira > UTC_TIMESTAMP(6)', [hash('sha256', $token)]);
        $datos = $f ? json_decode($f['datos'], true) : null;
        if (!is_array($datos)) return;
        self::$datos = $datos;
        self::$token = $token;
        self::$guardada = true;
        self::$original = $f['datos'];
    }

    public static function get(string $clave)
    {
        return self::$datos[$clave] ?? null;
    }

    public static function set(string $clave, $valor): void
    {
        self::$datos[$clave] = $valor;
    }

    public static function quitar(string $clave): void
    {
        unset(self::$datos[$clave]);
    }

    // Id de esta sesión en la base (para "cerrar las demás menos esta")
    public static function id(): ?string
    {
        return self::$token === null ? null : hash('sha256', self::$token);
    }

    // Sesión nueva (otro id) que conserva solo los datos indicados
    public static function regenerar(array $conservar = []): void
    {
        $datos = array_intersect_key(self::$datos, array_flip($conservar));
        if (self::$guardada) q('DELETE FROM sesiones WHERE id = ?', [self::id()]);
        self::$datos = $datos;
        self::$token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
        self::$guardada = false;
        self::$original = '';
    }

    // Cierra la sesión del navegador y borra la cookie
    public static function destruir(): void
    {
        if (self::$guardada) q('DELETE FROM sesiones WHERE id = ?', [self::id()]);
        self::$datos = [];
        self::$token = null;
        self::$guardada = false;
        self::$borrarCookie = true;
    }

    // Al terminar la petición: guarda los cambios (o solo renueva la expiración) y manda la cookie
    public static function duracion(): int
    {
        return empty(self::$datos['clienteId']) ? self::DURACION : self::DURACION_CLIENTE;
    }

    public static function guardar(Respuesta $r): void
    {
        $vence = time() + self::duracion();
        $expira = gmdate('Y-m-d H:i:s', $vence);
        if (self::$token !== null && self::$guardada) {
            $json = self::json();
            if ($json !== self::$original) {
                // UPDATE (no INSERT): si otra petición cerró esta sesión mientras tanto, no revive
                q('UPDATE sesiones SET datos = ?, expira = ?, admin_id = ?, pendiente_admin_id = ?, cliente_id = ? WHERE id = ?',
                  [$json, $expira, ...self::columnas(), self::id()]);
            } else {
                q('UPDATE sesiones SET expira = ? WHERE id = ?', [$expira, self::id()]);
            }
            $r->cabeceras['Set-Cookie'][] = self::cookie(self::$token, $vence);
        } elseif (self::$token !== null && self::$datos) {
            q('INSERT INTO sesiones (id, datos, expira, admin_id, pendiente_admin_id, cliente_id) VALUES (?, ?, ?, ?, ?, ?)',
              [self::id(), self::json(), $expira, ...self::columnas()]);
            $r->cabeceras['Set-Cookie'][] = self::cookie(self::$token, $vence);
        } elseif (self::$borrarCookie) {
            $r->cabeceras['Set-Cookie'][] = self::cookie('', 0);
        }
    }

    private static function json(): string
    {
        return json_encode(self::$datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    private static function columnas(): array
    {
        $pendiente = self::$datos['pendiente']['adminId'] ?? null;
        return [self::$datos['adminId'] ?? null, $pendiente, self::$datos['clienteId'] ?? null];
    }

    private static function cookie(string $valor, int $expira): string
    {
        $partes = [self::nombreCookie() . '=' . $valor, 'Path=/', 'Expires=' . gmdate('D, d M Y H:i:s \G\M\T', $expira), 'HttpOnly'];
        if (con_https()) $partes[] = 'Secure';
        $partes[] = 'SameSite=Strict';
        return implode('; ', $partes);
    }
}

// PHP cambia los puntos de los nombres de cookie por "_" en $_COOKIE: se lee la cabecera tal cual
function leer_cookie(string $nombre): ?string
{
    foreach (explode(';', $_SERVER['HTTP_COOKIE'] ?? '') as $par) {
        $par = trim($par);
        $i = strpos($par, '=');
        if ($i !== false && substr($par, 0, $i) === $nombre) return rawurldecode(substr($par, $i + 1));
    }
    return null;
}

function ahora_ms(): int
{
    return (int) floor(microtime(true) * 1000);
}

// Necutools se cierra a las 24 horas de entrar o a las 8 horas sin uso, aunque se siga usando el sitio.
// La sesión de cliente no tiene límite: sigue dentro hasta que la persona cierre sesión.
const VIDA_MAXIMA_MS = 24 * 60 * 60 * 1000;
const ADMIN_SIN_USO_MS = Sesion::DURACION * 1000;

function vida_maxima(): void
{
    if (!Sesion::get('adminId')) return;
    $ahora = ahora_ms();
    $creada = Sesion::get('creada') ?? $ahora;
    $uso = Sesion::get('adminUso') ?? $ahora;
    if ($ahora - $creada > VIDA_MAXIMA_MS || $ahora - $uso > ADMIN_SIN_USO_MS) {
        // Sale solo de Necutools (con otro id de sesión); si hay un cliente en este navegador, sigue dentro
        Sesion::regenerar(['clienteId', 'clienteVersion']);
        return;
    }
    if (!Sesion::get('creada')) Sesion::set('creada', $ahora);
    // Se anota a lo más una vez por minuto, para no reescribir la sesión en cada petición
    if (!Sesion::get('adminUso') || $ahora - $uso > 60 * 1000) Sesion::set('adminUso', $ahora);
}
