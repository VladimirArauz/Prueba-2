#!/usr/bin/env python3
"""Convierte un respaldo de PostgreSQL de Necutla en un .sql para MariaDB (IONOS).

Uso:
    python3 -I scripts/migracion/pg-a-mariadb.py RESPALDO SALIDA.sql

RESPALDO puede ser el archivo de pg_dump en formato custom (el que baja pgAdmin con
"Backup…" o `pg_dump -Fc`; necesita `pg_restore` instalado) o el .sql en texto plano.
SALIDA lleva el esquema de db/mariadb/schema.sql y un INSERT por tabla con los datos.

Qué convierte:
  * timestamp with time zone → DATETIME(6) en UTC.
  * boolean → 1 / 0.
  * bytea → literal hexadecimal (0x…).
  * arreglos (text[], smallint[]) → JSON.
  * Textos con barras invertidas o caracteres de control → CONVERT(0x… USING utf8mb4),
    así el resultado no depende de NO_BACKSLASH_ESCAPES.
No copia la tabla "session" (las sesiones de PHP son otras).

La SALIDA lleva contraseñas cifradas, correos y teléfonos: no la subas a git.
"""

import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
ESQUEMA = RAIZ / "db" / "mariadb" / "schema.sql"

# Orden de carga (padres antes que hijos) y tablas que no se copian
ORDEN = [
    "stands", "subcategorias", "productos", "admins", "admin_stands", "migraciones",
    "ofertas", "promociones", "promocion_items", "clientes", "resenas", "pedidos",
    "intentos_login", "bitacora", "producto_colores",
]
OMITIR = {"session"}
FILAS_POR_INSERT = 200


def leer_respaldo(ruta: Path) -> str:
    with ruta.open("rb") as f:
        firma = f.read(5)
    if firma == b"PGDMP":
        return subprocess.run(["pg_restore", "-f", "-", str(ruta)], check=True,
                              capture_output=True).stdout.decode("utf-8")
    return ruta.read_text(encoding="utf-8")


def tipos_de_columnas(sql: str) -> dict:
    """{tabla: {columna: tipo}} leído de los CREATE TABLE del respaldo."""
    tablas = {}
    for m in re.finditer(r"^CREATE TABLE public\.(\w+) \((.*?)^\);", sql, re.S | re.M):
        cols = {}
        for linea in m.group(2).splitlines():
            linea = linea.strip().rstrip(",")
            if not linea or linea.startswith("CONSTRAINT"):
                continue
            nombre, resto = linea.split(" ", 1)
            tipo = re.split(r" (DEFAULT|NOT NULL|NULL)\b", resto)[0].strip()
            cols[nombre.strip('"')] = tipo
        tablas[m.group(1)] = cols
    return tablas


ESCAPES = {"b": "\b", "f": "\f", "n": "\n", "r": "\r", "t": "\t", "v": "\v", "\\": "\\"}


def campo_copy(valor: str):
    """Quita los escapes del formato texto de COPY. None = \\N."""
    if valor == r"\N":
        return None
    salida, i = [], 0
    while i < len(valor):
        c = valor[i]
        if c != "\\":
            salida.append(c)
            i += 1
            continue
        sig = valor[i + 1]
        if sig in ESCAPES:
            salida.append(ESCAPES[sig])
            i += 2
        elif sig in "01234567":
            m = re.match(r"[0-7]{1,3}", valor[i + 1:])
            salida.append(chr(int(m.group(0), 8)))
            i += 1 + len(m.group(0))
        elif sig == "x":
            m = re.match(r"[0-9a-fA-F]{1,2}", valor[i + 2:])
            salida.append(chr(int(m.group(0), 16)))
            i += 2 + len(m.group(0))
        else:
            salida.append(sig)
            i += 2
    return "".join(salida)


def arreglo_pg(texto: str) -> list:
    """'{a,"b c",NULL}' → ['a', 'b c', None] (arreglos de una dimensión)."""
    interior = texto.strip()[1:-1]
    if not interior:
        return []
    elementos, actual, comillas, escapado, citado = [], [], False, False, False
    for c in interior:
        if escapado:
            actual.append(c)
            escapado = False
        elif c == "\\":
            escapado = True
        elif c == '"':
            comillas = not comillas
            citado = True
        elif c == "," and not comillas:
            v = "".join(actual)
            elementos.append(None if (v == "NULL" and not citado) else v)
            actual, citado = [], False
        else:
            actual.append(c)
    v = "".join(actual)
    elementos.append(None if (v == "NULL" and not citado) else v)
    return elementos


def texto_sql(valor: str) -> str:
    if re.search(r"[\\\x00-\x1f\x7f]", valor):
        return f"CONVERT(0x{valor.encode('utf-8').hex()} USING utf8mb4)"
    return "'" + valor.replace("'", "''") + "'"


