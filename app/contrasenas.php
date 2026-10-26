<?php
/**
 * Reglas para contraseñas nuevas (admins y clientes): largo, minúscula, mayúscula, número y carácter especial.
 * Las cuentas que ya existen siguen entrando igual.
 */

const BCRYPT_COSTO = 12;
// bcrypt solo usa los primeros 72 bytes: más largo daría una falsa sensación de seguridad
const MAX_BYTES_CONTRASENA = 72;

// Las más usadas que cumplen el largo mínimo (listas públicas de contraseñas filtradas y variantes en español)
const COMUNES = [
    '1234567890', '12345678910', '123456789a', '1234567890a', '0987654321', '1111111111', '0000000000', '1234512345',
    'qwertyuiop', 'qwerty1234', 'qwerty12345', '1q2w3e4r5t', '1qaz2wsx3edc', 'asdfghjkl1', 'asdfghjkl;', 'zxcvbnm123',
    'password12', 'password123', 'password1234', 'passw0rd123', 'contraseña', 'contraseña1', 'contraseña12', 'contraseña123',
    'contrasena', 'contrasena1', 'contrasena12', 'contrasena123', 'iloveyou12', 'teamo12345', 'teamo123456', 'mexico1234',
    'mexico12345', 'necutla123', 'necutla1234', 'necutla12345', 'estudiante1', 'estudiante123', 'abcdefghij', 'abc1234567',
    'abcd123456', 'superman123', 'batman12345', 'football123', 'princesa123', 'chocolate1', 'chocolate123', 'administrador',
    'administrator', 'admin12345', 'admin123456', 'welcome123', 'bienvenido1', 'bienvenido123', 'changeme123', 'cambiame123',
];

// Tipos de carácter obligatorios. Misma lista y mismo orden que public/js/validacion.js
// Letras de cualquier idioma (ç, ß, à…) cuentan como letras, no como caracteres especiales
const TIPOS_CARACTER = [
    ['/\p{Ll}/u', 'una minúscula'],
    ['/\p{Lu}/u', 'una mayúscula'],
    ['/\p{Nd}/u', 'un número'],
    ['/[^\p{L}\p{N}\s]/u', 'un carácter especial (ej. ! # $ % & * ?)'],
];

// "una mayúscula y un número" (lo que le falta a la contraseña), o "" si no le falta nada
function tipos_faltantes(string $valor): string
{
    $faltan = [];
    foreach (TIPOS_CARACTER as [$regla, $nombre]) if (!preg_match($regla, $valor)) $faltan[] = $nombre;
    if (count($faltan) > 1) return implode(', ', array_slice($faltan, 0, -1)) . ' y ' . end($faltan);
    return implode('', $faltan);
}

// $confirmar: lo que se escribió en "Repite la contraseña" (null = no se pide)
function validar_contrasena($valor, int $minimo, string $campo = 'La contraseña', array $contiene = [], ?string $confirmar = null): string
{
    if (!is_string($valor) || mb_strlen($valor) < $minimo) {
        throw dato_invalido("$campo debe tener $minimo caracteres o más.");
    }
    if (strlen($valor) > MAX_BYTES_CONTRASENA) {
        throw dato_invalido("$campo es demasiado larga: usa hasta " . MAX_BYTES_CONTRASENA . ' letras (menos si llevan acentos).');
    }
    $faltan = tipos_faltantes($valor);
    if ($faltan !== '') throw dato_invalido("$campo necesita al menos $faltan.");
    $minus = mb_strtolower($valor);
    if (in_array($minus, COMUNES, true) || count(array_unique(mb_str_split($minus))) < 4) {
        throw dato_invalido("$campo es de las más usadas y fáciles de adivinar. Elige otra.");
    }
    foreach ($contiene as $dato) {
        if (is_string($dato) && mb_strlen($dato) >= 3 && str_contains($minus, mb_strtolower($dato))) {
            throw dato_invalido("$campo no puede llevar tu usuario o tu correo.");
        }
    }
    if ($confirmar !== null && $confirmar !== $valor) {
        throw dato_invalido('Las contraseñas no coinciden. Escribe la misma en los dos campos.');
    }
    return $valor;
}

function cifrar_contrasena(string $password): string
{
    return password_hash($password, PASSWORD_BCRYPT, ['cost' => BCRYPT_COSTO]);
}

// Hash fijo (costo 12) para comparar aunque la cuenta no exista: mismo tiempo de respuesta.
// Va escrito aquí porque PHP no tiene un arranque único donde calcularlo una vez.
const HASH_FALSO = '$2y$12$OSfFltudRjDj3EJBENmkvenjb1BARBtziq/sF3grilHWt84f7Tt0u';
