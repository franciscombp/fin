# Decisiones y aprendizajes de la app Pichibank

Documento vivo. Recoge decisiones de producto y de diseño, y lo que aprendimos al
construir la app, para no repetir errores ni volver a discutir lo ya decidido.
Si una decisión cambia, actualiza esta página en el mismo cambio.

## 1. Flujo de trabajo

- Cada cambio va en su rama (`claude/<tema>`), se verifica y se mergea a `main` con `--no-ff`.
- Antes de empujar: `git fetch origin main` y `git merge --no-ff origin/main`, porque otras sesiones
  publican en `main`. Si el push falla por no ser fast-forward, se repite esa secuencia.
- Después de cada merge a `main` se dispara el workflow `pages-preview.yml` (ref `main`).
- Los commits llevan los trailers `Co-Authored-By` y `Claude-Session`. No se crean PRs salvo que se pidan.
- Verificación headless: Playwright con `/opt/pw-browsers/chromium` (módulo en
  `/opt/node-tools/node_modules/playwright`), servidor con `python3 -m http.server 8765`.
  Las pruebas se hacen con `serviceWorkers: 'block'`.
- Las pruebas de ingreso (PIN de 4 y 6 dígitos, clave digital, recuperación) y las de layout
  (medidas con `getBoundingClientRect`) son la referencia mínima antes de publicar.

## 2. Ingreso (login)

- **Botón principal:** dice "Ingresar con Face ID" en iPhone, "Ingresar con huella" en otros equipos
  con biometría, y "Ingresar con PIN" si no hay biometría (`Ingreso.etiqueta` en `assets/ingreso.js`).
  La detección de iOS es aproximada: los navegadores no distinguen Face ID de Touch ID.
- **Sin biometría:** PIN de 4 dígitos del dispositivo. La primera vez se crea (escribiéndolo dos veces).
  Tres intentos fallidos llevan a usuario y contraseña.
- **Otro método de ingreso:** PIN de 6 dígitos (independiente del de 4). "Olvidé mi PIN" lleva a
  usuario y contraseña, y al entrar con ellas se borra el PIN de 6 para crear uno nuevo.
- **Usuario y contraseña:** en el prototipo la contraseña demo es `pichibank`; si la persona la cambia,
  se guarda solo como huella. Recuperar usuario y contraseña pide el correo registrado
  (`usuario@ejemplo.ec`), muestra el usuario y permite cambiar la contraseña (mínimo 8 caracteres).
- **Clave digital:** sóftoken TOTP (RFC 6238, SHA-1, 6 dígitos, 30 s). Se valida contra los vectores
  de la RFC (T=59 → 94287082 con 8 dígitos). La clave digital es pública (no pide ingreso).
- Todo lo de PIN, contraseña y sóftoken es local (localStorage) porque es un prototipo.

## 3. Sin internet

- **La conexión la dice el navegador** (`navigator.onLine` y sus eventos `online`/`offline`). Antes se
  sondeaba un archivo del mismo sitio (`sonda.txt`, ahora en `respaldo/sin-uso/`), pero en el teléfono
  esa petición fallaba aunque hubiera red (caché del service worker, app instalada) y mostraba
  "Sin internet" por error.
- **Login sin internet:** solo entra con Face ID o huella. Sin ninguna de las dos, el botón principal
  queda en "Sin internet" (apagado), y "Otro método de ingreso" se oculta.
- **Accesos que necesitan red:** se ven deshabilitados (`disabled`), no ocultos. Un aviso bp-alert
  explica que se necesita conexión.
- **Acciones transaccionales sin internet:** no se abren y muestran el aviso "Sin internet: esta función
  necesita conexión". Son: transferir, pagar servicios, recargar, pagar tarjeta, retirar, pagar con QR y
  pagar a un QR. El bloqueo va en captura sobre el documento, así cubre también el buscador.
- **Informativo sin internet:** Mostrar mi QR (el QR se genera en la app), recibir dinero, cuentas,
  movimientos, ayuda y los **tickets de transporte ya comprados** (para usar en el metro).
- **Pendiente:** comprar tickets sin internet no existe todavía; cuando exista, la compra debe bloquearse
  y solo la consulta debe quedar disponible.
- **Pendiente:** las acciones que mueven dinero dentro del Asistente (Uku) no están bloqueadas sin internet.

## 4. Accesos del login

- Arriba: Pagar a un QR, Retirar sin tarjeta, Tickets transporte, Mostrar mi QR.
- "Verificar pago" se reemplazó por **Mostrar mi QR** (abre el cobro con QR, sin ingresar).
- Los accesos que piden ingreso se guardan como acción pendiente y se abren al entrar.
- Los accesos públicos (Ayuda, Clave digital, Idioma, Mostrar mi QR) responden de inmediato.

