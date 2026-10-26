<?php
/**
 * Límite de intentos por cuenta (además del límite por IP).
 * 10 fallos seguidos en 15 minutos frenan la cuenta 15 minutos, vengan de la IP que vengan.
 * Se cuenta igual si la cuenta no existe, para no revelar cuáles existen.
 */

const MAX_FALLOS = 10;
const VENTANA_FALLOS = 15 * 60; // segundos

function clave_cuenta($cuenta): string
{
    return mb_substr(mb_strtolower(js_trim((string) $cuenta)), 0, 120);
}

// 429 si la cuenta está frenada
function exigir_no_frenada(string $tipo, $cuenta): void
{
    $frenada = valor('SELECT 1 FROM intentos_login WHERE tipo = ? AND cuenta = ? AND bloqueado_hasta > UTC_TIMESTAMP(6)',
        [$tipo, clave_cuenta($cuenta)]);
    if ($frenada) throw new ErrorHttp(429, 'Demasiados intentos fallidos con esta cuenta. Espera 15 minutos y vuelve a intentar.');
}

function registrar_fallo(string $tipo, $cuenta): void
{
    // Las asignaciones van de izquierda a derecha: bloqueado_hasta usa los fallos y la fecha de antes
    q('INSERT INTO intentos_login (tipo, cuenta, fallos) VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE
         bloqueado_hasta = IF(actualizado_en >= UTC_TIMESTAMP(6) - INTERVAL ? SECOND AND fallos + 1 >= ?,
                              UTC_TIMESTAMP(6) + INTERVAL ? SECOND, bloqueado_hasta),
         fallos = IF(actualizado_en < UTC_TIMESTAMP(6) - INTERVAL ? SECOND, 1, fallos + 1),
         actualizado_en = UTC_TIMESTAMP(6)',
      [$tipo, clave_cuenta($cuenta), VENTANA_FALLOS, MAX_FALLOS, VENTANA_FALLOS, VENTANA_FALLOS]);
}

function limpiar_fallos(string $tipo, $cuenta): void
{
    q('DELETE FROM intentos_login WHERE tipo = ? AND cuenta = ?', [$tipo, clave_cuenta($cuenta)]);
}
