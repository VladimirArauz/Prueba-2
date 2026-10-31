/**
 * NECUTLA — Campo del código de 6 dígitos que llega al correo (plan 2026-10-30-codigo-por-correo-y-sesion-permanente).
 * Avanza solo, Backspace regresa, las flechas mueven el cursor, pegar reparte los dígitos y al completar
 * llama a alCompletar(codigo). Efectos, siempre como respuesta a lo que hace la persona: pop al escribir,
 * temblor rojo al fallar (y se vacía) y verde con brillo al acertar (el brillo es una excepción autorizada
 * solo para este plan). Con movimiento reducido no hay animaciones (style.css).
 */

const DIGITOS_CODIGO = 6;

function crearCampoCodigo(campo, { alCompletar }) {
  const fila = document.createElement("div");
  fila.className = "codigo-cajas";
  fila.innerHTML = Array.from({ length: DIGITOS_CODIGO }, (_, i) => {
    const id = `${campo.id}-${i + 1}`;
    return `<label class="visually-hidden" for="${id}">Dígito ${i + 1} de ${DIGITOS_CODIGO}</label>
      <input class="codigo-digito" id="${id}" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="${DIGITOS_CODIGO}"
        autocomplete="${i === 0 ? "one-time-code" : "off"}" spellcheck="false">`;
  }).join("");
  campo.append(fila);
  const cajas = [...fila.querySelectorAll(".codigo-digito")];
  let temporizador = null;

  const valor = () => cajas.map(c => c.value).join("");
  const enfocar = i => cajas[Math.max(0, Math.min(i, cajas.length - 1))].focus();

  function pop(caja) {
    caja.classList.remove("is-pop");
    void caja.offsetWidth; // reinicia la animación si se escribe dos veces en la misma caja
    caja.classList.add("is-pop");
  }

  function quitarError() {
    if (!campo.classList.contains("is-error")) return;
    clearTimeout(temporizador);
    campo.classList.remove("is-error", "is-temblor");
  }

  // Reparte varios dígitos desde la caja i (pegar o el autocompletado del teléfono)
  function repartir(i, texto) {
    const digitos = texto.replace(/\D/g, "").slice(0, DIGITOS_CODIGO - i).split("");
    digitos.forEach((d, j) => {
      cajas[i + j].value = d;
      cajas[i + j].classList.add("is-lleno");
      pop(cajas[i + j]);
    });
    if (!digitos.length) return;
    // Con el código completo no se enfoca (ni se selecciona) la última caja: se verifica en seguida
    if (i + digitos.length < DIGITOS_CODIGO) enfocar(i + digitos.length);
    else if (cajas.includes(document.activeElement)) document.activeElement.blur();
    revisarCompleto();
  }

  function revisarCompleto() {
    const codigo = valor();
    if (codigo.length === DIGITOS_CODIGO) alCompletar(codigo);
  }

  cajas.forEach((caja, i) => {
    caja.addEventListener("focus", () => caja.select());
    caja.addEventListener("input", () => {
      quitarError();
      const texto = caja.value.replace(/\D/g, "");
      caja.value = "";
      caja.classList.remove("is-lleno");
      if (texto) repartir(i, texto);
    });
    caja.addEventListener("paste", event => {
      event.preventDefault();
      quitarError();
      repartir(0, (event.clipboardData || window.clipboardData).getData("text"));
    });
    caja.addEventListener("keydown", event => {
      if (event.key === "Backspace" && !caja.value && i > 0) {
        event.preventDefault();
        cajas[i - 1].value = "";
        cajas[i - 1].classList.remove("is-lleno");
        enfocar(i - 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        enfocar(i - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        enfocar(i + 1);
      }
    });
    caja.addEventListener("animationend", () => caja.classList.remove("is-pop"));
  });

  function limpiar() {
    clearTimeout(temporizador);
    campo.classList.remove("is-error", "is-temblor", "is-ok");
    cajas.forEach(c => {
      c.value = "";
      c.disabled = false;
      c.classList.remove("is-lleno", "is-pop");
    });
  }

  return {
    valor,
    limpiar,
    enfocar: () => enfocar(Math.min(valor().length, DIGITOS_CODIGO - 1)),
    habilitar(si) {
      cajas.forEach(c => { c.disabled = !si; });
    },
    // Rojo y temblor; luego se vacía y el foco vuelve al primero
    error() {
      clearTimeout(temporizador);
      campo.classList.remove("is-temblor");
      void campo.offsetWidth;
      campo.classList.add("is-error", "is-temblor");
      temporizador = setTimeout(() => {
        cajas.forEach(c => {
          c.value = "";
          c.classList.remove("is-lleno");
        });
        campo.classList.remove("is-temblor");
        enfocar(0);
      }, 650);
    },
    exito() {
      clearTimeout(temporizador);
      campo.classList.remove("is-error", "is-temblor");
      campo.classList.add("is-ok");
      cajas.forEach(c => { c.disabled = true; });
    }
  };
}