## 5. Design system (DS) y medidas

**Fuente de verdad.** Los estilos y los componentes salen de la biblioteca de Figma «Components 4 [Beta]»
(`figma.com/design/Q8Xzu4JzCGv5OnXANT04WA`). Los wireframes (archivo «Oso») dan la estructura y la
navegación de cada pantalla; nunca sus estilos. En código:

- `assets/tokens.css` es el export autogenerado de la biblioteca (capas `tokens.base`, `layout`, `semantic`
  y `theme`, con modos `data-theme` light/dark y `data-layout` por dispositivo). No se edita a mano salvo
  dos ajustes marcados con comentario: el modo por defecto sin atributo y el respaldo de fuente
  (`Prelo, Roboto, sans-serif`, porque Prelo es comercial y no viaja con el prototipo). Al final va una
  capa `tokens.product`, mantenida a mano, con los alias que la app usa y el export no trae (interacción
  por estado `--hover/--active/--focus`, espaciados de composición, anillo de foco).
- `assets/componentes-tokens.css` trae los tokens de componente (bp-button, bp-avatar, bp-tag, bp-spinner,
  bp-action-button, bp-guided-tour) tal cual los exporta Figma (`:host([size=…])`) y, debajo, la misma
  tabla adaptada al DOM plano con alias `--bp-<componente>-*` y modos por `data-size` / `data-context`.
- Cuando llegue un export nuevo, se reemplaza la parte generada y se conservan las dos capas manuales.

Usar siempre los tokens, nunca valores fijos:

- **Márgenes de página y relleno de contenedores: con los tokens de layout, nunca con un número.**
  `--bp-layout-grid-margin` para el margen lateral de toda pantalla y hoja (16 en 360, 24 en 390 y 40 en
  tablet) y `--bp-layout-card-padding` para el relleno interno de tarjetas y filas (16 en móvil, 24 en
  tablet). Así el mismo CSS se adapta al dispositivo. En el asistente, `--uk-inset` es un alias de
  `--bp-layout-grid-margin`; `--bp-layout-grid-gutter` es el espacio entre columnas de una rejilla.

- Espacios: `--bp-semantic-spacing-micro-md` (8), `micro-lg` (12), `macro-sm` (16), `macro-md` (24),
  `macro-lg` (32), `xl` (20).
- **Botón primario:** `login-button--primary`, 56 px de alto en las pantallas de flujo, ancho completo.
- **Botón secundario:** mismo tamaño y mismo ancho que el primario (`login-button--secondary`).
  Nunca un chip pequeño para una acción de pantalla completa.
- **Botón terciario:** mismo tamaño que el primario, sin fondo, texto en
  `--bp-theme-color-interaction-tertiary-fg` y **subrayado**. El relleno tintado no es terciario.
- **bp-alert** (advertencia): icono `warning` de 24 px alineado arriba a la izquierda; 8 px entre icono y
  texto; 12 px entre título y cuerpo; sin márgenes de párrafo; radio `sm`; sin bordes.
- **Espacio entre acciones:** 16 px entre Ingresar y Otro método; 32 px entre el bloque de accesos rápidos
  y Ingresar; 32 px de respiro entre la división con la ilustración y los accesos.
- **Radio máximo 16 px** en el Asistente y en el buscador. Sin píldoras completas, por esa regla.
- Iconos: si no existe en Material Symbols (por ejemplo `leaf_spark`), se dibuja un SVG del mismo trazo
  en `ic()` de `assets/uku-util.js`. No se usa el nombre como texto.

### 5.1 Patrón de pantalla: el estilo de la app es el de Perfil

Toda pantalla y toda hoja se arma igual que Perfil. Es el acuerdo de coherencia: mismo esqueleto,
mismos tokens, nada inventado por pantalla.

- **Fondo de página:** `--bp-theme-color-surface-page-alt` (gris claro). Las tarjetas van sobre ese gris.
- **Márgenes laterales:** `--bp-layout-grid-margin` (16, 24 o 40 según el dispositivo). Nada pegado al borde, nada con doble margen.
- **Título de pantalla:** `view-title` (como «Perfil»). En las hojas, el título va en la cabecera con la X al
  mismo nivel (`title-sm`, color `text-primary`).
- **Etiqueta de sección:** una línea en gris encima de cada tarjeta, en frase (nunca en mayúsculas):
  `--ui-body-sm-medium` (14/20), color `--bp-theme-color-text-helper`, alto `--bp-semantic-size-interactive-xs`
  (40) y 8 px (`micro-md`) hasta la tarjeta. Opcional: una segunda línea corta con el mismo gris y, a la
  derecha, un enlace «Ver todo» en `--bp-theme-color-text-interactive`.
