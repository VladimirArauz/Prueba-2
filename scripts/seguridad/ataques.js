/**
 * NECUTLA — Pruebas de ataque contra el servidor LOCAL (nunca contra Render).
 *
 *   node scripts/seguridad/ataques.js [http://localhost:3000]
 *
 * Variables opcionales: NECUTLA_DUENO_USUARIO y NECUTLA_DUENO_PASSWORD (un dueño de la base local).
 * Crea datos de prueba (encargados, clientes, productos) con un sufijo único y desactiva a los
 * encargados al terminar. Cada prueba dice qué espera y a qué hallazgo de
 * plans/auditorias/2026-10-20-seguridad.md corresponde. Sale con código 1 si alguna falla.
 *
 * Cada petición lleva su propia IP en X-Forwarded-For para que el límite general de la API no
 * mezcle las pruebas (en local, "trust proxy" la acepta; en Render la pone su proxy).
 */
const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const host = new URL(BASE).hostname;
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
  console.error("Estas pruebas solo corren contra localhost.");
  process.exit(2);
}
const DUENO = process.env.NECUTLA_DUENO_USUARIO || "dueno";
const DUENO_PASS = process.env.NECUTLA_DUENO_PASSWORD || "prueba-dueno-123";
const SUFIJO = Date.now().toString(36);
const totp = require("../../server/totp");

// ================= Utilidades =================
let ipSeq = 0;
const nuevaIp = () => { ipSeq += 1; return `10.${(ipSeq >> 16) & 255}.${(ipSeq >> 8) & 255}.${ipSeq & 255}`; };

