<?php
/**
 * Plantilla de configuración. Copia este archivo a app/config.php y llena los valores.
 * app/config.php NO se sube a git (lleva la contraseña de la base y el secreto).
 *
 * En IONOS: los datos de la base salen en el panel → Hosting → Bases de datos → tu base (dbs…).
 * El secreto se genera una vez con:  php -r "echo base64_encode(random_bytes(32)), PHP_EOL;"
 */
return [
    // true en IONOS (cookie __Host- con Secure). false solo en tu computadora.
    'produccion' => true,

    'bd' => [
        'host' => 'db5000000000.hosting-data.io', // "Nombre del host" en IONOS
        'puerto' => 3306,
        'nombre' => 'dbs00000000',               // "Nombre de la base de datos"
        'usuario' => 'dbu00000000',              // "Nombre de usuario"
        'password' => 'CAMBIA-ESTO',
    ],

    // 32 bytes al azar en base64 (mínimo 32 caracteres). Firma las huellas de pedidos y las IP del límite.
    // Si lo cambias, los límites por IP empiezan de cero; nada más se pierde.
    'secreto' => 'CAMBIA-ESTO-POR-32-BYTES-AL-AZAR-EN-BASE64',

    // Números de respaldo para tiendas sin WhatsApp propio: 52 + 10 dígitos, separados por coma
    'whatsapp_respaldo' => '',

    // false mientras el dominio no tenga certificado SSL (la cookie de sesión va sin Secure). Quitar
    // también la redirección a HTTPS de public/.htaccess. Vuelve a true en cuanto haya HTTPS.
    'https' => true,

    // false pone en pausa las cuentas de cliente (entrar, registrarse y opinar). Necutools no cambia.
    'cuentas_clientes' => true,

    // Dirección pública del sitio, sin "/" al final (ej. 'https://necutla.com'). Arma og:url y og:image para
    // la vista previa del enlace en WhatsApp. Vacía: la vista previa sale sin imagen ni dirección.
    'url_publica' => '',

    // Correo que manda los códigos de verificación de las cuentas de cliente (entrar, registrarse y cambiar la
    // contraseña). En IONOS: smtp.ionos.mx, puerto 465 (SSL), usuario = el correo completo y su contraseña.
    // 'modo' => 'archivo' (solo en local, con 'produccion' en false) guarda los correos en /tmp/necutla-correos/.
    'correo' => [
        'modo' => 'smtp',
        'host' => 'smtp.ionos.mx',
        'puerto' => 465,
        'usuario' => 'tienda@necutla.com',
        'password' => 'CAMBIA-ESTO',
        'remitente' => 'tienda@necutla.com',
        'nombre' => 'Necutla',
    ],

    // Solo si IONOS pusiera un proxy delante y REMOTE_ADDR no fuera la IP del visitante. En hosting
    // compartido de IONOS se deja en false: si fuera true, cualquiera podría inventarse una IP.
    'confiar_x_forwarded_for' => false,

    // Solo para desarrollo (se ignoran si 'produccion' es true)
    'correo_dns_prueba' => false, // no consulta el DNS: los dominios .invalid y "sin-correo." no reciben correo
    'hoy_prueba' => '',           // fija la fecha de "hoy" (AAAA-MM-DD) para probar ofertas
];
