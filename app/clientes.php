<?php
/**
 * Cuentas de cliente (/api/clientes): registro, inicio y cierre de sesión.
 * Solo sirven para opinar sobre productos; el pedido sigue sin cuenta, por WhatsApp.
 * Se entra con el nombre de usuario o con el correo, en un solo campo, y después con el código que llega al correo
 * (app/codigos.php): también para crear la cuenta y para restablecer la contraseña. El teléfono es privado:
 * no sale en ninguna respuesta pública (opiniones, tiendas, pedidos).
 * La sesión es la misma cookie que la de Necutools, con clienteId en vez de adminId.
 * Al crear la cuenta se acepta la casilla de edad; la persona puede eliminar su cuenta con un código al correo
 * (sus opiniones se quedan como "Cliente de Necutla"). Plan: plans/planes/2026-11-04-cumplimiento-legal-cuenta-y-edad.md
 */

const MIN_PASSWORD_CLIENTE = 10;
const DUPLICADO_CLIENTE = 'Ese nombre de usuario o ese correo ya tienen cuenta. Inicia sesión o usa otros.';
const FALTA_EDAD = 'Marca la casilla de edad para seguir.';
// Lo que se lee de un cliente para su sesión (sin la contraseña)
const CAMPOS_CLIENTE = 'id, nombre, usuario, correo, telefono IS NOT NULL AS con_telefono, edad_aceptada_en IS NOT NULL AS con_edad, activo, sesion_version';

// Carga al cliente en cada petición: si desactivan su cuenta, se nota de inmediato
function cargar_cliente(): ?array
{
    if (!cuentas_clientes()) return null;
    $id = Sesion::get('clienteId');
    if (!$id) return null;
    $c = fila('SELECT ' . CAMPOS_CLIENTE . ' FROM clientes WHERE id = ?', [$id]);
    if (!$c || !a_bool($c['activo'])) return null;
    // Sesión iniciada antes del último cambio de contraseña: ya no vale
    if ((int) (Sesion::get('clienteVersion') ?? 0) !== (int) $c['sesion_version']) return null;
    return $c;
}

function requiere_cliente(): array
{
    $cliente = cargar_cliente();
    if (!$cliente) throw new ErrorHttp(401, 'Inicia sesión con tu cuenta para opinar.');
    return Actual::$cliente = $cliente;
}

function password_cliente($valor, $confirmar, array $contiene, string $campo = 'La contraseña'): string
{
    return validar_contrasena($valor, MIN_PASSWORD_CLIENTE, $campo, $contiene, is_string($confirmar) ? $confirmar : '');
}

// La casilla "Tengo 18 años o más, o mi madre, padre o tutor me dio permiso": tiene que llegar marcada (true)
function exigir_edad(): void
{
    if (campo('edad') !== true) throw dato_invalido(FALTA_EDAD);
}

// Lo que ve el propio cliente de su sesión. incompleta: cuenta de antes del registro con usuario y teléfono,
// o de antes de la casilla de edad; falta dice qué pedirle en "Completa tu cuenta"
function datos_sesion_cliente(array $c): array
{
    $falta = ['usuario' => !$c['usuario'], 'telefono' => !a_bool($c['con_telefono']), 'edad' => !a_bool($c['con_edad'] ?? false)];
    return [
        'autenticado' => true, 'nombre' => $c['nombre'], 'usuario' => $c['usuario'] ?: null, 'correo' => $c['correo'],
        'incompleta' => in_array(true, $falta, true), 'falta' => $falta,
    ];
}

// Cierra la sesión de cliente en los demás navegadores (si ahí también hay un admin, ese sigue dentro).
// Si alguno tenía una petición en curso y vuelve a guardar su sesión, sesion_version la invalida igual.
function cerrar_otras_sesiones_cliente(int $clienteId, ?string $exceptoId): void
{
    foreach (filas('SELECT id, datos FROM sesiones WHERE cliente_id = ? AND id <> ?', [$clienteId, (string) $exceptoId]) as $s) {
        $datos = json_decode($s['datos'], true) ?: [];
        unset($datos['clienteId']);
        q('UPDATE sesiones SET datos = ?, cliente_id = NULL WHERE id = ?',
          [json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $s['id']]);
    }
}

