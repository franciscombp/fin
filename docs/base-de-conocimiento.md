# Base de conocimiento y buscador

La app responde preguntas, muestra datos de productos y abre acciones del flujo desde una sola
base de conocimiento: `assets/conocimiento/base.json`. La lee `assets/conocimiento.js`, que la
indexa en el teléfono y la busca sin servidor. La usan el buscador (`assets/buscador.js`) y Uku
(`assets/uku-app.js`).

Los temas salen del centro de ayuda de Banco Pichincha (soporte.pichincha.com: Banca Móvil,
Tarjetas de crédito, Cuentas, Reclamos, Otros) y de las preguntas típicas de una app bancaria.
Los montos, fechas, plazos y tasas son los de la demo, no los del banco.

## Qué hay en la base

| Clave | Qué es |
| --- | --- |
| `categorias` | Las diez categorías del centro de ayuda (`id`, `t`, `icon`). |
| `valores` | Valores por defecto de los `{marcadores}` de los textos (deuda, cupo, fechas, teléfono). En la app, `tarjeta.*` se toma de los datos de la persona. |
| `sinonimos` | Palabra que escribe la gente → palabras de la base («plata» → «dinero», «celu» → «celular»). Las claves con espacio se buscan como frase («plazo fijo»). |
| `entradas` | Las 155 entradas, de tres tipos. |

Cada entrada tiene `id` (`tipo.categoria.tema`), `tipo`, `cat`, `t` (título), `k` (palabras
clave), `fuente` (de dónde sale el tema) y, según el tipo:

- **`faq`**: `preguntas` (otras formas de preguntar lo mismo), `r` (la respuesta, corta, con
  `{marcadores}` si usa datos de la persona), `acts` (botones `[etiqueta, clave]`) y `links`.
- **`producto`**: además de `r`, `datos` (`[["Monto mínimo", "$ 500"], …]`, lo que se muestra
  como ficha) y `acts` para abrirlo o pedirlo.
- **`accion`**: `go` (la clave que la ejecuta), `frases` (cómo la pide la gente), `pasos`
  (opcional, el paso a paso) e `icon`.

Las claves de acción son las mismas que entiende `Soporte.run`: `do:<data-action>` (un botón de la
app), `tab:<pestaña>`, `card:<tarjeta>`, `pfm`, `review`, `handoff`, `sol`, `search` y `ask:<pregunta a Uku>`.

## Cómo busca

1. Normaliza (minúsculas, sin tildes, sin signos) y quita palabras vacías; «no» se conserva.
2. Reduce cada palabra a su raíz («transferencias» y «transferir» → «transfer») y agrega las
   raíces de sus sinónimos con menos peso.
3. Puntúa con BM25 por campos: título (3) > preguntas y frases (2,2) > palabras clave (1,6) >
   respuesta, datos y pasos (0,6). Una raíz parecida o un prefijo nunca vale más que la palabra exacta.
4. Mientras se escribe, la última palabra cuenta como prefijo («recar» → «recargar») y un título que
   empieza por lo escrito sube como un autocompletar. Una palabra sin coincidencias se busca con
   tolerancia a errores de tipeo (distancia 1, o 2 si es larga).
5. Intención: una orden («pagar la luz», «bloquea mi tarjeta») sube las acciones; una pregunta
   («cómo», «cuánto», «?») sube las preguntas frecuentes; «qué es», «requisitos», «cuesta» o el
   nombre de un producto sube los productos. El nombre exacto de una entrada gana siempre.
6. `responder(q)` devuelve la mejor entrada con su confianza: `alta` si gana claro a la segunda y
   cubre la mitad de las palabras; `media` si solo coincide. El buscador muestra la tarjeta de
   respuesta solo con confianza alta; Uku responde con confianza alta antes que con sus reglas de
   temas, y con cualquier confianza antes de recurrir a la IA.

## Dónde se ve

- **Buscador**: tarjeta «Respuesta» o «Producto» arriba (texto, ficha de datos, pasos y botones),
  acciones de la base que no están entre las fijas, sección «Productos» y «Ayuda» con las preguntas
  de la base (si la pregunta también vive en Soporte, se abre allá con la conversación de Uku).
  Los recientes guardan la entrada (`go.kb`) para volver a abrirla.
- **Uku**: al escribir, «Ayuda» y «Productos» traen entradas de la base; al preguntar, una tarjeta
  con la respuesta, las filas de datos (`rows`), los pasos y los botones (`kbCard`).

## Mantenerla

- Agregar una entrada: un objeto nuevo en `entradas` con su `id` único. Poner en `preguntas` o
  `frases` cómo lo diría una persona, no solo el título. Mantener la respuesta en dos o tres frases.
- Si una pregunta ya existe en `assets/soporte.js`, usar el mismo título y la misma respuesta: el
  validador avisa si se desalinean.
- Validar: `node tools/conocimiento-validar.js` (esquema, ids, acciones que existen en
  `index.html`, marcadores con valor, deriva frente a Soporte). Sale con 1 si hay errores.
- Medir el buscador: `node tools/conocimiento-probar.js` corre 190 consultas reales (con errores de
  tipeo y a medias) y dice cuántas salen primeras (hoy 98 %) y entre las tres primeras (100 %).
  Con `-v` muestra cada caso; con un texto (`node tools/conocimiento-probar.js "cuanto debo"`)
  explica la puntuación de cada resultado. Al agregar entradas, agregar también sus consultas.
- `assets/conocimiento.js` y `assets/conocimiento/base.json` están en el precache de `sw.js`.

## La demo pública (`buscador/`)

Publicada en Pages (`https://franciscombp.github.io/fin/buscador/`). Es un POC con los tokens del
design system y sin componentes de la app.

- `buscador/demo.js`: la frase hecha acción («transferir 20 a kevin», «pagar la luz», «recargar 5 a
  mamá», «enviar 100 a andrea»), atajos, contactos, acciones directas al flujo (sin pasar por las
  preguntas), catálogo de acciones, flujos simulados (formulario, Confirmar, comprobante) y dictado
  por voz.
- `buscador/persona.js`: la persona de la demo sale de la base de usuarios (`assets/pfm/datos.json`):
  cuentas y tarjetas en los flujos, contactos y servicios, los atajos que le convienen, «Para ti» y
  los valores de los `{marcadores}` de la base. Si un producto no existe (Camila no tiene tarjeta),
  la respuesta lo dice en vez de usar los valores de la demo.
- `assets/pfm/datos.json › agenda` (lo genera `tools/pfm-agenda.py` desde los movimientos): por
  persona, contactos con favoritos, cuenta, cédula y celular Deuna; beneficiarios en el exterior
  (país, banco, SWIFT, IBAN); números para recargar; servicios domiciliados (débito automático con
  día y tope) y pagos recurrentes; accesos favoritos. Camila es la persona nueva: solo una cuenta
  transaccional, sin movimientos ni agenda.
- `buscador/lector.js`: lee facturas y documentos. Imagen → canvas mejorado (escala, gris,
  contraste) → Tesseract en español desde cdnjs; PDF con texto → pdf.js sin OCR; PDF escaneado →
  OCR por página. `analizar(texto)` saca empresa (catálogo de emisores ecuatorianos), contrato o
  cuenta, cédula, RUC, placa, valor a pagar (el monto más cercano a «total a pagar»), vencimiento,
  periodo y tipo (factura, comprobante, estado de cuenta), con confianza por campo. Corre en Node:
  `node -e "const L=require('./buscador/lector.js'); console.log(L.analizar(texto))"`.
