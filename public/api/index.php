<?php
// Único punto de entrada de la API (/api/* y /healthz, ver public/.htaccess). El código vive fuera de la
// carpeta pública, en app/.
require __DIR__ . '/../../app/arranque.php';
atender();