// Nueva sesión al entrar (evita fijación de sesión). Si ya había un admin en este navegador, se conserva
// con sus tiempos (creada, adminUso). La de cliente no vence (app/sesiones.php).
function iniciar_sesion_cliente(array $cliente): array
{
    Sesion::regenerar(['adminId', 'usuario', 'creada', 'adminUso']);
    Sesion::set('clienteId', $cliente['id']);
    Sesion::set('clienteVersion', (int) ($cliente['sesion_version'] ?? 0));
    return datos_sesion_cliente($cliente);
}

// Cierra la sesión de cliente de este navegador. Si también hay una de Necutools, esa sigue (con otro id de sesión).
function cerrar_sesion_cliente(): void
{
    if (Sesion::get('adminId')) {
        Sesion::regenerar(['adminId', 'usuario', 'creada', 'adminUso']);
    } else {
        Sesion::destruir();
    }
}

// Borra la cuenta y lo que la identifica: códigos, frenos de login y sesiones. Las opiniones se quedan
// con cliente_id NULL (la llave foránea es ON DELETE SET NULL) y se muestran como "Cliente de Necutla".
function eliminar_cliente(array $c): void
{
    $id = (int) $c['id'];
    en_transaccion(function () use ($c, $id) {
        q('DELETE FROM codigos_correo WHERE correo = ? OR cliente_id = ?', [$c['correo'], $id]);
        q("DELETE FROM intentos_login WHERE tipo = 'cliente' AND cuenta IN (?, ?, ?, ?)",
          ["id:$id", "password:$id", $c['correo'], (string) $c['usuario']]);
        cerrar_otras_sesiones_cliente($id, Sesion::id());
        q('DELETE FROM clientes WHERE id = ?', [$id]);
    });
}

function limitar_cambios_cliente(): void
{
    limitar('cambios-cliente', 20, MIN_15, 'Demasiados cambios seguidos. Espera 15 minutos y vuelve a intentar.');
}

