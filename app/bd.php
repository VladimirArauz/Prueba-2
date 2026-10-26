<?php
/**
 * Conexión a MariaDB con PDO. Las fechas se guardan y se leen en UTC (time_zone = '+00:00').
 * Siempre con parámetros (?): nunca se mete texto del usuario en el SQL.
 */

function bd(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;
    $c = config('bd');
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $c['host'], $c['puerto'] ?? 3306, $c['nombre']);
    $pdo = new PDO($dsn, $c['usuario'], $c['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false, // enteros como int y sin trucos de comillas
        // rowCount() cuenta las filas encontradas, no solo las que cambiaron (PDO::MYSQL_ATTR_* es obsoleto desde PHP 8.5)
        Pdo\Mysql::ATTR_FOUND_ROWS => true,
    ]);
    $pdo->exec("SET time_zone = '+00:00', sql_mode = 'STRICT_ALL_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");
    return $pdo;
}

function q(string $sql, array $params = []): PDOStatement
{
    $st = bd()->prepare($sql);
    // PDO manda false como "" y la base lo rechaza: los booleanos van como 1 y 0
    $st->execute(array_map(fn($v) => is_bool($v) ? (int) $v : $v, array_values($params)));
    return $st;
}

function filas(string $sql, array $params = []): array
{
    return q($sql, $params)->fetchAll();
}

function fila(string $sql, array $params = []): ?array
{
    $f = q($sql, $params)->fetch();
    return $f === false ? null : $f;
}

function valor(string $sql, array $params = [])
{
    $v = q($sql, $params)->fetchColumn();
    return $v === false ? null : $v;
}

// Filas afectadas (encontradas) por un UPDATE o DELETE
function ejecutar(string $sql, array $params = []): int
{
    return q($sql, $params)->rowCount();
}

function ultimo_id(): int
{
    return (int) bd()->lastInsertId();
}

// "?, ?, ?" para un IN (...) con una lista de valores
function marcas(array $lista): string
{
    return implode(', ', array_fill(0, count($lista), '?'));
}

function en_transaccion(callable $fn)
{
    bd()->beginTransaction();
    try {
        $resultado = $fn();
        bd()->commit();
        return $resultado;
    } catch (Throwable $e) {
        if (bd()->inTransaction()) bd()->rollBack();
        throw $e;
    }
}

// ================= Formato de lo que sale de la base =================

// "2026-10-20 20:48:17.512732" (UTC) → "2026-10-20T20:48:17.512Z", como lo devolvía Node
function fecha_iso(?string $valor): ?string
{
    if ($valor === null) return null;
    $f = DateTimeImmutable::createFromFormat('Y-m-d H:i:s.u', strlen($valor) > 19 ? $valor : "$valor.000000", new DateTimeZone('UTC'));
    return $f ? $f->format('Y-m-d\TH:i:s.v\Z') : null;
}

// Milisegundos desde 1970 (para ?v= en las direcciones de imágenes)
function version_ms(string $valor): int
{
    $f = DateTimeImmutable::createFromFormat('Y-m-d H:i:s.u', strlen($valor) > 19 ? $valor : "$valor.000000", new DateTimeZone('UTC'));
    return $f ? (int) $f->format('Uv') : 0;
}

function a_float($valor): ?float
{
    return $valor === null ? null : (float) $valor;
}

function a_bool($valor): bool
{
    return (bool) (int) $valor;
}

// Columna JSON (arreglo) → arreglo de PHP
function a_lista(?string $json): array
{
    $v = $json === null ? [] : json_decode($json, true);
    return is_array($v) ? $v : [];
}

// Error de clave repetida (1062) o de referencia (1451/1452) de MariaDB
function error_bd(Throwable $e): ?int
{
    return $e instanceof PDOException && isset($e->errorInfo[1]) ? (int) $e->errorInfo[1] : null;
}

// Nombre del índice que chocó en un 1062: "Duplicate entry 'x' for key 'admins_correo_idx'"
function indice_repetido(Throwable $e): string
{
    return preg_match("/for key '(?:[^'.]*\\.)?([^']+)'/", $e->getMessage(), $m) ? $m[1] : '';
}
