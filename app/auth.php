<?php
/**
 * Sesiones y acceso de administración (Necutools): /api/auth.
 */

final class Actual
{
    public static ?array $admin = null;
    public static ?array $cliente = null;
}

// Carga al admin en cada petición: si lo desactivaron o cambiaron su rol, se nota de inmediato
function cargar_admin(): ?array
{
    $id = Sesion::get('adminId');
    if (!$id) return null;
    $a = fila('SELECT id, usuario, correo, rol, activo, totp_activo FROM admins WHERE id = ?', [$id]);
    if (!$a || !a_bool($a['activo'])) return null;
    $a['activo'] = true;
    $a['totp_activo'] = a_bool($a['totp_activo']);
    $a['tiendas'] = array_map('intval', array_column(filas('SELECT stand_id FROM admin_stands WHERE admin_id = ?', [$a['id']]), 'stand_id'));
    return $a;
}

function requiere_admin(): array
{
    $admin = cargar_admin();
    if ($admin) return Actual::$admin = $admin;
    if (Sesion::get('adminId')) Sesion::destruir();
    throw new ErrorHttp(401, 'Inicia sesión en Necutools para hacer esto.');
}

// Solo dueños (va después de requiere_admin)
function requiere_dueno(): void
{
    if ((Actual::$admin['rol'] ?? null) !== 'dueno') throw new ErrorHttp(403, 'Solo un dueño puede hacer esto.');
}

// Dueños: todas las tiendas. Encargados: solo las que tienen asignadas.
function puede_editar_stand($standId): bool
{
    $admin = Actual::$admin;
    if (!$admin) return false;
    return $admin['rol'] === 'dueno' || in_array((int) $standId, $admin['tiendas'], true);
}

// Cierra las sesiones abiertas de un admin, también los logins a medias (al desactivarlo o cambiar su contraseña)
function cerrar_sesiones_de(int $adminId, ?string $exceptoId = null): void
{
    q('DELETE FROM sesiones WHERE (admin_id = ? OR pendiente_admin_id = ?) AND (? IS NULL OR id <> ?)',
      [$adminId, $adminId, $exceptoId, $exceptoId]);
}

function limitar_login(): void
{
    limitar_si('login-admin', 10, MIN_15, 'Demasiados intentos. Espera 15 minutos y vuelve a intentar.', fn($s) => $s >= 400);
}

// Entra a Necutools: sesión nueva (evita fijación de sesión). Si había un cliente en este navegador, se conserva.
function entrar(array $admin): array
{
    anotar($admin, 'entrar', 'sesiones', null, 'Inició sesión en Necutools');
    Sesion::regenerar(['clienteId', 'clienteVersion']);
    Sesion::set('adminId', $admin['id']);
    Sesion::set('usuario', $admin['usuario']);
    Sesion::set('creada', ahora_ms());
    return ['autenticado' => true, 'usuario' => $admin['usuario'], 'rol' => $admin['rol']];
}

// Código de 2 pasos o de respaldo. Se marca como usado en la misma consulta (no sirve dos veces).
function usar_codigo(array $admin, $valor): bool
{
    $codigo = is_string($valor) ? preg_replace('/\s/u', '', $valor) : '';
    if ($codigo === '' || mb_strlen($codigo) > 20) return false;
    $paso = totp_verificar($admin['totp_secreto'], $codigo, $admin['totp_ultimo']);
    if ($paso !== null) {
        return ejecutar('UPDATE admins SET totp_ultimo = ? WHERE id = ? AND (totp_ultimo IS NULL OR totp_ultimo < ?)',
            [$paso, $admin['id'], $paso]) === 1;
    }
    // Quitar el hash de la lista JSON solo si está (si otra petición lo usó primero, no cambia nada)
    $hash = totp_hash_respaldo($codigo);
    return en_transaccion(function () use ($admin, $hash) {
        $actual = valor('SELECT totp_respaldo FROM admins WHERE id = ? FOR UPDATE', [$admin['id']]);
        $lista = a_lista($actual);
        if (!in_array($hash, $lista, true)) return false;
        $resto = array_values(array_filter($lista, fn($h) => $h !== $hash));
        q('UPDATE admins SET totp_respaldo = ? WHERE id = ?', [json_encode($resto), $admin['id']]);
        return true;
    });
}

const PENDIENTE_MS = 5 * 60 * 1000;