function rutas_clientes(): void
{
    // Cuentas en pausa ('cuentas_clientes' => false): nadie entra, se registra ni cambia datos
    if (!cuentas_clientes() && preg_match('#^/api/clientes/(?!sesion$)#i', Peticion::$ruta)) {
        throw new ErrorHttp(403, 'Las cuentas de cliente están en pausa por ahora. Para comprar no necesitas cuenta.');
    }
    get('/api/clientes/sesion', function () {
        if (!cuentas_clientes()) return ['autenticado' => false, 'pausa' => true];
        $cliente = cargar_cliente();
        $pendiente = codigo_pendiente();
        // Con sesión, el único paso de código que se retoma es el de eliminar la cuenta
        if ($cliente) return datos_sesion_cliente($cliente) + ($pendiente && $pendiente['proposito'] === 'eliminar' ? ['codigoPendiente' => $pendiente] : []);
        return ['autenticado' => false] + ($pendiente ? ['codigoPendiente' => $pendiente] : []);
    });

    // Nunca dice si el correo ya tiene cuenta: solo si está bien escrito y si su dominio recibe correos.
    // Consulta el DNS, por eso tiene su propio límite.
    post('/api/clientes/revisar-correo', function () {
        limitar('revisar-correo', 60, MIN_15, 'Espera unos minutos para revisar más correos.');
        $r = revisar_correo(campo('correo'));
        return ['valido' => true, 'correo' => $r['correo'], 'sugerencia' => $r['sugerencia']];
    });

    post('/api/clientes/registro', function () {
        // Holgado porque en la escuela muchos estudiantes salen a internet con la misma IP.
        // No cuentan los errores de captura (400), pero sí los correos que ya tienen cuenta (409): si no,
        // se podrían probar correos sin límite.
        limitar_si('registro', 30, UNA_HORA, 'Se crearon muchas cuentas desde esta conexión. Espera una hora y vuelve a intentar.',
            fn($s) => $s < 400 || $s === 409);
        $nombre = v_publico(campo('nombre'), 'tu nombre', 60, true);
        if (mb_strlen($nombre) < 2) throw dato_invalido('Escribe tu nombre con al menos 2 letras.');
        $usuario = usuario_valido(campo('usuario'));
        $tel = v_telefono(campo('pais'), campo('telefono'));
        $correo = correo_real(campo('correo'));
        $password = password_cliente(campo('password'), campo('confirmar'), [$nombre, $usuario, explode('@', $correo)[0]]);
        exigir_edad();
        // Captcha antes de revisar si el correo ya existe: un bot no puede probar correos
        exigir_captcha('registro');
        // Antes del bcrypt: un usuario o correo repetido no debe gastar CPU. No se dice cuál de los dos.
        if (valor('SELECT 1 FROM clientes WHERE correo = ? OR usuario = ?', [$correo, $usuario])) throw new ErrorHttp(409, DUPLICADO_CLIENTE);
        // La cuenta se crea hasta que llega el código del correo; mientras, el registro espera en el código
        $datos = ['nombre' => $nombre, 'usuario' => $usuario, 'pais' => $tel['pais'], 'telefono' => $tel['telefono'],
                  'hash' => cifrar_contrasena($password), 'edad' => true];
        return crear_codigo('registro', $correo, null, $datos, $nombre);
    });

    // Con el código correcto se crea la cuenta y la sesión se inicia sola
    post('/api/clientes/registro/codigo', function () {
        $f = verificar_codigo('registro', campo('codigo'));
        $d = $f['datos'];
        // Un registro pendiente de antes de la casilla no la trae: la cuenta la acepta después en "Completa tu cuenta"
        $edad = !empty($d['edad']);
        try {
            q('INSERT INTO clientes (nombre, usuario, correo, pais, telefono, password_hash, edad_aceptada_en)
               VALUES (?, ?, ?, ?, ?, ?, IF(?, UTC_TIMESTAMP(6), NULL))',
              [$d['nombre'], $d['usuario'], $f['correo'], $d['pais'], $d['telefono'], $d['hash'], (int) $edad]);
        } catch (PDOException $e) {
            if (error_bd($e) === 1062) throw new ErrorHttp(409, DUPLICADO_CLIENTE);
            throw $e;
        }
        $cliente = ['id' => ultimo_id(), 'nombre' => $d['nombre'], 'usuario' => $d['usuario'], 'correo' => $f['correo'],
                    'con_telefono' => 1, 'con_edad' => $edad, 'sesion_version' => 0];
        return iniciar_sesion_cliente($cliente);
    });

    // Un solo campo: con "@" es un correo; sin "@", un nombre de usuario. `correo` se sigue aceptando.
    post('/api/clientes/login', function () {
        limitar_si('login-cliente', 10, MIN_15, 'Demasiados intentos. Espera 15 minutos y vuelve a intentar.', fn($s) => $s >= 400);
        $crudo = existe('identificador') ? campo('identificador') : campo('correo');
        $identificador = is_string($crudo) ? mb_strtolower(js_trim($crudo)) : '';
        $password = is_string(campo('password')) ? campo('password') : '';
        if ($identificador === '' || $password === '' || mb_strlen($identificador) > 120 || mb_strlen($password) > 200) {
            throw dato_invalido('Escribe tu usuario o correo y tu contraseña.');
        }
        exigir_captcha('login');
        // correo y usuario se guardan en minúsculas y la columna compara exacto (utf8mb4_nopad_bin)
        $campos = 'SELECT ' . CAMPOS_CLIENTE . ', password_hash FROM clientes';
        $cliente = str_contains($identificador, '@')
            ? fila("$campos WHERE correo = ?", [$identificador])
            : fila("$campos WHERE usuario = ?", [$identificador]);
        // El freno por cuenta usa el id: así no se esquiva alternando el usuario y el correo
        $freno = $cliente ? "id:{$cliente['id']}" : $identificador;
        exigir_no_frenada('cliente', $freno);
        $valido = password_verify($password, $cliente ? $cliente['password_hash'] : hash_falso());
        if (!$cliente || !$valido) {
            registrar_fallo('cliente', $freno);
            throw new ErrorHttp(401, 'Usuario, correo o contraseña incorrectos.');
        }
        limpiar_fallos('cliente', $freno);
        actualizar_hash_si_hace_falta('clientes', (int) $cliente['id'], $password, $cliente['password_hash']);
        if (!a_bool($cliente['activo'])) throw new ErrorHttp(403, 'Esta cuenta está desactivada.');
        // La contraseña está bien: falta el código que llega al correo
        return crear_codigo('login', $cliente['correo'], (int) $cliente['id'], null, $cliente['nombre']);
    });

    post('/api/clientes/login/codigo', function () {
        $f = verificar_codigo('login', campo('codigo'));
        $cliente = fila('SELECT ' . CAMPOS_CLIENTE . ' FROM clientes WHERE id = ?', [(int) $f['cliente_id']]);
        if (!$cliente || !a_bool($cliente['activo'])) throw new ErrorHttp(403, 'Esta cuenta está desactivada.');
        return iniciar_sesion_cliente($cliente);
    });

    post('/api/clientes/codigo/reenviar', function () {
        exigir_captcha('reenviar');
        return reenviar_codigo();
    });

    // Olvidé mi contraseña. Siempre responde lo mismo, exista o no la cuenta: no revela qué correos tienen cuenta.
    post('/api/clientes/restablecer', function () {
        limitar('restablecer', 10, MIN_15, 'Demasiados intentos. Espera 15 minutos y vuelve a intentar.');
        $crudo = campo('identificador');
        $identificador = is_string($crudo) ? mb_strtolower(js_trim($crudo)) : '';
        if ($identificador === '' || mb_strlen($identificador) > 120) throw dato_invalido('Escribe tu usuario o correo.');
        exigir_captcha('restablecer');
        $esCorreo = str_contains($identificador, '@');
        $cliente = fila('SELECT id, nombre, correo, activo FROM clientes WHERE ' . ($esCorreo ? 'correo' : 'usuario') . ' = ?', [$identificador]);
        $mostrar = $esCorreo ? $identificador : null;
        if ($cliente && a_bool($cliente['activo'])) {
            try {
                crear_codigo('restablecer', $cliente['correo'], (int) $cliente['id'], null, $cliente['nombre'], true);
                Sesion::set('codigo', Sesion::get('codigo') + ['visible' => $esCorreo]);
            } catch (ErrorHttp $e) {
                if ($e->status !== 429) throw $e;
                codigo_falso('restablecer', $mostrar); // demasiados envíos a esa cuenta: no se dice
            }
        } else {
            codigo_falso('restablecer', $mostrar);
        }
        return respuesta_codigo('restablecer', $mostrar);
    });

    // Con el código correcto, la sesión puede poner una contraseña nueva durante 10 minutos
    post('/api/clientes/restablecer/codigo', function () {
        $f = verificar_codigo('restablecer', campo('codigo'));
        Sesion::set('restablecer', ['clienteId' => (int) $f['cliente_id'], 'hasta' => ahora_ms() + CODIGO_VIDA * 1000]);
        return ['ok' => true];
    });

    post('/api/clientes/restablecer/password', function () {
        $r = Sesion::get('restablecer');
        if (!$r || $r['hasta'] < ahora_ms()) {
            Sesion::quitar('restablecer');
            throw new ErrorHttp(410, 'Pasaron más de 10 minutos. Pide otro código para cambiar tu contraseña.');
        }
        $cliente = fila('SELECT ' . CAMPOS_CLIENTE . ' FROM clientes WHERE id = ?', [$r['clienteId']]);
        if (!$cliente || !a_bool($cliente['activo'])) throw new ErrorHttp(403, 'Esta cuenta está desactivada.');
        $contiene = [$cliente['nombre'], $cliente['usuario'], explode('@', $cliente['correo'])[0]];
        $nueva = password_cliente(campo('nueva'), campo('confirmar'), $contiene, 'La contraseña nueva');
        q('UPDATE clientes SET password_hash = ?, sesion_version = sesion_version + 1 WHERE id = ?', [cifrar_contrasena($nueva), $cliente['id']]);
        $cliente['sesion_version'] = (int) valor('SELECT sesion_version FROM clientes WHERE id = ?', [$cliente['id']]);
        Sesion::quitar('restablecer');
        limpiar_fallos('cliente', "id:{$cliente['id']}");
        // Fuera de los demás navegadores y con sesión nueva aquí
        $datos = iniciar_sesion_cliente($cliente);
        cerrar_otras_sesiones_cliente($cliente['id'], Sesion::id());
        return $datos;
    });

    // Cambiar la contraseña: pide la actual (con freno por cuenta) y la nueva dos veces
    put('/api/clientes/password', function () {
        limitar_cambios_cliente();
        $cliente = requiere_cliente();
        $hashActual = valor('SELECT password_hash FROM clientes WHERE id = ?', [$cliente['id']]);
        $freno = "password:{$cliente['id']}";
        exigir_no_frenada('cliente', $freno);
        $actual = is_string(campo('actual')) ? campo('actual') : '';
        if ($actual === '' || mb_strlen($actual) > 200 || !password_verify($actual, $hashActual)) {
            registrar_fallo('cliente', $freno);
            throw dato_invalido('Tu contraseña actual no es correcta.');
        }
        limpiar_fallos('cliente', $freno);
        $contiene = [$cliente['nombre'], $cliente['usuario'], explode('@', $cliente['correo'])[0]];
        $nueva = password_cliente(campo('nueva'), campo('confirmar'), $contiene, 'La contraseña nueva');
        if ($nueva === $actual) throw dato_invalido('La contraseña nueva debe ser distinta a la actual.');
        q('UPDATE clientes SET password_hash = ?, sesion_version = sesion_version + 1 WHERE id = ?', [cifrar_contrasena($nueva), $cliente['id']]);
        $version = (int) valor('SELECT sesion_version FROM clientes WHERE id = ?', [$cliente['id']]);
        // Id de sesión nuevo aquí y fuera de los demás navegadores
        Sesion::regenerar(['adminId', 'usuario', 'clienteId', 'clienteVersion', 'creada', 'adminUso']);
        Sesion::set('clienteVersion', $version);
        cerrar_otras_sesiones_cliente($cliente['id'], Sesion::id());
        return ['ok' => true];
    });

    // Cuentas de antes del registro con usuario y teléfono, o de antes de la casilla de edad: completan lo que falte
    put('/api/clientes/completar', function () {
        limitar_cambios_cliente();
        $cliente = requiere_cliente();
        $usuario = $cliente['usuario'] ?: usuario_valido(campo('usuario'));
        $tel = a_bool($cliente['con_telefono']) ? ['pais' => null, 'telefono' => null] : v_telefono(campo('pais'), campo('telefono'));
        if (!a_bool($cliente['con_edad'])) exigir_edad();
        try {
            q('UPDATE clientes SET usuario = ?, pais = COALESCE(?, pais), telefono = COALESCE(?, telefono),
                      edad_aceptada_en = COALESCE(edad_aceptada_en, UTC_TIMESTAMP(6)) WHERE id = ?',
              [$usuario, $tel['pais'], $tel['telefono'], $cliente['id']]);
        } catch (PDOException $e) {
            if (error_bd($e) === 1062) throw new ErrorHttp(409, 'Ese nombre de usuario ya está ocupado. Elige otro.');
            throw $e;
        }
        return datos_sesion_cliente(['nombre' => $cliente['nombre'], 'usuario' => $usuario, 'correo' => $cliente['correo'],
                                     'con_telefono' => 1, 'con_edad' => 1]);
    });

    // Eliminar la cuenta, paso 1: manda un código al correo de la cuenta (con sesión iniciada)
    post('/api/clientes/eliminar', function () {
        limitar_cambios_cliente();
        $cliente = requiere_cliente();
        return crear_codigo('eliminar', $cliente['correo'], (int) $cliente['id'], null, $cliente['nombre']);
    });

    // Paso 2: con el código correcto de esta misma cuenta se borra y se cierra la sesión de cliente
    post('/api/clientes/eliminar/codigo', function () {
        $cliente = requiere_cliente();
        $f = verificar_codigo('eliminar', campo('codigo'));
        if ((int) $f['cliente_id'] !== (int) $cliente['id']) throw new ErrorHttp(410, 'Pide un código nuevo para seguir.');
        eliminar_cliente($cliente);
        cerrar_sesion_cliente();
        return ['autenticado' => false, 'eliminada' => true];
    });

    post('/api/clientes/logout', function () {
        cerrar_sesion_cliente();
        return ['autenticado' => false];
    });
}
