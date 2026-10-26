<?php
/**
 * Bitácora de Necutools: quién hizo qué y cuándo. Sin contraseñas, imágenes ni datos de clientes.
 * Si no se puede anotar, la acción sigue (solo queda el error en el log).
 */

function anotar(array $admin, string $accion, string $tabla, ?int $registroId, string $resumen = ''): void
{
    try {
        q('INSERT INTO bitacora (admin_id, usuario, accion, tabla, registro_id, resumen) VALUES (?, ?, ?, ?, ?, ?)',
          [$admin['id'], $admin['usuario'], $accion, $tabla, $registroId, mb_substr($resumen, 0, 200)]);
    } catch (Throwable $e) {
        error_log('No se pudo anotar en la bitácora: ' . $e->getMessage());
    }
}
