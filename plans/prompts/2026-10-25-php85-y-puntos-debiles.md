# Prompts: PHP 8.5 y cierre de los puntos débiles

Plan: `plans/planes/2026-10-25-php85-y-puntos-debiles.md`. Trabajar siempre en `main`, sin ramas.

## Prompt 1: PHP 8.5, puntos débiles y pruebas (aplicado el 2026-10-25)

Lee `plans/CLAUDE.md`, `plans/MEMORIA.md` y `plans/planes/2026-10-25-php85-y-puntos-debiles.md`.
- Instala PHP 8.5 con el parche de PHP2Shell y haz que el Apache de XAMPP lo use por PHP-FPM (pools
  `necutla` y `xampp`); apaga el `mod_php` 8.2.12 de XAMPP. Guarda copia de la configuración de antes.
- Haz que la API exija PHP 8.5 y quita lo obsoleto en 8.5 (`PDO::MYSQL_ATTR_*`).
- Corrige los puntos 2, 3 y 4 de la sección 3 del plan, con pruebas en `scripts/seguridad/ataques.js`.
- Vuelve a generar `~/necutla-mariadb.sql` y prueba que importa.
- Corre las pruebas de ataque, la comparación con Node y el navegador. Actualiza `README.md` y `plans/MEMORIA.md`.
