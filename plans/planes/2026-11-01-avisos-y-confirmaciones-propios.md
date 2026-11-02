# Plan: avisos y confirmaciones propios en lugar de alert, confirm y prompt

- **Fecha:** 2026-11-01
- **Estado:** aplicado
- **Archivo del plan (al aplicarlo):** `plans/planes/2026-11-01-avisos-y-confirmaciones-propios.md`
- **Prompts:** `plans/prompts/2026-11-01-avisos-y-confirmaciones-propios.md`
- **Alcance:** cambiar todas las ventanas del navegador (`alert`, `confirm`, `prompt`) del sitio y de Necutools por una ventana de confirmación y unos avisos propios con el diseño de Necutla. No cambia la API, el carrito, los pedidos ni lo que hace cada acción; solo cómo se pregunta y cómo se avisa.

## Contexto

Al cancelar un pedido en Necutools (y en otras acciones) sale la ventana del navegador "necutla.com dice" con Aceptar/Cancelar. Al usuario no le gusta: quiere algo discreto pero funcional, bonito y elegante como el resto de la página, con una pequeña animación y un icono de admiración (o el que toque) según el tipo de aviso. Todas las que hagan eso se cambian.

Lo que hay hoy (`grep -n -E "\b(alert|confirm|prompt)\(" public/js/*.js`):

| Tipo | Dónde |
|---|---|
| `confirm` (11) | `necutools.js`: estado de pedido (pagado / cancelado / regresar, línea ~1712), cancelar pendientes de más de 7 días (~1604), quitar 2 pasos (~1667), eliminar tienda (~778), subcategoría (~837), color (~987), producto (~1070), oferta (~1235), promoción (~1419). `carrito.js:221` vaciar carrito. `producto.js:255` borrar opinión. |
| `prompt` (1) | `necutools.js:695` nota del pedido. |
| `alert` (6) | `necutools.js`: `manejarError` (~116, todos los errores de la API), código de 2 pasos (~185), editor de pedido (~650, 652, 655). `comun.js:181` tienda sin números de WhatsApp. |

## Decisiones del usuario

- Confirmaciones en una **ventana centrada** con el fondo oscurecido, icono según el tipo, título, mensaje y dos botones; entra con un fundido y un zoom pequeño.
- Avisos que solo informan (errores, validaciones) en el **toast que ya existe**, con tipos: el de error lleva icono de admiración rojo, un temblor corto, botón para cerrarlo y dura más.
- **Excepción de diseño autorizada solo para este plan:** la ventana lleva la sombra suave que ya existe (`--sombra-2`). `plans/CLAUDE.md` no se toca.

## Diseño (solo tokens y clases que ya existen)

**Ventana (`.dialogo`, elemento `<dialog>` nativo con `showModal()`)**
- Tarjeta `--hoja`, borde 2px `--tinta`, radio `--r-card`, sombra `--sombra-2` (excepción), ancho `min(440px, calc(100% - 32px))`, alineada a la izquierda. Fondo `::backdrop` con `--velo`.
- Cabecera: insignia redonda de 44px con el icono + título (h2 `wdth 112` / 700); mensaje debajo (`--texto-2`, máx. 68ch); botones a la derecha (en 360px, uno arriba del otro a lo ancho).
- Tipos de insignia (rellenos con borde, nunca amarillo como texto sobre claro):
  - `peligro` (eliminar, cancelar, vaciar, borrar, quitar 2 pasos): relleno `--aviso`, icono blanco `triangle-alert`; botón principal `.btn.danger`.
  - `importante` (marcar pagado, regresar a en proceso, cancelar los viejos): relleno `--senal`, borde `--tinta`, icono `--tinta` `circle-alert` (la admiración); botón principal `.btn`.
  - `info` / `nota` (nota del pedido): relleno `--tinta`, icono `--senal` (`info` o `pencil`); botón principal `.btn`.
- Botones con el texto de la acción exacta: "Cancelar pedido" / "Volver", "Eliminar tienda" / "Volver", "Vaciar carrito" / "Volver", "Guardar nota" / "Volver". Nunca "Aceptar"/"Cancelar" a secas.
- Movimiento (respuesta a la acción del usuario, permitido): la tarjeta entra con `opacity 0 → 1` y `scale(.96) → 1` en `--t-media`; la insignia hace un "pop" (`scale .6 → 1.1 → 1`, 0.35s); al cerrar, fundido corto. Con `prefers-reduced-motion` no hay animación (ya lo apaga el bloque global de `style.css`).
- Teclado y accesibilidad: `showModal()` atrapa el foco y deja el resto inerte; Escape y clic en el fondo = "Volver"; `aria-labelledby`/`aria-describedby`; foco inicial en "Volver" si es `peligro` (más seguro) y en el botón principal en los demás; al cerrar, el foco regresa al botón que la abrió.
- Para la nota: un `<textarea>` con su `<label>`, `maxlength` 200 y contador "n de 200"; Enter con Ctrl/⌘ guarda.

