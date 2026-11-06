#!/usr/bin/env python3
"""Genera el logo y los iconos de Necutla desde recursos/iconos/logo-original.png (no se publica).
Uso, desde la raíz del proyecto: python3 recursos/iconos/generar.py (solo necesita Pillow).

Quita el blanco que rodea el recuadro azul: rellena desde las orillas y se detiene en el azul, así la N
blanca de adentro no se toca. El borde suavizado se vuelve azul con transparencia para que no quede halo."""
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parents[2]
TINTA = (0x17, 0x29, 0x5C)


def sin_fondo(ruta):
    img = Image.open(ruta).convert("RGBA")
    ancho, alto = img.size
    px = img.load()
    orilla = [(x, y) for x in range(ancho) for y in (0, alto - 1)] + [(x, y) for y in range(alto) for x in (0, ancho - 1)]
    vistos = set(orilla)
    while orilla:
        x, y = orilla.pop()
        r, _, _, a = px[x, y]
        if a and r <= TINTA[0]:  # Azul sólido: aquí termina el fondo
            continue
        px[x, y] = (*TINTA, round(a * (255 - r) / (255 - TINTA[0])))
        for vecino in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= vecino[0] < ancho and 0 <= vecino[1] < alto and vecino not in vistos:
                vistos.add(vecino)
                orilla.append(vecino)
    return img.crop(img.getchannel("A").getbbox())


def lleno(logo, tamano, margen=0):
    """Logo sobre un cuadrado --tinta, para los sistemas que recortan el icono a su manera."""
    interior = tamano - 2 * margen
    fondo = Image.new("RGBA", (tamano, tamano), (*TINTA, 255))
    fondo.alpha_composite(logo.resize((interior, interior), Image.LANCZOS), (margen, margen))
    return fondo.convert("RGB")


logo = sin_fondo(RAIZ / "recursos/iconos/logo-original.png")
assert logo.width == logo.height, logo.size


def guardar(ruta, tamano):
    logo.resize((tamano, tamano), Image.LANCZOS).save(RAIZ / ruta, optimize=True)


guardar("public/imagenes/logo.png", 256)
guardar("public/imagenes/favicon-32.png", 32)
guardar("public/imagenes/icono-192.png", 192)
guardar("public/imagenes/icono-512.png", 512)
logo.resize((256, 256), Image.LANCZOS).save(RAIZ / "public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
# iOS pinta de negro lo transparente; maskable: el dibujo entra en la zona segura del 80 %
lleno(logo, 180).save(RAIZ / "public/apple-touch-icon.png", optimize=True)
lleno(logo, 512, 26).save(RAIZ / "public/imagenes/icono-maskable-512.png", optimize=True)