- **Tarjeta (grupo de filas):** `--bp-theme-color-surface-container-default` (blanco), radio
  `--bp-semantic-radius-md` (12), sin borde ni sombra, `overflow: hidden`. Entre tarjetas, 24 px
  (8 de `padding-top` de la sección + 16 de `padding-bottom`).
- **Fila:** `min-height` 64 (`--ui-row`), relleno `--bp-semantic-spacing-micro-lg` (12) arriba y abajo por
  `--bp-layout-card-padding` (16 en móvil, 24 en tablet) a los lados, `gap` `--bp-semantic-spacing-micro-lg` (12);
  una fila de una línea mide 64 y una de dos líneas, 68. Divisor
  `--bp-semantic-border-thin` con `--bp-theme-color-border-divider`; la última fila sin divisor.
  Estados `--bp-interaction-row-bg`, `--hover` y `--active`.
- **Icono de fila:** círculo de 40 (`--ui-ic`, radio `full`) con `--bp-theme-color-avatar-bg` y
  `--bp-theme-color-avatar-fg`; icono de 24 (`--bp-semantic-size-icon-md`). Solo cuando identifica una
  acción concreta (una pregunta frecuente va sin icono). La tarea de Uku lleva el círculo en azul acento.
- **Textos de fila:** título `--ui-body-md-semibold` en `text-primary`; línea secundaria
  `--ui-body-sm-regular` en `text-helper`; cifra a la derecha con el mismo peso del título y números
  tabulares. Un solo renglón por título (elipsis).
- **Cierre de fila:** chevron `--bp-semantic-size-icon-sm` en `--bp-theme-color-icon-secondary`, o un
  switch si la fila es un ajuste.
- **Bloque destacado** (aviso o héroe): tarjeta con radio `md`, texto en dos niveles y, si hay arte, a la
  derecha; sin bordes. En Mis finanzas el héroe (cifra, barra, estado) va directo sobre el gris, sin tarjeta.
- **Qué no hacer:** listas de texto sin tarjeta, etiquetas en mayúsculas, iconos en cada fila por decorar,
  mosaicos o chips donde una fila resuelve, espaciados fuera de la escala 8/12/16/24/32.

Dónde está aplicado: en toda la app, porque cada primitiva se define una sola vez en
`assets/componentes.css` (ver 5.3).

### 5.2 Mapa de navegación del asistente (Uku)

El asistente vive en la barra inferior (pestaña **Asistente**, entre Beneficios y Perfil). Arriba de la
app quedan solo la búsqueda (abre el **Buscador** universal) y las notificaciones. Dentro del asistente
hay un solo control arriba a la izquierda y, cuando la pantalla tiene nombre, el título centrado
(`.uk-chathead`). Nunca una flecha y una X a la vez. La barra inferior sigue visible en el inicio del
asistente; se oculta en Mis finanzas y Soporte (secciones a pantalla completa), en el chat y en las
páginas a pantalla completa.

- **Inicio** (`is-home`): sin flecha (se sale con la barra inferior). El globo muestra **una sugerencia
  a la vez** (etiqueta, «1 de n», flecha para pasar a la siguiente y X para ocultarla, con «Deshacer»).
  Los chips de abajo son **sobre esa sugerencia**: su acción y algo relacionado (p. ej. «Programar el
  pago» y «Ver todos mis pagos»). Sin sugerencias (o todas ocultas) se muestra **solo el saludo**
  («Buenas tardes, Andrés. ¿En qué te ayudo hoy?»), sin chips. Debajo, el buscador con micrófono y dos
  accesos: Mis finanzas y Soporte.
- **Buscador**: hoja a pantalla completa que abre el campo; la X vuelve al inicio.
- **Chat** (`is-chat`): la flecha vuelve al inicio. Uku asoma abajo a la izquierda, sobre la barra
  «Escríbele a Uku». Mensajes del usuario en gris, respuestas en blanco, acciones en tarjeta y
  «¿Te sirvió?» con pulgar abajo y pulgar arriba. Las respuestas de Uku se escriben palabra por palabra,
  como un chat de IA; las filas y botones entran cuando termina el texto.