**Toast con tipos (`showToast`)**
- Se conserva `showToast(mensaje, icono)` como está (todas las llamadas actuales siguen igual) y se agrega un tercer parámetro `{ tipo }`: `"error"` pone la clase `.is-error` (borde izquierdo 4px `--aviso`, insignia roja con `circle-alert` blanco, `role="alert"`, temblor horizontal corto de 0.3s, botón `x` con `aria-label="Cerrar aviso"`, dura 6 s en lugar de 3.2 s).
- Atajo `avisarError(mensaje)` = `showToast(mensaje, "circle-alert", { tipo: "error" })`.

## Cambios

### 1. Piezas compartidas
- `public/iconos.js`: agregar `triangle-alert` de Lucide (el único que falta; `circle-alert`, `info`, `pencil`, `x`, `check` ya están).
- `public/js/comun.js`, sección nueva "Ventanas de confirmación":
  - `confirmar({ titulo, mensaje, aceptar, volver = "Volver", tipo = "importante" })` → `Promise<boolean>`.
  - `pedirTexto({ titulo, mensaje, etiqueta, valor = "", max = 200, aceptar })` → `Promise<string | null>` (null = Volver).
  - Una sola `<dialog id="app-dialogo">` creada al primer uso (como `#app-toast`), con listeners con `addEventListener` (sin JS en línea, cumple la CSP). Todo texto con `escapeHTML`. Si ya hay una abierta, la nueva espera a que se cierre.
  - `showToast(…, { tipo })` y `avisarError()`.
- `public/style.css`: sección "VENTANAS DE CONFIRMACIÓN" (`.dialogo`, `.dialogo-insignia.is-peligro|is-importante|is-info`, `.dialogo-acciones`, animaciones `dialogo-entra`, `insignia-pop`) y `.toast-notice.is-error` (+ `toast-tiembla`, `.toast-cerrar`). Responsivo a 360px.

### 2. Necutools (`public/js/necutools.js`)
- Cada `if (!confirm(...)) return;` pasa a `if (!(await confirmar({...}))) return;` y su función o acción en `ACCIONES` se vuelve `async` (el despachador no usa lo que regresan). Títulos como pregunta corta ("¿Cancelar el pedido 12?") y el detalle en el mensaje ("Sus piezas regresan al stock. Puedes reabrirlo después.").
- `notaPedido` usa `pedirTexto`.
- `manejarError`, el error del código de 2 pasos y las validaciones del editor de pedido usan `avisarError`.

### 3. Páginas públicas
- `public/js/carrito.js`: "Vaciar carrito" con `confirmar` tipo `peligro`.
- `public/js/producto.js`: "Borrar opinión" con `confirmar` tipo `peligro`.
- `public/js/comun.js` (`abrirWhatsApp`): tienda sin números → `avisarError`.

### 4. Revisión final
- `grep -n -E "\b(alert|confirm|prompt)\(" public` no debe encontrar nada (salvo el texto de comentarios).
- Sin hex sueltos, degradados, `style="`, `onclick`, `uppercase` ni emojis en lo nuevo.

## Archivos

`public/js/comun.js`, `public/iconos.js`, `public/style.css`, `public/js/necutools.js`, `public/js/carrito.js`, `public/js/producto.js`, `README.md` (cómo usar `confirmar`, `pedirTexto` y `avisarError`), `plans/planes/…`, `plans/prompts/…`, `plans/MEMORIA.md` (excepción de la sombra y pendiente de que el usuario lo vea).

## Verificación

1. Local (http://localhost:8081) con Chrome sin ventana y el cliente CDP propio (`--no-sandbox`, porque Claude corre como root), a 1280 y 360 px y con movimiento reducido. Reemplazar `window.alert/confirm/prompt` por funciones que fallen la prueba si alguien las llama.
2. Necutools con un dueño de prueba: cancelar un pedido (Volver no cambia nada; "Cancelar pedido" sí), marcar pagado, regresar a en proceso, nota (guardar, vaciar, Volver), eliminar un producto de prueba, error de la API (toast rojo con temblor y botón cerrar), validaciones del editor de pedido.
3. Teclado: Tab se queda dentro de la ventana, Escape cierra como "Volver", el foco regresa al botón; foco inicial correcto por tipo.
4. Carrito: vaciar con Volver y con "Vaciar carrito". Producto: borrar opinión con un cliente de prueba.
5. Sin scroll horizontal, sin errores de consola ni de CSP; con movimiento reducido no hay animaciones.
6. Borrar los datos de prueba, subir a IONOS por rsync (credenciales solo a variables, nunca impresas), revisar en vivo que los archivos coincidan, commit en `main` (con `runuser`; el push lo hace el usuario desde VS Code) y actualizar `plans/MEMORIA.md`.

