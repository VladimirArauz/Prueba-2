# Plan: IONOS por HTTP y cuentas de cliente en pausa

- **Fecha:** 2026-10-26
- **Estado:** aplicado (prompt 1 el 2026-10-26; prompt 2, vuelta a HTTPS con `necutla.com`, el 2026-10-30)
- **Prompts:** `plans/prompts/2026-10-26-ionos-sin-https-y-cuentas-en-pausa.md`
- **Alcance:** `public/.htaccess`, `app/` (interruptores en `config.php`), `cuenta.html`, `js/comun.js`,
  `js/cuenta.js`, `js/producto.js`. Medida temporal mientras no haya dominio con SSL.

## Por qué

La dirección temporal de IONOS (`s1115824141.onlinehome.mx`) no tiene certificado SSL y el `.htaccess` mandaba
todo a HTTPS, así que el sitio no se veía. Decisión del usuario: verlo por HTTP mientras tanto y poner en pausa
las cuentas de cliente (entrar, registrarse, opinar). Solo los admins entran, a Necutools.

## Cambios

1. `public/.htaccess`: la redirección a HTTPS queda comentada, con nota para volver a activarla.
2. `app/config.php` (y su plantilla): `'https' => false` hace que la cookie de sesión vaya sin `Secure` y sin
   prefijo `__Host-` (con `Secure`, el navegador la tiraría por HTTP y nadie podría entrar a Necutools).
   `'cuentas_clientes' => false` hace que `/api/clientes/*` dé 403 (salvo `/sesion`, que responde
   `{"autenticado":false,"pausa":true}`), que `cargar_cliente()` devuelva null (nadie opina) y que
   `/api/config` y la lista de opiniones lleven `cuentas: false`. Las dos valen `true` si no están.
3. Frontend: `comun.js` quita los enlaces a "Mi cuenta" si `cuentas` es false; `cuenta.html` muestra un aviso;
   `producto.js` dice que las opiniones nuevas están en pausa.

## Riesgo aceptado

Por HTTP la contraseña de los admins viaja sin cifrar al entrar a Necutools. Entrar solo desde redes de
confianza (no Wi-Fi público) y volver a HTTPS en cuanto haya dominio.

## Para volver a la normalidad

Quitar los `#` de la redirección en `public/.htaccess`, y en `app/config.php` del servidor poner
`'https' => true` y `'cuentas_clientes' => true` (o borrar las dos claves).
