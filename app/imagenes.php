<?php
/**
 * Quita los metadatos de las imágenes antes de guardarlas: las fotos del celular traen la ubicación
 * GPS, el modelo del teléfono y la fecha. Sin GD (no se vuelve a comprimir): se recorren los bloques
 * de cada formato y se copian solo los que forman la imagen.
 *
 * - JPEG: se quitan APP1 (EXIF y XMP), APP3 a APP13, APP15 y comentarios. Se conservan APP0 (JFIF),
 *   APP2 con perfil de color y APP14 (Adobe). La orientación de la foto se vuelve a escribir sola en
 *   un EXIF mínimo para que no salga de lado.
 * - PNG: se quitan eXIf, tEXt, iTXt, zTXt y tIME, y lo que venga después de IEND.
 * - WebP: se quitan EXIF y "XMP " y se apagan sus marcas en VP8X.
 * - GIF: se quitan los comentarios y el bloque XMP.
 * Si la imagen no se puede recorrer, se rechaza.
 */

final class ImagenDanada extends Exception {}

function imagen_danada(): ErrorDeDatos
{
    return dato_invalido('La imagen está dañada o tiene un formato raro. Vuelve a guardarla y súbela otra vez.');
}

// Lectores que fallan si se salen del archivo (en Node, Buffer lanzaba RangeError)
function u8(string $b, int $i): int
{
    if ($i < 0 || $i >= strlen($b)) throw new ImagenDanada();
    return ord($b[$i]);
}

function u16be(string $b, int $i): int
{
    return (u8($b, $i) << 8) | u8($b, $i + 1);
}

function u16le(string $b, int $i): int
{
    return u8($b, $i) | (u8($b, $i + 1) << 8);
}

function u32be(string $b, int $i): int
{
    return (u16be($b, $i) << 16) | u16be($b, $i + 2);
}

function u32le(string $b, int $i): int
{
    return u16le($b, $i) | (u16le($b, $i + 2) << 16);
}

// ================= JPEG =================
// Lee la orientación (etiqueta 0x0112) del EXIF; 1 = normal
function orientacion_exif(string $datos): int
{
    if (strlen($datos) < 14 || substr($datos, 0, 6) !== "Exif\0\0") return 1;
    $tiff = substr($datos, 6);
    $le = substr($tiff, 0, 2) === 'II';
    $u16 = fn($o) => $le ? u16le($tiff, $o) : u16be($tiff, $o);
    $u32 = fn($o) => $le ? u32le($tiff, $o) : u32be($tiff, $o);
    try {
        $ifd = $u32(4);
        $entradas = $u16($ifd);
        for ($i = 0; $i < $entradas; $i++) {
            $e = $ifd + 2 + $i * 12;
            if ($u16($e) === 0x0112) {
                $valor = $u16($e + 8);
                return $valor >= 1 && $valor <= 8 ? $valor : 1;
            }
        }
    } catch (ImagenDanada $e) {
        // EXIF incompleto: se ignora
    }
    return 1;
}

// APP1 con un EXIF que solo dice la orientación
function exif_solo_orientacion(int $orientacion): string
{
    $tiff = "MM\x00\x2a\x00\x00\x00\x08" // "MM", 42, IFD en 8
        . "\x00\x01" // 1 entrada
        . "\x01\x12\x00\x03\x00\x00\x00\x01\x00" . chr($orientacion) . "\x00\x00" // Orientation, SHORT, 1
        . "\x00\x00\x00\x00"; // sin más IFD
    $datos = "Exif\0\0" . $tiff;
    $largo = strlen($datos) + 2;
    return "\xff\xe1" . chr($largo >> 8) . chr($largo & 0xff) . $datos;
}

function limpiar_jpeg(string $b): string
{
    if (u8($b, 0) !== 0xff || u8($b, 1) !== 0xd8) throw imagen_danada();
    $partes = [substr($b, 0, 2)];
    $orientacion = 1;
    $i = 2;
    $insertada = false;
    $n = strlen($b);
    while ($i < $n) {
        if (u8($b, $i) !== 0xff) throw imagen_danada();
        $marca = u8($b, $i + 1);
        if ($marca === 0xff) { $i += 1; continue; } // relleno
        if ($marca === 0xd9) { $partes[] = substr($b, $i, 2); break; }
        if (($marca >= 0xd0 && $marca <= 0xd7) || $marca === 0x01) { $partes[] = substr($b, $i, 2); $i += 2; continue; }
        if ($i + 4 > $n) throw imagen_danada();
        $largo = u16be($b, $i + 2);
        if ($largo < 2 || $i + 2 + $largo > $n) throw imagen_danada();
        $segmento = substr($b, $i, 2 + $largo);
        $datos = substr($b, $i + 4, $largo - 2);
        $esApp = $marca >= 0xe0 && $marca <= 0xef;
        $conservar = (!$esApp && $marca !== 0xfe)
            || $marca === 0xe0
            || ($marca === 0xe2 && substr($datos, 0, 12) === "ICC_PROFILE\0")
            || ($marca === 0xee && substr($datos, 0, 5) === 'Adobe');
        if ($marca === 0xe1) $orientacion = max($orientacion, orientacion_exif($datos));
        // La orientación va antes de los datos de la imagen (antes de la primera tabla o cuadro)
        if (!$esApp && $marca !== 0xfe && !$insertada) {
            if ($orientacion !== 1) $partes[] = exif_solo_orientacion($orientacion);
            $insertada = true;
        }
        if ($conservar) $partes[] = $segmento;
        $i += 2 + $largo;
        if ($marca === 0xda) { // inicio de los datos comprimidos: el resto se copia tal cual
            $partes[] = substr($b, $i);
            break;
        }
    }
    return implode('', $partes);
}