// Busca al admin por correo (con "@") o por usuario: primero el usuario exacto y, si no, sin importar
// mayúsculas cuando solo hay uno (si chocan dos, como "Axel" y "axel", hay que escribirlo exacto)
function buscar_admin(string $identificador): ?array
{
    $campos = 'SELECT id, usuario, password_hash, rol, activo, totp_activo FROM admins';
    if (str_contains($identificador, '@')) {
        // Los correos se guardan en minúsculas y la columna compara exacto (utf8mb4_nopad_bin)
        $a = fila("$campos WHERE correo = ?", [mb_strtolower($identificador)]);
        if ($a) return $a;
        // Un usuario viejo con "@" sigue entrando con su usuario exacto
    }
    $exacto = fila("$campos WHERE usuario = ?", [$identificador]); // usuario es utf8mb4_nopad_bin: exacto
    if ($exacto) return $exacto;
    $lista = filas("$campos WHERE LOWER(usuario) = LOWER(?) LIMIT 2", [$identificador]);
    return count($lista) === 1 ? $lista[0] : null;
}

function rutas_auth(): void
{
    get('/api/auth/sesion', function () {
        $admin = cargar_admin();
        if (!$admin) {
            $p = Sesion::get('pendiente');
            return ['autenticado' => false, 'usuario' => null, 'segundoPaso' => (bool) ($p && $p['hasta'] > ahora_ms())];
        }
        return ['autenticado' => true, 'usuario' => $admin['usuario'], 'rol' => $admin['rol'], 'tiendas' => $admin['tiendas']];
    });

    // Un solo campo "Usuario o correo". `usuario` se sigue aceptando.
    post('/api/auth/login', function () {
        limitar_login();
        $crudo = existe('identificador') ? campo('identificador') : campo('usuario');
        $identificador = is_string($crudo) ? js_trim($crudo) : '';
        $password = is_string(campo('password')) ? campo('password') : '';
        if ($identificador === '' || $password === '' || mb_strlen($identificador) > 120 || mb_strlen($password) > 200) {
            return json_respuesta(['error' => 'Escribe tu usuario o correo y tu contraseña.'], 400);
        }
        $admin = buscar_admin($identificador);
        // El freno por cuenta usa el id: así no se esquiva alternando el usuario y el correo
        $freno = $admin ? "id:{$admin['id']}" : $identificador;
        exigir_no_frenada('admin', $freno);
        $valido = password_verify($password, $admin ? $admin['password_hash'] : HASH_FALSO);
        if (!$admin || !$valido) {
            registrar_fallo('admin', $freno);
            return json_respuesta(['error' => 'Usuario, correo o contraseña incorrectos.'], 401);
        }
        limpiar_fallos('admin', $freno);
        if (!a_bool($admin['activo'])) {
            return json_respuesta(['error' => 'Tu cuenta está desactivada. Pídele a un dueño de Necutla que la active.'], 403);
        }
        if (!a_bool($admin['totp_activo'])) return entrar($admin);
        // Con verificación en dos pasos: la sesión queda a medias (sin adminId) hasta mandar el código
        Sesion::regenerar(['clienteId', 'clienteVersion']);
        Sesion::set('pendiente', ['adminId' => $admin['id'], 'hasta' => ahora_ms() + PENDIENTE_MS]);
        return ['autenticado' => false, 'segundoPaso' => true];
    });

    post('/api/auth/login/codigo', function () {
        limitar_login();
        $pendiente = Sesion::get('pendiente');
        if (!$pendiente || $pendiente['hasta'] < ahora_ms()) {
            Sesion::quitar('pendiente');
            throw new ErrorHttp(401, 'Tu inicio de sesión venció. Escribe otra vez tu usuario y contraseña.');
        }
        exigir_no_frenada('totp', $pendiente['adminId']);
        $admin = fila('SELECT id, usuario, rol, activo, totp_secreto, totp_ultimo FROM admins WHERE id = ? AND totp_activo', [$pendiente['adminId']]);
        if (!$admin || !a_bool($admin['activo'])) {
            Sesion::quitar('pendiente');
            throw new ErrorHttp(401, 'Escribe otra vez tu usuario y contraseña.');
        }
        if (!usar_codigo($admin, campo('codigo'))) {
            registrar_fallo('totp', $admin['id']);
            throw new ErrorHttp(401, 'El código no es correcto. Escribe el que muestra la app en este momento o uno de respaldo.');
        }
        limpiar_fallos('totp', $admin['id']);
        return entrar($admin);
    });

    // Si en este navegador también hay una cuenta de cliente, solo se cierra la de Necutools (con otro id de sesión)
    post('/api/auth/logout', function () {
        if (Sesion::get('clienteId')) {
            Sesion::regenerar(['clienteId', 'clienteVersion', 'creada']);
        } else {
            Sesion::destruir();
        }
        return ['autenticado' => false];
    });
}
