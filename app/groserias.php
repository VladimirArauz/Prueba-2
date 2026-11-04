<?php
/**
 * Groserías en español y en inglés: los textos que ve todo el mundo (nombre y usuario de los clientes, opiniones,
 * respuestas de las tiendas y lo que se publica desde Necutools) no las aceptan. Se rechaza el texto completo con un
 * 400 y no se dice qué palabra fue. Plan: plans/planes/2026-11-04-filtro-groserias.md
 *
 * Cómo se compara: minúsculas, sin acentos (la ñ se queda: "cono" no es "coño"), números y símbolos que disfrazan
 * letras (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s), letras sueltas separadas que se juntan ("p u t a", "f.u.c.k") y
 * cada letra puede venir repetida ("puuuta"). Después se parte en palabras por todo lo que no sea letra.
 *
 * - GROSERIAS_PALABRAS: solo cuentan como palabra completa (con su plural), porque aparecen dentro de palabras
 *   normales: "puta" en computadora y disputa, "culo" en película, "ass" en class, "dick" en Dickens.
 * - GROSERIAS_RAICES: cuentan aunque vayan dentro de otra palabra (pendejada, motherfucker, elpendejo99), porque no
 *   aparecen en palabras normales.
 * Se dejan fuera a propósito las que tienen otro significado normal (zorra, perra, pito, panocha, coger, concha,
 * polla, ojete, nalgas, güey, cum, damn) y los insultos leves (tonto, idiota). Las letras dobles de la lista cuentan:
 * "ass" pide dos s, así "as" (la carta) pasa.
 */

const GROSERIAS_PALABRAS = [
    // Español
    'puta', 'puto', 'putita', 'putito', 'putazo', 'putaza', 'putiza', 'putear', 'puteada', 'puteo', 'putero',
    'culo', 'culero', 'culera', 'joto', 'jotito', 'marica', 'mamon', 'mamona', 'mamada', 'pinche', 'verga', 'vergazo',
    'vergota', 'vergudo', 'verguiza', 'vergon', 'carajo', 'coño', 'chupala', 'chupamela', 'cagada', 'sidoso', 'sudaca',
    'negrata', 'hdp', 'ptm', 'ctm', 'alv', 'vrg', 'vrga', 'pndj', 'hdtpm', 'pinchi',
    // Inglés
    'ass', 'arse', 'asshat', 'dick', 'cock', 'pussy', 'pussies', 'tits', 'titty', 'titties', 'fag', 'slut', 'whore',
    'bastard', 'retard', 'retarded', 'twat', 'cunt', 'bollocks', 'shit', 'shitty', 'bullshit', 'horseshit', 'shithead',
    'wtf', 'stfu', 'gtfo', 'jackass', 'dumbass',
];

const GROSERIAS_RAICES = [
    // Español
    'pendej', 'chinga', 'chingad', 'chingon', 'chingar', 'chingue', 'chingo', 'cabron', 'mierd', 'maricon', 'malparid',
    'hijueput', 'hijodeput', 'hijadeput', 'mamagueb', 'mamaguev', 'mamahuev', 'gilipoll', 'cojon', 'cojud', 'putamadre',
    'chupapija', 'chupaverga',
    // Inglés
    'fuck', 'bitch', 'asshole', 'dickhead', 'cocksuck', 'nigger', 'nigga', 'faggot', 'jerkoff', 'wank', 'porn',
    'motherfuck', 'dipshit', 'bullshit',
];

// "ass" → a+s{2,} y "puta" → p+u+t+a+: cada letra puede repetirse, pero una letra doble de la lista sigue pidiendo dos
function patron_groseria(string $palabra): string
{
    preg_match_all('/(.)\1*/u', $palabra, $grupos);
    $patron = '';
    foreach ($grupos[0] as $grupo) {
        $n = mb_strlen($grupo);
        $patron .= preg_quote(mb_substr($grupo, 0, 1), '/') . ($n > 1 ? '{' . $n . ',}' : '+');
    }
    return $patron;
}

function regex_groserias(): array
{
    static $regex = null;
    if ($regex === null) {
        $palabras = implode('|', array_map('patron_groseria', GROSERIAS_PALABRAS));
        $raices = implode('|', array_map('patron_groseria', GROSERIAS_RAICES));
        $regex = ["/^(?:$palabras)(?:e?s)?$/u", "/(?:$raices)/u"];
    }
    return $regex;
}

function normalizar_groserias(string $texto): string
{
    $texto = strtr(mb_strtolower($texto, 'UTF-8'), [
        'á' => 'a', 'à' => 'a', 'ä' => 'a', 'â' => 'a', 'ã' => 'a', 'é' => 'e', 'è' => 'e', 'ë' => 'e', 'ê' => 'e',
        'í' => 'i', 'ì' => 'i', 'ï' => 'i', 'î' => 'i', 'ó' => 'o', 'ò' => 'o', 'ö' => 'o', 'ô' => 'o', 'õ' => 'o',
        'ú' => 'u', 'ù' => 'u', 'ü' => 'u', 'û' => 'u', 'ç' => 'c',
        '0' => 'o', '1' => 'i', '3' => 'e', '4' => 'a', '5' => 's', '7' => 't', '@' => 'a', '$' => 's',
    ]);
    // Tres o más letras sueltas separadas por espacios o signos: "p u t a", "f.u.c.k", "p-e-n-d-e-j-o"
    return preg_replace_callback('/(?<![a-zñ])[a-zñ](?:[\s._*,+\/-]+[a-zñ](?![a-zñ])){2,}/u',
        fn($m) => preg_replace('/[^a-zñ]/u', '', $m[0]), $texto);
}

function tiene_groserias(?string $texto): bool
{
    if ($texto === null || $texto === '') return false;
    [$palabras, $raices] = regex_groserias();
    foreach (preg_split('/[^a-zñ]+/u', normalizar_groserias($texto), -1, PREG_SPLIT_NO_EMPTY) as $palabra) {
        if (preg_match($palabras, $palabra) || preg_match($raices, $palabra)) return true;
    }
    return false;
}

// $campo como en v_texto: "tu comentario" → "Tu comentario tiene palabras que no se permiten…"
function sin_groserias(?string $texto, string $campo): ?string
{
    if (tiene_groserias($texto)) {
        $inicio = mb_strtoupper(mb_substr($campo, 0, 1)) . mb_substr($campo, 1);
        throw dato_invalido("$inicio tiene palabras que no se permiten en Necutla. Cámbialas para seguir.");
    }
    return $texto;
}
