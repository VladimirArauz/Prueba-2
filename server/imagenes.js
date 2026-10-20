/**
 * Quita los metadatos de las imágenes antes de guardarlas: las fotos del celular traen la ubicación
 * GPS, el modelo del teléfono y la fecha. Sin dependencias: se recorren los bloques de cada formato
 * y se copian solo los que forman la imagen.
 *
 * - JPEG: se quitan APP1 (EXIF y XMP), APP3 a APP13, APP15 y comentarios. Se conservan APP0 (JFIF),
 *   APP2 con perfil de color y APP14 (Adobe). La orientación de la foto se vuelve a escribir sola en
 *   un EXIF mínimo para que no salga de lado.
 * - PNG: se quitan eXIf, tEXt, iTXt, zTXt y tIME, y lo que venga después de IEND.
 * - WebP: se quitan EXIF y "XMP " y se apagan sus marcas en VP8X.
 * - GIF: se quitan los comentarios y el bloque XMP.
 * Si la imagen no se puede recorrer, se rechaza.
 */
const { ErrorDeDatos } = require("./validar");

const danada = () => new ErrorDeDatos("La imagen está dañada o tiene un formato raro. Vuelve a guardarla y súbela otra vez.");

// ================= JPEG =================
// Lee la orientación (etiqueta 0x0112) del EXIF; 1 = normal
function orientacionExif(datos) {
  if (datos.length < 14 || datos.toString("latin1", 0, 6) !== "Exif\0\0") return 1;
  const tiff = datos.subarray(6);
  const le = tiff.toString("latin1", 0, 2) === "II";
  const u16 = o => (le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
  const u32 = o => (le ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
  try {
    const ifd = u32(4);
    const entradas = u16(ifd);
    for (let i = 0; i < entradas; i++) {
      const e = ifd + 2 + i * 12;
      if (u16(e) === 0x0112) {
        const valor = u16(e + 8);
        return valor >= 1 && valor <= 8 ? valor : 1;
      }
    }
  } catch { /* EXIF incompleto: se ignora */ }
  return 1;
}

// APP1 con un EXIF que solo dice la orientación
function exifSoloOrientacion(orientacion) {
  const tiff = Buffer.from([
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // "MM", 42, IFD en 8
    0x00, 0x01, // 1 entrada
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientacion, 0x00, 0x00, // Orientation, SHORT, 1
    0x00, 0x00, 0x00, 0x00 // sin más IFD
  ]);
  const datos = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
  const largo = datos.length + 2;
  return Buffer.concat([Buffer.from([0xff, 0xe1, largo >> 8, largo & 0xff]), datos]);
}

function limpiarJpeg(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw danada();
  const partes = [buf.subarray(0, 2)];
  let orientacion = 1;
  let i = 2;
  let insertada = false;
  while (i < buf.length) {
    if (buf[i] !== 0xff) throw danada();
    const marca = buf[i + 1];
    if (marca === 0xff) { i += 1; continue; } // relleno
    if (marca === 0xd9) { partes.push(buf.subarray(i, i + 2)); break; }
    if ((marca >= 0xd0 && marca <= 0xd7) || marca === 0x01) { partes.push(buf.subarray(i, i + 2)); i += 2; continue; }
    if (i + 4 > buf.length) throw danada();
    const largo = buf.readUInt16BE(i + 2);
    if (largo < 2 || i + 2 + largo > buf.length) throw danada();
    const segmento = buf.subarray(i, i + 2 + largo);
    const datos = buf.subarray(i + 4, i + 2 + largo);
    const esApp = marca >= 0xe0 && marca <= 0xef;
    const conservar = !esApp && marca !== 0xfe
      || marca === 0xe0
      || (marca === 0xe2 && datos.toString("latin1", 0, 12) === "ICC_PROFILE\0")
      || (marca === 0xee && datos.toString("latin1", 0, 5) === "Adobe");
    if (marca === 0xe1) orientacion = Math.max(orientacion, orientacionExif(datos));
    // La orientación va antes de los datos de la imagen (antes de la primera tabla o cuadro)
    if (!esApp && marca !== 0xfe && !insertada) {
      if (orientacion !== 1) partes.push(exifSoloOrientacion(orientacion));
      insertada = true;
    }
    if (conservar) partes.push(segmento);
    i += 2 + largo;
    if (marca === 0xda) { // inicio de los datos comprimidos: el resto se copia tal cual
      partes.push(buf.subarray(i));
      break;
    }
  }
  return Buffer.concat(partes);
}

// ================= PNG =================
const PNG_QUITAR = new Set(["eXIf", "tEXt", "iTXt", "zTXt", "tIME"]);

function limpiarPng(buf) {
  const firma = buf.subarray(0, 8);
  if (firma.toString("hex") !== "89504e470d0a1a0a") throw danada();
  const partes = [firma];
  let i = 8;
  let fin = false;
  while (i + 12 <= buf.length) {
    const largo = buf.readUInt32BE(i);
    const tipo = buf.toString("latin1", i + 4, i + 8);
    if (i + 12 + largo > buf.length) throw danada();
    if (!PNG_QUITAR.has(tipo)) partes.push(buf.subarray(i, i + 12 + largo));
    i += 12 + largo;
    if (tipo === "IEND") { fin = true; break; }
  }
  if (!fin) throw danada();
  return Buffer.concat(partes);
}

// ================= WebP =================
function limpiarWebp(buf) {
  if (buf.toString("latin1", 0, 4) !== "RIFF" || buf.toString("latin1", 8, 12) !== "WEBP") throw danada();
  const partes = [];
  let i = 12;
  while (i + 8 <= buf.length) {
    const tipo = buf.toString("latin1", i, i + 4);
    const largo = buf.readUInt32LE(i + 4);
    const total = 8 + largo + (largo % 2);
    if (i + 8 + largo > buf.length) throw danada();
    if (tipo !== "EXIF" && tipo !== "XMP ") {
      const trozo = Buffer.from(buf.subarray(i, Math.min(i + total, buf.length)));
      if (tipo === "VP8X" && largo >= 1) trozo[8] &= ~(0x08 | 0x04); // apaga las marcas de EXIF y XMP
      partes.push(trozo);
    }
    i += total;
  }
  const cuerpo = Buffer.concat(partes);
  const cabecera = Buffer.from("RIFF0000WEBP", "latin1");
  cabecera.writeUInt32LE(cuerpo.length + 4, 4);
  return Buffer.concat([cabecera, cuerpo]);
}

// ================= GIF =================
function saltarSubbloques(buf, i) {
  while (i < buf.length) {
    const n = buf[i];
    i += 1 + n;
    if (n === 0) return i;
  }
  throw danada();
}

function limpiarGif(buf) {
  if (!/^GIF8[79]a$/.test(buf.toString("latin1", 0, 6))) throw danada();
  let i = 13;
  if (buf[10] & 0x80) i += 3 * 2 ** ((buf[10] & 0x07) + 1); // tabla de colores global
  const partes = [buf.subarray(0, i)];
  while (i < buf.length) {
    const bloque = buf[i];
    if (bloque === 0x3b) { partes.push(buf.subarray(i, i + 1)); return Buffer.concat(partes); }
    if (bloque === 0x2c) { // imagen
      let j = i + 10;
      if (buf[i + 9] & 0x80) j += 3 * 2 ** ((buf[i + 9] & 0x07) + 1);
      j = saltarSubbloques(buf, j + 1);
      partes.push(buf.subarray(i, j));
      i = j;
    } else if (bloque === 0x21) { // extensión
      const etiqueta = buf[i + 1];
      const j = saltarSubbloques(buf, i + 2);
      const xmp = etiqueta === 0xff && buf.toString("latin1", i + 3, i + 11) === "XMP Data";
      if (etiqueta !== 0xfe && !xmp) partes.push(buf.subarray(i, j));
      i = j;
    } else {
      throw danada();
    }
  }
  throw danada();
}

const LIMPIADORES = { "image/jpeg": limpiarJpeg, "image/png": limpiarPng, "image/webp": limpiarWebp, "image/gif": limpiarGif };

function limpiarMetadatos(buffer, tipo) {
  const limpiar = LIMPIADORES[tipo];
  if (!limpiar) throw danada();
  try {
    return limpiar(buffer);
  } catch (err) {
    if (err instanceof ErrorDeDatos) throw err;
    throw danada(); // lecturas fuera del archivo
  }
}

// ================= Imágenes que ya estaban guardadas (una sola vez) =================
// No borra ninguna: reescribe los bytes sin metadatos. Si una no se puede recorrer, se queda como estaba.
const MIGRACION = "2026-10-20-imagenes-sin-metadatos";
const TABLAS = [["productos", "imagen", "imagen_tipo"], ["stands", "portada", "portada_tipo"], ["promociones", "imagen", "imagen_tipo"]];

async function limpiarImagenesGuardadas(pool) {
  const { rows } = await pool.query("SELECT 1 FROM migraciones WHERE nombre = $1", [MIGRACION]);
  if (rows[0]) return;
  let limpias = 0;
  for (const [tabla, columna, tipo] of TABLAS) {
    const { rows: ids } = await pool.query(`SELECT id FROM ${tabla} WHERE ${columna} IS NOT NULL`);
    for (const { id } of ids) {
      const { rows: [fila] } = await pool.query(`SELECT ${columna} AS imagen, ${tipo} AS tipo FROM ${tabla} WHERE id = $1`, [id]);
      try {
        const limpia = limpiarMetadatos(fila.imagen, fila.tipo);
        if (!limpia.equals(fila.imagen)) {
          await pool.query(`UPDATE ${tabla} SET ${columna} = $1 WHERE id = $2`, [limpia, id]);
          limpias += 1;
        }
      } catch (err) {
        console.warn(`No se pudo limpiar la imagen de ${tabla} ${id}: se deja como estaba.`);
      }
    }
  }
  await pool.query("INSERT INTO migraciones (nombre) VALUES ($1) ON CONFLICT DO NOTHING", [MIGRACION]);
  if (limpias) console.log(`Imágenes sin metadatos: ${limpias}`);
}

module.exports = { limpiarMetadatos, limpiarImagenesGuardadas };
