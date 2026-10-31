// =========================================================
// NECUTLA — Captcha de Cloudflare Turnstile (plan 2026-10-31-seguridad-turnstile-y-cloudflare-aparte)
// Cada formulario protegido tiene un <div class="captcha">. Al enviar, tokenCaptcha(div, acción) pide un
// token a Cloudflare: casi siempre sale solo y no se ve nada; si Cloudflare duda, el recuadro aparece en
// el div para que la persona lo resuelva. El servidor lo revisa (app/captcha.php). Cada token sirve una vez.
// Sin llave en app/config.php, no hace nada y los formularios se mandan igual que antes.
// =========================================================

const TURNSTILE_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const captcha = { llave: null, script: null, widgets: new Map() };

function llaveCaptcha() {
  // Si /config falla (sin conexión), no se guarda: se vuelve a pedir en el siguiente envío
  if (!captcha.llave) captcha.llave = api("/config").then(c => c.captcha || "").catch(() => { captcha.llave = null; return ""; });
  return captcha.llave;
}

function cargarTurnstile() {
  if (!captcha.script) {
    captcha.script = new Promise((listo, fallo) => {
      const s = document.createElement("script");
      s.src = TURNSTILE_URL;
      s.async = true;
      s.addEventListener("load", () => listo(window.turnstile));
      s.addEventListener("error", () => {
        captcha.script = null;
        s.remove();
        fallo(new Error("No se pudo cargar la revisión de seguridad. Revisa tu internet e intenta de nuevo."));
      });
      document.head.appendChild(s);
    });
  }
  return captcha.script;
}

// Carga el script de Cloudflare antes de que la persona envíe, para que el token salga más rápido
async function prepararCaptcha() {
  if (await llaveCaptcha()) cargarTurnstile().catch(() => { /* se reintenta al enviar */ });
}

// Devuelve el token (o undefined si el captcha está apagado). La promesa espera mientras la persona
// resuelve el reto, si Cloudflare lo pide.
async function tokenCaptcha(contenedor, accion) {
  const llave = await llaveCaptcha();
  if (!llave || !contenedor) return undefined;
  const turnstile = await cargarTurnstile();
  // Los formularios que se volvieron a pintar dejan su recuadro viejo: se quita
  captcha.widgets.forEach((w, el) => {
    if (!el.isConnected) {
      turnstile.remove(w.id);
      captcha.widgets.delete(el);
    }
  });
  return new Promise((listo, fallo) => {
    let w = captcha.widgets.get(contenedor);
    if (!w) {
      w = { espera: null };
      w.id = turnstile.render(contenedor, {
        sitekey: llave,
        action: accion,
        execution: "execute",
        appearance: "interaction-only",
        size: "flexible",
        theme: "light",
        language: "es",
        callback: token => { if (w.espera) w.espera.listo(token); w.espera = null; },
        "error-callback": () => {
          if (w.espera) w.espera.fallo(new Error("No pudimos confirmar que no eres un robot. Recarga la página y vuelve a intentarlo."));
          w.espera = null;
          return true; // ya se avisó; que Cloudflare no lo repita en la consola
        },
        "timeout-callback": () => {
          if (w.espera) w.espera.fallo(new Error("Se acabó el tiempo para la revisión de seguridad. Vuelve a intentarlo."));
          w.espera = null;
        }
      });
      captcha.widgets.set(contenedor, w);
    } else {
      turnstile.reset(w.id); // el token anterior ya se usó
    }
    w.espera = { listo, fallo };
    turnstile.execute(contenedor);
  });
}

document.addEventListener("DOMContentLoaded", prepararCaptcha);
