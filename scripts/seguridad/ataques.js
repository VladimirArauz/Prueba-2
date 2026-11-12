/**
 * NECUTLA — Pruebas de ataque contra el servidor LOCAL (nunca contra IONOS ni Render).
 *
 *   node scripts/seguridad/ataques.js [http://localhost:8081]
 *
 * Variables opcionales: NECUTLA_DUENO_USUARIO y NECUTLA_DUENO_PASSWORD (un dueño de la base local).
 * Crea datos de prueba (encargados, clientes, productos) con un sufijo único y desactiva a los
 * encargados al terminar. Cada prueba dice qué espera y a qué hallazgo de
 * plans/auditorias/2026-10-20-seguridad.md corresponde. Sale con código 1 si alguna falla.
 *
 * Entrar, registrarse, restablecer y eliminar la cuenta piden el código del correo: en local, app/config.php lleva
 * 'correo' => ['modo' => 'archivo'] y el código se lee de /tmp/necutla-correos/ (codigoDe).
 *
 * Cada petición lleva su propia IP en X-Forwarded-For para que el límite general de la API no
 * mezcle las pruebas (en local, app/config.php la acepta con confiar_x_forwarded_for; en IONOS se usa REMOTE_ADDR).
 */
const BASE = (process.argv[2] || "http://localhost:8081").replace(/\/$/, "");
const host = new URL(BASE).hostname;
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
  console.error("Estas pruebas solo corren contra localhost.");
  process.exit(2);
}
const DUENO = process.env.NECUTLA_DUENO_USUARIO || "dueno";
const DUENO_PASS = process.env.NECUTLA_DUENO_PASSWORD || "prueba-dueno-123";
const SUFIJO = Date.now().toString(36);
const totp = require("./totp");
const fs = require("fs");

// ================= Utilidades =================
let ipSeq = 0;
const nuevaIp = () => { ipSeq += 1; return `10.${(ipSeq >> 16) & 255}.${(ipSeq >> 8) & 255}.${ipSeq & 255}`; };

// Rutas con captcha (app/captcha.php). En local, app/config.php usa las llaves de prueba de Cloudflare
// (site_key 1x00000000000000000000AA, secret 1x0000000000000000000000000000000AA), que aceptan este token.
const TOKEN_PRUEBA = "XXXX.DUMMY.TOKEN.XXXX";
const CON_CAPTCHA = /^\/api\/(clientes\/(login|registro|restablecer|codigo\/reenviar)|pedidos|productos\/\d+\/resena)$/;

// Para pedir hace falta cuenta: las pruebas de pedidos usan esta, salvo las que piden sinSesion
let comprador = null;

async function pedir(metodo, ruta, { body, sesion, origin = BASE, ip = nuevaIp(), headers = {}, crudo, sinCaptcha = false, sinSesion = false } = {}) {
  if (!sesion && !sinSesion && metodo === "POST" && ruta === "/api/pedidos") sesion = comprador;
  // Las pruebas de siempre mandan el token de prueba; las del captcha lo quitan con sinCaptcha
  if (!sinCaptcha && (metodo === "POST" || metodo === "PUT") && CON_CAPTCHA.test(ruta)) {
    body = body && typeof body === "object" && !Array.isArray(body) ? { captcha: TOKEN_PRUEBA, ...body } : body === undefined ? { captcha: TOKEN_PRUEBA } : body;
  }
  const h = { "X-Forwarded-For": ip, ...headers };
  if (origin) h.Origin = origin;
  if (sesion && sesion.cookie) h.Cookie = sesion.cookie;
  let data;
  if (crudo !== undefined) data = crudo;
  else if (body !== undefined) { data = JSON.stringify(body); h["Content-Type"] = h["Content-Type"] || "application/json"; }
  const inicio = Date.now();
  const res = await fetch(BASE + ruta, { method: metodo, headers: h, body: data, redirect: "manual" });
  const ms = Date.now() - inicio;
  const galletas = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const sid = galletas.map(c => c.split(";")[0]).find(c => /necutla\.sid=/.test(c));
  if (sesion && sid) sesion.cookie = sid;
  const buf = Buffer.from(await res.arrayBuffer());
  let json = null;
  try { json = JSON.parse(buf.toString("utf8")); } catch { /* no es JSON */ }
  return { status: res.status, headers: res.headers, json, texto: buf.toString("utf8"), buf, ms, galletas, sid };
}

const resultados = [];
async function prueba(hallazgo, nombre, fn) {
  try {
    const r = await fn();
    const ok = r === true || (r && r.ok === true);
    resultados.push({ hallazgo, nombre, ok, detalle: ok ? "" : (r && r.detalle) || JSON.stringify(r) });
  } catch (err) {
    resultados.push({ hallazgo, nombre, ok: false, detalle: `excepción: ${err.message}` });
  }
}
const no = detalle => ({ ok: false, detalle });
const espera = (cond, detalle) => (cond ? true : no(detalle));

async function loginAdmin(usuario, password, ip) {
  const sesion = {};
  const r = await pedir("POST", "/api/auth/login", { body: { usuario, password }, sesion, ip });
  if (r.status !== 200) throw new Error(`login ${usuario}: ${r.status} ${r.texto}`);
  return sesion;
}

// Contraseñas de prueba que cumplen las reglas (mayúscula, minúscula, número y carácter especial)
const PASS_CLIENTE = "Clave-cliente-larga-1";
let telSeq = 0;
// Cuerpo completo de registro; `extra` cambia o agrega campos
function datosCliente(nombre, extra = {}) {
  telSeq += 1;
  return {
    nombre, usuario: `${nombre}-${SUFIJO}`.toLowerCase().slice(0, 30), correo: `${nombre}-${SUFIJO}@prueba.local`,
    pais: "MX", telefono: `55${String(Date.now() % 1e4).padStart(4, "0")}${String(telSeq).padStart(4, "0")}`,
    password: PASS_CLIENTE, confirmar: PASS_CLIENTE, edad: true, ...extra
  };
}

// ================= Código por correo (plan 2026-10-30-codigo-por-correo-y-sesion-permanente) =================
const CARPETA_CORREOS = "/tmp/necutla-correos";
const CORREO_DE_USUARIO = new Map();

// Código del correo más reciente que se mandó a `correo` (modo 'archivo' de app/correo.php)
async function codigoDe(correo) {
  const para = `To: <${correo.toLowerCase()}>`;
  for (let i = 0; i < 40; i++) {
    const archivos = fs.existsSync(CARPETA_CORREOS) ? fs.readdirSync(CARPETA_CORREOS).map(f => `${CARPETA_CORREOS}/${f}`) : [];
    archivos.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    for (const f of archivos) {
      const txt = fs.readFileSync(f, "utf8");
      if (!txt.includes(para)) continue;
      const parte = txt.split(/Content-Type: text\/plain; charset=UTF-8\r?\nContent-Transfer-Encoding: base64\r?\n\r?\n/)[1] || "";
      const plano = Buffer.from(parte.split("--necutla-")[0].replace(/\s+/g, ""), "base64").toString("utf8");
      const m = plano.match(/^(\d{6})$/m);
      if (m) return m[1];
    }
    await new Promise(listo => setTimeout(listo, 100));
  }
  throw new Error(`no llegó el código de ${correo}`);
}

// Si la respuesta pide el código, lo lee del correo y lo manda con la misma sesión
async function conCodigo(r, proposito, correo, sesion) {
  if (r.status !== 200 || !r.json || !r.json.codigo) return r;
  return pedir("POST", `/api/clientes/${proposito}/codigo`, { body: { codigo: await codigoDe(correo) }, sesion });
}

async function registrarConDatos(body, sesion = {}) {
  CORREO_DE_USUARIO.set(String(body.usuario).toLowerCase(), String(body.correo).toLowerCase());
  const r = await pedir("POST", "/api/clientes/registro", { body, sesion });
  return conCodigo(r, "registro", body.correo, sesion);
}

async function registrarCliente(nombre) {
  const sesion = {};
  const body = datosCliente(nombre);
  const correo = body.correo;
  const r = await registrarConDatos(body, sesion);
  if (r.status !== 200) throw new Error(`registro ${nombre}: ${r.status} ${r.texto}`);
  return { sesion, correo };
}

// Entrar como cliente completo: contraseña y después el código del correo
async function entrarCliente(identificador, password, sesion = {}) {
  const r = await pedir("POST", "/api/clientes/login", { body: { identificador, password }, sesion });
  const id = String(identificador).toLowerCase();
  return conCodigo(r, "login", id.includes("@") ? id : CORREO_DE_USUARIO.get(id) || id, sesion);
}

const PNG_1x1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
const dataUrl = (tipo, buf) => `data:${tipo};base64,${buf.toString("base64")}`;

// JPEG con un segmento APP1 "Exif" con coordenadas GPS falsas (lo que guarda la cámara de un celular)
function jpegConExif() {
  const exif = Buffer.concat([Buffer.from("Exif\0\0MM\0*\0\0\0\x08", "latin1"), Buffer.from("GPSLatitude 19.4326 N GPSLongitude 99.1332 W")]);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, (exif.length + 2) >> 8, (exif.length + 2) & 255]), exif]);
  const resto = Buffer.from("/9j/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64").subarray(2);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app1, resto]);
}

// ================= Preparación =================
async function preparar() {
  const dueno = await loginAdmin(DUENO, DUENO_PASS);
  const tiendas = (await pedir("GET", "/api/admin/tiendas", { sesion: dueno })).json;
  if (!Array.isArray(tiendas) || tiendas.length < 2) throw new Error("Hacen falta al menos 2 tiendas en la base local.");
  const [A, B] = tiendas;
  const pass = "Clave-encargado-larga-1";
  for (const [nombre, tienda] of [["enc-a", A], ["enc-b", B]]) {
    const r = await pedir("POST", "/api/admin/usuarios", {
      body: { usuario: `${nombre}-${SUFIJO}`, password: pass, confirmar: pass, rol: "encargado", tiendas: [tienda.id] }, sesion: dueno });
    if (r.status !== 201) throw new Error(`crear ${nombre}: ${r.status} ${r.texto}`);
  }
  const encA = await loginAdmin(`enc-a-${SUFIJO}`, pass);
  const encB = await loginAdmin(`enc-b-${SUFIJO}`, pass);
  const producto = async (tienda, extra = {}) => {
    const r = await pedir("POST", "/api/admin/productos", {
      body: { stand_id: tienda.id, tipo: "producto", nombre: `Prueba seguridad ${SUFIJO}`, precio: 50, stock: 100, ...extra }, sesion: dueno });
    if (r.status !== 201) throw new Error(`producto: ${r.status} ${r.texto}`);
    return r.json.id;
  };
  const prodA = await producto(A);
  const prodB = await producto(B);
  const cli1 = await registrarCliente("cliente1");
  const cli2 = await registrarCliente("cliente2");
  comprador = (await registrarCliente("comprador")).sesion;
  return { dueno, encA, encB, A, B, prodA, prodB, cli1, cli2, pass, producto };
}

