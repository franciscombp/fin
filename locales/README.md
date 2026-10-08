# Idiomas de Pichibank app

La app usa **gettext**, el formato estándar de traducción (archivos `.po`).
Se editan con cualquier editor de texto o con herramientas como
[Poedit](https://poedit.net), Weblate, Crowdin o Lokalise.

| Archivo | Para qué sirve |
| --- | --- |
| `languages.json` | Lista de idiomas que aparecen en *Perfil → Idioma* (y en el ícono de idioma del ingreso). |
| `qu-EC.po` | Kichwa de Ecuador (kichwa unificado). **Borrador:** necesita revisión de hablantes nativos. |
| `messages.pot` | Plantilla con todos los textos de la app. Se genera sola; no se edita a mano. |
| `terminos.txt` | Palabras sueltas que el código traduce aparte: meses, categorías, niveles y servicios. |

El español de Ecuador (`es-EC`) es el idioma fuente, así que no tiene archivo
propio: el texto en español es la clave (`msgid`) de cada traducción.

## Cómo editar una traducción

Cada entrada del `.po` tiene el texto en español y su traducción:

```po
#: index.html
msgid "Transferir dinero"
msgstr "Kullkita kachana"
```

- **Se cambia solo `msgstr`.** El `msgid` debe quedar idéntico al texto de la app.
- Si `msgstr` queda vacío (`""`), la app muestra el español.
- Una entrada marcada con `#, fuzzy` se ignora hasta que alguien la revise y
  quite la marca.
- Las líneas `#:` dicen de dónde salió el texto. Son informativas.

### Textos con datos: `{marcadores}`

Los montos, nombres y fechas van entre llaves. La traducción puede moverlos de
lugar, pero debe conservar los mismos nombres:

```po
msgid "Gastaste {pct} más de lo normal en {cat}"
msgstr "{cat}-pi {pct} yallita tukuchirkanki"
```

Si un valor también es un texto del catálogo (un mes, una categoría, un
nivel), se traduce solo: *«Gastaste en septiembre»* pasa por
`"Gastaste en {mes}"` y por la entrada `"septiembre"`.

### Etiquetas HTML

Algunas respuestas de Uku llevan negritas (`<b>…</b>`). Se conservan en la
traducción, alrededor de la parte equivalente.

## Agregar un idioma nuevo

1. Copia `messages.pot` como `locales/<código>.po`, por ejemplo `en-US.po`.
   Usa un código BCP 47.
2. En la cabecera del archivo, cambia `"Language: …"` por el código nuevo.
3. Agrégalo a `languages.json`:
   ```json
   { "code": "en-US", "name": "English", "file": "en-US.po" }
   ```
4. Llena los `msgstr`. Lo que quede vacío se ve en español.

## Cuando cambian los textos de la app

```bash
# 1. (Opcional) Anota todo lo que la app muestra en pantalla.
#    Necesita Playwright y la app servida en local.
python3 -m http.server 8765 &
node tools/i18n-recorrer.js http://localhost:8765/index.html > /tmp/textos.json

# 2. Actualiza la plantilla y todos los .po. Conserva las traducciones,
#    agrega lo nuevo con msgstr vacío y deja al final lo que ya no aparece.
python3 tools/i18n-extraer.py --textos /tmp/textos.json
```

El extractor imprime cuánto lleva traducido cada idioma.

## Cómo funciona en la app (para desarrollo)

- `assets/i18n.js` se carga primero en `index.html`. Lee `languages.json` y
  el `.po` del idioma elegido. La elección se guarda en `localStorage`
  (`pb_lang`) y se pone en `<html lang>`.
- **Texto en pantalla:** cada texto (y `aria-label`, `placeholder`, `title` y
  `alt`) que coincide con un `msgid` se reemplaza mientras la página se arma,
  también lo que el JS agrega después. Para que algo no se traduzca, se usa
  `translate="no"`.
- **Texto que se arma en JS:** se usa
  `I18n.t('Texto con {dato}', { dato: valor })`. En los módulos de la app se
  llama `T(…)`. La frase debe ir completa, no partida en pedazos, para que cada
  idioma pueda ordenar sus palabras.
- **Cambio de idioma:** no recarga la página. Se vuelve a traducir y se emite
  el evento `i18n:change` para que cada módulo repinte lo que arma con `T()`.
- **Uku:** responde con reglas en español. En otro idioma, las sugerencias
  traducidas se convierten de vuelta a su texto fuente con `I18n.reverse()`,
  y algunas palabras clave en kichwa (`kullki`, `waakaychi`, `pakta`…) apuntan
  a la intención correcta.