- **Mis finanzas** (`is-fin`): título «Mis finanzas», la flecha vuelve al inicio, la «i» abre la leyenda
  del mundo. Uku se ve en **plano general** dentro de su bosque, con un globo que escribe su mensaje.
  Abajo hay una **sección fija** (sin scroll ni handle; su fondo es translúcido, con degradado y desenfoque, para que se integre con el
  escenario y aun así dé contraste),
  en este orden: **una sola sugerencia** de Uku (tarjeta con ícono, acción, por qué y flecha; tocar a
  Uku o deslizar pasa a la siguiente), «Gastaste en…» (abre **Mis gastos**) y «Mi dinero en Pichibank»
  con dos columnas: dinero en cuentas e inversiones y deuda total acumulada (abre su hoja).
- **Mis gastos** (`is-page`): página a pantalla completa con título y X que vuelve a Mis finanzas. Hallazgo
  del mes, periodos, tarjeta con total y gráfico, categorías con barras.
- **Soporte** (`is-ayuda`): igual que Mis finanzas, que es el modelo de las secciones. Pantalla completa
  (sin barra de abajo), título «Soporte», la flecha vuelve al inicio. Uku en su mundo, en plano general,
  con un globo que cuenta cómo va tu solicitud o te invita a contar qué pasó. Abajo la misma sección fija
  translúcida, con las mismas tarjetas: **Solicitudes** (ícono, cuántas hay y «Ver todas»; la última en
  curso con su asunto, estado, tres pasos y cuándo hay respuesta) y **Preguntas frecuentes** (título con
  «Ver todas», que abre la ayuda completa, y las dos más consultadas). Al pie, como en el inicio, «Busca o
  pregunta» y el micrófono: abren el buscador universal con los temas de ayuda primero. La **ayuda
  completa** es una hoja a pantalla completa con título y X que vuelve a Soporte.

#### Lógica de Mis finanzas

- **Gastos sin categorizar** → Uku pide ordenarlos («Clasificar n»). Es la primera recomendación.
- **Sin presupuesto** → Uku recomienda armarlo (en el globo y la tarjeta de sugerencia), y la tarjeta del
  mes muestra solo lo gastado, sin barra ni comparación. Mis gastos muestra «Armar mi presupuesto».
  «Sin presupuesto» es que no haya uno guardado; el que calcula Uku solo como propuesta no cuenta.
- **Con presupuesto** → barra de avance y «Te queda…» / «Vas … por encima».
- **Mensajes según el perfil** (hogar, negocio, joven, jubilado, al día, nuevo), siempre en positivo y
  con una propuesta: no «tu cuenta llega casi a cero», sino «te puedo ayudar a armar un presupuesto
  para ver en qué se va tu dinero».
- **Arma tu presupuesto** (hoja de tres pasos, alto estable): arriba la barra de avance y «Paso n de 3»;
  abajo un pie fijo con «Atrás»/«Ahora no» (secundario) y la acción principal (azul de Uku).
  1. Cuánto gastar: tu mes (recibes / gastas) y tres planes en tarjetas con radio, el monto, una barra
     gasto · ahorro (o lo que te pasarías, en ámbar) y «Ahorras $ x al mes · $ y al año».
  2. Cómo repartirlo: resumen apilado (fijo · para mover · libre), grupos «Lo fijo» y «Lo que puedes
     mover» con stepper en píldora y la diferencia contra tu promedio; aviso si los grupos se pasan.
  3. Lo que significa hoy: el monto, la barra del mes con la marca de hoy, «Para gastar al día» y
     «Ahorrarías», y cómo te acompaña Uku.
  Sin ingresos ni gastos (persona nueva) no hay pasos: un aviso corto y «Entendido».
- **Bosque ↔ historia financiera**: árboles = un mes de historia cada uno (el más reciente, al frente;
  los meses flojos, más pequeños); flores = ahorro; guayacanes = inversiones; casa, tienda, etc. =
  créditos; **mariposas = sugerencias** (siempre hay, mínimo dos). Una persona nueva (Camila) no tiene
  árboles: solo brotes pequeños en el suelo y las mariposas.

### 5.3 Una sola capa de componentes (acuerdo del 21 de octubre)

El problema que teníamos: botones, filas, tarjetas, chips, hojas y títulos estaban definidos cuatro
veces (CSS base de `index.html`, `solar.css`, `sistema.css` y la hoja de cada pantalla), cada capa
pisando a la anterior con `!important`. Cualquier ajuste salía distinto según la pantalla.

Cómo queda:

- **`assets/componentes.css` es la única definición de cada componente** del DS: bp-button,
  bp-action-button, enlace, bp-navigation-button, bp-icon-switch, bp-quick-action, bp-tab-item,
  bp-filter-item, bp-segmented, bp-avatar, bp-tag, bp-section-title, bp-section, bp-page-header,
  bp-widget (tarjeta), bp-list-item (fila), bp-bottom-sheet, bp-toast, bp-alert, bp-tips-security,
  bp-top-bar, bp-nav-bar, bp-text-field, bp-amount y bp-progress. Cada regla lista primero el nombre
  bp-* y después los nombres heredados de la app como alias (`.login-button`, `.pf-cta`, `.list-item`,
  `.sx-row`, `.uk-chip`…), así el markup existente recibe el mismo componente sin reescribirlo. Los alias
  tipográficos (`--sol-*`, `--ui-*`, `--cx-*`) también viven ahí, una sola vez.