async function pedir(metodo, ruta, { body, sesion, origin = BASE, ip = nuevaIp(), headers = {}, crudo } = {}) {
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

async function registrarCliente(nombre) {
  const sesion = {};
  const correo = `${nombre}-${SUFIJO}@prueba.local`;
  const r = await pedir("POST", "/api/clientes/registro", { body: { nombre, correo, password: "clave-cliente-larga-1" }, sesion });
  if (r.status !== 200) throw new Error(`registro ${nombre}: ${r.status} ${r.texto}`);
  return { sesion, correo };
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
  const pass = "clave-encargado-larga-1";
  for (const [nombre, tienda] of [["enc-a", A], ["enc-b", B]]) {
    const r = await pedir("POST", "/api/admin/usuarios", {
      body: { usuario: `${nombre}-${SUFIJO}`, password: pass, rol: "encargado", tiendas: [tienda.id] }, sesion: dueno });
    if (r.status !== 201) throw new Error(`crear ${nombre}: ${r.status} ${r.texto}`);
  }
  const encA = await loginAdmin(`enc-a-${SUFIJO}`, pass);
  const encB = await loginAdmin(`enc-b-${SUFIJO}`, pass);
  const producto = async (tienda, extra = {}) => {
    const r = await pedir("POST", "/api/admin/productos", {
      body: { stand_id: tienda.id, tipo: "producto", nombre: `Prueba seguridad ${SUFIJO}`, precio: 50, ...extra }, sesion: dueno });
    if (r.status !== 201) throw new Error(`producto: ${r.status} ${r.texto}`);
    return r.json.id;
  };
  const prodA = await producto(A);
  const prodB = await producto(B);
  const cli1 = await registrarCliente("cliente1");
  const cli2 = await registrarCliente("cliente2");
  return { dueno, encA, encB, A, B, prodA, prodB, cli1, cli2, pass, producto };
}

// ================= Pruebas =================
async function main() {
  const ctx = await preparar();
  const { dueno, encA, encB, A, B, prodA, prodB, cli1, cli2 } = ctx;

  // ---------- Archivos privados y recorrido de rutas ----------
  for (const ruta of ["/.env", "/plans/CLAUDE.md", "/server/index.js", "/package.json", "/.git/config", "/db/schema.sql",
    "/render.yaml", "/scripts/seguridad/ataques.js", "/%2e%2e/package.json", "/..%2fpackage.json", "/js/..%2f..%2fpackage.json",
    "/js/%2e%2e/%2e%2e/server/db.js", "/imagenes/..%5c..%5cpackage.json", "/node_modules/chart.js/package.json"]) {
    await prueba("—", `archivo privado ${ruta} no se sirve`, async () => {
      const r = await pedir("GET", ruta);
      return espera(r.status === 404 || r.status === 400 || r.status === 403, `${r.status}`) && espera(!/"dependencies"|DATABASE_URL|require\(/.test(r.texto), "contenido filtrado");
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
    const p = await pedir("POST", "/api/pedidos", { body: { clave: `tienda-${A.id}`, items: [{ tipo: "producto", id: prodA, cantidad: 1 }] } });
    const r = await pedir("PUT", `/api/admin/pedidos/${p.json.id}`, { body: { estado: "vendido" }, sesion: encB });
    return espera(r.status === 403, r.status);
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
    const crudo = `{"nombre":"Masivo","correo":"masivo-${SUFIJO}@prueba.local","password":"clave-cliente-larga-1",` +
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
    await pedir("POST", "/api/clientes/login", { body: { correo: cli1.correo, password: "clave-cliente-larga-1" }, sesion: s });
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
    await pedir("POST", "/api/admin/usuarios", { sesion: dueno, body: { usuario, password: ctx.pass, rol: "encargado", tiendas: [A.id] } });
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
    for (let i = 0; i < 12; i++) ultimo = await pedir("PUT", "/api/admin/mi-password", { sesion: s, body: { actual: `mala-${i}`, nueva: "otra-clave-larga-123" } });
    return espera(ultimo.status === 429, `último: ${ultimo.status}`);
  });
  await prueba("H16", "registro con correo repetido cuenta para el límite (bcrypt sin freno)", async () => {
    const ip = nuevaIp();
    let ultimo;
    for (let i = 0; i < 32; i++) ultimo = await pedir("POST", "/api/clientes/registro", { ip, body: { nombre: "Repetido", correo: cli1.correo, password: "clave-cliente-larga-1" } });
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
    await pedir("POST", "/api/admin/usuarios", { sesion: dueno, body: { usuario, password: ctx.pass, rol: "encargado", tiendas: [A.id] } });
    const s = await loginAdmin(usuario, ctx.pass);
    let secreto, respaldo;
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
      const r = await pedir("POST", "/api/admin/2fa/activar", { sesion: s, body: { codigo: totp.codigoDe(secreto, totp.pasoActual()) } });
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
      const r = await pedir("POST", "/api/auth/login/codigo", { sesion: p, body: { codigo: totp.codigoDe(secreto, totp.pasoActual()) } });
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
    const r = await pedir("POST", "/api/admin/usuarios", { sesion: dueno, body: { usuario: `largo-${SUFIJO}`, password: `${base}uno`, rol: "encargado", tiendas: [A.id] } });
    if (r.status !== 201) return true;
    const l = await pedir("POST", "/api/auth/login", { body: { usuario: `largo-${SUFIJO}`, password: `${base}otra-distinta` } });
    await pedir("PUT", `/api/admin/usuarios/${r.json.id}`, { sesion: dueno, body: { rol: "encargado", activo: false, tiendas: [] } });
    return no(`se creó y se entra con otra contraseña: ${l.status}`);
  });
  for (const password of ["12345678", "1234567890", "contraseña123", "aaaaaaaaaaaa", `comun-${SUFIJO}-clave`]) {
    await prueba("H12", `cliente: contraseña débil "${password}" se rechaza`, async () => {
      const r = await pedir("POST", "/api/clientes/registro", { body: { nombre: "Comun", correo: `comun-${SUFIJO}@prueba.local`, password } });
      return espera(r.status === 400, r.status);
    });
  }
  await prueba("H12", "admin: contraseña con el nombre de usuario se rechaza", async () => {
    const r = await pedir("POST", "/api/admin/usuarios", { sesion: dueno, body: { usuario: `debil-${SUFIJO}`, password: `debil-${SUFIJO}-2026`, rol: "encargado", tiendas: [A.id] } });
    return espera(r.status === 400, r.status);
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
      const r = await pedir("POST", "/api/admin/productos", { sesion: dueno, body: { stand_id: A.id, tipo: "producto", nombre: "p", precio } });
      if (r.status !== 400) return no(`${precio} → ${r.status}`);
    }
    return true;
  });

  // ---------- Pedidos falsos ----------
  await prueba("—", "el pedido ignora el precio que manda el navegador", async () => {
    const r = await pedir("POST", "/api/pedidos", { body: { clave: `tienda-${A.id}`, items: [{ tipo: "producto", id: prodA, cantidad: 1, precio: 0.01 }], total: 0.01 } });
    const l = await pedir("GET", `/api/admin/pedidos?tienda=${A.id}`, { sesion: dueno });
    const p = l.json.pedidos.find(x => x.id === r.json.id);
    return espera(p && p.total === 50, JSON.stringify(p));
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

  // ---------- Imágenes ----------
  await prueba("—", "imagen falsa (texto con cabecera PNG declarada) → 400", async () => {
    const r = await pedir("POST", "/api/admin/productos", { sesion: dueno, body: { stand_id: A.id, tipo: "producto", nombre: "img", precio: 1,
      imagen: dataUrl("image/png", Buffer.from("<script>alert(1)</script>")) } });
    return espera(r.status === 400, r.status);
  });
  await prueba("—", "SVG no se acepta", async () => {
    const r = await pedir("POST", "/api/admin/productos", { sesion: dueno, body: { stand_id: A.id, tipo: "producto", nombre: "svg", precio: 1,
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