// ================= PNG =================
const PNG_QUITAR = ['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME'];

function limpiar_png(string $b): string
{
    $firma = substr($b, 0, 8);
    if (bin2hex($firma) !== '89504e470d0a1a0a') throw imagen_danada();
    $partes = [$firma];
    $i = 8;
    $fin = false;
    $n = strlen($b);
    while ($i + 12 <= $n) {
        $largo = u32be($b, $i);
        $tipo = substr($b, $i + 4, 4);
        if ($i + 12 + $largo > $n) throw imagen_danada();
        if (!in_array($tipo, PNG_QUITAR, true)) $partes[] = substr($b, $i, 12 + $largo);
        $i += 12 + $largo;
        if ($tipo === 'IEND') { $fin = true; break; }
    }
    if (!$fin) throw imagen_danada();
    return implode('', $partes);
}

// ================= WebP =================
function limpiar_webp(string $b): string
{
    if (substr($b, 0, 4) !== 'RIFF' || substr($b, 8, 4) !== 'WEBP') throw imagen_danada();
    $partes = [];
    $i = 12;
    $n = strlen($b);
    while ($i + 8 <= $n) {
        $tipo = substr($b, $i, 4);
        $largo = u32le($b, $i + 4);
        $total = 8 + $largo + ($largo % 2);
        if ($i + 8 + $largo > $n) throw imagen_danada();
        if ($tipo !== 'EXIF' && $tipo !== 'XMP ') {
            $trozo = substr($b, $i, min($total, $n - $i));
            if ($tipo === 'VP8X' && $largo >= 1) $trozo[8] = chr(ord($trozo[8]) & ~(0x08 | 0x04)); // apaga las marcas de EXIF y XMP
            $partes[] = $trozo;
        }
        $i += $total;
    }
    $cuerpo = implode('', $partes);
    return 'RIFF' . pack('V', strlen($cuerpo) + 4) . 'WEBP' . $cuerpo;
}

// ================= GIF =================
function saltar_subbloques(string $b, int $i): int
{
    $n = strlen($b);
    while ($i < $n) {
        $largo = u8($b, $i);
        $i += 1 + $largo;
        if ($largo === 0) return $i;
    }
    throw imagen_danada();
}

function limpiar_gif(string $b): string
{
    if (!preg_match('/^GIF8[79]a$/', substr($b, 0, 6))) throw imagen_danada();
    $i = 13;
    if (u8($b, 10) & 0x80) $i += 3 * 2 ** ((u8($b, 10) & 0x07) + 1); // tabla de colores global
    $partes = [substr($b, 0, $i)];
    $n = strlen($b);
    while ($i < $n) {
        $bloque = u8($b, $i);
        if ($bloque === 0x3b) { $partes[] = substr($b, $i, 1); return implode('', $partes); }
        if ($bloque === 0x2c) { // imagen
            $j = $i + 10;
            if (u8($b, $i + 9) & 0x80) $j += 3 * 2 ** ((u8($b, $i + 9) & 0x07) + 1);
            $j = saltar_subbloques($b, $j + 1);
            $partes[] = substr($b, $i, $j - $i);
            $i = $j;
        } elseif ($bloque === 0x21) { // extensión
            $etiqueta = u8($b, $i + 1);
            $j = saltar_subbloques($b, $i + 2);
            $xmp = $etiqueta === 0xff && substr($b, $i + 3, 8) === 'XMP Data';
            if ($etiqueta !== 0xfe && !$xmp) $partes[] = substr($b, $i, $j - $i);
            $i = $j;
        } else {
            throw imagen_danada();
        }
    }
    throw imagen_danada();
}

function limpiar_metadatos(string $bytes, string $tipo): string
{
    $limpiar = ['image/jpeg' => 'limpiar_jpeg', 'image/png' => 'limpiar_png', 'image/webp' => 'limpiar_webp', 'image/gif' => 'limpiar_gif'][$tipo] ?? null;
    if (!$limpiar) throw imagen_danada();
    try {
        return $limpiar($bytes);
    } catch (ImagenDanada $e) {
        throw imagen_danada(); // lecturas fuera del archivo
    }
}