- **El CSS base de `index.html` va dentro de `@layer base`**: todo lo que no está en una capa (los
  componentes y las hojas por pantalla) gana sobre él sin `!important`, sea cual sea la especificidad.
  Los estados que la base controlaba (`.tabs.is-hidden`, `.toast.show`, `.sheet.open`…) se respetan
  porque el componente no fija esas propiedades.
- **Orden de carga:** tokens → base (capa) → hojas por pantalla → `sistema.css` (patrones de la app
  que no son componentes: banners, hubs, transiciones, títulos grandes) → `componentes.css` al final.
- **Una pantalla que necesite una variante la escribe con un selector de contexto**
  (`.uk-panel .pf-cta { background: var(--uk-accent) }`), nunca redefiniendo la clase a secas ni con
  `!important`. Si una regla por pantalla repite lo que ya hace el componente, se borra.
- **Se retiró el tema Y2K** (prueba de concepto de theming) y sus fuentes Anton y Bungee: el DS es la
  única fuente de estilos, y los prefijos `html:not(.theme-y2k)` desaparecieron de todas las hojas.
- **`solar.css` se eliminó**: sus componentes pasaron a `componentes.css` y los ajustes de modo
  oscuro de lo decorativo, a `sistema.css`.
- Antes de agregar una clase nueva, buscar el componente en `componentes.css` y sumarla a su lista de
  alias. Antes de borrar, comprobar que ningún `html`, `js` (también `app.js` en la raíz) ni la demo
  de `buscador/` la usa.

### 5.3.1 Limpieza del 22 de octubre: una sola versión de la app

- **La app es solo la versión con Uku.** `clasica.html`, `asistente.html` y la rama `?app=clasica`
  se retiraron a `respaldo/version-clasica/`; la página «Modo finanzas» (`#finance-page`) y su
  intercepción en `asistente.js`, a `respaldo/modo-finanzas/`. Las etiquetas de las páginas push que
  usaban `.finance-subtitle` ahora son `.push-label` (en `componentes.css`, con el título de sección).
- **`uku-rig.html` vive en `sandbox/rig.html`**, junto al resto de pruebas. «Probar efectos» salió de
  Perfil (los mismos efectos se prueban en `sandbox/animaciones.html`); su HTML y su JS quedaron en
  `respaldo/probar-efectos/`.
- **Placeholders con el estilo de la app:** los grupos vacíos de los hubs (Cuentas, Metas…) y las
  sugerencias de Destacados son tarjetas sólidas con ícono en cuadro gris, título y enlace, el mismo
  componente `.cta-dashed` (ya sin borde punteado). Nada de bordes punteados ni fondos transparentes.
- **Página de producto genérica** (débito, préstamos, inversiones, seguros y productos de otros bancos):
  usa el mismo lenguaje que la cuenta (título grande, tarjeta de saldo, acciones, «Detalle» y la lista
  en tarjetas sobre fondo gris).
- **Filas de Perfil sin pantalla propia** abren la página «Próximamente» con su ícono, en vez de un toast.
  Seguridad abre el flujo de seguridad del login; «Uku, tu asistente personal» lleva al asistente.

### 5.3.2 Tarjetas: arte real, detalle por tipo y tinta UV (22 de octubre)