// ================= Pruebas =================
async function main() {
  const ctx = await preparar();
  const { dueno, encA, encB, A, B, prodA, prodB, cli1, cli2 } = ctx;

  // ---------- Archivos privados y recorrido de rutas ----------
  for (const ruta of ["/.env", "/plans/CLAUDE.md", "/server/index.js", "/package.json", "/.git/config", "/db/schema.sql",
    "/render.yaml", "/app/config.php", "/app/arranque.php", "/scripts/seguridad/ataques.js", "/%2e%2e/package.json", "/..%2fpackage.json", "/js/..%2f..%2fpackage.json",
    "/js/%2e%2e/%2e%2e/server/db.js", "/imagenes/..%5c..%5cpackage.json", "/node_modules/chart.js/package.json"]) {
    await prueba("—", `archivo privado ${ruta} no se sirve`, async () => {
      const r = await pedir("GET", ruta);
      return espera(r.status === 404 || r.status === 400 || r.status === 403, `${r.status}`) && espera(!/"dependencies"|DATABASE_URL|require\(|<\?php|'secreto'/.test(r.texto), "contenido filtrado");
    });
  }

  // ---------- Cabeceras ----------
  await prueba("—", "cabeceras base (CSP, nosniff, frame, referrer, sin X-Powered-By)", async () => {
    const h = (await pedir("GET", "/")).headers;
    const csp = h.get("content-security-policy") || "";
    return espera(/script-src 'self'/.test(csp) && /frame-ancestors 'none'/.test(csp) && /object-src 'none'/.test(csp)
      && h.get("x-content-type-options") === "nosniff" && h.get("referrer-policy") && !h.get("x-powered-by"), csp);
  });
  await prueba("H13", "Permissions-Policy presente", async () => {
    const h = (await pedir("GET", "/")).headers;
    return espera(/camera=\(\)/.test(h.get("permissions-policy") || ""), h.get("permissions-policy"));
  });
  await prueba("H13", "X-Robots-Tag noindex en /necutools.html y /api", async () => {
    const a = (await pedir("GET", "/necutools.html")).headers.get("x-robots-tag") || "";
    const b = (await pedir("GET", "/api/stands")).headers.get("x-robots-tag") || "";
    return espera(/noindex/.test(a) && /noindex/.test(b), `${a} | ${b}`);
  });
  await prueba("H13", "Cache-Control no-store en /api/admin y /api/auth", async () => {
    const a = (await pedir("GET", "/api/admin/yo", { sesion: dueno })).headers.get("cache-control") || "";
    const b = (await pedir("GET", "/api/auth/sesion", { sesion: dueno })).headers.get("cache-control") || "";
    return espera(/no-store/.test(a) && /no-store/.test(b), `${a} | ${b}`);
  });
  await prueba("—", "TRACE no se acepta", async () => {
    const r = await pedir("TRACE", "/api/stands").catch(() => ({ status: 405 }));
    return espera(r.status >= 400, r.status);
  });

  // ---------- Inyección SQL ----------
  const cargasSql = ["' OR '1'='1", "1 OR 1=1", "1; DROP TABLE productos;--", "'; SELECT pg_sleep(3);--", "1)) UNION SELECT usuario, password_hash FROM admins--"];
  for (const carga of cargasSql) {
    const c = encodeURIComponent(carga);
    for (const ruta of [`/api/buscar?q=${c}`, `/api/stands/${c}`, `/api/vitrina?tienda=${c}`, `/api/productos/${c}`,
      `/api/productos/${prodA}/resenas?orden=${c}`, `/api/productos/${prodA}/resenas?pagina=${c}`]) {
      await prueba("—", `SQLi GET ${ruta.slice(0, 70)}`, async () => {
        const r = await pedir("GET", ruta);
        return espera(r.status < 500 && r.ms < 2500 && !/password_hash|\$2[aby]\$/.test(r.texto), `${r.status} ${r.ms}ms`);
      });
    }
    for (const ruta of [`/api/admin/productos?stand=${c}`, `/api/admin/pedidos?estado=${c}`, `/api/admin/pedidos?tienda=${c}`,
      `/api/admin/resumen?dias=${c}`, `/api/admin/ofertas?stand=${c}`, `/api/admin/resenas?stand=${c}`]) {
      await prueba("—", `SQLi admin ${ruta.slice(0, 60)}`, async () => {
        const r = await pedir("GET", ruta, { sesion: dueno });
        return espera(r.status < 500 && r.ms < 2500, `${r.status} ${r.ms}ms`);
      });
    }
    await prueba("—", `SQLi en login admin (${carga.slice(0, 20)})`, async () => {
      const r = await pedir("POST", "/api/auth/login", { body: { usuario: carga, password: carga } });
      return espera(r.status === 401 || r.status === 400, r.status);
    });
    await prueba("—", `SQLi en login cliente (${carga.slice(0, 20)})`, async () => {
      const r = await pedir("POST", "/api/clientes/login", { body: { correo: carga, password: carga } });
      return espera(r.status === 401 || r.status === 400, r.status);
    });
  }
  await prueba("—", "la tabla productos sigue existiendo después de las cargas", async () => {
    const r = await pedir("GET", `/api/productos/${prodA}`);
    return espera(r.status === 200, r.status);
  });

  // ---------- Autenticación requerida ----------
  for (const [m, ruta] of [["GET", "/api/admin/yo"], ["GET", "/api/admin/tiendas"], ["GET", "/api/admin/productos"],
    ["GET", "/api/admin/usuarios"], ["GET", "/api/admin/pedidos"], ["GET", "/api/admin/resumen"], ["GET", "/api/admin/resenas"],
    ["POST", "/api/admin/productos"], ["PUT", `/api/admin/productos/${prodA}`], ["DELETE", `/api/admin/productos/${prodA}`],
    ["PUT", "/api/admin/pedidos/1"], ["PUT", "/api/admin/mi-password"], ["POST", "/api/admin/usuarios"],
    ["PUT", `/api/productos/${prodA}/resena`], ["DELETE", `/api/productos/${prodA}/resena`]]) {
    await prueba("—", `401 sin sesión: ${m} ${ruta}`, async () => {
      const r = await pedir(m, ruta, { body: m === "GET" ? undefined : {} });
      return espera(r.status === 401, r.status);
    });
  }
  await prueba("—", "un cliente no entra a Necutools", async () => {
    const r = await pedir("GET", "/api/admin/yo", { sesion: cli1.sesion });
    return espera(r.status === 401, r.status);
  });
  await prueba("—", "cookie de sesión inventada o alterada no da acceso", async () => {
    const r = await pedir("GET", "/api/admin/yo", { sesion: { cookie: dueno.cookie.replace(/.$/, c => (c === "A" ? "B" : "A")) } });
    return espera(r.status === 401, r.status);
  });

  // ---------- Control de acceso entre encargados (IDOR) ----------
  const idor = [
    ["GET", `/api/admin/productos?stand=${B.id}`],
    ["PUT", `/api/admin/productos/${prodB}`, { stand_id: B.id, tipo: "producto", nombre: "x", precio: 1 }],
    ["DELETE", `/api/admin/productos/${prodB}`],
    ["PUT", `/api/admin/productos/${prodA}`, { stand_id: B.id, tipo: "producto", nombre: "mover", precio: 1 }],
    ["POST", "/api/admin/productos", { stand_id: B.id, tipo: "producto", nombre: "ajeno", precio: 1 }],
    ["PUT", `/api/admin/tiendas/${B.id}`, { nombre: B.nombre }],
    ["POST", `/api/admin/tiendas/${B.id}/subcategorias`, { nombre: "ajena" }],
    ["POST", "/api/admin/ofertas", { stand_id: B.id, tipo: "porcentaje", aplica: "tienda", valor: 10, titulo: "x", dias: [1] }],
    ["GET", `/api/admin/ofertas?stand=${B.id}`],
    ["GET", `/api/admin/resenas?stand=${B.id}`],
    ["GET", `/api/admin/pedidos?tienda=${B.id}`],
    ["GET", `/api/admin/resumen?dias=7&tienda=${B.id}`],
    ["GET", "/api/admin/usuarios"],
    ["POST", "/api/admin/usuarios", { usuario: `escala-${SUFIJO}`, password: "x".repeat(14), rol: "dueno" }],
    ["GET", "/api/admin/promociones"],
    ["POST", "/api/admin/tiendas", { nombre: `Tienda ${SUFIJO}` }],
    ["DELETE", `/api/admin/tiendas/${A.id}`]
  ];
  for (const [m, ruta, body] of idor) {
    await prueba("—", `encargado A no puede: ${m} ${ruta}`, async () => {
      const r = await pedir(m, ruta, { body, sesion: encA });
      return espera(r.status === 403, `${r.status} ${r.texto.slice(0, 80)}`);
    });
  }
  await prueba("—", "encargado A no ve productos de B en su lista", async () => {
    const r = await pedir("GET", "/api/admin/productos", { sesion: encA });
    return espera(r.status === 200 && r.json.every(p => p.stand_id === A.id), r.status);
  });
  await prueba("—", "oferta de A con producto de B se rechaza", async () => {
    const r = await pedir("POST", "/api/admin/ofertas", { sesion: encA,
      body: { stand_id: A.id, tipo: "porcentaje", aplica: "producto", producto_id: prodB, valor: 10, titulo: "x", dias: [1] } });
    return espera(r.status === 400, r.status);
  });
  await prueba("—", "encargado no ve pedidos de paquetes ni de otras tiendas", async () => {
    await pedir("POST", "/api/pedidos", { body: { clave: `tienda-${B.id}`, items: [{ tipo: "producto", id: prodB, cantidad: 1 }] } });
    const r = await pedir("GET", "/api/admin/pedidos", { sesion: encA });
    return espera(r.status === 200 && r.json.pedidos.every(p => p.stand_id === A.id), r.status);
  });
  await prueba("—", "encargado B no cambia el estado de un pedido de A", async () => {
    const p = await pedir("POST", "/api/pedidos", { body: { clave: `tienda-${A.id}`, items: [{ tipo: "producto", id: prodA, cantidad: 3 }] } });
    const r = await pedir("PUT", `/api/admin/pedidos/${p.json.id}`, { body: { estado: "pagado" }, sesion: encB });
    return espera(r.status === 403, r.status);
  });
  await prueba("—", "encargado A no agrega un producto de B a su pedido", async () => {
    const p = await pedir("POST", "/api/pedidos", { body: { clave: `tienda-${A.id}`, items: [{ tipo: "producto", id: prodA, cantidad: 4 }] } });
    const r = await pedir("PUT", `/api/admin/pedidos/${p.json.id}/items`, {
      body: { items: [{ tipo: "producto", id: prodA, cantidad: 1 }, { tipo: "producto", id: prodB, cantidad: 1 }] }, sesion: encA });
    return espera(r.status === 403, r.status);
  });
  await prueba("—", "pagar más piezas de las que hay en stock → 409 y el stock no cambia", async () => {
    const p = await pedir("POST", "/api/pedidos", { body: { clave: `tienda-${A.id}`, items: [{ tipo: "producto", id: prodA, cantidad: 5 }] } });
    await pedir("PUT", `/api/admin/pedidos/${p.json.id}/items`, { body: { items: [{ tipo: "producto", id: prodA, cantidad: 30 }] }, sesion: encA });
    const antes = (await pedir("GET", "/api/admin/productos", { sesion: dueno })).json.find(x => x.id === prodA).stock;
    await pedir("PUT", `/api/admin/productos/${prodA}`, { sesion: dueno, body: { stand_id: A.id, tipo: "producto", nombre: `Prueba seguridad ${SUFIJO}`, precio: 50, stock: 5 } });
    const r = await pedir("PUT", `/api/admin/pedidos/${p.json.id}`, { body: { estado: "pagado" }, sesion: encA });
    const despues = (await pedir("GET", "/api/admin/productos", { sesion: dueno })).json.find(x => x.id === prodA).stock;
    await pedir("PUT", `/api/admin/productos/${prodA}`, { sesion: dueno, body: { stand_id: A.id, tipo: "producto", nombre: `Prueba seguridad ${SUFIJO}`, precio: 50, stock: antes } });
    return espera(r.status === 409 && despues === 5, `${r.status} stock ${despues}`);
  });
  await prueba("—", "la lista de usuarios no devuelve hashes", async () => {
    const r = await pedir("GET", "/api/admin/usuarios", { sesion: dueno });
    return espera(r.status === 200 && !/password|\$2[aby]\$/.test(r.texto), r.status);
  });

  // ---------- Opiniones: cada cliente solo la suya ----------
  await prueba("—", "un cliente no puede editar ni borrar la opinión de otro", async () => {
    await pedir("PUT", `/api/productos/${prodA}/resena`, { body: { calificacion: 5, comentario: "Muy bueno, lo recomiendo" }, sesion: cli1.sesion });
    await pedir("DELETE", `/api/productos/${prodA}/resena`, { sesion: cli2.sesion });
    const r = await pedir("GET", `/api/productos/${prodA}/resenas`);
    return espera(r.json.resenas.some(x => x.comentario === "Muy bueno, lo recomiendo"), r.texto.slice(0, 120));
  });
  await prueba("—", "las opiniones públicas no muestran correos", async () => {
    const r = await pedir("GET", `/api/productos/${prodA}/resenas`);
    return espera(!r.texto.includes(cli1.correo) && !/@prueba\.local/.test(r.texto), "aparece un correo");
  });
  await prueba("—", "asignación masiva: el registro ignora rol, activo e id", async () => {
    const sesion = {};
    const crudo = JSON.stringify(datosCliente("masivo")).slice(0, -1) + "," +
      `"id":1,"activo":true,"rol":"dueno","adminId":1,"__proto__":{"adminId":1},"constructor":{"prototype":{"adminId":1}}}`;
    await pedir("POST", "/api/clientes/registro", { sesion, crudo, headers: { "Content-Type": "application/json" } });
    const r = await pedir("GET", "/api/admin/yo", { sesion });
    return espera(r.status === 401, r.status);
  });

  // ---------- CSRF ----------
  for (const [nombre, origin, extra] of [["sin Origin", null], ["Origin ajeno", "https://evil.example"], ["Origin null", "null"],
    ["Origin ajeno con formulario", "https://evil.example", { "Content-Type": "application/x-www-form-urlencoded" }]]) {
    await prueba("—", `CSRF ${nombre} → 403`, async () => {
      const r = await pedir("PUT", `/api/admin/productos/${prodA}`, { sesion: dueno, origin, headers: extra || {},
        body: { stand_id: A.id, tipo: "producto", nombre: "csrf", precio: 1 } });
      return espera(r.status === 403, r.status);
    });
  }
  await prueba("H4", "Sec-Fetch-Site cross-site → 403 aunque el Origin coincida", async () => {
    const r = await pedir("POST", "/api/clientes/logout", { sesion: {}, headers: { "Sec-Fetch-Site": "cross-site" } });
    return espera(r.status === 403, r.status);
  });

  // ---------- Sesión ----------
  await prueba("—", "fijación de sesión: el login cambia el id de sesión", async () => {
    const anon = {};
    await pedir("POST", "/api/clientes/logout", { sesion: anon });
    const fijada = { cookie: "necutla.sid=s%3Afijada.firmafalsa" };
    await pedir("POST", "/api/auth/login", { body: { usuario: DUENO, password: DUENO_PASS }, sesion: fijada });
    return espera(fijada.cookie && !fijada.cookie.includes("fijada"), fijada.cookie);
  });
  await prueba("—", "cookie HttpOnly y SameSite=Strict", async () => {
    const r = await pedir("POST", "/api/auth/login", { body: { usuario: DUENO, password: DUENO_PASS } });
    const c = r.galletas.find(x => /necutla\.sid/.test(x)) || "";
    return espera(/HttpOnly/i.test(c) && /SameSite=Strict/i.test(c), c);
  });
  await prueba("—", "después del logout la cookie vieja ya no sirve", async () => {
    const s = await loginAdmin(DUENO, DUENO_PASS);
    const vieja = { cookie: s.cookie };
    await pedir("POST", "/api/auth/logout", { sesion: s });
    const r = await pedir("GET", "/api/admin/yo", { sesion: vieja });
    return espera(r.status === 401, r.status);
  });
  await prueba("H9", "cerrar Necutools con un cliente en el mismo navegador cambia el id de sesión", async () => {
    const s = {};
    await entrarCliente(cli1.correo, PASS_CLIENTE, s);
    await pedir("POST", "/api/auth/login", { body: { usuario: DUENO, password: DUENO_PASS }, sesion: s });
    const antes = s.cookie;
    await pedir("POST", "/api/auth/logout", { sesion: s });
    const r = await pedir("GET", "/api/admin/yo", { sesion: { cookie: antes } });
    return espera(s.cookie !== antes && r.status === 401, `misma cookie: ${s.cookie === antes}, vieja: ${r.status}`);
  });
  await prueba("—", "admin desactivado pierde la sesión al instante", async () => {
    const usuarios = (await pedir("GET", "/api/admin/usuarios", { sesion: dueno })).json;
    const u = usuarios.find(x => x.usuario === `enc-b-${SUFIJO}`);
    await pedir("PUT", `/api/admin/usuarios/${u.id}`, { sesion: dueno, body: { rol: "encargado", activo: false, tiendas: [B.id] } });
    const r = await pedir("GET", "/api/admin/yo", { sesion: encB });
    return espera(r.status === 401, r.status);
  });

  // ---------- Fuerza bruta ----------
  await prueba("—", "login admin: 429 tras 10 fallos desde la misma IP", async () => {
    const ip = nuevaIp();
    let ultimo;
    for (let i = 0; i < 11; i++) ultimo = await pedir("POST", "/api/auth/login", { ip, body: { usuario: `ip-${i}-${SUFIJO}`, password: `mala-${i}` } });
    return espera(ultimo.status === 429, ultimo.status);
  });
  await prueba("H7", "login admin: 15 fallos desde 15 IPs contra la misma cuenta se frenan (también con la contraseña correcta)", async () => {
    const usuario = `frenado-${SUFIJO}`;
    await pedir("POST", "/api/admin/usuarios", { sesion: dueno, body: { usuario, password: ctx.pass, confirmar: ctx.pass, rol: "encargado", tiendas: [A.id] } });
    let ultimo;
    for (let i = 0; i < 15; i++) ultimo = await pedir("POST", "/api/auth/login", { body: { usuario, password: `mala-${i}` } });
    const correcta = await pedir("POST", "/api/auth/login", { body: { usuario, password: ctx.pass } });
    return espera(ultimo.status === 429 && correcta.status === 429, `último: ${ultimo.status}, correcta: ${correcta.status}`);
  });
  await prueba("H7", "una cuenta que no existe se frena igual (no revela cuáles existen)", async () => {
    let ultimo;
    for (let i = 0; i < 11; i++) ultimo = await pedir("POST", "/api/auth/login", { body: { usuario: `fantasma-${SUFIJO}`, password: `mala-${i}` } });
    return espera(ultimo.status === 429, `último: ${ultimo.status}`);
  });
  await prueba("H7", "login cliente: 15 fallos desde 15 IPs contra el mismo correo se frenan", async () => {
    let ultimo;
    for (let i = 0; i < 15; i++) ultimo = await pedir("POST", "/api/clientes/login", { body: { correo: cli2.correo, password: `mala-${i}` } });
    return espera(ultimo.status === 429, `último: ${ultimo.status}`);
  });
  await prueba("H7", "cambiar contraseña: adivinar la actual se frena", async () => {
    const s = await loginAdmin(`enc-a-${SUFIJO}`, ctx.pass, nuevaIp());
    // Cada intento desde otra IP: el freno es por cuenta, no por IP
    let ultimo;
    for (let i = 0; i < 12; i++) ultimo = await pedir("PUT", "/api/admin/mi-password", { sesion: s, body: { actual: `mala-${i}`, nueva: "Otra-clave-larga-123", confirmar: "Otra-clave-larga-123" } });
    return espera(ultimo.status === 429, `último: ${ultimo.status}`);
  });
  await prueba("H16", "registro con correo repetido cuenta para el límite (bcrypt sin freno)", async () => {
    const ip = nuevaIp();
    let ultimo;
    for (let i = 0; i < 32; i++) ultimo = await pedir("POST", "/api/clientes/registro", { ip, body: datosCliente("repetido", { correo: cli1.correo }) });
    return espera(ultimo.status === 429, `último: ${ultimo.status}`);
  });
  await prueba("—", "login: mismo tiempo con usuario existente y no existente", async () => {
    const t = async usuario => { let s = 0; for (let i = 0; i < 3; i++) s += (await pedir("POST", "/api/auth/login", { body: { usuario, password: "mala-clave" } })).ms; return s / 3; };
    const a = await t(DUENO); const b = await t(`no-existe-${SUFIJO}`);
    return espera(Math.abs(a - b) < 120, `${Math.round(a)}ms vs ${Math.round(b)}ms`);
  });

  // ---------- Verificación en dos pasos ----------
  await (async () => {
    const usuario = `tfa-${SUFIJO}`;
    await pedir("POST", "/api/admin/usuarios", { sesion: dueno, body: { usuario, password: ctx.pass, confirmar: ctx.pass, rol: "encargado", tiendas: [A.id] } });
    const s = await loginAdmin(usuario, ctx.pass);
    let secreto, respaldo, pasoActivacion;
    await prueba("H14", "2 pasos: iniciar pide la contraseña", async () => {
      const r = await pedir("POST", "/api/admin/2fa/iniciar", { sesion: s, body: { password: "otra-mala-123" } });
      return espera(r.status === 400, r.status);
    });
    await prueba("H14", "2 pasos: un código equivocado no la activa", async () => {
      const ini = await pedir("POST", "/api/admin/2fa/iniciar", { sesion: s, body: { password: ctx.pass } });
      secreto = ini.json && ini.json.secreto;
      const r = await pedir("POST", "/api/admin/2fa/activar", { sesion: s, body: { codigo: "000000" } });
      return espera(secreto && /^otpauth:\/\/totp\//.test(ini.json.enlace) && r.status === 400, `${ini.status} ${r.status}`);
    });
    await prueba("H14", "2 pasos: se activa con el código correcto y entrega 8 códigos de respaldo", async () => {
      pasoActivacion = totp.pasoActual();
      const r = await pedir("POST", "/api/admin/2fa/activar", { sesion: s, body: { codigo: totp.codigoDe(secreto, pasoActivacion) } });
      respaldo = r.json && r.json.respaldo;
      return espera(r.status === 200 && Array.isArray(respaldo) && respaldo.length === 8, `${r.status} ${r.texto.slice(0, 80)}`);
    });
    await prueba("H14", "2 pasos: con la contraseña sola no se entra", async () => {
      const p = {};
      const r = await pedir("POST", "/api/auth/login", { sesion: p, body: { usuario, password: ctx.pass } });
      const yo = await pedir("GET", "/api/admin/yo", { sesion: p });
      return espera(r.status === 200 && r.json.segundoPaso === true && yo.status === 401, `${r.texto} ${yo.status}`);
    });
    await prueba("H14", "2 pasos: código equivocado → 401", async () => {
      const p = {};
      await pedir("POST", "/api/auth/login", { sesion: p, body: { usuario, password: ctx.pass } });
      const r = await pedir("POST", "/api/auth/login/codigo", { sesion: p, body: { codigo: "123456" } });
      return espera(r.status === 401, r.status);
    });
    await prueba("H14", "2 pasos: el código sin haber puesto la contraseña → 401", async () => {
      const r = await pedir("POST", "/api/auth/login/codigo", { sesion: {}, body: { codigo: totp.codigoDe(secreto, totp.pasoActual()) } });
      return espera(r.status === 401, r.status);
    });
    await prueba("H14", "2 pasos: el mismo código de la app no sirve dos veces", async () => {
      const p = {};
      await pedir("POST", "/api/auth/login", { sesion: p, body: { usuario, password: ctx.pass } });
      // El código exacto de la activación (si ya pasaron 30 s, el del paso actual es otro y sí vale)
      const r = await pedir("POST", "/api/auth/login/codigo", { sesion: p, body: { codigo: totp.codigoDe(secreto, pasoActivacion) } });
      return espera(r.status === 401, `${r.status}: el código de la activación se aceptó otra vez`);
    });
    await prueba("H14", "2 pasos: un código de respaldo sirve una sola vez", async () => {
      const p = {};
      await pedir("POST", "/api/auth/login", { sesion: p, body: { usuario, password: ctx.pass } });
      const a = await pedir("POST", "/api/auth/login/codigo", { sesion: p, body: { codigo: respaldo[0] } });
      const yo = await pedir("GET", "/api/admin/yo", { sesion: p });
      const q = {};
      await pedir("POST", "/api/auth/login", { sesion: q, body: { usuario, password: ctx.pass } });
      const b = await pedir("POST", "/api/auth/login/codigo", { sesion: q, body: { codigo: respaldo[0] } });
      return espera(a.status === 200 && yo.status === 200 && b.status === 401, `${a.status} ${yo.status} ${b.status}`);
    });
    await prueba("H14", "2 pasos: desactivar pide contraseña y código", async () => {
      const p = {};
      await pedir("POST", "/api/auth/login", { sesion: p, body: { usuario, password: ctx.pass } });
      await pedir("POST", "/api/auth/login/codigo", { sesion: p, body: { codigo: respaldo[1] } });
      const r = await pedir("POST", "/api/admin/2fa/desactivar", { sesion: p, body: { password: ctx.pass, codigo: "000000" } });
      return espera(r.status === 400, r.status);
    });
    await prueba("H14", "2 pasos: un dueño se la quita a otro usuario y vuelve a entrar solo con contraseña", async () => {
      const lista = (await pedir("GET", "/api/admin/usuarios", { sesion: dueno })).json;
      const u = lista.find(x => x.usuario === usuario);
      const r = await pedir("PUT", `/api/admin/usuarios/${u.id}`, { sesion: dueno, body: { rol: "encargado", activo: true, tiendas: [A.id], quitar_2fa: true } });
      const p = {};
      const l = await pedir("POST", "/api/auth/login", { sesion: p, body: { usuario, password: ctx.pass } });
      return espera(u.totp_activo === true && r.status === 200 && l.json && l.json.autenticado === true, `${u.totp_activo} ${r.status} ${l.texto}`);
    });
  })();

  // ---------- Contraseñas ----------
  await prueba("H12", "contraseñas de más de 72 bytes se rechazan (bcrypt ignora el resto)", async () => {
    const base = "a".repeat(72);
    const r = await pedir("POST", "/api/admin/usuarios", { sesion: dueno, body: { usuario: `largo-${SUFIJO}`, password: `${base}Uno-1`, confirmar: `${base}Uno-1`, rol: "encargado", tiendas: [A.id] } });
    if (r.status !== 201) return true;
    const l = await pedir("POST", "/api/auth/login", { body: { usuario: `largo-${SUFIJO}`, password: `${base}otra-distinta` } });
    await pedir("PUT", `/api/admin/usuarios/${r.json.id}`, { sesion: dueno, body: { rol: "encargado", activo: false, tiendas: [] } });
    return no(`se creó y se entra con otra contraseña: ${l.status}`);
  });
  for (const password of ["12345678", "1234567890", "contraseña123", "aaaaaaaaaaaa", `comun-${SUFIJO}-clave`]) {
    await prueba("H12", `cliente: contraseña débil "${password}" se rechaza`, async () => {
      const r = await pedir("POST", "/api/clientes/registro", { body: datosCliente("comun", { password, confirmar: password }) });
      return espera(r.status === 400 && /contraseña/i.test(r.json && r.json.error), `${r.status} ${r.texto}`);
    });
  }
  await prueba("H12", "admin: contraseña con el nombre de usuario se rechaza", async () => {
    const r = await pedir("POST", "/api/admin/usuarios", { sesion: dueno, body: { usuario: `debil-${SUFIJO}`, password: `Debil-${SUFIJO}-2026!`, confirmar: `Debil-${SUFIJO}-2026!`, rol: "encargado", tiendas: [A.id] } });
    return espera(r.status === 400 && /usuario/.test(r.json && r.json.error), `${r.status} ${r.texto}`);
  });

  // ---------- Cuerpos enormes y JSON roto ----------
  const enorme = JSON.stringify({ clave: `tienda-${A.id}`, items: [], relleno: "x".repeat(1900 * 1024) });
  for (const ruta of ["/api/pedidos", "/api/clientes/registro", "/api/carrito/precios", "/api/auth/login"]) {
    await prueba("H4", `cuerpo de 1.9 MB en ${ruta} → 413`, async () => {
      const r = await pedir("POST", ruta, { crudo: enorme, headers: { "Content-Type": "application/json" } });
      return espera(r.status === 413, `${r.status} en ${r.ms}ms`);
    });
  }
  await prueba("—", "JSON mal formado → 400 sin detalles internos", async () => {
    const r = await pedir("POST", "/api/carrito/precios", { crudo: "{\"items\": [", headers: { "Content-Type": "application/json" } });
    return espera(r.status === 400 && !/at |node_modules|stack/i.test(r.texto), `${r.status} ${r.texto.slice(0, 80)}`);
  });
  await prueba("—", "números fuera de rango en el carrito → 400", async () => {
    const malos = [[{ tipo: "producto", id: prodA, cantidad: -1 }], [{ tipo: "producto", id: prodA, cantidad: 1e9 }],
      [{ tipo: "producto", id: 99999999999, cantidad: 1 }], [{ tipo: "otro", id: prodA, cantidad: 1 }], "no-lista"];
    for (const items of malos) {
      const r = await pedir("POST", "/api/carrito/precios", { body: { items } });
      if (r.status !== 400) return no(`${JSON.stringify(items)} → ${r.status}`);
    }
    return true;
  });
  await prueba("—", "precio enorme o negativo → 400", async () => {
    for (const precio of [-5, 1e20, "NaN", "1e400"]) {
      const r = await pedir("POST", "/api/admin/productos", { sesion: dueno, body: { stand_id: A.id, tipo: "producto", nombre: "p", precio, stock: 1 } });
      if (r.status !== 400) return no(`${precio} → ${r.status}`);
    }
    return true;
  });

  // ---------- Pedidos falsos ----------
  await prueba("—", "el pedido ignora el precio que manda el navegador", async () => {
    const r = await pedir("POST", "/api/pedidos", { body: { clave: `tienda-${A.id}`, items: [{ tipo: "producto", id: prodA, cantidad: 6, precio: 0.01 }], total: 0.01 } });
    const l = await pedir("GET", `/api/admin/pedidos?tienda=${A.id}`, { sesion: dueno });
    const p = l.json.pedidos.find(x => x.id === r.json.id);
    return espera(p && p.total === 300, JSON.stringify(p));
  });
  await prueba("—", "pedidos: 429 tras 40 en una hora desde la misma IP", async () => {
    const ip = nuevaIp();
    let ultimo;
    for (let i = 0; i < 41; i++) ultimo = await pedir("POST", "/api/pedidos", { ip, body: { clave: `tienda-${A.id}`, items: [{ tipo: "producto", id: prodA, cantidad: 1 }] } });
    return espera(ultimo.status === 429, ultimo.status);
  });
  await prueba("H5", "pedido con 60 productos × 99 piezas se rechaza", async () => {
    const items = [{ tipo: "producto", id: prodA, cantidad: 99 }];
    const r = await pedir("POST", "/api/pedidos", { body: { clave: `tienda-${A.id}`, items } });
    return espera(r.status === 400, `${r.status}: un pedido de 99 piezas se guardó`);
  });
  await prueba("H5", "el mismo pedido dos veces seguidas desde la misma IP no se duplica", async () => {
    const ip = nuevaIp();
    const body = { clave: `tienda-${A.id}`, items: [{ tipo: "producto", id: prodA, cantidad: 2 }] };
    const a = await pedir("POST", "/api/pedidos", { ip, body });
    const b = await pedir("POST", "/api/pedidos", { ip, body });
    return espera(a.json && b.json && a.json.id === b.json.id, `${a.json && a.json.id} y ${b.json && b.json.id}`);
  });

  // ---------- Compra con cuenta y números de WhatsApp (plan 2026-11-05-resurtir-y-compra-con-cuenta) ----------
  const pedidoDe = (tienda, id, cantidad) => ({ clave: `tienda-${tienda.id}`, items: [{ tipo: "producto", id, cantidad }] });
  const conNumeros = o => JSON.stringify(o).match(/"whatsapp":\[("|\d)/) !== null;
  await prueba("CTA", "pedido sin cuenta → 401 y no se guarda", async () => {
    const antes = (await pedir("GET", `/api/admin/pedidos?tienda=${A.id}`, { sesion: dueno })).json.total;
    const r = await pedir("POST", "/api/pedidos", { body: pedidoDe(A, prodA, 7), sinSesion: true });
    const despues = (await pedir("GET", `/api/admin/pedidos?tienda=${A.id}`, { sesion: dueno })).json.total;
    return espera(r.status === 401 && antes === despues, `${r.status}, ${antes} → ${despues}`);
  });
  await prueba("CTA", "sin cuenta, ninguna ruta pública entrega números de WhatsApp", async () => {
    const servicio = await ctx.producto(A, { tipo: "servicio", precio_modo: "fijo", stock: undefined });
    const rutas = [["GET", "/api/config"], ["GET", `/api/stands/${A.slug}`], ["GET", `/api/productos/${servicio}`]];
    const respuestas = [];
    for (const [m, ruta] of rutas) respuestas.push(await pedir(m, ruta));
    respuestas.push(await pedir("POST", "/api/carrito/precios", { body: { items: [{ tipo: "producto", id: prodA, cantidad: 1 }] } }));
    return espera(respuestas.every(r => r.status === 200 && !conNumeros(r.json) && !/52\d{10}/.test(r.texto)), respuestas.map(r => r.status).join());
  });
  await prueba("CTA", "con cuenta sí llegan los números", async () => {
    const r = await pedir("POST", "/api/carrito/precios", { sesion: comprador, body: { items: [{ tipo: "producto", id: prodA, cantidad: 1 }] } });
    return espera(conNumeros(r.json), r.texto.slice(0, 200));
  });
  await prueba("CTA", "lo que trae números no se guarda en caché", async () => {
    const respuestas = [await pedir("GET", "/api/config"), await pedir("GET", `/api/stands/${A.slug}`), await pedir("GET", `/api/productos/${prodA}`)];
    return espera(respuestas.every(r => r.headers.get("cache-control") === "no-store"), respuestas.map(r => r.headers.get("cache-control")).join());
  });
  await prueba("CTA", "la tienda ve el nombre del cliente, no su correo ni su teléfono", async () => {
    const c = datosCliente("privado");
    const sesion = {};
    await registrarConDatos(c, sesion);
    const p = await pedir("POST", "/api/pedidos", { sesion, body: pedidoDe(A, prodA, 8) });
    const r = await pedir("GET", `/api/admin/pedidos?tienda=${A.id}`, { sesion: encA });
    const fila = r.json.pedidos.find(x => x.id === p.json.id);
    return espera(fila && fila.cliente === c.nombre && !r.texto.includes(c.correo) && !r.texto.includes(c.telefono), r.texto.slice(0, 200));
  });
  await prueba("CTA", "dos cuentas en la misma red con el mismo carrito son 2 pedidos", async () => {
    const ip = nuevaIp();
    const otro = (await registrarCliente("vecino")).sesion;
    const a = await pedir("POST", "/api/pedidos", { ip, sesion: comprador, body: pedidoDe(A, prodA, 9) });
    const b = await pedir("POST", "/api/pedidos", { ip, sesion: otro, body: pedidoDe(A, prodA, 9) });
    return espera(a.json.id && b.json.id && a.json.id !== b.json.id, `${a.json.id} y ${b.json.id}`);
  });
  await prueba("CTA", "pedidos: 429 tras 20 en una hora con la misma cuenta", async () => {
    const sesion = (await registrarCliente("muchos")).sesion;
    const estados = [];
    for (let i = 1; i <= 21; i++) estados.push((await pedir("POST", "/api/pedidos", { sesion, body: pedidoDe(A, prodA, i) })).status);
    return espera(estados.slice(0, 20).every(x => x === 201) && estados[20] === 429, estados.join());
  });
  await prueba("CTA", "al eliminar la cuenta, sus pedidos se quedan sin cliente", async () => {
    const c = await registrarCliente("adios");
    const p = await pedir("POST", "/api/pedidos", { sesion: c.sesion, body: pedidoDe(A, prodA, 11) });
    await pedir("POST", "/api/clientes/eliminar", { sesion: c.sesion });
    const fin = await pedir("POST", "/api/clientes/eliminar/codigo", { sesion: c.sesion, body: { codigo: await codigoDe(c.correo) } });
    const r = await pedir("GET", `/api/admin/pedidos?tienda=${A.id}`, { sesion: dueno });
    const fila = r.json.pedidos.find(x => x.id === p.json.id);
    return espera(fin.status === 200 && fila && fila.cliente === null, `${fin.status} ${JSON.stringify(fila)}`);
  });

  // ---------- Por resurtir ----------
  const deCatalogo = async id => (await pedir("GET", "/api/admin/productos", { sesion: dueno })).json.find(x => x.id === id);
  await prueba("RES", "stock igual al mínimo sale; con una pieza más, no", async () => {
    const igual = await ctx.producto(A, { stock: 5, stock_minimo: 5 });
    const arriba = await ctx.producto(A, { stock: 6, stock_minimo: 5 });
    return espera((await deCatalogo(igual)).por_resurtir === true && (await deCatalogo(arriba)).por_resurtir === false, "por_resurtir mal");
  });
  await prueba("RES", "agotado sin mínimo sale; oculto no", async () => {
    const agotado = await ctx.producto(A, { stock: 0 });
    const oculto = await ctx.producto(A, { stock: 0, visible: false });
    return espera((await deCatalogo(agotado)).por_resurtir === true && (await deCatalogo(oculto)).por_resurtir === false, "por_resurtir mal");
  });
  await prueba("RES", "con colores se compara cada color y dice cuál falta", async () => {
    const id = await ctx.producto(A, { stock: 50, stock_minimo: 3 });
    for (const [nombre, stock] of [["Rojo", 2], ["Azul", 40]]) {
      await pedir("POST", `/api/admin/productos/${id}/colores`, { sesion: dueno, body: { nombre, hex: "#112233", stock, imagen: dataUrl("image/png", PNG_1x1) } });
    }
    const p = await deCatalogo(id);
    return espera(p.por_resurtir === true && JSON.stringify(p.colores_por_resurtir) === '[{"nombre":"Rojo","stock":2}]', JSON.stringify(p.colores_por_resurtir));
  });
  await prueba("RES", "mínimo inválido → 400", async () => {
    const r = await pedir("POST", "/api/admin/productos", { sesion: dueno, body: { stand_id: A.id, tipo: "producto", nombre: "m", precio: 1, stock: 1, stock_minimo: -1 } });
    return espera(r.status === 400, r.status);
  });

  // ---------- Imágenes ----------
  await prueba("—", "imagen falsa (texto con cabecera PNG declarada) → 400", async () => {
    const r = await pedir("POST", "/api/admin/productos", { sesion: dueno, body: { stand_id: A.id, tipo: "producto", nombre: "img", precio: 1, stock: 1,
      imagen: dataUrl("image/png", Buffer.from("<script>alert(1)</script>")) } });
    return espera(r.status === 400, r.status);
  });
  await prueba("—", "SVG no se acepta", async () => {
    const r = await pedir("POST", "/api/admin/productos", { sesion: dueno, body: { stand_id: A.id, tipo: "producto", nombre: "svg", precio: 1, stock: 1,
      imagen: `data:image/svg+xml;base64,${Buffer.from("<svg onload=alert(1)>").toString("base64")}` } });
    return espera(r.status === 400, r.status);
  });
  let poliglota;
  await prueba("—", "imagen políglota (PNG + HTML) se sirve como imagen con nosniff", async () => {
    const buf = Buffer.concat([PNG_1x1, Buffer.from("<html><script>alert(1)</script></html>")]);
    poliglota = await ctx.producto(A, { imagen: dataUrl("image/png", buf) });
    const r = await pedir("GET", `/api/productos/${poliglota}/imagen`);
    return espera(r.headers.get("content-type") === "image/png" && r.headers.get("x-content-type-options") === "nosniff"
      && /default-src 'self'/.test(r.headers.get("content-security-policy") || ""), r.headers.get("content-type"));
  });
  await prueba("H6", "los metadatos EXIF (GPS) se quitan al subir una foto", async () => {
    const id = await ctx.producto(A, { imagen: dataUrl("image/jpeg", jpegConExif()) });
    const r = await pedir("GET", `/api/productos/${id}/imagen`);
    return espera(r.status === 200 && !r.buf.includes(Buffer.from("Exif")) && !r.buf.includes(Buffer.from("GPSLatitude")), "la imagen conserva el EXIF con GPS");
  });
  await prueba("H11", "la imagen de un producto oculto no es pública", async () => {
    const id = await ctx.producto(A, { imagen: dataUrl("image/png", PNG_1x1), visible: false });
    const anon = await pedir("GET", `/api/productos/${id}/imagen`);
    const admin = await pedir("GET", `/api/productos/${id}/imagen`, { sesion: dueno });
    return espera(anon.status === 404 && admin.status === 200, `anónimo ${anon.status}, dueño ${admin.status}`);
  });
  await prueba("—", "un producto oculto no aparece en la API pública", async () => {
    const id = await ctx.producto(A, { visible: false, nombre: `Oculto ${SUFIJO}` });
    const a = await pedir("GET", `/api/productos/${id}`);
    const b = await pedir("GET", `/api/buscar?q=${encodeURIComponent(`Oculto ${SUFIJO}`)}`);
    return espera(a.status === 404 && Array.isArray(b.json) && !b.json.length, `${a.status} ${b.texto.slice(0, 60)}`);
  });

  // ---------- Registro con usuario y teléfono; login con usuario o correo (plan 2026-10-20-registro-validacion-y-login) ----------
  const registro = body => pedir("POST", "/api/clientes/registro", { body });
  const error400 = (r, patron) => espera(r.status === 400 && patron.test((r.json && r.json.error) || ""), `${r.status} ${r.texto}`);
  for (const [nombre, extra, patron] of [
    ["sin usuario", { usuario: "" }, /usuario/],
    ["usuario con @", { usuario: "ana@algo" }, /usuario/],
    ["usuario de 2 letras", { usuario: "ab" }, /usuario/],
    ["teléfono de México con 9 dígitos", { telefono: "551234567" }, /10 dígitos/],
    ["teléfono de México con 11 dígitos", { telefono: "55123456789" }, /10 dígitos/],
    ["sin teléfono", { telefono: "" }, /teléfono/],
    ["país que no existe", { pais: "XX" }, /país/],
    ["correo sin dominio real", { correo: `nadie-${SUFIJO}@sin-correo.prueba.local` }, /no recibe correos/],
    ["correo con dominio .invalid", { correo: `nadie-${SUFIJO}@algo.invalid` }, /no recibe correos/],
    ["correo sin punto en el dominio", { correo: `nadie-${SUFIJO}@gmail` }, /correo válido/],
    ["correo con dos @", { correo: `na@die-${SUFIJO}@gmail.com` }, /correo válido/],
    ["contraseña sin mayúscula", { password: "clave-larga-sin-1", confirmar: "clave-larga-sin-1" }, /mayúscula/],
    ["contraseña sin minúscula", { password: "CLAVE-LARGA-SIN-1", confirmar: "CLAVE-LARGA-SIN-1" }, /minúscula/],
    ["contraseña sin número", { password: "Clave-larga-sin-n", confirmar: "Clave-larga-sin-n" }, /número/],
    ["contraseña sin carácter especial", { password: "ClaveLargaSin1", confirmar: "ClaveLargaSin1" }, /especial/],
    ["contraseña de 9 caracteres", { password: "Clave-12a", confirmar: "Clave-12a" }, /10 caracteres/],
    ["confirmación distinta", { confirmar: `${PASS_CLIENTE}x` }, /no coinciden/],
    ["sin confirmación", { confirmar: undefined }, /no coinciden/]
  ]) {
    await prueba("R", `registro: ${nombre} → 400`, async () => error400(await registro(datosCliente(`val-${nombre.length}`, extra)), patron));
  }
  await prueba("R", "revisar-correo: un error de dedo trae la sugerencia (sin bloquear si el dominio recibe correos)", async () => {
    const r = await pedir("POST", "/api/clientes/revisar-correo", { body: { correo: `dedo-${SUFIJO}@gmial.com` } });
    return espera(r.status === 200 && r.json.sugerencia === `dedo-${SUFIJO}@gmail.com`, r.texto);
  });
  await prueba("R", "admin: una contraseña con la parte del correo antes de la @ se rechaza", async () => {
    const r = await pedir("POST", "/api/admin/usuarios", { sesion: dueno, body: { usuario: `pc-${SUFIJO}`, correo: `fernanda.${SUFIJO}@prueba.local`, password: `Fernanda.${SUFIJO}!1`, confirmar: `Fernanda.${SUFIJO}!1`, rol: "encargado", tiendas: [A.id] } });
    return error400(r, /usuario o tu correo/);
  });
  await prueba("R", "contraseña: letras de otros idiomas cuentan como letras, no como especiales", async () => {
    const r = await registro(datosCliente("idioma", { password: "Çàèabcxyz12", confirmar: "Çàèabcxyz12" }));
    return error400(r, /especial/);
  });
  await prueba("R", "registro: teléfono de España con 9 dígitos se acepta y se guarda privado", async () => {
    const r = await registrarConDatos(datosCliente("espana", { pais: "ES", telefono: "612 345 678" }));
    return espera(r.status === 200 && !/612345678|"telefono"\s*:\s*"/.test(r.texto) && r.json.usuario === `espana-${SUFIJO}`, `${r.status} ${r.texto}`);
  });
  await prueba("R", "registro: usuario o correo repetido → 409 con el mismo mensaje (no dice cuál)", async () => {
    const a = await registro(datosCliente("cliente1", { correo: `otro-${SUFIJO}@prueba.local` }));
    const b = await registro(datosCliente("otro-usuario", { correo: cli1.correo }));
    const c = await registro(datosCliente("cliente1", { usuario: `CLIENTE1-${SUFIJO}`, correo: `otro2-${SUFIJO}@prueba.local` }));
    return espera(a.status === 409 && b.status === 409 && c.status === 409 && a.json.error === b.json.error, `${a.status} ${b.status} ${c.status}`);
  });
  await prueba("R", "revisar-correo: misma respuesta si el correo ya tiene cuenta o no", async () => {
    const a = await pedir("POST", "/api/clientes/revisar-correo", { body: { correo: cli1.correo } });
    const b = await pedir("POST", "/api/clientes/revisar-correo", { body: { correo: `libre-${SUFIJO}@prueba.local` } });
    const c = await pedir("POST", "/api/clientes/revisar-correo", { body: { correo: "x@algo.invalid" } });
    return espera(a.status === 200 && b.status === 200 && Object.keys(a.json).join() === Object.keys(b.json).join() && c.status === 400,
      `${a.texto} ${b.texto} ${c.status}`);
  });
  await prueba("R", "revisar-correo: sin Origin → 403", async () => {
    const r = await pedir("POST", "/api/clientes/revisar-correo", { origin: null, body: { correo: cli1.correo } });
    return espera(r.status === 403, r.status);
  });
  const loginCliente = (identificador, password = PASS_CLIENTE, sesion = {}) => entrarCliente(identificador, password, sesion);
  await prueba("R", "cliente: entra con el usuario (sin importar mayúsculas)", async () => {
    const r = await loginCliente(`CLIENTE1-${SUFIJO}`.toUpperCase());
    return espera(r.status === 200 && r.json.usuario === `cliente1-${SUFIJO}`, `${r.status} ${r.texto}`);
  });
  await prueba("R", "cliente: entra con el correo (sin importar mayúsculas)", async () => {
    const r = await loginCliente(cli1.correo.toUpperCase());
    return espera(r.status === 200, `${r.status} ${r.texto}`);
  });
  await prueba("R", "cliente: el campo viejo `correo` sigue funcionando (pide el código)", async () => {
    const r = await pedir("POST", "/api/clientes/login", { body: { correo: cli1.correo, password: PASS_CLIENTE } });
    return espera(r.status === 200 && r.json.codigo === true && r.json.autenticado === false, `${r.status} ${r.texto}`);
  });
  await prueba("R", "cliente: el freno por cuenta se comparte entre usuario y correo", async () => {
    const { correo } = await registrarCliente("freno");
    for (let i = 0; i < 5; i++) await loginCliente(`freno-${SUFIJO}`, `Mala-clave-${i}`);
    for (let i = 0; i < 5; i++) await loginCliente(correo, `Mala-clave-${i}`);
    const r = await loginCliente(`freno-${SUFIJO}`);
    return espera(r.status === 429, `${r.status} ${r.texto}`);
  });
  await prueba("R", "cliente: el teléfono no sale en /sesion ni en las opiniones", async () => {
    const s = {};
    await loginCliente(cli1.correo, PASS_CLIENTE, s);
    await pedir("PUT", `/api/productos/${prodA}/resena`, { sesion: s, body: { estrellas: 5, comentario: "Muy bueno" } });
    const a = await pedir("GET", "/api/clientes/sesion", { sesion: s });
    const b = await pedir("GET", `/api/productos/${prodA}/resenas`);
    return espera(!/\+52|"telefono"\s*:\s*"|"pais"/.test(a.texto + b.texto) && a.json.incompleta === false, `${a.texto} ${b.texto.slice(0, 120)}`);
  });
  await prueba("R", "cliente: cambiar contraseña pide la actual, la confirma y saca a los otros navegadores", async () => {
    const { correo } = await registrarCliente("cambio");
    const s1 = {};
    const s2 = {};
    await loginCliente(correo, PASS_CLIENTE, s1);
    await loginCliente(correo, PASS_CLIENTE, s2);
    const nueva = "Nueva-clave-cliente-2";
    const malaActual = await pedir("PUT", "/api/clientes/password", { sesion: s1, body: { actual: "Otra-cosa-1", nueva, confirmar: nueva } });
    const distinta = await pedir("PUT", "/api/clientes/password", { sesion: s1, body: { actual: PASS_CLIENTE, nueva, confirmar: `${nueva}x` } });
    const debil = await pedir("PUT", "/api/clientes/password", { sesion: s1, body: { actual: PASS_CLIENTE, nueva: "nueva-clave-2", confirmar: "nueva-clave-2" } });
    const ok = await pedir("PUT", "/api/clientes/password", { sesion: s1, body: { actual: PASS_CLIENTE, nueva, confirmar: nueva } });
    const vieja = await loginCliente(correo);
    const otra = await pedir("GET", "/api/clientes/sesion", { sesion: s2 });
    const sigue = await pedir("GET", "/api/clientes/sesion", { sesion: s1 });
    return espera(malaActual.status === 400 && distinta.status === 400 && debil.status === 400 && ok.status === 200 &&
      vieja.status === 401 && otra.json.autenticado === false && sigue.json.autenticado === true,
      [malaActual.status, distinta.status, debil.status, ok.status, vieja.status, otra.texto, sigue.texto].join(" "));
  });
  await prueba("R", "cliente: cambiar contraseña sin sesión → 401", async () => {
    const r = await pedir("PUT", "/api/clientes/password", { body: { actual: "a", nueva: "b", confirmar: "b" } });
    return espera(r.status === 401, r.status);
  });
  // Completar solo pide lo que falta (plan 2026-11-04): un teléfono que ya está no se cambia por ahí
  await prueba("R", "cliente: completar no cambia un teléfono que ya está, aunque llegue uno inválido", async () => {
    const r = await pedir("PUT", "/api/clientes/completar", { sesion: cli2.sesion, body: { pais: "MX", telefono: "123" } });
    return espera(r.status === 200 && r.json.incompleta === false && !/123/.test(JSON.stringify(r.json.falta)), `${r.status} ${r.texto}`);
  });

  // Necutools: correo opcional y login con usuario o correo
  const passC = "Clave-encargado-larga-1";
  const correoC = `enc-c-${SUFIJO}@prueba.local`;
  await prueba("R", "admin: crear usuario sin confirmar la contraseña → 400", async () => {
    const r = await pedir("POST", "/api/admin/usuarios", { sesion: dueno, body: { usuario: `sinconf-${SUFIJO}`, password: passC, rol: "encargado", tiendas: [A.id] } });
    return error400(r, /no coinciden/);
  });
  await prueba("R", "admin: contraseña sin carácter especial → 400", async () => {
    const r = await pedir("POST", "/api/admin/usuarios", { sesion: dueno, body: { usuario: `sinesp-${SUFIJO}`, password: "ClaveEncargado12", confirmar: "ClaveEncargado12", rol: "encargado", tiendas: [A.id] } });
    return error400(r, /especial/);
  });
  let encC = null;
  await prueba("R", "admin: crear usuario con correo", async () => {
    const r = await pedir("POST", "/api/admin/usuarios", { sesion: dueno, body: { usuario: `enc-c-${SUFIJO}`, correo: correoC, password: passC, confirmar: passC, rol: "encargado", tiendas: [A.id] } });
    encC = r.json && r.json.id;
    return espera(r.status === 201, `${r.status} ${r.texto}`);
  });
  await prueba("R", "admin: correo repetido → 409 y usuario repetido en mayúsculas → 409", async () => {
    const a = await pedir("POST", "/api/admin/usuarios", { sesion: dueno, body: { usuario: `enc-d-${SUFIJO}`, correo: correoC.toUpperCase(), password: passC, confirmar: passC, rol: "encargado", tiendas: [A.id] } });
    const b = await pedir("POST", "/api/admin/usuarios", { sesion: dueno, body: { usuario: `ENC-C-${SUFIJO}`, password: passC, confirmar: passC, rol: "encargado", tiendas: [A.id] } });
    return espera(a.status === 409 && b.status === 409, `${a.status} ${b.status}`);
  });
  await prueba("R", "admin: entra con el correo y con el usuario en mayúsculas", async () => {
    const a = await pedir("POST", "/api/auth/login", { body: { identificador: correoC.toUpperCase(), password: passC } });
    const b = await pedir("POST", "/api/auth/login", { body: { identificador: `ENC-C-${SUFIJO}`, password: passC } });
    const c = await pedir("POST", "/api/auth/login", { body: { usuario: `enc-c-${SUFIJO}`, password: passC } });
    return espera(a.status === 200 && b.status === 200 && c.status === 200, `${a.status} ${b.status} ${c.status}`);
  });
  await prueba("R", "admin: el freno por cuenta se comparte entre usuario y correo", async () => {
    const usuario = `enc-f-${SUFIJO}`;
    const correo = `${usuario}@prueba.local`;
    await pedir("POST", "/api/admin/usuarios", { sesion: dueno, body: { usuario, correo, password: passC, confirmar: passC, rol: "encargado", tiendas: [A.id] } });
    for (let i = 0; i < 5; i++) await pedir("POST", "/api/auth/login", { body: { identificador: usuario, password: `Mala-${i}` } });
    for (let i = 0; i < 5; i++) await pedir("POST", "/api/auth/login", { body: { identificador: correo, password: `Mala-${i}` } });
    const r = await pedir("POST", "/api/auth/login", { body: { identificador: usuario, password: passC } });
    return espera(r.status === 429, `${r.status} ${r.texto}`);
  });
  await prueba("R", "admin: mi-correo pide la contraseña actual", async () => {
    const s = {};
    await pedir("POST", "/api/auth/login", { sesion: s, body: { identificador: correoC, password: passC } });
    const mala = await pedir("PUT", "/api/admin/mi-correo", { sesion: s, body: { correo: `nuevo-${SUFIJO}@prueba.local`, password: "Mala-clave-1" } });
    const ok = await pedir("PUT", "/api/admin/mi-correo", { sesion: s, body: { correo: `nuevo-${SUFIJO}@prueba.local`, password: passC } });
    const yo = await pedir("GET", "/api/admin/yo", { sesion: s });
    return espera(mala.status === 400 && ok.status === 200 && yo.json.correo === `nuevo-${SUFIJO}@prueba.local`, `${mala.status} ${ok.status} ${yo.texto}`);
  });
  await prueba("R", "admin: reiniciar contraseña de otro exige confirmación", async () => {
    const r = await pedir("PUT", `/api/admin/usuarios/${encC}`, { sesion: dueno, body: { rol: "encargado", activo: true, tiendas: [A.id], password: "Otra-clave-larga-12" } });
    return error400(r, /no coinciden/);
  });

  // ---------- Correo y usuario: sin importar mayúsculas, pero sí los acentos ----------
  {
    const body = datosCliente("acento");
    await registrarConDatos(body);
    const entrar = identificador => pedir("POST", "/api/clientes/login", { body: { identificador, password: PASS_CLIENTE } });
    await prueba("C", "login cliente: el correo en mayúsculas entra", async () => {
      const r = await entrar(body.correo.toUpperCase());
      return espera(r.status === 200, `${r.status} ${r.texto}`);
    });
    await prueba("C", "login cliente: el usuario en mayúsculas entra", async () => {
      const r = await entrar(body.usuario.toUpperCase());
      return espera(r.status === 200, `${r.status} ${r.texto}`);
    });
    await prueba("C", "login cliente: el correo con acento (acénto-…) no es la misma cuenta → 401", async () => {
      const r = await entrar(body.correo.replace("acento", "acénto"));
      return espera(r.status === 401, `${r.status} ${r.texto}`);
    });
    await prueba("C", "login cliente: el usuario con acento no es la misma cuenta → 401", async () => {
      const r = await entrar(body.usuario.replace("acento", "acénto"));
      return espera(r.status === 401, `${r.status} ${r.texto}`);
    });
  }
  await prueba("C", "rutas privadas en mayúsculas (/api/Admin/yo) también van con no-store", async () => {
    const r = await pedir("GET", "/api/Admin/yo");
    return espera(/no-store/.test(r.headers.get("cache-control") || ""), r.headers.get("cache-control"));
  });

  // ---------- Código por correo y sesión de cliente sin vencimiento (plan 2026-10-30) ----------
  {
    const body = datosCliente("codigo");
    const s = {};
    const pide = await pedir("POST", "/api/clientes/registro", { body, sesion: s });
    await prueba("OTP", "registro: responde que falta el código, sin el código ni la cuenta", async () => {
      const codigo = await codigoDe(body.correo);
      const entra = await pedir("POST", "/api/clientes/login", { body: { identificador: body.usuario, password: PASS_CLIENTE } });
      return espera(pide.status === 200 && pide.json.codigo === true && !pide.texto.includes(codigo) && entra.status === 401,
        `${pide.status} ${pide.texto} / login ${entra.status}`);
    });
    await prueba("OTP", "el código no sirve en otro navegador → 410", async () => {
      const r = await pedir("POST", "/api/clientes/registro/codigo", { body: { codigo: await codigoDe(body.correo) } });
      return espera(r.status === 410, `${r.status} ${r.texto}`);
    });
    await prueba("OTP", "código equivocado → 401; 5 intentos lo anulan (410 aun con el correcto)", async () => {
      const bueno = await codigoDe(body.correo);
      const malo = String((Number(bueno) + 1) % 1e6).padStart(6, "0");
      const fallos = [];
      for (let i = 0; i < 5; i++) fallos.push((await pedir("POST", "/api/clientes/registro/codigo", { body: { codigo: malo }, sesion: s })).status);
      const r = await pedir("POST", "/api/clientes/registro/codigo", { body: { codigo: bueno }, sesion: s });
      return espera(fallos.every(x => x === 401) && r.status === 410, `${fallos.join(",")} ${r.status}`);
    });
    await prueba("OTP", "código con letras o incompleto → 400", async () => {
      const r = await pedir("POST", "/api/clientes/registro/codigo", { body: { codigo: "12a45" }, sesion: s });
      return espera(r.status === 400, `${r.status} ${r.texto}`);
    });
    const otro = datosCliente("codigo2");
    const s2 = {};
    await prueba("OTP", "registro con el código correcto crea la cuenta y entra sola; la cookie dura 400 días", async () => {
      const r = await registrarConDatos(otro, s2);
      const ses = await pedir("GET", "/api/clientes/sesion", { sesion: s2 });
      const vence = (r.galletas.find(c => /necutla\.sid=/.test(c)) || "").match(/Expires=([^;]+)/);
      const dias = vence ? (Date.parse(vence[1]) - Date.now()) / 864e5 : 0;
      return espera(r.status === 200 && r.json.autenticado === true && ses.json.autenticado === true && dias > 399,
        `${r.status} ${r.texto} ${ses.texto} ${dias}`);
    });
    await prueba("OTP", "el mismo código no sirve dos veces", async () => {
      const r = await pedir("POST", "/api/clientes/registro/codigo", { body: { codigo: await codigoDe(otro.correo) }, sesion: s2 });
      return espera(r.status === 410, `${r.status} ${r.texto}`);
    });
    await prueba("OTP", "entrar: la contraseña sola no inicia sesión", async () => {
      const s3 = {};
      const r = await pedir("POST", "/api/clientes/login", { body: { identificador: otro.usuario, password: PASS_CLIENTE }, sesion: s3 });
      const ses = await pedir("GET", "/api/clientes/sesion", { sesion: s3 });
      return espera(r.status === 200 && r.json.autenticado === false && ses.json.autenticado === false, `${r.texto} ${ses.texto}`);
    });
    await prueba("OTP", "restablecer: misma respuesta con un usuario que existe y uno que no", async () => {
      const a = await pedir("POST", "/api/clientes/restablecer", { body: { identificador: otro.usuario } });
      const b = await pedir("POST", "/api/clientes/restablecer", { body: { identificador: `nadie-${SUFIJO}` } });
      return espera(a.status === 200 && a.texto === b.texto, `${a.texto} / ${b.texto}`);
    });
    await prueba("OTP", "restablecer: con el código pone otra contraseña, entra y saca a los otros navegadores", async () => {
      const s4 = {};
      await new Promise(listo => setTimeout(listo, 300)); // el correo de restablecer sale después de responder
      const nueva = "Otra-clave-cliente-3";
      const pide2 = await pedir("POST", "/api/clientes/restablecer", { body: { identificador: otro.correo }, sesion: s4 });
      await new Promise(listo => setTimeout(listo, 300));
      const cod = await pedir("POST", "/api/clientes/restablecer/codigo", { body: { codigo: await codigoDe(otro.correo) }, sesion: s4 });
      const pw = await pedir("POST", "/api/clientes/restablecer/password", { body: { nueva, confirmar: nueva }, sesion: s4 });
      const fuera = await pedir("GET", "/api/clientes/sesion", { sesion: s2 });
      const vieja = await pedir("POST", "/api/clientes/login", { body: { identificador: otro.usuario, password: PASS_CLIENTE } });
      return espera(pide2.status === 200 && cod.status === 200 && pw.status === 200 && pw.json.autenticado === true &&
        fuera.json.autenticado === false && vieja.status === 401, [pide2.status, cod.status, pw.status, fuera.texto, vieja.status].join(" "));
    });
    await prueba("OTP", "restablecer: la contraseña nueva sin el código → 410", async () => {
      const r = await pedir("POST", "/api/clientes/restablecer/password", { body: { nueva: "Otra-clave-cliente-4", confirmar: "Otra-clave-cliente-4" } });
      return espera(r.status === 410, `${r.status} ${r.texto}`);
    });
    await prueba("OTP", "Necutools sigue con su cookie de 8 horas", async () => {
      const r = await pedir("POST", "/api/auth/login", { body: { usuario: DUENO, password: DUENO_PASS } });
      const vence = (r.galletas.find(c => /necutla\.sid=/.test(c)) || "").match(/Expires=([^;]+)/);
      const horas = vence ? (Date.parse(vence[1]) - Date.now()) / 36e5 : 99;
      return espera(r.status === 200 && horas <= 8.1, `${r.status} ${horas}`);
    });
  }

  // ---------- Casilla de edad y eliminar la cuenta (plan 2026-11-04-cumplimiento-legal-cuenta-y-edad) ----------
  {
    for (const [nombre, edad] of [["sin la casilla", undefined], ["con la casilla en texto", "true"], ["con la casilla en false", false]]) {
      await prueba("LEG", `registro ${nombre} → 400`, async () => {
        const body = datosCliente(`edad-${nombre.length}`);
        if (edad === undefined) delete body.edad; else body.edad = edad;
        const r = await pedir("POST", "/api/clientes/registro", { body });
        return espera(r.status === 400 && /casilla de edad/.test(r.texto), `${r.status} ${r.texto}`);
      });
    }
    const borrar = datosCliente("borrar");
    const sb = {};
    await registrarConDatos(borrar, sb);
    await prueba("LEG", "una cuenta nueva no queda incompleta", async () => {
      const r = await pedir("GET", "/api/clientes/sesion", { sesion: sb });
      return espera(r.json && r.json.incompleta === false && r.json.falta && r.json.falta.edad === false, r.texto);
    });
    await prueba("LEG", "eliminar sin sesión → 401", async () => {
      const a = await pedir("POST", "/api/clientes/eliminar");
      const b = await pedir("POST", "/api/clientes/eliminar/codigo", { body: { codigo: "123456" } });
      return espera(a.status === 401 && b.status === 401, `${a.status} ${b.status}`);
    });
    await pedir("PUT", `/api/productos/${prodA}/resena`, { sesion: sb, body: { calificacion: 4, comentario: "Opinión que se queda sin nombre" } });
    const pide = await pedir("POST", "/api/clientes/eliminar", { sesion: sb });
    const codigo = await codigoDe(borrar.correo);
    await prueba("LEG", "eliminar: responde que falta el código, sin mandarlo en la respuesta", async () =>
      espera(pide.status === 200 && pide.json.codigo === true && pide.json.proposito === "eliminar" && !pide.texto.includes(codigo), `${pide.status} ${pide.texto}`));
    await prueba("LEG", "el código de eliminar no sirve en la sesión de otra cuenta → 410", async () => {
      const r = await pedir("POST", "/api/clientes/eliminar/codigo", { body: { codigo }, sesion: cli1.sesion });
      const sigue = await pedir("GET", "/api/clientes/sesion", { sesion: cli1.sesion });
      return espera(r.status === 410 && sigue.json.autenticado === true, `${r.status} ${sigue.texto}`);
    });
    await prueba("LEG", "el código de eliminar no sirve para entrar → 410", async () => {
      const r = await pedir("POST", "/api/clientes/login/codigo", { body: { codigo }, sesion: sb });
      return espera(r.status === 410, `${r.status} ${r.texto}`);
    });
    await prueba("LEG", "código equivocado → 401 y la cuenta sigue", async () => {
      const malo = String((Number(codigo) + 1) % 1e6).padStart(6, "0");
      const r = await pedir("POST", "/api/clientes/eliminar/codigo", { body: { codigo: malo }, sesion: sb });
      const sigue = await pedir("GET", "/api/clientes/sesion", { sesion: sb });
      return espera(r.status === 401 && sigue.json.autenticado === true, `${r.status} ${sigue.texto}`);
    });
    await prueba("LEG", "con el código correcto se elimina, se cierra la sesión y la opinión queda sin nombre", async () => {
      const pide2 = await pedir("POST", "/api/clientes/eliminar", { sesion: sb });
      const r = await pedir("POST", "/api/clientes/eliminar/codigo", { body: { codigo: pide2.status === 200 ? await codigoDe(borrar.correo) : "" }, sesion: sb });
      const ses = await pedir("GET", "/api/clientes/sesion", { sesion: sb });
      const entra = await pedir("POST", "/api/clientes/login", { body: { identificador: borrar.usuario, password: PASS_CLIENTE } });
      const opiniones = await pedir("GET", `/api/productos/${prodA}/resenas`);
      return espera(r.status === 200 && r.json.eliminada === true && ses.json.autenticado === false && entra.status === 401
        && opiniones.texto.includes("Cliente de Necutla") && !opiniones.texto.includes(borrar.nombre),
        `${r.status} ${r.texto} ${ses.texto} ${entra.status}`);
    });
    await prueba("LEG", "el mismo correo y usuario se pueden registrar otra vez", async () => {
      const r = await registrarConDatos({ ...borrar }, {});
      return espera(r.status === 200 && r.json.autenticado === true, `${r.status} ${r.texto}`);
    });
  }

  // ---------- Groserías en lo que se publica (plan 2026-11-04-filtro-groserias) ----------
  {
    const grs = r => espera(r.status === 400 && /no se permiten en Necutla/.test(r.texto), `${r.status} ${r.texto}`);
    await prueba("GRS", "registro: nombre con groserías → 400", async () =>
      grs(await pedir("POST", "/api/clientes/registro", { body: datosCliente("grsnombre", { nombre: "Pinche Pend3jo" }) })));
    await prueba("GRS", "registro: usuario con una grosería pegada → 400", async () =>
      grs(await pedir("POST", "/api/clientes/registro", { body: datosCliente("grsusuario", { usuario: `elpendejo-${SUFIJO}` }) })));
    await prueba("GRS", "opinión con groserías (letras repetidas y separadas) → 400", async () =>
      grs(await pedir("PUT", `/api/productos/${prodA}/resena`, { sesion: cli1.sesion, body: { calificacion: 1, comentario: "Qué puuuta m i e r d a" } })));
    await prueba("GRS", "opinión en inglés con groserías → 400", async () =>
      grs(await pedir("PUT", `/api/productos/${prodA}/resena`, { sesion: cli1.sesion, body: { calificacion: 1, comentario: "This is bullsh1t" } })));
    await prueba("GRS", "opinión limpia con palabras parecidas (computadora, disputa, class) → 200", async () => {
      const r = await pedir("PUT", `/api/productos/${prodA}/resena`, { sesion: cli1.sesion, body: { calificacion: 5, comentario: "Computadora de primera class, sin disputa" } });
      return espera(r.status === 200 || r.status === 201, `${r.status} ${r.texto}`);
    });
    await prueba("GRS", "Necutools: nombre de producto → 400", async () =>
      grs(await pedir("POST", "/api/admin/productos", { sesion: dueno, body: { stand_id: A.id, tipo: "producto", nombre: "Playera chingona", precio: 1, stock: 1 } })));
    await prueba("GRS", "Necutools: descripción de producto → 400", async () =>
      grs(await pedir("POST", "/api/admin/productos", { sesion: dueno, body: { stand_id: A.id, tipo: "producto", nombre: "Playera", descripcion: "What the fuck", precio: 1, stock: 1 } })));
    await prueba("GRS", "Necutools: color → 400", async () =>
      grs(await pedir("POST", `/api/admin/productos/${prodA}/colores`, { sesion: dueno, body: { nombre: "Verga", hex: "#000000", stock: 1, imagen: dataUrl("image/png", PNG_1x1) } })));
    await prueba("GRS", "Necutools: subcategoría → 400", async () =>
      grs(await pedir("POST", `/api/admin/tiendas/${A.id}/subcategorias`, { sesion: dueno, body: { nombre: "Cabrones" } })));
    await prueba("GRS", "Necutools: nombre de la tienda → 400", async () =>
      grs(await pedir("PUT", `/api/admin/tiendas/${A.id}`, { sesion: dueno, body: { nombre: "P u t a" } })));
    await prueba("GRS", "Necutools: título de oferta → 400", async () =>
      grs(await pedir("POST", "/api/admin/ofertas", { sesion: dueno, body: { stand_id: A.id, tipo: "porcentaje", aplica: "tienda", valor: 10, titulo: "Oferta de mierda", dias: [1] } })));
    await prueba("GRS", "Necutools: título de promoción → 400", async () =>
      grs(await pedir("POST", "/api/admin/promociones", { sesion: dueno, body: { titulo: "Promo culera", precio: 10,
        inicio: "2026-01-01", fin: "2026-12-31", items: [{ producto_id: prodA, cantidad: 1 }] } })));
    await prueba("GRS", "Necutools: respuesta a una opinión → 400", async () => {
      const lista = (await pedir("GET", "/api/admin/resenas", { sesion: dueno })).json || [];
      const opinion = lista.find(o => o.producto_id === prodA);
      if (!opinion) return no("no hay opinión para responder");
      return grs(await pedir("PUT", `/api/admin/resenas/${opinion.id}`, { sesion: dueno, body: { respuesta: "No mames, mamón" } }));
    });
    await prueba("GRS", "Necutools: nombre limpio con palabras parecidas → 201", async () => {
      const r = await pedir("POST", "/api/admin/productos", { sesion: dueno, body: { stand_id: A.id, tipo: "producto", nombre: `Película y computadora ${SUFIJO}`, precio: 1, stock: 1 } });
      return espera(r.status === 201, `${r.status} ${r.texto}`);
    });
  }

  // ---------- Captcha (plan 2026-10-31-seguridad-turnstile-y-cloudflare-aparte) ----------
  const captchaActivo = Boolean(((await pedir("GET", "/api/config")).json || {}).captcha);
  await prueba("N11", "/api/config manda la llave pública del captcha", async () => espera(captchaActivo, "captcha vacío en app/config.php"));
  if (captchaActivo) {
    const rutasCaptcha = [
      ["POST", "/api/clientes/login", { identificador: "nadie", password: "x" }],
      ["POST", "/api/clientes/registro", datosCliente("captcha")],
      ["POST", "/api/clientes/restablecer", { identificador: "nadie" }],
      ["POST", "/api/clientes/codigo/reenviar", {}],
      ["POST", "/api/pedidos", { clave: `tienda-${A.id}`, items: [{ tipo: "producto", id: prodA, cantidad: 1 }] }],
    ];
    for (const [metodo, ruta, body] of rutasCaptcha) {
      await prueba("N11", `${ruta} sin token del captcha → 400`, async () => {
        const r = await pedir(metodo, ruta, { body, sinCaptcha: true });
        return espera(r.status === 400 && /robot/.test(r.texto), `${r.status} ${r.texto}`);
      });
    }
    await prueba("N11", "opinión sin token del captcha → 400", async () => {
      const r = await pedir("PUT", `/api/productos/${prodA}/resena`, { sesion: cli1.sesion, sinCaptcha: true, body: { calificacion: 5, comentario: "Muy bueno, sin captcha" } });
      return espera(r.status === 400 && /robot/.test(r.texto), `${r.status} ${r.texto}`);
    });
    await prueba("N11", "un token de más de 2048 caracteres → 400 sin llamar a Cloudflare", async () => {
      const r = await pedir("POST", "/api/clientes/login", { sinCaptcha: true, body: { identificador: "nadie", password: "x", captcha: "a".repeat(3000) } });
      return espera(r.status === 400, `${r.status} ${r.texto}`);
    });
    // La llave secreta de prueba 1x… acepta cualquier token. El token inventado o reusado se prueba poniendo en
    // app/config.php el secret 2x0000000000000000000000000000000AA (siempre falla) o 3x… (token repetido): 400.
  }

  // ---------- Portada: cifras y opiniones reales (plan 2026-11-08-reels-botones-debounce-texto-y-portada) ----------
  await prueba("PRT", "el resumen de la portada no trae correos, teléfonos, usuarios ni contraseñas", async () => {
    const r = await pedir("GET", "/api/portada/resumen");
    const llaves = JSON.stringify(r.json).match(/"(correo|telefono|usuario|password|password_hash|cliente_id|email)"/);
    return espera(r.status === 200 && !llaves && !/@/.test(r.texto) && !/\d{10}/.test(r.texto), `${r.status} ${llaves} ${r.texto.slice(0, 200)}`);
  });
  await prueba("PRT", "el resumen solo se guarda en el navegador, por poco tiempo", async () => {
    const r = await pedir("GET", "/api/portada/resumen");
    return espera(/^private, max-age=\d+$/.test(r.headers.get("cache-control") || ""), r.headers.get("cache-control"));
  });
  await prueba("PRT", "los pedidos solo salen cuando son 20 o más", async () => {
    const r = await pedir("GET", "/api/portada/resumen");
    return espera(r.json.pedidos === null || r.json.pedidos >= 20, r.json.pedidos);
  });
  await prueba("PRT", "una opinión de 5 estrellas sale con el nombre (no el usuario); una de 2 no sale", async () => {
    const buena = `Me encantó la portada ${SUFIJO}`;
    const mala = `No me gustó nada ${SUFIJO}`;
    await pedir("PUT", `/api/productos/${prodA}/resena`, { body: { calificacion: 2, comentario: mala }, sesion: cli1.sesion });
    await pedir("PUT", `/api/productos/${prodA}/resena`, { body: { calificacion: 5, comentario: buena }, sesion: cli2.sesion });
    const r = await pedir("GET", "/api/portada/resumen");
    const recientes = r.json.recientes || [];
    const suya = recientes.find(x => x.comentario === buena);
    return espera(suya && suya.nombre === "cliente2" && !r.texto.includes(`cliente2-${SUFIJO}`) && !recientes.some(x => x.comentario === mala)
      && recientes.length <= 3 && suya.producto.id === prodA, r.texto.slice(0, 300));
  });

  // ---------- Carrusel de cada color (plan 2026-11-09-fotos-editor-carrusel-color-y-footer) ----------
  const productoColor = await ctx.producto(A);
  const colorA = (await pedir("POST", `/api/admin/productos/${productoColor}/colores`, { sesion: dueno,
    body: { nombre: "Negro", hex: "#112233", stock: 3, imagen: dataUrl("image/png", PNG_1x1) } })).json.id;
  const fotoColor = { imagen: dataUrl("image/png", PNG_1x1) };
  // Encargado nuevo de la tienda B: las pruebas de arriba pueden haber cerrado la sesión de encB
  const creado = await pedir("POST", "/api/admin/usuarios", { sesion: dueno,
    body: { usuario: `foto-b-${SUFIJO}`, password: ctx.pass, confirmar: ctx.pass, rol: "encargado", tiendas: [B.id] } });
  const encAjeno = await loginAdmin(`foto-b-${SUFIJO}`, ctx.pass);
  const sesionAjena = (await pedir("GET", "/api/auth/sesion", { sesion: encAjeno })).texto;
  await prueba("CFO", "el encargado ajeno solo tiene la tienda B", async () =>
    espera(creado.status === 201 && JSON.parse(sesionAjena).tiendas.join() === String(B.id), `${creado.status} ${creado.texto.slice(0, 120)} ${sesionAjena} A=${A.id} B=${B.id}`));
  await prueba("CFO", "sin sesión no se agregan, ordenan ni borran fotos de un color", async () => {
    const [a, b, c] = await Promise.all([pedir("POST", `/api/admin/colores/${colorA}/fotos`, { body: fotoColor }),
      pedir("PUT", `/api/admin/colores/${colorA}/fotos/orden`, { body: { ids: [] } }), pedir("DELETE", "/api/admin/color-fotos/1")]);
    return espera(a.status === 401 && b.status === 401 && c.status === 401, `${a.status} ${b.status} ${c.status}`);
  });
  await prueba("CFO", "un encargado de otra tienda no toca las fotos del color", async () => {
    const r = await pedir("POST", `/api/admin/colores/${colorA}/fotos`, { body: fotoColor, sesion: encAjeno });
    return espera(r.status === 403, r.status);
  });
  await prueba("CFO", "imagen falsa en la foto de un color → 400", async () => {
    const r = await pedir("POST", `/api/admin/colores/${colorA}/fotos`, { sesion: dueno,
      body: { imagen: dataUrl("image/png", Buffer.from("<script>alert(1)</script>")) } });
    return espera(r.status === 400, r.status);
  });
  const fotosDelColor = [];
  await prueba("CFO", "el encargado de la tienda agrega hasta 5 y la sexta → 400", async () => {
    for (let i = 0; i < 5; i++) fotosDelColor.push((await pedir("POST", `/api/admin/colores/${colorA}/fotos`, { body: fotoColor, sesion: encA })).json.id);
    const r = await pedir("POST", `/api/admin/colores/${colorA}/fotos`, { body: fotoColor, sesion: encA });
    return espera(fotosDelColor.every(Boolean) && r.status === 400, `${fotosDelColor} ${r.status}`);
  });
  await prueba("CFO", "el orden solo acepta las fotos de ese color", async () => {
    const r = await pedir("PUT", `/api/admin/colores/${colorA}/fotos/orden`, { sesion: dueno, body: { ids: [...fotosDelColor.slice(1), 999999999] } });
    return espera(r.status === 400, r.status);
  });
  await prueba("CFO", "un encargado de otra tienda no borra la foto", async () => {
    const r = await pedir("DELETE", `/api/admin/color-fotos/${fotosDelColor[0]}`, { sesion: encAjeno });
    return espera(r.status === 403, r.status);
  });
  await prueba("CFO", "la foto de un producto oculto no se ve sin sesión", async () => {
    const url = `/api/colores/${colorA}/fotos/${fotosDelColor[0]}`;
    const visible = await pedir("GET", url);
    await pedir("PUT", `/api/admin/productos/${productoColor}`, { sesion: dueno, body: { stand_id: A.id, tipo: "producto", nombre: `Prueba seguridad ${SUFIJO}`, precio: 50, stock: 100, visible: false } });
    const oculta = await pedir("GET", url);
    await pedir("PUT", `/api/admin/productos/${productoColor}`, { sesion: dueno, body: { stand_id: A.id, tipo: "producto", nombre: `Prueba seguridad ${SUFIJO}`, precio: 50, stock: 100, visible: true } });
    return espera(visible.status === 200 && oculta.status === 404, `${visible.status} ${oculta.status}`);
  });
  await prueba("CFO", "una foto solo se pide con su propio color", async () => {
    const r = await pedir("GET", `/api/colores/${colorA + 999999}/fotos/${fotosDelColor[0]}`);
    return espera(r.status === 404, r.status);
  });
  await prueba("CFO", "al borrar el color se borran sus fotos", async () => {
    await pedir("DELETE", `/api/admin/colores/${colorA}`, { sesion: dueno });
    const r = await pedir("GET", `/api/colores/${colorA}/fotos/${fotosDelColor[0]}`);
    return espera(r.status === 404, r.status);
  });

  // ---------- Caché de fotos (plan 2026-11-11-carga-progresiva-y-cache-de-fotos) ----------
  const datosFoto = { stand_id: A.id, tipo: "producto", nombre: `Prueba seguridad ${SUFIJO}`, stock: 100, visible: true };
  const prodFoto = await ctx.producto(A, { imagen: dataUrl("image/png", PNG_1x1) });
  const urlFoto = async () => (await pedir("GET", `/api/productos/${prodFoto}`)).json.imagen_url;
  const fotoInicial = await urlFoto();
  await prueba("FOT", "foto con su versión: un año, ETag y sin tocar la sesión aunque llegue con cookie", async () => {
    const r = await pedir("GET", fotoInicial, { sesion: { cookie: dueno.cookie } });
    return espera(r.status === 200 && /max-age=31536000/.test(r.headers.get("cache-control")) && /immutable/.test(r.headers.get("cache-control"))
      && r.headers.get("etag") && !r.galletas.length, `${r.status} ${r.headers.get("cache-control")} ${r.headers.get("etag")} ${r.galletas.length}`);
  });
  await prueba("FOT", "con If-None-Match de la misma foto → 304 sin cuerpo", async () => {
    const etag = (await pedir("GET", fotoInicial)).headers.get("etag");
    const r = await pedir("GET", fotoInicial, { headers: { "If-None-Match": etag } });
    return espera(r.status === 304 && r.buf.length === 0, `${r.status} ${r.buf.length}`);
  });
  await prueba("FOT", "versión vieja o sin ?v= → solo 5 minutos", async () => {
    const [a, b] = await Promise.all([pedir("GET", fotoInicial.replace(/\?v=.*/, "?v=vieja")), pedir("GET", fotoInicial.replace(/\?v=.*/, ""))]);
    return espera(a.status === 200 && b.status === 200 && /max-age=300\b/.test(a.headers.get("cache-control")) && /max-age=300\b/.test(b.headers.get("cache-control")),
      `${a.headers.get("cache-control")} | ${b.headers.get("cache-control")}`);
  });
  await prueba("FOT", "cambiar el precio no cambia la dirección de la foto; cambiar la foto sí", async () => {
    await pedir("PUT", `/api/admin/productos/${prodFoto}`, { sesion: dueno, body: { ...datosFoto, precio: 77 } });
    const trasPrecio = await urlFoto();
    await pedir("PUT", `/api/admin/productos/${prodFoto}`, { sesion: dueno, body: { ...datosFoto, precio: 77, imagen: dataUrl("image/jpeg", jpegConExif()) } });
    const trasFoto = await urlFoto();
    return espera(trasPrecio === fotoInicial && trasFoto !== fotoInicial && /\?v=[0-9a-f]{12}$/.test(trasFoto), `${fotoInicial} ${trasPrecio} ${trasFoto}`);
  });
  await prueba("FOT", "foto de un producto oculto: 404 sin sesión, sin caché con el dueño", async () => {
    const url = await urlFoto();
    await pedir("PUT", `/api/admin/productos/${prodFoto}`, { sesion: dueno, body: { ...datosFoto, precio: 77, visible: false } });
    const [sin, con] = await Promise.all([pedir("GET", url), pedir("GET", url, { sesion: { cookie: dueno.cookie } })]);
    return espera(sin.status === 404 && con.status === 200 && /no-store/.test(con.headers.get("cache-control")),
      `${sin.status} ${con.status} ${con.headers.get("cache-control")}`);
  });
  await prueba("FOT", "las fotos no gastan el límite de 300 peticiones de la API", async () => {
    const ip = nuevaIp();
    for (let i = 0; i < 31; i++) await Promise.all(Array.from({ length: 10 }, () => pedir("GET", fotoInicial, { ip })));
    const r = await pedir("GET", "/api/stands", { ip });
    return espera(r.status === 200, r.status);
  });

  // ---------- Errores sin detalles ----------
  await prueba("—", "404 de la API sin detalles internos", async () => {
    const r = await pedir("GET", "/api/no-existe");
    return espera(r.status === 404 && !/at |node_modules/.test(r.texto), r.texto);
  });

  // ---------- Limpieza ----------
  const usuarios = (await pedir("GET", "/api/admin/usuarios", { sesion: dueno })).json || [];
  for (const u of usuarios.filter(x => x.usuario.endsWith(SUFIJO) && x.activo)) {
    await pedir("PUT", `/api/admin/usuarios/${u.id}`, { sesion: dueno, body: { rol: "encargado", activo: false, tiendas: [] } });
  }

  // ---------- Informe ----------
  const fallas = resultados.filter(r => !r.ok);
  for (const r of resultados) console.log(`${r.ok ? "ok   " : "FALLA"} [${r.hallazgo}] ${r.nombre}${r.ok ? "" : ` — ${r.detalle}`}`);
  console.log(`\n${resultados.length - fallas.length} de ${resultados.length} pruebas pasaron.`);
  if (fallas.length) {
    const porHallazgo = {};
    for (const f of fallas) porHallazgo[f.hallazgo] = (porHallazgo[f.hallazgo] || 0) + 1;
    console.log("Fallas por hallazgo:", porHallazgo);
  }
  process.exit(fallas.length ? 1 : 0);
}

main().catch(err => {
  console.error("No se pudieron correr las pruebas:", err.message);
  process.exit(2);
});