def fecha_utc(valor: str) -> str:
    m = re.fullmatch(r"(.+?)([+-]\d{2})(?::?(\d{2}))?(?::?(\d{2}))?", valor)
    if not m:
        raise ValueError(f"Fecha con zona horaria no reconocida: {valor!r}")
    base, horas, minutos, segundos = m.groups()
    signo = -1 if horas.startswith("-") else 1
    zona = dt.timezone(signo * dt.timedelta(hours=abs(int(horas)), minutes=int(minutos or 0),
                                            seconds=int(segundos or 0)))
    momento = dt.datetime.fromisoformat(base).replace(tzinfo=zona).astimezone(dt.timezone.utc)
    return "'" + momento.strftime("%Y-%m-%d %H:%M:%S.%f") + "'"


def valor_sql(valor, tipo: str) -> str:
    if valor is None:
        return "NULL"
    if tipo.endswith("[]"):
        elementos = arreglo_pg(valor)
        if tipo.startswith(("smallint", "integer", "bigint")):
            elementos = [None if e is None else int(e) for e in elementos]
        return texto_sql(json.dumps(elementos, ensure_ascii=False, separators=(",", ":")))
    if tipo == "boolean":
        return "1" if valor == "t" else "0"
    if tipo == "bytea":
        if not valor.startswith("\\x"):
            raise ValueError("bytea sin formato hex: usa bytea_output = 'hex' en el respaldo.")
        return f"0x{valor[2:]}" if len(valor) > 2 else "''"
    if tipo in ("integer", "smallint", "bigint") or tipo.startswith("numeric"):
        return valor
    if tipo == "timestamp with time zone":
        return fecha_utc(valor)
    if tipo in ("json", "jsonb"):
        return texto_sql(json.dumps(json.loads(valor), ensure_ascii=False, separators=(",", ":")))
    return texto_sql(valor)


def datos_de_tablas(sql: str) -> dict:
    """{tabla: (columnas, filas)} de los bloques COPY."""
    datos = {}
    for m in re.finditer(r"^COPY public\.(\w+) \((.*?)\) FROM stdin;\n(.*?)^\\\.$", sql, re.S | re.M):
        columnas = [c.strip().strip('"') for c in m.group(2).split(",")]
        filas = [[campo_copy(v) for v in linea.split("\t")]
                 for linea in m.group(3).split("\n") if linea]
        datos[m.group(1)] = (columnas, filas)
    return datos


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    respaldo, salida = Path(sys.argv[1]), Path(sys.argv[2])
    sql = leer_respaldo(respaldo)
    tipos = tipos_de_columnas(sql)
    datos = datos_de_tablas(sql)

    desconocidas = set(datos) - set(ORDEN) - OMITIR
    if desconocidas:
        sys.exit(f"El respaldo trae tablas que el esquema de MariaDB no tiene: {sorted(desconocidas)}")

    partes = [
        "-- =========================================================",
        "-- NECUTLA: base nueva para MariaDB (IONOS) con los datos del respaldo de PostgreSQL",
        f"-- Respaldo: {respaldo.name}  ·  Generado: {dt.datetime.now(dt.timezone.utc):%Y-%m-%d %H:%M} UTC",
        "-- Generado con scripts/migracion/pg-a-mariadb.py. Lleva contraseñas cifradas y datos",
        "-- personales: no lo subas a git ni lo compartas.",
        "--",
        "-- Cómo usarlo: phpMyAdmin de IONOS → elige la base (dbs…) en la izquierda → Importar.",
        "-- Es para una base vacía. Para cargarlo otra vez, quita los -- del bloque de abajo",
        "-- (borra las tablas y lo que tengan).",
        "-- =========================================================",
        "",
        "-- SET FOREIGN_KEY_CHECKS = 0;",
        "-- DROP TABLE IF EXISTS " + ", ".join(list(reversed(ORDEN)) + ["sesiones", "limites", "dns_correo"]) + ";",
        "-- SET FOREIGN_KEY_CHECKS = 1;",
        "",
        ESQUEMA.read_text(encoding="utf-8").strip(),
        "",
        "-- =========================================================",
        "-- Datos",
        "-- =========================================================",
        "SET FOREIGN_KEY_CHECKS = 0;",
        "SET time_zone = '+00:00';",
        "START TRANSACTION;",
        "",
    ]
    resumen = []
    for tabla in ORDEN:
        columnas, filas = datos.get(tabla, ([], []))
        resumen.append(f"{tabla}: {len(filas)}")
        if not filas:
            continue
        tipos_tabla = tipos[tabla]
        lista = ", ".join(f"`{c}`" for c in columnas)
        for i in range(0, len(filas), FILAS_POR_INSERT):
            valores = ",\n".join(
                "(" + ", ".join(valor_sql(v, tipos_tabla[c]) for v, c in zip(fila, columnas)) + ")"
                for fila in filas[i:i + FILAS_POR_INSERT])
            partes.append(f"INSERT INTO `{tabla}` ({lista}) VALUES\n{valores};\n")

    partes += ["COMMIT;", "SET FOREIGN_KEY_CHECKS = 1;", "",
               "-- Filas por tabla: " + ", ".join(resumen), ""]
    salida.write_text("\n".join(partes), encoding="utf-8")
    print("Listo:", salida)
    print("Filas por tabla:", ", ".join(resumen))


if __name__ == "__main__":
    main()