- **Tres tarjetas Pichibank** (`assets/tarjetas.js`, `assets/tarjetas.css`, arte en `assets/tarjetas/`):
  Débito Digital (arte Visa amarillo), Crédito Black Miles (arte negro) y Crédito Visa (tarjeta en capas).
  Las filas del hub Tarjetas llevan `data-tarjeta` (`debito`, `black`, `visa`), `data-saldo` y
  `data-ultimos`, muestran el arte real como miniatura y abren el detalle de tarjeta (#card-detail).
  Mastercard Pichibank → Black; Visa Pichibank → Visa Crédito. Las de otros bancos usan la página
  de producto genérica. `Tarjetas.abrir(nombre)` resuelve los accesos por nombre (Uku, Soporte, Destacados).
- **Detalle:** débito con acciones (Ver datos, Bloquear, Límites, Más) y suscripciones; crédito con
  «Estás al día» si no debe, número enmascarado, cupo disponible/utilizado con anillo de uso, acciones
  (Millas o Puntos, Avances, Diferir, Más) y consumos o «Aún no tienes transacciones». Deslizar sigue
  girando la tarjeta para ver los datos con biometría.
- **La Black es oscura con los tokens del DS**, no con colores a mano: `data-theme="dark"` sobre
  #card-detail. Para que funcione en un solo elemento, los bloques de tokens de tema, de producto y los
  alias (`componentes.css`, `componentes-tokens.css`, el `:root` de `index.html`) se declaran también en
  `[data-theme]`: un alias calculado en `:root` llega ya resuelto (claro) a los hijos.
- **Crédito Siembra** es la Visa Pichibank blanca (Jorge, Luis y Andrés la tienen). El reverso de cada
  tarjeta toma su color (amarillo, grafito, plata) y todas llevan un borde interior de 1 px de contraste.
- **Luz con giroscopio en todas las tarjetas, sin color:** la Siembra (`assets/tarjetas/visa-credito/`) y la
  Black (`assets/tarjetas/black/`, cuyo fondo ya trae las líneas: la tinta va sobre esas líneas finas) son capas `fondo.svg`, un brillo
  sobre el fondo, `uv.svg` (formas), la tinta (brillo neutro recortado con la máscara `uv.svg`), un punto
  de luz y `logos.svg`; en las de imagen, un reflejo encima. Las bandas van casi horizontales porque lo
  común es inclinar el teléfono hacia adelante o atrás (beta, el eje más sensible): así suben y bajan.
  `--uv-x`, `--uv-y` y `--uv-luz` (ángulo) van en cada `.tj-arte`. Sin sensores sigue al dedo o al mouse.
  El scroll de la pantalla de la tarjeta también mueve la luz (160 px la llevan de un borde al otro) y se
  suma a la inclinación.
- **iPhone:** el permiso de movimiento se renueva con `click`, no con `pointerdown` (iOS no cuenta el
  pointerdown de un dedo como gesto y `requestPermission` fallaba en silencio). Si al abrir una tarjeta
  no llegan lecturas, se muestra el aviso (una vez por visita).

### 5.4 Orquestador de Uku (acuerdo del 21 de octubre)

**Nada de la lógica de las conversaciones va quemada en el front.** Todo lo que escribes en el chat (y cada
botón de sus respuestas) pasa primero por el orquestador (`orquestador/`, ver su `LEEME.md`): elige la
habilidad, esta usa herramientas (hoy `finanzas`, que lee los datos de la persona) y responde mensajes con
un contrato fijo (texto, título, cifra, barras, filas, medidores y acciones). El front
(`assets/orquestador.js` + `orqPintar` en `uku-app.js`) solo los dibuja con componentes genéricos.
Destinos, tarifas y reglas viven en `orquestador/config/`.

- Corre igual en un Web Worker (la demo en Pages, sin servidor) y en `server.js` (`POST /api/orquestador`);
  con `localStorage.setItem('orq-url', …)` la app usa el servidor.
- El estado de la conversación es opaco para el front: se guarda por persona y se devuelve en cada petición.
- Si ninguna habilidad atiende el mensaje (`manejado: false`), el front responde como antes. Lo que hoy
  responde el front (dinero, ayuda, acciones) se puede ir pasando como habilidades.
- Lo que el orquestador tiene en marcha (p. ej. un viaje) aparece como sugerencia en el globo del inicio y
  en Mis finanzas.
- En el buscador, una frase (tres palabras o más) con Enter se le pregunta a Uku; una búsqueda corta abre
  el primer resultado.

**Demo: planear un viaje** («Quiero viajar a Galápagos» o «Planear un viaje» en el buscador): destino, días,
personas y fecha → presupuesto del viaje (pasajes, hospedaje, comida, paseos, movilidad e imprevistos) que se
guarda como presupuesto específico → si no alcanza sin tocar ahorros ni el colchón de un mes, una meta (o se
actualiza la que ya existe, como la de Andrés); si alcanza, apartar el dinero → con la meta cumplida
(«Simular: pasan los meses»), el control del viaje: cuánto puedes gastar hoy, cada parte contra su
presupuesto (ámbar al 80 %) e imprevistos como reserva → un resumen al volver y pasar lo que sobró al ahorro.

## 6. Buscador

- Sin título ni subtítulo: la hoja es el campo, el micrófono, la cámara y "Cancelar".
- Placeholder que explica: "¿Qué necesitas?".
- Cámara: abre "Pagar con QR".
- Sugerencias agrupadas por caso de uso: Pagar y enviar; Mi dinero; Ayuda y seguridad.
  Además, cinco frases frecuentes como chips (estilo de la app). Tocar una llena la búsqueda.

### 6.1 Base de conocimiento

- Las preguntas frecuentes, los productos y las acciones del flujo viven en una sola base:
  `assets/conocimiento/base.json` (155 entradas, con sinónimos y valores de la demo). La indexa y
  busca `assets/conocimiento.js` en el teléfono, sin servidor. Detalle en `docs/base-de-conocimiento.md`.
- Los temas siguen el centro de ayuda de Banco Pichincha (Banca Móvil, Tarjetas, Cuentas, Reclamos);
  los montos y plazos son los de la demo.
- El buscador muestra una tarjeta de respuesta solo con confianza alta; Uku responde con la base
  antes que con sus temas genéricos, pero un inconveniente guiado (Soporte) sigue teniendo prioridad.
- Las preguntas que también existen en `assets/soporte.js` llevan el mismo título y la misma
  respuesta; `tools/conocimiento-validar.js` avisa si se desalinean. `tools/conocimiento-probar.js`
  mide el buscador con 190 consultas reales: no bajar del 90 % en primer lugar.

- Caché: el service worker pide la app por red con `no-cache` y borra sus cachés viejas al activarse; la
  demo no usa service worker, así que el workflow reemplaza `__BUILD__` también en `buscador/` y todo
  lo que carga (estilos, scripts, `base.json`, `datos.json`) lleva `?v=<commit>`: cada despliegue
  invalida la caché HTTP del navegador. Un archivo nuevo en la demo debe llevar `?v=__BUILD__`.
- `sandbox/` es el banco de pruebas público (hub, el mundo 3D de Uku con sus recomendaciones, animaciones y
  háptica en cámara lenta, y el explorador de la base de conocimiento, la base de personas y el repo).
  Comparte la persona con `buscador/` (`kbdemo_usuario`) y usa solo clases de la app; `pfm.js` expone
  `load` y `setPersona` para correr sin la pantalla de Mis finanzas.
- La demo pública del buscador vive en `buscador/` y se publica con el workflow de Pages (solo
  acepta `main`). Cambia según la persona de `assets/pfm/datos.json`; la agenda de cada persona
  (contactos, exterior, Deuna, domiciliados, recurrentes) la genera `tools/pfm-agenda.py`, no se
  edita a mano. `camila` es la persona nueva sin movimientos: cualquier pantalla debe aguantar una
  persona sin historial (en `pfm.js`, `curMes()` cae al mes de hoy).

## 7. Escáner de Pagar con QR

- Visor redondeado de 16 px con marco amarillo.
- "Ingresar código" es un botón secundario del mismo porte que "Continuar".

## 8. Marca, íconos e identidad

- Logo: círculo amarillo a la izquierda y "pichibank" en minúsculas. Variantes: normal (azul marino),
  blanco (modo oscuro) y splash (círculo azul marino sobre el fondo amarillo del splash).
- Avatar de stories y favicon: círculo amarillo con "pb" en azul marino.
- Icono de la PWA y de inicio (Safari): **Safari no usa SVG para favicon**; usa `apple-touch-icon`,
  que también es el icono de la pantalla de inicio. Los PNG se regeneran cuando cambia el icono.
- Todo archivo nuevo que se carga al inicio debe agregarse al precache de `sw.js`.

## 9. Textos y tono

- Lenguaje claro y normal: ni formal ni chabacano.
- Evitar frases con doble sentido ("te ponen", "te entran" y similares).
- Mensajes atemporales: el Mundial ya terminó. El login dice "¡Vive la alegría del fútbol con Pichibank!".
- Las páginas "Próximamente" muestran solo su mensaje: el título, el ícono y el botón "Continuar" del
  placeholder se ocultan.

## 10. Reglas técnicas que nos costaron tiempo

- **`hidden` siempre oculta.** El CSS base de `index.html` está en `@layer base` y `componentes.css` va
  al final sin capa, así que cualquier `display` de un componente (p. ej. `.bp-alert { display: flex }`)
  le gana a una regla `#algo[hidden] { display: none }` del base, aunque tenga id. Así se veía «Sin
  internet» en el login con conexión. Por eso `componentes.css` tiene `[hidden] { display: none
  !important }`, y el barrido revisa en cada pantalla que nada con `hidden` se vea.
- **Un id gana sobre una clase.** `#push-page { z-index: 310 }` tapaba al login aunque la clase tuviera 600.
  Para forzar algo sobre el login hay que usar selectores con el mismo nivel de especificidad o mayor.
- **Capas al abrir sin ingresar** (con `body.sin-sesion`): login 500; páginas de Ayuda y push 600; selector
  de idioma 650/651; toasts 690; overlay de ingreso 700.
- **Service worker:** las peticiones a archivos de la app van primero a la red y caen a caché (y luego a
  `index.html`). Cualquier comprobación de red debe apuntar a algo fuera de esa regla.
- **Nombres y textos de acciones:** el `data-action` es la clave de la función; el texto visible puede
  cambiar sin tocar la lógica. Al cambiar un nombre visible, revisar también los mapas de iconos y
  las listas de accesos públicos o transaccionales.
- **Un observador que escribe lo mismo se dispara solo.** `privacidad.js` reescribía el mismo ícono y
  `aria-*` cada 60 ms desde su propio `MutationObserver` y congelaba la página al entrar a Mis finanzas.
  Todo observador debe escribir solo cuando el valor cambia.
- **Las variables `--uk-*` viven en `.uk`.** Las hojas (`.as-sheet`) cuelgan de `body`, así que una regla
  de hoja que use `var(--uk-accent)` queda sin valor (el botón principal salía transparente). En hojas se
  usan los tokens `--bp-*` directamente.
- **Un solo lugar decide si Uku está «en foco»** (conversando, sin su mundo) o en su mundo: `modo()` y, al
  montar la escena, la misma regla (`is-chat` y no Mis finanzas ni Soporte), anotada en `host._foco`. Al
  montarla con otra regla, Soporte quedaba sin bosque.
- **Efecto de escritura:** se parte el texto en `span.uk-w` con `animation-delay` después de un
  `setTimeout 0`, para que el traductor (`MutationObserver` de i18n) traduzca la frase completa antes.
- **Barrido antes de publicar:** `node tools/barrido.js <carpeta>` recorre todas las pantallas con las
  seis personas y revisa los errores que ya vimos: errores de JS y de consola, archivos que no cargan,
  que la página siga respondiendo, scroll horizontal, el botón principal de las hojas sin fondo, la
  barra de abajo (oculta en Mis finanzas) y el aviso con «Deshacer». Con `BASE=` apunta a otra copia
  (p. ej. `main` en otro puerto) para comparar las capturas.
- **Componentes sin estilo:** al rehacer una pantalla desde cero se perdieron estilos que el código
  seguía usando («Lo que encontré», barras y datos de las respuestas). Antes de borrar CSS, buscar
  también lo contrario: clases que el JS genera y que no tienen ninguna regla.
- **Clases armadas por código:** `'dw--' + w.size`, `'pf-meter--' + tono`, `'pv-tx__em--' + t.em`…
  no aparecen literales en el código. Una poda anterior borró `.dw--m`/`.dw--l` (los widgets medianos
  quedaron de media columna) y los tonos de ingresos. El detector de CSS sin uso trata como usada
  toda clase que empiece con un prefijo que el código completa (`'algo-' +`); al podar a mano, buscar
  también el prefijo.
- **Atrás del navegador y gesto de Safari:** cada pantalla completa abierta deja una entrada en el
  historial (`navegacion.js` con `window.Overlay` de `sheets.js`), así el atrás del teléfono, del navegador
  o el gesto desde el borde de Safari cierra la pantalla de arriba en vez de volver a una página anterior
  (se veía el login detrás). En Safari de iPhone, en el navegador, no se usa el gesto propio: compite con
  el de Safari. El análisis (`analisis.js`) ya registra su entrada y se excluye.
- **`reverse()` en una animación en pausa:** Safari no la reanuda. El gesto deja en pausa la animación de
  la pantalla de abajo; al cerrar quedaba corrida a medio camino (Inicio con una franja gris). Después de
  `reverse()` se llama `play()`, y al terminar la animación se cancela siempre.
- **Fondo amarillo y círculo amarillo** no se distinguen: en el splash se usa la variante azul.

## 11. Pendientes y preguntas abiertas

- "Pagar transporte" (acción interna) se ve como "Tickets transporte" en el login, pero la página
  sigue llamándose "Pagar transporte" y dice "Próximamente".
- La pantalla de QR se llama "Cobrar con QR" dentro de la app; el login dice "Mostrar mi QR".
- El selector de idioma tiene English como mock "Próximamente", sin traducciones todavía.
- El aviso del login sigue la especificación del componente de Figma (nodo `3512:5465`). La
  herramienta de Figma quedó desconectada en algún momento; si se necesitan más variantes, revisar el acceso.
- Préstamos e inversiones se consideran informativos sin internet. Si se contratan sin internet,
  pasan a la lista transaccional.
- Mostrar mi QR se considera informativo. Si el equipo decide lo contrario, se agrega a la lista.
- ~~Las pruebas headless viven fuera del repo~~: el barrido completo ya está en `tools/barrido.js`
  (ver §10).
