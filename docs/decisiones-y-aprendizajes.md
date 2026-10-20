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

- **La conexión se comprueba con una sonda real**, no con `navigator.onLine`: `assets/sonda.txt`,
  del mismo sitio, que el service worker no guarda en caché. Se revisa al abrir, al volver a la app,
  al recuperar la red y cada 30 s.
  - Por qué no `navigator.onLine`: un Wi-Fi sin salida sigue marcado como conectado.
  - Por qué no un host externo (gstatic): algunas redes lo bloquean y dejarían el login cerrado.
  - Por qué no una ruta de la app: el service worker responde desde caché y devolvería `index.html`.
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

Usar siempre los tokens, nunca valores fijos:

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
- **Márgenes laterales:** `--bp-layout-grid-margin` (16). Nada pegado al borde, nada con doble margen.
- **Título de pantalla:** `view-title` (como «Perfil»). En las hojas, el título va en la cabecera con la X al
  mismo nivel (`title-sm`, color `text-primary`).
- **Etiqueta de sección:** una línea en gris encima de cada tarjeta, en frase (nunca en mayúsculas):
  `--ui-body-sm-medium` (14/20), color `--bp-theme-color-text-helper`, alto `--bp-semantic-size-interactive-xs`
  (40) y 8 px (`micro-md`) hasta la tarjeta. Opcional: una segunda línea corta con el mismo gris y, a la
  derecha, un enlace «Ver todo» en `--bp-theme-color-text-interactive`.
- **Tarjeta (grupo de filas):** `--bp-theme-color-surface-container-default` (blanco), radio
  `--bp-semantic-radius-md` (12), sin borde ni sombra, `overflow: hidden`. Entre tarjetas, 24 px
  (8 de `padding-top` de la sección + 16 de `padding-bottom`).
- **Fila:** `min-height` 64 (`--ui-row`), relleno `--bp-semantic-spacing-macro-md` (24) arriba y abajo por
  `--bp-layout-card-padding` (16) a los lados, `gap` `--bp-semantic-spacing-micro-lg` (12). Divisor
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

Dónde está aplicado: Perfil (`index.html`), las hojas de Mis finanzas (`hubHTML` en `assets/pfm.js`) y de
Soporte (`ayudaHTML` en `assets/uku-app.js`), con las clases `.pfm-hub__*` y `.uk-ay__*` en
`assets/uku-app.css`.

## 6. Buscador

- Sin título ni subtítulo: la hoja es el campo, el micrófono, la cámara y "Cancelar".
- Placeholder que explica: "¿Qué necesitas?".
- Cámara: abre "Pagar con QR".
- Sugerencias agrupadas por caso de uso: Pagar y enviar; Mi dinero; Ayuda y seguridad.
  Además, cinco frases frecuentes como chips (estilo de la app). Tocar una llena la búsqueda.

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

- **Un id gana sobre una clase.** `#push-page { z-index: 310 }` tapaba al login aunque la clase tuviera 600.
  Para forzar algo sobre el login hay que usar selectores con el mismo nivel de especificidad o mayor.
- **Capas al abrir sin ingresar** (con `body.sin-sesion`): login 500; páginas de Ayuda y push 600; selector
  de idioma 650/651; toasts 690; overlay de ingreso 700.
- **Service worker:** las peticiones a archivos de la app van primero a la red y caen a caché (y luego a
  `index.html`). Cualquier comprobación de red debe apuntar a algo fuera de esa regla.
- **Nombres y textos de acciones:** el `data-action` es la clave de la función; el texto visible puede
  cambiar sin tocar la lógica. Al cambiar un nombre visible, revisar también los mapas de iconos y
  las listas de accesos públicos o transaccionales.
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
- Las pruebas headless que usamos viven fuera del repo. Conviene moverlas a `tools/` para que
  cada cambio se pueda verificar igual.
